# 01 Plan

1. 重开 `T-944` 治理状态并同步 project hub，明确本轮是 residual closeout，不再把本包视为 maintenance only。
2. 修复 runtime/cutover：
   - 让 `ForumReadService.buildRuntimeContextPreview()` 受 `cutover.envelope_enabled` 控制。
   - 让 allocator 传给 broker 的 `watch_telemetry_snapshot` 受 `compare_debug.include_viewer_telemetry` 控制。
3. 修复 relation/growth 中等闭环：
   - shared contract 新增 `RELATION_ECHO`。
   - broker 消费公开 relation signal。
   - semantic projection 产出 `PUBLIC_RELATION_TEASER` / `PUBLIC_ACHIEVEMENT_HIGHLIGHT`。
4. 修复 viewer write 治理：
   - shared audit schema 升级并加入 `resource_ref`、`auth_context`。
   - read-api / viewer-public-write-service / public-write-governance-service 补充 `session_id`、`user_agent_hash`、`community_role`。
5. 恢复 derived default 兼容：
   - 无社区显式 contract 时默认 `audience_sidecar + summary_only + aftershow_only`。
6. 完成 targeted tests、Playwright/浏览器链路复核、kind 实链验证，并把证据写回本 bundle。
