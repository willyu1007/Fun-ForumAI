export type MediaSourceKind =
  | 'owner_console_upload'
  | 'url_import'
  | 'private_message_upload'
  | 'generated'
  | 'platform_canonical'
  | 'community_commons'

export type MediaVisibilityPolicy =
  | 'private_only'
  | 'public_original_allowed'
  | 'public_derivative_only'
  | 'blocked'

export type MediaLifecycleStatus =
  | 'active'
  | 'archived'
  | 'blocked'

export type MediaSnapshotKind =
  | 'visual_core'
  | 'legacy_imported_partial'

export type MediaExtractionStatus =
  | 'completed'
  | 'fallback'
  | 'failed'

export type MediaQualityGrade =
  | 'rich'
  | 'legacy_imported_partial'
  | 'fallback'

export interface MediaSemanticSummary {
  theme: string
  scene: string
  mood: string
  discussion_points: string[]
  salient_entities: string[]
  ocr_snippets: string[]
  safety_labels: string[]
  public_safe_summary: string
  internal_full_summary: string
}

export interface MediaAsset {
  id: string
  steward_agent_id: string | null
  owner_user_id: string | null
  source_kind: MediaSourceKind
  source_scene_type: string | null
  source_scene_id: string | null
  visibility_policy: MediaVisibilityPolicy
  lifecycle_status: MediaLifecycleStatus
  storage_key: string | null
  origin_url: string | null
  mime_type: string
  file_size_bytes: number
  width: number | null
  height: number | null
  sha256: string
  phash: string | null
  created_at: Date
  updated_at: Date
}

export interface CreateMediaAssetInput {
  id?: string
  steward_agent_id?: string | null
  owner_user_id?: string | null
  source_kind: MediaSourceKind
  source_scene_type?: string | null
  source_scene_id?: string | null
  visibility_policy: MediaVisibilityPolicy
  lifecycle_status?: MediaLifecycleStatus
  storage_key?: string | null
  origin_url?: string | null
  mime_type: string
  file_size_bytes: number
  width?: number | null
  height?: number | null
  sha256: string
  phash?: string | null
}

export interface MediaSemanticSnapshot {
  id: string
  asset_id: string
  snapshot_kind: MediaSnapshotKind
  schema_version: string
  model_provider: string
  model_name: string
  model_version: string
  summary: MediaSemanticSummary
  extraction_status: MediaExtractionStatus
  quality_grade: MediaQualityGrade
  is_current: boolean
  created_at: Date
}

export interface CreateMediaSemanticSnapshotInput {
  id?: string
  asset_id: string
  snapshot_kind: MediaSnapshotKind
  schema_version: string
  model_provider: string
  model_name: string
  model_version: string
  summary: MediaSemanticSummary
  extraction_status: MediaExtractionStatus
  quality_grade: MediaQualityGrade
  is_current?: boolean
}

export type MediaSceneType =
  | 'forum_post'
  | 'forum_comment'
  | 'chat_room_message'
  | 'private_message'
  | 'memory_card'

export type MediaBindingRole =
  | 'primary'
  | 'inline'
  | 'reference'
  | 'memory'

export type MediaRelationToScene =
  | 'uploaded_by_owner'
  | 'selected_for_post'
  | 'attached_to_private_message'
  | 'quoted_public'
  | 'generated_for_scene'
  | 'derived_from_private'

export type MediaDisplayPolicy =
  | 'original_allowed'
  | 'derivative_only'
  | 'runtime_only_no_display'

export type MediaCreatedByType =
  | 'owner'
  | 'agent'
  | 'system'

export interface SceneMediaBinding {
  id: string
  scene_type: MediaSceneType
  scene_id: string
  asset_id: string
  semantic_snapshot_id: string
  source_scene_type: string | null
  source_scene_id: string | null
  binding_role: MediaBindingRole
  relation_to_scene: MediaRelationToScene
  binding_note_text: string | null
  display_policy: MediaDisplayPolicy
  created_by_type: MediaCreatedByType
  created_by_id: string
  created_at: Date
}

export interface CreateSceneMediaBindingInput {
  id?: string
  scene_type: MediaSceneType
  scene_id: string
  asset_id: string
  semantic_snapshot_id: string
  source_scene_type?: string | null
  source_scene_id?: string | null
  binding_role: MediaBindingRole
  relation_to_scene: MediaRelationToScene
  binding_note_text?: string | null
  display_policy: MediaDisplayPolicy
  created_by_type: MediaCreatedByType
  created_by_id: string
}

