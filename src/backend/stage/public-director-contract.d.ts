import type { ZodType } from 'zod'
import type { StageSpecV1 } from './stage-spec.js'

export type DirectorSurface = 'forum' | 'chat_room' | 'scheduled_post'
export type ActorSurface = 'forum_post' | 'forum_comment' | 'chat_room'
export type PrivateSurface = 'private_chat' | 'proactive_dm'

export interface StageTemplateDirector {
  applicable_surfaces: DirectorSurface[]
  scene_goal: {
    viewer_goal: string
    growth_goal: string
  }
  casting_recipe: {
    quota: number
    ratio: {
      core: number
      contrast: number
      wildcard: number
    }
    wildcard_cap: number
    must_have_roles: string[]
    avoid_pairs: string[]
    relationship_objectives: string[]
  }
  beat_plan: {
    phases: Array<'opening' | 'escalation' | 'pivot' | 'closure' | 'aftershow'>
    optional_beats: Array<{
      beat_id: string
      goal: string
      max_turns: number
    }>
  }
  fatigue_policy: {
    cooldown_hours: number
    repeat_penalty: number
    max_runs_per_day: number
  }
  closing_policy: {
    ttl_hours: number
    min_turns: number
    message_threshold: number
    aftershow_mode: 'off' | 'threshold' | 'periodic' | 'manual'
  }
  hot_topic_policy: {
    injection_mode: 'overlay_only' | 'curated' | 'hybrid'
    sensitive_topic_mode: 'strict' | 'standard'
  }
  autonomy_policy: {
    allow_autonomous_mutation: boolean
    require_pool_match_before_create: boolean
  }
}

export type StageTemplateAuthoringBinding =
  | {
      surface: 'forum'
      community_id?: string
      community_slug: string
      seasonal_slot?: string | null
      binding_type: 'core' | 'seasonal' | 'campaign' | 'event'
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
        trigger_conditions: Array<'editorial_window' | 'community_event' | 'hot_topic_match' | 'continuity_followup' | 'manual_campaign'>
      }
      governance: {
        canary_percent?: number
        risk_override?: 'none' | 'review_required' | 'strict_only' | 'block'
      }
      constraints: {
        max_runs_per_day?: number
        cooldown_hours?: number
      }
    }
  | {
      surface: 'chat_room'
      room_id: string
      binding_type: 'core' | 'seasonal' | 'campaign' | 'event'
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
        trigger_conditions: Array<'editorial_window' | 'community_event' | 'hot_topic_match' | 'continuity_followup' | 'manual_campaign'>
      }
      governance: {
        canary_percent?: number
        risk_override?: 'none' | 'review_required' | 'strict_only' | 'block'
      }
      constraints: {
        max_runs_per_day?: number
        cooldown_hours?: number
      }
    }

export interface StageTemplateAuthoringManifestItem {
  id: string
  category: 'theme' | 'show' | 'world' | 't4'
  path: string
  lifecycle_status: 'draft' | 'hidden' | 'canary' | 'seasonal_active' | 'core_active' | 'retiring' | 'archived' | 'blocked'
  bindings: StageTemplateAuthoringBinding[]
}

export interface StageTemplateAuthoringManifest {
  version: 'v2'
  generated_at?: string
  launch?: Record<string, unknown>
  templates: StageTemplateAuthoringManifestItem[]
  seasonal_slots: Array<{
    slot: string
    community_slug: string
  }>
  rotation_audit?: Array<{
    at: string
    open_count: number
    replaced: Array<{ slot: string; template_id: string }>
    activated: Array<{ slot: string; template_id: string }>
  }>
}

export interface StageTemplateAuthoringDocument {
  template_id: string
  template_version: 'v2'
  name: string
  category: 'theme' | 'show' | 'world' | 't4'
  notes?: string
  stage_spec: StageSpecV1 | (Record<string, unknown> & { version: 'v1' })
  director: StageTemplateDirector
}

export interface StageTemplateV2 {
  template_id: string
  template_version: string
  name: string
  category: 'theme' | 'show' | 'world' | 't4'
  lifecycle_status: 'draft' | 'hidden' | 'canary' | 'seasonal_active' | 'core_active' | 'retiring' | 'archived' | 'blocked'
  stage_spec: StageSpecV1 | (Record<string, unknown> & { version: 'v1' })
  director: StageTemplateDirector
}

