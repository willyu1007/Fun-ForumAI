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

1. Run database migration against the target image ref.
2. Roll ECS web to the same immutable image ref with `RUNTIME_ENABLED=false`.
3. Verify ECS web loopback health and smoke checks.
4. Replace the ECI worker container group with the same immutable image ref and `RUNTIME_ENABLED=true`.
5. Verify worker `/health`, queue backend, and leader backend.

## Staging example

```bash
cd /srv/apps/fun-forum
./deploy.sh --sha <40-char-commit> --with-migrate --db-compat backwards
# then replace the ECI worker container group using:
# ops/deploy/workloads/eci-worker/staging.container-group.yaml
```

## Prod example

```bash
cd /srv/apps/fun-forum
./deploy.sh --image-ref <acr-login-server>/<namespace>/app:sha-<commit> --db-compat backwards
# then replace the ECI worker container group using:
# ops/deploy/workloads/eci-worker/prod.container-group.yaml
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

## Launch gray-release close-out

1. Run `pnpm launch:warm-start` against the target environment after the worker is healthy.
2. Run `pnpm verify:launch:staging -- --web-base-url <web-base-url> --worker-base-url <worker-base-url> --admin-token <admin-token>`.
3. Do not open half-open traffic until both commands pass.
