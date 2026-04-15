# 05 Pitfalls (do not repeat)

## Do-not-repeat summary (keep current)

- 不要把现有 `retrieval_caption` 直接当成统一向量索引来源；其中可能带有 `owner_note`，会破坏 public-safe 检索边界。
- 不要把 `entrypoint`、`source_kind` 和 `index_scope` 混成一个枚举；它们是三个不同维度。
- 不要因为资源来自文生图就整体跳过可检索化；只要它会回流复用，就仍需要 retrieval doc。
- 不要把“重复图控制”只放在 planner 末端；必须在 ingest、index、planner 三层同时约束。
- 不要在 “ECS 为内网” 的前提下继续假设外部 CLI 可以直连内部 injection API。
- 不要让 staging 对象直接进入正式媒体池；staging 与 canonical 必须分离。
- 不要把 `intent_fingerprint` 和 `request_fingerprint` 混成一个字段；它们分别服务于“同意图识别”和“单次 apply 幂等”。
- 不要把完整 import report 或 failure log 直接塞进 PG 记录；详细 artifact 应落 OSS。
- 不要在 item 里重复写 `entrypoint`；CLI manifest 顶层已固定为 `cli_manifest`。
- 不要把 `apply_request_id`、`request_fingerprint` 这类执行态字段持久化进 manifest 文件。
- 不要把 vector 原地覆盖到 `MediaRetrievalDocument`；embedding 必须作为 `MediaEmbeddingSnapshot` 的 append-only 历史保留。
- 不要让 generated asset 等到异步 backfill 才第一次拥有 retrieval doc；那会造成“已回流池子但暂时不可检索”的空窗。
- 不要因为 embedding 重试失败就反向改写 generation provider 成功语义；retrieval retry 属于独立故障面。
- 不要把 exact duplicate 和 near duplicate 用同一种 canonical 规则处理；前者应优先复用同一 asset，后者应保留 provenance 但压制索引暴露。
- 不要让 staging input、result artifact、canonical media 共用同一套 TTL；三者的保留目标完全不同。
- 不要假设 Prisma 可以完整表达 pgvector 的 extension、operator class、partial unique 和 HNSW index；这些必须落到 custom migration SQL 和 repository raw SQL。
- 不要把 `MediaSourceKind` 和 `VisualSourceKind` 混成一个 repository contract 类型；前者描述 asset origin，后者描述 planner/retrieval source scope。
- 不要把 pgvector 检索塞进普通 CRUD repository；vector search 应单独放在 `MediaRetrievalSearchRepository` 这类专用接口里。
- 不要让 `MediaInjectionService` 同时承担长任务 worker 职责；dry-run/stage apply 和 claim/process loop 必须拆开。
- 不要把 provider 调用、副作用落库、active snapshot 轮转都塞进 gateway；gateway 只应负责与 DashScope 交互。

## Pitfall log (append-only)

### 2026-04-15 - Task bootstrap
- Symptom:
  - 本任务横跨媒体主域、注入入口、embedding provider、向量存储、planner 候选召回、以及治理边界，若没有标准 task bundle，后续极易把 SoT、索引层和 prompt-safe projection 混在一起。
- What we tried:
  - 先建立完整 dev-docs bundle，并在 roadmap 前冻结核心 object model 与非目标项。
- Fix / workaround:
  - 把任务边界固定为 “主域不变，新增 catalog/retrieval/index plane”，先围绕此边界讨论实现。
- Prevention:
  - 每次进入 schema/service 设计前，先检查是否仍满足 `MediaAsset remains SoT` 与 `public-safe injection boundary unchanged` 两个 invariant。

### 2026-04-15 - ECS network boundary clarified
- Symptom:
  - 早期讨论默认把 CLI 视为可以直接调用 ECS 内部注入服务，但当前部署现实是 ECS 仅内网可达。
- What we tried:
  - 重新审视 CLI、API、OSS、worker 的职责，避免把控制面和数据面建立在错误网络前提上。
- Fix / workaround:
  - 将第一版批量导入收敛为 `external CLI -> OSS staging -> internal ECS worker -> PG + canonical OSS`。
- Prevention:
  - 任何后续实现若依赖“外部 CLI 直连 ECS 内部 API”，都应被视为偏离当前冻结架构。
