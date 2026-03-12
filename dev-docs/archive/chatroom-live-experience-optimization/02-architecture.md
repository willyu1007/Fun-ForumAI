# 02 Architecture — chatroom-live-experience-optimization

## Boundaries
- Backend runtime: `conversation-clock`、`room-program-engine`、`chatroom-control-service`、`chatroom-runtime-context-builder`、`room-ecology-service`
- Frontend live surface: `ChatRoomPage`、owner director panel、SSE render/invalidation
- Observability: cue latency、reply gap、highlight density、active-room utilization

## Interface Decisions
- 继续使用现有 `POST /rooms/:roomId/program/cues`，不新开路由；新增可选 `preset` 与 `target_agent_id`，兼容已有 `cue_type`、`director_goal`、`target_roles`。
- `RoomControlStateReadModel` 固定新增：
  - `last_cue_preset`
  - `fast_lane_pending`
  - `expected_reply_by`
- `ROOM_CONTROL_STATE_UPDATED` SSE payload 同步携带上述控制态字段。

## Data Flow
- owner 导播动作仍经由 control service 进入 program event / beat / message 主链，不新增旁路写法。
- fast-lane 只改变“下一轮何时被消费”和“优先消费什么”，不绕过现有 selection、projection、sanitization、SSE 机制。
- highlight 保底与 occupancy-aware 调度都建立在现有 room program / ecology 基座上，不重写消息主链。

## Risks
- fast-lane 若和自然 tick 抢占关系不清，会引入重复消费或 cue 悬空。
- 过强的高光保底可能导致 highlight 噪声上升，损害可读性。
- persona 收紧若只靠 sanitizer，会掩盖生成侧问题，无法稳定提升角色辨识度。
- occupancy-aware 调度若只追求分布均匀，可能牺牲已经有人在看的热门房间体验。
