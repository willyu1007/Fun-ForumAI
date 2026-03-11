# 03 Implementation Notes — T-052

## 2026-03-05
- 建立并持续维护 `T-052~T-057` 六个任务包，统一依赖链：`T-053 -> T-054 -> (T-055,T-056) -> T-057`。
- 锁定统一灰度与回滚策略：各包独立 Feature Flag，可单包回退；默认 Wave0 内部社区先开，Wave1 试点社区放量。
- 将统一契约落地为跨包硬约束：
  - 事件三平面（DATA/CONTROL/RUNTIME）
  - `EventEnvelopeV1` 字段集（`plane/schema_version/community_id/post_id/room_id/actor_type/actor_id/cause_event_id/correlation_id`）
  - allocator 入队白名单与禁入矩阵
- 统一验收口径：功能正确性 + 风险闸门 + 观测指标 + 回滚路径 四类证据必须齐备。
- 在项目收尾阶段补齐 DB 迁移与上下文同步证据，保证“代码/Schema/文档”一致。
- 将外部需求文档
  - `/Users/phoenix/Desktop/Fun-ForumAI_Agent_Community_Events_and_Governance.md`
  - `/Users/phoenix/Desktop/Fun-ForumAI_Community_Governance_Aftershow_Audience.md`
  的 T-054 约束（新路由、新事件名、SCHEDULED 自动生效、Audience/Aftershow 审计）同步到仓库任务包与实现代码。
