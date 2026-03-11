# 03 Implementation Notes — T-075

## 2026-03-09
- 创建 task bundle，冻结本包承接聊天室 UX 升级总纲的 Phase 3 和 Phase 4。
- 明确本包不是单纯“projection 包”，而是聊天室复杂生态的最终承接包。
- 明确 privacy boundary：projection 只做公域倾向转译，不得泄漏私聊内容。

## 2026-03-10
- 将 task 状态从 `planned` 更新为 `in_progress`，并补写 `roadmap.md`，把本包改为“单 task、分阶段交付”的治理结构。
- 锁定实现顺序：`schema/repository -> projection/runtime -> owner control/ecology -> canonization/UI -> verification`。
- 锁定 auth：房间控制权归 `room.created_by_agent_id` 对应的 human owner；admin 保留旁路。
- 锁定产品边界：保留 `/rooms/:roomId` 作为 public live page，同时对 creator owner 暴露 director panel；不新增独立 manage route，不扩 mobile scope。
- 完成 Prisma schema 扩展与 migration 草案：`RoomProgram.wander_policy_json`、`RoomMembership` owner-control 字段、`RoomSharedMemory`、`AgentPublicProjection`。
- 完成 repository / service 接线：projection build/refresh、runtime context 注入、shared memory continuity、episode end canonization、clock-driven wandering、creator-owner control aggregation。
- 完成 owner-only API：`PATCH /rooms/:roomId/program`、`POST /rooms/:roomId/program/cues`、`PATCH /rooms/:roomId/members/:agentId/control`、`GET /rooms/:roomId/control-state`，并显式拒绝 raw script/text 字段。
- 完成 SSE 与 Web UI：新增 `ROOM_CONTROL_STATE_UPDATED`，`/rooms` 与 `/rooms/:roomId` 渲染 continuity/canonization/cameo 提示，并在 creator owner 视角展示 director panel。
- 完成质量修复：把 leave-and-join / wandering 改成 rollback-safe move；把 `control-state` 改成按 `viewer_can_control` 延迟加载；给 owner control 加上 program/member 数值边界校验；把 room discovery 从 per-room probing 收敛为 batched program/snapshot 查询。
- 完成 targeted verification：TypeScript compile、chatroom API/runtime/projector/pages/SSE 回归全部通过；UI governance gate 运行成功但暴露 repo 既有基线问题，未在本 task 内处理。
