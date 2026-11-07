# Palette API

Independent Node.js service in the same repository as the Chrome extension.
Nothing in this directory is imported into the extension or packaged in its ZIP.

## Structure

- `src/auth/`: login transactions, one-time exchange and application sessions.
- `src/palettes/`: snapshot validation, save rules and public palette/cursor mapping.
- `src/contracts/`: operation-specific repository, identity-provider and rate-limiter
  JSDoc contracts, including results, absence, errors and concurrency guarantees.
- `src/errors/`: transport-independent application errors.
- `src/infrastructure/mongodb/`: repositories, transactions, indexes, rate limiter,
  connection settings and connection lifecycle. Only these modules know MongoDB.
- `src/infrastructure/oidc/`: injected adapter using `openid-client`. The issuer
  selects Google through configuration; browser accounts are not identity providers.
- `src/http/`: request IDs, CORS, authentication middleware and centralized error
  mapping. `src/app.js` defines the existing HTTP routes.
- `src/server.js`: composition root; selects storage and identity provider, injects
  repositories into services and the limiter into HTTP, and closes storage on exit.

Dependencies (arrows mean imports or injected contracts):

```text
server.js --> Mongo connection + OIDC factory
          --> AuthService / SavedPaletteService --> contracts + ApplicationError
          --> app.js / HTTP middleware          --> services + limiter contract
Mongo adapters / OIDC adapter                  --> contracts + ApplicationError
HTTP error mapping                            --> ApplicationError
```

Services never import concrete adapters, driver types, Express or HTTP errors.
Repository results are detached entities with `id`, never MongoDB documents or
driver result objects. Creation returns `{ palette, created }`; listing returns
`{ palettes, continuation }`. Only services build public palette responses and
encode/decode the external cursor. The cursor remains base64url JSON
`{ date: ISO-string, id }`, with UTC millisecond precision and descending
`createdAt, id` ordering. IDs use canonical lowercase UUIDs and binary ASCII
comparison (MongoDB simple collation). Pagination is exclusive after the cursor;
it is not a snapshot across separate requests.

Application errors carry stable codes without HTTP statuses. HTTP maps them in
`http/applicationErrors.js`, including the existing 400/401 distinction for
malformed versus unusable login credentials. Unexpected infrastructure errors
remain sanitized as `500 serverError`.

## Setup

