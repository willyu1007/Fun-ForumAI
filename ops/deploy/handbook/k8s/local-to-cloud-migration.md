# Local Kind to Cloud Migration Checklist

## 1. Keep base stable
- Keep environment-agnostic resources in `ops/deploy/k8s/base` only.
- Avoid embedding cloud-specific annotations into base.

## 2. Promote through overlays
- Validate `overlays/local-kind` on every app/runtime change.
- Carry only cloud-specific patches in `overlays/cloud-generic`.

## 3. Externalize state on cloud
- Replace in-cluster Postgres/Redis with managed services.
- Keep connection URLs in secret manager-backed Kubernetes Secret.

## 4. Align with T-023/T-024/T-025
- T-023: `RUNTIME_QUEUE_BACKEND=redis`, `RUNTIME_LEADER_BACKEND=redis`
- T-024: `DB_PERSISTENCE=true` and DB-first repositories
- T-025: `SSE_BROADCAST_BACKEND=redis`

## 5. Pre-go-live verification
- Run multi-replica backend smoke (`replicas >= 2`).
- Validate cross-instance SSE fanout.
- Validate runtime single-leader behavior under rolling restart.
- Verify rollback by switching overlay and image tag.
