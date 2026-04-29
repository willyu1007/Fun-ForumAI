# Deployment Mainline

## Scope

Canonical operator playbook for the current cloud delivery mainline:

- image publishing: GitHub Actions -> ACR
- env rendering: Bitwarden -> `env-localctl compile`
- web deploy target: ECS host running `Docker Compose`
- worker deploy target:
  - `staging`: temporary same-host Docker Compose worker on the ECS host
  - `prod`: deferred for a follow-up topology decision
- release contract: immutable `sha-<commit>` image refs only
- routing authority: registry/policy driven, not env-level model pins

Use this document as the end-to-end sequence. Keep the specialized runbooks for host-only rollback or retained historical worker-topology references as supporting references.

Environment readiness and public-entry prerequisites live in:

- `ops/deploy/handbook/runbooks/cloud-go-live-chain.md`

## Current topology

- `staging`
  - `1 ECS host`
  - `web` and `worker` run via Docker Compose on the same host as a temporary launch-closure topology
- `prod`
  - `1 ECS web`
  - worker topology deferred; do not inherit the temporary staging same-host worker automatically

Canonical repo-side assets:

- publish workflow: `.github/workflows/publish-image.yml`
- env contract: `env/contract.yaml`
- staging values: `env/values/staging.yaml`
- prod values: `env/values/prod.yaml`
- ECS host files: `ops/deploy/vm-compose/fun-forum`
- ECI worker template: `ops/deploy/workloads/eci-worker` (retained historical baseline; not the active staging launch path)
- desired release records: `ops/deploy/release-intents`
- cloud readiness chain: `ops/deploy/handbook/runbooks/cloud-go-live-chain.md`

## Inputs

Required operator inputs:

- target environment: `staging` or `prod`
- immutable image ref:
  - `talkshow-ai-acr-registry.cn-hangzhou.cr.aliyuncs.com/talkshow-ai/app:sha-<40-char-commit>`
- Bitwarden token that can read the target project secrets
- STS-backed operator session when using the formal deploy workspace path
- ECS shell access
- ACR pull credential for the ECS host

Required ECS host paths:

- app root: `/srv/apps/fun-forum`
- target env file: `/srv/apps/fun-forum/.env`

## Phase 1: Publish image

Push `main` to trigger candidate publish:

```bash
git push origin main
```

Or inspect the latest published candidate:

```bash
gh run list --workflow "Publish Image" --limit 5
gh run view <run-id>
```

Expected publish result:

- workflow conclusion: `success`
- created image ref uses immutable `sha-<commit>`
- step summary includes final digest

Notes:

- Current publish mainline is GitHub-hosted.
- ACR public access is enabled for publish; do not switch back to the VPC-only API endpoint without a separate runner/network plan.

## Phase 2: Render environment from Bitwarden

Formal path on the operator deploy workspace:

```powershell
cd <repo-root>
$env:BWS_ACCESS_TOKEN = "<token>"

python -B -S .ai/skills/features/environment/env-localctl/scripts/env_localctl.py compile `
  --root . `
  --env staging `
  --runtime-target ecs `
  --workload api `
  --env-file ops/deploy/env-files/staging.env `
  --no-context
```

Repeat with `--env prod` for prod.

Temporary staging bootstrap exception:

- If the formal deploy workspace is not ready yet, operator MAY run the same compile on a local machine that has `bws` access.
- In that temporary path, `--no-preflight` is allowed only for `staging api`.
- After compile, operator MAY manually install the resulting `.env` onto the ECS host.
- This exception MUST NOT be used for `prod` or `worker`.

Compile expectations:

- Always pass `--runtime-target ecs --workload api` for web/API env-file generation.
- The compiled staging/prod env file must not contain `LLM_PROVIDER`, `LLM_MODEL`, or `LLM_BASE_URL`.
- If the compile step runs off-host, transfer the rendered env file to the deploy machine while preserving the same relative artifact path or update `env_file_source` through policy before apply.

Key cloud baseline requirements already encoded in repo values:

- `MEDIA_STORAGE_BACKEND=s3`
- `RUNTIME_QUEUE_BACKEND=redis`
- `RUNTIME_LEADER_BACKEND=redis`
- `SSE_BROADCAST_BACKEND=redis`
- `RUNTIME_ENABLED` is intentionally not owned by shared staging/prod env values

Environment-specific non-secret values:

- `staging`: `MEDIA_S3_BUCKET=bucket-forum-stag`
- `prod`: `MEDIA_S3_BUCKET=bucket-forum-prod`
- staging/prod OSS S3-compatible endpoint: `MEDIA_S3_REGION=cn-hangzhou` and `MEDIA_S3_ENDPOINT=https://s3.oss-cn-hangzhou.aliyuncs.com`

