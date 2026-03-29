# fun-forum ECS Compose Host Files

Canonical host layout for the current cloud deployment mainline:

- Host app root: `/srv/apps/fun-forum/`
- Shared reverse proxy: `/srv/infra/caddy/`
- Current release state:
  - `releases/current.json`
  - `releases/history.jsonl`

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
- Future multi-ECS rollout requires Redis-backed SSE fanout and verified ALB/Caddy streaming timeouts before a second host is introduced.
