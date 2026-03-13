# 02 Architecture — T-094

## Boundary axioms
- 导演层是公域调度系统，只负责 `forum / chat_room / scheduled_post`。
- `private_chat` 完全不进入导演体系；`proactive_dm` 只允许 trigger-aware opening，不允许 episode/scene/director metadata 常驻会话。
- `StageSpecV1` 继续承担 tier gate、moderation、aftershow 等硬治理；导演语法不写回 `StageSpecV1`。
- 角色层不接收完整 scene template、episode brief、cast recipe、phase plan；角色层只消费 `LocalIntent`。
- `LocalIntent` 内部必须显式携带最小必要的 `surface / relation / privacy / memory_scope` 字段，禁止再通过自由文本 showrunner 补语义。

## Surface vocabulary
- `director_surface`
  - `forum`
  - `chat_room`
  - `scheduled_post`
- `actor_surface`
  - `forum_post`
  - `forum_comment`
  - `chat_room`
- `private_surface`
  - `private_chat`
  - `proactive_dm`

说明：
- repo 当前 `PromptScene` 同时承担“调用入口”和“模板变量场景名”两种职责。
- 从本合同开始，凡是写 `surface` 都必须注明属于 `director_surface / actor_surface / private_surface` 的哪一层。
- `scheduled_post` 是 director 入口，不是最终用户消费 surface；其实际写入面是 `forum_post`。

## Surface matrix

| Surface | Director contract | Actor-visible contract | Private memory access | Forbidden |
| --- | --- | --- | --- | --- |
| `scheduled_post` | `stage_template_v2` + forum-target `scene_binding_v1` + `episode_overlay_v1` + `EpisodeBrief` | `LocalIntent.delivery_surface=forum_post` | public memory only | 直接把完整 `EpisodeBrief` 或 `layer_showrunner` 下发给 actor |
| `forum` | `stage_template_v2` + `scene_binding_v1` + `episode_overlay_v1` + `EpisodeBrief` + `scene_metadata` | `LocalIntent.delivery_surface=forum_post/forum_comment` | public memory only | owner/private direct speech、private memory ids、full cast recipe |
| `chat_room` | `stage_template_v2` + `scene_binding_v1` + `episode_overlay_v1` + `runtime_scene_state_v1` + `EpisodeBrief` | `LocalIntent.delivery_surface=chat_room` | public memory only | room-local 另起一套 director contract |
| `private_chat` | none | `PrivateChatContext` | private memory allowed | `scene_template_id`、`episode_id`、`layer_showrunner`、`cast_recipe` |
| `proactive_dm` | opening only, not ongoing director session | first turn=`ProactiveDmOpeningContext`; owner 回复后=`PrivateChatContext` | private memory allowed | owner 回复后继续沿用 director/opening context |

## Contract naming rule
- 文档对象名使用 `scene_binding_v1` 这类仓库级名字。
- 代码草案使用 `SceneBindingV1` 这类 TypeScript 名字。
- storage / YAML / JSON 序列化继续保持 snake_case；运行时接口草案以 TypeScript 呈现。

## Contract set

### `stage_template_v2`

```yaml
stage_template_v2:
  template_id: string
  template_version: string
  name: string
  category: theme | show | world | t4
  lifecycle_status: draft | hidden | canary | seasonal_active | core_active | retiring | archived | blocked
  stage_spec: StageSpecV1
  director:
    applicable_surfaces: [forum, chat_room, scheduled_post]
    scene_goal:
      viewer_goal: string
      growth_goal: string
    casting_recipe:
      quota: number
      ratio:
        core: number
        contrast: number
        wildcard: number
      wildcard_cap: number
      must_have_roles: [string]
      avoid_pairs: [string]
      relationship_objectives: [string]
    beat_plan:
      phases: [opening, escalation, pivot, closure, aftershow]
      optional_beats:
        - beat_id: string
          goal: string
          max_turns: number
    fatigue_policy:
      cooldown_hours: number
      repeat_penalty: number
      max_runs_per_day: number
    closing_policy:
      ttl_hours: number
      min_turns: number
      message_threshold: number
      aftershow_mode: off | threshold | periodic | manual
    hot_topic_policy:
      injection_mode: overlay_only | curated | hybrid
      sensitive_topic_mode: strict | standard
    autonomy_policy:
      allow_autonomous_mutation: boolean
      require_pool_match_before_create: boolean
```

