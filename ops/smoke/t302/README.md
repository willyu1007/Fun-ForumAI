# T-302 Admin/Community Media Import Smoke Harness

A self-contained smoke harness that boots the real backend Express app
in-process with in-memory repos, seeds a single test community, and
exercises every T-302 admin media import endpoint over real HTTP.

## What it covers

- `/health` readiness probe (after `markStartupComplete`).
- Auth gates: unauthenticated → 401, non-admin → 403.
- Platform canonical upload: default (no `quote_original`) and explicit
  `allow_quote_original=true` (includes `quote_original`).
- Platform canonical URL import rejections: `http://` scheme + private
  network (`127.0.0.1`) host.
- Platform pool asset list: DB-backed entries returned with the
  expected pool scene id.
- Community commons upload: registers into
  `community_commons:<communityId>` with the correct default policy.
- Community asset list: scoped to `community.id`.
- Missing community commons list: returns 404 instead of reading an
  orphan `community_commons:<missingId>` pool.
- Multipart upload rejection when `file` is missing.

12 assertions in total. Output is `[ok]` / `[fail]` per line plus a
final `[summary] N/M assertions passed` line.

## Why no Postgres/Redis

T-302 deliberately uses no schema or migration changes; the in-memory
repository surface is the same one the integration tests run against.
Standing up Postgres + the multi-stage runtime image would not increase
fidelity — the smoke goal is verifying the route, validation,
orchestration, and reuse-policy paths over real HTTP, all of which
behave identically against the in-memory repos.

If a Postgres-backed run is needed (e.g., to confirm SQL-shaped errors
do not surface), use the existing infrastructure under
`ops/deploy/vm-compose/fun-forum/` against a built image; the harness
in this directory targets the lighter local-loop scenario.

## Running

From the repo root, with the parent project's `node_modules` already
installed:

```bash
NODE_ENV=development APP_ENV=dev PORT=4103 \
JWT_SECRET=smoke-jwt-secret-not-for-prod \
SERVICE_AUTH_SECRET=smoke-service-secret-not-for-prod \
LOG_LEVEL=silent \
pnpm exec tsx ops/smoke/t302/run-smoke.ts
```

Pick any unused port; the harness binds locally and shuts the server
down on completion. Exit codes:

- `0` — all assertions passed.
- `1` — one or more assertions failed (per-line `[fail]` plus tail
  summary).
- `2` — harness crashed before completing.

## Environment

Required env (defaults applied if missing):

| Var | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | Enables dev token auth path. |
| `APP_ENV` | `dev` | Allows `allowDevTools=true`. |
| `PORT` | `4101` | Local listener port. |
| `JWT_SECRET` | `smoke-jwt-secret-not-for-prod` | Required by config bootstrap. |
| `SERVICE_AUTH_SECRET` | `smoke-service-secret-not-for-prod` | Required by config bootstrap. |
| `MEDIA_LOCAL_DIR` | auto temp dir | Where uploaded bytes land. |
| `LOG_LEVEL` | `silent` | Suppresses verbose request logs. |

The harness does not touch any real database or external service.
