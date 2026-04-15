# 03 Implementation Notes

## Status

- Current status: `service_interfaces_converged_ready_for_code_scaffolding`
- Last updated: 2026-04-15

## What changed

- 2026-04-15: 建立 `T-973` 任务包，冻结本轮主题为“媒体注入脚手架 + 资产卡片 + 语义检索索引 + 去重约束”。
- 2026-04-15: 结合现有 repo media 主域确认本轮不重做 `MediaAsset` SoT，而是在其上增加 catalog / retrieval / embedding / duplicate cluster 平面。
- 2026-04-15: 冻结第一版检索路线为 `DashScope embedding + PostgreSQL / pgvector retrieval`，并把 DashVector / 本地模型延后为 follow-up 选项。
- 2026-04-15: 与 roadmap 对齐后，确认 Phase B 对象模型采用 `MediaInjectionRequest / MediaCatalogCard / MediaRetrievalDocument / MediaEmbeddingSnapshot / MediaDuplicateCluster`。
- 2026-04-15: 与 roadmap 对齐后，确认第一版批量入口采用 `CLI manifest -> dry-run -> apply` 两段式注入，不为不同来源维护多套脚本。
- 2026-04-15: 与 roadmap 对齐后，确认 `text-embedding-v4` 走 DashScope 原生 embedding API，而不是复用现有 OpenAI-compatible chat provider。
- 2026-04-15: 与 roadmap 对齐后，确认 `text-embedding-v4` 第一版参数固定为 `dimension=1024`、`output_type=dense`、document=`text_type=document`、query=`text_type=query`，query 允许携带英文 retrieval instruct。
- 2026-04-15: 结合“ECS 为内网”约束，确认外部批量导入默认不走直连 ECS API，而是采用 `external CLI -> OSS staging -> internal ECS worker -> PG + canonical OSS`。
- 2026-04-15: 结合“ECS 为内网”约束，确认 external CLI 不直接写生产 PG；production SoT 的唯一正式写入口仍为内网 worker / service 主链。
- 2026-04-15: 收敛 import job 状态机为“主状态 + phase + per-item 状态”三层：job status 固定为 `staged / queued / running / succeeded / partial_succeeded / failed / cancelled`，phase 单独记录，item 结果独立记录。
- 2026-04-15: 收敛 import job 重试边界：`running -> queued` 仅用于可重试基础设施故障；终态后的人工重试默认新建 job，并记录 `retry_of_job_id`。
- 2026-04-15: 收敛 import 持久化模型为 `MediaImportJobRecord + MediaImportJobItemRecord` 两张表：job 承载 batch 级调度与计数器，item 承载逐条输入引用、失败原因和 `resolved_asset_id`。
- 2026-04-15: 收敛 import fingerprint 模型为 `intent_fingerprint + request_fingerprint` 双层：前者表达规范化导入意图，后者表达单次 apply 请求幂等。
- 2026-04-15: 收敛 import 结果落点为 `PG authoritative + OSS artifact`：PG 存控制面状态，OSS 存 normalized manifest、result report、failure log 等大体积 artifact。
- 2026-04-15: 收敛 CLI manifest schema 为严格版本化 contract：顶层固定 `manifest_meta / defaults / items`，`entrypoint` 固定为 `cli_manifest`，item 按 `input_kind` 分支校验。
- 2026-04-15: 收敛 service-side validation contract：建议在 `src/backend/validation/media-import-schemas.ts` 中用 `zod .strict()` + `discriminatedUnion(input_kind)` 定义 schema，并通过 `parse -> normalize -> semantic validate -> MediaInjectionRequest[]` 的管线生成 runtime contract。
- 2026-04-15: 收敛 retrieval plane 的版本关系：`MediaRetrievalDocument` 冻结为逻辑检索文档，`MediaEmbeddingSnapshot` 冻结为 append-only 一对多版本快照；vector 仅存在于 snapshot，search 只读取 active snapshot。
- 2026-04-15: 收敛 generated asset 的可检索化时机：generation 成功后同步创建最小 text-derived retrieval doc；embedding 与进一步富化允许异步 retry/backfill，但不得把首次 doc 创建整体延后。
- 2026-04-15: 收敛 duplicate cluster canonical 策略：exact duplicate 默认复用单一 `MediaAsset`；near duplicate 默认保留多 asset，但仅 canonical asset/doc 进入主检索与默认 planner 候选。
- 2026-04-15: 收敛 Prisma schema V1：继续沿用 repo 现有 `*Record + String status + Json payload + @map(snake_case)` 风格；新增 `MediaCatalogCardRecord / MediaRetrievalDocumentRecord / MediaEmbeddingSnapshotRecord / MediaDuplicateClusterRecord / MediaImportJobRecord / MediaImportJobItemRecord`，并在 `MediaAsset` 上补 `duplicate_cluster_id / duplicate_distance`。
- 2026-04-15: 收敛 pgvector 落地策略：Prisma schema 使用 `Unsupported(\"vector\")`，extension / active partial unique / HNSW expression index 通过 custom migration SQL 落地；vector search 由 repository raw SQL 负责。
- 2026-04-15: 收敛 repository contract V1：新增 catalog/retrieval/embedding/search/duplicate/import repositories；vector search 单独拆为 `MediaRetrievalSearchRepository`，不与 snapshot CRUD 混用。
- 2026-04-15: 收敛 repository type 边界：`MediaAsset` 继续使用 `MediaSourceKind`，retrieval/import/pool 侧统一使用 `VisualSourceKind`，避免把 asset origin 与 planner source scope 混成同一类型。
- 2026-04-15: 收敛 service interface V1：`MediaInjectionService` 负责 dry-run / stage apply，`MediaInjectionWorker` 负责 claim/process/heartbeat，`MediaCatalogService / MediaRetrievalService / MediaEmbeddingService / MediaDuplicateService` 各自承载独立域职责。
- 2026-04-15: 收敛 embedding gateway 契约：新增 `MediaEmbeddingGateway` 与 `MediaEmbeddingGatewayError`，并要求 `DashScopeTextEmbeddingGateway` 只负责 provider call，不负责 snapshot rotation 或 repository write。
- 2026-04-15: 记录关键设计警戒线：
  - 不直接向量化现有带 `owner_note` 的 retrieval caption 作为统一 public-safe 索引。
  - generated asset 若会回流复用，不能整体跳过 retrieval doc。
  - 重复图约束需覆盖 ingest、index、planner 三层，而不是只在 review 端提示。
  - 不把 staging object 直接视为正式媒体池对象；需经内网 worker 校验、去重、promote 后才进入 canonical。
  - 不把处理步骤编码进 job `status`；`dedupe`、`embed`、`finalize` 等步骤应落在 `phase`。
  - 不在 V1 的 item 表上强耦合 `catalog_card_id` / `retrieval_doc_id` / `embedding_snapshot_id[]`；先保留 `result_summary_json`。
  - 不要让 `request_fingerprint` 既承担“同意图识别”又承担“单次 apply 幂等”；两者必须拆开。
  - 不要把完整 import 报告直接塞进 PG 表字段；详细 artifact 应落 OSS。
  - 不要在 item 中重复声明 `entrypoint`；CLI manifest 的 `entrypoint` 是 manifest 级常量。
  - 不要把 `apply_request_id`、`request_fingerprint` 这类执行态字段写进 manifest 文件。
  - 不要让 worker 直接消费原始 manifest item；worker 应只消费 normalized 后的 `MediaInjectionRequest[]`。