export interface SceneBindingV1 {
  binding_id: string
  template_id: string
  template_version: string
  binding_type: 'core' | 'seasonal' | 'campaign' | 'event'
  status: 'draft' | 'canary' | 'active' | 'retiring' | 'paused' | 'archived'
  entry_surfaces: Array<'forum' | 'scheduled_post' | 'chat_room'>
  target:
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
    trigger_conditions: Array<'editorial_window' | 'community_event' | 'hot_topic_match' | 'continuity_followup' | 'manual_campaign'>
  }
  governance: {
    canary_percent?: number
    risk_override?: 'none' | 'review_required' | 'strict_only' | 'block'
  }
  constraints: {
    max_runs_per_day?: number
    cooldown_hours?: number
  }
}

export interface EpisodeOverlayV1 {
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

export interface RuntimeSceneStateV1 {
  runtime_scene_id: string
  director_surface: 'forum' | 'chat_room'
  actor_surface: ActorSurface
  community_id: string | null
  room_id: string | null
  scene_template_id: string
  scene_template_version: string
  scene_binding_id: string | null
  overlay_id: string | null
  episode_id: string
  phase: 'opening' | 'escalation' | 'pivot' | 'closure' | 'aftershow'
  status: 'active' | 'closing' | 'closed' | 'cooldown'
  cast: {
    active_agent_ids: string[]
    standby_agent_ids: string[]
    suppressed_agent_ids: string[]
    recently_spoke_agent_ids: string[]
    slot_audit: {
      core_agent_ids: string[]
      contrast_agent_ids: string[]
      wildcard_agent_ids: string[]
      must_have_role_hits: string[]
      target_active_count: number
    }
    cast_version: number
  }
  continuity: {
    previous_episode_ids: string[]
    open_loops: Array<{
      loop_id: string
      summary: string
      source: 'cue' | 'message' | 'highlight' | 'shared_memory' | 'manual'
      opened_at: string
    }>
    resolved_loops: Array<{
      loop_id: string
      summary: string
      resolution_type: 'answered' | 'callback' | 'dropped' | 'aftershow'
      resolved_at: string
    }>
  }
  dynamics: {
    turn_count: number
    message_count: number
    heat_score: number
    fatigue_score: number
    repetition_score: number
    phase_entered_at: string
  }
  close_condition: {
    reason: 'ttl' | 'threshold' | 'objective_met' | 'manual' | 'risk_stop' | 'fatigue_stop' | null
    satisfied: boolean
    objective_refs: string[]
    ttl_at: string | null
    message_threshold: number | null
    evaluated_at: string
  }
  aftershow: {
    mode: 'off' | 'threshold' | 'periodic' | 'manual'
    status: 'not_applicable' | 'pending' | 'due' | 'published' | 'skipped'
    artifact_ref: string | null
  }
  cooldown_until: string | null
  experiment: {
    bucket: 'A' | 'B' | 'C'
    assignment_source: 'feature_flag' | 'room_override' | 'manual'
  }
  audit: {
    selection_id: string | null
    episode_plan_id: string | null
    source: 'binding' | 'room_program'
    latest_local_intent_id: string | null
    latest_program_event_id: string | null
    state_version: number
  }
  started_at: string
  updated_at: string
  expires_at: string | null
  closed_at: string | null
}

export interface EpisodeBrief {
  episode_id: string
  director_surface: DirectorSurface
  actor_surface: ActorSurface
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

export type LocalIntentTargetRef =
  | { kind: 'none' }
  | { kind: 'agent'; agent_id: string }
  | { kind: 'comment'; post_id: string; comment_id: string; agent_id?: string }
  | { kind: 'message'; message_id: string; agent_id?: string }

export interface LocalIntent {
  intent_id: string
  delivery_surface: ActorSurface
  initiative: 'open_topic' | 'reply' | 'challenge' | 'support' | 'mediate' | 'summarize' | 'close'
  opinion_policy: 'free_opinion'
  relation_focus: 'challenge' | 'ally' | 'bridge' | 'none'
  tone_hint: 'neutral' | 'witty' | 'serious' | 'warm' | 'sharp'
  privacy_mode: 'public_only'
  memory_scope: 'public_none' | 'public_contextual' | 'public_episode_continuity'
  reference_scope: 'seed_only' | 'thread_only' | 'room_window' | 'episode_public_context'
  prohibited_reference_types: Array<'owner_private_speech' | 'private_memory' | 'hidden_director_goal'>
  target_ref: LocalIntentTargetRef
  hard_constraints: string[]
  soft_constraints: string[]
}

export interface SceneMetadata {
  director_surface: DirectorSurface
  actor_surface: ActorSurface
  scene_template_id: string
  scene_template_version: string
  scene_binding_id: string | null
  overlay_id: string | null
  episode_id: string
  beat_id: string | null
  phase: 'opening' | 'escalation' | 'pivot' | 'closure' | 'aftershow'
  selection_mode: 'pool_guided' | 'pool_strict' | 'autonomous_anchored'
  selection_id: string
  episode_plan_id: string
  local_intent_id: string
  started_at: string
  expires_at: string | null
}

export interface PrivateChatContext {
  agent_id: string
  owner_id: string
  session_id: string
  relationship_state: string
  recent_messages: string[]
  private_memories: string[]
  privacy_mode: number
  session_origin: 'human_initiated' | 'proactive_opening' | 'ongoing'
}

export interface ProactiveDmOpeningContext {
  trigger_type: 'vote_received' | 'opinion_challenged' | 'first_post' | 'other'
  trigger_context: string
  owner_id: string
  agent_id: string
  ttl_minutes: number
  opening_only: true
}

export interface ScenePoolCatalogEntry {
  id: string
  category: string
  status: 'launch' | 'hidden'
  binding: {
    surface: 'forum'
    community_slug: string
    seasonal_slot?: string | null
    binding_type: 'core' | 'seasonal' | 'campaign' | 'event'
  } | {
    surface: 'chat_room'
    room_id: string
    binding_type: 'core' | 'seasonal' | 'campaign' | 'event'
  } | null
  stage_spec: Record<string, unknown> & { version: 'v1' }
  name: string
  director: StageTemplateDirector
  lifecycle_status: StageTemplateV2['lifecycle_status']
  stage_template_v2: StageTemplateV2
  scene_binding_v1: SceneBindingV1 | null
}

export interface ScenePoolCatalog {
  version: 'v2'
  contract_version: 'public_director_contract_v1'
  exported_at: string
  templates: ScenePoolCatalogEntry[]
  stage_templates: StageTemplateV2[]
  scene_bindings: SceneBindingV1[]
  surface_vocabulary: {
    director_surfaces: DirectorSurface[]
    actor_surfaces: ActorSurface[]
    private_surfaces: PrivateSurface[]
  }
}

export const DIRECTOR_SURFACES: readonly DirectorSurface[]
export const ACTOR_SURFACES: readonly ActorSurface[]
export const PRIVATE_SURFACES: readonly PrivateSurface[]

export const directorSurfaceSchema: ZodType<DirectorSurface>
export const actorSurfaceSchema: ZodType<ActorSurface>
export const privateSurfaceSchema: ZodType<PrivateSurface>
export const stageTemplateDirectorSchema: ZodType<StageTemplateDirector>
export const stageTemplateAuthoringBindingSchema: ZodType<StageTemplateAuthoringBinding>
export const stageTemplateAuthoringManifestItemSchema: ZodType<StageTemplateAuthoringManifestItem>
export const stageTemplateAuthoringManifestSchema: ZodType<StageTemplateAuthoringManifest>
export const stageTemplateAuthoringDocumentSchema: ZodType<StageTemplateAuthoringDocument>
export const stageTemplateV2Schema: ZodType<StageTemplateV2>
export const sceneBindingV1Schema: ZodType<SceneBindingV1>
export const episodeOverlayV1Schema: ZodType<EpisodeOverlayV1>
export const runtimeSceneStateV1Schema: ZodType<RuntimeSceneStateV1>
export const episodeBriefSchema: ZodType<EpisodeBrief>
export const localIntentSchema: ZodType<LocalIntent>
export const sceneMetadataSchema: ZodType<SceneMetadata>
export const privateChatContextSchema: ZodType<PrivateChatContext>
export const proactiveDmOpeningContextSchema: ZodType<ProactiveDmOpeningContext>

export function parseStageTemplateAuthoringDocument(input: unknown): StageTemplateAuthoringDocument
export function parseStageTemplateAuthoringManifest(input: unknown): StageTemplateAuthoringManifest
export function normalizeManifestBindings(item: StageTemplateAuthoringManifestItem): StageTemplateAuthoringBinding[]
export function buildSceneBindingV1ListFromManifestItem(
  item: StageTemplateAuthoringManifestItem,
  director: StageTemplateDirector,
): SceneBindingV1[]
export function buildSceneBindingV1FromManifestItem(
  item: StageTemplateAuthoringManifestItem,
  director: StageTemplateDirector,
): SceneBindingV1 | null
export function buildStageTemplateV2FromAuthoring(
  item: StageTemplateAuthoringManifestItem,
  templateDoc: unknown,
): StageTemplateV2
export function buildScenePoolCatalogFromManifest(
  manifest: StageTemplateAuthoringManifest,
  templateDocs: Array<{ id: string; doc: unknown }>,
  exportedAt: string,
): ScenePoolCatalog
