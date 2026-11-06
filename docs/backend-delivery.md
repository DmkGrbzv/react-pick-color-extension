# Backend containers and staging delivery

## Local development

Node.js 22.22.3 is shared with CI and the backend image. Node/MongoDB base images
are pinned by manifest digest; dependency installation uses the backend lockfile.
The image copies only application sources, package manifests and the health probe.
Runtime credentials, tests and deployment configuration are not copied into it.

From the repository root, create `backend/.env` from `backend/.env.example` only
on a new checkout. Preserve an existing configured file. Fill the OAuth settings
and browser allowlists as described in the backend README.

```sh
# Full stack, local development only:
docker compose -f backend/compose.yaml --profile api up -d --build --wait --wait-timeout 150
curl --fail http://localhost:3001/health
curl --fail http://localhost:3001/ready

# Stop/remove containers and network; keep the database volume:
docker compose -f backend/compose.yaml down
```

The existing host workflow is preserved:

```sh
docker compose -f backend/compose.yaml up -d mongo
docker compose -f backend/compose.yaml run --rm mongo-init
npm ci --prefix backend
npm run dev --prefix backend
```

Use `mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true` on the host;
inside Compose the API connects to `mongo:27017` with the same options. `rs0`
advertises `mongo:27017`. A direct connection lets the single exposed host port
work without host DNS changes. Existing single-member `rs0` configurations,
including old `localhost:27017` configurations, are kept. No forced reconfiguration
or data deletion occurs. Both routes still use real replica-set transactions.

`mongo-init` waits for the Mongo ping healthcheck, initializes only a new replica
set, and waits at most 90 seconds for a writable primary. API creation depends on
its successful exit. A malformed/existing multi-member setup fails explicitly.
The `palette-mongo` named volume survives restarts, recreation and `down`.

Optional Compose variables: `BACKEND_ENV_FILE` (runtime file), `MONGO_PORT` and
`API_PORT` (host ports). Bindings stay on loopback. The local database has no
authentication/TLS; keep it on a trusted development host. It is not a staging
database template. A single-member replica set supports transactions, not HA.

The API runs as UID 1000 (`node`), with a read-only filesystem, `/tmp` tmpfs,
dropped capabilities and an init process. `/health` is process liveness; `/ready`
also checks writable-primary availability with a bounded database operation.
SIGTERM stops accepting HTTP requests, finishes active requests, closes MongoDB
and exits; a stuck shutdown is terminated after ten seconds.

## Commit to registry

`.github/workflows/ci.yml` retains PR/master-push/manual triggers. Frontend,
Backend and Backend Docker image run independently. Backend ordinary tests use
doubles; `test:mongo` uses a per-run temporary Compose project and only generated
`palette_test_*` databases. Its Mongo logs and sanitized metrics are kept for seven
days; cleanup runs even when tests fail. This is the only automatic volume deletion,
and it targets only the CI job's unique disposable project.

`backend/compose.ci.yaml` applies only to that disposable database. MongoDB 8.0.34
refuses to start on the current hosted runner kernel (SERVER-121912 / SERVER-131779).
The override gives glibc ownership of rseq with `GLIBC_TUNABLES=glibc.pthread.rseq=1`,
disabling TCMalloc's per-CPU optimization. CI explicitly verifies
`serverStatus().tcmalloc.usingPerCPUCaches === false` before integration tests.
This trades allocator performance for compatibility; tests still use the same
MongoDB version, transactions and persistence behavior. It is not a performance
benchmark or a staging setting. Remove/reassess the override when a fixed MongoDB
patch is pinned. Local Compose and staging delivery are unaffected.

The image job exports `palette-backend:ci` to an artifact. After successful
Frontend, Backend (including Mongo) and image checks, a master **push** publishes
that exact archive. PRs build without publishing. Publication never depends on
Google reporting. Only its job has `packages: write`, using `GITHUB_TOKEN` through
Docker's stdin login; no additional registry secret is required in GitHub.

Image repository: `ghcr.io/dmkgrbzv/react-pick-color-extension-backend`.
Tags contain the full 40-character commit SHA. The pipeline does not overwrite an
existing SHA tag with different contents. Repeated publication verifies the image
configuration, including indexed manifests, then reuses the existing digest.
Registry administrators can still move tags manually; deployments resolve and
store `@sha256:...` references, which identify immutable content.
`backend-publication-*` contains the resulting tag and digest in `image.json`.
No application is rebuilt on the server. Initially the CI publishes Linux amd64;
an ARM server would require an explicitly tested additional platform.

## Manual GitHub setup

1. Allow repository Actions to publish its GHCR package using `GITHUB_TOKEN`.
   After first publication, verify the package is linked to this repository and
   its Actions access permits the repository to read/write. Choose public/private
   package visibility deliberately; the workflow does not change visibility.
2. Add **Backend Docker image** to the required master checks alongside Frontend
   and Backend. Google reporting is not an application-delivery gate.
3. Create GitHub **Environment `staging`**, restrict it to master and add any
   required reviewers. Keep staging configuration/credentials separate from
   production. No remote-server credential is configured by this change.
4. After a successful master publication, open **Actions → Prepare staging delivery
   → Run workflow**, select master and enter the full published commit SHA.

