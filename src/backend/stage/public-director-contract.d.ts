import type { ZodType } from 'zod'
import type { StageSpecV1 } from './stage-spec.js'
import type { StageTemplateManifest, StageTemplateManifestItem } from './stage-template-ops.js'

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
  episode_id: string
  director_surface: 'forum' | 'chat_room'
  actor_surface: ActorSurface
  template_id: string
  template_version: string
  binding_id: string | null
  overlay_id: string | null
  phase: 'opening' | 'escalation' | 'pivot' | 'closure' | 'aftershow'
  active_agent_ids: string[]
  standby_agent_ids: string[]
  recently_spoke_agent_ids: string[]
  open_loops: Array<{
    loop_id: string
    summary: string
    opened_at: string
    owner: 'scene' | 'cast' | 'audience'
  }>
  resolved_loops: Array<{
    loop_id: string
    summary: string
    resolved_at: string
    resolution_type: 'answered' | 'dropped' | 'deferred'
  }>
  turn_count: number
  heat_score: number
  fatigue_score: number
  repetition_score: number
  previous_episode_ids: string[]
  close_condition: {
    reason: 'ttl' | 'message_threshold' | 'objective_met' | 'fatigue_stop' | 'risk_stop' | 'manual'
    satisfied: boolean
    expires_at?: string
    threshold_value?: number
  }
  started_at: string
  updated_at: string
  expires_at?: string
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
  binding: StageTemplateManifestItem['binding']
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
export const stageTemplateV2Schema: ZodType<StageTemplateV2>
export const sceneBindingV1Schema: ZodType<SceneBindingV1>
export const episodeOverlayV1Schema: ZodType<EpisodeOverlayV1>
export const runtimeSceneStateV1Schema: ZodType<RuntimeSceneStateV1>
export const episodeBriefSchema: ZodType<EpisodeBrief>
export const localIntentSchema: ZodType<LocalIntent>
export const sceneMetadataSchema: ZodType<SceneMetadata>
export const privateChatContextSchema: ZodType<PrivateChatContext>
export const proactiveDmOpeningContextSchema: ZodType<ProactiveDmOpeningContext>

export function parseLegacyStageTemplateDocument(input: unknown): {
  template_id: string
  name?: string
  category?: 'theme' | 'show' | 'world' | 't4'
  visibility?: 'launch' | 'hidden'
  stage_spec: Record<string, unknown> & { version: 'v1' }
  director?: StageTemplateDirector
}

export function projectLegacyLifecycleStatus(
  item: Pick<StageTemplateManifestItem, 'status' | 'binding'>,
): StageTemplateV2['lifecycle_status']

export function buildSceneBindingV1FromManifestItem(
  item: StageTemplateManifestItem,
  director?: StageTemplateDirector | null,
): SceneBindingV1 | null

export function projectLegacyTemplateToStageTemplateV2(
  item: StageTemplateManifestItem,
  templateDoc: unknown,
): StageTemplateV2

export function buildScenePoolCatalogFromManifest(
  manifest: StageTemplateManifest,
  templateDocs: Array<{ id: string; doc: unknown }>,
  exportedAt: string,
): ScenePoolCatalog
