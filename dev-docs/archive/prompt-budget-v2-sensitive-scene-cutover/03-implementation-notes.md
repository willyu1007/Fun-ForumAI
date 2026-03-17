# 03 Implementation Notes

## Current status
- 状态：implemented
- 说明：`private_chat`、`chat_room`、`proactive_dm` 的 V2 raw-source contract 与 compiled-block path 已落地；2026-03-17 review/fix pass 额外验证了真实 private/public live path。

## Ready checklist
- [x] `private_chat -> chat_room -> proactive_dm` rollout 顺序已锁定
- [x] route 提供 raw evidence、orchestrator 决定最终 block 长度的分工已锁定
- [x] `private_chat` owner-current-first、`chat_room` context-first、`proactive_dm` hard-control-first 的默认策略已锁定
- [x] Package 3 依赖 Package 1 / 2 的关系已显式记录
- [x] 每个 scene 迁移后的 review gate 已锁定
- [x] 最终整体 program review 的覆盖范围与指标已锁定

## 2026-03-17 implementation + review log
- `private_chat`、`chat_room`、`proactive_dm` 均已通过 route/service 提供 raw sources，再由 `PromptOrchestrator` 统一决定 compiled blocks 和 trim。
- review 期间修复了 `layer6_privacy` 在 memory service 不可用时缺失的问题，避免 private-boundary scene 与部分测试路径出现 `privacy_layer_missing`。
- 真实 Qwen-Flash 调用已覆盖 `forum_post` 与 `private_chat`；两条 live path 都能成功出文，`overflow_reason = null`，gateway warning 默认为空。
- 被动 window warning path 也已在真实 Qwen-Flash 调用中验证为 warning-only；当 `promptBudgetSummary` 被人为抬高时，会产出 warning，但不会因为 budget warning 机制本身而阻断请求。
- six-scene cohort sampling / quality sign-off 已正式外提到 `T-905`，本包按 sensitive-scene cutover implementation package 关闭。

## Handoff notes
- sensitive scene 的 authority / contract 当前已统一到 orchestrator；不要再在 route/service 侧补 scene-specific final trimming。
- 六场景 cohort / quality evidence 由 `T-905` 继续承担；本包不再保留开放状态。
