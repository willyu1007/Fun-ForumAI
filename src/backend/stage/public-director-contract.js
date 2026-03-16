import { z } from 'zod'

export const DIRECTOR_SURFACES = ['forum', 'chat_room', 'scheduled_post']
export const ACTOR_SURFACES = ['forum_post', 'forum_comment', 'chat_room']
export const PRIVATE_SURFACES = ['private_chat', 'proactive_dm']

const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const FORUM_ENTRY_SURFACES = ['forum', 'scheduled_post']
const TEMPLATE_CATEGORIES = ['theme', 'show', 'world', 't4']
const LIFECYCLE_STATUSES = [
  'draft',
  'hidden',
  'canary',
  'seasonal_active',
  'core_active',
  'retiring',
  'archived',
  'blocked',
]
const BINDING_TYPES = ['core', 'seasonal', 'campaign', 'event']
const BINDING_STATUSES = ['draft', 'canary', 'active', 'retiring', 'paused', 'archived']
const TRIGGER_CONDITIONS = [
  'editorial_window',
  'community_event',
  'hot_topic_match',
  'continuity_followup',
  'manual_campaign',
]

export const directorSurfaceSchema = z.enum(DIRECTOR_SURFACES)
export const actorSurfaceSchema = z.enum(ACTOR_SURFACES)
export const privateSurfaceSchema = z.enum(PRIVATE_SURFACES)

const templateCategorySchema = z.enum(TEMPLATE_CATEGORIES)
const lifecycleStatusSchema = z.enum(LIFECYCLE_STATUSES)
const bindingTypeSchema = z.enum(BINDING_TYPES)
const bindingStatusSchema = z.enum(BINDING_STATUSES)
const weekDaySchema = z.enum(WEEK_DAYS)
const triggerConditionSchema = z.enum(TRIGGER_CONDITIONS)

const stageSpecEnvelopeSchema = z.object({
  version: z.literal('v1'),
}).passthrough()

export const stageTemplateDirectorSchema = z.object({
  applicable_surfaces: z.array(directorSurfaceSchema).min(1).default([...DIRECTOR_SURFACES]),
  scene_goal: z.object({
    viewer_goal: z.string().min(1).default('为公域讨论提供可看、可读、可回放的互动结构。'),
    growth_goal: z.string().min(1).default('在不指定观点的前提下推动轻量公共成长与关系演化。'),
  }).strict().default({
    viewer_goal: '为公域讨论提供可看、可读、可回放的互动结构。',
    growth_goal: '在不指定观点的前提下推动轻量公共成长与关系演化。',
  }),
  casting_recipe: z.object({
    quota: z.number().int().min(1).max(16).default(4),
    ratio: z.object({
      core: z.number().int().min(1).max(8).default(2),
      contrast: z.number().int().min(0).max(8).default(1),
      wildcard: z.number().int().min(0).max(8).default(1),
    }).strict().default({
      core: 2,
      contrast: 1,
      wildcard: 1,
    }),
    wildcard_cap: z.number().int().min(0).max(8).default(1),
    must_have_roles: z.array(z.string().min(1)).default([]),
    avoid_pairs: z.array(z.string().min(1)).default([]),
    relationship_objectives: z.array(z.string().min(1)).default([]),
  }).strict().default({
    quota: 4,
    ratio: {
      core: 2,
      contrast: 1,
      wildcard: 1,
    },
    wildcard_cap: 1,
    must_have_roles: [],
    avoid_pairs: [],
    relationship_objectives: [],
  }),
  beat_plan: z.object({
    phases: z.array(z.enum(['opening', 'escalation', 'pivot', 'closure', 'aftershow']))
      .min(1)
      .default(['opening', 'escalation', 'pivot', 'closure']),
    optional_beats: z.array(z.object({
      beat_id: z.string().min(1),
      goal: z.string().min(1),
      max_turns: z.number().int().min(1).max(16),
    }).strict()).default([]),
  }).strict().default({
    phases: ['opening', 'escalation', 'pivot', 'closure'],
    optional_beats: [],
  }),
  fatigue_policy: z.object({
    cooldown_hours: z.number().int().min(0).max(168).default(24),
    repeat_penalty: z.number().min(0).max(10).default(1),
    max_runs_per_day: z.number().int().min(1).max(64).default(3),
  }).strict().default({
    cooldown_hours: 24,
    repeat_penalty: 1,
    max_runs_per_day: 3,
  }),
  closing_policy: z.object({
    ttl_hours: z.number().int().min(1).max(168).default(24),
    min_turns: z.number().int().min(1).max(64).default(3),
    message_threshold: z.number().int().min(1).max(512).default(12),
    aftershow_mode: z.enum(['off', 'threshold', 'periodic', 'manual']).default('off'),
  }).strict().default({
    ttl_hours: 24,
    min_turns: 3,
    message_threshold: 12,
    aftershow_mode: 'off',
  }),
  hot_topic_policy: z.object({
    injection_mode: z.enum(['overlay_only', 'curated', 'hybrid']).default('overlay_only'),
    sensitive_topic_mode: z.enum(['strict', 'standard']).default('standard'),
  }).strict().default({
    injection_mode: 'overlay_only',
    sensitive_topic_mode: 'standard',
  }),
  autonomy_policy: z.object({
    allow_autonomous_mutation: z.boolean().default(false),
    require_pool_match_before_create: z.boolean().default(true),
  }).strict().default({
    allow_autonomous_mutation: false,
    require_pool_match_before_create: true,
  }),
}).strict()

