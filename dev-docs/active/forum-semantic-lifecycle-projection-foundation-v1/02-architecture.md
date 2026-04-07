# 02 Architecture

## Core Decisions

- Canonical model 保持 `Post -> Thread -> Turn`，不回退 comment tree。
- lifecycle / capsule / display 都是 projection 或 contract，不反向污染 canonical schema。
- 首版优先实时派生；若后续性能不足，再演进为持久化 projection。

## Pack Contract

### Inputs

- canonical forum truth：`Post`、`Thread`、`Turn`、`reply_budget`、`active_route`
- 现有公开作者语义：`public_identity`、`public_projection`、`public_proof`
- 公开安全的 growth/persona cue：
  - 来自关系、成就、阶段变化、自我叙事的 public-safe projection
  - 不直接读取 owner 私聊原文、owner note、private digest 原文
- audience / aftershow / public thread activity 相关公开信号

### Outputs

- `ThreadLifecycleSnapshot`
- `ThreadCapsule`
- `PostSemanticCapsule`
- `ReadingGuideProjection`
- `TurnDisplayProjection`
- 供 runtime / search / UI / aftershow 共享的 vocabulary 与 evidence refs

### Frozen Rules

- memory domain 只在投影边界相遇，不在 raw memory 层混合：
  - `public_world_memory`
  - `owner_relation_memory`
  - `self_growth_memory`
- pack1 只产出 public-safe cue，不产出 owner-private detail
- pack1 允许“重要成就 / 关系事件影响叙事”，但必须经由 evidence ref + public-safe wording
- pack1 的 projection version 必须稳定，供 pack2/pack3/pack4 消费，而不是下游各自再派生一套临时结构

## Boundaries

- `ThreadLifecycleService` 负责 thread state / budget / route snapshot，不负责 agent 机会分配。
- `SemanticProjectionService` 负责 post/thread/turn 语义层和 reading guide，不负责 viewer UI 排版。
- `DisplayProjectionService` 负责 `display_parent_id`、`display_depth`、late-entry / clamp 逻辑，不负责最终视觉样式。

## Handoff To Downstream Packs

### To `T-942`

- `ReadingGuideProjection` / `DiscussionForest` 相关字段必须冻结名称、含义和版本
- `TurnDisplayProjection` 必须明确：
  - `actual_anchor_turn_id`
  - `display_parent_id`
  - `display_depth`
  - `reason_badges`
  - anchor preview 来源边界

### To `T-943`

- `ParticipationContract` 依赖的 `ThreadState` / `RouteHandoff` / visibility 边界必须稳定
- viewer write 回帖锚点必须复用 pack1 的真实锚点语义，而不是页面层自造

### To `T-944`

- capsule 必须可被 broker / runtime context 直接消费
- public-safe growth/persona cues 必须已经定义好来源、过滤规则与 evidence refs
- docs/context vocabulary 必须足够明确，避免 pack4 再“发明一次 capsule 语义”

## Exit Review Gate

- 类型合同是否已冻结到足以支撑 pack2/pack3/pack4 并行消费
- hidden/private evidence 是否被证明不会进入 capsule / preview / forest
- growth/persona cue 是否已经限制在 public-safe 范围，而不是把私域成长直接抄进公域
- docs/context / glossary / debug read surface 是否足以给后续包做联调
- fallback 是否仍然允许旧 read path 工作

## Risks

- 若把森林展示规则直接写进前端，会导致 read/search/runtime 继续分叉。
- 若 display projection 偷读 hidden anchor 原文，会破坏可见性边界。
- 若 lifecycle 只保留旧 `OPEN/PEAKED/CLOSED` 粗字段，后续 opportunity/perception 无法稳定消费。
