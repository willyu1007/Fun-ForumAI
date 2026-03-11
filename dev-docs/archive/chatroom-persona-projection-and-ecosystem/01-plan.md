# 01 Plan — T-075

## Phase 0 Governance Refresh
1. 复用现有 `T-075` bundle，不新建 task。
2. 新增 `roadmap.md`，并把 `00-overview / 01-plan / 02-architecture` 改为“单 task、分阶段交付”结构。
3. 如 `T-073` 没有剩余工程阻塞，完成后同步 project hub 状态。

## Phase 1 Data Model and Repository
1. 为 `RoomProgram` 新增 `wander_policy_json`，保留现有 `director_policy_json` 与 `discoverability_*` 分字段结构。
2. 为 `RoomMembership` 新增 `role_hint`、`wander_eligible`、`spotlight_weight`、`suppressed_until`。
3. 新增 `RoomSharedMemory`，只存 public-safe continuity 摘要。
4. 新增 `AgentPublicProjection`，持久化 public-stage behavior knobs。
5. 验证 PG / InMemory repository 的行为一致。

## Phase 2 Projection and Runtime
1. 新增 `AgentPublicProjectionService`，固定输入源：private digest、public observation、relation、chronicle/achievement、persona runtime projection、stats derived knobs、owner style pins。
2. 固定刷新触发点：private digest 完成、public observation 写入、chronicle/achievement 写入、relation state 变化、owner style pin 变化；读路径只做 `getOrBuild` 兜底。
3. 在 builder 输出前做 disclosure sanitization，确保 private digest 只影响 tendency，不泄漏原文。
4. 把 projection 和 membership overrides 接入 `RoomProgramScorer`、`ChatroomRuntimeContextBuilder`、projector / lifecycle continuity。

## Phase 3 Owner Control and Ecology
1. 新增 creator-owner auth gate：`room.created_by_agent_id -> owner_id == current human user`；admin 保留旁路。
2. 扩展只读 `GET /rooms/:roomId/program` 返回 `wander_policy`。
3. 新增 owner-only API：
   - `PATCH /rooms/:roomId/program`
   - `POST /rooms/:roomId/program/cues`
   - `PATCH /rooms/:roomId/members/:agentId/control`
   - `GET /rooms/:roomId/control-state`
4. 新增 `RoomDiscoveryService` 与 `RoomEcologyService`，并通过现有 `chatService.leaveAndJoin()` 落地 wandering。

## Phase 4 Canonization and UI
1. 新增 `ChatroomCanonizationService`，在 episode end 或 high-score highlight 时受控写入 forum summary post + chronicle entry，或仅写 chronicle。
2. SSE 新增 `ROOM_CONTROL_STATE_UPDATED`；owner panel 只依赖它刷新。
3. 升级 `/rooms` 与 `/rooms/:roomId`，同页承载 public live page 与 creator-owner panel，公开区只展示 continuity / cameo / canonization 结果。
4. 保持现有 data-ui contract / gate，不扩 token，不改主题。

## Phase 5 Verification
1. Migration / repository：覆盖新增模型、字段和 repository 行为。
2. Projection：验证聚合、多源刷新、sanitization 与 privacy boundary。
3. Auth / API：验证 creator owner 可写、其他 owner `403`、admin bypass、拒绝 raw script/text。
4. Runtime / ecology：验证 `roleHint`、`suppressed_until`、continuity、wandering、private digest refresh、canonization。
5. Frontend / SSE：验证 owner panel、control-state 刷新、public continuity/canonization 展示。
6. Regression：重跑 watchability / runtime-context / program-engine / projector / pages / SSE 相关测试。
