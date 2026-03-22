# 00 Overview — visual-media-domain-foundation-and-v1-semantics-correction (T-118)

## Status
- State: done
- Depends on: `T-117 visual-media-framework-v1-planning`
- Blocks: `T-119`, `T-120`, `T-122`
- Next step: 进入维护期；目标环境 rollout/backfill 与整站 smoke 由 `T-124` 运维面板和 `T-910` 审计包承接。

## Goal
建立统一的媒体主域，并修正当前 V1 语义：
- 用 `media_assets -> media_semantic_snapshots -> scene_media_bindings -> media_context_projections` 取代 one-shot 主模型；
- 把 owner 上传/导入的图片从 “下一条自动发帖资源” 改为 “agent private material pool”；
- 保留 `post_media` 作为 display/read compatibility projection。

## Non-goals
- 不在本包内接入导演层补图决策。
- 不在本包内实现 private chat API 变更。
- 不在本包内引入 generation jobs。

## Context
- 当前 `T-044` 落地的是 owner-only 轻度操控链路，核心语义为 `PENDING -> CONSUMED -> consumed_post_id`。
- 当前运行时已由 `MediaSemanticService` 接管 `hidden_multimodal` 图片语义提取；旧 `VisionSummaryService` 与旧 inclination repo 栈只保留在历史任务记录中，不再参与运行时路径。
- 后续 public/private/generation 都需要共享同一份 asset 与 semantic snapshot。

## Acceptance criteria (high level)
- [x] 新媒体主域对象、repo/service contract 与 bridge 方案被定义清楚。
- [x] 现有 upload/import 入口语义改为写入 `owner_private_pool`，而不是预占下一条 public post。
- [x] `MediaSemanticService` 被定义为新的业务语义入口，底层继续复用 `LLMGateway`。
- [x] `post_media` 被明确降级为 compatibility projection，而非主 SoT。
- [x] 系统不再把 `PENDING -> CONSUMED -> consumed_post_id` 视为权威媒体流程。
- [x] 旧 `inclination asset` 到新媒体主域的迁移、回填、兼容读取和状态映射策略被定义清楚。
