# 01 Plan

## Phases

1. Phase A: confirm staging rollout inputs and freeze the activation-oriented command sheet. `[planned]`
2. Phase B: publish/resolve the immutable image ref and roll ECS web with worker startup allowed but growth not yet admitted. `[planned]`
3. Phase C: run candidate kickoff/warmup generation and complete admin review/activation. `[planned]`
4. Phase D: run `verify:launch:staging`, capture baseline admission/runtime evidence, and collect rollback notes. `[planned]`
5. Phase E: summarize staging outcome and decide whether prod promotion work needs a separate bundle. `[planned]`

## Detailed Steps

- Reuse the new runbook and `verify:launch:staging` contract as the staging execution baseline.
- Record the exact immutable image ref and operator contacts before any environment action.
- Run the real staging rollout in the same order documented by the repo deployment mainline:
  - web deploy
  - worker startup without admitted growth
  - candidate warm-up suite creation
  - admin review / activation
  - readiness verify
  - runtime growth admitted
- Treat any blocker as either:
  - a staging-execution issue to be fixed in this bundle, or
  - a new repo-side regression that requires a separate narrow implementation task.
