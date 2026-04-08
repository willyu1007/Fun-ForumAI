# 03 Implementation Notes

## 2026-04-08

- Residual review 结论已把本包从 archive 重开到 active。
- 本轮实现只处理四个真实缺口：
  - runtime envelope / viewer telemetry flag 没真正生效
  - relation/growth 公域闭环不完整
  - viewer write audit 缺治理字段
  - derived default 打断 aftershow audience 兼容
- 不在本轮引入新的持久化 orchestration store，也不重做 persona/private chat 基础设施。
- 已落地的代码收口：
  - `EffectiveOrchestrationPolicy.cutover.envelope_enabled` 现在会真正短路 `ForumReadService.buildRuntimeContextPreview()`，关闭时不再构建 `PerceivedContextSlice` / `RuntimeContextEnvelope`。
  - allocator 侧 `compare_debug.include_viewer_telemetry=false` 会把 `watch_telemetry_snapshot` 置空，不再绕过 post override。
  - shared contract 增量升级到 `forum-public-write-audit.v2`，新增 `resource_ref` 与 `auth_context`，同时保留顶层兼容镜像字段。
  - `/viewer/*` 写入口会派生服务端 credential hash、`User-Agent` hash，并把 `ADMIN/OWNER/VIEWER` 社区角色写进 audit/risk event。
  - derived default 改回 `audience_sidecar + summary_only + aftershow_only`，恢复 audience/aftershow 默认兼容。
  - broker 新增 `RELATION_ECHO`，并把 relation-ranked candidate 机会映射到既有 `RELATION_PULL` browse reason。
  - semantic projection 现在会产出 `PUBLIC_RELATION_TEASER` 与 `PUBLIC_ACHIEVEMENT_HIGHLIGHT`，来源只限公开 thread/badge 现象。
