# ECS Web + ECI Worker Rollout

## Scope

- Launch gray-release rollout order for `staging` and `prod`
- Repo-tracked assets only
- ECS web remains the host-facing role
- ECI worker remains the runtime/background role

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
4. Run database migration against the target image ref.
5. Roll ECS web to the same immutable image ref with `RUNTIME_ENABLED=false`.
6. Verify ECS web loopback health and smoke checks.
7. Mark `ecs_web` as applied in the desired release record.
8. Render/verify the ECI worker contract with `env_cloudctl.py plan/apply --runtime-target ecs --workload worker`.
9. Replace the ECI worker container group with the same immutable image ref and `RUNTIME_ENABLED=true`.
10. Verify worker `/health`, queue backend, leader backend, and the admitted provider secret surface.
11. Mark `eci_worker` as applied in the desired release record; when both targets are applied, the desired release becomes fulfilled.

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
# then replace the ECI worker container group using:
# ops/deploy/workloads/eci-worker/staging.container-group.yaml
# after:
# python3 -B -S .ai/skills/features/environment/env-cloudctl/scripts/env_cloudctl.py plan --root . --env staging --runtime-target ecs --workload worker
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
# then replace the ECI worker container group using:
# ops/deploy/workloads/eci-worker/prod.container-group.yaml
# after:
# python3 -B -S .ai/skills/features/environment/env-cloudctl/scripts/env_cloudctl.py plan --root . --env prod --runtime-target ecs --workload worker
node ops/deploy/scripts/release-intent.mjs mark-target --env prod --target eci_worker --status applied --image-ref "$IMAGE_REF"
```

## Backout

- Web backout: `ops/deploy/handbook/runbooks/ecs-compose-web-deploy.md`
- Worker backout:
  - replace the current container group with the previous immutable image ref
  - do not back out the worker alone if the current DB migration is not backward-compatible

## Verification

- Web:
  - `http://127.0.0.1:14000/health` returns healthy
  - `./smoke.sh` passes
  - `/frontend-build-flags.json` exposes the launch build proof for the deployed image
  - browser smoke for `/` shows Home Programming markers such as `今日必看`
- Worker:
  - `/health` reports `runtime.enabled=true`
  - runtime queue backend matches contract
  - leader backend matches contract
  - rendered worker manifest includes admitted provider primary + secondary secret refs

## Launch gray-release close-out

1. Run `pnpm launch:warm-start` against the target environment after the worker is healthy.
2. Run `pnpm verify:launch:staging -- --web-base-url <web-base-url> --worker-base-url <worker-base-url> --admin-token <admin-token>`.
3. Do not open half-open traffic until both commands pass.