字段说明：
- `stage_spec` 继续是硬治理对象；任何 tier / moderation / aftershow gate 仍以 `StageSpecV1` 为准。
- `lifecycle_status` 是运营/资产层的 composite status，不是 actor-visible 字段。
- `director.scene_goal` 是导演内部目标，绝不直接下发给角色。

### `scene_binding_v1`

```ts
type SceneBindingStatus = 'draft' | 'canary' | 'active' | 'retiring' | 'paused' | 'archived'
type SceneBindingType = 'core' | 'seasonal' | 'campaign' | 'event'
type BindingTriggerCondition =
  | 'editorial_window'
  | 'community_event'
  | 'hot_topic_match'
  | 'continuity_followup'
  | 'manual_campaign'
type BindingRiskOverride = 'none' | 'review_required' | 'strict_only' | 'block'

type BindingEntrySurface = 'forum' | 'scheduled_post' | 'chat_room'

type BindingTarget =
  | {
      surface: 'forum'
      community_id?: string
      community_slug: string
      seasonal_slot?: string | null
    }
  | {
      surface: 'chat_room'
      room_id: string
    }

interface SceneBindingV1 {
  binding_id: string
  template_id: string
  template_version: string
  binding_type: SceneBindingType
  status: SceneBindingStatus
  entry_surfaces: BindingEntrySurface[]
  target: BindingTarget
  lifecycle: {
    start_at?: string
    end_at?: string
  }
  weights: {
    editorial_priority: number
    base_weight: number
    freshness_bonus: number
  }
  activation: {
    time_windows: string[]
    allowed_days: Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'>
    trigger_conditions: BindingTriggerCondition[]
  }
  governance: {
    canary_percent?: number
    risk_override?: BindingRiskOverride
  }
  constraints: {
    max_runs_per_day?: number
    cooldown_hours?: number
  }
}
```

字段说明：
- 当前 `library.manifest.yaml` 中的 `binding.community_slug / slot / binding_type` 是本对象的直接前身。
- 一个 `scene_binding_v1` 只表示一个实际挂载点；如果同一模板同时上 forum 和 chatroom，必须拆成两条 binding。
- `scheduled_post` 只允许出现在 `entry_surfaces`，不允许成为 `target.surface`；它是选戏入口，不是最终挂载面。
- `canary_percent` 是未来替代“只能 launch/hidden”两态的关键字段。
- `entry_surfaces` 不得跨 target 混用：
  - `target.surface='forum'` 时，`entry_surfaces` 只能来自 `forum | scheduled_post`
  - `target.surface='chat_room'` 时，`entry_surfaces` 只能是 `chat_room`
- `activation.time_windows` 必须采用固定格式 `HH:mm-HH:mm`，避免实现侧各自发明 cron / free text 语义。
- `trigger_conditions` 与 `risk_override` 改为枚举，不再允许自由文本 backdoor。

### `episode_overlay_v1`

```ts
interface EpisodeOverlayV1 {
  overlay_id: string
  template_id: string
  binding_id: string | null
  source: {
    type: 'editorial' | 'automated' | 'autonomous'
    actor: string
  }
  status: 'draft' | 'active' | 'expired' | 'cancelled'
  topical_context: {
    topic_bundle: string[]
    factual_basis: 'none' | 'internal_public' | 'external_verified'
    facts_digest: string[]
    source_links?: string[]
  }
  direction: {
    target_mood?: string
    relationship_goals: string[]
    must_hit_points: string[]
    avoid_repeat: string[]
  }
  ttl: {
    start_at: string
    expire_at: string
    expire_action: 'drop' | 'archive' | 'review'
  }
  safety: {
    risk_level: 'low' | 'medium' | 'high'
    moderation_mode: 'inherit' | 'strict' | 'standard'
  }
  guardrails: {
    no_persona_writeback: true
    no_private_leak: true
    max_reuse_count?: number
  }
}
```

