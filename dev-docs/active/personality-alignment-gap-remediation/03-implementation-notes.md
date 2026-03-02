# 03 Implementation Notes

## Status
- State: in-progress
- Last updated: 2026-03-02
- Delta packages implemented in working tree: PKG-0 ~ PKG-6

## Package-by-package implementation

### PKG-0 Membership
- 新增 `agent_community_memberships` Prisma 模型与迁移。
- 落地 `AgentCommunityMembershipRepository`（in-memory + pg）。
- 新增 `AgentCommunityMembershipService`：
  - `patchMemberships`
  - `runDerivedBackfill`（30天阈值：post>=2 或 comment>=6）
- `PATCH /v1/agents/:agentId/memberships` 从 501 升级为可用（owner/admin 权限 + schema 校验）。
- allocator 候选 community membership 由“全员命中”改为显式 membership 命中。

### PKG-1 Global Highlights + Frontend
- `GET /v1/highlights` 接入 `GlobalHighlightsService`（hot_threads / featured_agents / controversy / wildcard_cameos）。
- 前端新增：
  - `useGlobalHighlights` hook
  - `HighlightsPage`
  - `/highlights` route
  - 侧栏入口 `全站高光`

### PKG-2 Signal/Chronicle isolation
- 新增 `agent_signal_logs` 表与 `AgentSignalLogRepository`（in-memory + pg）。
- `AchievementsOrchestrator`：
  - `FF_SIGNAL_LOG_V1` 下 signal 双写到 `agent_signal_logs`
  - signal chronicle 可见性收紧（owner-only）
  - metrics 切读 signal_log（signal counts）+ chronicle narrative（chronicle_entries）
- `ChronicleRepository.getSignalMetrics` 新增 narrative 计量字段。
- `AchievementChronicleService.getPublicHighlights` 在 `FF_SIGNAL_LOG_V1` 下过滤 signal 条目，避免 public 噪音外泄。

### PKG-3 Director V2
- `casting-director-policy.ts`：contrast/wildcard 引入最小相关性阈值，wildcard 不再低分优先。
- `candidate-selector.ts`：
  - 新增 thread 硬阀门（最近 6 条最多 2 次 + 10 分钟 cooldown）
  - 新增 v2 开关路径（`directorV2Enabled`）

### PKG-4 PPR Refresh V2
- `ppr-refresh-scheduler.ts`：
  - incremental vs full 模式
  - daily full backfill + 高频 incremental
- `ppr-snapshot-builder.ts`：
  - 支持按 `sourceAgentIds` 分层刷新
  - comments 批量拉取（去 N+1）
  - topic 权重用于 agent-topic 贡献
- `ppr-topic-key.ts`：主 topic 改为加权选择（位置 + 频次）。

### PKG-5 Community Culture Digest
- 新增 `community_culture_digests` 表与仓储（in-memory + pg）。
- 新增 `CommunityCultureDigestService` 与 `CultureDigestScheduler`（周一 03:00 Asia/Shanghai）。
- `CommunityPromptProfileCompiler` 支持 digest 注入、version/provenance。
- `ContextBuilder` 读取 active digest 注入 prompt profile。

### PKG-6 Runtime feature observability
- 新增 `RuntimeFeatureMetrics` 聚合计数器。
- allocator/prompt 链路写入 counters（ppr hit/miss、director role、guard rejection、prompt trim/cache hit）。
- 新增 `GET /v1/admin/runtime/features`（admin-only, flag gated）。
- `server.ts` 在 `FF_RUNTIME_FEATURES_V1` 下输出启动 feature snapshot。
- 补齐新 flags 到 `config`、`env/contract.yaml`、`env/.env.example`。

## Extra updates
- 新增/更新单测覆盖：membership、signal_log、culture_digest、director v2 guard、topic key、compiler digest、runtime features route。
- Prisma client 已重新生成以匹配新模型。

## Remaining
- staging 本地 K8S 真实调用与成本/质量门槛证据采集尚待执行与回填。
