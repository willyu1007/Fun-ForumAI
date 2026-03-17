# 05 Pitfalls

## Do-Not-Repeat Summary
- 不要把 `public_memory_budget` 以别名重新塞回 runtime allocation 主路径。
- 不要把 memory tier 实现成只有“保留/删除”两档。
- 不要在 orchestrator 外部提前渲染最终 memory string，再让 runtime 被动接受结果。
- 不要遗漏 `budget_exceeded_due_to_privacy_and_memory_floor` 与 `hard_ceiling_enforced_memory_compacted`，否则 overflow 诊断会再次失真。
- 不要跳过 low-budget / memory-rich cohort review 就进入 sensitive-scene cutover。

## Risk watchlist
- 风险：memory ceiling 仍由 privacy settings 或 route 参数偷偷主导。
  - 预防：所有 runtime ceiling 必须经过 `PromptBudgetDecision`。
- 风险：overflow taxonomy 只改名字，不改可诊断性。
  - 预防：新原因必须有对应 bucket token 与 tier 证据支撑。
- 风险：owner 偏好退出 authority 后，产品表面无法解释行为变化。
  - 预防：在 stats/admin/audit 中同步暴露 divergence 字段。
- 风险：`bucketTarget` 缺失导致 renderer 只看硬上限，不看期望占比。
  - 预防：将 `bucketTarget` 作为 `MemoryContextRequest` 必填字段，并在 audit 中回显。
- 风险：memory-rich agent 仍长期把低预算 scene 吃到接近 `max_ratio`。
  - 预防：把 cohort saturation review 设为 Package 2 的 blocking gate，必要时在本包内补 attenuation 逻辑。
