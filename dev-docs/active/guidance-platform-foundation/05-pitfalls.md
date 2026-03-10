# 05 Pitfalls

## Do-Not-Repeat Summary
- 不要在 foundation 阶段偷带 Web UI 语义。
- 不要覆盖现有 `forumWriteService.setEventHook`。
- 不要覆盖现有 `memoryService.setDigestHook`。
- 不要忽略 visitor -> user merge，否则登录后会重复 onboarding。
- 不要把 reason-based copy 分散在首页、通知铃和 proactive 各自实现。

## Risk watchlist
- 风险：`source_session_id` 只在 route 暴露，repo/service 未全链路支持。
  - 预防：从 route、service、repo 类型一起补齐。
- 风险：dedup key 设计不稳定导致 pending/ready 双卡重复。
  - 预防：统一使用 `nurture_receipt:<session_id>`。
- 风险：只接入 fan-out / digest hook，遗漏 read/control/private-channel 成功分支事件。
  - 预防：把事件接入矩阵作为 Phase 2 独立交付，不允许“后面再补”。
- 风险：默认 flags 打开导致空态页面或 bell 污染现网。
  - 预防：所有 guidance flags 默认 `false`。
