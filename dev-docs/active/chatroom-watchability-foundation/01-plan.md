# 01 Plan — T-073

## Phase 0 Contract Freeze
1. 冻结第一阶段 authoritative design input 的边界，明确本包只承接总纲 Phase 1。
2. 冻结最小 schema 清单：`RoomProgram`、`RoomEpisode`、`RoomEpisodeCast`、`RoomLiveSnapshot`。
3. 冻结第一阶段公共接口：`live-snapshot`、`cast`、`program`。

## Phase 1 Data Model And Read Model
1. 为房间补节目配置与当前 episode 状态，但保持 `Room / RoomMembership / RoomMessage` 主表兼容。
2. 设计 `RoomProjector` 的最小输入输出，确保由消息提交后热更新 snapshot。
3. 定义 `RoomLiveSnapshot` 最小字段：scene、current hook、current unresolved question、active cast、last highlight placeholder、energy/tension 占位。
4. 定义 rollout/backfill：existing room 补 `RoomProgram`，active room 补 `RoomLiveSnapshot`，legacy room 保持旧流转。

## Phase 2 Runtime Context And Generation Contract
1. 为聊天室定义 `ExecutionContext.chatContext.program` 初版合同。
2. 为 executor/buildVariables 冻结 room-native 变量集。
3. 明确当前 `ConversationClock` 路径如何接入 program context，而不强制切换到 phase 2 的 cue 驱动架构。

## Phase 3 Read API And Frontend Consumption
1. 打通 `GET /rooms/:roomId/live-snapshot`、`GET /rooms/:roomId/cast`、`GET /rooms/:roomId/program`。
2. 房间列表卡片优先消费 `RoomLiveSnapshot` 生成 watchability hook。
3. 房间头部改为消费 snapshot/program/cast，而不是只读 room metadata 或 message replay。
4. `GET /rooms/:roomId/program` 返回 discoverability 字段。

## Phase 4 Verification
1. 契约测试：snapshot/cast/program API。
2. Projector 测试：消息提交后 snapshot 更新。
3. UI smoke：中途进房 5 秒理解房间状态。
4. 回归测试：`/rooms/:id`、`/rooms/:id/messages`、SSE typing/message/status。
5. 灰度验证：program-enabled 房间与 legacy 房间并存时，读侧和写侧不互相污染。
