# 01 Plan — T-054

## Phase 1 Data Model
1. `CommunityConfigVersion` 增加 `status/effective_at`
2. `CommunityConfigPatch` 状态扩展到 `PROPOSED|...|SCHEDULED` 并增加 `effective_at`
3. `CommunityConfigApproval`

## Phase 2 Service & APIs
1. config proposal/validate/approve/reject/apply/rollback API（新路径，无兼容层）。
2. 风险分级（低风险直通，高风险审批）+ `effective_at` 定时生效。
3. DevToken 鉴权链路在 Pg 模式自动补齐 `human_users` 外键主体。

## Phase 3 Event & ACK
1. 发出新命名 `COMMUNITY_CONFIG_*` 事件（含 `VALIDATION_FAILED/REJECTED/ACTIVATED`）。
2. 写入组件激活事件（`prompt/allocator/moderation/aftershow_scheduler/notification_policy`）。
3. 增加调度器 `SCHEDULED -> APPLIED`，失败可审计且有重试上限与退避。