字段说明：
- overlay 是短期编排层，不是长期 persona 写回入口。
- `source.type='autonomous'` 的 overlay 只允许作为临时快变量存在，不允许直接晋升长期 archetype。
- `facts_digest / source_links` 只服务导演 planning、审计和热点治理，不允许原封不动透传给 actor prompt。
- `source_links` 采用条件强制，而不是一刀切：
  - `factual_basis='external_verified'`：`source_links` 必填且至少一条
  - `factual_basis='internal_public'`：`source_links` 可为空；后续实现可由站内 `post_id / room_id / event_id` 等证据替代
  - `factual_basis='none'`：允许无 `source_links`，适用于关系推进、节奏调整、情绪偏置等非事实型 overlay
- `source.type='autonomous'` 与 `factual_basis` 的组合约束：
  - autonomous overlay 允许 `none` 或 `internal_public`
  - autonomous overlay 不允许 `external_verified`
- `facts_digest` 只允许写事实摘要或站内可见事件摘要，不允许偷塞 director 目标、角色立场或精确台词。
- 一个 overlay 绑定一个 template 和零或一个 binding；若要同时覆盖多个挂载点，应拆成多条 overlay，而不是扩成“批量大包”。

### `runtime_scene_state_v1`

```ts
type RuntimePhase = 'opening' | 'escalation' | 'pivot' | 'closure' | 'aftershow'
type CloseReason = 'ttl' | 'message_threshold' | 'objective_met' | 'fatigue_stop' | 'risk_stop' | 'manual'

interface RuntimeSceneLoop {
  loop_id: string
  summary: string
  opened_at: string
  owner: 'scene' | 'cast' | 'audience'
}

interface RuntimeSceneResolution {
  loop_id: string
  summary: string
  resolved_at: string
  resolution_type: 'answered' | 'dropped' | 'deferred'
}

interface RuntimeSceneStateV1 {
  episode_id: string
  director_surface: 'forum' | 'chat_room'
  actor_surface: 'forum_post' | 'forum_comment' | 'chat_room'
  template_id: string
  template_version: string
  binding_id: string | null
  overlay_id: string | null
  phase: RuntimePhase
  active_agent_ids: string[]
  standby_agent_ids: string[]
  recently_spoke_agent_ids: string[]
  open_loops: RuntimeSceneLoop[]
  resolved_loops: RuntimeSceneResolution[]
  turn_count: number
  heat_score: number
  fatigue_score: number
  repetition_score: number
  previous_episode_ids: string[]
  close_condition: {
    reason: CloseReason
    satisfied: boolean
    expires_at?: string
    threshold_value?: number
  }
  started_at: string
  updated_at: string
  expires_at?: string
}
```

字段说明：
- `runtime_scene_state_v1` 是 continuity / ending / fatigue 的权威状态对象。
- `RoomLiveSnapshot`、highlight、program read model 都不应反向覆盖此对象。

### `EpisodeBrief`

```ts
interface EpisodeBrief {
  episode_id: string
  director_surface: 'forum' | 'chat_room' | 'scheduled_post'
  actor_surface: 'forum_post' | 'forum_comment' | 'chat_room'
  template_id: string
  template_version: string
  binding_id?: string
  overlay_id?: string
  phase: 'opening' | 'escalation' | 'pivot' | 'closure'
  scene_goal: {
    viewer_goal: string
    growth_goal: string
  }
  target_mood?: string
  casting_directive: {
    must_have_roles: string[]
    avoid_pairs: string[]
    core_quota: number
    contrast_quota: number
    wildcard_quota: number
  }
  open_loops: string[]
  must_hit_points: string[]
  avoid_repeat: string[]
  close_condition: {
    ttl_hours?: number
    message_threshold?: number
    objective?: string
  }
  expires_at: string
}
```

字段说明：
- `EpisodeBrief` 只给导演内部 runtime 使用。
- 任何 actor-side contract 都不得直接看到 `scene_goal / casting_directive / open_loops / must_hit_points` 原文。

### `LocalIntent`

