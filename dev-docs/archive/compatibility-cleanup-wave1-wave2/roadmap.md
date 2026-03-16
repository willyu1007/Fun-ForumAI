# Roadmap — compatibility-cleanup-wave1-wave2

## Objective
- Reduce compatibility debt without destabilizing flagged runtime migrations.

## Milestones
1. Wave 1: remove dead compatibility-only surfaces with no behavior change.
2. Wave 2: stop new writes from perpetuating legacy shapes while preserving controlled read compatibility.
3. Final verification: re-run focused and full gates, then leave flagged runtime fallback cleanup for a later rollout-driven task.

## Rollback posture
- Each checkpoint must stay green independently.
- If a Wave 2 cleanup breaks old persisted-data reads, restore the narrow read-compat branch without reviving the removed write path.
