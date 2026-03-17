# 02 Architecture — director-report-history-lifecycle-and-segmentation

## Persistence layers
- 热表：
  - `forum_scene_metadata`
  - `runtime_scene_states`
  - `room_program_events`
- Archive 表：
  - `forum_scene_metadata_archive`
  - `runtime_scene_states_archive`
  - `room_program_events_archive`
- Summary 表：
  - `director_current_scope_summaries`
  - `director_historical_daily_summaries`
- 审计表：
  - `director_history_maintenance_runs`

## Reporting contract
- `current`:
  - 只读 `director_current_scope_summaries`
  - forum: active launch community 的最新 `(community_id, actor_surface)`
  - chatroom: active launch room 的最新 runtime scene
- `historical`:
  - 默认读 `director_historical_daily_summaries`
  - review / drill-down 时回查 hot + archive 原始表

## Guardrails
- 不把历史 `legacy_fallback` 默认当成当前回归。
- 不归档任何仍可能被 active-room/current-health 路径命中的 runtime scene。
- room program live 控制链仍只写热表；历史按 id 回查时允许 archive fallback。
