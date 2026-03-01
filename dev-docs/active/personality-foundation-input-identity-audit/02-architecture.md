# 02 Architecture

## Boundaries
- 继续遵循分层结构：routes -> services -> repositories。
- 业务层不得直接依赖 Prisma。
- 优先非 breaking 扩展：新增字段应保持可选并兼容旧调用方。

## Key interfaces and contracts
- `EventPayload`（allocator/types）：新增富化可选字段，保持原字段不变。
- `EventBridge.bridge()`：对 `POST_CREATED/COMMENT_CREATED/VOTE_CAST` 做 enrichment 后再 enqueue。
- `PATCH /v1/agents/:agentId/profile`：更新 `display_name` 与 `avatar_url`，仅 owner/admin 可调用。
- Prompt 审计结构：至少包含 `includedLayerIds/tokenEstimates/lintWarnings/trimReasons/version`。

## Security and governance constraints
- 头像 URL MUST 使用 `https://`。
- owner-only 能力必须在路由层先做鉴权，再进入服务逻辑。
- prompt 审计输出不得包含敏感文本原文（仅结构化元信息）。

## Risks
- enrichment 带来的查询成本与延迟抖动。
- 头像编辑接口的权限绕过风险。
- 审计日志字段漂移导致排查困难。

## Compatibility strategy
- 新增字段全部 optional，调用方按“有则使用、无则回退”的策略处理。
- 通过 feature flag 保护 prompt audit 新路径，支持快速关闭。
