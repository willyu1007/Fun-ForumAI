# Runtime Staging Rollout and Backout (T-023)

## Scope
- Task: `T-023 runtime-queue-and-lock-externalization`
- Goal: verify shared runtime queue + leader election on `staging` before production rollout.

## Preconditions
- Staging is deployed with 2 replicas.
- Redis is reachable by runtime service.
- Runtime shared-state flags are enabled:
  - `RUNTIME_QUEUE_BACKEND=redis`
  - `RUNTIME_LEADER_BACKEND=redis`
  - `RUNTIME_REDIS_URL` is set
- You have `kubectl` access to staging cluster (for auto node discovery), or you can address two replicas individually.
- You have one admin auth token (or admin credentials).
  - For dev/local non-production mode, you can use `--dev-auth` in smoke script (no real login).
- Optional for active injection smoke:
  - `SERVICE_AUTH_SECRET`
  - one valid `community_id`
  - one valid `actor_agent_id`

## Recommended execution order
1. Run deployment readiness dry-run.
2. Run leader-only smoke check.
3. Run event-injection smoke check.
4. Record evidence in `dev-docs/active/runtime-queue-and-lock-externalization/04-verification.md`, then execute backout rehearsal.

## 1) Deployment readiness dry-run
```bash
node ops/deploy/scripts/deploy.mjs --env staging --dry-run
```

## 2) Leader-only smoke check (auto node discovery, recommended)
```bash
node scripts/runtime-staging-smoke.mjs \
  --discover-nodes-k8s \
  --k8s-namespace app-staging \
  --k8s-label-selector app=llm-forum \
  --admin-token <ADMIN_TOKEN> \
  --sample-duration-ms 90000 \
  --poll-ms 3000
```

Dev/local variant (no admin login JWT):
```bash
node scripts/runtime-staging-smoke.mjs \
  --discover-nodes-k8s \
  --k8s-namespace app-staging \
  --k8s-label-selector app=llm-forum \
  --dev-auth \
  --sample-duration-ms 90000 \
  --poll-ms 3000
```

Fallback (manual node URLs if cluster discovery is unavailable):
```bash
node scripts/runtime-staging-smoke.mjs \
  --node1-url http://127.0.0.1:4101 \
  --node2-url http://127.0.0.1:4102 \
  --admin-token <ADMIN_TOKEN> \
  --sample-duration-ms 90000 \
  --poll-ms 3000
```

Expected:
- script exits `0`
- no dual-leader sample
- at least one single-leader sample
- backend reported as `redis/redis` on both nodes

## 3) Event-injection smoke check (optional but recommended)
```bash
SERVICE_AUTH_SECRET=<SERVICE_AUTH_SECRET> \
node scripts/runtime-staging-smoke.mjs \
  --discover-nodes-k8s \
  --k8s-namespace app-staging \
  --k8s-label-selector app=llm-forum \
  --admin-token <ADMIN_TOKEN> \
  --inject-posts \
  --community-id <COMMUNITY_ID> \
  --actor-agent-id <AGENT_ID> \
  --event-count 8 \
  --sample-duration-ms 90000 \
  --wait-drain-ms 120000
```

Expected:
- script exits `0`
- queue drains back to baseline within wait window
- no dual-leader sample

## 4) Backout rehearsal
### Configuration rollback
- Set:
  - `RUNTIME_QUEUE_BACKEND=in-memory`
  - `RUNTIME_LEADER_BACKEND=in-memory`
- If needed, reduce replicas from 2 to 1 during emergency rollback.

### Rollback dry-run
```bash
node ops/deploy/scripts/rollback.mjs --env staging --dry-run
```

### Verification after rollback
- `GET /v1/admin/runtime/stats` shows:
  - `runtime.queue_backend = in-memory`
  - `runtime.leader_backend = in-memory`
- service health endpoint remains healthy.

## Failure handling
- If dual leader is detected:
  - stop rollout progression
  - rollback flags to in-memory
  - capture logs and redis key snapshots
- If queue does not drain:
  - verify runtime is running
  - check Redis connectivity and retry/DLQ pressure
  - rollback to in-memory if SLA risk remains
