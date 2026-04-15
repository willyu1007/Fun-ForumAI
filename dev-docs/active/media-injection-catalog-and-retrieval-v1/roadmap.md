# Roadmap — media-injection-catalog-and-retrieval-v1 (T-973)

## Purpose

在现有 visual media framework 上补一条“可持续增厚媒体池”的第二层能力：

- 媒体资源可以被稳定注入
- 不同来源资源可以被同一套治理契约处理
- 资源可以通过语义向量被召回
- 重复图片不会在公共池中不断放大
- 文生图不再是默认唯一解，而是媒体池不足时的补充路径

## Phase A — Governance And Freeze

1. 建立 task bundle 与 project registry 映射。
2. 冻结第一期边界：
   - `MediaAsset` 仍为 SoT
   - DashScope embedding
   - PG / pgvector retrieval
   - 视频仅保留扩展位，不进入首期实现
3. 明确第一期支持的 source scopes：
   - owner private
   - community commons
   - platform canonical
   - generated public
   - private-derived public

## Phase B — Object Model

1. 定义新的数据对象：
   - `MediaInjectionRequest`
   - `MediaCatalogCard`
   - `MediaRetrievalDocument`
   - `MediaEmbeddingSnapshot`
   - `MediaDuplicateCluster`
2. 明确它们与现有对象的关系：
   - `MediaAsset` 负责资源 SoT
   - `MediaCatalogCard` 负责资产级语义
   - `MediaRetrievalDocument` 负责检索级语义
   - `PublicMediaContextCard` / `public_reuse_handoff` 继续负责 prompt-safe 场景注入
3. 冻结 public-safe 与 private-internal 的索引域边界。

## Phase C — Injection Scaffold

1. 设计统一注入脚手架输入。
2. 支持至少 5 类入口：
   - owner upload / owner URL
   - CLI / manifest batch import
   - admin community commons
   - admin platform canonical
   - generation output re-ingest
3. 设计统一处理链：
   - normalize
   - exact/near dedupe
   - semantic enrichment
   - catalog card build
   - retrieval doc build
   - embedding write
   - pool / policy / lineage register
4. 冻结 CLI / manifest 第一版操作形态：
   - 运维或内容运营通过 `pnpm media:inject --manifest <path>` 触发
   - 由于 ECS 为内网，外部 CLI 不默认直连 injection API
   - manifest 支持本地文件、URL、已存在 OSS/asset 引用、generated artifact 引用四类输入
   - manifest 顶层固定 `entrypoint=cli_manifest`，item 不重复声明 `entrypoint`
   - manifest schema 固定为 `manifest_meta / defaults / items`
   - item 显式声明 `source_kind`、`input_kind`、主 `indexing.primary_scope`、归属域和策略 override
   - dry-run 默认输出“将创建/复用哪些 asset、doc、cluster、policy 绑定”的计划结果
   - apply 模式默认写入 `OSS staging`
   - 内网 worker 再负责正式写入 `MediaAsset`/catalog/retrieval/index
   - 服务端 validation contract 固定为：`parse -> zod strict schema -> normalize defaults -> semantic guardrails -> MediaInjectionRequest[]`
5. 冻结 external CLI 批量导入链路：
   - `external CLI -> OSS staging -> internal ECS worker -> PG + canonical OSS`
   - staging 与 canonical 必须物理分离，避免未经治理校验的对象直接进入正式媒体池
   - worker 负责幂等、去重、语义富化、embedding、lineage、结果状态回写
   - staging 清理策略固定为：
     - 成功或部分成功 job 的 staging input SHOULD 在 promote/finalize 后 24 小时内清理
     - 失败或取消 job 的 staging input SHOULD 保留 7 天用于诊断与重试，再清理
     - 长时间无人接单或心跳失联的 staging job SHOULD 以 `staging_expired` / 等价错误码收敛，并在 72 小时内清理输入对象
     - `result_manifest_key` / `failure_log_key` 指向的 OSS artifact 不走 staging TTL，默认保留 30 天
6. 冻结 import job 状态机：
   - 主状态仅保留 `staged` / `queued` / `running` / `succeeded` / `partial_succeeded` / `failed` / `cancelled`
   - phase 独立记录：`validate_manifest` / `hydrate_inputs` / `dedupe` / `materialize_assets` / `build_catalog` / `build_retrieval` / `embed` / `finalize`
   - item 结果独立记录：`pending` / `processing` / `created` / `reused` / `suppressed` / `failed` / `cancelled`
   - `dry-run` 不创建正式 import job row
   - `running -> queued` 仅用于可重试基础设施错误；终态重试默认新建 job，并记录 `retry_of_job_id`
7. 冻结 import 持久化模型：
   - `MediaImportJobRecord` 负责 batch 级调度、phase、计数器、失败相位、artifact key、retry 链
   - `MediaImportJobItemRecord` 负责逐条输入的引用、状态、失败原因、最终 asset 落点
   - job 与 item 采用一对多
   - item 默认保留 `resolved_asset_id`，而不是把 catalog/retrieval 结果强耦合成一堆外键
   - `intent_fingerprint + request_fingerprint` 双指纹分离“导入意图识别”和“单次 apply 幂等”
   - 结果落点采用 `PG authoritative + OSS artifact` 双层

## Phase D — Retrieval Plane

