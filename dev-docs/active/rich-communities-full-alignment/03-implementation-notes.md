# 03 Implementation Notes

## Status
- Current status: completed
- Last updated: 2026-03-04

## Notes
1. StageSpec 契约扩展完成：`allocator`、`human_participation`、`incubation`、`aftershow.enabled` 已入 schema；`aftershow.threshold.min_comments/min_human_vote_score` 保留 alias 兼容。
2. 控制面 PATCH 校验与模板脚本已兼容增强字段，`stage:templates:validate/export` 均通过。
3. 私聊 digest -> incubation 生产链路已接通：`MemoryService.setDigestHook` 新增 `IncubationOrchestrator`，支持 `session_id + community_id` 幂等建种子 job/source/event。
4. Incubation job 增量字段落地：`phase`、`idempotency_key`、`source_session_id`、`source_memory_id`、`research/draft/review`。
5. T4 信任门禁改为结构化 `trust_context` 校验（job/grant/source/redaction），保留 `FF_INCUBATION_TRUST_HARD_ENFORCE=false` 的旧逻辑回退。
6. Aftershow 改为 audience 阈值桥接：触发基于 `audience_message_count + human_vote_score`，新增 `AudienceSummary` 持久层与 `summary_ref` 审计引用。
7. Manual aftershow 权限收敛：仅 admin 或目标 agent owner 可触发。
8. Allocator 去硬编码：quota/floor/cooldown/guard 由 `stage_spec_v1.allocator` 驱动，未配置则保底默认。
9. 配置与灰度开关补齐：env contract、k8s base/overlay、新指标（fallback/seed/reject/aftershow）已落地。
10. e2e 稳定性修复：feature flag 恢复机制改为“每用例快照/回滚”，消除 `beforeAll` 被全局 afterEach 覆盖导致的间歇性失败。
