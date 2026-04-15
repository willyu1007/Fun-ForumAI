# 04 Verification

## Automated checks

- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`

## Manual checks

- 确认新 task bundle 路径为 `dev-docs/active/media-injection-catalog-and-retrieval-v1/`。
- 确认 `.ai-task.yaml` 中 `task_id=T-973`、`slug` 与目录名一致。
- 确认 project registry 已新增：
  - `R-087 Media Injection Scaffold and Semantic Retrieval Index`
  - `T-973 media-injection-catalog-and-retrieval-v1`
- 确认 roadmap 已覆盖：
  - SoT boundary
  - injection scaffold
  - catalog/retrieval split
  - duplicate suppression
  - DashScope + pgvector
  - future video boundary
- 2026-04-15 17:30 CST:
  - 确认 `00-overview.md`、`roadmap.md`、`02-architecture.md`、`03-implementation-notes.md`、`05-pitfalls.md` 对 `MediaRetrievalDocument 1 -> N MediaEmbeddingSnapshot` 的表述一致。
  - 确认不存在“retrieval doc 与 embedding snapshot 一对一”或“vector 写回 retrieval doc”这类残留描述。
- 2026-04-15 17:34 CST:
  - 确认 `00-overview.md`、`roadmap.md`、`02-architecture.md`、`03-implementation-notes.md`、`05-pitfalls.md` 对 generated asset 的可检索化时机表述一致。
  - 确认不存在“generated asset 首次 retrieval doc 完全依赖异步 backfill”这类未决表述残留。
- 2026-04-15 17:35 CST:
  - 确认 `00-overview.md`、`roadmap.md`、`02-architecture.md`、`03-implementation-notes.md`、`05-pitfalls.md` 对 duplicate cluster canonical 策略表述一致。
  - 确认未决项列表中已移除 duplicate canonical 策略，只剩 staging 清理策略与 TTL。
- 2026-04-15 17:37 CST:
  - 确认 `00-overview.md`、`roadmap.md`、`02-architecture.md`、`03-implementation-notes.md`、`05-pitfalls.md` 对 staging cleanup / TTL 表述一致。
  - 确认 `03-implementation-notes.md` 的设计阻塞项已清空，当前 bundle 可直接进入实现设计。
- 2026-04-15 17:44 CST:
  - 确认 `02-architecture.md` 已包含 Prisma schema V1 的模型、关系、索引和 `pgvector` custom migration 策略。
  - 确认 `00-overview.md`、`roadmap.md`、`03-implementation-notes.md`、`05-pitfalls.md` 已同步到 Prisma schema 与 `Unsupported("vector")` 的约束表述。
- 2026-04-15 17:52 CST:
  - 确认 `02-architecture.md` 已包含 repository contract V1，包括 `MediaAssetRepository` 扩展、新增 repositories、query DTO、claim/patch 输入和实现文件布局。
  - 确认 `MediaSourceKind` 与 `VisualSourceKind` 的 repository contract 边界已经在 bundle 文档中显式区分。
- 2026-04-15 17:56 CST:
  - 确认 `02-architecture.md` 已包含 service interface / orchestration contract V1，包括 `MediaInjectionService`、`MediaInjectionWorker`、`MediaCatalogService`、`MediaRetrievalService`、`MediaEmbeddingService`、`MediaDuplicateService` 与 `MediaEmbeddingGateway`。
  - 确认错误边界、事务边界和 gateway 责任边界已经在文档中显式收敛。

## Results

- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - 结果：通过。
  - 变更：
    - `.ai/project/main/dashboard.md`
    - `.ai/project/main/feature-map.md`
    - `.ai/project/main/task-index.md`
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - 结果：通过。
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`（2026-04-15 17:38 CST）
  - 结果：通过。
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`（2026-04-15 17:38 CST）
  - 结果：通过。
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`（2026-04-15 17:44 CST）
  - 结果：通过。
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`（2026-04-15 17:44 CST）
  - 结果：通过。
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`（2026-04-15 17:52 CST）
  - 结果：通过。
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`（2026-04-15 17:52 CST）
  - 结果：通过。
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`（2026-04-15 17:56 CST）
  - 结果：通过。
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`（2026-04-15 17:56 CST）
  - 结果：通过。
- 文档一致性检查（2026-04-15 17:30 CST）
  - 结果：通过。
  - 说明：retrieval plane 已冻结为“逻辑文档 + append-only 一对多 embedding 快照”，active snapshot 规则已在 bundle 关键文档中同步。
- 文档一致性检查（2026-04-15 17:34 CST）
  - 结果：通过。
  - 说明：generated asset 的可检索化时机已冻结为“同步最小 text-derived doc + 异步 embedding/backfill 补强”。
- 文档一致性检查（2026-04-15 17:35 CST）
  - 结果：通过。
  - 说明：duplicate cluster canonical 策略已冻结为“exact duplicate 复用同一 asset；near duplicate 保留多 asset，但只索引 canonical asset/doc”。
- 文档一致性检查（2026-04-15 17:37 CST）
  - 结果：通过。
  - 说明：staging cleanup / TTL 已冻结为“staging input 短保留、artifact 中保留、canonical media 不参与 staging TTL”，bundle 已无剩余设计阻塞项。
- 文档一致性检查（2026-04-15 17:44 CST）
  - 结果：通过。
  - 说明：Prisma schema V1 已冻结为明确的新表、扩展字段、索引和 `pgvector` custom migration 策略，可进入 migration 设计。
- 文档一致性检查（2026-04-15 17:52 CST）
  - 结果：通过。
  - 说明：repository contract V1 已冻结为明确的 interface/query DTO/claim-patch 设计，并与现有 repo 风格保持一致。
- 文档一致性检查（2026-04-15 17:56 CST）
  - 结果：通过。
  - 说明：service interface / orchestration contract V1 已冻结为明确的 deps、方法签名、错误边界和事务边界，可进入具体接口与代码实现。
