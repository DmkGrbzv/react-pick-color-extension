# Palette API

Independent Node.js service in the same repository as the Chrome extension.
Nothing in this directory is imported into the extension or packaged in its ZIP.

## Structure

- `auth/AuthService`: login transaction, one-time exchange and application sessions.
- `auth/OidcProvider`: injected OIDC adapter using `openid-client`; the issuer is
  deployment configuration. Google is the first configured provider. Browser
  accounts are not automatically identity providers.
- `palettes/CloudPaletteService`: snapshot validation, ownership and save rules.
- Repositories: MongoDB persistence, atomic exchange and transactional quotas.
- `http`: request IDs, CORS, shared MongoDB rate limits and sanitized errors.

## Setup

Use Node.js 22.16+ and MongoDB configured as a replica set (MongoDB Atlas is also
suitable). Palette quota and creation use multi-document transactions.

```sh
cd backend
npm ci
cp .env.example .env
```

Fill in actual credentials and allowlists; do not commit `.env`.
`OIDC_ISSUER=https://accounts.google.com` selects Google. Create an OAuth web
application and register exactly `PUBLIC_API_URL/v1/auth/callback` as its redirect.
Set `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` on the server only.

Set `AUTH_REDIRECT_URIS` to the actual result of the installed browser extension's
`identity.getRedirectURL('oauth')`, and `EXTENSION_ORIGINS` to its exact origin.
Register unpacked and release builds separately. These allowlists restrict
integration; session verification determines identity and access.

The chosen session policy is an absolute **24 hours**, with no silent refresh.
The extension persists its bearer credential in trusted local extension storage
to survive browser restarts. Device/extension compromise can expose it; this
storage is not an encrypted vault. Manual logout revokes the server session.

For local MongoDB, start Docker Desktop, then:

```sh
docker compose up -d
docker compose exec mongo mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})'
npm run dev
```

The compose service binds to loopback and has no database authentication; use it
only on a trusted development machine. Do not deploy that configuration.

Outside local development, `PUBLIC_API_URL` must be HTTPS. Use a persistent,
authenticated database with encrypted transport and tested backups. Configure
`TRUST_PROXY_HOPS` only for the verified proxy topology; the default is zero.
One instance assumes a fixed hop count. Do not expose a route that bypasses the
expected proxy when enabling proxy trust.

## API

| Route                               | Purpose                                                              |
| ----------------------------------- | -------------------------------------------------------------------- |
| `POST /v1/auth/start`               | Begin login with exact callback URI, client state and PKCE challenge |
| `GET /v1/auth/callback`             | OIDC callback; consumes the transaction once                         |
| `POST /v1/auth/exchange`            | Redeem the one-time code using the original verifier                 |
| `GET /v1/me`                        | Current account; requires application Bearer session                 |
| `POST /v1/auth/logout`              | Revoke the authenticated session                                     |
| `POST /v1/palettes`                 | Save mixed items; requires `Idempotency-Key`                         |
| `GET /v1/palettes?cursor=…&limit=…` | Own library, newest first, up to 50 per page                         |
| `GET /v1/palettes/:id`              | Own complete snapshot                                                |
| `PATCH /v1/palettes/:id`            | Rename own set; accepts only `name`                                  |
| `DELETE /v1/palettes/:id`           | Delete own set; repeated deletion returns 204                        |

Snapshot JSON:

```json
{
  "name": "My set",
  "items": [
    { "type": "color", "hex": "#AABBCC" },
    {
      "type": "gradient",
      "gradientType": "linear",
      "direction": "right",
      "stops": [
        { "hex": "#112233", "position": 0 },
        { "hex": "#FFFFFF", "position": 100 }
      ]
    }
  ]
}
```

Item contents are immutable. Renaming changes metadata only. To edit contents,
open the snapshot locally and save a new set. Local IDs, CSS, derived RGB/CMYK,
theme and other preferences are not sent.

Defaults: 256 items/request, 100 sets/user, 32 KiB body, 20 auth/write requests per
minute per applicable IP/user, 120 authenticated API requests/minute. Quotas are
transactional and rate-limit counters are shared in MongoDB. Do not promise
unlimited storage. Save keys are retained for the lifetime of the stored snapshot.
The same user/key with different normalized original payload returns 409; retries
return the existing set. Transient network failures must retain the same key and
snapshot. The client uses explicit retries rather than background synchronization.

Deletion removes the set from reads and releases its quota in one transaction.
The server retains an ID/owner/key/hash receipt, without the name or item contents,
so delayed save retries cannot recreate a deleted set (`410 snapshotDeleted`).
The extension asks for confirmation and preserves the working colors.

## Validation and deployment

If Google rejects the client credentials (`invalid_client`), copy the Client ID
directly from the selected OAuth web client and create/copy a new Client Secret.
Do not transcribe either value from screenshots. Update `backend/.env` and restart
the Node process: watch mode does not guarantee reloading environment-file changes.
The trusted callback returns only `authConfiguration` or `invalidIdentity` to the
extension; provider details and credentials are not placed in the redirect.
Browser window failures are reported separately from explicit cancellation.

```sh
npm test
# Use a disposable replica set. The test creates and drops its own random database.
# Set MONGODB_TEST_URI in your environment or local .env first.
npm run test:mongo
```

Unit/HTTP tests use controlled repository/provider doubles. The OIDC tests use
real RSA signatures and mocked provider HTTP responses to check signature,
issuer, audience, nonce, expiry and state validation. The separate MongoDB suite
checks actual indexes, transactions, concurrent quota and pagination.

Deploy this directory as its own service: build `npm ci --omit=dev`, start
`node src/server.js`, health endpoint `/health`. With Docker, build from `backend/`
and inject secrets at runtime. `npm start` is for local use with a `.env` file.
No live deployment, Google credentials or cloud database are supplied by this repo.
Real Google/Chrome login, backup restore and deployment still require acceptance
checks against the configured services. Firefox/Opera packaging is not implemented.

Validation on 2026-10-14: 79 extension tests and 20 backend tests passed, along
with root lint/format checks and local/cloud extension builds. The backend npm
audit reported zero vulnerabilities. Generated `dist/` and the extension ZIP
were checked for backend/environment files. The MongoDB integration test was
attempted but could not connect to `127.0.0.1:27017` (`ECONNREFUSED`); its database
guarantees are not yet verified against a running replica set. No live OAuth
credentials or production deployment were used.

References: [openid-client](https://github.com/panva/openid-client),
[MongoDB transactions](https://www.mongodb.com/docs/manual/core/transactions/),
[Chrome identity](https://developer.chrome.com/docs/extensions/reference/api/identity).
