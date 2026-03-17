# 03 Implementation Notes

## Current status
- 状态：implemented
- 说明：public-scene V2 authority、compiled-block contract 和 gateway passive window validation 已落地；2026-03-17 完成一轮 review/fix pass，修正 contract 与 trim 边界问题。

## Ready checklist
- [x] scene budget config、bucket taxonomy 和 control-tier vocabulary 已锁定
- [x] `requestEnvelope` / `localLayerEnvelope` ownership 与公式已锁定
- [x] privacy/style/overrides 的 V2 block 映射已锁定
- [x] public scenes 的迁移顺序已锁定为 `forum_post -> forum_comment -> scheduled_post`
- [x] `scheduled_post` 默认复用 `forum_post` config 的决策已锁定
- [x] model-window 元数据只做被动校验、不参与 routing 的决策已锁定
- [x] visible actor 不自动升厚 envelope 的决策已锁定
- [x] Package 1 / 2 / 3 的职责边界已拆分完成

## 2026-03-17 implementation + review log
- public scenes (`forum_post` / `forum_comment` / `scheduled_post`) 已走 `currentContextSources[] -> PromptOrchestrator -> compiled blocks -> prompt template -> gateway` 的 V2 路径。
- `PromptOrchestrator.buildLocalLayerEnvelope()` 现在会读取 `model_capability_ref` 并同时约束 `request_target_input`、`request_soft_ceiling`、`request_hard_ceiling`，避免出现 `target > soft/hard` 的病态 envelope。
- V2 template registry 现在强制六个 visible scene 模板声明五个 compiled blocks；`PromptEngine` 与运行时合同对齐，允许显式空字符串的 `compact_control_block`、`memory_block`、`soft_expression_block` 通过校验。
- 修复了 `budget_exceeded_due_to_privacy_and_memory_floor` 的误报条件，避免“无 memory 且 prompt 已 fit budget”时仍被标记为 overflow。
- gateway 被动 window validation 已在真实 Qwen-Flash 调用上验证为 warning-only，不参与 route 选择，也不会单独阻断请求。
- 剩余 public-scene cohort / experience evidence 已外提到 `T-905`，`T-114` 维持为已关闭的 public-scene contract 包。

## Handoff notes
- 当前没有新的 public-scene contract blocker；后续改动必须继续保持 `request/local envelope` 与 V2 compiled-block contract 一致。
- gateway passive validation 仍必须保持 warning-only；provider 参数错误和真实上游 4xx/5xx 不是本包 budget warning 机制的一部分。
- public-scene 的更深行为评审仍建议继续收集 cohort evidence，但这不再阻塞已落地的 authority / contract 正确性。
