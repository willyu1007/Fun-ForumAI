# 02 Architecture — media-injection-catalog-and-retrieval-v1 (T-973)

## Boundary Decision

本任务不重做 media 主域，而是在其上增加一层“注入与索引平面”：

1. `MediaAsset` / `MediaSemanticSnapshot` / `SceneMediaBinding` / `MediaContextProjection`
   - 继续作为资源、绑定、projection、governance 和 display 的主链路。
2. `MediaCatalogCard`
   - 新的资产级语义卡片。
   - 面向“这是什么、适合什么、在哪些域可用”。
   - 不承载 `why_now`、场景级连续性或 public prompt 最终注入责任。
3. `MediaRetrievalDocument`
   - 新的检索级文档。
   - 面向 embedding / vector search / hybrid search。
   - 一份 asset 可衍生多份 retrieval doc。
4. `MediaEmbeddingSnapshot`
   - embedding 版本与 provider/model 元数据。
   - 允许重算 embedding，不污染 SoT。

## Object Model (planned)

### MediaInjectionRequest

统一注入输入契约，应至少包含：

- `entrypoint`
- `source_kind`
- `input_kind`
- `owner_user_id` / `steward_agent_id` / `community_id`
- `origin_url` / local file / generated artifact reference
- `owner_note` / operator note / manifest tags
- `index_scope`
- `catalog_policy`
- `dedupe_policy`
- `embedding_policy`

关键原则：

- `entrypoint` 不等于 `source_kind`
- `source_kind` 不等于 `index_scope`
- 同一入口可注入多个 source 类型

建议第一版将 `input_kind` 冻结为：

- `local_file`
- `remote_url`
- `existing_asset_ref`
- `generated_artifact_ref`

### MediaCatalogCard

建议承载：

- modality
- asset identity
- source/governance scope
- theme / scene / mood
- safe summary
- intended use cases
- domain scope hints
- duplicate cluster reference
- indexing eligibility

### MediaRetrievalDocument

建议按 doc scope 拆分：

- `private_internal`
- `public_safe`
- `community_scoped`
- `planner_only`

关键原则：

- private field 不直接进入 public-safe doc
- generated asset 若会复用，仍需 doc
- projection-native handoff 可直接转 planner/public-safe doc，而不一定回写新的资产卡片

### MediaEmbeddingSnapshot

建议记录：

- `retrieval_document_id`
- `provider`
- `model`
- `index_profile_id`
- `vector_dimension`
- `document_content_hash`
- `embedding_hash`
- `created_at`
- `is_active`
- `search_status`

关系建议固定为：

- `MediaRetrievalDocument 1 -> N MediaEmbeddingSnapshot`
- retrieval doc 是逻辑文档，不直接承载 vector
- embedding snapshot 是 append-only 版本快照
- model 升级、参数切换、re-embed、backfill 都新增 snapshot，而不是原地覆盖
- 同一 `retrieval_document_id + index_profile_id` 在任意时刻只允许一个 active snapshot 参与搜索

### Duplicate Cluster

建议增加：

- `duplicate_cluster_id`
- `canonical_asset_id`
- `duplicate_kind` (`exact` / `near`)
- `distance` / similarity evidence

canonical 策略建议冻结为：

- exact duplicate
  - 默认不新建第二个 `MediaAsset`
  - 通过 `sha256` 命中后复用既有 canonical asset
  - 新的导入事件、来源、策略决策通过 import item / lineage / binding 记录
- near duplicate
  - 默认允许保留多个 `MediaAsset`
  - 通过 `phash` / similarity evidence 聚为同一 duplicate cluster
  - 默认只让 `canonical_asset_id` 对应的 asset/doc 进入主检索和默认 planner 候选
  - 非 canonical asset 保留用于 provenance、审核、显式引用和豁免场景

不建议采用“同 cluster 永远单 asset”：

- near duplicate 往往有不同裁切、水印、尺寸、来源、可见性策略
- 强行压成单 asset 会损失 provenance 和治理粒度
- 与 exact duplicate 的处理语义也不应混为一谈

## Planned Prisma Schema (v1)

### Schema style alignment

第一版建议继续沿用 repo 当前 media schema 风格：

- 非主资产/历史/调度表继续使用 `*Record` 命名
- 状态、phase、scope 等 operational 字段继续使用 `String`，不在 V1 引入大量 Prisma enum
- query-critical filter 保留为标量列；长 payload、摘要、manifest 结果使用 `Json`
- 所有新字段继续使用 `@map("snake_case")`
- vector 搜索相关索引通过 custom migration SQL 落地，不依赖 Prisma schema 直接表达 operator class 或 partial HNSW

### Existing model extensions

#### MediaAsset

V1 建议在现有 `MediaAsset` 上增加最少扩展字段：

- `duplicateClusterId String? @map("duplicate_cluster_id")`
- `duplicateDistance Float? @map("duplicate_distance")`

并增加关系：

- `catalogCards MediaCatalogCardRecord[]`
- `retrievalDocuments MediaRetrievalDocumentRecord[]`
- `duplicateCluster MediaDuplicateClusterRecord?`
- `canonicalDuplicateClusters MediaDuplicateClusterRecord[] @relation("MediaDuplicateClusterCanonicalAsset")`
- `resolvedImportItems MediaImportJobItemRecord[] @relation("MediaImportResolvedAsset")`
- `sourceImportItems MediaImportJobItemRecord[] @relation("MediaImportSourceAsset")`

建议索引补充：

- `@@index([duplicateClusterId, createdAt])`

这样做的目的：

- near duplicate 的 cluster membership 直接挂在 asset 上
- exact duplicate 仍可通过 import item / lineage 复用同一 asset，而不必为“没有第二个 asset row”的情况再造一张 membership 表

### New Prisma models

#### MediaCatalogCardRecord

建议映射到：

- `@@map("media_catalog_cards")`

建议字段：

- `id`
- `assetId`
- `semanticSnapshotId` nullable
- `schemaVersion` default `media-catalog-card.v1`
- `modality`
- `sourceKind`
- `contentHash`
- `buildStatus`
- `payloadJson`
- `isCurrent`
- `createdAt`

建议关系：

- `asset -> MediaAsset`
- `semanticSnapshot -> MediaSemanticSnapshot?`
- `retrievalDocuments -> MediaRetrievalDocumentRecord[]`

建议索引：

- `@@index([assetId, isCurrent, createdAt])`
- `@@index([sourceKind, buildStatus, createdAt])`
- `@@index([semanticSnapshotId, createdAt])`

语义建议：

- catalog card 采用 append-only + `isCurrent`
- rebuild card 时新增版本，并将旧版本标记为非 current

#### MediaRetrievalDocumentRecord

建议映射到：

- `@@map("media_retrieval_documents")`

建议字段：

- `id`
- `docKey`
- `assetId`
- `catalogCardId` nullable
- `duplicateClusterId` nullable
- `schemaVersion` default `media-retrieval-doc.v1`
- `docScope`
- `modality`
- `trackKind` nullable
- `segmentStartMs` nullable
- `segmentEndMs` nullable
- `sourceKind`
- `ownerUserId` nullable
- `stewardAgentId` nullable
- `communityId` nullable
- `isCanonical`
- `lifecycleStatus`
- `documentText`
- `documentHash`
- `documentMetaJson`
- `createdAt`
- `updatedAt`

建议关系：

- `asset -> MediaAsset`
- `catalogCard -> MediaCatalogCardRecord?`
- `duplicateCluster -> MediaDuplicateClusterRecord?`
- `embeddingSnapshots -> MediaEmbeddingSnapshotRecord[]`

建议索引：

- `@unique` on `docKey`
- `@@index([assetId, docScope, createdAt])`
- `@@index([docScope, sourceKind, createdAt])`
- `@@index([communityId, docScope, createdAt])`
- `@@index([ownerUserId, docScope, createdAt])`
- `@@index([duplicateClusterId, isCanonical, createdAt])`
- `@@index([lifecycleStatus, createdAt])`

语义建议：

- retrieval doc 是逻辑文档，允许 update-in-place 修改 `documentText/documentHash`
- 每次 `documentHash` 变化都应触发新的 embedding snapshot，而不是覆盖历史向量
- `docKey` SHOULD 作为稳定逻辑键
  - 图片 V1 可由 `asset_id + doc_scope`
  - 未来视频可扩展为 `asset_id + doc_scope + track_kind + segment range`

