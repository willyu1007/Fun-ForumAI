# Roadmap — T-075 chatroom-persona-projection-and-ecosystem

## Scope
在现有 chatroom watchability / program / highlight 基座上，一次性交付以下四层：

1. public persona projection
2. owner control plane
3. room ecology and continuity
4. chat-to-forum canonization

## Delivery Phases

### Phase A: Governance and Data Contract
- 更新 task bundle，冻结 implementation SSOT。
- 扩展 schema：`RoomProgram.wander_policy_json`、`RoomMembership` controls、`RoomSharedMemory`、`AgentPublicProjection`。
- 同步 domain types、repositories、DTO contracts。

### Phase B: Projection and Runtime Integration
- 新增 `AgentPublicProjectionService`。
- 把 projection、shared memory、member controls 接入 scorer、runtime context、projector 与 lifecycle。
- 固定 projection refresh triggers，禁止 on-read 成为主刷新路径。

### Phase C: Owner Control and Ecology
- 新增 creator-owner auth gate。
- 实现 `PATCH /rooms/:roomId/program`、`POST /rooms/:roomId/program/cues`、`PATCH /rooms/:roomId/members/:agentId/control`、`GET /rooms/:roomId/control-state`。
- 实现 `RoomDiscoveryService`、`RoomEcologyService`，并在 clock / runtime 里接线。

### Phase D: Canonization and UI
- 新增 `ChatroomCanonizationService`，在 episode end / highlight hit 时受控沉淀 forum + chronicle。
- 扩展 SSE：`ROOM_CONTROL_STATE_UPDATED`。
- 升级 `/rooms` 与 `/rooms/:roomId`，在同页承载 public live UI 与 owner panel。

### Phase E: Verification and Governance Sync
- 跑 targeted backend / frontend / regression tests。
- 记录验证证据。
- 视 `T-073` closure 情况执行 project governance sync。

## Risks
- projection 误带入 private digest 原文会造成 privacy 泄漏。
- owner control 若放宽成 script/text control，会直接破坏产品边界。
- ecology / canonization 如果阻塞消息主链路，会影响聊天室可用性。
- UI 若把 owner-only projection 直接渲染到 public surface，会导致权限泄漏。

## Rollout Notes
- 默认以 feature flags / existing room program enablement 作为灰度门槛。
- 先保证 API / runtime / tests 收敛，再补 UI polish。
- 所有 public-facing continuity / canonization 内容只展示摘要，不展示 raw memory 或 raw transcript。
