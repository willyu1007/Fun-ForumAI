# Maintenance-Window Command Sheet — 2026-04-11

## Assumptions

- target environment: `staging`
- service id: `llm-forum`
- app dir on ECS host: `/srv/apps/fun-forum`
- deploy model: `Docker Compose` on ECS host
- release compatibility: `db_compat=incompatible`

Replace placeholders before execution:

- `<40-char-commit>`
- `<operator>`
- `<db-recovery-reference>`
- `<acr-user>`
- `<acr-password>`
- `<bitwarden-token>`

## 1. Confirm immutable release artifact

Operator workstation:

```bash
gh run list --workflow "Publish Image" --limit 5
gh run view <run-id>
```

Required output:

- immutable image ref:

```text
talkshow-ai-acr-registry.cn-hangzhou.cr.aliyuncs.com/talkshow-ai/app:sha-<40-char-commit>
```

## 2. Render and inject staging env

Operator workstation:

```bash
export BWS_ACCESS_TOKEN='<bitwarden-token>'

python -B -S .ai/skills/features/environment/env-localctl/scripts/env_localctl.py compile \
  --root . \
  --env staging \
  --runtime-target ecs \
  --workload api \
  --env-file ops/deploy/env-files/staging.env \
  --no-context

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

Minimal presence check on the host:

```bash
grep -nE '^(APP_ENV|DATABASE_URL|JWT_SECRET|SERVICE_AUTH_SECRET|MEDIA_S3_BUCKET|RUNTIME_REDIS_URL|SSE_REDIS_URL)=' /srv/apps/fun-forum/.env | sed 's/=.*/=<redacted>/'
```

## 3. Record desired release

Operator workstation:

```bash
node ops/deploy/scripts/release-intent.mjs set \
  --env staging \
  --sha <40-char-commit> \
  --db-compat incompatible \
  --db-plan <db-recovery-reference> \
  --approved-by <operator>
```

## 4. Maintenance-window execution on ECS host

ECS host:

```bash
cd /srv/apps/fun-forum
export IMAGE_REF='talkshow-ai-acr-registry.cn-hangzhou.cr.aliyuncs.com/talkshow-ai/app:sha-<40-char-commit>'
export ACR_PULL_USERNAME='<acr-user>'
export ACR_PULL_PASSWORD='<acr-password>'

sudo -E ./deploy.sh --image-ref "$IMAGE_REF" --with-migrate --db-compat incompatible --db-plan <db-recovery-reference>
```

What this covers:

- docker login
- `docker compose pull web migrate`
- `docker compose run --rm migrate`
- `docker compose up -d --no-deps web`
- loopback health wait
- `./smoke.sh`
- release record write

## 5. Verify web

ECS host:

```bash
cd /srv/apps/fun-forum
export IMAGE_REF='talkshow-ai-acr-registry.cn-hangzhou.cr.aliyuncs.com/talkshow-ai/app:sha-<40-char-commit>'

sudo -E docker compose ps
sudo -E docker compose logs --tail=120 web
curl -fsS http://127.0.0.1:14000/health
sudo -E ./smoke.sh
```

Operator workstation:

```bash
IMAGE_REF="$(node ops/deploy/scripts/release-intent.mjs resolve --env staging)"
node ops/deploy/scripts/release-intent.mjs mark-target \
  --env staging \
  --target ecs_web \
  --status applied \
  --image-ref "$IMAGE_REF"
```

## 6. Restart staging same-host worker

ECS host:

```bash
cd /srv/apps/fun-forum
export IMAGE_REF='talkshow-ai-acr-registry.cn-hangzhou.cr.aliyuncs.com/talkshow-ai/app:sha-<40-char-commit>'

sudo -E docker compose --profile staging-same-host-worker pull worker
sudo -E docker compose --profile staging-same-host-worker up -d --no-deps worker
sudo -E docker compose --profile staging-same-host-worker ps worker
sudo -E docker compose --profile staging-same-host-worker logs --tail=120 worker
```

Operator workstation:

```bash
IMAGE_REF="$(node ops/deploy/scripts/release-intent.mjs resolve --env staging)"
node ops/deploy/scripts/release-intent.mjs mark-target \
  --env staging \
  --target eci_worker \
  --status applied \
  --image-ref "$IMAGE_REF"
```

## 7. Rollback reminder

Because this rollout is `db_compat=incompatible`:

- do not treat image rollback as sufficient
- first complete DB recovery using the pre-recorded recovery reference
- only then execute image rollback

ECS host:

```bash
cd /srv/apps/fun-forum
export ACR_PULL_USERNAME='<acr-user>'
export ACR_PULL_PASSWORD='<acr-password>'

sudo -E ./rollback.sh --db-plan <db-recovery-reference>
```