#### MediaEmbeddingSnapshotRecord

建议映射到：

- `@@map("media_embedding_snapshots")`

建议字段：

- `id`
- `retrievalDocumentId`
- `indexProfileId`
- `provider`
- `modelName`
- `outputType`
- `vectorDimension`
- `documentContentHash`
- `embeddingHash`
- `embeddingVector Unsupported("vector")?`
- `searchStatus`
- `isActive`
- `activatedAt` nullable
- `errorCode` nullable
- `errorMessage` nullable
- `createdAt`

建议关系：

- `retrievalDocument -> MediaRetrievalDocumentRecord`

建议 Prisma-level 索引：

- `@@index([retrievalDocumentId, indexProfileId, isActive, createdAt])`
- `@@index([indexProfileId, searchStatus, createdAt])`
- `@@index([createdAt])`

建议 DB-only custom indexes / constraints：

- `CREATE EXTENSION IF NOT EXISTS vector`
- active snapshot partial unique index
  - 同一 `(retrieval_document_id, index_profile_id)` 仅允许一个 active row
- HNSW expression index per profile
  - V1 主 profile 为 `text-embedding-v4-1024`
  - 建议在 `WHERE index_profile_id = 'text-embedding-v4-1024' AND is_active = true AND search_status = 'searchable'` 上创建 expression index
  - vector 查询时按 profile 将 `embedding_vector` cast 为 `vector(1024)`

为什么不用固定 `vector(1024)` 列：

- schema 已为未来多 profile / 多维度预留
- generic `vector` 列 + per-profile expression index 更适合一张 snapshot 表承接后续 profile 演进

Prisma 约束建议：

- Prisma schema 仅表达 `Unsupported("vector")`
- extension、operator class、partial unique、HNSW index 通过 migration.sql 手工补充
- repository 层对向量搜索使用 raw SQL，而不是期待 Prisma Client 直接操作该列

#### MediaDuplicateClusterRecord

建议映射到：

- `@@map("media_duplicate_clusters")`

建议字段：

- `id`
- `duplicateKind`
- `canonicalAssetId`
- `evidenceJson`
- `status`
- `createdAt`
- `updatedAt`

建议关系：

- `canonicalAsset -> MediaAsset @relation("MediaDuplicateClusterCanonicalAsset")`
- `assets -> MediaAsset[]`
- `retrievalDocuments -> MediaRetrievalDocumentRecord[]`
- `importItems -> MediaImportJobItemRecord[]`

建议索引：

- `@@index([duplicateKind, status, createdAt])`
- `@@index([canonicalAssetId])`

语义建议：

- cluster 是 near-duplicate 治理与 canonical 暴露的主锚点
- exact duplicate 不要求一定 materialize 新 cluster row；如需统一治理，也可复用该表

#### MediaImportJobRecord

建议映射到：

- `@@map("media_import_jobs")`

建议字段：

- `id`
- `status`
- `phase`
- `entrypoint`
- `requestedByType`
- `requestedById`
- `manifestVersion`
- `intentFingerprint`
- `requestFingerprint`
- `stagingManifestKey`
- `normalizedManifestKey`
- `resultManifestKey`
- `failureLogKey`
- `scopeSummaryJson`
- `totalItems`
- `processedItems`
- `createdItems`
- `reusedItems`
- `suppressedItems`
- `failedItems`
- `attemptCount`
- `failedPhase`
- `errorCode`
- `errorMessage`
- `claimedByWorker`
- `startedAt`
- `finishedAt`
- `lastHeartbeatAt`
- `retryOfJobId`
- `createdAt`
- `updatedAt`

建议关系：

- `items -> MediaImportJobItemRecord[]`
- `retryOfJob -> MediaImportJobRecord?`
- `retries -> MediaImportJobRecord[]`

建议索引：

- `@unique` on `requestFingerprint`
- `@@index([intentFingerprint, createdAt])`
- `@@index([status, createdAt])`
- `@@index([phase, updatedAt])`
- `@@index([entrypoint, createdAt])`
- `@@index([requestedByType, requestedById, createdAt])`
- `@@index([retryOfJobId])`
- `@@index([lastHeartbeatAt])`

#### MediaImportJobItemRecord

建议映射到：

- `@@map("media_import_job_items")`

建议字段：

- `id`
- `jobId`
- `itemId`
- `itemIndex`
- `status`
- `inputKind`
- `sourceKind`
- `indexScope`
- `ownerUserId` nullable
- `stewardAgentId` nullable
- `communityId` nullable
- `stagingObjectKey` nullable
- `originUrl` nullable
- `sourceAssetId` nullable
- `generatedJobId` nullable
- `duplicateClusterId` nullable
- `declaredSha256` nullable
- `mimeType` nullable
- `fileSizeBytes` nullable
- `width` nullable
- `height` nullable
- `failedPhase` nullable
- `errorCode` nullable
- `errorMessage` nullable
- `resolvedAssetId` nullable
- `resolvedRequestJson`
- `resultSummaryJson` nullable
- `startedAt` nullable
- `finishedAt` nullable
- `createdAt`
- `updatedAt`

建议关系：

- `job -> MediaImportJobRecord`
- `sourceAsset -> MediaAsset? @relation("MediaImportSourceAsset")`
- `resolvedAsset -> MediaAsset? @relation("MediaImportResolvedAsset")`
- `generatedJob -> MediaGenerationJobRecord?`
- `duplicateCluster -> MediaDuplicateClusterRecord?`

建议索引：

- `@@unique([jobId, itemId])`
- `@@index([jobId, itemIndex])`
- `@@index([jobId, status, itemIndex])`
- `@@index([resolvedAssetId])`
- `@@index([sourceAssetId])`
- `@@index([generatedJobId])`
- `@@index([duplicateClusterId])`
- `@@index([communityId, createdAt])`
- `@@index([ownerUserId, createdAt])`
- `@@index([stewardAgentId, createdAt])`

语义建议：

- `itemId` 对应 manifest authoring contract 中的稳定标识
- `itemIndex` 对应执行时的顺序位置
- `resolvedRequestJson` 保存规范化后的 runtime contract，而不是原始 authoring manifest

## Planned Service Boundaries

### Media Injection Service

负责：

- 规范化不同入口
- 资产存在性与 dedupe 检查
- 触发 catalog/retrieval/embedding
- 绑定默认 pool / policy / lineage
- dry-run / apply 两段式执行

### CLI / Manifest Flow

第一版建议以 manifest 作为批量注入入口，而不是为每个来源单独设计一套脚本参数。

在当前部署约束下，CLI 允许在 ECS 外运行，但不假定可以直连 ECS 内部控制面或生产数据库。

推荐命令形态：

- `pnpm media:inject --manifest ./path/to/manifest.yaml --dry-run`
- `pnpm media:inject --manifest ./path/to/manifest.yaml --apply`

### CLI Manifest Schema (v1)

CLI SHOULD accept YAML or JSON, but canonical examples SHOULD use YAML for human authoring.

manifest MUST be strict and versioned, with exactly three top-level sections:

- `manifest_meta`
- `defaults`
- `items`

运行时约束：

- `entrypoint` 在 CLI manifest 中是顶层固定值 `cli_manifest`，item 不应重复声明
- `apply_request_id` MUST NOT 写入 manifest 文件；由 CLI 在执行 `apply` 时生成，并用于派生 `request_fingerprint`
- `dry-run` 与 `apply` 消费同一份 manifest；差异只体现在执行模式，不体现在文件内容

#### Top-level schema

`manifest_meta`:

- `contract_version`: `1`
- `manifest_kind`: `media_import`
- `manifest_id`: string
- `generated_by_tool`: string
- `generated_at`: ISO 8601 datetime
- `notes`: string[] optional

`defaults`:

- `entrypoint`: `cli_manifest`
- `target_scope`: optional object
  - `owner_user_id`
  - `steward_agent_id`
  - `community_id`
- `indexing`: optional object
  - `primary_scope`
  - `public_safe_enabled`
  - `embedding_policy_id`
- `dedupe`: optional object
  - `policy_id`
- `reuse`: optional object
  - `mode_id`
- `catalog`: optional object
  - `policy_id`

