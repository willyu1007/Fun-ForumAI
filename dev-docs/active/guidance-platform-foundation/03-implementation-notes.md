# 03 Implementation Notes

## Current status
- 状态：in-progress
- 说明：foundation 已落 schema / repo / service / route / hook wiring，当前剩余工作主要是补更多回归验证与 recall 子包交接。

## Ready checklist
- [x] 母包 `T-077` 治理与依赖规则已冻结
- [x] `summary.modules[]` 契约在 architecture 中锁定
- [x] 完整事件接入矩阵与 event naming 已冻结
- [x] `guidance-copy-service` 的 reason -> copy contract 已冻结
- [ ] feature flags 命名与默认值写入实现清单
- [x] `source_session_id` 增补点已记录到 API 范围

## 2026-03-10 implementation log
- 新增 `guidance_actor_states`、`guidance_inbox`、`guidance_event_log` schema 与 migration。
- 新增 in-memory / pg guidance repos，并接入 container repository graph。
- 新增 `src/backend/guidance/` 模块，冻结 `DUAL_ENTRY`、`CHECKLIST`、`CARD`、`RECEIPT` 四类 summary module。
- 实现 `GuidanceCopyService`、`GuidanceStateService`、`GuidanceOrchestrator`、SSE `GUIDANCE_UPDATED` delivery。
- 新增 `/v1/guidance/summary`、`/v1/guidance/inbox`、`/v1/guidance/client-events`、`/v1/guidance/items/:id/action`。
- `read-api`、`agent-control`、`agent-social`、`agent-chronicle`、`private-channel` 成功分支已接 guidance event ingestion。
- `forumWriteService` fan-out 已追加 owner/follower public event；private digest hook 已通过 `appendDigestHook()` 与现有 achievements 路径组合。
- `GET /v1/agents/:agentId/memories` 已支持 `source_session_id` 过滤。
- `GUIDANCE_UPDATED` 已从全局广播改为 actor-scoped SSE，避免跨用户 guidance refetch 与 actor 标识泄漏。
- `GuidanceOrchestrator.ingestEvent()` 已收紧为仅在 summary/inbox 真变化时推送 `GUIDANCE_UPDATED`。
- `handleForumEvent()` 已增加公开可见性门槛，只为 `APPROVED` 且可公开读取的内容创建 owner/follower payoff item。
- 补充了 orchestrator fan-out 可见性测试与 SSE actor-scope hub 测试，锁住本轮质量回收。
- 既有 `pnpm typecheck` 阻塞项已清空：Prisma JSON 输入统一显式收敛到 `InputJsonValue`，room projector/scorer 代码与测试夹具已补齐 `wander_policy_json`、`RoomCastMemberView` 新字段和 `scene_type`。
- `conversation-clock` 测试已改为显式 harness 类型访问私有流程，避免 `vi.spyOn(... as never)` 导致的 `mockResolvedValue` 推断失败。
- 编译后生成的 `node_modules/.tmp/*.tsbuildinfo` 已纳入收尾清理，避免把本地产物留在 worktree。

## Handoff notes
- 启动实现时，先补 schema / repo skeleton，再补 API / hook wiring，避免先写 Web 反向定义后端契约。
- 事件接入必须优先补 read/control/private-channel/client-event 的成功分支，再接 forum fan-out 与 digest hook，避免 checklist 无法推进。
- `guidance-copy-service` 必须和 canonical guidance item 同时设计，不能等 bell / proactive 再补。