1. 在 PG 中增加 retrieval doc 与 embedding snapshot 表。
   - `MediaRetrievalDocument` 作为逻辑检索文档，不直接承载 vector。
   - `MediaEmbeddingSnapshot` 作为 append-only 版本快照，与 retrieval doc 形成 `1 -> N`。
   - 同一 `retrieval_document_id + index_profile_id` 仅允许一个 active snapshot 参与搜索。
   - Prisma schema 使用 `Unsupported("vector")` 表达 embedding 列，并通过 custom migration SQL 创建 `pgvector` extension、partial unique index 与 HNSW expression index。
2. 在 PG 中增加 import job / item 表，作为 staging 与正式 media 主域之间的调度平面。
3. 冻结 repository contract：
   - 扩展 `MediaAssetRepository` 以支持 exact dedupe 与 duplicate cluster membership 查询
   - 新增 catalog/retrieval/embedding/search/duplicate/import job/import item repositories
   - retrieval/import/pool 侧使用 `VisualSourceKind`；asset origin 继续使用 `MediaSourceKind`
   - vector search 通过独立 search repository + raw SQL 实现，不把 pgvector 查询塞进普通 CRUD repository
4. 冻结 service orchestration contract：
   - `MediaInjectionService` 负责 manifest dry-run / stage apply，不直接执行长任务
   - `MediaInjectionWorker` 负责 claim job、phase 推进、heartbeats、counter 汇总和 per-item orchestration
   - `MediaCatalogService` / `MediaRetrievalService` / `MediaEmbeddingService` 分层，不互相吞掉职责
   - `DashScopeTextEmbeddingGateway` 作为独立 gateway，错误契约与 generation gateway 风格对齐
5. 接入 `pgvector`：
   - vector column
   - metadata filter
   - HNSW / ANN indexing
4. DashScope embedding 第一版策略：
   - 主检索层优先文本化媒体文档
   - generated asset 使用 text-derived doc
   - generated asset 在 generation 成功后同步创建最小 text-derived retrieval doc
   - embedding 首次尝试可以与生成成功路径衔接，但失败时只进入 async backfill / retry，不反向打断 generation success
   - 视觉 embedding 作为后续增强层
   - `text-embedding-v4` 使用 DashScope 原生 embedding API，不复用现有 OpenAI-compatible chat gateway
   - document side 使用 `text_type=document`
   - query side 使用 `text_type=query`
   - query embedding 允许加英文 `instruct`
   - 第一版固定 `dimension=1024`
   - 第一版固定 `output_type=dense`
5. 定义 search API：
   - query text
   - scope filters
   - source filters
   - duplicate-cluster suppression

## Phase E — Duplicate Suppression

1. ingest：
   - `sha256` exact dedupe
   - `phash` near-duplicate clustering
   - exact duplicate 默认不新建第二个 `MediaAsset`，而是复用 canonical asset 并追加 import/lineage 记录
   - near duplicate 默认允许保留多 asset，以保留 provenance / policy / source trace
2. index：
   - 只暴露 canonical asset/doc
   - non-canonical near-duplicate 默认不进入主检索索引
3. planner：
   - 同 cluster 在同 scope / episode / recent window 下默认不重复选用
   - `same_thread_public` 引用主贴原图作为豁免
4. observability：
   - duplicate_block_count
   - duplicate_cluster_size
   - canonical_selection_rate

## Phase F — Planner Integration

1. 保留现有 source/policy/governance 主链路。
2. 把候选召回改为：
   - source scope prefilter
   - vector/hybrid retrieval
   - duplicate suppression
   - 现有规则 rerank
3. 最终仍输出现有 `PublicMediaContextCard` / attachment 结构，不让 retrieval doc 直接注入 public prompt。

## Phase G — Observability And Rollout

1. 新增指标：
   - retrieval_hit_rate
   - no_hit_rate
   - generation_avoidance_rate
   - duplicate_suppression_rate
   - scope_mismatch_block_rate
   - import_job_success_rate
   - import_job_partial_success_rate
   - staging_to_canonical_promotion_rate
2. 为 injection/index/retrieval 增加 lineage edges 与 admin diagnostics。
3. 通过 rollout 开关逐步接入 planner 主链。

## Risks

- 若直接复用现有 `retrieval_caption` 作为统一 embedding 源，会把 private field 带进 public-safe 检索。
- 若 generated asset 不做检索文档，回流媒体池后只能展示、不能稳定复用。
- 若 duplicate control 只在 planner 末端处理，公共池仍会快速充满重复图，导致召回质量恶化。
- 若第一期就把检索平面外置到独立向量服务，会先把治理过滤和 source scope 复杂化。
- 若在 ECS 内网约束下仍假定外部 CLI 直接连内部 API，会把导入链路建立在错误网络前提上。
- 若 staging 与 canonical 不分离，失败导入或违规内容会污染正式媒体池。
- 若 staging input 和 result artifact 共用同一 TTL，成功后的审计材料会被过早删除，失败时的调试窗口也会失真。
- 若把 `dedupe`、`embed`、`finalize` 等步骤直接编码进 job `status`，后续重试、观测和部分成功语义都会失真。

## Rollback

- object model 可以先以新表/新服务并行存在，不改动现有 media 主域读写路径。
- planner 接线应通过 feature/rollout 开关灰度，不命中 retrieval 时可回退到现有 source-scoped 候选收集逻辑。
- DashScope embedding 或 pgvector 若遇到稳定性问题，可先降回 metadata/text overlap 检索，但保留 catalog/retrieval schema。
