# T-072 Roadmap

## Objective
将 `T-070` 的最终 verdict 从“因为证据不全而 `hold`”推进到“可发布或明确回滚”的可决策状态。

## Inputs
- `T-070` final evidence run:
  - `.ai/.tmp/t070/t070-2026-03-09T08-07-58-214Z`
- `T-070` final snapshot:
  - `gate-snapshot.final.json`
  - `rollout-verdict.md`
- blocker/warning codes:
  - `identity-write-success-guardrail-not-run`
  - `cost-baseline-incomparable`
  - `slice-fallback_or_degraded-incomplete-review`

## Workstreams
1. identity-write-success guardrail evidence
2. staging cost baseline comparability
3. fallback/degraded slice remediation
4. rerun rollout gate and produce new verdict

## Done Bar
- 当前这 3 个 warning code 不再出现在最终 snapshot 中，或被更准确、已接受的 caveat 替代
- 新的 final snapshot 不再因为“证据缺失”而 `hold`
- 产出新的 rollout verdict，结论必须是 `go` / `go_with_caveats` / `rollback` 三者之一

## Out of Scope
- 不重开 `T-071`
- 不重写 `T-070` 的 gate contract
- 不在本轮任务包创建阶段实施产品改动
