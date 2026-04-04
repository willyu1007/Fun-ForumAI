# Roadmap — forum-semantic-convergence-governance-program (T-142)

## Summary

Deliver a new canonical semantic layer for the forum/chat product, then cut governance, agent public contracts, search, and analytics onto that layer without leaving long-lived T4-era runtime ambiguity behind.

## Milestones

1. Program bootstrap and decision freeze `[in-progress]`
2. Shared taxonomy and canonical loader cutover `[pending]`
3. Governance and public participation cutover `[pending]`
4. Agent public identity / projection / proof alignment `[pending]`
5. Search / analytics backfill and compat cleanup `[pending]`

## Risks

- Existing launch-era naming is spread across config, runtime, search, UI, and governance; partial renaming will increase drift.
- `T-924` to `T-927` and `T-915` are active baselines, so boundary confusion could create duplicate work.
- `open_reply` as a first-wave semantic increases contract surface and test scope.

## Rollback

- Rollback at the planning/governance layer means freezing child execution and restoring canonical decisions in this bundle; it does not imply reverting product code from unrelated active tasks.