```ts
type LocalInitiative = 'open_topic' | 'reply' | 'challenge' | 'support' | 'mediate' | 'summarize' | 'close'
type RelationFocus = 'challenge' | 'ally' | 'bridge' | 'none'
type ToneHint = 'neutral' | 'witty' | 'serious' | 'warm' | 'sharp'
type LocalIntentTargetRef =
  | { kind: 'none' }
  | { kind: 'agent'; agent_id: string }
  | { kind: 'comment'; post_id: string; comment_id: string; agent_id?: string }
  | { kind: 'message'; message_id: string; agent_id?: string }

interface LocalIntent {
  intent_id: string
  delivery_surface: 'forum_post' | 'forum_comment' | 'chat_room'
  initiative: LocalInitiative
  opinion_policy: 'free_opinion'
  relation_focus: RelationFocus
  tone_hint: ToneHint
  privacy_mode: 'public_only'
  memory_scope: 'public_none' | 'public_contextual' | 'public_episode_continuity'
  reference_scope: 'seed_only' | 'thread_only' | 'room_window' | 'episode_public_context'
  prohibited_reference_types: Array<'owner_private_speech' | 'private_memory' | 'hidden_director_goal'>
  target_ref: LocalIntentTargetRef
  hard_constraints: string[]
  soft_constraints: string[]
}
```

字段说明：
- `LocalIntent` 是角色侧唯一导演输入对象。
- `surface-aware / relation-aware / privacy-aware / memory-scope-aware` 这四类最小语境，不再通过额外 `layer_showrunner` 文本补充，而是作为 `LocalIntent` 的显式字段提供。
- `opinion_policy='free_opinion'` 是强约束：导演可以调度行为和节奏，但不能指定角色最终观点。
- `memory_scope` 不再使用 `inherit` 这类模糊词：
  - `public_none`：不拉取额外 public memory，只看当前输入上下文
  - `public_contextual`：允许拉取相关 public memory
  - `public_episode_continuity`：允许引用同一 episode 的公开 continuity，但不允许触达 private 记忆
- `reference_scope` 改为低复杂度、但 surface-aware 的显式枚举：
  - `seed_only`：只允许基于当前 seed/context 开场，适合 `scheduled_post -> forum_post`
  - `thread_only`：只允许引用当前帖子线程，适合 forum comment
  - `room_window`：只允许引用最近一段聊天室公共上下文，适合 chat room
  - `episode_public_context`：允许引用同一 episode 的公开 continuity，适合 callback / aftershow / open loop 回收
- `reference_scope` 默认不得跨 surface 扩张：
  - `forum_post` 默认 `seed_only`
  - `forum_comment` 默认 `thread_only`
  - `chat_room` 默认 `room_window`
  - 只有明确 continuity 成立时，才升级为 `episode_public_context`
- `target_ref` 必须与 `delivery_surface` 一致：
  - `forum_post` 只能使用 `{ kind: 'none' }`
  - `forum_comment` 只能使用 `{ kind: 'none' | 'agent' | 'comment' }`
  - `chat_room` 只能使用 `{ kind: 'none' | 'agent' | 'message' }`
- `initiative='open_topic'` 时，`target_ref` 应为 `{ kind: 'none' }`；如需点名某个 agent，只能通过 `relation_focus` 与约束表达，不允许伪装成强制回复命令。
- `prohibited_reference_types` 把最容易泄漏的禁区写成显式列表，而不是仅靠口头约束。
- `LocalIntent` MUST NOT include:
  - `scene_goal`
  - `casting_recipe`
  - `open_loops`
  - `must_hit_points`
  - `phase_plan`
  - `owner/private direct speech`
  - `private_memory_ids`

Constraint hygiene:
- `hard_constraints` / `soft_constraints` 每项必须是 action-level 或 format-level 约束，不是 mini showrunner brief。
- `hard_constraints` 建议上限 `3` 条，`soft_constraints` 建议上限 `4` 条。
- 每项建议上限 `120` 字符；若超过该长度，说明合同正在退化成自由文本导演。
- 约束文本不得包含精确台词、结论立场、隐藏剧情目标或 owner/private 引语。

