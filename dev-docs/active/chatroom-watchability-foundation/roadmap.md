# Chatroom Watchability Foundation — Roadmap

## Goal
- 将聊天室从“滚动消息流”升级为“中途进房也能快速理解”的 live 房间。

## Frozen decisions
- 本包对应聊天室 UX 升级总纲 Phase 1，只覆盖“先让聊天室看得懂”。
- 保留现有 `ConversationClock -> ChatService.sendMessage()` 主链路，不在本包引入 `ProgramCueCreated` 或 `RoomCuePlanner`。
- 第一阶段以后端底座优先：先补 schema、projector、read model、read API、room-native context/template，再让前端消费新接口。
- 外部目录 4 份文档均作为 authoritative design input，本包只消费其中与第一阶段直接相关的部分。

## Scope
- `prisma/schema.prisma`
- `src/backend/services/chat-service.ts`
- `src/backend/services/conversation-clock.ts`
- `src/backend/routes/chat-api.ts`
- `src/backend/repos/**`
- `src/backend/runtime/**`
- `src/frontend/features/chat/**`
- `src/frontend/api/hooks/chat.ts`

## Deliverables
- `RoomProgram`、`RoomEpisode`、`RoomEpisodeCast`、最小 `RoomLiveSnapshot` 合同与持久化设计。
- 房间消息写后轻量 `RoomProjector`。
- `ExecutionContext.chatContext.program` 初版合同。
- room-native template / variables 冻结方案。
- `GET /rooms/:roomId/live-snapshot`
- `GET /rooms/:roomId/cast`
- `GET /rooms/:roomId/program`
- 房间列表卡片与房间头部消费新读模型的 UI 约束。

## Rollout And Migration
- `RoomProgram.enabled` 是房间级 feature flag，默认 `false`。
- migration/backfill 规则：
  - 为现有 room 创建 `RoomProgram` 空壳记录。
  - 为活跃 room 创建 `RoomLiveSnapshot` 空壳记录。
  - 未启用 program 的房间继续走 legacy chat flow。
- 房间列表读侧优先使用 `RoomLiveSnapshot`，不继续直接拼 `Room` 字段做 watchability 文案。
- `GET /rooms/:roomId/program` 必须返回 discoverability 相关字段，而不是只返回 scene 名称。

## Out of scope
- `ProgramCueCreated`
- `RoomCuePlanner`
- `RoomEpisodeBeat`
- `RoomProgramEvent`
- `RoomHighlight`
- `PublicPersonaProjection`
- complex wandering / cross-room / canonization

## Acceptance criteria
- 新用户中途进入聊天室时，首屏 5 秒内能理解“当前在发生什么”。
- 房间头部可展示一句话 `live hook`、当前 cast、scene/program 基本信息。
- 聊天室不再只是消息流，至少具备 snapshot、cast、program 三类读侧能力。
- 现有 `/rooms/:id`、`/rooms/:id/messages`、SSE 房间推送与 `ConversationClock` 行为保持兼容。
- room list card 直接消费 snapshot hook，而不是依赖 message replay 或 room.description 拼装。

## Metrics And Rollout
- Metrics
  - 进房 10 秒留存
  - 进房快速退出率
  - snapshot/cast 点击率
- Rollout
  - 分房灰度：先对少量房间开启 `RoomProgram.enabled`
  - A/B：对比 legacy 房间与 snapshot-ready 房间的停留和退出行为
  - 人工节目评审：进入房间后 5 秒是否能说清当前局面和当前角色分工
