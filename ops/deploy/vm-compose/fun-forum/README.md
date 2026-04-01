# fun-forum ECS Compose Host Files

Canonical host layout for the current cloud deployment mainline:

- Host app root: `/srv/apps/fun-forum/`
- Shared reverse proxy: `/srv/infra/caddy/`
- Current release state:
  - `releases/current.json`
  - `releases/history.jsonl`
- Repo-side desired release intent:
  - `ops/deploy/release-intents/<env>/desired.json`
  - `ops/deploy/release-intents/<env>/history.jsonl`

Files in this directory are the repo-side source of truth for the host copies:

- `compose.yaml`
- `deploy.sh`
- `rollback.sh`
- `smoke.sh`

## Host prerequisites

- Docker Engine with the Compose plugin
- `curl`
- Read-only ACR pull credentials exported in the operator shell:
  - `ACR_PULL_USERNAME`
  - `ACR_PULL_PASSWORD`
- `ACR_IMAGE_REPOSITORY=<acr-login-server>/<namespace>/app` when using `--sha`
- Runtime application env written to `/srv/apps/fun-forum/.env`

## Deployment examples

Before deploying later than the image publish event, resolve the desired release from the repo:

```bash
node ops/deploy/scripts/release-intent.mjs show --env staging
# or replace the current desired release after an interrupted rollout:
node ops/deploy/scripts/release-intent.mjs set --env staging --sha <40-char-commit> --db-compat backwards --approved-by <operator> --force-supersede
```

Staging requires the migrate step:

```bash
cd /srv/apps/fun-forum
./deploy.sh --sha <40-char-commit> --with-migrate --db-compat backwards
```

Prod currently uses the same single-host flow, still executed by a human:

```bash
cd /srv/apps/fun-forum
./deploy.sh --image-ref <acr-login-server>/<namespace>/app:sha-<commit> --db-compat backwards
```

If the release is not backward-compatible at the database layer:

```bash
cd /srv/apps/fun-forum
./deploy.sh --sha <40-char-commit> --with-migrate --db-compat incompatible --db-plan <ticket-or-note>
```

## Rollback examples

Rollback to the previous recorded image:

```bash
cd /srv/apps/fun-forum
./rollback.sh
```

Rollback to a specific immutable image:

```bash
cd /srv/apps/fun-forum
./rollback.sh --to-image-ref <acr-login-server>/<namespace>/app:sha-<commit>
```

If the current release recorded `db_compat=incompatible`, complete the separate DB recovery first and then provide the recovery reference:

```bash
cd /srv/apps/fun-forum
./rollback.sh --db-plan <ticket-or-note>
```

## Notes

- Mutable delivery aliases (`main`, `staging`, `prod`, `latest`) are rejected on purpose.
- `deploy.sh` never auto-rolls back on a smoke failure.
- The repo-side desired release does not replace host-side `releases/current.json`; it only answers which immutable image ref should be applied next.
- `mark-target --status applied` must include `--image-ref "$(node ops/deploy/scripts/release-intent.mjs resolve --env <env>)"` so repo-side progress cannot drift away from the approved immutable image.
- Future multi-ECS rollout requires Redis-backed SSE fanout and verified ALB/Caddy streaming timeouts before a second host is introduced.