Use Node.js 22.16+ and MongoDB 4.4+ configured as a replica set (MongoDB Atlas is also
suitable). The local Compose setup uses MongoDB 8.0. Palette quota and creation use
multi-document transactions.

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
docker compose run --rm mongo-init
npm run dev
```

The compose service binds to loopback and has no database authentication; use it
only on a trusted development machine. Do not deploy that configuration.

For the full local stack, run `docker compose --profile api up -d --build --wait`.
The API uses `.env` at runtime and connects to `mongo:27017`; host development uses
`mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true`. The initializer
waits for a writable primary and preserves existing `rs0` configuration/data.
`docker compose down` preserves the named database volume. Never add `--volumes`
when stopping an environment whose data you want to keep.

`GET /health` keeps its existing process-liveness response. `GET /ready` returns
200 only while the API is serving and MongoDB is a writable primary, otherwise
503 with no dependency details. The image probes `/ready`, runs as `node`, and
handles SIGTERM by draining HTTP before closing storage (10-second upper limit).
See [Docker and staging delivery](../docs/backend-delivery.md) for complete commands,
CI image publication, environment setup, update/rollback and remaining decisions.

Outside local development, `PUBLIC_API_URL` must be HTTPS. Use a persistent,
authenticated database with encrypted transport and tested backups. Configure
`TRUST_PROXY_HOPS` only for the verified proxy topology; the default is zero.
One instance assumes a fixed hop count. Do not expose a route that bypasses the
expected proxy when enabling proxy trust.

## Atlas staging connection check

`scripts/checkAtlasConnection.js` is a standalone connection probe using the installed
MongoDB driver and shared Mongo configuration parser. It does not import the server
or storage initializer, create indexes, read/write collections or run tests. It
authenticates, sends only `ping` to `palette_staging`, and closes the client in
`finally`. Errors omit driver messages, URIs and credentials; driver logging is off.

Keep the separate local file `backend/.env.staging.local` (already excluded by Git's
`.env.*` rule and the backend Docker context's `.env.*` rule):

```dotenv
NODE_ENV=staging
MONGODB_URI="mongodb+srv://palette_staging_app:<PASSWORD>@palette-staging.kyvrc93.mongodb.net/palette_staging?authSource=admin"
MONGODB_DATABASE=palette_staging
```

Replace only `<PASSWORD>` in that file with the database user's password. URI-encode
password special characters; do not put the real password in terminal commands.
Allow your current public IP in the Atlas project's Network Access list.

In the VS Code PowerShell terminal, from the repository root:

```powershell
npm.cmd --prefix backend run check:atlas:staging
```

Or, if the terminal is already in `backend`:

```powershell
npm.cmd run check:atlas:staging
```

The command explicitly loads `.env.staging.local`; local `.env`, Docker Compose
and `npm run dev` keep their existing behavior. Node gives existing terminal
environment variables priority over env-file values. Use a fresh terminal without
`MONGODB_URI`/`MONGODB_DATABASE` overrides; the probe refuses a different host, user
or database instead of connecting to another environment.

Failures include fixed categories such as `[DNS]`, `[AUTH]`, `[TLS]`, `[NETWORK]`
and `[TIMEOUT]`, including nested driver errors, without printing their raw text.
A network/timeout result does not prove that the Atlas IP access list is the cause.
If Windows resolves the cluster but Node reports `[DNS]`, this probe supports an
optional process-local resolver override in `.env.staging.local`:

```dotenv
ATLAS_DNS_SERVERS=1.1.1.1,8.8.8.8
```

Use only DNS servers reachable and permitted on your network. This does not change
Windows DNS settings, the API's resolver, local Docker configuration or CI.

Verification on 2026-11-07: the Windows resolver returned Atlas records, but Node's
default resolver refused SRV/TXT queries. Using the process-local override above,
the real staging connection authenticated, `ping` succeeded on `palette_staging`,
and the client closed. No collection/index changes or write-permission tests ran.

The application uses `MONGODB_DATABASE` explicitly in `client.db(config.database)`,
so keep it set to `palette_staging` even though the URI also names that database.
`authSource=admin` selects credential authentication, not the application database.
The intended role is `readWrite` on `palette_staging`. A successful ping confirms
connectivity/authentication, not write permissions; this probe never tests writes.
Do not point `test:mongo` at this Atlas instance: those tests create/drop their own
temporary databases, beyond this user's single-database role.

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

`tests/contracts/` contains reusable auth/palette suites accepting a fixture
factory. `repositoryContracts.test.js` runs them against independent memory
repositories; `mongo.integration.js` runs the same assertions against a real
replica set. Fixtures supply repositories, seeded owners, cleanup and quota
inspection/fault setup; these fixture helpers are not production interfaces.
The suites cover neutral detached results, ownership, idempotency/conflicts,
parallel quotas, single-use auth codes, expiry, deletion rollback and pagination
with equal timestamps. Mongo-specific checks cover legacy ObjectId auth records,
UUID palette records, tombstones and the shared rate limiter. Every Mongo test
creates/drops only its generated `palette_test_*` database. Use a test account
with permission to create and drop those databases.

From the repository root, `npm run lint` checks imports in both `src/` and
`backend/src/`, including cycles and forbidden application/HTTP/infrastructure
dependencies. `tests/architecture.test.js` demonstrates rejected violations.

## Adding another database adapter

PostgreSQL is not implemented or required to run this version. To add it later:

1. Implement the contracts under a new `src/infrastructure/postgresql/` adapter;
   return the same neutral entities, null/boolean outcomes and application codes.
2. Add migrations for users, sessions, transactions, exchanges, palettes,
   idempotency receipts and shared rate limits. Preserve provider/subject and
   owner/key uniqueness, current records and expiry checks independent of cleanup.
3. Keep creation/quota and deletion/quota in database transactions. Serialize
   competing writes per owner; use atomic conditional consumption for auth codes.
   Deleting content must preserve its receipt and original payload hash.
4. Preserve UUID IDs, UTC millisecond timestamps and binary ID comparison. Use
   explicit ordering/comparison rules, rather than database-default collation or
   greater timestamp precision, so existing external cursors remain compatible.
5. Add connection configuration/lifecycle and an implementation of the limiter
   contract in that infrastructure directory. Change adapter selection only in
   `server.js`; do not add database switches inside services or HTTP middleware.
6. Run the existing contract suites through a PostgreSQL fixture factory against
   a real test database, then HTTP/OIDC, frontend, lint, format and build checks.
   Data migration and deployment/backup acceptance remain separate work.

Deploy this directory as its own service: build `npm ci --omit=dev`, start
`node src/server.js`, health endpoint `/health`. With Docker, build from `backend/`
and inject secrets at runtime. Readiness endpoint: `/ready`. `npm start` is for local use with a `.env` file.
No live deployment, Google credentials or database instance are supplied by this repo.
Real Google/Chrome login, backup restore and deployment still require acceptance
checks against the configured services. Firefox/Opera packaging is not implemented.

Local verification on 2026-11-04: the shared repository contracts passed on a
real MongoDB replica set, including concurrency and deletion rollback. Legacy
record compatibility and the Mongo rate limiter also passed. No live Google
login or production deployment was performed for this structural change.

References: [openid-client](https://github.com/panva/openid-client),
[MongoDB transactions](https://www.mongodb.com/docs/manual/core/transactions/),
[Chrome identity](https://developer.chrome.com/docs/extensions/reference/api/identity).
