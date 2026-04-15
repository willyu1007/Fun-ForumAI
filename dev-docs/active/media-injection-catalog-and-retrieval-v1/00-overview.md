# 00 Overview — media-injection-catalog-and-retrieval-v1 (T-973)

## Status

- State: in-progress
- Depends on: `T-118` media domain foundation, `T-121` public media reuse governance, `T-122` media generation broker, `T-123` multi-surface adapters, `T-124` media observability, `T-918` contract/lineage hardening
- Current status: 任务建包、治理映射、规划冻结、Prisma schema V1、repository contract V1 与 service interface/orchestration contract V1 收敛已完成；当前可继续进入具体 interface/type 文件草案与实现。
- Next step: 基于本 bundle 进入具体 `repos/types`、repository interface 文件、service interface/gateway 文件和 migration 草案的代码实现。

## Goal

在现有 media 主域之上补一层可治理、可扩展、可复用的媒体注入与语义检索能力：

- 保持 `MediaAsset` 作为媒体资源 SoT，继续由 OSS 承载 bytes、PG 承载元数据和治理状态。
- 引入统一的媒体注入脚手架，兼容 owner 私域上传、CLI / manifest 注入、社区资源导入、平台 canonical 资源、文生图回流等不同入口。
- 在 “ECS 仅内网可达” 的前提下，把外部批量导入标准化为 `external CLI -> OSS staging -> internal ECS worker -> PG + canonical OSS`。
- 引入 `MediaCatalogCard` 与 `MediaRetrievalDocument` 的分层语义模型，让资产级语义、检索级语义、场景级 prompt-safe 卡片各自有清晰边界。
- 使用 DashScope embedding + PostgreSQL / pgvector retrieval 建立语义向量检索，同时保留现有治理、lineage、policy 和 display 主链路。
- 把“尽可能不出现重复图片”上升为系统约束，在 ingest、index、planner 三层建立去重和重复簇抑制。
- 为后续视频资源扩展预留 modality / segment 粒度，但本任务不实现完整视频管线。

## Non-goals

- 不替换现有 `MediaAsset -> MediaSemanticSnapshot -> SceneMediaBinding -> MediaContextProjection` 主域。
- 不在第一期中实现完整的视频抽帧、转写或视频检索 UI。
- 不把 public prompt 注入改成直接消费 retrieval doc；prompt-safe 注入仍应通过现有 public-safe card/handoff 边界。
- 不在第一期构建复杂 DAM/素材工作台；优先补 CLI/manifest + service/API 注入脚手架。
- 不在第一期暴露公网可直连的 media injection 内部 API；外部批量入口优先通过 OSS staging 对接内网 worker。
- 不把第一期检索平面外置到独立向量数据库；优先采用 PG/pgvector。

## Context

- repo 已具备完整的 media domain、reuse governance、generation 回流、lineage 与 observability 基线，但 planner 当前候选召回仍以 source-scoped collection + 文本重叠打分为主，缺少真正的向量级语义召回。
- 当前 `retrieval_caption` projection 可承载检索文案，但它会带上 `owner_note` 等私域字段，不能直接当作统一向量索引来源，否则会污染 public-safe 检索边界。
- repo 已明确存在“尽可能不要出现重复图片”的业务约束；回帖引用主贴原图可作为豁免，但公共媒体池和后续 surface reuse 不应被重复图淹没。
- 文生图产物已经会回流 `generated_public` / `private_derived_public` 池，因此即使跳过第二次重视觉理解，也仍需要有可复用的 retrieval doc，而不是只停留在 display attachment。
- 由于当前 ECS 为内网部署，外部批量注入不能假定能直接调用 ECS 内部控制面，因此 staging 层与 internal worker 是第一期设计边界的一部分。
- 现有 repo 的 owner upload / URL import 路径本质上是“持久化对象 -> 语义处理 -> 写 asset record”；第一期新脚手架应复用这一主链，而不是创造第二套脱离 SoT 的离线写库工具。

