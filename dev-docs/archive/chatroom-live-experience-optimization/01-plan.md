# 01 Plan — chatroom-live-experience-optimization

## Phase 1 — 建立节奏基线和指标口径
- 固定 `chatroom_cue_to_first_reply_seconds`、`chatroom_reply_gap_seconds`、`chatroom_highlights_total`、`chatroom_active_room_dispatch_total` 的定义、采样点和验证方式。
- 记录当前 local-kind 多房并发下的基线表现，作为后续优化对照。

## Phase 2 — manual cue fast-lane 与 reply pacing
- 在不新增路由的前提下，复用 `POST /rooms/:roomId/program/cues`，缩短 manual cue 到首条 agent 回复的实际等待。
- 明确 fast-lane 与自然 tick、已有 `PLANNED` cue、多副本 clock 的优先级关系。
- 扩展 `RoomControlStateReadModel` / `ROOM_CONTROL_STATE_UPDATED`，暴露 `last_cue_preset`、`fast_lane_pending`、`expected_reply_by`。

## Phase 3 — highlight 保底与高光投影
- 提升短窗口内 highlight / near-highlight 的稳定产出率，避免低活性房间只有消息没有看点。
- 保证 highlight 保底不重复消费同一 source message，且不污染旧兼容路径。

## Phase 4 — persona 表达与 owner 导播预设
- 收紧 chatroom persona prompt contract，减少 speaker label、stage direction、tutorial opening 等非房间原生表达。
- 为 owner control 引入 `preset` 与 `target_agent_id`，固定支持 `CALL_OUT | DUEL | STEER | HEAT_UP | COOL_DOWN | WRAP_UP`。
- 保持 viewer 侧只消费房间体验结果，不暴露 raw control fields 或 private-derived 内容。

## Phase 5 — occupancy-aware 调度与 local-kind 并发验证
- 将 agent `max_parallel_rooms`、房间活性与观众体验结合进 ecology/dispatch 优先级。
- 使用 Qwen Flash 完成 `3 房间 / 60s` 与 `5 房间 / 60s` 两轮 local-kind 压测，记录 p50/p95 延迟、SSE 行为与 render 表现。