The manual workflow checks the specific CI run's four required job conclusions
(including publication), independently of its overall Google-report outcome.
It resolves the GHCR digest and produces a seven-day portable bundle containing
`release.json`, `release.env`, the Compose file and deployment script. It uses
`packages: read` and `actions: read`; it does not contact a server or claim a deploy.
The environment concurrency group serializes preparation. Keep manual triggering
until the first real staging deployment has been confirmed.

## Server decisions still required

Choose the Linux amd64 host/provider, DNS/HTTPS proxy and firewall topology,
connection mechanism (SSH, provider agent or another approved transport), service
identity and registry pull access. No address or connection credential is invented.
Choose a persistent **separate staging MongoDB** with authentication, TLS and
backups: managed or independently operated containers with named volumes. The
backend-only delivery Compose intentionally does not create/recreate that service.
This keeps database lifecycle and image rollback independent. Do not deploy the
unauthenticated local-development Compose file on a public server.

Host prerequisites for the portable script are Docker Engine, Compose 2.24+ and
Node.js 22.22.3. Provision private-package pull access outside the workflow bundle
with a dedicated read-only credential; do not place it in an image or logs.
Provide HTTPS `PUBLIC_API_URL` and a TLS MongoDB URI. The backend retains the
existing production validation and will reject unencrypted MongoDB connections.
Configure real staging OAuth credentials, callback/origin allowlists and the
verified proxy hop count. A reverse proxy should reach the loopback API binding;
remote proxy/container topology must be agreed before changing that binding.

## Update and rollback

Copy the portable bundle/tooling to the chosen host. Create a runtime environment
file from `backend/deploy/.env.example` outside the checkout (mode 600); create a
private persistent state directory (mode 700). Example paths below are local
filesystem paths, not a server address:

```sh
export STAGING_ENV_FILE=/etc/tintoom/staging/backend.env
export STAGING_STATE_DIR=/var/lib/tintoom/staging
export STAGING_READY_TIMEOUT=90

# Use the actual image value from release.json; replace the placeholder digest:
node backend/deploy/deploy.js 'ghcr.io/dmkgrbzv/react-pick-color-extension-backend@sha256:ACTUAL_DIGEST'

# Restore the recorded previous backend, with the same readiness check:
node backend/deploy/deploy.js --rollback
```

The script acquires an exclusive state-directory lock, pulls before touching the
running release, resolves SHA tags to digests and records the previous image in
`deployment.json`. It updates only `backend` with `--no-build --no-deps`, then
waits for its `/ready` healthcheck. On failure it restores the previous cached
image, verifies readiness and still exits unsuccessfully so delivery is red.
If the first deployment fails, it stops that backend and reports the absence of
a previous release. Rollback failure preserves recovery state for an operator.
An interrupted deployment blocks another update until `--rollback` is used.
After a host/process crash, inspect pending state and active processes before
manually removing a stale `deployment.lock`; never remove a live deployment's lock.

No delivery command deletes volumes, restarts MongoDB, changes data or migrates
indexes. Before a release, review compatibility of data/index changes with the
previous application. Existing startup creates indexes without dropping them;
future destructive migrations need a separate backup/restore and expand/contract
plan. Reverting an image does not undo data already changed by the application.
Do not promise safe rollback across an incompatible migration.

## Verification boundaries

Run `npm test --prefix backend`, `npm run lint`, root `npm test`, build and
`verify:extension`. With an isolated writable replica set, set `MONGODB_TEST_URI`
and run `npm run test:mongo --prefix backend`. Never use production credentials.
Deployment tests use a fake Docker adapter to exercise update, explicit rollback,
failed readiness, failed rollback, first-deploy failure, locking and pull failure.
Real host deployment, registry publication and provider connectivity require
their own successful live runs; a prepared workflow is not evidence of deployment.

Local verification on 2026-11-06: 124 extension tests, 43 backend tests and 11 MongoDB
integration tests passed, alongside lint/architecture, formatting, extension build,
build verification and actionlint for both workflows. An isolated Compose project
initialized a fresh `rs0`, ran the API as UID 1000, exited with code 0 on SIGTERM
and kept a test record after container removal/recreation without volume deletion.
Stopping its MongoDB kept `/health` at 200 and returned `/ready` 503 in about 1.5
seconds; restarting MongoDB restored readiness. MongoDB driver 7.8 ignores
`timeoutMS`, so the readiness probe uses `Db.command` with an abort signal instead.
Registry publication and remote staging deployment were not exercised locally.

An **image** is the packaged backend; a **container** is its running instance.
GHCR is the **registry** storing images. A named **volume** holds MongoDB data
outside replaceable containers. **rs0** is MongoDB's replica set enabling the
transactions used by palette saves. **CD** delivers the checked immutable image
to staging and verifies it, with an application-image rollback on failure.

References: [Compose readiness ordering](https://docs.docker.com/compose/how-tos/startup-order/),
[MongoDB connection options](https://www.mongodb.com/docs/drivers/node/current/connect/connection-options/),
[GitHub image publication](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images),
[MongoDB kernel/cache guard](https://github.com/mongodb/mongo/blob/r8.0.34/src/mongo/db/startup_check_rseq.cpp),
[Ubuntu kernel-version fix](https://jira.mongodb.org/browse/SERVER-131779).
