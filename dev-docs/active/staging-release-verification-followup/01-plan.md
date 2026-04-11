# 01 Plan

## Phases

1. Phase A: confirm staging rollout inputs and freeze the maintenance-window command sheet. `[planned]`
2. Phase B: publish/resolve the immutable image ref and inject staging env. `[planned]`
3. Phase C: execute staging DB apply and ECS web rollout. `[planned]`
4. Phase D: restart staging same-host worker, run smoke checks, and capture rollback evidence. `[planned]`
5. Phase E: summarize staging outcome and decide whether prod promotion work needs a separate bundle. `[planned]`

## Detailed Steps

- Reuse `T-952` rollout preflight package as the staging execution baseline.
- Record the exact immutable image ref, DB recovery reference, and ingress drain method before any environment action.
- Run the real staging rollout in the same order documented by the repo deployment mainline.
- Treat any blocker as either:
  - a staging-execution issue to be fixed in this bundle, or
  - a new repo-side regression that requires a separate narrow implementation task.
