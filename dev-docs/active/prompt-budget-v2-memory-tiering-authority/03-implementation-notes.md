# 03 Implementation Notes

## Current status
- 状态：planned
- 说明：任务包已冻结 memory tier vocabulary、authority shift、overflow taxonomy 和 Package 2 review gate；等待 Package 1 review 关闭后进入实现。

## Ready checklist
- [x] memory tier 命名与降级顺序已锁定
- [x] `public_memory_budget` 保留兼容但退出 allocation authority 的决策已锁定
- [x] owner/runtime divergence 必须可观测的要求已锁定
- [x] Package 2 依赖 Package 1 budget contract 的关系已显式记录
- [x] `MemoryContextRequest.bucketTarget` 和 divergence reason codes 已锁定
- [x] memory-rich saturation review 必须在进入 Package 3 前完成的要求已锁定

## 2026-03-17 planning log
- 新建 `T-115` task bundle，承接 Token Budget V2 的 memory authority 改造。
- 记录 structured memory contract、tiered degradation 规则和 overflow taxonomy。
- 将本包映射到 `R-030`，作为 `T-069` 的 authority 重构后续包，而非原包追加阶段。

## Handoff notes
- 实现时先拆 `pack` 与 `render` 的职责，再迁 orchestrator ceiling authority；不要先改 tier 名字而保留旧调用顺序。
- owner/runtime divergence 必须进入 audit/metrics，而不是只写 console warning。
- 如果出现私有/公开 disclosure 合同冲突，优先保持 disclosure 语义不变，再调整 memory packing。
- 如果 low-budget scene 的 memory-rich cohort 在 tier 降级后仍长期贴近 `memory.max_ratio`，不要直接带着 open question 进入 Package 3；必须在本包内先收口 attenuation 决策。
