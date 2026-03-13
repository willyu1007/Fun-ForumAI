import { z } from 'zod'

export const DIRECTOR_SURFACES = ['forum', 'chat_room', 'scheduled_post']
export const ACTOR_SURFACES = ['forum_post', 'forum_comment', 'chat_room']
export const PRIVATE_SURFACES = ['private_chat', 'proactive_dm']

const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const LEGACY_FORUM_ENTRY_SURFACES = ['forum', 'scheduled_post']

export const directorSurfaceSchema = z.enum(DIRECTOR_SURFACES)
export const actorSurfaceSchema = z.enum(ACTOR_SURFACES)
export const privateSurfaceSchema = z.enum(PRIVATE_SURFACES)

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

const legacyStageSpecEnvelopeSchema = z.object({
  version: z.literal('v1'),
}).passthrough()

const legacyTemplateDocumentSchema = z.object({
  template_id: z.string().min(1),
  name: z.string().min(1).optional(),
  category: z.enum(['theme', 'show', 'world', 't4']).optional(),
  visibility: z.enum(['launch', 'hidden']).optional(),
  stage_spec: legacyStageSpecEnvelopeSchema,
  director: stageTemplateDirectorSchema.optional(),
}).passthrough()

export const stageTemplateV2Schema = z.object({
  template_id: z.string().min(1),
  template_version: z.string().min(1).default('legacy-v1'),
  name: z.string().min(1),
  category: z.enum(['theme', 'show', 'world', 't4']),
  lifecycle_status: z.enum([
    'draft',
    'hidden',
    'canary',
    'seasonal_active',
    'core_active',
    'retiring',
    'archived',
    'blocked',
  ]),
  stage_spec: legacyStageSpecEnvelopeSchema,
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
  binding_type: z.enum(['core', 'seasonal', 'campaign', 'event']),
  status: z.enum(['draft', 'canary', 'active', 'retiring', 'paused', 'archived']),
  entry_surfaces: z.array(z.enum(['forum', 'scheduled_post', 'chat_room'])).min(1),
  target: sceneBindingTargetSchema,
  lifecycle: z.object({
    start_at: z.string().min(1).optional(),
    end_at: z.string().min(1).optional(),
  }).strict().default({}),
  weights: z.object({
    editorial_priority: z.number().min(0).max(100).default(0),
    base_weight: z.number().min(0).max(100).default(1),
    freshness_bonus: z.number().min(0).max(100).default(0),
  }).strict().default({
    editorial_priority: 0,
    base_weight: 1,
    freshness_bonus: 0,
  }),
  activation: z.object({
    time_windows: z.array(z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/)).default([]),
    allowed_days: z.array(z.enum(WEEK_DAYS)).default([...WEEK_DAYS]),
    trigger_conditions: z.array(z.enum([
      'editorial_window',
      'community_event',
      'hot_topic_match',
      'continuity_followup',
      'manual_campaign',
    ])).default([]),
  }).strict().default({
    time_windows: [],
    allowed_days: [...WEEK_DAYS],
    trigger_conditions: [],
  }),
  governance: z.object({
    canary_percent: z.number().int().min(1).max(100).optional(),
    risk_override: z.enum(['none', 'review_required', 'strict_only', 'block']).optional(),
  }).strict().default({}),
  constraints: z.object({
    max_runs_per_day: z.number().int().min(1).max(128).optional(),
    cooldown_hours: z.number().int().min(0).max(168).optional(),
  }).strict().default({}),
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

export const runtimeSceneStateV1Schema = z.object({
  episode_id: z.string().min(1),
  director_surface: z.enum(['forum', 'chat_room']),
  actor_surface: actorSurfaceSchema,
  template_id: z.string().min(1),
  template_version: z.string().min(1),
  binding_id: z.string().min(1).nullable(),
  overlay_id: z.string().min(1).nullable(),
  phase: z.enum(['opening', 'escalation', 'pivot', 'closure', 'aftershow']),
  active_agent_ids: z.array(z.string().min(1)).default([]),
  standby_agent_ids: z.array(z.string().min(1)).default([]),
  recently_spoke_agent_ids: z.array(z.string().min(1)).default([]),
  open_loops: z.array(z.object({
    loop_id: z.string().min(1),
    summary: z.string().min(1),
    opened_at: z.string().min(1),
    owner: z.enum(['scene', 'cast', 'audience']),
  }).strict()).default([]),
  resolved_loops: z.array(z.object({
    loop_id: z.string().min(1),
    summary: z.string().min(1),
    resolved_at: z.string().min(1),
    resolution_type: z.enum(['answered', 'dropped', 'deferred']),
  }).strict()).default([]),
  turn_count: z.number().int().min(0).default(0),
  heat_score: z.number().min(0).default(0),
  fatigue_score: z.number().min(0).default(0),
  repetition_score: z.number().min(0).default(0),
  previous_episode_ids: z.array(z.string().min(1)).default([]),
  close_condition: z.object({
    reason: z.enum(['ttl', 'message_threshold', 'objective_met', 'fatigue_stop', 'risk_stop', 'manual']),
    satisfied: z.boolean(),
    expires_at: z.string().min(1).optional(),
    threshold_value: z.number().optional(),
  }).strict(),
  started_at: z.string().min(1),
  updated_at: z.string().min(1),
  expires_at: z.string().min(1).optional(),
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

export function parseLegacyStageTemplateDocument(input) {
  return legacyTemplateDocumentSchema.parse(input)
}

export function projectLegacyLifecycleStatus(item) {
  if (item.status === 'launch') {
    return item.binding?.binding_type === 'seasonal' ? 'seasonal_active' : 'core_active'
  }
  return 'hidden'
}

function getLegacyDefaultDirectorSurfaces() {
  return [...LEGACY_FORUM_ENTRY_SURFACES]
}

function buildStageTemplateDirector(item, directorInput) {
  return stageTemplateDirectorSchema.parse({
    ...directorInput,
    applicable_surfaces: directorInput?.applicable_surfaces ?? getLegacyDefaultDirectorSurfaces(item),
  })
}

function resolveLegacyBindingEntrySurfaces(director) {
  const applicableSurfaces = director?.applicable_surfaces ?? getLegacyDefaultDirectorSurfaces()
  return LEGACY_FORUM_ENTRY_SURFACES.filter((surface) => applicableSurfaces.includes(surface))
}

function buildBindingId(item) {
  if (!item.binding) return `${item.id}:unbound`
  const slotSuffix = item.binding.slot ? `:${item.binding.slot}` : ''
  return `${item.id}:forum:${item.binding.community_slug}:${item.binding.binding_type}${slotSuffix}`
}

export function buildSceneBindingV1FromManifestItem(item, director = null) {
  if (!item.binding) return null
  return sceneBindingV1Schema.parse({
    binding_id: buildBindingId(item),
    template_id: item.id,
    template_version: 'legacy-v1',
    binding_type: item.binding.binding_type,
    status: item.status === 'launch' ? 'active' : 'paused',
    entry_surfaces: resolveLegacyBindingEntrySurfaces(director),
    target: {
      surface: 'forum',
      community_slug: item.binding.community_slug,
      seasonal_slot: item.binding.slot ?? null,
    },
    lifecycle: {},
    weights: {
      editorial_priority: item.binding.binding_type === 'seasonal' ? 10 : 5,
      base_weight: 1,
      freshness_bonus: item.binding.binding_type === 'seasonal' ? 1 : 0,
    },
    activation: {
      time_windows: [],
      allowed_days: [...WEEK_DAYS],
      trigger_conditions: [],
    },
    governance: {},
    constraints: {},
  })
}

export function projectLegacyTemplateToStageTemplateV2(item, templateDoc) {
  const doc = parseLegacyStageTemplateDocument(templateDoc)
  const director = buildStageTemplateDirector(item, doc.director)
  return stageTemplateV2Schema.parse({
    template_id: item.id,
    template_version: 'legacy-v1',
    name: doc.name ?? item.id,
    category: doc.category ?? item.category,
    lifecycle_status: projectLegacyLifecycleStatus(item),
    stage_spec: doc.stage_spec,
    director,
  })
}

export function buildScenePoolCatalogFromManifest(manifest, templateDocs, exportedAt) {
  const templateDocsById = new Map(templateDocs.map((entry) => [entry.id, entry.doc]))
  const templates = []
  const stageTemplates = []
  const sceneBindings = []

  for (const item of manifest.templates ?? []) {
    const doc = templateDocsById.get(item.id)
    if (!doc) {
      throw new Error(`Missing template document for manifest item: ${item.id}`)
    }
    const stageTemplate = projectLegacyTemplateToStageTemplateV2(item, doc)
    const sceneBinding = buildSceneBindingV1FromManifestItem(item, stageTemplate.director)
    templates.push({
      id: item.id,
      category: item.category,
      status: item.status,
      binding: item.binding ?? null,
      stage_spec: stageTemplate.stage_spec,
      name: stageTemplate.name,
      director: stageTemplate.director,
      lifecycle_status: stageTemplate.lifecycle_status,
      stage_template_v2: stageTemplate,
      scene_binding_v1: sceneBinding,
    })
    stageTemplates.push(stageTemplate)
    if (sceneBinding) {
      sceneBindings.push(sceneBinding)
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