Operational notes:

- Redis URLs for Aliyun Tair must use the correct account form when ACL-style accounts are enabled:
  - `redis://<username>:<password>@<host>:6379/0`
- `MEDIA_S3_BUCKET` is a non-secret value and belongs in env values, not Bitwarden.

## Phase 3: Inject `.env` onto ECS

Canonical injection path:

```bash
python3 -B -S .ai/skills/features/environment/env-cloudctl/scripts/env_cloudctl.py plan \
  --root . \
  --env staging \
  --runtime-target ecs \
  --workload api

python3 -B -S .ai/skills/features/environment/env-cloudctl/scripts/env_cloudctl.py apply \
  --root . \
  --env staging \
  --runtime-target ecs \
  --workload api \
  --approve
```

Repeat with `--env prod` for prod.

Notes:

- `policy.env.cloud.require_target=true` means omitting `--runtime-target ecs --workload api` is now a contract error.
- Current `api` target uses `provider=envfile` with local transport, so apply should run from the deploy machine or equivalent release workspace that owns `/srv/apps/fun-forum/.env`.
- Manual `cp/install` remains a break-glass recovery step only, except for the temporary `staging api` bootstrap path described above.

Minimal presence check without revealing values:

```bash
grep -nE '^(APP_ENV|DATABASE_URL|JWT_SECRET|SERVICE_AUTH_SECRET|MEDIA_S3_BUCKET|RUNTIME_REDIS_URL|SSE_REDIS_URL)=' /srv/apps/fun-forum/.env | sed 's/=.*/=<redacted>/'
```

Auth delivery readiness check before the first staging/prod auth rollout:

```bash
node scripts/auth-delivery-smoke.mjs --mode smtp --env-file ops/deploy/env-files/staging.env --smtp-verify-only
node scripts/auth-delivery-smoke.mjs --mode sms --env-file ops/deploy/env-files/staging.env --dry-run
```

Required auth-delivery variables for cloud rollout:

- SMTP: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`
- SMS: `ALIYUN_SMS_ACCESS_KEY_ID`, `ALIYUN_SMS_ACCESS_KEY_SECRET`, `ALIYUN_SMS_SIGN_NAME`, `ALIYUN_SMS_TEMPLATE_CODE`

## Phase 4: Record desired release

Before replacing ECS or ECI, record the approved immutable image:

```bash
node ops/deploy/scripts/release-intent.mjs set \
  --env staging \
  --sha <40-char-commit> \
  --db-compat backwards \
  --approved-by <operator>
```

If replacing a partially applied desired release:

```bash
node ops/deploy/scripts/release-intent.mjs set \
  --env staging \
  --sha <40-char-commit> \
  --db-compat backwards \
  --approved-by <operator> \
  --force-supersede
```

## Phase 5: Deploy ECS web

On the ECS host:

```bash
cd /srv/apps/fun-forum
export IMAGE_REF='talkshow-ai-acr-registry.cn-hangzhou.cr.aliyuncs.com/talkshow-ai/app:sha-<40-char-commit>'
export ACR_PULL_USERNAME='<acr-user>'
export ACR_PULL_PASSWORD='<acr-password>'

sudo -E ./deploy.sh --image-ref "$IMAGE_REF" --with-migrate --db-compat backwards
```

If `docker compose run --rm migrate` fails with `Cannot find module '/app/pnpm'`, the ECS host is using a stale `/srv/apps/fun-forum/compose.yaml`. The current host compose file must set `entrypoint: []` on `web`, `worker`, and `migrate`, and `migrate.command` must be:

```yaml
command: ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]
```

Sync `/srv/apps/fun-forum/compose.yaml` from `ops/deploy/vm-compose/fun-forum/compose.yaml`, then rerun the same `sudo -E ./deploy.sh ...` command.

What `deploy.sh` does:

1. validates `.env`
2. logs in to ACR
3. pulls `web` and `migrate`
4. runs Prisma migrations
5. recreates `web`
6. waits for loopback `/health`
7. runs `./smoke.sh`
8. writes `releases/current.json` and `releases/history.jsonl`

If migrations were previously left half-applied in staging, recover them explicitly before rerunning `deploy.sh`.

## Phase 6: Verify web

On the ECS host:

```bash
cd /srv/apps/fun-forum
export IMAGE_REF='talkshow-ai-acr-registry.cn-hangzhou.cr.aliyuncs.com/talkshow-ai/app:sha-<40-char-commit>'

