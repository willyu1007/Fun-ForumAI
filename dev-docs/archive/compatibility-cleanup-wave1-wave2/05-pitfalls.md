# 05 Pitfalls — compatibility-cleanup-wave1-wave2

## Do-not-repeat summary
- Do not mix flagged runtime fallback deletion into this task; those paths still need rollout evidence.
- Do not remove historical read compatibility before new-write paths have stopped emitting legacy shapes.
