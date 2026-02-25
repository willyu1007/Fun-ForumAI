# 03 Implementation Notes

## Status
- Current status: `in_progress`
- Last updated: 2026-02-25

## What changed
- 完成 Post/Comment/Room/Message 四类仓储接口 async 化，并将 Pg 实现切到 Prisma 直接读写（DB-first），移除 Pg 仓储中的进程内主读缓存。
- 打通上层 async 调用链：ForumRead/ForumWrite、Chat/ConversationClock/RoomLifecycle、ContextBuilder/DataPlaneWriter/PostScheduler/ProactiveEventHandler、read/data/chat/control-plane/dev-seed 路由。
- 治理链路改造：`GovernanceService` 与 `GovernanceAdapter` 改为 async 持久化流程，避免在 DB-first 下出现未等待写入的语义漂移。
- 回归测试改造：仓储与服务相关测试改为 async 调用，保持既有断言契约。

## Files/modules touched (high level)
- `src/backend/repos/pg/`
- `src/backend/services/`
- `src/backend/runtime/`
- `src/backend/routes/`
- `src/backend/moderation/`
- `src/backend/repos/__tests__/`
- `src/backend/services/__tests__/`
- `src/backend/persistence/sync.ts`
- `dev-docs/active/pg-repository-consistency-hardening/`

## Decisions & tradeoffs
- Decision:
  - 先实现一致性正确，再做性能缓存优化。
  - Rationale:
    - 多实例部署阶段一致性风险高于短期性能收益。
  - Alternatives considered:
    - 保持本地缓存并做跨实例同步（复杂度更高，先不选）。
- Decision:
  - 为保持现有 cursor 契约，第一阶段继续使用“查询后内存分页”的实现方式，而不是立即改成复杂的 DB cursor 条件拼接。
  - Rationale:
    - 优先保证语义兼容和改造稳定性，性能优化放到下一阶段（索引+查询裁剪）。
  - Alternatives considered:
    - 直接改为 DB 级 cursor 查询（一次完成性能优化，但回归面更大）。

## Deviations from plan
- Change:
  - 将“契约冻结 + DB-first 核心改造 + 服务链路 async 化”合并为同一轮实施。
  - Why:
    - 同步接口无法承载 Prisma 直读写，必须一次性完成关键调用链 async 迁移。
  - Impact:
    - 代码变更面扩大，但避免了“仓储层已异步、服务层仍同步”的中间不一致状态。

## Known issues / follow-ups
- 需在 staging 双实例环境执行一致性 smoke（帖子/评论/房间/消息读写 + 重启后视图一致性）。
- 需补充性能基线与慢查询分析，必要时在 Prisma schema 中追加索引并验证收益。
- 全仓 `pnpm typecheck` 当前存在与本任务无关的既有错误（前端与若干 Prisma 模型漂移），本次仅确保改造文件 lint+tests 通过。

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in `05-pitfalls.md` (append-only).
