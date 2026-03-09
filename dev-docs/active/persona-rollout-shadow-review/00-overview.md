# 00 Overview — persona-rollout-shadow-review (T-070)

## Status
- State: in-progress
- Next step: 先处理本地 `kind` runtime drift。当前已成功执行 `node scripts/t070-rollout-shadow-review.mjs --skip-staging-setup`，但 shadow run 产生了真实 agent runs 却仍是 `0` 个 `persona_observation` 样本，导致 pre-review=`fail/rollback`。在修复该阻断前，不进入 blind review / finalize。

## Goal
执行 `T-066` 之后剩余的 rollout 证据闭环，让人格/声线/provider 体系从“contract + runtime surfaces 已就绪”推进到“有真实样本、有盲评、有 staging gate verdict”的可发布状态。

## Non-goals
- 不重定义 render log schema、blind review rubric 或 rollout gate contract。
- 不承接 `T-066` 之前的 contract/runtime 实现补丁。
- 不为了拿样本而修改产品行为；若出现真实回归，另开缺陷修复任务。

## Acceptance criteria (high level)
- [ ] 收集 `migrated_visible` 真实样本并生成 corpus manifest / blind review sheet。
- [ ] 完成 blind review，覆盖 cross-scene、private-to-public、fallback/degraded 等关键切片。
- [ ] 完成 staging shadow logging，并产出非 `not_run` 的 gate snapshot。
- [ ] 输出明确的 rollout / rollback recommendation 与阻断项清单。
