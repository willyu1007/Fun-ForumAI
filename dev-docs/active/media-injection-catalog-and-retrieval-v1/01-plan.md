# 01 Plan — media-injection-catalog-and-retrieval-v1 (T-973)

## Scope

### In

- 媒体注入脚手架统一输入契约
- 资产级 `MediaCatalogCard`
- 检索级 `MediaRetrievalDocument`
- embedding snapshot / versioning
- PG / pgvector 检索平面
- DashScope embedding 接入决策
- 重复图聚类 / canonical 选择 / planner 去重
- private/public-safe 双域索引策略
- generated asset 回流后的可检索化规则
- 为后续视频扩展保留 modality 边界

### Out

- 完整视频处理与视频 UI
- 独立向量数据库迁移
- 新的媒体管理后台大工作台
- 评论/聊天室全量多图产品扩展
- 新一轮图像生成 provider 切换

## Steps

1. 冻结 task bundle、governance mapping 和第一期目标边界。
2. 明确 object model：
   - `MediaInjectionRequest`
   - `MediaCatalogCard`
   - `MediaRetrievalDocument`
   - `MediaEmbeddingSnapshot`
   - duplicate cluster / canonical asset
3. 设计 injection scaffold：
   - owner private
   - CLI / manifest
   - community commons
   - platform canonical
   - generated asset
4. 设计 retrieval 平面：
   - public-safe index
   - private-internal index
   - generated text-derived doc
   - PG schema + pgvector index
5. 设计 planner 接线：
   - source/policy prefilter
   - hybrid retrieval
   - duplicate-cluster suppression
   - existing governance rerank
6. 设计 observability / rollout：
   - hit rate
   - generation avoidance rate
   - duplicate suppression metrics
   - no-hit diagnostics
7. 记录 roadmap 对齐结果，并进入实现阶段。

## Phase 1 Freeze

- 主 SoT 不变：`MediaAsset` 仍是唯一资产主对象。
- 第一版 retrieval 存储：`Postgres + pgvector`。
- 第一版 embedding：`DashScope` 服务调用。
- 默认主检索层：文本化媒体文档；若 generated asset 会回流复用，仍需生成 retrieval doc。
- 私域索引与 public-safe 索引必须分域，不能用单一 doc 混合。
- 去重默认优先 canonical asset / duplicate cluster，不允许公共池重复图无限增殖。

## Verification Target

- task bundle 与 project registry 一致。
- roadmap 覆盖 object model、注入入口、索引域、去重、planner 接线、observability 六个主维度。
- 第一版实现决策能直接转成 Prisma / service / repo / route 的开发切片。