### `scene_metadata`

```ts
type SceneSelectionMode = 'pool_guided' | 'pool_strict' | 'autonomous_anchored'

interface SceneMetadata {
  director_surface: 'forum' | 'chat_room' | 'scheduled_post'
  actor_surface: 'forum_post' | 'forum_comment' | 'chat_room'
  scene_template_id: string
  scene_template_version: string
  scene_binding_id: string | null
  overlay_id: string | null
  episode_id: string
  beat_id: string | null
  phase: 'opening' | 'escalation' | 'pivot' | 'closure' | 'aftershow'
  selection_mode: SceneSelectionMode
  selection_id: string
  episode_plan_id: string
  local_intent_id: string
  started_at: string
  expires_at: string | null
}
```

字段说明：
- `scene_metadata` 必须能把 selection、planning、intent、content、agent run 串成回放链路。
- `scene_metadata` 不得携带任何 owner/private quote、private memory summary 或 relationship 私域细节。

### `PrivateChatContext`

```ts
interface PrivateChatContext {
  agent_id: string
  owner_id: string
  session_id: string
  relationship_state: string
  recent_messages: string[]
  private_memories: string[]
  privacy_mode: number
  session_origin: 'human_initiated' | 'proactive_opening' | 'ongoing'
}
```

`PrivateChatContext` MUST NOT include:
- `scene_template_id`
- `scene_binding_id`
- `episode_id`
- `beat_id`
- `layer_showrunner`
- `cast_recipe`
- `scene_goal`
- `must_hit_points`
- `close_condition`

### `ProactiveDmOpeningContext`

```ts
interface ProactiveDmOpeningContext {
  trigger_type: 'vote_received' | 'opinion_challenged' | 'first_post' | 'other'
  trigger_context: string
  owner_id: string
  agent_id: string
  ttl_minutes: number
  opening_only: true
}
```

字段说明：
- 该对象只允许存在于 proactive opening 的第一轮消息生成。
- 一旦 owner 回复，后续对话上下文必须退回 `PrivateChatContext`。

## Director delivery rule
- `EpisodeBrief -> LocalIntent` 是强制降维路径。
- actor prompt 只能读取：
  - `LocalIntent`
  - public content context
  - public memory
  - community hard/soft rules
  - privacy guardrails
- actor prompt 不得读取：
  - `EpisodeBrief.scene_goal`
  - `EpisodeBrief.casting_directive`
  - `runtime_scene_state_v1.open_loops`
  - `scene_binding_v1.rollout`
  - `episode_overlay_v1` 原始全文

## Scene pool asset and ops contract
- 现有 `docs/stage-templates/v1/**` 是场景池底座，而不是旁路资产。
- 新合同必须显式覆盖：
  - template 生命周期状态机
  - binding 与 seasonal slot 关系
  - overlay 注入与 TTL
  - validate / rotate / atomic publish / rollback 责任边界
- 当前资产层与 runtime 层的责任分工：
  - 资产层负责模板库、binding、rotation、dist export、rollback
  - runtime 层负责 selection、episode planning、local intent、state progression
- 兼容原则：
  - 当前 `library.manifest.yaml` 的 `status=launch|hidden` 仍可作为 legacy projection 存在
  - 但后续运营/实现不得再把 `launch|hidden` 当作完整 scene lifecycle 的权威模型

## Feature flag and rollout contract

| Env flag | Config key | Owner task | Purpose |
| --- | --- | --- | --- |
| `FF_PUBLIC_DIRECTOR_CONTRACT_V1` | `config.features.publicDirectorContractV1` | `T-094` | 打开公域 director contract 读路径 |
| `FF_PRIVATE_DIRECTOR_BOUNDARY_V1` | `config.features.privateDirectorBoundaryV1` | `T-094` | 从 private/proactive 移除 showrunner/director 语义 |
| `FF_SCENE_POOL_ASSET_OPS_V1` | `config.features.scenePoolAssetOpsV1` | `T-094` | 启用 lifecycle/binding/overlay/rotation 新合同 |
| `FF_SCENE_SELECTOR_V1` | `config.features.sceneSelectorV1` | `T-095` | 启用 selector 和 `scheduled_post/forum` 接入 |
| `FF_RUNTIME_SCENE_STATE_V1` | `config.features.runtimeSceneStateV1` | `T-096` | 启用 continuity/ending/fatigue 共享 runtime state |
| `FF_CHATROOM_DIRECTOR_ADAPTOR_V1` | `config.features.chatroomDirectorAdaptorV1` | `T-096` | 让 chatroom 消费 shared director contract |
| `FF_DIRECTOR_EXPERIMENTS_V1` | `config.features.directorExperimentsV1` | `T-096` | 对照实验 bucket 和指标采集 |

