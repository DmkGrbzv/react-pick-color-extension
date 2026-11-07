# First manual EC2 staging deployment

This runbook prepares one **Ubuntu Server 24.04 LTS x86_64/amd64** host with
host Nginx, one backend container and the existing MongoDB Atlas staging database.
It reuses `backend/deploy/deploy.js`; there is no second deployment engine.
Commands below are manual. The GitHub staging workflow only prepares a bundle.
Do not deploy the unauthenticated local-development Mongo Compose on EC2.

## 1. Confirm inputs and cost before creating anything

The owner must review **Billing and Cost Management → Free Tier / Credits**, the
account's plan/expiry and **AWS Pricing Calculator** for the selected region.
Check Linux On-Demand instance hours, EBS gp3 storage, public IPv4, transfer,
snapshots, DNS and any burst CPU charges. Do not assume the instance is free.
On 2026-11-07 the published public IPv4 rate is **$0.005/hour/address**, including
Elastic IPs; account credits and taxes can change the bill. Stopping EC2 does not
remove EBS or an allocated Elastic IP's charges. Do not launch until the owner
has accepted the current estimate and account terms. Set a billing budget alert.

See [EC2 prices](https://aws.amazon.com/ec2/pricing/on-demand/),
[IPv4 prices](https://aws.amazon.com/vpc/pricing/),
[account offers](https://aws.amazon.com/free/) and
[Pricing Calculator](https://calculator.aws/). This repo cannot inspect the
owner's billing entitlement and does not create AWS resources.

Collect these values; all angle-bracket / `__STAGING_DOMAIN__` values below are
**placeholders**, not literal commands to run unchanged:

| Input                                                       | Where it comes from                                   |
| ----------------------------------------------------------- | ----------------------------------------------------- |
| AWS region, instance type, disk size and accepted estimate  | Owner's AWS console/calculator                        |
| `<EC2_PUBLIC_HOST>`, instance ID, actual public egress IPv4 | EC2 instance / Networking                             |
| `<EC2_SSH_USER>`                                            | EC2 **Connect → SSH client**, for the selected AMI    |
| `<DEPLOY_USER>`                                             | Owner chooses a dedicated Linux user, lower-case name |
| `<ADMIN_PUBLIC_IP>/32`                                      | Administrator's current public IPv4                   |
| `<STAGING_DOMAIN>`, DNS access and `<CERTIFICATE_EMAIL>`    | Owner's domain / certificate contact                  |
| Atlas password for `palette_staging_app`                    | Owner, never a chat/commit/bundle                     |
| Real staging OIDC client ID/secret                          | Google OAuth Web application                          |
| Exact extension origins and browser callback URLs           | Installed staging extension                           |
| GHCR read access if private                                 | Dedicated credential with `read:packages` only        |

The baseline checked on 2026-11-07 is master
`4a938edd462f4bd7802437f501d416d90310350f`, with all application checks and
publication successful in [CI run 42331092721](https://github.com/DmkGrbzv/react-pick-color-extension/actions/runs/42331092721).
The publication receipt (`backend-publication-42331092721-1/image.json`) records:

```text
ghcr.io/dmkgrbzv/react-pick-color-extension-backend:4a938edd462f4bd7802437f501d416d90310350f
ghcr.io/dmkgrbzv/react-pick-color-extension-backend@sha256:ac8d54751779efc4c2f2a22f35f5452955c925fd778868d1e652c2cf6a6ff8dd
```

Recheck master and its CI before selecting a newer release. Never substitute an
Actions ZIP checksum for the image digest. A successful image publication is
not proof of an EC2 deployment.

## 2. Create the instance in AWS (owner action)

1. After the cost review, open **EC2 → Instances → Launch instances** in the
   chosen region. Select Canonical's **Ubuntu Server 24.04 LTS**, architecture
   **64-bit (x86)**. Do not select ARM/Graviton: current CI publishes linux/amd64.
2. Choose an x86 instance size against the accepted estimate. For a small
   staging API without a local database, 2 GiB RAM is a starting sizing estimate,
   not a tested capacity guarantee. For burstable instances, review Standard vs
   Unlimited CPU credit billing. Choose encrypted gp3 storage with room for
   multiple images and logs; keep at least the previous image for rollback.
3. Create/select an SSH key pair; securely retain the private key on Windows.
   Use a public subnet with an Internet Gateway route and public IPv4 for this
   direct-host topology. Do not add a load balancer or NAT gateway for this plan.
4. Create a security group with inbound TCP **22 only from
   `<ADMIN_PUBLIC_IP>/32`**, TCP **80 and 443 from `0.0.0.0/0`**. Do not add 3001
   or MongoDB ports. This runbook uses IPv4 only; do not publish an AAAA record
   without separately configuring IPv6 listeners, routing and firewall rules.
   Keep outbound connectivity for DNS, HTTPS registries/OIDC/updates and Atlas.
5. Require IMDSv2 in Advanced details. Launch only after reviewing the displayed
   settings/cost. Wait for instance status checks to pass; record the instance ID.
6. For a stable DNS and Atlas allowlist, allocate/associate an Elastic IP **only
   after accepting its charges**, or agree another stable egress solution first.
   An automatically assigned public IP can change after stop/start; that requires
   DNS and Atlas allowlist updates. An ordinary reboot normally preserves it.
7. Create an **A record** for `<STAGING_DOMAIN>` pointing to the stable IPv4.
   Use DNS-only mode: no CDN/proxy/ALB in this topology. Verify public DNS before
   requesting a certificate. Check existing CAA policy permits Let's Encrypt.

See [security group rules](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html)
and [Elastic IP behavior](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html).
The backend port is additionally bound to `127.0.0.1` by our staging Compose.

## 3. Connect from Windows and prepare the host

In **Windows PowerShell** (OpenSSH Client must be installed), use the actual
username/host from EC2's Connect tab. Verify the SSH host fingerprint against the
instance's trusted console/system output; do not disable host-key checking.

```powershell
$Ec2Host = '<EC2_PUBLIC_HOST>'
$Ec2SshUser = '<EC2_SSH_USER>'
$Ec2Key = '<ABSOLUTE_PATH_TO_EC2_PRIVATE_KEY.pem>'
ssh -i $Ec2Key "${Ec2SshUser}@${Ec2Host}"
```

If OpenSSH rejects the private key permissions, restrict its NTFS ACL to your
Windows user before retrying. Do not upload the key to GitHub or to the server.
AMI usernames differ: use **Connect → SSH client**, not a guessed username.
See [AWS SSH prerequisites](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/connect-to-linux-instance.html).

The following commands run in **Bash on EC2**, as the original sudo-capable
administrator. Use a fresh Ubuntu host, not a server with existing applications:

```sh
uname -m                         # must be x86_64
dpkg --print-architecture        # must be amd64
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl gnupg xz-utils unzip nano nginx snapd
```

If `/var/run/reboot-required` exists, reboot and reconnect before continuing.
Install Docker Engine and its Compose plugin from Docker's signed apt repository:

```sh
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
printf '%s\n' 'Types: deb' 'URIs: https://download.docker.com/linux/ubuntu' \
  "Suites: $VERSION_CODENAME" 'Components: stable' \
  "Architectures: $(dpkg --print-architecture)" \
  'Signed-By: /etc/apt/keyrings/docker.asc' | sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker containerd nginx
sudo docker version
sudo docker compose version
```

Use the maintained Engine version supplied by that repository (28+ for modern
loopback publication isolation), and Compose **2.24+**. Do not install the legacy
`docker-compose` Python command. Record installed versions in the deployment notes.
If the host already has conflicting Docker packages, follow the
[official Ubuntu installation guide](https://docs.docker.com/engine/install/ubuntu/)
instead of removing packages blindly.

Install **Node.js 22.22.3**, matching CI and the image. Node on the host runs only
the existing deploy tool; there is no `npm install`, build or app source checkout
on the server. Download the official x64 binary and verify its published checksum:

```sh
(
set -euo pipefail
NODE_WORK=$(mktemp -d)
cd "$NODE_WORK"
curl -fSLO https://nodejs.org/dist/v22.22.3/node-v22.22.3-linux-x64.tar.xz
printf '%s\n' '2e5d13569282d016861fae7c8f935e741693c269101a5bebcf761a5376d1f99f  node-v22.22.3-linux-x64.tar.xz' | sha256sum --check -
# Continue only if checksum verification says OK.
sudo install -d -m 0755 /opt/node
sudo tar -xJf node-v22.22.3-linux-x64.tar.xz -C /opt/node
sudo ln -s /opt/node/node-v22.22.3-linux-x64/bin/node /usr/local/bin/node
node --version                  # v22.22.3
)
```

If the checksum fails, stop. The checksum comes from the
[official Node release](https://nodejs.org/en/blog/release/v22.22.3).
Stop on any failed installation command; do not paste subsequent sections until
the preceding checks pass. Future Node changes require a separately checked update.

Create the chosen deploy user (replace the placeholder first):

```sh
DEPLOY_USER='<DEPLOY_USER>'
sudo adduser --disabled-password --gecos '' "$DEPLOY_USER"
sudo usermod -aG docker "$DEPLOY_USER"
sudo install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
sudo install -m 0600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /dev/null "/home/$DEPLOY_USER/.ssh/authorized_keys"
sudoedit "/home/$DEPLOY_USER/.ssh/authorized_keys"
# Paste only the deployment PUBLIC key, never the private key.
sudo install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /etc/tintoom/staging
sudo install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /var/lib/tintoom/staging
sudo install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /var/lib/tintoom/staging/docker
sudo install -d -m 0750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /opt/tintoom/releases
sudo install -d -m 0755 /var/www/tintoom-acme/.well-known/acme-challenge
```

Choose an existing authorized public key or generate a dedicated one on Windows
with `ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\tintoom-staging-deploy"`.
Paste the `.pub` contents into `authorized_keys`. Retain the separate administrator
SSH session until deployment-user login succeeds in another terminal:

```powershell
$DeployUser = '<DEPLOY_USER>'
$DeployKey = '<ABSOLUTE_PATH_TO_DEPLOY_PRIVATE_KEY>'
ssh -i $DeployKey "${DeployUser}@${Ec2Host}"
```

The deploy user needs no general sudo. Membership in the Docker group is
effectively root access to the host, so keep that key restricted. The application
inside the container still runs as the existing unprivileged `node` UID 1000.
Administrator-only Nginx/certificate/reboot steps stay in the original SSH session.

## 4. Prepare and transfer the verified release bundle

After this configuration PR is merged, open **Actions → Prepare staging delivery
→ Run workflow**, select **master** and enter the full checked application SHA.
For the initial known release, use `4a938edd462f4bd7802437f501d416d90310350f`.
Approve the `staging` Environment if required. This does not deploy to EC2.

Download the successful run's `staging-release-...` ZIP from **Artifacts**. It
contains current trusted deployment tooling, Nginx templates and this runbook,
plus `.ci-reports/staging/release.json` / `release.env` for the selected image.
Tooling comes from the workflow's master checkout; image SHA is the explicit
input. Review both when preparing an older application release with newer tooling.
Artifacts expire after seven days; rerun preparation if expired.

In Windows PowerShell, transfer **only that ZIP**, not the project or local env:

```powershell
$BundlePath = '<ABSOLUTE_PATH_TO_DOWNLOADED_STAGING_RELEASE.zip>'
Get-FileHash -Algorithm SHA256 $BundlePath
scp -i $DeployKey $BundlePath "${DeployUser}@${Ec2Host}:/opt/tintoom/releases/staging-release.zip"
```

As the **deploy user on EC2**:

```sh
umask 077
sha256sum /opt/tintoom/releases/staging-release.zip
# Compare this transfer checksum with Get-FileHash. It is NOT the image digest.
RELEASE_DIR='/opt/tintoom/releases/<UNIQUE_RELEASE_DIRECTORY>'
mkdir -m 0750 "$RELEASE_DIR"
unzip -q /opt/tintoom/releases/staging-release.zip -d "$RELEASE_DIR"
cd "$RELEASE_DIR"
node --input-type=module -e 'import fs from "node:fs"; const r=JSON.parse(fs.readFileSync(".ci-reports/staging/release.json","utf8")); console.log(JSON.stringify({sha:r.sha,image:r.image,checkedRun:r.checkedRun},null,2));'
```

Verify the full SHA, `checkedRun` and digest against the successful publication's
`image.json`, not just a tag lookup. For the baseline use the exact digest above.
Keep a unique directory per bundle and retain previous tooling for rollback.
Do not run `release.env` as a shell script; the explicit image argument below is
read from reviewed `release.json`.

## 5. Configure Atlas, OIDC and the private runtime file

In **Atlas → Network Access**, add only the EC2 server's actual outbound public
IPv4 as a `/32` entry. For this direct public-subnet topology it is the associated
public/Elastic IP; recheck it if networking changes. Do not use `0.0.0.0/0`.
Confirm the database user `palette_staging_app` has **readWrite only on
`palette_staging`** and the cluster is available. See
[Atlas IP access](https://www.mongodb.com/docs/atlas/security/ip-access-list/).

As the deploy user, create the file once; preserve it on later releases:

```sh
test ! -e /etc/tintoom/staging/backend.env && \
  install -m 0600 backend/deploy/.env.example /etc/tintoom/staging/backend.env
nano /etc/tintoom/staging/backend.env
chmod 0600 /etc/tintoom/staging/backend.env
stat -c '%a %U %n' /etc/tintoom/staging/backend.env
```

Fill the following **in the editor**, never as commands containing secrets:

```dotenv
PUBLIC_API_URL=https://<STAGING_DOMAIN>
MONGODB_URI='mongodb+srv://palette_staging_app:<URL_ENCODED_PASSWORD>@palette-staging.kyvrc93.mongodb.net/palette_staging?authSource=admin&tls=true'
MONGODB_DATABASE=palette_staging
OIDC_ISSUER=https://accounts.google.com
OIDC_CLIENT_ID=<REAL_STAGING_GOOGLE_CLIENT_ID>
OIDC_CLIENT_SECRET='<REAL_STAGING_GOOGLE_CLIENT_SECRET>'
AUTH_REDIRECT_URIS=<EXACT_BROWSER_IDENTITY_CALLBACK_URLS_COMMA_SEPARATED>
EXTENSION_ORIGINS=<EXACT_EXTENSION_ORIGINS_COMMA_SEPARATED>
SESSION_TTL_SECONDS=86400
TRUST_PROXY_HOPS=1
STAGING_API_PORT=3001
```

Percent-encode reserved characters in the **password component** of the URI.
Single quotes preserve literal `$` in Compose env-file values; do not `source`
this file. `authSource=admin` selects authentication, not application storage:
the backend explicitly calls `client.db(MONGODB_DATABASE)`, so application data
uses **palette_staging**, matching the user's role. SRV plus `tls=true` uses TLS;
do not disable certificate validation.

Register **`https://<STAGING_DOMAIN>/v1/auth/callback`** in the actual staging
Google Web OAuth client's allowed redirect URIs. This server callback differs
from `AUTH_REDIRECT_URIS`: those are exact browser identity callbacks obtained
with `chrome.identity.getRedirectURL('oauth')`. Origins come from
`chrome.runtime.getURL('').replace(/\/$/, '')`. Use the real installed extension's
values; unpacked/release IDs may differ. Add test users if Google consent is in
testing mode. Do not use fake OAuth values just to start the API.

`TRUST_PROXY_HOPS=1` is correct **only for client → host Nginx → backend**.
Docker port forwarding adds no HTTP proxy hop. The template overwrites forwarded
IP/host/protocol/port and rejects other Host values. Any CDN/ALB/additional proxy
requires a fresh trust/allowlist review; never increase the value blindly. See
[Express proxy trust](https://expressjs.com/en/guide/behind-proxies/).

Keep `backend.env` outside Git, ZIPs, image layers and diagnostic artifacts.
Do not run `docker inspect` without a narrow `--format`, `docker compose config`
without `--quiet`, `printenv`, `cat backend.env`, `set -x` or verbose HTTP traces:
these can expose credentials. Root/Docker administrators can access container
environment; file permissions do not protect secrets from host administrators.

## 6. Enable host Nginx and HTTPS (administrator)

Keep `backend.env` unchanged at this step. In the administrator Bash session,
point at the extracted release and real DNS name (DNS hostname only, no scheme,
port, slash or wildcard):

```sh
RELEASE_DIR='/opt/tintoom/releases/<UNIQUE_RELEASE_DIRECTORY>'
STAGING_DOMAIN='<STAGING_DOMAIN>'
(
set -euo pipefail
# Reject unreplaced placeholders or non-hostname characters before rendering.
printf '%s\n' "$STAGING_DOMAIN" | grep -Eq '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$'
# Continue only if validation succeeds and DNS points to this EC2.
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.before-tintoom
sudo install -d -m 0755 /etc/nginx/tintoom-staging
sudo sed "s/__STAGING_DOMAIN__/$STAGING_DOMAIN/g" \
  "$RELEASE_DIR/backend/deploy/nginx/http.conf.template" | \
  sudo tee /etc/nginx/sites-available/tintoom-staging >/dev/null
# Fresh dedicated host only: disable Ubuntu's default site, preserving its file.
sudo unlink /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/tintoom-staging /etc/nginx/sites-enabled/tintoom-staging
sudo nginx -t && sudo systemctl reload nginx
)
```

Do not continue if `nginx -t` fails. If `default` is already disabled, skip that
unlink; do not remove another application's site. The bootstrap site serves only
ACME challenges; other requests get 503 until the certificate is installed.
These templates assume the fresh Ubuntu default `http` includes for
`sites-enabled` and no other sites. Neither template should be included twice.

Install Certbot, issue the certificate using HTTP-01 on port 80, then install
the TLS template. Replace the contact placeholder before running:

```sh
(
set -euo pipefail
sudo snap install --classic certbot
sudo /snap/bin/certbot certonly --webroot -w /var/www/tintoom-acme \
  --cert-name "$STAGING_DOMAIN" -d "$STAGING_DOMAIN" \
  --email '<CERTIFICATE_EMAIL>' --agree-tos --non-interactive
# Continue only if the certificate was issued successfully.
sudo cp /etc/nginx/sites-available/tintoom-staging /etc/nginx/tintoom-staging/bootstrap.conf
sudo sed "s/__STAGING_DOMAIN__/$STAGING_DOMAIN/g" \
  "$RELEASE_DIR/backend/deploy/nginx/https.conf.template" | \
  sudo tee /etc/nginx/sites-available/tintoom-staging >/dev/null
sudo nginx -t && sudo systemctl reload nginx
sudo install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
sudo install -m 0755 "$RELEASE_DIR/backend/deploy/nginx/renew-hook.sh" \
  /etc/letsencrypt/renewal-hooks/deploy/tintoom-nginx
sudo systemctl status snap.certbot.renew.timer --no-pager
sudo /snap/bin/certbot renew --dry-run --run-deploy-hooks
)
```

Keep HTTP/80 open for renewals. Normal HTTP requests redirect to HTTPS; the ACME
challenge directory remains reachable. The renewal hook validates `nginx -t`
before reload. Keep certificate keys under Certbot's root-managed permissions;
never copy them into backend.env or bundles. If the TLS config check fails,
restore `/etc/nginx/tintoom-staging/bootstrap.conf` to the site file, validate
again, and fix the certificate/path before proceeding.

The safe access log records timestamp, client IP, method, status and timing, with
no URL/query/cookies/authorization. Per-site request error logging is deliberately
disabled: Nginx's error context can expose OAuth callback queries. Use response
statuses, container health and the backend's sanitized startup errors for
diagnosis. Do not enable debug/combined request logging during real sign-in.
Ubuntu's `/etc/logrotate.d/nginx` covers these `*.log` files; verify it locally.

See [certificate issuance/renewal](https://ubuntu.com/server/docs/how-to/security/obtain-tls-certificates/),
[Nginx proxy directives](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
and [access-log configuration](https://nginx.org/en/docs/http/ngx_http_log_module.html).

## 7. Pull and deploy the immutable image (deploy user)

In the deploy-user session, with the correct extracted release directory:

```sh
cd '/opt/tintoom/releases/<UNIQUE_RELEASE_DIRECTORY>'
export STAGING_ENV_FILE=/etc/tintoom/staging/backend.env
export STAGING_STATE_DIR=/var/lib/tintoom/staging
export STAGING_READY_TIMEOUT=90
export DOCKER_CONFIG=/var/lib/tintoom/staging/docker
IMAGE=$(node --input-type=module -e 'import fs from "node:fs"; console.log(JSON.parse(fs.readFileSync(".ci-reports/staging/release.json","utf8")).image);')
# Confirm IMAGE matches the reviewed publication receipt and uses @sha256.
printf '%s\n' "$IMAGE"
docker version
docker compose version
```

Try `docker pull "$IMAGE"`. Public GHCR packages permit anonymous pull. If it is
private, **do not change package visibility**. Use an identity already authorized
to read this package and a short-lived/expiring classic PAT with **read:packages**
only (and organization SSO authorization if required). Do not grant write/delete
or broad repository scopes for the server. On EC2, enter the token without echo
or command-history expansion:

```sh
read -r -p 'GHCR reader username: ' GHCR_USER
read -r -s -p 'GHCR read-only token: ' GHCR_TOKEN
printf '\n'
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
unset GHCR_TOKEN
chmod 0600 "$DOCKER_CONFIG/config.json"
docker pull "$IMAGE"
```

Without a credential helper, Docker stores reusable auth in that private config
directory (not encrypted). Do not share or archive it. `docker logout ghcr.io`
removes it; later updates/rollback pulls then require login again. A workflow's
`GITHUB_TOKEN` is not a permanent EC2 credential. See
[GHCR authentication](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

Only after pull succeeds, verify linux/amd64 and the revision label against the
selected commit, validate Compose without printing environment, and deploy:

```sh
docker image inspect --format '{{.Os}}/{{.Architecture}} {{index .Config.Labels "org.opencontainers.image.revision"}}' "$IMAGE"
BACKEND_IMAGE="$IMAGE" docker compose --project-name tintoom-staging \
  --env-file "$STAGING_ENV_FILE" -f backend/deploy/compose.yaml config --quiet
node backend/deploy/deploy.js "$IMAGE"
```

Stop if the image is not linux/amd64 or the label differs from `release.json.sha`.
No build or dependency installation happens on EC2. The existing script locks
the shared state directory, records the prior digest and waits for Docker's
`/ready` healthcheck with a bounded timeout. A failed update restores the cached
previous image when available. On the **first deployment there is no previous
image**: failure stops the new backend and reports that limitation.

One container replacement causes a short staging interruption; this is not a
zero-downtime deployment. No Mongo container, volume cleanup or Atlas tests run.
Normal API startup does create its existing indexes in `palette_staging`; this
is real application initialization, not a read-only Atlas connection probe.

## 8. Acceptance checks and recovery

As deploy user in the release directory, retain the exports from section 7:

```sh
CONTAINER=$(BACKEND_IMAGE="$IMAGE" docker compose --project-name tintoom-staging \
  --env-file "$STAGING_ENV_FILE" -f backend/deploy/compose.yaml ps --all --quiet backend)
docker inspect --format '{{.State.Status}} {{.State.Health.Status}} {{.HostConfig.RestartPolicy.Name}}' "$CONTAINER"
# Expected: running healthy unless-stopped
docker port "$CONTAINER" 3001
# Expected: 127.0.0.1:3001
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3001/health
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3001/ready
curl --fail --silent --show-error --max-time 10 'https://<STAGING_DOMAIN>/ready'
```

`/health` must return 200/`{"status":"ok"}`, `/ready` 200/`{"status":"ready"}`.
Also run the HTTPS request from **Windows**, proving public DNS/firewall/TLS:

```powershell
curl.exe --fail --silent --show-error --max-time 10 'https://<STAGING_DOMAIN>/ready'
curl.exe --silent --show-error --max-time 10 --output NUL --write-out '%{http_code}\n' 'https://<STAGING_DOMAIN>/v1/me'
# Expected unauthenticated response: 401. Never supply a real token for this check.
Test-NetConnection -ComputerName $Ec2Host -Port 3001
# Expected TcpTestSucceeded: False; also inspect SG inbound rules explicitly.
```

Do not use `--insecure` / `-k`. HTTP `/ready` should return 308 to the HTTPS URL.
A 401 validates the unauthenticated boundary, not a full Google sign-in test.
Test actual staging sign-in separately with the configured extension after the
infrastructure checks. Only the extension's public API URL
`VITE_PALETTE_API_URL=https://<STAGING_DOMAIN>` belongs in its build; backend
credentials must never go into frontend env variables.

Docker container readiness is the deploy script's automatic gate. DNS, Nginx,
TLS and the public 401 are **manual acceptance gates** at this stage. If these
fail, do not mark the release accepted. Fix the host configuration, or, after a
second release exists, run the existing `--rollback` command and repeat every
acceptance check. Rollback does not restore Nginx, certificates or runtime env;
keep compatible config and restore reviewed host config separately if needed.

As administrator, test restart recovery during this staging maintenance window:

```sh
sudo systemctl restart docker
```

Wait up to 120 seconds for container health/HTTPS readiness and repeat the above
checks. Then run `sudo reboot`, reconnect and repeat them once more. With services
enabled and `restart: unless-stopped`, a running container should recover. A
manually stopped container intentionally stays stopped; Docker does not restart
an unhealthy-but-running process automatically. Keep Atlas and OAuth reachable.
Record actual timings/results rather than assuming the policy proves recovery.

On a failed first deploy, there is nothing to roll back to. Fix the real runtime
configuration/network and rerun the same digest. For diagnosis use narrow health
inspection and `docker logs --tail 50 "$CONTAINER"` locally; do not publish raw
host/config dumps. A red `/ready` with green `/health` indicates a dependency or
draining problem, not permission to delete the database.

## 9. Next release and a real rollback rehearsal

1. Select another master SHA only after its required CI checks and publication
   succeed. Download its prepared bundle into a **new** release directory.
2. Review data/index compatibility with the previous image. The same Atlas data
   survives both update and rollback. Destructive schema/index changes need a
   separate migration/backup plan; an image rollback never undoes data changes.
3. Use the same private env/state paths and Docker project. Keep both image
   digests cached; do not prune them or delete release/state directories.
4. Repeat the pull/digest/revision checks, then run `node
backend/deploy/deploy.js "$IMAGE"` from the new bundle. Complete section 8.
5. After the **second working version** is accepted, record its digest and the
   prior digest from the safe state file. Rehearse rollback using the same tool:

```sh
node backend/deploy/deploy.js --rollback
CONTAINER=$(BACKEND_IMAGE="$IMAGE" docker compose --project-name tintoom-staging \
  --env-file "$STAGING_ENV_FILE" -f backend/deploy/compose.yaml ps --all --quiet backend)
docker inspect --format '{{.Config.Image}} {{.State.Health.Status}}' "$CONTAINER"
```

Verify the resulting current digest is the recorded previous one, the container
is healthy, localhost and HTTPS `/ready` succeed and `/v1/me` still rejects no
authorization with 401. Record results/time and, if desired, explicitly deploy
the newer verified digest again. Until this real rehearsal succeeds, describe
rollback as **unit-tested / prepared**, not verified on EC2.

The shared `deployment.lock` serializes manual invocations. Do not use another
state directory or Compose project to bypass it. If a deployment is interrupted,
inspect processes and `/var/lib/tintoom/staging/deployment.json` before removing
an orphaned lock; then use the existing recovery behavior described in
[backend delivery](backend-delivery.md#update-and-rollback). Never remove a live
lock. No procedure here deletes databases, named volumes or package versions.

## What is and is not verified

- The baseline master CI and GHCR publication above were checked on GitHub.
- Local verification on 2026-11-07 passed lint/architecture, all 46 ordinary
  backend tests (including deploy/rollback cases), workflow actionlint and focused
  formatting. Isolated Nginx 1.30.6 checks passed HTTP/HTTPS config validation,
  HTTP-01 webroot serving, HTTPS proxying to a stub, redirects, forwarded-header
  overwrite and omission of diagnostic markers from access logs. All 14 Bash
  command blocks and the renewal hook passed shell syntax checks. Compose
  validation confirmed loopback-only publication, restart policy, read-only root
  filesystem and bounded logs without starting the application. A local test
  certificate and stub responses do not verify EC2, public TLS or real API auth.
- No EC2 resource, real certificate, server registry login, remote container,
  Atlas connection from EC2, reboot recovery or real image rollback has yet been
  verified by this change. Complete the manual acceptance steps and retain a
  dated record with instance ID, application SHA/digest, bundle run and results,
  excluding secrets.
- Automatic remote deployment through GitHub Actions is a later task, after the
  first manual deployment and subsequent rollback rehearsal have evidence.
