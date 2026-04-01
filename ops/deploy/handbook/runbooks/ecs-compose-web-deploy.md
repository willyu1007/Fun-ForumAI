# ECS Compose Web Deploy

## Scope

- Current cloud deployment mainline for `T-130`
- Web/API/SSE role only (`RUNTIME_ENABLED=false`)
- Current topology:
  - `staging`: `1 ECS web + 1 ECI worker`
  - `prod`: `1 ECS web + 1 ECI worker`

## Host contract

- App root: `/srv/apps/fun-forum/`
- Shared proxy root: `/srv/infra/caddy/`
- Required files in the app root:
  - `compose.yaml`
  - `.env`
  - `deploy.sh`
  - `rollback.sh`
  - `smoke.sh`
- Release state:
  - `releases/current.json`
  - `releases/history.jsonl`

Canonical repo-side source:

- `ops/deploy/vm-compose/fun-forum/`
- `ops/deploy/release-intents/`

## Operator prerequisites

- Human approval for the target environment
- Docker Engine + Compose plugin on the ECS host
- Runtime application variables written to `/srv/apps/fun-forum/.env`
- Operator shell exports:
  - `ACR_PULL_USERNAME`
  - `ACR_PULL_PASSWORD`
  - `ACR_IMAGE_REPOSITORY=<acr-login-server>/<namespace>/app` when using `--sha`

## Staging rollout

Record or inspect the repo-side desired release first:

```bash
node ops/deploy/scripts/release-intent.mjs show --env staging
# or:
node ops/deploy/scripts/release-intent.mjs set --env staging --sha <40-char-commit> --db-compat backwards --approved-by <operator>
# if replacing a partially applied / attention_required desired release:
node ops/deploy/scripts/release-intent.mjs set --env staging --sha <40-char-commit> --db-compat backwards --approved-by <operator> --force-supersede
```

Staging always runs the migrate step:

```bash
cd /srv/apps/fun-forum
./deploy.sh --sha <40-char-commit> --with-migrate --db-compat backwards
```

If the release is not backward-compatible at the database layer:

```bash
cd /srv/apps/fun-forum
./deploy.sh --sha <40-char-commit> --with-migrate --db-compat incompatible --db-plan <ticket-or-note>
```

## Prod rollout

Current prod is still a single ECS web host, so the rollout remains a single-host operation after human approval:

```bash
node ops/deploy/scripts/release-intent.mjs show --env prod
```

```bash
cd /srv/apps/fun-forum
./deploy.sh --image-ref <acr-login-server>/<namespace>/app:sha-<commit> --db-compat backwards
```

If the prod release includes an incompatible DB step, the recovery plan reference must be recorded:

```bash
cd /srv/apps/fun-forum
./deploy.sh --image-ref <acr-login-server>/<namespace>/app:sha-<commit> --db-compat incompatible --db-plan <ticket-or-note>
```

## Fixed deploy order

1. Validate host files and `.env`
2. `docker login` with the read-only ACR pull identity
3. `docker compose pull web migrate`
4. Optionally `docker compose run --rm migrate`
5. `docker compose up -d --no-deps web`
6. Loopback health check on `http://127.0.0.1:14000/health`
7. `./smoke.sh`
8. Write `releases/current.json` and append to `releases/history.jsonl`
9. Mark repo-side rollout progress:

```bash
IMAGE_REF="$(node ops/deploy/scripts/release-intent.mjs resolve --env <staging|prod>)"
node ops/deploy/scripts/release-intent.mjs mark-target --env <staging|prod> --target ecs_web --status applied --image-ref "$IMAGE_REF"
```

## Rollback

Rollback to the previous recorded image:

```bash
cd /srv/apps/fun-forum
./rollback.sh
```

Rollback to an explicit immutable image:

```bash
cd /srv/apps/fun-forum
./rollback.sh --to-image-ref <acr-login-server>/<namespace>/app:sha-<commit>
```

If the current release recorded `db_compat=incompatible`, image-only rollback is blocked until the separate DB recovery is completed and referenced:

```bash
cd /srv/apps/fun-forum
./rollback.sh --db-plan <ticket-or-note>
```

## Scale-out gate

Before introducing a second ECS web host or ALB:

- Require `SSE_BROADCAST_BACKEND=redis`
- Require `SSE_REDIS_URL`
- Verify SSE-friendly timeout and streaming behavior on both ALB and Caddy
- Change rollout order to: first host with migrate, later hosts without migrate
