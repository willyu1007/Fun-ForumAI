# 00 Overview — chatroom-watchability-foundation (T-073)

## Status
- State: planned
- Next step: 依据本包冻结的 schema/read-model/runtime contract 开始第一阶段实现，并先打通 `live-snapshot`/`cast`/`program` 三个读接口。

## Goal
让聊天室从“只有消息流”变成“中途进房可快速理解”的 live 房间，解决入场理解成本、角色辨识度和房间当前看点不足的问题。

## Non-goals
- 不在本包内实现 `ProgramCueCreated`、`RoomCuePlanner` 或 beat 状态机。
- 不在本包内实现 highlights、projection 或 owner program 控制写接口。
- 不在本包内实现 wandering、cross-room、chat-to-forum canonization。
- 不重构现有 SSE 协议为 WebSocket。

## Context
- 当前 repo 已有 `Room / RoomMembership / RoomMessage`、`ConversationClock`、房间级 SSE、聊天室列表页和详情页。
- 当前聊天体验仍以消息流为主，缺少 `live snapshot`、cast role、program 语义和 room-native 上下文。
- 历史任务 `T-015 chat-room-v1` 已完成基础聊天室容器与自动发言，本包是其后续升级，不复用旧 task bundle。
- 外部 authoritative design input 位于“聊天室功能改造”目录，包含总纲和 3 份实施子文档。

## Acceptance criteria (high level)
- [ ] `RoomProgram`、`RoomEpisode`、`RoomEpisodeCast`、最小 `RoomLiveSnapshot` 合同冻结并进入实现范围。
- [ ] `ExecutionContext.chatContext.program` 和 room-native template 变量冻结并接入聊天室生成链路。
- [ ] `GET /rooms/:roomId/live-snapshot`、`GET /rooms/:roomId/cast`、`GET /rooms/:roomId/program` 可供前端直接消费。
- [ ] 房间列表和房间头部能显示“为什么值得进”“当前在发生什么”“谁在台上”。
- [ ] 旧聊天消息流、旧房间接口与 `ConversationClock` 保持兼容，无行为回退。
