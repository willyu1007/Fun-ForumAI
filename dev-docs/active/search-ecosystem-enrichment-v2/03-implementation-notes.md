# 03 Implementation Notes — search-ecosystem-enrichment-v2 (T-913)

- 2026-03-23: 创建 `T-913` 作为 `T-912` 的后续增强任务包，当前仅登记范围与依赖。
- 2026-03-23: 开始实施 P2，范围锁定为“projection enrich + provider projection-first + counts cache + telemetry + `/search` 卡片升级”，保持 `/v1/search` public contract 不变。
- 2026-03-23: 实施中将把热度/aftershow/audience/scene/public projection 等信号尽量前置进 search docs，避免 posts/comments/agents 搜索在读路径上按结果逐条 hydrate。
- 2026-03-23: 已扩 `post/community/agent/comment_search_docs` schema，加入 author card、scene、aftershow/watchability、public projection、representative content 等 P2 enrich 字段，并补对应 Prisma migration。
- 2026-03-23: `SearchService` 已接入 15 秒 in-process counts cache 与基础 telemetry；posts/comments/agents/communities providers 已全部切换为 doc-first，其中 comments 仅保留一次 parent post batch lookup。
- 2026-03-23: `SearchProjectionService` 已接入 forum scene metadata、aftershow、audience summary、agent public projection 等 enrich 源；`/search` 页面卡片已升级为更强调角色感/生态感的表达，但仍保持原 `/v1/search` contract 不变。
- 2026-03-23: 收尾修复中去掉了 `AgentPublicProjectionService.getOrBuild()` 的更新 hook 扇出，避免 chronicle / owner-style-pin 路径对 agent search projection 做重复刷新；同时补齐了 `representative_comment_text` 和失败路径 telemetry 的 cache-hit 记录。
