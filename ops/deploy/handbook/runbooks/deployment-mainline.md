# Deployment Mainline

## Scope

Canonical operator playbook for the current cloud delivery mainline:

- image publishing: GitHub Actions -> ACR
- env rendering: Bitwarden -> `env-localctl compile`
- web deploy target: ECS host running `Docker Compose`
- worker deploy target: ECI container group
- release contract: immutable `sha-<commit>` image refs only

Use this document as the end-to-end sequence. Keep the specialized runbooks for host-only rollback or ECI replacement as supporting references.

## Current topology

- `staging`
  - `1 ECS web`
  - `1 ECI worker`
- `prod`
  - `1 ECS web`
  - `1 ECI worker`

Canonical repo-side assets:

- publish workflow: [publish-image.yml](/d:/Else/Fun-ForumAI/.github/workflows/publish-image.yml)
- env contract: [contract.yaml](/d:/Else/Fun-ForumAI/env/contract.yaml)
- staging values: [staging.yaml](/d:/Else/Fun-ForumAI/env/values/staging.yaml)
- ECS host files: [fun-forum](/d:/Else/Fun-ForumAI/ops/deploy/vm-compose/fun-forum)
- ECI worker template: [eci-worker](/d:/Else/Fun-ForumAI/ops/deploy/workloads/eci-worker)
- desired release records: [release-intents](/d:/Else/Fun-ForumAI/ops/deploy/release-intents)

## Inputs

Required operator inputs:

- target environment: `staging` or `prod`
- immutable image ref:
  - `talkshow-ai-acr-registry.cn-hangzhou.cr.aliyuncs.com/talkshow-ai/app:sha-<40-char-commit>`
- Bitwarden token that can read the target project secrets
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

On the operator workstation:

```powershell
cd D:\Else\Fun-ForumAI
$env:BWS_ACCESS_TOKEN = "<token>"

python -B -S .ai/skills/features/environment/env-localctl/scripts/env_localctl.py compile `
  --root . `
  --env staging `
  --runtime-target ecs `
  --workload api `
  --env-file ops/deploy/env-files/staging.env `
  --no-context `
  --no-preflight
```

Repeat with `--env prod` for prod.

Key staging requirements already encoded in repo values:

- `MEDIA_STORAGE_BACKEND=s3`
- `MEDIA_S3_BUCKET=bucket-forum-stag`
- `RUNTIME_QUEUE_BACKEND=redis`
- `RUNTIME_LEADER_BACKEND=redis`
- `SSE_BROADCAST_BACKEND=redis`

Operational notes:

- Redis URLs for Aliyun Tair must use the correct account form when ACL-style accounts are enabled:
  - `redis://<username>:<password>@<host>:6379/0`
- `MEDIA_S3_BUCKET` is a non-secret value and belongs in env values, not Bitwarden.

## Phase 3: Inject `.env` onto ECS

Upload the rendered env file to the ECS host, for example:

- local file: `ops/deploy/env-files/staging.env`
- remote temp file: `/tmp/fun-forum-staging.env`

Then on ECS:

```bash
cd /srv/apps/fun-forum
cp .env ".env.bak.$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
install -m 600 /tmp/fun-forum-staging.env /srv/apps/fun-forum/.env
sed -i 's/\r$//' /srv/apps/fun-forum/.env
```

Minimal presence check without revealing values:

```bash
grep -nE '^(APP_ENV|DATABASE_URL|JWT_SECRET|SERVICE_AUTH_SECRET|MEDIA_S3_BUCKET|RUNTIME_REDIS_URL|SSE_REDIS_URL)=' /srv/apps/fun-forum/.env | sed 's/=.*/=<redacted>/'
```

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
- `/v1/health` still exposes legacy wrapped `"status":"ok"`
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

## Phase 8: Replace ECI worker

After ECS web is healthy, replace the worker container group with the same immutable image ref and `RUNTIME_ENABLED=true`.

Supporting assets:

- [ecs-web-eci-worker-rollout.md](/d:/Else/Fun-ForumAI/ops/deploy/handbook/runbooks/ecs-web-eci-worker-rollout.md)
- [eci-worker](/d:/Else/Fun-ForumAI/ops/deploy/workloads/eci-worker)

Then mark worker applied:

```bash
IMAGE_REF="$(node ops/deploy/scripts/release-intent.mjs resolve --env staging)"
node ops/deploy/scripts/release-intent.mjs mark-target \
  --env staging \
  --target eci_worker \
  --status applied \
  --image-ref "$IMAGE_REF"
```

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
- `smoke.sh` fails after service is healthy
  - cause: drift between smoke assertions and health route contracts
  - fix: sync host `smoke.sh` from repo before rerun

## Canonical references

- web deploy details: [ecs-compose-web-deploy.md](/d:/Else/Fun-ForumAI/ops/deploy/handbook/runbooks/ecs-compose-web-deploy.md)
- ECS + ECI rollout order: [ecs-web-eci-worker-rollout.md](/d:/Else/Fun-ForumAI/ops/deploy/handbook/runbooks/ecs-web-eci-worker-rollout.md)
- rollback details: [rollback-procedure.md](/d:/Else/Fun-ForumAI/ops/deploy/handbook/runbooks/rollback-procedure.md)
