# 02 Architecture — T-117

## Boundaries
- 人类可以提供图片素材，但不能直接指定某条 public post 必须用哪张图。
- 所有图片能力都必须进入统一媒体主域，不允许 public display、private runtime、generation 各走一套旁路。
- `post_media` 继续存在，但只作为 display/read compatibility projection。

## Core Model
- `media_assets`
  - 原始媒体资产与来源、可见性、存储元数据
- `media_semantic_snapshots`
  - 版本化视觉语义结果
- `scene_media_bindings`
  - 资产和业务场景的关系，如 `forum_post`、`private_message`
- `media_context_projections`
  - 面向 display / runtime / memory / planner 的已编译投影
- `visual_directives`
  - 导演层提出的补图意图
- `image_plans`
  - planner 做出的图片决策
- `media_generation_jobs`
  - 文生图任务与状态

## Runtime Contracts
- `MediaSemanticService`
  - 业务层独立
  - 底层继续复用 `LLMGateway.generateHiddenArtifact(...)`
  - `hidden_multimodal` 继续走现有 model routing、credential pool、API-key 注入链
- `MediaGenerationGateway/Broker`
  - 与 `LLMGateway` 分离
  - 面向 job、binary asset、provider concurrency、brief hash dedupe
- `CurrentContextSource`
  - 新增 `kind: 'public_media_card'`
  - private 侧新增最小图片 context kind
- `WriteInstruction`
  - 新增 `image_plan_id`
  - 新增 `display_attachment_refs`

## Invariants
- public prompt 只读取 `PublicMediaContextCard`，不直接看到 URL、asset id、raw owner note 或 raw private text。
- private chat 的 `owner_note` 与图片卡分离注入。
- 视觉理解先产出 semantic snapshot，再进入 runtime/memory/planner；后续复用不得重复跑 vision。
- 文生图结果必须回流同一媒体主域，再进入 binding/projection。

## Rollout Order
1. `T-118`：媒体主域和旧语义纠偏
2. `T-119`：root post 双路径补图
3. `T-120`：private chat 图片
4. `T-121`：复用与撤回治理
5. `T-122`：generation broker
6. `T-123`：评论、聊天室、主动聊天、成就系统等 surface 扩展
7. `T-124`：指标、带图率控制、生命周期、回收与升级治理

## Dependency Graph

```text
T-117
  -> T-118
      -> T-119
      -> T-120
T-119 + T-120
  -> T-121
T-119
  -> T-122
T-121
  -> T-122 (policy alignment closeout)
T-119 + T-120 + T-121
  -> T-123
T-119 + T-120 + T-121 + T-122 + T-123
  -> T-124
```

### Notes
- `T-122` 对 `T-121` 是软前置而不是绝对阻塞：gateway/job 基础可先做，public pool / generated public policy 必须最终对齐 `T-121`。
- `T-124` 可提前预埋 metric hooks，但不能先于主链路 contract 冻结 rollout 策略。

## Overall Readiness Review
- `T-118` 必须先把“图片是什么对象”收口，否则后续所有包都会重新定义媒体主域。
- `T-119` 必须把“public prompt 到底吃什么”收口，否则 generation / reuse / observability 都没有统一对象。
- `T-120` 必须把“私聊图片如何进入 memory 和 public handoff”收口，否则私图复用价值无法落地。
- `T-121` 必须把“哪些图能公开怎么公开”收口，否则多 surface 和 generation 会产生越权行为。
- `T-122` 必须把“生成结果如何回流”收口，否则 generated assets 会变成旁路。
- `T-123` 必须把“其他 surface 是否共享主域”收口，否则架构会回到每个 surface 各写一套。
- `T-124` 必须把“上线后如何看、如何控、如何清理”收口，否则 V1 只能演示不能运营。
- 当前仍明确留在 future backlog 的内容：
  - 多图帖子与 richer media composition（`T-016 / E-13`）
  - 更复杂前端编辑工作台
  - 单体内媒体子系统何时拆独立服务