export type MediaProjectionSurface =
  | 'public_display'
  | 'public_runtime'
  | 'private_runtime'
  | 'memory'
  | 'retrieval'

export type MediaProjectionKind =
  | 'display_attachment'
  | 'public_media_context_card'
  | 'private_media_runtime_card'
  | 'private_media_memory_projection'
  | 'retrieval_caption'

export type DirectorSurface =
  | 'scheduled_post'
  | 'forum'
  | 'chat_room'
  | 'private_chat'

export type ActorSurface =
  | 'forum_post'
  | 'forum_comment'
  | 'chat_room_message'
  | 'private_message'

export type ScenePhase =
  | 'opening'
  | 'escalation'
  | 'pivot'
  | 'closure'
  | 'aftershow'

export type SelectionMode =
  | 'pool_guided'
  | 'pool_strict'
  | 'autonomous_anchored'

export type VisualNeed = 'required' | 'preferred' | 'avoid'

export type VisualRole =
  | 'scene_establishing'
  | 'memory_evidence'
  | 'mood_board'
  | 'callback_prop'
  | 'joke_payload'
  | 'illustration'
  | 'reaction_image'

export type VisualSourceKind =
  | 'owner_private_pool'
  | 'self_public_archive'
  | 'same_thread_public'
  | 'same_episode_public'
  | 'community_commons'
  | 'platform_canonical'
  | 'private_runtime_projection'
  | 'private_derived_public'
  | 'generated_public'

export type PromptWeight = 'primary' | 'secondary' | 'accent'

export type MentionPolicy =
  | 'explicit_describe'
  | 'allude'
  | 'silent_influence'

export type DisplayPolicy =
  | 'original_allowed'
  | 'derivative_only'
  | 'runtime_only_no_display'

export type AspectRatioHint = '1:1' | '4:5' | '16:9'

export type LocalPrivacyMode =
  | 'public_only'
  | 'public_safe_projection'
  | 'private_projection_allowed'

export type LocalMemoryScope =
  | 'thread_only'
  | 'public_contextual'
  | 'public_episode_continuity'
  | 'mixed'

export type LocalReferenceScope =
  | 'seed_only'
  | 'thread_only'
  | 'episode_only'
  | 'global_public'

export type PublicScope =
  | 'thread_only'
  | 'episode_only'
  | 'community_public'
  | 'global_public'

export type GenerationTier = 'none' | 'low' | 'medium' | 'high'

export interface SceneRef {
  request_id: string
  director_surface: DirectorSurface
  actor_surface: ActorSurface
  community_id?: string | null
  room_id?: string | null
  post_id?: string | null
  comment_id?: string | null
  message_id?: string | null
  episode_id?: string | null
  selection_id?: string | null
  episode_plan_id?: string | null
  local_intent_id?: string | null
  phase?: ScenePhase
  selection_mode?: SelectionMode
}

export interface VisualDirective {
  schema_version: 'visual-directive.v1'
  directive_id: string
  scene_ref: SceneRef
  goal: {
    need_image: VisualNeed
    visual_role: VisualRole
    human_goal:
      | 'immersion'
      | 'clarity'
      | 'humor'
      | 'continuity'
      | 'worldbuilding'
      | 'engagement'
    runtime_influence: 'none' | 'light' | 'medium' | 'strong'
    display_priority: 'none' | 'supporting' | 'primary'
  }
  narrative_context: {
    hook: string
    objective: string
    tone_hint: 'witty' | 'warm' | 'serious' | 'neutral'
    relation_focus:
      | 'bridge'
      | 'contrast'
      | 'solo'
      | 'ensemble'
      | 'support'
      | 'none'
    semantic_query: string
    required_elements?: string[]
    forbidden_elements?: string[]
    style_hint?: string | null
    aspect_ratio_hint?: AspectRatioHint | null
  }
  sourcing_policy: {
    allow_sources: VisualSourceKind[]
    prefer_order: VisualSourceKind[]
    allow_private_runtime_projection: boolean
    allow_private_inspired_generation: boolean
    allow_cross_agent_public: boolean
    allow_generation: boolean
    max_display_assets: 0 | 1 | 2 | 3
  }
  guardrails: {
    privacy_mode: LocalPrivacyMode
    memory_scope: LocalMemoryScope
    reference_scope: LocalReferenceScope
    display_policy: DisplayPolicy
    mention_policy: MentionPolicy
    text_in_image: 'avoid' | 'allow_short' | 'allow'
  }
  budget: {
    generation_tier: GenerationTier
    sync_generation_ms_budget: number
    async_generation_allowed: boolean
    max_generation_attempts: number
  }
  audit: {
    director_reason: string
    hard_constraints: string[]
    soft_constraints: string[]
  }
}

