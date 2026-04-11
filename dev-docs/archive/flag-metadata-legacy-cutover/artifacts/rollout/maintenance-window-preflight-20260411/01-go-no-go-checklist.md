# Go / No-Go Checklist — 2026-04-11

## Go conditions

All items below must be true before the maintenance window starts.

- repo-side verification is green
  - `pnpm cutover:preflight`
  - isolated DB apply rehearsal
  - `pnpm verify:launch:ci`
  - canonical packaging build
- immutable published image ref is available in ACR
- rollout target is `staging`
- operator has ECS shell access and ACR pull credentials
- staging `.env` has been rendered and the inject/apply path is confirmed
- managed PostgreSQL recovery reference is recorded
  - snapshot id, restore request id, or equivalent approved recovery note
- rollback owner is named
- ingress write-freeze method is named
  - ALB/Caddy drain, maintenance page, or accepted short downtime
- staging worker restart is included in the plan
  - do not leave a same-host staging worker running the old image against the new schema

## No-go conditions

Any one of these blocks the maintenance window.

- only a local tag exists, but no immutable published ACR image exists
- no DB recovery reference is recorded for this incompatible migration
- operator cannot block or drain new writes during `migrate + web restart`
- staging `.env` has not been rendered or injected
- operator cannot access the ECS host
- ACR pull credentials are missing
- the staging worker restart step is omitted
- the release-intent record still says `backwards` or is missing entirely

## Special caution points

- There is no repo-native maintenance-mode or write-freeze toggle for this task.
- `healthState.markNotReady()` is a readiness surface, not an operator-facing write-freeze workflow.
- `deploy.sh` only restarts `web` and runs `migrate`; for staging, the temporary same-host `worker` must be restarted separately after web is healthy.
- Because `db_compat=incompatible`, `rollback.sh` alone is not the full recovery story. DB recovery must be handled first and referenced with `--db-plan`.

## Approval boundary

- `staging`: review required
- `prod`: formal approval required and still blocked on fresh staging evidence