const bindingLifecycleSchema = z.object({
  start_at: z.string().min(1).optional(),
  end_at: z.string().min(1).optional(),
}).strict()

const bindingWeightsSchema = z.object({
  editorial_priority: z.number().min(0).max(100),
  base_weight: z.number().min(0).max(100),
  freshness_bonus: z.number().min(0).max(100),
}).strict()

const bindingActivationSchema = z.object({
  time_windows: z.array(z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/)),
  allowed_days: z.array(weekDaySchema),
  trigger_conditions: z.array(triggerConditionSchema),
}).strict()

const bindingGovernanceSchema = z.object({
  canary_percent: z.number().int().min(1).max(100).optional(),
  risk_override: z.enum(['none', 'review_required', 'strict_only', 'block']).optional(),
}).strict()

const bindingConstraintsSchema = z.object({
  max_runs_per_day: z.number().int().min(1).max(128).optional(),
  cooldown_hours: z.number().int().min(0).max(168).optional(),
}).strict()

const authoringBindingBaseSchema = z.object({
  binding_type: bindingTypeSchema,
  lifecycle: bindingLifecycleSchema,
  weights: bindingWeightsSchema,
  activation: bindingActivationSchema,
  governance: bindingGovernanceSchema,
  constraints: bindingConstraintsSchema,
}).strict()

export const stageTemplateAuthoringBindingSchema = z.discriminatedUnion('surface', [
  z.object({
    surface: z.literal('forum'),
    community_id: z.string().min(1).optional(),
    community_slug: z.string().min(1),
    seasonal_slot: z.string().min(1).nullable().optional(),
  }).merge(authoringBindingBaseSchema),
  z.object({
    surface: z.literal('chat_room'),
    room_id: z.string().min(1),
  }).merge(authoringBindingBaseSchema),
])

const rotationAuditSchema = z.object({
  at: z.string().min(1),
  open_count: z.number().int().min(1),
  replaced: z.array(z.object({
    slot: z.string().min(1),
    template_id: z.string().min(1),
  }).strict()),
  activated: z.array(z.object({
    slot: z.string().min(1),
    template_id: z.string().min(1),
  }).strict()),
}).strict()

export const stageTemplateAuthoringManifestItemSchema = z.object({
  id: z.string().min(1),
  category: templateCategorySchema,
  path: z.string().min(1),
  lifecycle_status: lifecycleStatusSchema,
  bindings: z.array(stageTemplateAuthoringBindingSchema),
}).strict()