export interface PersistedVisualDirective {
  id: string
  schema_version: VisualDirective['schema_version']
  scene_ref: SceneRef
  goal: VisualDirective['goal']
  narrative_context: VisualDirective['narrative_context']
  sourcing_policy: VisualDirective['sourcing_policy']
  guardrails: VisualDirective['guardrails']
  budget: VisualDirective['budget']
  audit: VisualDirective['audit']
  created_at: Date
  updated_at: Date
}

export interface CreateVisualDirectiveInput {
  id?: string
  schema_version?: VisualDirective['schema_version']
  scene_ref: SceneRef
  goal: VisualDirective['goal']
  narrative_context: VisualDirective['narrative_context']
  sourcing_policy: VisualDirective['sourcing_policy']
  guardrails: VisualDirective['guardrails']
  budget: VisualDirective['budget']
  audit: VisualDirective['audit']
}

export type ImagePlanStatus =
  | 'ready'
  | 'degraded'
  | 'pending_generation'
  | 'failed'

export type ImageDecision =
  | 'none'
  | 'reuse_public_original'
  | 'reuse_public_projection'
  | 'reuse_private_projection_runtime_only'
  | 'generate_from_scratch'
  | 'generate_from_public_reference'
  | 'generate_from_private_projection'

export interface PublicMediaContextCard {
  schema_version: 'public-media-context-card.v1'
  card_id: string
  modality: 'image'
  asset_ref: {
    asset_id: string
    semantic_snapshot_id: string
    projection_id: string
  }
  source: {
    kind: VisualSourceKind
    derived_from_private: boolean
    continuity_ref?: {
      episode_id?: string | null
      thread_post_id?: string | null
    }
  }
  relation: {
    visual_role: VisualRole
    prompt_weight: PromptWeight
    mention_policy: MentionPolicy
    why_now: string
  }
  public_summary: {
    theme: string
    scene: string
    mood: string
    salient_entities: string[]
    discussion_points: string[]
    public_safe_caption: string
    alt_text: string
    ocr_snippets?: string[]
  }
  display: {
    original_display_allowed: boolean
    derivative_display_allowed: boolean
    preferred_variant: 'original' | 'derivative' | 'none'
  }
  governance: {
    public_scope: PublicScope
    disclose_origin_policy: 'never' | 'episode_only' | 'public_only'
    cross_agent_quote_allowed: boolean
    prohibited_reference_types: Array<
      | 'owner_private_speech'
      | 'private_memory'
      | 'hidden_director_goal'
      | 'pii'
    >
    expires_at?: string | null
  }
  audit: {
    confidence: number
    relevance_score: number
    model_version: string
  }
}

export interface PrivateMediaRuntimeCard {
  schema_version: 'private-media-runtime-card.v1'
  card_id: string
  modality: 'image'
  asset_ref: {
    asset_id: string
    semantic_snapshot_id: string
    projection_id: string
  }
  source: {
    kind: MediaSourceKind
  }
  relation: {
    role: 'message_attachment'
    scene_type: 'private_message'
    scene_id: string
  }
  private_summary: {
    theme: string
    scene: string
    mood: string
    salient_entities: string[]
    discussion_points: string[]
    private_safe_caption: string
    ocr_snippets?: string[]
  }
  memory_policy: {
    source_type: 'PRIVATE_CHAT'
    source_ref_type: 'private_message'
    public_reuse_default: 'blocked'
    public_safe_shadow_hint: string
    derived_public_allowed: false
    why_relevant_hint: string
  }
}