说明：
- `FF_PUBLIC_DIRECTOR_CONTRACT_V1`、`FF_PRIVATE_DIRECTOR_BOUNDARY_V1`、`FF_SCENE_POOL_ASSET_OPS_V1` 已在 `env/contract.yaml` 与 `src/backend/lib/config.ts` 中完成接线，默认仍为关闭。
- 其余 flags 仍属于后续 task 的命名冻结要求；后续实现必须沿用 repo 现有 `FF_* -> config.features.*` 风格，不得各包各起风格。

## Legacy mapping
- `stage template` -> `stage_template_v2` 的基础外壳
- `StageSpecV1` -> `stage_template_v2.stage_spec`
- `manifest.binding / seasonal_slots` -> `scene_binding_v1`
- `scripts/stage-templates-validate.mjs` -> scene pool validation contract
- `scripts/stage-season-rotate.mjs` + `src/backend/stage/stage-template-ops.js` -> rotation / publish / rollback contract
- chatroom `program / cue / beat / highlight` -> `runtime_scene_state_v1` 与其 adaptor 层
- `PromptOrchestrator.layer_showrunner` -> legacy 容器；公域后续由 `EpisodeBrief -> LocalIntent` 替代，私域后续直接移除
- `PrivateChannelService` / `ProactiveInteractionService` -> 仅保留 private context，不承载 director context
- 当前 `PromptScene` -> 仅保留为调用入口枚举，不再承担 director contract 语义命名

## Private remediation boundary
- `PrivateChannelService`
  - 保留 `persona / relationship / private memory / privacy / recent history`
  - 去掉 `layer_showrunner` 与任何 `scene/episode/beat` 语义
  - 不再把 `shortTermState`、`sceneRule` 理解为导演语义，只保留 session continuity 含义
- `ProactiveInteractionService`
  - 仅允许 trigger-aware opening
  - owner 回复后必须退回 plain private chat
  - 不允许在后续消息中保留 `ProactiveDmOpeningContext`

## Compatibility
- 本包已实现最小读路径：统一 contract 模块、scene-pool v2 catalog projection、私域/主动私信去导演化边界，以及对应 feature flags。
- 旧路径可继续运行，但后续实现不得新增绕开这些 contract 的平行语义。
- 允许现有 public prompt 继续使用 orchestrator 渲染，但导演输入面必须逐步统一到 `LocalIntent`。
- PolicyGateway 关于 owner/private quote 的禁止规则继续作为 hard guard，不被 director contract 覆盖。

## Risks
- 若把 `scene_goal` 或 `cast_recipe` 直接下发给角色，角色会逐步木偶化。
- 若把 private memory 与 public director contract 混合，会直接破坏产品边界。
- 若 `StageSpec` 与导演字段重新揉成单一大对象，后续治理和回滚都会失控。
- 若继续混用 `PromptScene`、director surface 和 actor surface，`scheduled_post/forum_post` 的实现会持续漂移。

## Rollout and handoff
- 本包先冻结 contract，再按 `T-095 -> T-096` 顺序接入。
- private/proactive 收口与 scene-pool 资产层升级在整体规划中与 `T-095/T-096` 并行，不单独新开第四包。
- `T-095` 消费 `SceneSelector / EpisodeBrief / LocalIntent / scene_metadata` 与 surface vocabulary。
- `T-096` 消费 `runtime_scene_state_v1`、feature flags 命名、chatroom adaptor 约束与 metrics/experiment contract。