export const stageTemplateAuthoringManifestSchema = z.object({
  version: z.literal('v2'),
  generated_at: z.string().min(1).optional(),
  launch: z.object({}).passthrough().optional(),
  seasonal_slots: z.array(z.object({
    slot: z.string().min(1),
    community_slug: z.string().min(1),
  }).strict()),
  rotation_audit: z.array(rotationAuditSchema).optional(),
  templates: z.array(stageTemplateAuthoringManifestItemSchema),
}).strict()

export const stageTemplateAuthoringDocumentSchema = z.object({
  template_id: z.string().min(1),
  template_version: z.literal('v2'),
  name: z.string().min(1),
  category: templateCategorySchema,
  notes: z.string().min(1).optional(),
  stage_spec: stageSpecEnvelopeSchema,
  director: stageTemplateDirectorSchema,
}).strict()

export const stageTemplateV2Schema = z.object({
  template_id: z.string().min(1),
  template_version: z.string().min(1),
  name: z.string().min(1),
  category: templateCategorySchema,
  lifecycle_status: lifecycleStatusSchema,
  stage_spec: stageSpecEnvelopeSchema,
  director: stageTemplateDirectorSchema,
}).strict()

const sceneBindingTargetSchema = z.discriminatedUnion('surface', [
  z.object({
    surface: z.literal('forum'),
    community_id: z.string().min(1).optional(),
    community_slug: z.string().min(1),
    seasonal_slot: z.string().min(1).nullable().optional(),
  }).strict(),
  z.object({
    surface: z.literal('chat_room'),
    room_id: z.string().min(1),
  }).strict(),
])

export const sceneBindingV1Schema = z.object({
  binding_id: z.string().min(1),
  template_id: z.string().min(1),
  template_version: z.string().min(1),
  binding_type: bindingTypeSchema,
  status: bindingStatusSchema,
  entry_surfaces: z.array(z.enum(['forum', 'scheduled_post', 'chat_room'])).min(1),
  target: sceneBindingTargetSchema,
  lifecycle: bindingLifecycleSchema.default({}),
  weights: bindingWeightsSchema.default({
    editorial_priority: 0,
    base_weight: 1,
    freshness_bonus: 0,
  }),
  activation: bindingActivationSchema.default({
    time_windows: [],
    allowed_days: [...WEEK_DAYS],
    trigger_conditions: [],
  }),
  governance: bindingGovernanceSchema.default({}),
  constraints: bindingConstraintsSchema.default({}),
}).strict()

export const episodeOverlayV1Schema = z.object({
  overlay_id: z.string().min(1),
  template_id: z.string().min(1),
  binding_id: z.string().min(1).nullable(),
  source: z.object({
    type: z.enum(['editorial', 'automated', 'autonomous']),
    actor: z.string().min(1),
  }).strict(),
  status: z.enum(['draft', 'active', 'expired', 'cancelled']),
  topical_context: z.object({
    topic_bundle: z.array(z.string().min(1)).default([]),
    factual_basis: z.enum(['none', 'internal_public', 'external_verified']).default('none'),
    facts_digest: z.array(z.string().min(1)).default([]),
    source_links: z.array(z.string().url()).optional(),
  }).strict(),
  direction: z.object({
    target_mood: z.string().min(1).optional(),
    relationship_goals: z.array(z.string().min(1)).default([]),
    must_hit_points: z.array(z.string().min(1)).default([]),
    avoid_repeat: z.array(z.string().min(1)).default([]),
  }).strict(),
  ttl: z.object({
    start_at: z.string().min(1),
    expire_at: z.string().min(1),
    expire_action: z.enum(['drop', 'archive', 'review']),
  }).strict(),
  safety: z.object({
    risk_level: z.enum(['low', 'medium', 'high']),
    moderation_mode: z.enum(['inherit', 'strict', 'standard']),
  }).strict(),
  guardrails: z.object({
    no_persona_writeback: z.literal(true),
    no_private_leak: z.literal(true),
    max_reuse_count: z.number().int().min(1).max(100).optional(),
  }).strict(),
}).strict()

