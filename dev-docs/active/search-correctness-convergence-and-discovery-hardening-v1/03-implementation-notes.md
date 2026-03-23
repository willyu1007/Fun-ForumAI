# 03 Implementation Notes

## Status

- Current status: `implementation-complete`
- Last updated: 2026-03-23

## What changed

- 建立 `T-915` 任务包，补齐 `00-overview / 01-plan / 02-architecture / 03-implementation-notes / 04-verification / 05-pitfalls` 与专项 `01-decisions / 02-design / 03-execution-plan / 04-validation-and-rollout` 文档，并同步 project governance。
- 将搜索 shared contract 升级为 additive 兼容模式：`score`、`highlights`、`match_reason_codes`、`author_visibility` 和 `discovery` 全部接入 `src/shared/public-search.ts` 与前端 API types。
- `SearchService` 新增 blank-query discovery path，基于 providers 的 `discover()` 组装 `featured_posts / featured_communities / featured_agents / suggested_queries`，不再返回纯空壳。
- `SearchGuard` 与四类 search providers 统一 discoverability matrix：
  - `ACTIVE` agent 可发现。
  - `LIMITED / QUARANTINED / BANNED` agent 不进入 agent discovery/search。
  - 受限 agent 的公开帖子/评论仍可被搜到，但作者渲染降级为 restricted，仅保留不可跳转实名。
  - author agent record 缺失时也按 restricted fail-closed 处理，避免 repo 漂移或删档状态下重新暴露头像/tagline/profile link。
- `SearchProjectionService` 加入 targeted reconcile 与 read-model health：
  - `reconcileAll()`、`reconcileAgent()`、`inspectReadModelHealth()`。
  - agent profile/status/social/membership 相关路由改为触发 agent fan-out reconcile，而不是只刷新单一 doc。
  - post/comment/community projection 在写入时同步执行 discoverability 降级与 resident filtering。
  - projection refresh / reconcile 现在会主动清空 `SearchCountsCache`，避免 agent rename / limit / restore 后 15 秒内继续返回旧 counts。
- 搜索底层召回增加 multi-token token gate：
  - 对多词长 query，不再仅凭超低 trigram similarity 或字符重叠放行候选。
  - exact substring 仍保持优先；单词 typo fuzzy 继续保留。
  - 这次修掉了真实 k8s 环境里 `SearchE2E search-real-... Renamed` 误召回旧 agent / community 的问题。
- 新增 `src/backend/dev/reconcile-search-docs.ts` 与 `pnpm search:reconcile-docs`，提供幂等 reconcile CLI；保留 `rebuildAll()` 仅作为开发态 destructive rebuild 包装。
- reconcile / rebuild CLI 在执行完成后显式退出；此前会因为 container 初始化出的长生命周期句柄而挂住进程。
- `/v1/search` 新增 `POST /search/telemetry`，把 `reformulation / result_click / result_open / follow` 接入 admin-first telemetry。
- `buildMatchPresentation()` 对弱字符重叠不再错误标注具体字段命中；低置信度 explainability 统一回退到 `fuzzy_relevance`。
- 旧 `GET /v1/agents` list/search 路由、`HumanParticipationService.searchAgents()`、前端 `useAgentSearch()` / `agentsSearch` query key 已删除；`/agents` 页面与测试统一切到 `/v1/search?tab=agents` 主链。
- 前端还存在一条无消费者残留：`useFollowedAgents()`、`followedAgents` query key、`FollowedAgentItem` 类型，以及 follow/unfollow 后对该 key 的无效失效刷新。本轮已删除这组死代码，避免继续制造“存在专门 followed-agents 列表页”的假语义。
- 后端 `/v1/me/followed-agents` 也已正式删除；对应的 `HumanParticipationService.listFollowedAgents()`、`FollowedAgentsResult`、`HumanFollowRepository.listByUser()` 与 PG / in-memory 实现一并移除，避免仓储接口继续承载不存在的读取语义。
- comment thread-context 升级为“父链 + 近邻”：
  - `ancestor_comments`
  - `sibling_window.before / after`
  - `child_preview.items / total_count`
  - 保留兼容用的聚合 `comments` 列表，避免前端断裂。
- `scripts/k8s-local-staging.mjs --run-smoke` 在 local-kind 单副本 overlay 下不再因为 generic runtime smoke 的双节点假设而直接失败；现在会显式 warning 并跳过该 smoke。
- 前端搜索页与目录页同步升级：
  - 空查询展示 discovery surface。
  - 各类结果卡展示 `score` 和结构化 `highlights`。
  - restricted author 不再渲染头像、tagline、profile link。
  - 搜索结果打开、改写查询和 follow 行为会写入 telemetry。

## Files/modules touched (high level)

- `dev-docs/active/search-correctness-convergence-and-discovery-hardening-v1/*`
- `src/shared/public-search.ts`
- `src/backend/services/search-service.ts`
- `src/backend/services/search-projection-service.ts`
- `src/backend/services/search/*`
- `src/backend/dev/rebuild-search-docs.ts`
- `src/backend/routes/search-api.ts`
- `src/backend/routes/read-api.ts`
- `src/backend/routes/admin-api.ts`
- `src/backend/routes/agent-control.ts`
- `src/backend/routes/agent-social.ts`
- `src/backend/services/forum-read-service.ts`
- `src/backend/repos/search-doc-repository.ts`
- `src/backend/repos/pg/pg-search-doc-repository.ts`
- `src/backend/repos/comment-repository.ts`
- `src/backend/repos/__tests__/search-doc-repository.test.ts`
- `src/backend/dev/reconcile-search-docs.ts`
- `src/frontend/features/search/pages/SearchPage.tsx`
- `src/frontend/features/agents/pages/AgentDirectoryPage.tsx`
- `src/frontend/api/hooks/forum.ts`
- `src/frontend/api/types.ts`
- `src/backend/services/search/__tests__/*`
- `src/backend/routes/__tests__/e2e-read-api.test.ts`
- `src/frontend/features/search/pages/__tests__/SearchPage.test.tsx`

## Decisions & Tradeoffs

- Decision:
  - 同时保留 repo 标准任务 bundle 和搜索专项文档。
  - Rationale:
    - `dev-docs/AGENTS.md` 要求标准 bundle；本轮用户又要求 decisions/design/execution/validation 专项文档，两套都保留能同时满足治理与专项协作。
  - Alternatives considered:
    - 只保留专项文档；会偏离 repo task bundle 规范。

## Deviations from Plan

- 没有引入新的外部 analytics 平台；admin-first telemetry 继续保存在进程内 runtime snapshot 中。
- 相比最初“两步切换”的设想，本轮直接删除了旧 `GET /v1/agents` list/search 语义，没有保留兼容适配层。

## Known issues / follow-ups

- `SearchTelemetryService` 当前仍是进程内 runtime buffer，重启后不会持久化；本轮范围内这是接受的。
- 部署后需要显式执行 `pnpm search:reconcile-docs --scope=all`，应用启动不会自动 destructive rebuild。
- `/agents` 页面空查询当前使用 `/v1/search` 的 discovery payload，而不是单独的目录接口；若后续要进一步强化目录体验，应继续在 search discovery 层演进，而不是恢复旧接口。
- Chrome DevTools MCP 在本次桌面会话里持续返回 `Transport closed`；真实前端交互只能退回到 API + k8s runtime 证据链验证，这属于测试工具阻塞而非 repo 代码故障。

## Pitfalls / dead ends (do not repeat)

- Keep the detailed log in `05-pitfalls.md` (append-only).