`items`:

- array with `min(1)`
- each item MUST contain:
  - `item_id`
  - `input_kind`
  - `source_kind`
- each item MAY override:
  - `target_scope`
  - `indexing`
  - `dedupe`
  - `reuse`
  - `catalog`
  - `annotations`

#### Common item fields

每条 item 的通用字段建议为：

- `item_id`
- `input_kind`
- `source_kind`
- `target_scope`
  - `owner_user_id`
  - `steward_agent_id`
  - `community_id`
- `indexing`
  - `primary_scope`
  - `public_safe_enabled`
  - `embedding_policy_id`
- `dedupe`
  - `policy_id`
- `reuse`
  - `mode_id`
- `catalog`
  - `policy_id`
- `annotations`
  - `tags`
  - `internal_note`
  - `owner_note`

`source_kind` 第一版冻结为：

- `owner_private_pool`
- `community_commons`
- `platform_canonical`
- `generated_public`
- `private_derived_public`

`indexing.primary_scope` 第一版冻结为：

- `private_internal`
- `community_scoped`
- `public_safe`
- `planner_only`

#### Input-kind branches

`local_file`:

- MUST provide `path`
- MAY provide:
  - `declared_mime_type`
  - `declared_sha256`

`remote_url`:

- MUST provide `url`
- MAY provide:
  - `expected_sha256`

`existing_asset_ref`:

- MUST provide `asset_id`

`generated_artifact_ref`:

- MUST provide `generated_job_id`

#### Merge rules

manifest 解析为 `MediaInjectionRequest[]` 时建议遵循：

- 标量字段：item override wins
- 对象字段：key-wise merge
- 数组字段：item value replaces default value

解析完成后，每个 resolved item MUST 满足 source-kind 约束。

#### Source-kind guardrails

第一版建议最少执行这些校验：

- `owner_private_pool`
  - MUST resolve `target_scope.owner_user_id`
- `community_commons`
  - MUST resolve `target_scope.community_id`
- `platform_canonical`
  - MUST NOT resolve `target_scope.owner_user_id`
- `generated_public`
  - SHOULD use `generated_artifact_ref` or `existing_asset_ref`
- `private_derived_public`
  - SHOULD preserve `target_scope.owner_user_id` when available

#### Example

参考示例：

- [media-import-manifest.v1.yaml](/Users/phoenix/Desktop/project/Fun-ForumAI/dev-docs/active/media-injection-catalog-and-retrieval-v1/examples/media-import-manifest.v1.yaml:1)

### Service-side Validation Contract

第一版建议沿用 repo 当前 backend validation 风格：

- `zod`
- `.strict()`
- 分层 schema 命名
- 语义校验失败最终映射到 `ValidationError`

建议文件命名：

- `src/backend/validation/media-import-schemas.ts`

建议导出 schema：

- `mediaImportManifestSchema`
- `mediaImportManifestMetaSchema`
- `mediaImportDefaultsSchema`
- `mediaImportTargetScopeSchema`
- `mediaImportIndexingSchema`
- `mediaImportDedupeSchema`
- `mediaImportReuseSchema`
- `mediaImportCatalogSchema`
- `mediaImportAnnotationsSchema`
- `mediaImportLocalFileItemSchema`
- `mediaImportRemoteUrlItemSchema`
- `mediaImportExistingAssetRefItemSchema`
- `mediaImportGeneratedArtifactRefItemSchema`
- `mediaImportItemSchema`

建议类型：

- `MediaImportManifest`
- `MediaImportManifestItem`
- `ResolvedMediaImportDefaults`
- `ResolvedMediaImportItem`

#### Schema shape

建议基础 schema 都保持：

- `z.object({...}).strict()`
- 字段使用显式 `z.literal()` / `z.enum()` / `z.string().trim().min(1)`
- item 分支使用 `input_kind` 作为 discriminant

建议 item schema 采用：

- `z.discriminatedUnion('input_kind', [...])`

理由：

- 分支错误更清晰
- 与 manifest 的 `input_kind` 语义天然对齐
- 比手写 if/else 校验更不容易漂移

#### Parse and normalize pipeline

建议 worker/CLI 共享同一条解析链：

1. `loadManifest(rawText)`
   - 解析 YAML 或 JSON 为 `unknown`
2. `mediaImportManifestSchema.parse(raw)`
   - 做结构级校验
3. `normalizeMediaImportManifest(parsed)`
   - 计算 defaults + item override 合并结果
4. `validateMediaImportManifestSemantics(normalized)`
   - 做 source-kind guardrails、scope 约束、branch 约束
5. `buildMediaInjectionRequests(normalized, applyContext)`
   - 生成 `MediaInjectionRequest[]`
6. `computeIntentFingerprint(normalized)`
7. `computeRequestFingerprint(normalized, applyRequestId)`

建议输出层级：

- `parsed manifest`
  - 仅保证结构正确
- `normalized manifest`
  - 已完成 default merge
- `resolved items`
  - 已通过语义校验，可进入 import job / worker 主链

#### Semantic validation rules

结构级 schema 通过后，仍建议做第二层语义校验：

- `owner_private_pool`
  - `target_scope.owner_user_id` MUST exist
- `community_commons`
  - `target_scope.community_id` MUST exist
- `platform_canonical`
  - `target_scope.owner_user_id` MUST NOT exist
- `generated_public`
  - `input_kind` SHOULD be `generated_artifact_ref` or `existing_asset_ref`
- `private_derived_public`
  - 若存在 `owner_user_id`，SHOULD 保留
- `local_file`
  - `path` MUST be relative or otherwise allowed by CLI security policy
- `remote_url`
  - `url` MUST be `https`
- `existing_asset_ref`
  - `asset_id` MUST be non-empty
- `generated_artifact_ref`
  - `generated_job_id` MUST be non-empty

#### Error model

建议把错误分成三类：

1. load error
   - YAML/JSON 无法解析
2. schema error
   - 结构与字段类型不合法
3. semantic error
   - 结构合法，但违反 source/scope/input guardrails

建议 service 层统一抛：

- `ValidationError(message, details)`

建议 `details` 结构：

- `manifest_id`
- `item_id` optional
- `path` optional
- `reason_code`
- `message`

建议 `reason_code` 前缀：

- `manifest_load_*`
- `manifest_schema_*`
- `manifest_semantic_*`

示例：

- `manifest_load_invalid_yaml`
- `manifest_schema_missing_required_field`
- `manifest_semantic_owner_scope_required`
- `manifest_semantic_platform_owner_forbidden`
- `manifest_semantic_remote_url_https_required`

#### Normalized output boundary

建议 `MediaInjectionRequest` 只消费 normalized 结果，不直接消费原始 manifest item。

也就是说：

- 原始 manifest 是 authoring contract
- normalized manifest 是 runtime contract
- `MediaInjectionRequest` 是 worker business contract

这样后面如果 authoring schema 细节变化，不会直接污染 worker 主逻辑。

执行语义：

1. 读取 manifest 并规范化为 `MediaInjectionRequest[]`
2. 对每个 item 做存在性检查与 schema 校验
3. `dry-run` 输出逐条计划结果：`would_create` / `would_reuse` / `would_suppress` / `invalid`
4. `apply` 将 job manifest 和必要对象写入 `OSS staging`
5. 内网 worker 消费 staging job
6. worker 运行 `sha256` / `phash` 去重
7. worker 生成或复用 `MediaAsset`
8. worker 生成 `MediaCatalogCard`、`MediaRetrievalDocument`、`MediaEmbeddingSnapshot`
9. worker 注册 pool / policy / lineage，并输出逐条最终结果：`created` / `reused` / `suppressed` / `failed`

### External CLI + OSS Staging + Internal Worker

当 ECS 仅内网可达时，批量导入默认不走“外部 CLI -> 内部 API -> 直接落库”。

建议第一版标准链路：

1. 外部 `CLI` 读取 manifest，并对 `local_file` 执行本地预检：
   - `sha256`
   - file size
   - MIME
   - optional dimensions
2. 外部 `CLI` 将 manifest 和待处理对象写入 `OSS staging`
3. 内网 `MediaInjectionWorker` 扫描或消费 staging job
4. worker 完成：
   - dedupe
   - canonical/staging 复制或复用
   - `MediaAsset`
   - `MediaCatalogCard`
   - `MediaRetrievalDocument`
   - embedding snapshot
   - pool / policy / lineage