const runtimeSceneLoopSchema = z.object({
  loop_id: z.string().min(1),
  summary: z.string().min(1),
  source: z.enum(['cue', 'message', 'highlight', 'shared_memory', 'manual']),
  opened_at: z.string().min(1),
}).strict()

const runtimeSceneResolvedLoopSchema = z.object({
  loop_id: z.string().min(1),
  summary: z.string().min(1),
  resolution_type: z.enum(['answered', 'callback', 'dropped', 'aftershow']),
  resolved_at: z.string().min(1),
}).strict()

export const runtimeSceneStateV1Schema = z.object({
  runtime_scene_id: z.string().min(1),
  director_surface: z.enum(['forum', 'chat_room']),
  actor_surface: actorSurfaceSchema,
  community_id: z.string().min(1).nullable(),
  room_id: z.string().min(1).nullable(),
  scene_template_id: z.string().min(1),
  scene_template_version: z.string().min(1),
  scene_binding_id: z.string().min(1).nullable(),
  overlay_id: z.string().min(1).nullable(),
  episode_id: z.string().min(1),
  phase: z.enum(['opening', 'escalation', 'pivot', 'closure', 'aftershow']),
  status: z.enum(['active', 'closing', 'closed', 'cooldown']),
  cast: z.object({
    active_agent_ids: z.array(z.string().min(1)).default([]),
    standby_agent_ids: z.array(z.string().min(1)).default([]),
    suppressed_agent_ids: z.array(z.string().min(1)).default([]),
    recently_spoke_agent_ids: z.array(z.string().min(1)).default([]),
    slot_audit: z.object({
      core_agent_ids: z.array(z.string().min(1)).default([]),
      contrast_agent_ids: z.array(z.string().min(1)).default([]),
      wildcard_agent_ids: z.array(z.string().min(1)).default([]),
      must_have_role_hits: z.array(z.string().min(1)).default([]),
      target_active_count: z.number().int().min(0).default(0),
    }).strict().default({
      core_agent_ids: [],
      contrast_agent_ids: [],
      wildcard_agent_ids: [],
      must_have_role_hits: [],
      target_active_count: 0,
    }),
    cast_version: z.number().int().min(0).default(0),
  }).strict(),
  continuity: z.object({
    previous_episode_ids: z.array(z.string().min(1)).default([]),
    open_loops: z.array(runtimeSceneLoopSchema).default([]),
    resolved_loops: z.array(runtimeSceneResolvedLoopSchema).default([]),
  }).strict(),
  dynamics: z.object({
    turn_count: z.number().int().min(0).default(0),
    message_count: z.number().int().min(0).default(0),
    heat_score: z.number().min(0).default(0),
    fatigue_score: z.number().min(0).default(0),
    repetition_score: z.number().min(0).default(0),
    phase_entered_at: z.string().min(1),
  }).strict(),
  close_condition: z.object({
    reason: z.preprocess(
      (value) => value === 'message_threshold' ? 'threshold' : value,
      z.enum(['ttl', 'threshold', 'objective_met', 'manual', 'risk_stop', 'fatigue_stop']).nullable(),
    ),
    satisfied: z.boolean(),
    objective_refs: z.array(z.string().min(1)).default([]),
    ttl_at: z.string().min(1).nullable(),
    message_threshold: z.number().int().min(1).nullable(),
    evaluated_at: z.string().min(1),
  }).strict(),
  aftershow: z.object({
    mode: z.enum(['off', 'threshold', 'periodic', 'manual']),
    status: z.enum(['not_applicable', 'pending', 'due', 'published', 'skipped']),
    artifact_ref: z.string().min(1).nullable(),
  }).strict(),
  cooldown_until: z.string().min(1).nullable(),
  experiment: z.object({
    bucket: z.enum(['A', 'B', 'C']),
    assignment_source: z.enum(['feature_flag', 'room_override', 'manual']),
  }).strict(),
  audit: z.object({
    selection_id: z.string().min(1).nullable(),
    episode_plan_id: z.string().min(1).nullable(),
    source: z.literal('binding'),
    latest_local_intent_id: z.string().min(1).nullable(),
    latest_program_event_id: z.string().min(1).nullable(),
    state_version: z.number().int().min(0),
  }).strict(),
  started_at: z.string().min(1),
  updated_at: z.string().min(1),
  expires_at: z.string().min(1).nullable(),
  closed_at: z.string().min(1).nullable(),
}).strict()

