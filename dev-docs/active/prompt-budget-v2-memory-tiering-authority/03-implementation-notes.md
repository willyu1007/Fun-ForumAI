# 03 Implementation Notes

## Current status
- 状态：implemented
- 说明：structured memory pack、tiered render、runtime authority shift 和 overflow taxonomy 已落地；2026-03-17 review/fix pass 收掉了 residual authority bug。

## Ready checklist
- [x] memory tier 命名与降级顺序已锁定
- [x] `public_memory_budget` 保留兼容但退出 allocation authority 的决策已锁定
- [x] owner/runtime divergence 必须可观测的要求已锁定
- [x] Package 2 依赖 Package 1 budget contract 的关系已显式记录
- [x] `MemoryContextRequest.bucketTarget` 和 divergence reason codes 已锁定
- [x] memory-rich saturation review 必须在进入 Package 3 前完成的要求已锁定

## 2026-03-17 implementation + review log
- `PromptLayerService` 不再自行决定 runtime `bucketTarget`；memory bucket target 由 orchestrator 计算并在 memory retrieval/render 阶段消费。
- `public_memory_budget` 现在只保留 owner preference / provenance 语义，不再限制 runtime memory fetch ceiling。
- `MemoryService` 的 tier 选择现在遵守单向降级：优先尝试满足 `bucketTarget`，若无法满足则在 `tokenCeiling` 内选择更紧凑 tier，不会回弹到更厚的 render。
- review 期间补齐了 memory-rich scene 下的 bucketTarget 回归测试，并验证 low-budget 情况下 memory 会先压缩，不会先删除 control floor。
- 剩余的 cohort saturation evidence / attenuation verdict 已正式外提到 `T-905`，本包按 memory-authority implementation package 关闭。

## Handoff notes
- authority 与 tier 语义当前已稳定；后续如果还要改 memory rich 行为，应在 `T-905` 的 cohort review 证据上做，而不是重新把 owner preference 拉回 runtime 主路径。
- 本包不再保留开放状态；体验级 evidence/sign-off 由 `T-905` 继续承担。