5. worker 回写 job 状态到 PG 或 OSS result artifact

建议职责拆分：

- external CLI
  - 生成 manifest
  - 上传 staging object
  - 查询 job 结果
- internal worker
  - 生产写入唯一入口
  - 去重/治理/索引/embedding
  - staging -> canonical promotion

建议存储分层：

- `staging` prefix / bucket
  - 外部导入暂存区
  - 未通过治理校验的对象不进入正式媒体池
- `import-artifacts` prefix / bucket
  - normalized manifest
  - result report
  - failure log
  - 与 staging input 分离保留
- `canonical` prefix / bucket
  - `MediaAsset.storage_key` 指向的正式对象区
  - 仅 internal worker 可写入

### Staging cleanup and TTL

第一版建议明确区分三类对象：

1. `staging input`
   - CLI 上传的原始文件
   - staging manifest
   - worker 尚未 promote 的临时对象
2. `import artifact`
   - normalized manifest
   - result report
   - failure log
3. `canonical media`
   - 正式 `MediaAsset.storage_key`

TTL 建议固定为：

- success / partial_succeeded
  - staging input SHOULD 在 job `finished_at` 后 24 小时内清理
  - 这样保留短暂回看窗口，同时避免 staging 长期堆积
- failed / cancelled
  - staging input SHOULD 保留 7 天
  - 供运营诊断、失败重试、取证复盘使用
- abandoned staged / queued / stale running
  - 若 job 长时间未被 claim 或 heartbeat 超时，应以 `staging_expired` / 等价错误码收敛
  - 相关 staging input SHOULD 在 72 小时内清理
- import artifact
  - 不走 staging input TTL
  - `result_manifest_key` / `failure_log_key` 默认保留 30 天
  - 若后续审计策略要求更长留存，可单独扩展 artifact retention policy
- canonical media
  - 不参与 staging cleanup
  - 继续遵循现有 media lifecycle / governance 主链

实现建议：

- cleanup SHOULD 由 internal worker 或独立 lifecycle sweep 执行
- 不新增 job 主状态；TTL 过期通过 `error_code` / `error_message` 体现
- 删除顺序 SHOULD 为：
  1. 确认 canonical promote 已完成或 job 已终态
  2. 删除 staging bytes
  3. 保留 PG job/item 记录与 result artifact

这样可以保证：

- 临时输入对象不会长期占用 OSS
- 结果审计材料不会和 staging 一起被提前删掉
- canonical media 不会被导入临时清理逻辑误删

### Import Job State Machine

第一版建议将 import job 设计为三层状态：

1. job 主状态
2. job 当前 phase
3. per-item 结果状态

#### Job status

主状态只保留少量稳定语义：

- `staged`
- `queued`
- `running`
- `succeeded`
- `partial_succeeded`
- `failed`
- `cancelled`

定义：

- `staged`
  - 外部 CLI 已将 manifest / staging objects 写入暂存区，但内网 worker 尚未正式接单。
- `queued`
  - worker 已发现并接受 job，但尚未开始处理。
- `running`
  - worker 正在执行某个 phase。
- `succeeded`
  - 所有 item 均进入非错误终态：`created` / `reused` / `suppressed`。
- `partial_succeeded`
  - 至少一个 item 成功类终态，且至少一个 item 失败。
- `failed`
  - manifest 级致命错误，或所有 item 都失败。
- `cancelled`
  - 被人工或系统取消。

#### Job phase

phase 独立记录，不编码进主状态：

- `validate_manifest`
- `hydrate_inputs`
- `dedupe`
- `materialize_assets`
- `build_catalog`
- `build_retrieval`
- `embed`
- `finalize`

失败时建议保留：

- `failed_phase`
- `error_code`
- `error_message`

#### Item status

batch job 的 item 结果必须独立存储，不能只靠 job 主状态推导。

建议 item 状态：

- `pending`
- `processing`
- `created`
- `reused`
- `suppressed`
- `failed`
- `cancelled`

语义约束：

- `created`
  - 新建正式资产并完成卡片/检索/索引。
- `reused`
  - 复用已有 asset 或 exact duplicate canonical asset。
- `suppressed`
  - 近重复抑制、policy block、scope block 等非系统故障结果。
- `failed`
  - 真正处理失败，如文件损坏、下载失败、embedding 连续失败。

#### State transitions

推荐主链路：

- `staged -> queued -> running -> succeeded`
- `staged -> queued -> running -> partial_succeeded`
- `staged -> queued -> running -> failed`
- `queued -> cancelled`
- `running -> cancelled`

重试约束：

- `running -> queued`
  - 仅用于可重试基础设施错误，如临时 OSS/DashScope/DB 故障。
- 终态后的人工重试不复用原 job。
  - 建议新建 job，并记录 `retry_of_job_id`。

#### Dry-run boundary

- `dry-run` 只返回计划结果，不创建正式 import job row。
- `apply` 才进入 `staged` 并纳入 worker 消费链。

#### Suggested job counters

建议 job 记录至少包含：

- `total_items`
- `processed_items`
- `created_items`
- `reused_items`
- `suppressed_items`
- `failed_items`
- `attempt_count`
- `last_heartbeat_at`

### Suggested Persistence Model

建议落成两张表，并沿用 repo 现有 media record 命名风格：

- `MediaImportJobRecord`
- `MediaImportJobItemRecord`

#### MediaImportJobRecord

职责：

- 表示一次 batch import run
- 连接 external CLI staging、internal worker 执行、以及最终结果 artifact
- 承载 job 级状态机、phase、计数器、失败相位、重试链

建议字段：

- `id`
- `status`
- `phase`
- `entrypoint`
- `requested_by_type`
- `requested_by_id`
- `manifest_version`
- `intent_fingerprint`
- `request_fingerprint`
- `staging_manifest_key`
- `normalized_manifest_key`
- `result_manifest_key`
- `failure_log_key`
- `scope_summary_json`
- `total_items`
- `processed_items`
- `created_items`
- `reused_items`
- `suppressed_items`
- `failed_items`
- `attempt_count`
- `failed_phase`
- `error_code`
- `error_message`
- `claimed_by_worker`
- `started_at`
- `finished_at`
- `last_heartbeat_at`
- `retry_of_job_id`
- `created_at`
- `updated_at`

建议索引：

- `[status, createdAt]`
- `[phase, updatedAt]`
- `[requestedByType, requestedById, createdAt]`
- `[entrypoint, createdAt]`
- `[retryOfJobId]`
- `[intentFingerprint, createdAt]`
- `[requestFingerprint]` unique

字段说明：

- `intent_fingerprint`
  - 表示“规范化后的同一批导入意图”，用于识别语义上相同的重复导入或人工重跑链。
- `request_fingerprint`
  - 用于单次 `apply` 请求的幂等保护；`dry-run` 不入表。
  - 推荐由 `intent_fingerprint + apply_request_id` 或等价 nonce 派生，保证同一意图可安全重跑。
- `scope_summary_json`
  - 用于保留 job 粒度的来源分布、community/owner/steward 摘要，不强行把 batch 级多域数据拆成单列。
- `claimed_by_worker`
  - 记录当前或最后一次处理该 job 的 worker 标识，便于排障。
- `retry_of_job_id`
  - 指向被人工重试的旧 job，而不是在原 job 上反复改写终态。
- `result_manifest_key`
  - 指向 OSS 中的 job 结果 artifact；PG 仍是控制面权威状态。
- `failure_log_key`
  - 指向 OSS 中的详细失败日志或补充诊断 artifact。

#### MediaImportJobItemRecord

职责：

- 表示 manifest 中的一条输入项
- 承载 item 级输入引用、处理状态、失败原因、最终 asset 落点
- 是批量 job 结果查询和审计的主载体

建议字段：

- `id`
- `job_id`
- `item_index`
- `item_id`
- `status`
- `input_kind`
- `source_kind`
- `index_scope`
- `owner_user_id`
- `steward_agent_id`
- `community_id`
- `staging_object_key`
- `origin_url`
- `source_asset_id`
- `generated_job_id`
- `duplicate_cluster_id`
- `sha256`
- `mime_type`
- `file_size_bytes`
- `width`
- `height`
- `failed_phase`
- `error_code`
- `error_message`
- `resolved_asset_id`
- `resolved_request_json`
- `result_summary_json`
- `started_at`
- `finished_at`
- `created_at`
- `updated_at`

