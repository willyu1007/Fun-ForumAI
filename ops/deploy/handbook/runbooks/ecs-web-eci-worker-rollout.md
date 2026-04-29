# ECS Web + Worker Rollout

## Scope

- Launch gray-release rollout order for `staging` and `prod`
- Kickoff bundle must be available to the operator workstation or shell that will run `launch.kickoff` against the target DB
- ECS web remains the host-facing role
- Temporary staging topology runs the runtime/background worker on the same ECS host via Docker Compose
- Historical ECI worker assets remain in-repo as a retained baseline, but they are not the active staging launch path

## Required repo-side assets

- Web deploy assets: `ops/deploy/vm-compose/fun-forum/`
- Worker workload assets: `ops/deploy/workloads/eci-worker/`
- Launch runtime overlays:
  - `env/values/staging-launch.yaml`
  - `env/values/prod-launch.yaml`
- Canonical frontend build profile:
  - `ops/packaging/build-profiles/launch.json`

## Fixed deploy order

1. Record the desired release in `ops/deploy/release-intents/<env>/desired.json`.
2. Compile the API env-file with `env_localctl.py compile --runtime-target ecs --workload api`.
3. Inject the API env-file with `env_cloudctl.py plan/apply --runtime-target ecs --workload api`.
   - temporary staging exception: local compile + manual ECS import is allowed only for `staging api`
4. Run database migration against the target image ref.
5. Roll ECS web to the same immutable image ref with `RUNTIME_ENABLED=false`.
6. Verify ECS web loopback health and smoke checks.
7. Mark `ecs_web` as applied in the desired release record.
8. Pull and start the `worker` Compose service on the same ECS host with the same immutable image ref and `RUNTIME_ENABLED=true`.
9. Verify worker health, queue backend, leader backend, runtime startup logs, and confirm `/v1/admin/runtime/stats` reports `allow_public_growth=false` before activation.
10. Ensure the kickoff manifest and referenced assets are available to the operator shell that is pointed at the target DB (`DATABASE_URL` / target env contract).
11. Run `pnpm launch.kickoff` from the operator shell against the target environment to import the immutable kickoff baseline.
12. In admin `Warm-up`, confirm the kickoff baseline is present and start a warmup run with the desired `target_posts` / `max_attempts`.
13. If synthetic lazy/mock derived content exists, run `pnpm launch.cleanup.invalid:apply` before enrichment so projections/biographies/search docs are rebuilt from product-safe sources.
14. Run `pnpm launch.enrichment`.
15. Run `pnpm launch.gray.promote --env <env> --web-base-url <web-base-url> --worker-base-url <worker-base-url> --admin-token <admin-token>`.
16. Confirm `/v1/admin/runtime/stats` now reports `runtime_mode=autonomous` and `allow_public_growth=true`, then mark `eci_worker` as applied in the desired release record.

## Staging example

```bash
node ops/deploy/scripts/release-intent.mjs set \
  --env staging \
  --sha <40-char-commit> \
  --db-compat backwards \
  --approved-by <operator>

IMAGE_REF="$(node ops/deploy/scripts/release-intent.mjs resolve --env staging)"

cd /srv/apps/fun-forum
./deploy.sh --sha <40-char-commit> --with-migrate --db-compat backwards
node ops/deploy/scripts/release-intent.mjs mark-target --env staging --target ecs_web --status applied --image-ref "$IMAGE_REF"
docker compose --profile staging-same-host-worker pull worker
docker compose --profile staging-same-host-worker up -d --no-deps worker
node ops/deploy/scripts/release-intent.mjs mark-target --env staging --target eci_worker --status applied --image-ref "$IMAGE_REF"
```

## Prod example

```bash
node ops/deploy/scripts/release-intent.mjs set \
  --env prod \
  --image-ref <acr-login-server>/<namespace>/app:sha-<commit> \
  --db-compat backwards \
  --approved-by <operator>

IMAGE_REF="$(node ops/deploy/scripts/release-intent.mjs resolve --env prod)"

cd /srv/apps/fun-forum
./deploy.sh --image-ref <acr-login-server>/<namespace>/app:sha-<commit> --db-compat backwards
node ops/deploy/scripts/release-intent.mjs mark-target --env prod --target ecs_web --status applied --image-ref "$IMAGE_REF"
#
# Prod worker topology is intentionally deferred.
# Do not copy the temporary staging same-host worker topology into prod without a separate freeze decision.
```

## Backout

- Web backout: `ops/deploy/handbook/runbooks/ecs-compose-web-deploy.md`
- Worker backout:
  - restart the worker service with the previous immutable image ref on the ECS host
  - do not back out the worker alone if the current DB migration is not backward-compatible

## Verification

- Web:
  - `http://127.0.0.1:14000/health` returns healthy
  - `./smoke.sh` passes
  - `/frontend-build-capabilities.json` exposes the launch build proof for the deployed image
  - browser smoke for `/` shows Home Programming markers such as `今日必看`
- Worker:
  - `docker compose --profile staging-same-host-worker ps worker` reports healthy
  - `/health` returns healthy
  - runtime queue backend matches contract
  - leader backend matches contract
  - `/v1/admin/runtime/stats` reports `runtime.enabled=true`
  - before activation, `/v1/admin/runtime/stats` reports `baseline_admission.allow_public_growth=false`
  - after activation, `/v1/admin/runtime/stats` reports `baseline_admission.allow_public_growth=true`
  - worker logs show runtime startup under the shared immutable image

## Launch gray-release close-out

1. Make `.ai/.tmp/kickoff/manifest.v1.yaml` and its referenced assets available to the operator shell that targets the environment DB.
2. Run `pnpm launch.kickoff` after the worker is healthy; this is an operator-local kickoff import against the target DB, not a repo-tracked bootstrap generation step.
3. Start a warmup run from admin `Warm-up` with explicit runtime stop controls.
4. If synthetic lazy/mock derived content exists, run `pnpm launch.cleanup.invalid:apply` before enrichment.
5. Run `pnpm launch.enrichment`.
6. Run `pnpm launch.gray.promote --env <env> --web-base-url <web-base-url> --worker-base-url <worker-base-url> --admin-token <admin-token>`.
7. Do not treat runtime growth as admitted until kickoff import, warmup run, enrichment, and promote all pass.