export interface PrivateMediaMemoryProjection {
  schema_version: 'private-media-memory-projection.v1'
  asset_id: string
  semantic_snapshot_id: string
  source_ref: {
    agent_id: string
    owner_user_id: string
    session_id: string
    scene_type: 'private_message'
    scene_id: string
  }
  memory_summary: {
    summary_text: string
    topic_tags: string[]
    key_facts: string[]
    sentiment: string
    importance_score: number
  }
  policy: {
    visibility: 'private_only'
    retrieval_scope: 'private_chat'
    owner_note_embedded: false
  }
  handoff: {
    public_reuse_default: 'blocked'
    public_safe_shadow_hint: string
    derived_public_allowed: false
    why_relevant_hint: string
  }
}

export interface PlannedDisplayAttachment {
  slot: number
  binding_role: 'primary' | 'inline' | 'reference'
  asset_id: string
  mime_type: string
  display_variant: 'original' | 'generated_derivative'
  derived_from_asset_id?: string | null
  aspect_ratio_hint?: AspectRatioHint | null
  public_caption: string
  alt_text: string
  attach_after_persist: boolean
}

export interface ImagePlanSource {
  source_kind: VisualSourceKind
  asset_id?: string
  semantic_snapshot_id?: string
  projection_id?: string
  card_id?: string
  selection_score: number
  rejection_reason?: string | null
}

export interface ImagePlan {
  schema_version: 'image-plan.v1'
  plan_id: string
  directive_id: string
  scene_ref: SceneRef
  status: ImagePlanStatus
  decision: ImageDecision
  reason: string
  runtime: {
    enabled: boolean
    influence_level: 'none' | 'light' | 'medium' | 'strong'
    cards: PublicMediaContextCard[]
  }
  display: {
    enabled: boolean
    attachments: PlannedDisplayAttachment[]
  }
  generation?: {
    mode: 'none' | 'sync' | 'async'
    status: 'not_requested' | 'queued' | 'succeeded' | 'failed'
    recipe_id?: string
    job_id?: string
    model_ref?: string
    based_on_card_ids?: string[]
    prompt_brief?: string
  }
  selected_sources: ImagePlanSource[]
  planner_audit: {
    evaluated_candidates: number
    score_breakdown: {
      relevance: number
      continuity: number
      novelty: number
      privacy_safety: number
      display_fitness: number
      cost_fitness: number
      total: number
    }
    fallback_action: 'text_only' | 'runtime_only_no_display' | 'skip_scene' | null
  }
}

export interface PersistedImagePlan {
  id: string
  directive_id: string
  schema_version: ImagePlan['schema_version']
  scene_ref: SceneRef
  status: ImagePlanStatus
  decision: ImageDecision
  reason: string
  runtime: ImagePlan['runtime']
  display: ImagePlan['display']
  generation: NonNullable<ImagePlan['generation']>
  selected_sources: ImagePlanSource[]
  planner_audit: ImagePlan['planner_audit']
  created_at: Date
  updated_at: Date
}

export interface CreateImagePlanInput {
  id?: string
  directive_id: string
  schema_version?: ImagePlan['schema_version']
  scene_ref: SceneRef
  status: ImagePlanStatus
  decision: ImageDecision
  reason: string
  runtime: ImagePlan['runtime']
  display: ImagePlan['display']
  generation?: ImagePlan['generation']
  selected_sources: ImagePlanSource[]
  planner_audit: ImagePlan['planner_audit']
}

export interface PublicSceneVisualRef {
  directive_id: string
  image_plan_id?: string
  runtime_card_ids: string[]
}

export interface MediaContextProjection {
  id: string
  binding_id: string
  projection_surface: MediaProjectionSurface
  projection_kind: MediaProjectionKind
  schema_version: string
  payload_json: Record<string, unknown>
  token_estimate: number | null
  prompt_weight: string | null
  mention_policy: string | null
  preferred_display_variant: string | null
  expires_at: Date | null
  created_at: Date
}

export interface CreateMediaContextProjectionInput {
  id?: string
  binding_id: string
  projection_surface: MediaProjectionSurface
  projection_kind: MediaProjectionKind
  schema_version: string
  payload_json: Record<string, unknown>
  token_estimate?: number | null
  prompt_weight?: string | null
  mention_policy?: string | null
  preferred_display_variant?: string | null
  expires_at?: Date | null
}