建议索引：

- `[jobId, itemId]` unique
- `[jobId, itemIndex]`
- `[jobId, status, itemIndex]`
- `[resolvedAssetId]`
- `[sourceAssetId]`
- `[generatedJobId]`
- `[duplicateClusterId]`
- `[sha256]`
- `[communityId, createdAt]`
- `[ownerUserId, createdAt]`
- `[stewardAgentId, createdAt]`

字段说明：

- `item_id`
  - 对应 manifest 中的稳定业务标识，不应因为重排 item 顺序而变化。
- `item_index`
  - 对应 manifest 中的稳定顺序，便于 CLI 与结果报告做位置映射。
- `staging_object_key`
  - 仅在 `local_file` 或外部上传场景下有值。
- `origin_url`
  - 仅在 `remote_url` 场景下有值。
- `source_asset_id`
  - 仅在 `existing_asset_ref` 场景下有值。
- `generated_job_id`
  - 仅在 `generated_artifact_ref` 场景下有值。
- `duplicate_cluster_id`
  - 在 dedupe 命中 near-duplicate cluster 时有值，便于 item 级诊断与 suppress/reuse 解释。
- `resolved_asset_id`
  - 指向最终被创建或复用的正式 `MediaAsset`。
- `resolved_request_json`
  - 保存 defaults merge 和语义校验后的 runtime contract；worker 只应消费这一层，不应回看原始 manifest。
- `result_summary_json`
  - 保留 item 级 doc/card/index 处理结果摘要，避免在 V1 把 item 表强耦合到未来可能继续演化的 catalog/retrieval 外键集合。

## Planned Repository Contracts (v1)

### Repository layer rules

第一版建议继续沿用 repo 现有 repository 约束：

- interface 放在 `src/backend/repos/*.ts`
- Prisma 实现放在 `src/backend/repos/pg/*.ts`
- domain/entity types 放在 `src/backend/repos/types/media.ts`
- service 只依赖 repository interface，不依赖 Prisma Client 或 raw SQL
- controller/route 不直接依赖 repository

额外约束：

- `MediaAsset` 继续使用 asset-origin 语义的 `MediaSourceKind`
- retrieval/import/pool 侧统一使用 `VisualSourceKind`
- 不要让 `MediaSourceKind` 和 `VisualSourceKind` 在 repository contract 中混成一个字段类型

建议在 `src/backend/repos/types/media.ts` 中新增或扩展：

- `MediaCatalogCard`
- `CreateMediaCatalogCardInput`
- `UpdateMediaCatalogCardPatch`
- `MediaRetrievalDocument`
- `CreateMediaRetrievalDocumentInput`
- `UpdateMediaRetrievalDocumentPatch`
- `MediaEmbeddingSnapshot`
- `CreateMediaEmbeddingSnapshotInput`
- `UpdateMediaEmbeddingSnapshotPatch`
- `MediaDuplicateCluster`
- `CreateMediaDuplicateClusterInput`
- `UpdateMediaDuplicateClusterPatch`
- `MediaImportJob`
- `CreateMediaImportJobInput`
- `UpdateMediaImportJobPatch`
- `MediaImportJobItem`
- `CreateMediaImportJobItemInput`
- `UpdateMediaImportJobItemPatch`
- `MediaRetrievalDocScope`
- `MediaEmbeddingSearchStatus`
- `MediaImportJobStatus`
- `MediaImportJobPhase`
- `MediaImportJobItemStatus`
- `MediaDuplicateKind`
- `MediaEmbeddingIndexProfileId`

repository-specific query DTO 建议继续放在 repository interface 文件本身，而不是堆进 `types/media.ts`。

### MediaAssetRepository extension

建议扩展现有：

- `UpdateMediaAssetPatch`
  - `duplicate_cluster_id?: string | null`
  - `duplicate_distance?: number | null`

建议新增方法：

- `listBySha256(sha256: string): Promise<MediaAsset[]>`
- `listByDuplicateClusterId(clusterId: string): Promise<MediaAsset[]>`

说明：

- exact dedupe 依赖 `listBySha256`
- near-duplicate candidate 发现 V1 可先基于现有 `listRecent()` + service-side phash distance，不强制增加 DB 侧最近邻接口
- duplicate cluster membership 查询通过 `listByDuplicateClusterId` 解决

### MediaCatalogCardRepository

建议文件：

- `src/backend/repos/media-catalog-card-repository.ts`

建议 contract：

- `create(input: CreateMediaCatalogCardInput): Promise<MediaCatalogCard>`
- `findById(id: string): Promise<MediaCatalogCard | null>`
- `listByAssetId(assetId: string): Promise<MediaCatalogCard[]>`
- `findCurrentByAssetId(assetId: string): Promise<MediaCatalogCard | null>`
- `findCurrentByAssetIds(assetIds: string[]): Promise<MediaCatalogCard[]>`
- `markNonCurrentByAssetId(assetId: string, exceptCardId?: string): Promise<number>`
- `update(id: string, patch: UpdateMediaCatalogCardPatch): Promise<MediaCatalogCard | null>`

设计意图：

- append-only + `isCurrent`
- `markNonCurrentByAssetId` 是 card rotation 的必要域操作

### MediaRetrievalDocumentRepository

建议文件：

- `src/backend/repos/media-retrieval-document-repository.ts`

建议 contract：

- `create(input: CreateMediaRetrievalDocumentInput): Promise<MediaRetrievalDocument>`
- `findById(id: string): Promise<MediaRetrievalDocument | null>`
- `findByDocKey(docKey: string): Promise<MediaRetrievalDocument | null>`
- `findByAssetIdAndScope(assetId: string, docScope: MediaRetrievalDocScope): Promise<MediaRetrievalDocument | null>`
- `findByIds(ids: string[]): Promise<MediaRetrievalDocument[]>`
- `listByAssetId(assetId: string): Promise<MediaRetrievalDocument[]>`
- `listByDuplicateClusterId(clusterId: string): Promise<MediaRetrievalDocument[]>`
- `findCanonicalByClusterIdAndScope(clusterId: string, docScope: MediaRetrievalDocScope): Promise<MediaRetrievalDocument | null>`
- `update(id: string, patch: UpdateMediaRetrievalDocumentPatch): Promise<MediaRetrievalDocument | null>`

设计意图：

- retrieval doc CRUD 和 search 分离
- `docKey` 作为稳定逻辑键
- canonical doc 查询是 planner suppress / dedupe 的直接域需求

### MediaEmbeddingSnapshotRepository

建议文件：

- `src/backend/repos/media-embedding-snapshot-repository.ts`

建议 contract：

- `create(input: CreateMediaEmbeddingSnapshotInput): Promise<MediaEmbeddingSnapshot>`
- `findById(id: string): Promise<MediaEmbeddingSnapshot | null>`
- `listByRetrievalDocumentId(documentId: string): Promise<MediaEmbeddingSnapshot[]>`
- `findActiveByDocumentIdAndProfile(documentId: string, indexProfileId: MediaEmbeddingIndexProfileId): Promise<MediaEmbeddingSnapshot | null>`
- `markNonActiveByDocumentIdAndProfile(documentId: string, indexProfileId: MediaEmbeddingIndexProfileId, exceptSnapshotId?: string): Promise<number>`
- `update(id: string, patch: UpdateMediaEmbeddingSnapshotPatch): Promise<MediaEmbeddingSnapshot | null>`

设计意图：

- snapshot lifecycle 与 vector search 分离
- active rotation 是明确的域操作，不依赖 caller 手工拼 patch

### MediaRetrievalSearchRepository

建议文件：

- `src/backend/repos/media-retrieval-search-repository.ts`

这是第一版唯一 SHOULD 明确使用 raw SQL 的 retrieval repository。

建议 query DTO：

- `MediaRetrievalSearchInput`
  - `query_vector: number[]`
  - `index_profile_id: MediaEmbeddingIndexProfileId`
  - `limit: number`
  - `doc_scopes?: MediaRetrievalDocScope[]`
  - `source_kinds?: VisualSourceKind[]`
  - `owner_user_id?: string`
  - `steward_agent_id?: string`
  - `community_id?: string`
  - `exclude_duplicate_cluster_ids?: string[]`
  - `exclude_asset_ids?: string[]`
  - `only_canonical?: boolean`

