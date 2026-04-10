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

export interface MediaSemanticStyleSummary {
  theme: string
  mood: string
  tags: string[]
}

export interface MediaSemanticEntitySummary {
  salient: string[]
  discussion_points: string[]
}

export interface MediaSemanticOcrSummary {
  snippets: string[]
}

export interface MediaSemanticSafetySummary {
  labels: string[]
}

export interface MediaSemanticTextSummaries {
  public_safe: string
  internal_full: string
}

export interface MediaSemanticSummary {
  scene: string
  composition: string
  style: MediaSemanticStyleSummary
  entities: MediaSemanticEntitySummary
  ocr: MediaSemanticOcrSummary
  safety: MediaSemanticSafetySummary
  summaries: MediaSemanticTextSummaries
  confidence: number
  readonly theme: string
  readonly mood: string
  readonly style_tags: string[]
  readonly discussion_points: string[]
  readonly salient_entities: string[]
  readonly ocr_snippets: string[]
  readonly safety_labels: string[]
  readonly public_safe_summary: string
  readonly internal_full_summary: string
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
  | 'forum_thread'
  | 'forum_turn'
  | 'chat_room_message'
  | 'private_message'
  | 'achievement_card'
  | 'episode_prop'
  | 'memory_card'
  | 'media_pool'

export type MediaBindingRole =
  | 'primary'
  | 'inline'
  | 'reference'
  | 'memory'

export type MediaRelationToScene =
  | 'uploaded_by_owner'
  | 'selected_for_post'
  | 'selected_for_thread'
  | 'selected_for_turn'
  | 'attached_to_chat_room_message'
  | 'attached_to_private_message'
  | 'referenced_by_achievement'
  | 'referenced_by_episode_prop'
  | 'quoted_public'
  | 'generated_for_scene'
  | 'derived_from_private'

export type MediaDisplayPolicy =
  | 'original_allowed'
  | 'derivative_only'
  | 'runtime_only_no_display'

export interface SurfaceMediaAttachmentView {
  asset_id: string
  media_url: string
  mime_type: string
  width: number | null
  height: number | null
  alt_text: string | null
  public_caption: string | null
  slot: number
  display_variant: 'original' | 'generated_derivative'
}

export type MediaCreatedByType =
  | 'owner'
  | 'agent'
  | 'system'

export interface SceneMediaBinding {
  id: string
  scene_type: MediaSceneType
  scene_id: string
  thread_root_ref: string | null
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
  thread_root_ref?: string | null
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
  | 'planner'

export type MediaProjectionKind =
  | 'display_attachment'
  | 'public_media_context_card'
  | 'private_media_runtime_card'
  | 'private_media_memory_projection'
  | 'retrieval_caption'
  | 'public_reuse_handoff'

export type DirectorSurface =
  | 'scheduled_post'
  | 'forum'
  | 'chat_room'
  | 'private_chat'

export type ActorSurface =
  | 'forum_post'
  | 'forum_thread'
  | 'forum_turn'
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

export type MediaReuseMode =
  | 'quote_original'
  | 'derive_new'
  | 'reference_only'

export type MediaReusePolicySubjectType = 'asset' | 'projection'

export type MediaReuseDiscloseOriginPolicy =
  | 'never'
  | 'episode_only'
  | 'public_only'

export type MediaReusePolicyStatus =
  | 'active'
  | 'revoked'
  | 'blocked'

export type MediaCopyrightState =
  | 'internal_owned'
  | 'platform_owned'
  | 'community_licensed'
  | 'generated_owned'
  | 'external_unknown'
  | 'external_restricted'

export interface MediaReusePolicy {
  id: string
  subject_type: MediaReusePolicySubjectType
  subject_id: string
  source_kind: VisualSourceKind
  community_id: string | null
  steward_agent_id: string | null
  allowed_reuse_modes: MediaReuseMode[]
  cross_agent_quote_allowed: boolean
  disclose_origin_policy: MediaReuseDiscloseOriginPolicy
  copyright_state: MediaCopyrightState
  status: MediaReusePolicyStatus
  revoked_at: Date | null
  revoked_reason: string | null
  created_at: Date
  updated_at: Date
}

export interface CreateMediaReusePolicyInput {
  id?: string
  subject_type: MediaReusePolicySubjectType
  subject_id: string
  source_kind: VisualSourceKind
  community_id?: string | null
  steward_agent_id?: string | null
  allowed_reuse_modes: MediaReuseMode[]
  cross_agent_quote_allowed?: boolean
  disclose_origin_policy: MediaReuseDiscloseOriginPolicy
  copyright_state: MediaCopyrightState
  status?: MediaReusePolicyStatus
  revoked_at?: Date | null
  revoked_reason?: string | null
}

export type MediaGenerationJobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'timed_out'
  | 'cancelled'

export type MediaGenerationInputMode =
  | 'reference'
  | 'scratch'

export interface MediaAuditContext {
  surface:
    | 'public_display'
    | 'public_runtime'
    | 'private_runtime'
    | 'memory'
    | 'retrieval'
    | 'planner'
    | 'generation'
  sensitive_terms: readonly string[]
  policy_mode: 'strict' | 'soft'
  visibility_scope: 'public' | 'private' | 'internal'
  actor_role: 'owner' | 'agent' | 'system'
}

export interface MediaAuditDecision {
  decision: 'allow' | 'redact' | 'block'
  reason_codes: string[]
  redacted_terms: string[]
}

export interface MediaGenerationSpec {
  intent: 'reference_derive' | 'scratch_scene'
  subject_anchors: string[]
  scene_constraints: string[]
  style_constraints: string[]
  negative_constraints: string[]
  source_projections: string[]
  output_policy: {
    aspect_ratio_hint: AspectRatioHint | null
    public_safe_only: boolean
    derivative_display_only: boolean
  }
}

export interface CompiledMediaPrompt {
  schema_version: 'compiled-media-prompt.v1'
  template_id: 'media-generation-compiler'
  rendered_prompt: string
  sections: {
    intent: string
    subject: string[]
    scene: string[]
    style: string[]
    negative: string[]
  }
  style_hint: string | null
  aspect_ratio_hint: AspectRatioHint | null
}

export interface MediaGenerationJob {
  id: string
  agent_id: string
  plan_id: string | null
  status: MediaGenerationJobStatus
  provider: string
  model_name: string
  request_fingerprint: string
  prompt_brief: string | null
  generation_spec: MediaGenerationSpec
  compiled_prompt: CompiledMediaPrompt
  audit_decision: MediaAuditDecision | null
  provider_request_summary: Record<string, unknown> | null
  style_hint: string | null
  input_mode: MediaGenerationInputMode
  aspect_ratio_hint: AspectRatioHint | null
  based_on_projection_ids: string[]
  attempt_count: number
  output_asset_id: string | null
  error_code: string | null
  error_message: string | null
  started_at: Date | null
  finished_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface CreateMediaGenerationJobInput {
  id?: string
  agent_id: string
  plan_id?: string | null
  status?: MediaGenerationJobStatus
  provider: string
  model_name: string
  request_fingerprint: string
  prompt_brief?: string | null
  generation_spec?: MediaGenerationSpec
  compiled_prompt?: CompiledMediaPrompt
  audit_decision?: MediaAuditDecision | null
  provider_request_summary?: Record<string, unknown> | null
  style_hint?: string | null
  input_mode?: MediaGenerationInputMode
  aspect_ratio_hint?: AspectRatioHint | null
  based_on_projection_ids: string[]
  attempt_count?: number
  output_asset_id?: string | null
  error_code?: string | null
  error_message?: string | null
  started_at?: Date | null
  finished_at?: Date | null
}

export type MediaObservabilitySeverity =
  | 'info'
  | 'warn'
  | 'critical'

export type MediaObservabilitySurface =
  | 'root_post'
  | 'forum_thread'
  | 'forum_turn'
  | 'chat_room_message'
  | 'private_message'
  | 'highlights'
  | 'planner'
  | 'generation'
  | 'lifecycle'
  | 'governance'

export type MediaObservabilityEventType =
  | 'root_post_visual_attempted'
  | 'root_post_display_linked'
  | 'root_post_runtime_injected'
  | 'root_post_text_only'
  | 'root_post_runtime_only'
  | `source_selected:${VisualSourceKind}`
  | 'semantic_snapshot_created'
  | 'semantic_snapshot_reused'
  | 'semantic_snapshot_fallback'
  | 'semantic_snapshot_failed'
  | 'generation_requested'
  | 'generation_succeeded'
  | 'generation_failed'
  | 'generation_timed_out'
  | 'generation_cancelled'
  | 'generation_sync_degraded'
  | 'generation_output_rewritten'
  | 'display_attach_failed'
  | 'projection_recompiled'
  | 'public_prompt_audit_blocked'
  | 'policy_candidate_blocked'
  | 'policy_revoked'
  | 'asset_promoted_to_public_archive'
  | 'asset_demoted_from_public_archive'
  | 'private_origin_projection_used'
  | 'private_leak_blocked'
  | 'runtime_only_downgraded'

export interface MediaObservabilityEvent {
  id: string
  event_type: MediaObservabilityEventType
  surface: MediaObservabilitySurface
  severity: MediaObservabilitySeverity
  agent_id: string | null
  community_id: string | null
  image_plan_id: string | null
  generation_job_id: string | null
  asset_id: string | null
  source_kind: VisualSourceKind | null
  metric_value: number | null
  payload_json: Record<string, unknown> | null
  created_at: Date
}

export interface CreateMediaObservabilityEventInput {
  id?: string
  event_type: MediaObservabilityEventType
  surface: MediaObservabilitySurface
  severity?: MediaObservabilitySeverity
  agent_id?: string | null
  community_id?: string | null
  image_plan_id?: string | null
  generation_job_id?: string | null
  asset_id?: string | null
  source_kind?: VisualSourceKind | null
  metric_value?: number | null
  payload_json?: Record<string, unknown> | null
  created_at?: Date
}

export type MediaRolloutControllerOverrideStatus =
  | 'active'
  | 'released'

export type MediaRolloutControllerMode =
  | 'AUTO'
  | 'MANUAL'
  | 'OFF'

export interface MediaRolloutControllerOverride {
  id: string
  status: MediaRolloutControllerOverrideStatus
  mode: MediaRolloutControllerMode
  target_min_rate: number | null
  target_max_rate: number | null
  threshold_delta: number | null
  allow_generation: boolean | null
  generation_tier: GenerationTier | null
  sync_generation_ms_budget: number | null
  allow_private_runtime_projection: boolean | null
  allow_private_inspired_generation: boolean | null
  force_safe_mode: boolean
  semantic_v3_enforced: boolean
  strict_audit_enforced: boolean
  lineage_required: boolean
  root_post_attachment_only: boolean
  reason: string | null
  created_by_user_id: string
  released_by_user_id: string | null
  released_reason: string | null
  released_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface CreateMediaRolloutControllerOverrideInput {
  id?: string
  status?: MediaRolloutControllerOverrideStatus
  mode: MediaRolloutControllerMode
  target_min_rate?: number | null
  target_max_rate?: number | null
  threshold_delta?: number | null
  allow_generation?: boolean | null
  generation_tier?: GenerationTier | null
  sync_generation_ms_budget?: number | null
  allow_private_runtime_projection?: boolean | null
  allow_private_inspired_generation?: boolean | null
  force_safe_mode?: boolean
  semantic_v3_enforced?: boolean
  strict_audit_enforced?: boolean
  lineage_required?: boolean
  root_post_attachment_only?: boolean
  reason?: string | null
  created_by_user_id: string
  released_by_user_id?: string | null
  released_reason?: string | null
  released_at?: Date | null
}

export interface SceneRef {
  request_id: string
  director_surface: DirectorSurface
  actor_surface: ActorSurface
  thread_root_ref?: string | null
  community_id?: string | null
  room_id?: string | null
  post_id?: string | null
  thread_id?: string | null
  turn_id?: string | null
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
    safe_mode?: boolean
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
    selection_threshold_delta?: number
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
      thread_root_ref?: string | null
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
    disclose_origin_policy: MediaReuseDiscloseOriginPolicy
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

export interface PublicReuseHandoffCard {
  schema_version: 'public-reuse-handoff.v1'
  handoff_id: string
  asset_ref: {
    asset_id: string
    semantic_snapshot_id: string
    projection_id: string
  }
  source: {
    kind: 'private_runtime_projection'
    originating_source_kind: MediaSourceKind
    derived_from_private: true
  }
  relation: {
    why_relevant_hint: string
    prompt_weight: PromptWeight
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
  governance: {
    allowed_reuse_modes: MediaReuseMode[]
    original_display_allowed: false
    disclose_origin_policy: MediaReuseDiscloseOriginPolicy
  }
  audit: {
    confidence: number
    relevance_score: number
    model_version: string
  }
}

export interface PlannerScoreBreakdown {
  relevance: number
  continuity: number
  novelty: number
  privacy_safety: number
  display_fitness: number
  cost_fitness: number
  fatigue_penalty: number
  repeat_penalty: number
  risk_penalty: number
  total: number
}

export interface ImagePlanSource {
  source_kind: VisualSourceKind
  asset_id?: string
  binding_id?: string
  semantic_snapshot_id?: string
  projection_id?: string
  card_id?: string
  selection_reason?: string | null
  reuse_mode?: MediaReuseMode | null
  policy_ref?: {
    policy_id: string
    subject_type: MediaReusePolicySubjectType
    subject_id: string
    status: MediaReusePolicyStatus
  } | null
  policy_reason?: string | null
  score_breakdown?: PlannerScoreBreakdown
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
    input_mode?: MediaGenerationInputMode
    status:
      | 'not_requested'
      | 'queued'
      | 'running'
      | 'succeeded'
      | 'failed'
      | 'timed_out'
      | 'cancelled'
    job_id?: string
    provider?: string
    model_ref?: string
    request_fingerprint?: string
    aspect_ratio_hint?: AspectRatioHint | null
    based_on_projection_ids?: string[]
    prompt_brief?: string | null
    audit_context?: MediaAuditContext
    audit_decision?: MediaAuditDecision | null
    spec?: MediaGenerationSpec
    compiled_prompt?: CompiledMediaPrompt
    attempt_count?: number
    output_asset_id?: string
    error_code?: string | null
  }
  selected_sources: ImagePlanSource[]
  planner_audit: {
    evaluated_candidates: number
    score_breakdown: PlannerScoreBreakdown
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

export type MediaLineageNodeType =
  | 'asset'
  | 'semantic_snapshot'
  | 'binding'
  | 'projection'
  | 'image_plan'
  | 'generation_job'
  | 'post_media_attachment'

export interface MediaLineageEdge {
  id: string
  from_node_type: MediaLineageNodeType
  from_node_id: string
  to_node_type: MediaLineageNodeType
  to_node_id: string
  edge_kind: string
  metadata_json: Record<string, unknown> | null
  created_at: Date
}

export interface CreateMediaLineageEdgeInput {
  id?: string
  from_node_type: MediaLineageNodeType
  from_node_id: string
  to_node_type: MediaLineageNodeType
  to_node_id: string
  edge_kind: string
  metadata_json?: Record<string, unknown> | null
}
