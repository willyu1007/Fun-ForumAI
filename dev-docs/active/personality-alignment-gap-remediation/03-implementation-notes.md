# 03 Implementation Notes

## Current status
- 状态：in-progress
- Last updated: 2026-03-02

## What changed
- Phase 0:
  - 新增 `ChronicleSignalPolicy`（signal 默认 owner-only + importance/evidence 才可 public）。
  - `collectMetrics` 改为仓储聚合查询 + 缓存（`FF_CHRONICLE_METRICS_CACHE_V1`）。
  - `COMMENT` 点赞 proactive target resolver 补齐并加回归测试。
  - 修复前端创建 agent 的 `model: "default"` 404 问题（前端不再发送该字面值，后端兜底归一化）。
- Phase 1:
  - 新增 Prisma 模型与迁移：`ppr_snapshots`。
  - 新增 `PprSnapshotRepository`（in-memory + pg）。
  - 新增 `SnapshotGraphRelevanceProvider`（allocator 同步读快照，支持 fallback）。
  - 新增 `PprSnapshotBuilder` 与 `PprRefreshScheduler`（`ppr-backfill` + `ppr-refresh`）。
- Phase 2:
  - 新增 `CastingDirectorPolicy`（core/contrast/wildcard 预算分配）。
  - 支持社区级 `rules_json.personality.director_v1` 覆盖。
  - `quota <= 2` 自动回退 legacy top-score。
- Phase 3:
  - 新增 `CommunityPromptProfileCompiler`，编译 `rules_json.personality.prompt_profile_v1`。
  - ContextBuilder 注入 community profile，PromptOrchestrator audit 增加 profile provenance。
- Phase 4:
  - Achievement 30 项语义从 KPI 叙事转向剧情/关系/长期弧线（保持 code 稳定）。
  - public highlights 增加 signal 压缩摘要与高质量过滤。

## Files/modules touched (high level)
- `prisma/schema.prisma`
- `prisma/migrations/20260302134000_add_ppr_snapshots_v1/migration.sql`
- `src/backend/repos/ppr-snapshot-repository.ts`
- `src/backend/repos/pg/pg-ppr-snapshot-repository.ts`
- `src/backend/allocator/{candidate-selector.ts,graph-relevance-provider.ts,casting-director-policy.ts,ppr-topic-key.ts}`
- `src/backend/runtime/{ppr-refresh-scheduler.ts,context-builder.ts,prompt-orchestrator.ts,community-prompt-profile-compiler.ts}`
- `src/backend/services/ppr/ppr-snapshot-builder.ts`
- `src/backend/services/{achievement-chronicle-service.ts,achievements/definitions.ts}`
- `src/backend/container.ts`
- `src/backend/{app.ts,server.ts}`
- `src/backend/lib/config.ts`
- `env/{contract.yaml,.env.example}`

## Decisions & tradeoffs
- Decision: allocator 读路径保持同步，PPR 计算全部放到离线作业，避免 request-time 图计算风险。
- Tradeoff: 首版使用读时聚合 + 缓存（而非写时聚合表），以降低迁移风险并保留快速回退。

## Deviations from plan
- 无功能性偏离；metrics 门槛（top-k / 噪音率 / p95）尚需 staging 回放证据补齐。

## Known issues / follow-ups
- staging 需按 5% -> 25% -> 100% 灰度并观察 24h/档。
- 若 `philosophy/tech/creative` 社区不存在，将记录 warning 并回退默认导演配置。

## Pitfalls / dead ends (do not repeat)
- 详见 `05-pitfalls.md`（append-only）。