sudo -E docker compose ps
sudo -E docker compose logs --tail=120 web
curl -fsS http://127.0.0.1:14000/health
sudo -E ./smoke.sh
```

Expected signals:

- `web` status is `healthy`
- `/health` returns top-level `"ok":true`
- `/v1/health` returns top-level `"ok":true`
- logs show Redis runtime and SSE backend connected when staging/prod run in Redis mode

## Phase 7: Mark ECS web applied

On the operator workstation:

```bash
IMAGE_REF="$(node ops/deploy/scripts/release-intent.mjs resolve --env staging)"
node ops/deploy/scripts/release-intent.mjs mark-target \
  --env staging \
  --target ecs_web \
  --status applied \
  --image-ref "$IMAGE_REF"
```

## Phase 8: Start the temporary staging worker on the ECS host

After ECS web is healthy, start the `worker` Compose service on the same ECS host with the same immutable image ref and `RUNTIME_ENABLED=true`.

On the ECS host:

```bash
cd /srv/apps/fun-forum
export IMAGE_REF='talkshow-ai-acr-registry.cn-hangzhou.cr.aliyuncs.com/talkshow-ai/app:sha-<40-char-commit>'
sudo -E docker compose --profile staging-same-host-worker pull worker
sudo -E docker compose --profile staging-same-host-worker up -d --no-deps worker
sudo -E docker compose --profile staging-same-host-worker ps worker
sudo -E docker compose --profile staging-same-host-worker logs --tail=120 worker
```

After the worker is healthy:

1. Run `pnpm launch.kickoff` from the operator shell against the target DB.
2. Start warmup from admin `Warm-up`.
3. If synthetic lazy/mock derived content exists, run `pnpm launch.cleanup.invalid:apply`.
4. Run `pnpm launch.enrichment`.
5. Run `pnpm launch.gray.promote --env staging --web-base-url <web-base-url> --worker-base-url <worker-base-url> --admin-token <admin-token>`.

Only then mark worker applied:

```bash
IMAGE_REF="$(node ops/deploy/scripts/release-intent.mjs resolve --env staging)"
node ops/deploy/scripts/release-intent.mjs mark-target \
  --env staging \
  --target eci_worker \
  --status applied \
  --image-ref "$IMAGE_REF"
```

Bookkeeping note:

- `eci_worker` remains the temporary target label in release-intent records even though staging execution is now same-host Compose worker.

## Rollback

Host rollback to previous release:

```bash
cd /srv/apps/fun-forum
export ACR_PULL_USERNAME='<acr-user>'
export ACR_PULL_PASSWORD='<acr-password>'

sudo -E ./rollback.sh
```

Explicit image rollback:

```bash
sudo -E ./rollback.sh --to-image-ref talkshow-ai-acr-registry.cn-hangzhou.cr.aliyuncs.com/talkshow-ai/app:sha-<40-char-commit>
```

Do not perform image-only rollback when the current release recorded `db_compat=incompatible` unless the DB recovery plan has been executed and referenced.

## Common failure patterns

- `APP_ENV must be set in .env`
  - cause: Windows CRLF in uploaded `.env`
  - fix: `sed -i 's/\r$//' /srv/apps/fun-forum/.env`
- `WRONGPASS invalid username-password pair`
  - cause: Tair URI missing username or using the wrong account/password pair
  - fix: correct `RUNTIME_REDIS_URL` / `SSE_REDIS_URL` in Bitwarden and regenerate env
- `MEDIA_STORAGE_BACKEND=s3 requires MEDIA_S3_BUCKET`
  - cause: bucket name missing from env values
  - fix: set `MEDIA_S3_BUCKET` in `env/values/<env>.yaml`, regenerate env, reinject
- `NoSuchBucket` / `SignatureDoesNotMatch` from media storage
  - cause: OSS endpoint or region does not match the bucket region
  - fix: set `MEDIA_S3_REGION=cn-hangzhou` and `MEDIA_S3_ENDPOINT=https://s3.oss-cn-hangzhou.aliyuncs.com`, regenerate env, reinject, and restart web/worker
- `smoke.sh` fails after service is healthy
  - cause: drift between smoke assertions and health route contracts
  - fix: sync host `smoke.sh` from repo before rerun

## Canonical references

- web deploy details: `ops/deploy/handbook/runbooks/ecs-compose-web-deploy.md`
- staging same-host web/worker rollout order: `ops/deploy/handbook/runbooks/ecs-web-eci-worker-rollout.md`
- rollback details: `ops/deploy/handbook/runbooks/rollback-procedure.md`