建议返回：

- `MediaRetrievalSearchHit[]`
  - `retrieval_document_id`
  - `asset_id`
  - `duplicate_cluster_id`
  - `doc_scope`
  - `source_kind`
  - `distance`
  - `score`

建议 contract：

- `searchActive(input: MediaRetrievalSearchInput): Promise<MediaRetrievalSearchHit[]>`

设计意图：

- 把 pgvector expression index、distance operator、metadata join 全部隔离在专门的 search repository 中
- 避免把 raw SQL 吞进普通 CRUD repository，导致 contract 失焦

### MediaDuplicateClusterRepository

建议文件：

- `src/backend/repos/media-duplicate-cluster-repository.ts`

建议 contract：

- `create(input: CreateMediaDuplicateClusterInput): Promise<MediaDuplicateCluster>`
- `findById(id: string): Promise<MediaDuplicateCluster | null>`
- `findByCanonicalAssetId(assetId: string): Promise<MediaDuplicateCluster | null>`
- `findByIds(ids: string[]): Promise<MediaDuplicateCluster[]>`
- `update(id: string, patch: UpdateMediaDuplicateClusterPatch): Promise<MediaDuplicateCluster | null>`

设计意图：

- cluster record 本身很薄，asset membership 主要通过 `MediaAsset.duplicate_cluster_id` 获取
- canonical asset 重定向保留为 cluster 级 patch，而不是 repo 外散落多步更新

### MediaImportJobRepository

建议文件：

- `src/backend/repos/media-import-job-repository.ts`

建议 query / claim DTO：

- `ClaimMediaImportJobInput`
  - `now: Date`
  - `worker_id: string`
  - `global_concurrency: number`
  - `running_timeout_ms: number`

建议 contract：

- `create(input: CreateMediaImportJobInput): Promise<MediaImportJob>`
- `findById(id: string): Promise<MediaImportJob | null>`
- `findByRequestFingerprint(requestFingerprint: string): Promise<MediaImportJob | null>`
- `listRecentByIntentFingerprint(intentFingerprint: string, limit?: number): Promise<MediaImportJob[]>`
- `update(id: string, patch: UpdateMediaImportJobPatch): Promise<MediaImportJob | null>`
- `claimNextReady(input: ClaimMediaImportJobInput): Promise<MediaImportJob | null>`
- `touchHeartbeat(id: string, heartbeatAt: Date): Promise<MediaImportJob | null>`
- `markExpiredStagedJobs(now: Date, staleAfterMs: number): Promise<MediaImportJob[]>`
- `markTimedOutRunningJobs(now: Date, timeoutMs: number): Promise<MediaImportJob[]>`

设计意图：

- 对齐现有 `MediaGenerationJobRepository` 的 claim / timeout 风格
- `claimNextReady` 应覆盖 `staged` 与 `queued` 的 runnable 语义

### MediaImportJobItemRepository

建议文件：

- `src/backend/repos/media-import-job-item-repository.ts`

建议 contract：

- `createMany(input: CreateMediaImportJobItemInput[]): Promise<MediaImportJobItem[]>`
- `findById(id: string): Promise<MediaImportJobItem | null>`
- `findByJobIdAndItemId(jobId: string, itemId: string): Promise<MediaImportJobItem | null>`
- `listByJobId(jobId: string): Promise<MediaImportJobItem[]>`
- `update(id: string, patch: UpdateMediaImportJobItemPatch): Promise<MediaImportJobItem | null>`

设计意图：

- worker 一次 claim job 后，按 `listByJobId` 顺序处理 items
- item repo 不负责 job counters；counter 汇总由 service 基于 item 结果回写 job repo

### Implementation split recommendation

建议实现文件布局：

- `src/backend/repos/media-catalog-card-repository.ts`
- `src/backend/repos/media-retrieval-document-repository.ts`
- `src/backend/repos/media-embedding-snapshot-repository.ts`
- `src/backend/repos/media-retrieval-search-repository.ts`
- `src/backend/repos/media-duplicate-cluster-repository.ts`
- `src/backend/repos/media-import-job-repository.ts`
- `src/backend/repos/media-import-job-item-repository.ts`
- `src/backend/repos/pg/pg-media-catalog-card-repository.ts`
- `src/backend/repos/pg/pg-media-retrieval-document-repository.ts`
- `src/backend/repos/pg/pg-media-embedding-snapshot-repository.ts`
- `src/backend/repos/pg/pg-media-retrieval-search-repository.ts`
- `src/backend/repos/pg/pg-media-duplicate-cluster-repository.ts`
- `src/backend/repos/pg/pg-media-import-job-repository.ts`
- `src/backend/repos/pg/pg-media-import-job-item-repository.ts`

测试建议：

- CRUD-oriented repos SHOULD 提供 in-memory reference implementation
- `MediaRetrievalSearchRepository` MAY 先只提供 pg implementation；service unit tests 可通过 fake repository 返回 deterministic hits

#### Fingerprint model

建议将 import fingerprint 分成两层：

- `intent_fingerprint`
  - 用于表达“这批导入想做什么”
  - 由规范化 manifest 的稳定语义输入生成
  - 应包含：
    - `input_kind`
    - `source_kind`
    - `index_scope`
    - owner/steward/community 归属
    - dedupe/embedding/public-safe/reuse policy
    - `local_file` 的 `sha256`
    - `existing_asset_ref` 的 `source_asset_id`
    - `generated_artifact_ref` 的 `generated_job_id`
    - `remote_url` 的规范化 URL
- `request_fingerprint`
  - 用于表达“这次 apply 请求本身”
  - 由 `intent_fingerprint + apply_request_id` 或等价请求 nonce 派生
  - 应唯一

约束：

- 不要把 `staging_object_key`、上传时间、worker id 混入 `intent_fingerprint`
- 不要让 `request_fingerprint` 单独承担“同意图识别”和“单次请求幂等”两种语义

#### Result placement model

建议采用 `PG authoritative + OSS artifact` 双层：

- PG
  - 存权威控制面状态：
    - job/item status
    - phase
    - counters
    - `failed_phase`
    - `resolved_asset_id`
- OSS artifact
  - 存大体积、不可变、面向审计的结果文件：
    - normalized manifest
    - result report
    - per-item detail report
    - failure log

建议原则：

- 控制面查询、重试、筛选、运营诊断优先走 PG
- 详细审计内容、大 JSON 报告、失败明细优先走 OSS artifact
- `MediaImportJobRecord` 通过 `result_manifest_key` / `failure_log_key` 指向 artifact，而不是把整份报告塞进表

#### Relations

建议关系：

- `MediaImportJobRecord 1 -> N MediaImportJobItemRecord`
- `MediaImportJobItemRecord N -> 1 MediaAsset (resolved_asset_id, optional)`
- `MediaImportJobItemRecord N -> 1 MediaAsset (source_asset_id, optional)`
- `MediaImportJobItemRecord N -> 1 MediaGenerationJobRecord (generated_job_id, optional)`
- `MediaImportJobRecord N -> 1 MediaImportJobRecord (retry_of_job_id, self-reference, optional)`

#### Retrieval doc and embedding snapshot relation

第一版建议明确冻结为“逻辑检索文档 + 一对多 embedding 快照”，而不是一对一。

建议语义：

- `MediaRetrievalDocument`
  - 表达一个稳定的逻辑检索单元
  - 建议由 `asset_id + doc_scope + modality/segment identity` 确定
  - 承载可过滤、可审计、可回显的检索文本与 metadata
  - 不直接承载 vector
- `MediaEmbeddingSnapshot`
  - 表达某次对 retrieval doc 的具体 embedding 结果
  - 带上 provider/model/dimension/index profile
  - 带上 `document_content_hash`
  - 带上 `is_active` / `search_status`
  - 存真实 vector

建议不变量：

- 一个 retrieval doc 可以有多个 snapshot
- 同一 doc 在不同 `index_profile_id` 下可以各自拥有 active snapshot
- 同一 `(retrieval_document_id, index_profile_id)` 只能有一个 active snapshot
- retrieval doc 内容变更后，旧 snapshot 不原地覆盖；应写入新 snapshot，并将旧 snapshot 标记为 `stale` 或 inactive
- search path 只查询 active snapshot，并 join retrieval doc 的 scope/source/policy metadata

