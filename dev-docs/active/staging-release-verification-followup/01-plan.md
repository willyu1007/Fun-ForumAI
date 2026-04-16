# 01 Plan

## Phases

1. Phase A: confirm staging rollout inputs and freeze the activation-oriented command sheet. `[planned]`
2. Phase B: publish/resolve the immutable image ref and roll ECS web with worker startup allowed but growth not yet admitted. `[planned]`
3. Phase C: run candidate kickoff/warmup generation and complete admin review/activation. `[planned]`
4. Phase D: run `verify:launch:staging`, then execute the media injection/retrieval staging tranche and collect rollback notes. `[planned]`
5. Phase E: summarize staging outcome and decide whether prod promotion work needs a separate bundle. `[planned]`

## Detailed Steps

- Operator should use [02-operator-checklist.md](/Users/phoenix/Desktop/project/Fun-ForumAI/dev-docs/active/staging-release-verification-followup/02-operator-checklist.md:1) as the task-local execution sheet and keep the canonical deployment runbooks as supporting references.
- Reuse the new runbook and `verify:launch:staging` contract as the staging execution baseline.
- Record the exact immutable image ref, operator contacts, and staging feature-flag/env render snapshot before any environment action.
- Run the real staging rollout in the same order documented by the repo deployment mainline:
  - web deploy
  - worker startup without admitted growth
  - candidate warm-up suite creation
  - admin review / activation
  - readiness verify
  - runtime growth admitted
- Extend the same staging window with a media-specific execution slice after the baseline gate is green:
  - confirm rendered env and runtime logs for `FF_MEDIA_INJECTION_V1`, `FF_MEDIA_RETRIEVAL_V1`, `FF_MEDIA_PLANNER_RETRIEVAL_V1`
  - run one real media import job against staging `s3` storage and capture job/item/artifact evidence
  - verify ECS/ECI worker claim, heartbeat, retry, and artifact cleanup do not drift under cloud topology
  - confirm one public-safe retrieval hit and one owner-private retrieval hit with correct scope isolation
  - confirm planner retrieval quality on staging with retrieval off/on and duplicate-cluster suppression intact
- Treat any blocker as either:
  - a staging-execution issue to be fixed in this bundle, or
  - a new repo-side regression that requires a separate narrow implementation task.