- 2026-04-15: 已执行 project governance `sync --apply` 与 `lint --check`，任务 `T-973` 和 requirement `R-087` 已正式注册到 project hub。

## Open design points to settle against roadmap

- 当前规划冻结阶段无剩余设计阻塞项；可进入 Prisma schema / repo contract / service slice 实现设计。

## Decisions now settled

- Phase B 对象模型已确认采用五件套：`MediaInjectionRequest / MediaCatalogCard / MediaRetrievalDocument / MediaEmbeddingSnapshot / MediaDuplicateCluster`。
- 第一版主检索层已确认：`DashScope text-embedding-v4 + PG/pgvector`。
- 第一版 embedding 调用链已确认：`MediaRetrievalService -> MediaEmbeddingService -> DashScopeTextEmbeddingGateway -> MediaEmbeddingSnapshotRepository`。
- 第一版 duplicate policy 已确认：ingest、index、planner 三层抑制，`same_thread_public` 引用主贴原图保留豁免。
- 第一版视觉 embedding 不进入范围，仍属于后续增强层。
- 第一版网络边界已确认：external CLI 允许在 ECS 外运行，但默认通过 OSS staging 对接内网 worker，而不是直连内部 API。
- 第一版 import job 状态机已确认：简洁主状态 + 独立 phase + 独立 item 结果，并保留 `partial_succeeded` 语义。
- 第一版 import 持久化模型已确认：`MediaImportJobRecord` + `MediaImportJobItemRecord`，item 以 `resolved_asset_id` 为核心正式落点。
- 第一版 import fingerprint 已确认：`intent_fingerprint + request_fingerprint` 双层。
- 第一版 import 结果落点已确认：`PG authoritative + OSS artifact` 双层。
- 第一版 CLI manifest schema 已确认：严格顶层 `manifest_meta / defaults / items`，YAML 为 canonical authored format，JSON 作为兼容输入。
- 第一版 service-side validation contract 已确认：`zod strict schema + discriminatedUnion + normalize pipeline + ValidationError details model`。
- 第一版 retrieval doc / embedding snapshot 关系已确认：`MediaRetrievalDocument 1 -> N MediaEmbeddingSnapshot`，snapshot append-only，且同一 `retrieval_document_id + index_profile_id` 仅允许一个 active searchable version。
- 第一版 generated asset 可检索化时机已确认：generation success path 同步创建最小 text-derived retrieval doc；embedding 失败只进入 async backfill/retry，不反向打断 generation success。
- 第一版 duplicate cluster canonical 策略已确认：exact duplicate 复用同一 asset；near duplicate 保留多 asset，但主检索和默认 planner 仅暴露 canonical asset/doc。
- 第一版 staging cleanup / TTL 已确认：staging input 分状态短保留，result artifact 默认保留 30 天，canonical media 不参与 staging TTL 清理。
- 第一版 Prisma schema 已确认：新表、关系、索引和 `MediaAsset` 扩展字段已在任务包中冻结，可直接进入 migration 设计。
- 第一版 repository contract 已确认：接口拆分、query DTO、claim/patch 输入和实现文件布局已在任务包中冻结，可进入具体 interface/type 设计。
- 第一版 service interface / orchestration contract 已确认：deps、方法签名、错误边界和事务边界已在任务包中冻结，可进入具体 service interface/type 设计。

## Known follow-ups

- roadmap 对齐完成后，需要进入 Prisma schema / repo contracts / service slices 的正式实现包。
- project registry 的 requirement 目前新增为 `R-087`，后续若 scope 扩展到视频，需要单独判断是扩 requirement 还是拆新 requirement。