建议实现后果：

- V1 的 vector column 放在 `MediaEmbeddingSnapshot`，不放在 `MediaRetrievalDocument`
- `MediaRetrievalDocument` 可保留 `document_content_hash` 或等价 freshness 字段，用于判断 snapshot 是否过期
- snapshot 的生命周期应允许：
  - 初始写入
  - model 迁移
  - 参数升级
  - async backfill
  - 失活但保留审计记录

为什么不选一对一：

- 一旦模型升级，必须覆盖旧向量，审计与回滚能力很差
- 无法平滑支持不同 index profile 并存
- 无法把“当前可搜索版本”和“历史嵌入记录”分离
- 后续若接入视觉 embedding 或视频片段 embedding，会很快被一对一模型卡死

#### Why not more foreign keys

第一版不建议在 item 表上直接挂：

- `catalog_card_id`
- `retrieval_doc_id`
- `embedding_snapshot_id[]`

原因：

- 一条 item 可能生成多份 retrieval doc
- embedding snapshot 未来天然是多版本
- 强耦合会迫使 import plane 跟随 catalog/retrieval 表演化频繁改 schema

V1 先以：

- `resolved_asset_id`
- `result_summary_json`

承载最终结果即可。

### Media Catalog Service

负责：

- 从 asset + semantic snapshot + source metadata 生成标准资产卡片
- generated asset 的 text-derived card build

### Media Retrieval Service

负责：

- 生成 retrieval doc
- public-safe/private-internal 分域
- vector write / search
- metadata filter + duplicate-cluster suppression

### Generated Asset Retrieval Timing

第一版建议冻结为“同步最小 doc + 异步补强”，而不是把第一次 doc 生成整体延后到 backfill。

原因：

- 当前生成成功路径已经同步完成：
  - asset ingest
  - pool 注册
  - display attachment projection
  - public-safe media card
- 若 retrieval doc 只依赖异步 backfill，generated asset 会出现“已回流公共池、可展示、但不可被检索召回”的空窗
- text-derived doc 的输入在 generation 成功时已经具备：
  - compiled prompt / generation spec
  - public-safe summary
  - source kind / governance scope

建议第一版时序：

1. generation 成功，写入 `MediaAsset`
2. 同步注册 `generated_public` 或 `private_derived_public`
3. 同步创建最小 `MediaCatalogCard`
4. 同步创建最小 `MediaRetrievalDocument`
   - 内容来自 compiled prompt、safe summary、source kind、scope metadata
   - 不等待二次视觉理解
5. 触发 embedding
   - SHOULD 尝试在成功路径内直接发起第一次 embedding
   - 若 embedding 失败，只标记 doc/search snapshot 为 pending or failed，并交给 async retry/backfill
6. 可选 async 补强
   - 二次视觉理解
   - metadata enrichment
   - re-embed / profile upgrade

失败语义建议：

- retrieval doc 的首次创建失败 SHOULD 视为 generation 回流未完成
  - 资产可保留
  - 但该资产不应被标记为“已完成可复用回流”
- embedding 失败 MUST NOT 反向把 generation job 打回失败
  - 它应落到 retrieval plane 的 retry/backfill 语义
  - 并通过 observability 暴露 `generated_asset_search_pending` 或等价指标

这样分层后：

- generation 成功路径保证“最小可复用语义”立即存在
- embedding 与富化失败不会污染 provider generation 成功语义
- retrieval plane 仍保留 eventual consistency 和 retry 空间

### DashScope Embedding Chain

第一版不建议走现有 `OpenAICompatibleProvider.chat()` 链路。原因是 `text-embedding-v4` 的 `text_type`、`instruct`、`output_type` 只在 DashScope SDK/原生 API 可用，而不是完整映射到现有 chat gateway。

建议新增独立的 `MediaEmbeddingGateway`：

1. `MediaRetrievalService` 构造 `MediaRetrievalDocument`
2. `MediaEmbeddingService` 选择 provider/model/params
3. `DashScopeTextEmbeddingGateway` 直连 DashScope 原生 embedding endpoint
4. 返回 dense vector 与 provider metadata
5. `MediaEmbeddingSnapshotRepository` 追加写入新的 snapshot
6. `MediaEmbeddingSnapshotRepository` 失活同一 `retrieval_document_id + index_profile_id` 下的旧 active snapshot，并标记当前 snapshot 为 active searchable version
7. search path 只读取 active snapshot，并 join `MediaRetrievalDocument`

建议第一版调用参数：

- endpoint: `https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding`
- model: `text-embedding-v4`
- dimension: `1024`
- output_type: `dense`
- document build: `text_type=document`
- query build: `text_type=query`
- query instruct: `Given a media retrieval query, retrieve relevant safe media documents`

注意：

- 若仅走 OpenAI-compatible `/embeddings`，可以拿到向量，但拿不到本轮更需要的 `text_type=query|document` 和 `instruct` 优化能力。
- 因此第一版应将“embedding”视为独立 provider path，而不是 chat provider 的一个附属方法。
- embedding 调用默认发生在 internal worker 中，不要求外部 CLI 具备 DashScope 直连能力。

### Media Duplicate Service

负责：

- sha256 exact dedupe
- phash near-duplicate clustering
- planner/result suppression policy

建议第一版策略：

- exact duplicate
  - 在 ingest 时直接命中已有 asset
  - 不再新建第二个 asset row
  - 仅新增 import result / lineage / pool registration 语义
- near duplicate
  - 允许 materialize 新 asset
  - 但必须归属到 duplicate cluster
  - 默认不创建新的 canonical retrieval doc；只把 canonical asset/doc 暴露给主搜索
- explicit reference override
  - 若业务显式指向某个 non-canonical asset，例如 `same_thread_public` 引用主贴原图，则允许绕过默认 canonical suppression

### Planned Service Interfaces (v1)

#### Service layer rules

第一版建议继续沿用 repo 当前 media service 风格：

- 每个 service 定义 `*ServiceDeps`
- `constructor(private readonly deps: *ServiceDeps)`
- 方法输入使用显式 object DTO
- service 不暴露 HTTP / route / multipart / OSS SDK 细节
- repository 只做 persistence；service 负责 orchestration
- gateway 单独定义 interface + error class

错误边界建议：

- manifest 结构/语义错误使用 `ValidationError`
- gateway/provider 故障使用专用 `*GatewayError`
- policy/suppress/reuse 结果优先落 item status / result，而不是作为异常向上抛
- worker 中真正需要重试的基础设施错误才进入 `running -> queued`

事务边界建议：

- `MediaInjectionService.stageApply()` SHOULD 在单事务内写入 `MediaImportJobRecord + MediaImportJobItemRecord`
- `MediaInjectionWorker.processJob()` SHOULD 以 item 为最小原子单元推进
- asset/card/doc/snapshot/current-flag rotation 若需要一致提交，SHOULD 在单 item 事务中完成

#### MediaInjectionService

建议文件：

- `src/backend/media/media-injection-service.ts`

建议 deps：

- `mediaImportJobRepo`
- `mediaImportJobItemRepo`
- `mediaImportManifestParser` or equivalent manifest parse helpers
- `mediaObservabilityService?`

建议方法：

- `planManifest(input: { raw_manifest_text: string; format: 'yaml' | 'json'; requested_by_type: string; requested_by_id: string }): Promise<MediaImportDryRunResult>`
- `stageApply(input: { raw_manifest_text: string; format: 'yaml' | 'json'; apply_request_id: string; requested_by_type: string; requested_by_id: string; staging_manifest_key: string; staged_items: Array<{ item_id: string; staging_object_key?: string | null }> }): Promise<MediaImportJob>`
- `getJobSummary(job_id: string): Promise<MediaImportJobSummary | null>`

职责：

- 解析 manifest
- normalize + semantic validate
- 计算 `intent_fingerprint` / `request_fingerprint`
- 生成 dry-run 计划结果
- apply 时写 job + items
- 不执行长时间 embedding / dedupe / asset materialization

#### MediaInjectionWorker

建议文件：

- `src/backend/media/media-injection-worker.ts`

建议 deps：