## Acceptance Criteria

- [ ] `MediaAsset` / OSS / PG 的 SoT 边界被保持清晰；向量与检索文档不反向污染资产主模型。
- [ ] 统一 `MediaInjectionRequest` / scaffold 契约被定义清楚，并能覆盖 owner 私域、CLI/manifest、community commons、platform canonical、generated asset 回流至少五类入口。
- [ ] `CLI manifest` schema 被收敛为严格版本化 contract，顶层固定为 `manifest_meta / defaults / items`，并定义四类 `input_kind` 的分支字段。
- [ ] 服务端 validation contract 被收敛为明确的 schema 命名、normalize pipeline 和错误模型，能够从 `manifest` 规范化到 `MediaInjectionRequest[]`。
- [ ] 外部 `CLI` 的职责边界被定义清楚：允许在 ECS 外运行，但不得直接写生产 PG；批量导入默认通过 OSS staging 交给内网 worker 落库。
- [ ] `MediaCatalogCard` 与 `MediaRetrievalDocument` 的职责边界清楚：前者是资产级语义卡片，后者是检索级语义文档。
- [ ] `MediaRetrievalDocument` 与 `MediaEmbeddingSnapshot` 的关系被冻结为“逻辑文档 + 一对多版本快照”，并明确 active snapshot 与 stale snapshot 的规则。
- [ ] public-safe 与 private-internal 至少形成双域索引策略，禁止 private field 直接进入 public-safe retrieval。
- [ ] 第一版 embedding / retrieval 方案冻结为 DashScope + PG/pgvector，并明确是否使用 `text-embedding-v4` 作为主检索层。
- [ ] 去重策略覆盖 ingest、index、planner 三层，并明确“回帖引用主贴原图”的豁免边界。
- [ ] duplicate cluster 的 canonical 策略被收敛为：exact duplicate 默认复用单一 `MediaAsset`，near duplicate 允许保留多 asset，但默认只索引/召回 canonical asset/doc。
- [ ] generated asset 若进入可复用池，必须能生成 text-derived retrieval doc；不能因“来自文生图”而整体跳过可检索化。
- [ ] generated asset 的可检索化时机被收敛为：generation 成功后同步生成最小 text-derived retrieval doc，embedding/增强允许异步补强，但不得把首次 doc 创建整体延后到 backfill。
- [ ] staging bucket/prefix 与 canonical media bucket/prefix 的职责边界被定义清楚，避免未通过治理校验的对象直接进入正式媒体池。
- [ ] staging 清理策略与 TTL 被收敛为分层保留：staging input 短保留、result artifact 中保留、canonical media 不参与 staging TTL 清理。
- [ ] import job 状态机被收敛为“少量主状态 + 独立 phase + per-item 结果”，避免把每个处理步骤编码进主状态。
- [ ] import 持久化模型被收敛为 `MediaImportJobRecord + MediaImportJobItemRecord` 两层，且和现有 media record 命名/索引风格保持一致。
- [ ] import 幂等与重试语义被收敛为 `intent_fingerprint + request_fingerprint` 双指纹模型。
- [ ] import 结果落点被收敛为 `PG authoritative + OSS artifact` 双层，而不是单层存储。
- [ ] Prisma schema V1 被收敛为明确的新表、`MediaAsset` 扩展字段、索引方案，以及 `pgvector` 的 custom migration 策略。
- [ ] repository contract V1 被收敛为明确的 interface、query DTO、patch/claim 输入，并和现有 `src/backend/repos/` 风格保持一致。
- [ ] service interface / orchestration contract V1 被收敛为明确的 deps、方法签名、错误边界和事务边界，且与现有 media service 风格保持一致。
- [ ] roadmap、plan、architecture、verification 和 pitfalls 已完整建包，可支持后续多会话连续推进。