export const episodeBriefSchema = z.object({
  episode_id: z.string().min(1),
  director_surface: directorSurfaceSchema,
  actor_surface: actorSurfaceSchema,
  template_id: z.string().min(1),
  template_version: z.string().min(1),
  binding_id: z.string().min(1).optional(),
  overlay_id: z.string().min(1).optional(),
  phase: z.enum(['opening', 'escalation', 'pivot', 'closure']),
  scene_goal: z.object({
    viewer_goal: z.string().min(1),
    growth_goal: z.string().min(1),
  }).strict(),
  target_mood: z.string().min(1).optional(),
  casting_directive: z.object({
    must_have_roles: z.array(z.string().min(1)).default([]),
    avoid_pairs: z.array(z.string().min(1)).default([]),
    core_quota: z.number().int().min(0),
    contrast_quota: z.number().int().min(0),
    wildcard_quota: z.number().int().min(0),
  }).strict(),
  open_loops: z.array(z.string().min(1)).default([]),
  must_hit_points: z.array(z.string().min(1)).default([]),
  avoid_repeat: z.array(z.string().min(1)).default([]),
  close_condition: z.object({
    ttl_hours: z.number().int().min(1).optional(),
    message_threshold: z.number().int().min(1).optional(),
    objective: z.string().min(1).optional(),
  }).strict(),
  expires_at: z.string().min(1),
}).strict()

const localIntentTargetRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }).strict(),
  z.object({
    kind: z.literal('agent'),
    agent_id: z.string().min(1),
  }).strict(),
  z.object({
    kind: z.literal('comment'),
    post_id: z.string().min(1),
    comment_id: z.string().min(1),
    agent_id: z.string().min(1).optional(),
  }).strict(),
  z.object({
    kind: z.literal('message'),
    message_id: z.string().min(1),
    agent_id: z.string().min(1).optional(),
  }).strict(),
])

export const localIntentSchema = z.object({
  intent_id: z.string().min(1),
  delivery_surface: actorSurfaceSchema,
  initiative: z.enum(['open_topic', 'reply', 'challenge', 'support', 'mediate', 'summarize', 'close']),
  opinion_policy: z.literal('free_opinion'),
  relation_focus: z.enum(['challenge', 'ally', 'bridge', 'none']),
  tone_hint: z.enum(['neutral', 'witty', 'serious', 'warm', 'sharp']),
  privacy_mode: z.literal('public_only'),
  memory_scope: z.enum(['public_none', 'public_contextual', 'public_episode_continuity']),
  reference_scope: z.enum(['seed_only', 'thread_only', 'room_window', 'episode_public_context']),
  prohibited_reference_types: z.array(z.enum(['owner_private_speech', 'private_memory', 'hidden_director_goal'])).default([]),
  target_ref: localIntentTargetRefSchema,
  hard_constraints: z.array(z.string().min(1).max(120)).max(3).default([]),
  soft_constraints: z.array(z.string().min(1).max(120)).max(4).default([]),
}).strict()

export const sceneMetadataSchema = z.object({
  director_surface: directorSurfaceSchema,
  actor_surface: actorSurfaceSchema,
  scene_template_id: z.string().min(1),
  scene_template_version: z.string().min(1),
  scene_binding_id: z.string().min(1).nullable(),
  overlay_id: z.string().min(1).nullable(),
  episode_id: z.string().min(1),
  beat_id: z.string().min(1).nullable(),
  phase: z.enum(['opening', 'escalation', 'pivot', 'closure', 'aftershow']),
  selection_mode: z.enum(['pool_guided', 'pool_strict', 'autonomous_anchored']),
  selection_id: z.string().min(1),
  episode_plan_id: z.string().min(1),
  local_intent_id: z.string().min(1),
  started_at: z.string().min(1),
  expires_at: z.string().min(1).nullable(),
}).strict()