- `mediaImportJobRepo`
- `mediaImportJobItemRepo`
- `mediaAssetRepo`
- `mediaDuplicateService`
- `mediaCatalogService`
- `mediaRetrievalService`
- `mediaEmbeddingService`
- `mediaReuseGovernanceService`
- `mediaLineageService?`
- `mediaObservabilityService?`

建议方法：

- `claimAndProcessNext(input: { worker_id: string; now: Date }): Promise<MediaImportJob | null>`
- `processJob(input: { job_id: string; worker_id: string; now: Date }): Promise<MediaImportJob | null>`
- `sweepTimeouts(input: { now: Date }): Promise<{ expired_staged_jobs: MediaImportJob[]; timed_out_running_jobs: MediaImportJob[] }>`

职责：

- claim runnable job
- 推进 phase
- 逐 item 执行 dedupe / asset materialize / card build / retrieval doc build / embedding
- 回写 job counters 与 item status
- 维护 heartbeat
- 生成 result artifact / failure log

说明：

- `claimAndProcessNext` 适合 cron/loop runner
- `processJob` 适合显式重试、手动恢复或测试

#### MediaCatalogService

建议文件：

- `src/backend/media/media-catalog-service.ts`

建议 deps：

- `mediaAssetRepo`
- `mediaSemanticSnapshotRepo`
- `mediaCatalogCardRepo`

建议方法：

- `buildCurrentCardForAsset(input: { asset_id: string; source_kind: VisualSourceKind; build_mode: 'semantic_snapshot' | 'generated_text_derived'; semantic_snapshot_id?: string | null; duplicate_cluster_id?: string | null; indexing_eligible?: boolean }): Promise<MediaCatalogCard>`
- `rebuildCurrentCardForAsset(input: { asset_id: string; source_kind: VisualSourceKind; reason: string }): Promise<MediaCatalogCard>`

职责：

- 生成资产级卡片 payload
- 控制 `isCurrent` rotation
- generated asset 走 text-derived card build

#### MediaRetrievalService

建议文件：

- `src/backend/media/media-retrieval-service.ts`

建议 deps：

- `mediaRetrievalDocumentRepo`
- `mediaRetrievalSearchRepo`
- `mediaCatalogCardRepo`
- `mediaEmbeddingService`
- `mediaDuplicateClusterRepo`

建议方法：

- `upsertDocumentsForAsset(input: { asset_id: string; source_kind: VisualSourceKind; doc_scopes: MediaRetrievalDocScope[]; build_mode: 'from_catalog_card' | 'generated_text_derived' | 'projection_handoff'; catalog_card_id?: string | null; duplicate_cluster_id?: string | null; is_canonical?: boolean }): Promise<MediaRetrievalDocument[]>`
- `search(input: { query_text: string; index_profile_id: MediaEmbeddingIndexProfileId; limit: number; doc_scopes?: MediaRetrievalDocScope[]; source_kinds?: VisualSourceKind[]; owner_user_id?: string; steward_agent_id?: string; community_id?: string; exclude_duplicate_cluster_ids?: string[]; exclude_asset_ids?: string[]; only_canonical?: boolean }): Promise<MediaRetrievalSearchHit[]>`

职责：

- 构造/更新 retrieval doc
- search 时先请求 query embedding，再调用 `MediaRetrievalSearchRepository`
- 在 service 层做 duplicate-cluster suppress 和 result post-filter

#### MediaEmbeddingService

建议文件：

- `src/backend/media/media-embedding-service.ts`

建议 deps：

- `mediaEmbeddingSnapshotRepo`
- `mediaRetrievalDocumentRepo`
- `gateway: MediaEmbeddingGateway`

建议方法：

- `ensureActiveDocumentEmbedding(input: { retrieval_document_id: string; index_profile_id: MediaEmbeddingIndexProfileId; trace_id: string; force_reembed?: boolean }): Promise<MediaEmbeddingSnapshot>`
- `embedQuery(input: { query_text: string; index_profile_id: MediaEmbeddingIndexProfileId; trace_id: string; instruct_override?: string | null }): Promise<{ vector: number[]; provider: string; model_name: string; vector_dimension: number }>`
- `markBackfillRequired(input: { retrieval_document_id: string; index_profile_id: MediaEmbeddingIndexProfileId; reason: string }): Promise<void>`

职责：

- 管理 embedding profile
- 读 retrieval doc，判断是否需要新 snapshot
- 轮转 active snapshot
- query/document embedding 参数分流

#### MediaEmbeddingGateway / DashScopeTextEmbeddingGateway

建议文件：

- `src/backend/media/media-embedding-gateway.ts`
- `src/backend/media/dashscope-text-embedding-gateway.ts`

建议 interface：

- `MediaEmbeddingGateway.embed(input: { text: string; text_type: 'document' | 'query'; index_profile_id: MediaEmbeddingIndexProfileId; trace_id: string; instruct?: string | null }): Promise<MediaEmbeddingGatewayResult>`

建议返回：

- `vector`
- `provider_id`
- `model_name`
- `output_type`
- `vector_dimension`
- `provider_request_summary?`

建议错误契约：

- `MediaEmbeddingGatewayError extends Error`
  - `provider_id`
  - `model_name`
  - `error_code`
  - `provider_request_summary`
- `isMediaEmbeddingGatewayError(error): error is MediaEmbeddingGatewayError`

建议语义：

- 错误契约应和现有 `MediaGenerationGatewayError` 风格对齐
- `DashScopeTextEmbeddingGateway` 只负责 provider call，不负责 snapshot rotation 或 repository writes

#### MediaDuplicateService

建议文件：

- `src/backend/media/media-duplicate-service.ts`

建议 deps：

- `mediaAssetRepo`
- `mediaDuplicateClusterRepo`

建议方法：

- `resolveIngest(input: { sha256: string; phash?: string | null; source_kind: VisualSourceKind; owner_user_id?: string | null; community_id?: string | null }): Promise<MediaDuplicateResolution>`
- `resolvePlannerSuppression(input: { duplicate_cluster_ids: string[]; allow_non_canonical_asset_ids?: string[] }): Promise<{ suppressed_cluster_ids: string[] }>`

职责：

- 处理 exact reuse / near cluster attach / canonical selection
- 向 worker 返回 `reused` / `clustered` / `create_new` 决策
- 向 planner/retrieval 返回默认 suppress 规则

## Retrieval Flow (planned)

1. planner 生成 `semantic_query`
2. governance/source scope 先过滤可用域
3. `MediaRetrievalService.search()` 召回候选 doc
4. duplicate cluster 去重，只保留 canonical doc
5. 现有 planner 继续做 policy / fatigue / scene continuity rerank
6. 最终仍生成现有 `PublicMediaContextCard` 或 handoff，不让 retrieval doc 直接进入 public prompt

## Invariants

- `MediaAsset` 是资源 SoT，OSS 只是字节存储。
- public-safe prompt 注入边界不能被 retrieval 层绕开。
- 私域索引和 public-safe 索引必须物理上可区分，至少在 schema / filter / API 上强约束。
- generated asset 是否做“第二次视觉理解”可以按成本策略决定；但若允许后续复用，不得缺失 retrieval doc。
- generated asset 的首次 text-derived retrieval doc 必须在 generation 成功后同步创建，不得完全依赖异步 backfill。
- 去重要先于 planner 最终选择；不能把“重复图约束”只留给人工 review。
- exact duplicate 默认复用同一 `MediaAsset`；near duplicate 默认保留多 asset，但只索引 canonical asset/doc。
- generated asset 若进入复用池，不得跳过 retrieval doc；只能跳过昂贵的二次视觉理解步骤。
- external CLI 不得直接写生产 PG 主域。
- staging object 未完成治理前，不得直接成为正式 `MediaAsset.storage_key`。
- 不把 `dedupe_failed`、`embedding_running` 之类的步骤型枚举塞进 job `status`；步骤属于 `phase`，不是主状态。
- 不把 vector 直接写回 `MediaRetrievalDocument`；vector 只应存在于 `MediaEmbeddingSnapshot`。

## Downstream Consumers

- `ImagePlannerService`
- owner 私域媒体入口
- admin community/media governance 入口
- CLI / manifest 批量注入
- generated asset 回流路径
- future video ingestion / keyframe retrieval
