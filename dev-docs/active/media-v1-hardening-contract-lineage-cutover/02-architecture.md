# 02 Architecture

## Original Gaps This Task Closed

- `MediaSemanticSummary` 曾长期以扁平兼容字段为主，调用方直接读取 `public_safe_summary` / `internal_full_summary`，导致 contract 漂移难以收口。
- `MediaProjectionService` 的 prompt serialization 起初只返回浅 audit 信号，没有统一治理决策对象，也没有 fail-closed 入口。
- `ImagePlannerService` 原先直接产出 `prompt_brief` 文本，`MediaGenerationService` 以文本落库并直接发给 provider。
- `MediaWriteBridge`、`MediaAssetService`、`MediaGenerationService` 过去都在写媒体链路，但没有单独的 lineage persistence 层。
- `ForumReadService` 与 owner-facing API 起初保留了 `inclination-asset` / `post_media` 兼容逻辑，后续清理阶段再完全移除旧入口。

## Target Design

### Semantic contract

- 引入规范化 `MediaSemanticSummaryV3` 结构，按 `scene / composition / style / entities / ocr / safety / summaries / confidence` 分段。
- 保留 `normalizeStoredSemanticSummary()` 对历史 `v2` 的兼容解析，但所有新 snapshot 一律写入 `v3`。

### Governance

- 新增统一 `MediaAuditContext` 与 `MediaAuditDecision`。
- projection serialization、planner candidate 使用、generation dispatch 都通过同一 audit evaluator 决定 `allow / redact / block`。
- `block` 时不再继续下游 provider 调用；展示链路只返回空图或 public-safe 摘要。

### Lineage

- 新增 `MediaLineageEdge`，把 `asset / semantic_snapshot / binding / projection / image_plan / generation_job / post_media_attachment` 串成显式图。
- `ImagePlanSource` 持久化强引用 `binding_id / projection_id / asset_id`，禁止再用 source-kind 启发式反推来源。

### Generation

- planner 输出 `MediaGenerationSpec`，compiler 生成 `CompiledMediaPrompt`，gateway 仅消费编译结果。
- `MediaGenerationJob` 保存 spec、compiled prompt、audit decision、provider request summary、error。

### Cutover

- 根帖读侧只认 attachment/projection 视图。
- route / storage / frontend hook 改名到 `media`，owner-facing 与读取链路不再暴露旧 `inclination` 路由别名。

## Risks

- semantic v3 触及 repo 内大量摘要字段读取点，容易引发类型回归。
- generation compiler 改造跨 planner/repo/provider，若 fingerprint 或 status 同步错位会影响 job 去重。
- route rename 会波及前端、测试和 read API；彻底删除旧入口后需要确保调用方、fixture 和验收文档同步更新。