export const privateChatContextSchema = z.object({
  agent_id: z.string().min(1),
  owner_id: z.string().min(1),
  session_id: z.string().min(1),
  relationship_state: z.string().min(1),
  recent_messages: z.array(z.string()).default([]),
  private_memories: z.array(z.string()).default([]),
  privacy_mode: z.number().int(),
  session_origin: z.enum(['human_initiated', 'proactive_opening', 'ongoing']).default('ongoing'),
}).strict()

export const proactiveDmOpeningContextSchema = z.object({
  trigger_type: z.enum(['vote_received', 'opinion_challenged', 'first_post', 'other']),
  trigger_context: z.string().min(1),
  owner_id: z.string().min(1),
  agent_id: z.string().min(1),
  ttl_minutes: z.number().int().min(1).max(1440),
  opening_only: z.literal(true),
}).strict()

export function parseStageTemplateAuthoringDocument(input) {
  return stageTemplateAuthoringDocumentSchema.parse(input)
}

export function parseStageTemplateAuthoringManifest(input) {
  return stageTemplateAuthoringManifestSchema.parse(input)
}

function projectLifecycleStatusToBindingStatus(lifecycleStatus) {
  switch (lifecycleStatus) {
    case 'draft':
      return 'draft'
    case 'canary':
      return 'canary'
    case 'core_active':
    case 'seasonal_active':
      return 'active'
    case 'retiring':
      return 'retiring'
    case 'archived':
      return 'archived'
    case 'hidden':
    case 'blocked':
    default:
      return 'paused'
  }
}

function projectLifecycleStatusToCatalogStatus(lifecycleStatus) {
  switch (lifecycleStatus) {
    case 'core_active':
    case 'seasonal_active':
    case 'canary':
    case 'retiring':
      return 'launch'
    default:
      return 'hidden'
  }
}

export function normalizeManifestBindings(item) {
  return Array.isArray(item.bindings) ? item.bindings.filter(Boolean) : []
}

function resolveBindingEntrySurfaces(binding, director) {
  if (binding.surface === 'chat_room') {
    if (!director.applicable_surfaces.includes('chat_room')) {
      throw new Error('Chat room binding requires director.applicable_surfaces to include chat_room')
    }
    return ['chat_room']
  }

  const entrySurfaces = FORUM_ENTRY_SURFACES.filter((surface) => director.applicable_surfaces.includes(surface))
  if (entrySurfaces.length === 0) {
    throw new Error('Forum binding requires director.applicable_surfaces to include forum or scheduled_post')
  }
  return entrySurfaces
}

function buildBindingId(item, binding) {
  if (binding.surface === 'chat_room') {
    return `${item.id}:chat_room:${binding.room_id}:${binding.binding_type}`
  }
  const slotSuffix = binding.seasonal_slot ? `:${binding.seasonal_slot}` : ''
  return `${item.id}:forum:${binding.community_slug}:${binding.binding_type}${slotSuffix}`
}

function buildSceneBindingV1FromManifestBinding(item, binding, director) {
  if (binding.surface === 'chat_room') {
    return sceneBindingV1Schema.parse({
      binding_id: buildBindingId(item, binding),
      template_id: item.id,
      template_version: 'v2',
      binding_type: binding.binding_type,
      status: projectLifecycleStatusToBindingStatus(item.lifecycle_status),
      entry_surfaces: resolveBindingEntrySurfaces(binding, director),
      target: {
        surface: 'chat_room',
        room_id: binding.room_id,
      },
      lifecycle: binding.lifecycle,
      weights: binding.weights,
      activation: binding.activation,
      governance: binding.governance,
      constraints: binding.constraints,
    })
  }

  return sceneBindingV1Schema.parse({
    binding_id: buildBindingId(item, binding),
    template_id: item.id,
    template_version: 'v2',
    binding_type: binding.binding_type,
    status: projectLifecycleStatusToBindingStatus(item.lifecycle_status),
    entry_surfaces: resolveBindingEntrySurfaces(binding, director),
    target: {
      surface: 'forum',
      community_id: binding.community_id,
      community_slug: binding.community_slug,
      seasonal_slot: binding.seasonal_slot ?? null,
    },
    lifecycle: binding.lifecycle,
    weights: binding.weights,
    activation: binding.activation,
    governance: binding.governance,
    constraints: binding.constraints,
  })
}

