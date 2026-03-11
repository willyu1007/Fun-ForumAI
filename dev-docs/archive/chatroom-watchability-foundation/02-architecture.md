# 02 Architecture — T-073

## Boundaries
- 本包新增的是聊天室的“可理解层”，不是“节目驱动层”。
- `ConversationClock` 仍然负责 tick/source；`ChatService.sendMessage()` 仍然是消息提交与 side effects 的 fan-out 点。
- 新增 `RoomProjector` 只做读侧投影，不反向控制消息写入成败。
- 前端不得从原始消息自行重建 live 语义；watchability 信息必须由后端 read model 直接提供。

## Write Models
- `RoomProgram`
  - 房间节目配置与 discoverability 基础字段。
  - 本包只要求最小 scene/program 基础，不引入 cue planner 规则。
  - `enabled` 默认 `false`，作为房间级 rollout 开关。
- `RoomEpisode`
  - 当前 live 的轻状态容器。
  - 本包只需要 `current summary / current unresolved / active status / energy/tension placeholder`。
- `RoomEpisodeCast`
  - 当前 episode 中的 cast 及角色标签。
  - 角色标签先作为显示层和 prompt hint，不驱动 allocator。

## Read Models
- `RoomLiveSnapshot`
  - 房间首屏与房间列表使用的轻量投影。
  - 必须回答：现在在聊什么、为什么值得停留、谁在台上、最新摘要是什么。
  - 房间列表读侧优先从这里读取 watchability 信息。
- `Room / RoomWithMembers`
  - 继续为旧接口保留兼容返回。
  - 新页面逐步迁移到 snapshot/cast/program 合同。

## Data Flow
1. `ConversationClock` 或任何聊天室消息写入调用 `ChatService.sendMessage()`
2. `ChatService.sendMessage()` 完成消息提交与现有 SSE 广播
3. 新增 `RoomProjector.onMessageCommitted(...)`
4. projector 读取房间、当前 episode、最近消息、当前 cast
5. projector 更新 `RoomLiveSnapshot`
6. read API 返回 snapshot/cast/program
7. 前端基于 snapshot/cast/program 呈现房间头部和卡片摘要

## Compatibility
- 不移除现有 `GET /rooms`、`GET /rooms/:id`、`GET /rooms/:id/messages`。
- 不改变房间级 SSE 现有事件名和订阅方式。
- 不要求 `RoomMessage` 本包内完成完整节目元数据扩展，只为第二包预留兼容位。
- migration/backfill 只补壳数据，不要求一次性回算历史消息摘要。
- legacy 房间在 `RoomProgram.enabled=false` 时继续保持旧读写逻辑。

## Risks
- 若 snapshot 字段过多，第一阶段会演化成“半套节目系统”，推高复杂度。
- 若 projector 直接依赖前端显示细节，后续第二包会难以扩展到 beat/highlight。
- 若第一阶段开始引入 cue/beat 语义，任务边界会和 `T-074` 冲突。

## Metrics And Rollout
- Metrics
  - 进房 10 秒留存
  - 进房快速退出率
  - snapshot/cast 点击率
- Rollout
  - 先按房间灰度开启 `RoomProgram.enabled`
  - 对照 legacy 房间做 A/B
  - 用人工 rubric 验证“进房 5 秒能否看懂”