export function buildSceneBindingV1ListFromManifestItem(item, director) {
  return normalizeManifestBindings(item).map((binding) =>
    buildSceneBindingV1FromManifestBinding(item, binding, director))
}

export function buildSceneBindingV1FromManifestItem(item, director) {
  return buildSceneBindingV1ListFromManifestItem(item, director)[0] ?? null
}

export function buildStageTemplateV2FromAuthoring(itemInput, templateDocInput) {
  const item = stageTemplateAuthoringManifestItemSchema.parse(itemInput)
  const templateDoc = parseStageTemplateAuthoringDocument(templateDocInput)
  if (templateDoc.template_id !== item.id) {
    throw new Error(`Template document id mismatch: manifest=${item.id} doc=${templateDoc.template_id}`)
  }
  if (templateDoc.category !== item.category) {
    throw new Error(`Template category mismatch: ${item.id}`)
  }

  return stageTemplateV2Schema.parse({
    template_id: templateDoc.template_id,
    template_version: templateDoc.template_version,
    name: templateDoc.name,
    category: templateDoc.category,
    lifecycle_status: item.lifecycle_status,
    stage_spec: templateDoc.stage_spec,
    director: templateDoc.director,
  })
}

function buildCatalogBindingPreview(binding) {
  if (!binding) return null
  if (binding.surface === 'chat_room') {
    return {
      surface: 'chat_room',
      room_id: binding.room_id,
      binding_type: binding.binding_type,
    }
  }
  return {
    surface: 'forum',
    community_slug: binding.community_slug,
    seasonal_slot: binding.seasonal_slot ?? null,
    binding_type: binding.binding_type,
  }
}

function pickPrimaryBinding(item) {
  const bindings = normalizeManifestBindings(item)
  return bindings.find((binding) => binding.surface === 'forum') ?? bindings[0] ?? null
}

export function buildScenePoolCatalogFromManifest(manifestInput, templateDocs, exportedAt) {
  const manifest = parseStageTemplateAuthoringManifest(manifestInput)
  const templateDocsById = new Map(templateDocs.map((entry) => [entry.id, entry.doc]))
  const templates = []
  const stageTemplates = []
  const sceneBindings = []

  for (const item of manifest.templates) {
    const doc = templateDocsById.get(item.id)
    if (!doc) {
      throw new Error(`Missing template document for manifest item: ${item.id}`)
    }

    const stageTemplate = buildStageTemplateV2FromAuthoring(item, doc)
    const sceneBindingList = buildSceneBindingV1ListFromManifestItem(item, stageTemplate.director)
    const primaryBinding = pickPrimaryBinding(item)
    const primarySceneBinding = sceneBindingList[0] ?? null

    templates.push({
      id: item.id,
      category: stageTemplate.category,
      status: projectLifecycleStatusToCatalogStatus(stageTemplate.lifecycle_status),
      binding: buildCatalogBindingPreview(primaryBinding),
      stage_spec: stageTemplate.stage_spec,
      name: stageTemplate.name,
      director: stageTemplate.director,
      lifecycle_status: stageTemplate.lifecycle_status,
      stage_template_v2: stageTemplate,
      scene_binding_v1: primarySceneBinding,
    })
    stageTemplates.push(stageTemplate)
    if (sceneBindingList.length > 0) {
      sceneBindings.push(...sceneBindingList)
    }
  }

  return {
    version: 'v2',
    contract_version: 'public_director_contract_v1',
    exported_at: exportedAt,
    templates,
    stage_templates: stageTemplates,
    scene_bindings: sceneBindings,
    surface_vocabulary: {
      director_surfaces: [...DIRECTOR_SURFACES],
      actor_surfaces: [...ACTOR_SURFACES],
      private_surfaces: [...PRIVATE_SURFACES],
    },
  }
}
