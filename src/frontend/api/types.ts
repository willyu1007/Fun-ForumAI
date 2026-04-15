import type { KickoffSuiteEditApplyResult } from '../../shared/kickoff-workflow.js'

export type {
  ActorRoleCard,
  ChronicleStoryMetaV1,
  ChronicleChapter,
  NarrativeAchievementSeal,
  NurtureSuggestion,
  NurtureSuggestionAction,
  NurtureSuggestionActionKind,
  NurtureSuggestionLane,
  NurtureSuggestionPriority,
  OwnerChapterCast,
  OwnerChapterSceneCard,
  OwnerChronicleFeed,
  OwnerLifeOverviewEntryPoint,
  OwnerLifeOverviewEntryPoints,
  OwnerLifeOverviewHero,
  OwnerLifeOverview,
  OwnerNowCompany,
  OwnerNowSnapshot,
  OwnerNurtureSuggestionList,
  OwnerProjectionLatestSession,
  OwnerProjectionSnapshot,
  OwnerStoryBeatActor,
  OwnerStoryBeat,
  SourceDimensionLabel,
  SourceDimension,
} from '../../shared/owner-life-overview.js'
export type {
  SearchTab,
  SearchCounts,
  SearchAuthorVisibility,
  SearchAuthorSummary,
  SearchCommunitySummary,
  SearchAgentCommunitySummary,
  SearchPostItem,
  SearchCommunityItem,
  SearchAgentItem,
  SearchThreadItem,
  PublicSearchItem,
  PublicSearchResponse,
} from '../../shared/public-search.js'
export type {
  AttentionOpportunity,
  DiscussionBranchGroup,
  DiscussionForestProjection,
  EffectiveParticipationContract,
  ParticipationContract,
  ReadingGuideProjection,
  ThreadLifecycleSnapshot,
  ThreadPreferredAction,
  ThreadReplyMode,
  ThreadWriteabilityReasonCode,
  ThreadWriteabilitySnapshot,
  TurnDisplayProjection,
  TurnReasonBadgeId,
  ViewerWriteResult,
  ViewerWriteSourceContext,
} from '../../shared/forum-orchestration.js'
export type {
  AgentPublicIdentity,
  AgentPublicIdentityBadge,
  AgentPublicProjection,
  AgentPublicProof,
  CommunityInteractionContract,
  CommunitySemanticContract,
  CommunityShellCategory,
  CommunityFamily,
  ContentSemanticProjection,
  EditorialShelfId,
  FormatKind,
  LaunchSurfaceKindId,
  PublicationReviewProfileId,
  ScenePhase,
} from '../../shared/semantic-taxonomy.js'
export type {
  BadgeDebugCatalogItem,
  BadgeDebugConsistencyCheck,
  BadgeDebugMeta,
  BadgeDebugSemanticContract,
} from '../../shared/badges/debug-catalog.js'
export type { BadgeSurfacePolicy, BadgeSurfacePolicyId } from '../../shared/badges/surface-policy.js'
export type {
  KickoffAuthoringPatch,
  KickoffBootstrapMode,
  KickoffBootstrapResult,
  KickoffDataMode,
  KickoffGenerationMode,
  KickoffImportReport,
  KickoffImportSummary,
  KickoffProfileId,
  KickoffRunDetail,
  KickoffRunSummary,
  KickoffRuntimeReadiness,
  KickoffStatusPayload,
  KickoffSuiteEditAction,
  KickoffSuiteEditApplyResult,
  KickoffSuiteEditPreview,
  KickoffSuiteEditRequest,
} from '../../shared/kickoff-workflow.js'

export interface ApiResponse<T = unknown> {
  data: T
  meta?: {
    cursor?: string
    total?: number
    range?: string
    [key: string]: unknown
  }
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export type GuidanceActorType = 'VISITOR' | 'USER'
export type GuidanceTrack = 'UNDECIDED' | 'SPECTATOR' | 'OWNER'
export type GuidanceStage = 'NEW_VISITOR' | 'EXPLORING' | 'FIRST_SUCCESS' | 'RETAINED'
export type GuidanceInboxStatus = 'ACTIVE' | 'COMPLETED' | 'DISMISSED'
export type GuidanceItemModuleType = 'CARD' | 'RECEIPT'
export type GuidanceSummaryModuleType = 'DUAL_ENTRY' | 'CHECKLIST' | 'CARD' | 'RECEIPT'

export interface GuidanceCta {
  label: string
  target: string
  event_name?: string
  payload?: Record<string, unknown>
}

export interface GuidanceDualEntryCard {
  track: Exclude<GuidanceTrack, 'UNDECIDED'>
  title: string
  promise: string
  entry_cta: GuidanceCta
  return_hook: string
}

export interface GuidanceDualEntryModule {
  type: 'DUAL_ENTRY'
  reason_code: string
  hero_body: string
  cards: GuidanceDualEntryCard[]
}

export interface GuidanceChecklistItem {
  reason_code: string
  title: string
  body: string
  completed: boolean
  cta: GuidanceCta | null
}

export interface GuidanceChecklistModule {
  type: 'CHECKLIST'
  title: string
  items: GuidanceChecklistItem[]
}

export interface GuidanceItemCard {
  id: string
  module_type: GuidanceItemModuleType
  reason_code: string
  title: string
  body: string
  unread: boolean
  status: GuidanceInboxStatus
  cta: GuidanceCta | null
  payload: Record<string, unknown> | null
  related_agent_id: string | null
  related_session_id: string | null
  created_at: string
  updated_at: string
}

export interface GuidanceItemModule {
  type: GuidanceItemModuleType
  item: GuidanceItemCard
}

export type GuidanceSummaryModule =
  | GuidanceDualEntryModule
  | GuidanceChecklistModule
  | GuidanceItemModule

export interface GuidanceActorState {
  actor_type: GuidanceActorType
  actor_id: string
  current_track: GuidanceTrack
  stage: GuidanceStage
  explained: {
    two_tracks: boolean
  }
  completed: {
    followed_first_agent: boolean
    used_following_feed: boolean
    created_agent: boolean
    started_private_chat: boolean
    nurture_receipt_ready: boolean
    watch_public_effect: boolean
  }
  first_success: {
    achieved: boolean
    at: string | null
  }
  reveal: {
    style: boolean
    instructions: boolean
    advanced: boolean
  }
  latest_owner_agent_id: string | null
  latest_receipt_session_id: string | null
}

export interface GuidanceSummaryData {
  actor: GuidanceActorState
  modules: GuidanceSummaryModule[]
}

export interface GuidanceInboxData {
  items: GuidanceItemCard[]
  unread_count: number
}

export type GuidanceBellData = GuidanceInboxData

export interface GuidanceRuntimeReasonMetric {
  delivered: number
  opened: number
  dismissed: number
  completed: number
}

export interface GuidanceRuntimeData {
  flags: {
    guidance_v1: boolean
    guidance_recall_v1: boolean
  }
  bell: {
    unread_count: number
    active_count: number
  }
  per_reason: Record<string, GuidanceRuntimeReasonMetric>
  avg_delivery_delay_ms: number | null
  suppression: {
    same_reason_count: number
    daily_cap_count: number
  }
  teaching_first_violation_count: number
}

export interface RuntimeFeaturesData {
  flags: Record<string, unknown>
  runtime: Record<string, unknown>
  counters: Record<string, unknown> & {
    inference_profile?: {
      compile_runs: number
      candidate_runs: number
      shadow_runs: number
      blocked_runs: number
      approved_reanchors: number
    }
  }
  provider_admission?: {
    totals: {
      admitted: number
      shadow: number
      blocked: number
    }
    by_voice_line: Array<{
      voice_line_id: string
      core_family: string
      compare_dimensions: string[]
      admitted: number
      shadow: number
      blocked: number
    }>
  }
  persona_observability: Record<string, unknown>
  rich_communities: Record<string, unknown>
  guidance: GuidanceRuntimeData
  search?: {
    telemetry: {
      recent: Array<Record<string, unknown>>
      aggregates: Record<string, unknown>
      funnel: {
        recent: Array<Record<string, unknown>>
        counters: Record<string, unknown>
      }
    }
    health: Record<string, unknown>
  }
  observability: Record<string, unknown>
}

export interface MediaObservabilityGate {
  id: 'root_post_band' | 'attach_stability' | 'generation_health' | 'privacy_safety'
  status: 'pass' | 'warn' | 'block'
  value: number | null
  unit: 'ratio' | 'count'
  threshold: {
    pass: string
    warn?: string
    block: string
  }
}

export interface MediaObservabilityEvent {
  id: string
  event_type: string
  surface: string
  severity: 'info' | 'warn' | 'critical'
  agent_id: string | null
  community_id: string | null
  image_plan_id: string | null
  generation_job_id: string | null
  asset_id: string | null
  source_kind: string | null
  metric_value: number | null
  payload_json: Record<string, unknown> | null
  created_at: string
}

export interface MediaObservabilitySnapshotData {
  windows: {
    root_post_7d_start: string
    ops_24h_start: string
  }
  root_post: {
    attempted_7d: number
    display_linked_7d: number
    runtime_injected_7d: number
    text_only_7d: number
    runtime_only_7d: number
    attach_rate_7d: number | null
    runtime_injected_rate_7d: number | null
    source_mix_7d: Array<{
      source_kind: string
      count: number
      share: number
    }>
    attach_success_24h: number
    attach_failed_24h: number
    attach_failure_rate_24h: number | null
    prompt_audit_blocked_24h: number
    prompt_audit_block_rate_24h: number | null
    critical_private_leaks_24h: number
  }
  generation_24h: {
    requested: number
    succeeded: number
    failed: number
    timed_out: number
    cancelled: number
    sync_degraded: number
    success_rate: number | null
    timeout_or_cancel_rate: number | null
    estimated_cost_cny: number | null
    cost_gate_active: boolean
  }
  governance_24h: {
    policy_candidate_blocked: number
    policy_revoked: number
    runtime_only_downgraded: number
  }
}

export interface MediaRolloutControllerOverrideData {
  id: string
  status: 'active' | 'released'
  mode: 'AUTO' | 'MANUAL' | 'OFF'
  target_min_rate: number | null
  target_max_rate: number | null
  threshold_delta: number | null
  allow_generation: boolean | null
  generation_tier: 'none' | 'low' | 'medium' | 'high' | null
  sync_generation_ms_budget: number | null
  allow_private_runtime_projection: boolean | null
  allow_private_inspired_generation: boolean | null
  force_safe_mode: boolean
  semantic_v3_enforced: boolean
  strict_audit_enforced: boolean
  lineage_required: boolean
  reason: string | null
  created_by_user_id: string
  released_by_user_id: string | null
  released_reason: string | null
  released_at: string | null
  created_at: string
  updated_at: string
}

export interface MediaRolloutControllerProfileData {
  mode: 'AUTO' | 'MANUAL' | 'OFF'
  active_override: MediaRolloutControllerOverrideData | null
  profile: 'steady' | 'boost' | 'conserve' | 'safe_mode' | 'manual' | 'off'
  metrics: MediaObservabilitySnapshotData
  gates: MediaObservabilityGate[]
  effective: {
    target_min_rate: number
    target_max_rate: number
    threshold_delta: number
    allow_generation: boolean
    generation_tier: 'none' | 'low' | 'medium' | 'high'
    sync_generation_ms_budget: number
    allow_private_runtime_projection: boolean
    allow_private_inspired_generation: boolean
    force_safe_mode: boolean
    semantic_v3_enforced: boolean
    strict_audit_enforced: boolean
    lineage_required: boolean
  }
  reason: string
}

export interface AdminMediaObservabilityData {
  metrics: MediaObservabilitySnapshotData
  gates: MediaObservabilityGate[]
  recent_alerts: MediaObservabilityEvent[]
  lifecycle_candidates: {
    orphan_assets: number
    expired_projections: number
    snapshot_backfill_assets: number
  }
  effective_controller_profile: MediaRolloutControllerProfileData
}

export interface AdminMediaRolloutControllerData {
  active_override: MediaRolloutControllerOverrideData | null
  effective_profile: MediaRolloutControllerProfileData
}

export interface MediaLifecycleRunResult {
  run_at: string
  candidates: {
    orphan_assets: number
    expired_projections: number
    snapshot_backfill_assets: number
  }
  archived_assets: number
  deleted_projections: number
  snapshot_backfill_attempted: number
  snapshot_backfill_succeeded: number
  snapshot_backfill_failed: number
}

export type ContentVisibility = 'PUBLIC' | 'GRAY' | 'QUARANTINE'
export type ContentState = 'PENDING' | 'APPROVED' | 'REJECTED'
export type ModerationVerdict = 'APPROVE' | 'FOLD' | 'QUARANTINE' | 'REJECT'
export type AgentStatus = 'ACTIVE' | 'LIMITED' | 'QUARANTINED' | 'BANNED' | 'DELETED'
export type VoteDirection = 'UP' | 'DOWN' | 'NEUTRAL'
export type PublicActorType = 'agent' | 'human'
export type IdentityContractSource = 'contract_v1'
export type GovernanceActionType =
  | 'approve'
  | 'fold'
  | 'quarantine'
  | 'reject'
  | 'limit_agent'
  | 'restore_agent'
  | 'ban_agent'
  | 'unban_agent'

export interface Post {
  id: string
  community_id: string
  author_agent_id: string
  title: string
  body: string
  tags: string[]
  visibility: ContentVisibility
  state: ContentState
  created_at: string
  updated_at: string
}

export interface AuthorSummary {
  id: string
  actor_type: PublicActorType
  display_name: string
  avatar_url: string | null
  agent_kind?: 'owner' | 'system'
  public_identity?: import('../../shared/semantic-taxonomy.js').AgentPublicIdentity | null
  public_projection?: import('../../shared/semantic-taxonomy.js').AgentPublicProjection | null
  public_proof?: import('../../shared/semantic-taxonomy.js').AgentPublicProof | null
  system_identity?: SystemIdentitySummary | null
  surface_access?: AgentSurfaceAccess | null
}

export interface AgentSocialBio {
  public_bio: string | null
  owner_bio: string | null
  private_header_bio: string | null
  presence_note: string | null
  updated_at: string | null
}

export interface SystemIdentitySummary {
  platform_managed: boolean
  identity_role_id?: string
  identity_visibility_role_id?: string
  program_role: string
  visibility_role: string
  display_mode: string
  home_community: string
  secondary_communities: string[]
  format_capabilities?: string[]
}

export interface AgentSurfaceAccess {
  owner_profile_visible: boolean
  private_chat_enabled: boolean
  follow_enabled: boolean
}

export interface AgentPublicStats {
  reply_count: number
  following_count: number
  followers_count: number
}

export interface PostMediaItem {
  asset_id: string
  media_url: string
  mime_type: string
  alt_text?: string | null
}

export interface SurfaceMediaAttachment {
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

export type LaunchSurfaceKind =
  | 'home_root_card'
  | 'note_root_card'
  | 'thread_turn'
  | 'highlight_card'
  | 'aftershow_card'

export type LaunchCardMode =
  | 'single_cover'
  | 'multi_panel_cover'
  | 'quote_card'
  | 'strip_card'
  | 'comparison_cover'
  | 'recap_card'
  | 'timeline_cover'
  | 'portrait_cover'
  | 'relationship_map_card'
  | 'program_card'

export type LaunchThumbnailPolicy =
  | 'required'
  | 'required_if_available'
  | 'optional'
  | 'forbidden'

export interface LaunchVisualPackagingFields {
  surface_kind?: LaunchSurfaceKind
  card_mode?: LaunchCardMode
  thumbnail_policy?: LaunchThumbnailPolicy
  hero_eligible?: boolean
}

export type LaunchStorylineState = 'opening' | 'escalating' | 'callback' | 'closed'
export type LaunchContentKind =
  | 'mainline_root'
  | 'highlight_hero'
  | 'aftershow_recap'
  | 'continuity_callback'
  | 'story_episode'
  | 'note_entry'
  | 'community_entry'
  | 'programming_slot'

export type CreatorNoteTemplateId =
  | 'recommendation_note'
  | 'comparison_note'
  | 'review_note'
  | 'mistake_recap_note'
  | 'relationship_observation_note'
  | 'ongoing_column_note'

export type CreatorNoteCoverMode =
  | 'hero_cover'
  | 'grid_cover'
  | 'comparison_cover'
  | 'portrait_cover'
  | 'relationship_map_card'
  | 'timeline_cover'

export interface StorylineProjection {
  storyline_id?: string
  storyline_title?: string
  storyline_state?: LaunchStorylineState
  storyline_hook?: string
}

export interface CreatorNoteProjection {
  note_template_id?: CreatorNoteTemplateId
  cover_mode?: CreatorNoteCoverMode
}

export interface RelationSummaryTeaser {
  relation_label: string
  relation_state_delta: 'new_follow' | 'stable'
  shared_storyline_count: number
  recent_callout_presence: boolean
  cta_target: string
}

export interface PublicAgentRelationSummary extends RelationSummaryTeaser {
  target_agent_id: string
  viewer_agent_id: string
  pair_hint: 'none' | 'following' | 'follower' | 'friend' | 'blocked'
  is_followed: boolean
  explainability: string[]
  recent_storyline_ids: string[]
  recent_ppr_candidates: string[]
}

export interface PostWithMeta extends Post {
  thread_turn_count: number
  vote_score: number
  vote_up: number
  vote_down: number
  agent_vote_score: number
  agent_vote_up: number
  agent_vote_down: number
  human_vote_score: number
  human_vote_up: number
  human_vote_down: number
  weighted_vote_score: number
  viewer_human_vote_direction: VoteDirection | null
  participant_count: number
  last_reply_at: string | null
  heat_score: number
  author: AuthorSummary
  community_slug: string
  community_name: string
  media: PostMediaItem[]
  ai_label?: string
  effective_moderation_label?: string
  topic_signals: Record<string, unknown> | null
  distribution_state: string
  community_semantics?: import('../../shared/semantic-taxonomy.js').CommunitySemanticContract | null
  interaction_contract?: import('../../shared/semantic-taxonomy.js').CommunityInteractionContract | null
  content_semantics?: import('../../shared/semantic-taxonomy.js').ContentSemanticProjection | null
  aftershow_summary?: AftershowSummary | null
  aftershow_callouts?: AftershowCalloutItem[]
  audience_thread_meta?: AudienceThreadMeta | null
  relation_context?: {
    hint: PublicAgentRelationSummary['pair_hint']
  }
  relation_teaser?: RelationSummaryTeaser | null
}

export interface AudienceThreadMeta {
  thread_id: string
  status: string
  message_count: number
  latest_message_at: string | null
}

export interface AftershowSummary {
  id: string
  status: string
  summary_text: string
  content: Record<string, unknown> | null
  published_at: string | null
  correlation_id: string | null
}

export interface AftershowCalloutItem {
  id: string
  artifact_id: string
  user_id: string
  audience_message_id: string
  reason: string
  evidence_ref: string | null
  notification_id: string | null
  invalidated_at: string | null
  created_at: string
  callout_index: number
  deep_link: string
}

export interface AftershowSnapshot {
  post_id: string
  aftershow_summary: AftershowSummary | null
  aftershow_callouts: AftershowCalloutItem[]
  audience_thread_meta: AudienceThreadMeta | null
  community_semantics?: import('../../shared/semantic-taxonomy.js').CommunitySemanticContract | null
  interaction_contract?: import('../../shared/semantic-taxonomy.js').CommunityInteractionContract | null
  content_semantics?: import('../../shared/semantic-taxonomy.js').ContentSemanticProjection | null
  relation_teaser?: RelationSummaryTeaser | null
}

export interface HomeProgrammingPostItem extends PostWithMeta {
  item_kind: 'post' | 'aftershow_recap'
  next_jump_target: string
  hero_reason?: string | null
  summary_text?: string | null
  published_at?: string | null
}

export interface HomeProgrammingCommunityItem {
  id: string
  item_kind: 'community_entry'
  slug: string
  name: string
  description: string
  lifecycle_state: string
  headline_priority: number
  editorial_shelves: string[]
  next_jump_target: string
}

export interface HomeProgrammingSlotLeadSeat {
  agent_id: string
  display_name: string
  role: string
}

export interface HomeProgrammingSlotItem extends LaunchVisualPackagingFields {
  id: string
  item_kind: 'programming_slot'
  content_kind: 'programming_slot'
  slot_name: string
  daypart_id: string
  daypart_label: string
  daypart_time_range: string
  community_slug: string
  community_name: string
  objective: string
  expected_output_summary: string
  editorial_shelf_id: import('../../shared/semantic-taxonomy.js').EditorialShelfId | null
  lead_seats: HomeProgrammingSlotLeadSeat[]
  next_jump_target: string
  assignment_source: 'recommended_contract'
}

export type HomeProgrammingItem =
  | HomeProgrammingPostItem
  | HomeProgrammingCommunityItem
  | HomeProgrammingSlotItem

export interface HomeShelf {
  id: string
  label: string
  collapsed: boolean
  items: HomeProgrammingItem[]
}

export interface HomeProgrammingPayload {
  enabled: boolean
  mode: string
  fallback_mode: string
  shelves: HomeShelf[]
  hot_feed_continuation: {
    items: PostWithMeta[]
    next_cursor: string | null
  }
  meta: {
    generated_at: string
    source: string
    personalization_mode?: 'editorial_baseline' | 'viewer_aware'
    viewer_agent_id?: string | null
    active_tuning_profile?: string | null
    explainability?: string[]
  }
}

export interface ProgrammingAgentRecommendation {
  agent_id: string
  display_name: string
  program_role: string
  requested_role: string
  community_affinity: string
  format_capabilities: string[]
}

export interface ProgrammingSlotRecommendation {
  slot_name: string
  daypart: string
  daypart_label: string
  community_name: string
  community_slug: string
  scene_types: string[]
  required_roles: string[]
  optional_roles: string[]
  fallback_roles: string[]
  assigned_agents: ProgrammingAgentRecommendation[]
  assigned_agent_ids: string[]
  fallback_agents: ProgrammingAgentRecommendation[]
  fallback_agent_ids: string[]
  role_mix: Record<string, number>
  blocked_pairings: string[]
  assignment_source: 'recommended_contract'
  expected_outputs: {
    root_posts?: number
    creator_note_entries?: number
    priority_threads?: number
    highlight_candidate?: boolean
    programming_entry?: boolean
    shelf_eligible?: boolean
    continuity_entry?: boolean
    aftershow_candidate?: boolean
    editorial_shelf_id?: import('../../shared/semantic-taxonomy.js').EditorialShelfId
    surface_kind?: LaunchSurfaceKind
  }
  expected_output_summary: string
  cross_handoff_communities: string[]
  cross_handoff_community_slugs: string[]
  unfilled_required_roles: string[]
}

export interface ProgrammingDaypart {
  id: string
  label: string
  time_range: string
  objective: string
  target_communities: string[]
  target_community_slugs: string[]
  supply_floor: Record<string, number>
  preferred_roles: string[]
  metrics_focus: string[]
}

export interface ProgrammingWarning {
  code: string
  severity: 'warn' | 'critical'
  message: string
  affected_daypart?: string | null
  affected_community_slug?: string | null
}

export interface ProgrammingHealthSnapshot {
  required_daily_outcomes: Record<string, number>
  observed_daily_outcomes: Record<string, number>
  daypart_readiness: Array<{
    daypart_id: string
    label: string
    ok: boolean
    required: Record<string, number>
    observed: Record<string, number>
  }>
  community_supply_floor: Array<{
    community_name: string
    community_slug: string
    required: Record<string, number>
    observed: Record<string, number>
    ok: boolean
    missed_slots: number
  }>
  visual_ratio_ok: boolean
  aftershow_pipeline_ok: boolean
  warning_count: number
  warnings: ProgrammingWarning[]
}

export interface LaunchProgrammingOpsPayload {
  enabled: boolean
  timezone: string
  active_daypart_id: string | null
  dayparts: ProgrammingDaypart[]
  slots: ProgrammingSlotRecommendation[]
  health: ProgrammingHealthSnapshot
  observations: {
    visual_ratio: {
      root_cover_ratio: number | null
      note_cover_ratio: number | null
      highlight_visual_ratio: number | null
      reject_reason_counts: Record<string, number>
      budget_remaining_cny: number | null
      cost_gate_active: boolean
    }
    highlight_candidates: Array<{
      candidate_post_id: string
      title: string
      community_name: string
      community_slug: string
      shelf_target: string
      hero_reason: string | null
      rejected_reason: string | null
    }>
    aftershow: Array<{
      candidate_post_id: string
      title: string
      community_name: string
      community_slug: string
      trigger_status: 'ready' | 'watch' | 'none'
      published_status: 'published' | 'pending'
      fallback_status: 'post_detail_only' | 'not_needed'
    }>
  }
  governance_references: {
    communities: Array<{
      community_id: string | null
      community_name: string
      community_slug: string
      community_lifecycle_state: string
      launch_wave: string | null
      headline_priority: number
    }>
    incubation: Array<{
      proposal_id: string
      community_name: string
      incubation_status: string
      merge_recommendation: string | null
      last_admin_action: string | null
    }>
  }
  rollback_order: string[]
  drill_checklist: string[]
  meta: {
    generated_at: string
    source: string
  }
}

export interface AudienceThread {
  id: string
  post_id: string
  community_id: string
  status: string
  created_at: string
  updated_at: string
}

export interface AudienceMessage {
  id: string
  thread_id: string
  author_user_id: string
  body: string
  created_at: string
}

export interface AudienceThreadData {
  thread: AudienceThread | null
  messages: AudienceMessage[]
}

export interface AudienceMessageCreateResult {
  thread: AudienceThread
  message: AudienceMessage
}

export interface AsideSeat {
  id: string
  community_id: string
  post_id: string | null
  agent_id: string
  scope: 'COMMUNITY' | 'POST'
  scope_id: string
  role: string
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED'
  assigned_by: string | null
  expires_at: string | null
  revoked_at: string | null
  meta: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface AsideSeatsData {
  post_id: string
  seats: AsideSeat[]
  stage_limits: {
    capacity: number
    cooldown_seconds: number
  }
}

export interface RouteHandoff {
  route_type: 'SPINOFF' | 'AFTERSHOW' | 'PRIVATE' | 'AUDIENCE'
  route_state: string
  reason_code: string
  handoff_label: string
  handoff_payload: Record<string, unknown> | null
  cta: Record<string, unknown> | null
}

export interface PublicStageTurnAnchorPreview {
  turn_id: string
  author_display_name: string
  body_excerpt: string
}

export interface PublicStageTurnData {
  id: string
  thread_id: string
  post_id: string
  author_actor_type: PublicActorType
  author_agent_id: string | null
  author_user_id: string | null
  turn_index: number
  anchor_turn_id: string | null
  anchor_intent: string | null
  quoted_excerpt: string | null
  body: string
  visibility: ContentVisibility
  state: ContentState
  created_at: string
  updated_at: string
  author: AuthorSummary
  vote_score: number
  agent_vote_score: number
  agent_vote_up: number
  agent_vote_down: number
  human_vote_score: number
  human_vote_up: number
  human_vote_down: number
  weighted_vote_score: number
  viewer_human_vote_direction: VoteDirection | null
  ai_label: string
  effective_moderation_label: string
  topic_signals: Record<string, unknown> | null
  distribution_state: string
  attachments: SurfaceMediaAttachment[]
  anchor_preview: PublicStageTurnAnchorPreview | null
}

export interface PublicStageThreadData {
  id: string
  post_id: string
  community_id: string
  author_actor_type: PublicActorType
  author_agent_id: string | null
  author_user_id: string | null
  body: string
  visibility: ContentVisibility
  state: ContentState
  thread_state: 'OPEN' | 'PEAKED' | 'CLOSED' | 'SPINOFF'
  reply_budget: number
  active_route: RouteHandoff | null
  lifecycle: import('../../shared/forum-orchestration.js').ThreadLifecycleSnapshot
  created_at: string
  updated_at: string
  author: AuthorSummary
  vote_score: number
  agent_vote_score: number
  agent_vote_up: number
  agent_vote_down: number
  human_vote_score: number
  human_vote_up: number
  human_vote_down: number
  weighted_vote_score: number
  viewer_human_vote_direction: VoteDirection | null
  ai_label: string
  effective_moderation_label: string
  topic_signals: Record<string, unknown> | null
  distribution_state: string
  attachments: SurfaceMediaAttachment[]
  turn_count: number
  participant_count: number
  last_activity_at: string
  turns: PublicStageTurnData[]
}

export interface PublicStageThreadSummaryData {
  id: string
  post_id: string
  community_id: string
  author_actor_type: PublicActorType
  author_agent_id: string | null
  author_user_id: string | null
  body: string
  visibility: ContentVisibility
  state: ContentState
  thread_state: 'OPEN' | 'PEAKED' | 'CLOSED' | 'SPINOFF'
  reply_budget: number
  active_route: RouteHandoff | null
  lifecycle: import('../../shared/forum-orchestration.js').ThreadLifecycleSnapshot
  created_at: string
  updated_at: string
  author: AuthorSummary
  vote_score: number
  agent_vote_score: number
  agent_vote_up: number
  agent_vote_down: number
  human_vote_score: number
  human_vote_up: number
  human_vote_down: number
  weighted_vote_score: number
  viewer_human_vote_direction: VoteDirection | null
  ai_label: string
  effective_moderation_label: string
  topic_signals: Record<string, unknown> | null
  distribution_state: string
  attachments: SurfaceMediaAttachment[]
  turn_count: number
  participant_count: number
  last_activity_at: string
  starter_excerpt: string
  latest_turn_id: string | null
  latest_turn_excerpt: string | null
}

export interface PublicStageThreadTurnsMeta {
  requested_cursor: string | null
  next_cursor: string | null
  limit: number
  around_turn_id: string | null
  returned_mode: 'full' | 'cursor' | 'around'
}

export interface PublicStageThreadDetailData extends PublicStageThreadData {
  turns_meta: PublicStageThreadTurnsMeta
  display_projection?: import('../../shared/forum-orchestration.js').TurnDisplayProjection[] | null
  thread_capsule?: import('../../shared/forum-orchestration.js').ThreadCapsule | null
}

export interface ThreadDetailParams {
  turn_cursor?: string | null
  turn_limit?: number
  around_turn_id?: string | null
  include_projection?: boolean
  include_capsule?: boolean
}

export type ForumWatchTelemetryEventType =
  | 'guide_render'
  | 'guide_click'
  | 'branch_expand'
  | 'node_focus'
  | 'timeline_open'
  | 'reply_anchor_select'

export interface Vote {
  id: string
  voter_agent_id: string
  target_type: 'POST' | 'THREAD' | 'TURN' | 'MESSAGE'
  target_id: string
  direction: VoteDirection
  weight: number
  created_at: string
}

export interface Agent {
  id: string
  owner_id: string | null
  display_name: string
  avatar_url: string | null
  persona_version: number
  reputation_score: number
  status: AgentStatus
  deleted_at?: string | null
  agent_kind?: 'owner' | 'system'
  public_identity?: import('../../shared/semantic-taxonomy.js').AgentPublicIdentity | null
  public_projection?: import('../../shared/semantic-taxonomy.js').AgentPublicProjection | null
  public_proof?: import('../../shared/semantic-taxonomy.js').AgentPublicProof | null
  system_identity?: SystemIdentitySummary | null
  surface_access?: AgentSurfaceAccess | null
  persona_seed_code?: string
  persona_seed_label?: string
  home_voice_line_id?: string
  home_voice_line_label?: string
  identity_contract?: AgentIdentityContract
  personality_narrative?: OwnerPersonalityNarrative | null
  inference_profile_debug?: InferenceProfileDebugData | null
  is_followed?: boolean
  social_bio?: AgentSocialBio | null
  public_stats?: AgentPublicStats
  last_private_preview?: AgentLastPrivatePreview | null
  created_at: string
  updated_at: string
}

export interface AgentLastPrivatePreview {
  session_id: string
  message_id: string | null
  kind: 'text' | 'image' | 'empty'
  text: string
  created_at: string
}

export interface OwnerPersonalityNarrative {
  summary: string
  bullets: string[]
  growthNote: string
  stageNote: string | null
  migrationNote: string | null
}

export interface InferenceTemperamentAxes {
  warmth: number
  spine: number
  spark: number
  composure: number
  depth: number
  stageAffinity: number
}

export interface InferenceSignals {
  risk: number
  initiative: number
}

export interface InferenceProfileSnapshot {
  axes: InferenceTemperamentAxes
  signals: InferenceSignals
  familyScores: Record<string, number>
  stageEligible: boolean
  requestedTierFloor: 'lite' | 'base' | 'premium' | null
}

export interface InferenceProfileInfo {
  agentId: string
  profileVersion: number
  incumbentFamily: string
  challengerFamily: string | null
  challengerVoiceLineId: string | null
  migrationState: 'stable' | 'candidate' | 'shadow' | 'blocked'
  consecutiveLeadWindows: number
  challengerScoreDelta: number | null
  manualVoiceLineLock: boolean
  candidateSince: string | null
  shadowStartedAt: string | null
  effectiveAt: string | null
  blockedAt: string | null
  blockedReason: string | null
  freezeUntil: string | null
  lastCompiledAt: string
  lastSnapshot: InferenceProfileSnapshot
  updatedAt: string
}

export interface InferenceProfileDebugData {
  profile: InferenceProfileInfo
  snapshot: InferenceProfileSnapshot
  shadowReview?: AgentInferenceShadowReview | null
}

export interface ShadowCompareDimensionResult {
  dimension: 'persona_lock' | 'emotional_continuity' | 'watchability' | 'callback_fidelity'
  score: number
  status: 'pass' | 'warn' | 'fail'
  summary: string
}

export interface ShadowReviewEvidence {
  beforeObservability: Record<string, unknown>
  afterObservability: Record<string, unknown>
  identityWriteDelta: {
    before_success_total: number
    before_failure_total: number
    after_success_total: number
    after_failure_total: number
  }
  costAttribution: Record<string, unknown>
  gate: Record<string, unknown>
  window: {
    visibleSuccessCount: number
    visibleFailureCount: number
    hiddenSuccessCount: number
    hiddenFailureCount: number
    fallbackCount: number
    sampleWindowMinutes: number
  }
  fallbackEntries: Array<{
    created_at: string
    intent: string
    visibility: string
    fallback_level: string
    provider_id: string | null
    model_id: string | null
    success: boolean
    error_code: string | null
  }>
}

export interface AgentInferenceShadowReview {
  id: string
  agentId: string
  reviewCaseId: string | null
  incumbentFamily: string
  incumbentVoiceLineId: string
  challengerFamily: string
  challengerVoiceLineId: string
  status: 'running' | 'collected' | 'applied' | 'rejected' | 'superseded'
  summary: {
    recommendation: 'approve' | 'hold' | 'reject'
    reasons: string[]
    compareDimensions: ShadowCompareDimensionResult[]
  }
  evidence: ShadowReviewEvidence
  startedAt: string
  collectedAt: string | null
  decidedAt: string | null
  decidedByUserId: string | null
  createdAt: string
  updatedAt: string
}

export interface AgentIdentityVisiblePersona {
  name: string
  style: string
  interests: string[]
  language: string
}

export interface OwnerStylePins extends StyleSettings {
  interests?: string[]
}

export interface AgentIdentityContract {
  source: IdentityContractSource
  persona_seed_code: string
  persona_seed_label: string
  home_voice_line_id: string
  home_voice_line_label: string
  owner_style_pins: OwnerStylePins
  visible_persona: AgentIdentityVisiblePersona
}

export interface EvidenceRef {
  kind: string
  ref_id: string
  summary?: string
  url?: string
  at?: string | null
  weight?: number
}

export type AchievementVisibility = 'PUBLIC' | 'OWNER_ONLY'
export type AchievementScope = 'global' | 'community' | 'peer'
export type ChronicleType =
  | 'ACHIEVEMENT'
  | 'RELATION_CHANGE'
  | 'HIGHLIGHT'
  | 'PRIVATE_DIGEST'
  | 'MODERATION'

export interface AgentAchievementItem {
  id: string
  agent_id: string
  code: string
  name: string
  category: string
  tier: 1 | 2 | 3
  scope: AchievementScope
  scope_key: string
  rarity: number
  visibility: AchievementVisibility
  achieved_at: string
  evidence: EvidenceRef[]
  signal_context?: {
    source_event_id?: string | null
    content_kind?: string | null
    shelf_id?: string | null
    storyline_id?: string | null
    dedup_key?: string | null
  } | null
  award_context?: {
    trigger_kind?: string | null
    trigger_mode?: string | null
    metric_name?: string | null
    metric_value?: number | null
    threshold?: number | null
    evidence_satisfied?: boolean | null
    visibility_reason?: string | null
    dedup_key?: string | null
  } | null
  created_at: string
  updated_at: string
}

export interface ChronicleEntryItem {
  id: string
  agent_id: string
  visibility: AchievementVisibility
  type: ChronicleType
  occurred_at: string
  title: string
  summary: string
  importance_score: number
  evidence: EvidenceRef[]
  actors: string[]
  location: string | null
  tags: string[]
  scope: AchievementScope
  scope_key: string
  signal_context?: {
    community_id?: string | null
    source_event_id?: string | null
    content_kind?: string | null
    shelf_id?: string | null
    storyline_id?: string | null
    dedup_key?: string | null
  } | null
  story_context?: {
    scene_label?: string | null
    emotion_before?: string | null
    emotion_after?: string | null
    reaction_sentence?: string | null
    outcome_sentence?: string | null
    next_hook?: string | null
  } | null
  entry_source?: string | null
  source_event_ids?: string[]
  dedup_key: string | null
  created_at: string
  updated_at: string
}

export interface AgentHighlightsData {
  agent_id: string
  public_identity?: import('../../shared/semantic-taxonomy.js').AgentPublicIdentity | null
  public_projection?: import('../../shared/semantic-taxonomy.js').AgentPublicProjection | null
  public_proof?: import('../../shared/semantic-taxonomy.js').AgentPublicProof | null
  top_chronicle: Array<{
    id: string
    title: string
    summary: string
    occurred_at: string
    importance_score: number
    visual?: SurfaceMediaAttachment | null
  }>
}

export interface GlobalHighlightsData {
  hot_threads: PostWithMeta[]
  featured_agents: Array<{
    agent_id: string
    display_name: string
    public_identity?: import('../../shared/semantic-taxonomy.js').AgentPublicIdentity | null
    public_projection?: import('../../shared/semantic-taxonomy.js').AgentPublicProjection | null
    public_proof?: import('../../shared/semantic-taxonomy.js').AgentPublicProof | null
    recent_post?: {
      id: string
      title: string
      created_at: string
      media?: PostMediaItem[]
    } | null
    weekly_stats?: {
      post_count: number
      upvote_count: number
    } | null
    top_chronicle: Array<{
      id: string
      title: string
      summary: string
      occurred_at: string
      importance_score: number
      visual?: SurfaceMediaAttachment | null
    }>
    relation_teaser?: RelationSummaryTeaser | null
  }>
  controversy: PostWithMeta[]
  wildcard_cameos: Array<{
    chronicle_id: string
    agent_id: string
    title: string
    summary: string
    occurred_at: string
    importance_score: number
  }>
  meta: {
    range: 'today'
    generated_at: string
    source: string
  }
}

export interface HumanVoteSummary {
  agent_up: number
  agent_down: number
  agent_score: number
  human_up: number
  human_down: number
  human_score: number
  weighted_score: number
}

export interface HumanVoteResult {
  vote: {
    id: string
    direction: VoteDirection
    target_type: 'POST' | 'THREAD' | 'TURN'
    target_id: string
  }
  summary: HumanVoteSummary
}

export interface AgentMediaSemanticSummary {
  scene: string
  composition: string
  style: {
    theme: string
    mood: string
    tags: string[]
  }
  entities: {
    discussion_points: string[]
    salient: string[]
  }
  ocr: {
    snippets: string[]
  }
  safety: {
    labels: string[]
  }
  summaries: {
    public_safe: string
    internal_full: string
  }
  confidence: number
}

export interface AgentMediaAsset {
  asset_id: string
  visibility_policy: 'private_only' | 'public_original_allowed' | 'public_derivative_only' | 'blocked'
  lifecycle_status: 'active' | 'archived' | 'blocked'
  media_url: string
  mime_type: string
  file_size_bytes: number
  width: number | null
  height: number | null
  owner_note: string | null
  semantic_summary: AgentMediaSemanticSummary
  created_at: string
  latest_post_id: string | null
}

export interface AgentMediaCurrentState {
  pool: {
    anchor_scene_id: string
    active_count: number
    latest_asset: AgentMediaAsset | null
  }
  latest_public_attachment: AgentMediaAsset | null
}

export interface AgentConfig {
  id: string
  agent_id: string
  config_json: Record<string, unknown>
  risk_level?: 'LOW' | 'HIGH'
  review_status?: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED'
  review_case_id?: string | null
  lint_warnings?: string[]
  updated_at: string
  effective_at: string
  updated_by: string
}

export interface AgentRun {
  id: string
  agent_id: string
  trigger_event_id: string
  input_digest: string
  output_json: Record<string, unknown> | null
  moderation_result: ModerationVerdict | null
  token_cost: number
  latency_ms: number
  created_at: string
}

export interface Community {
  id: string
  name: string
  slug: string
  description: string | null
  rules_json: Record<string, unknown> | null
  active_member_count: number
  community_semantics?: import('../../shared/semantic-taxonomy.js').CommunitySemanticContract | null
  interaction_contract?: import('../../shared/semantic-taxonomy.js').CommunityInteractionContract | null
  visibility_default: ContentVisibility
  created_at: string
  updated_at: string
}

export type FollowingCommunityListItem = Pick<Community, 'id' | 'name' | 'slug'>

export interface FollowingAgentListItem {
  id: string
  displayName?: string
  display_name?: string
  avatarUrl?: string | null
  avatar_url?: string | null
}

export interface FollowingThreadListItem {
  id: string
  title: string
  replyCount: number
}

export interface FollowingTurnAuthorAgent {
  id?: string
  displayName?: string
  display_name?: string
  name?: string
  avatarUrl?: string | null
  avatar_url?: string | null
}

export interface FollowingTurnData {
  body: string
  authorAgentId?: string
  authorAgent?: FollowingTurnAuthorAgent | null
  thread?: {
    post?: {
      id?: string
      title?: string
    }
  }
}

export type FollowingAgentFeedItem =
  | {
      type: 'POST'
      post?: PostWithMeta
      createdAt: string
    }
  | {
      type: 'TURN'
      turn?: FollowingTurnData
      createdAt: string
    }

export interface FollowingThreadFeedItem {
  threadId: string
  postTitle: string
  latestTurn?: {
    body: string
    authorAgent?: {
      displayName?: string
      name?: string
    } | null
  }
  newReplyCount: number
  createdAt: string
}

export type CommunityLifecycleState =
  | 'launch_core'
  | 'launch_support'
  | 'seasonal_active'
  | 'incubating_gray'
  | 'dormant'
  | 'merged'
  | 'archived'

export type CommunityIncubationVisibilityMode = 'GRAY' | 'WHITELIST_ONLY'

export type CommunityProposalStatus =
  | 'SUBMITTED'
  | 'REJECTED'
  | 'INCUBATING'
  | 'SEASONAL'
  | 'ACTIVATED'
  | 'MERGED'
  | 'ARCHIVED'

export type CommunityProposalAction =
  | 'reject'
  | 'merge'
  | 'incubate'
  | 'seasonal_slot'
  | 'activate'
  | 'archive'

export interface CommunityProposal {
  id: string
  submitted_by_user_id: string
  name: string
  slug_candidate: string
  description: string
  premise_text: string
  target_audience: string | null
  scene_types: string[]
  proposed_community_family: import('../../shared/semantic-taxonomy.js').CommunityFamily
  publication_review_profile_id: import('../../shared/semantic-taxonomy.js').PublicationReviewProfileId
  launch_wave: string | null
  public_participation_mode: import('../../shared/semantic-taxonomy.js').PublicParticipationMode
  audience_signal_ingestion: import('../../shared/semantic-taxonomy.js').AudienceSignalIngestion
  agent_human_response_mode: import('../../shared/semantic-taxonomy.js').AgentHumanResponseMode
  source_community_id: string | null
  status: CommunityProposalStatus
  incubation_visibility_mode: CommunityIncubationVisibilityMode | null
  resulting_community_id: string | null
  merged_into_community_id: string | null
  reviewed_by_user_id: string | null
  reviewed_at: string | null
  last_action: CommunityProposalAction | null
  last_action_reason: string | null
  created_at: string
  updated_at: string
}

export interface CommunityMergeRecommendationDecisionContext {
  basis: 'empty_catalog' | 'catalog_overlap'
  best_match_slug: string | null
  text_overlap: number
  scene_overlap: number
  publication_profile_bonus: number
  community_family_bonus: number
  thresholds: {
    merge_threshold: number
    lane_threshold: number
    gray_visibility_threshold: number
  }
}

export interface CommunityMergeRecommendation {
  id: string
  proposal_id: string
  duplicate_of_community_id: string | null
  recommended_as_lane_community_id: string | null
  recommended_as_seasonal: boolean
  incubation_visibility_mode: CommunityIncubationVisibilityMode
  overlap_score: number
  rationale: string[]
  decision_context: CommunityMergeRecommendationDecisionContext | null
  created_at: string
  updated_at: string
}

export interface CommunityProposalEvent {
  id: string
  proposal_id: string
  actor_type: 'human' | 'system'
  actor_id: string
  event_type: string
  payload_json: Record<string, unknown> | null
  created_at: string
}

export interface CommunityProposalListItem {
  proposal: CommunityProposal
  recommendation: CommunityMergeRecommendation | null
}

export interface CommunityProposalDetail extends CommunityProposalListItem {
  events: CommunityProposalEvent[]
}

export interface CommunityProposalActionResult {
  proposal: CommunityProposal
  recommendation: CommunityMergeRecommendation | null
  community: Community | null
  config_patch_id: string | null
  config_version_id: string | null
  config_version: number | null
}

export interface GovernanceResult {
  success: boolean
  action: GovernanceActionType
  target_id: string
  new_visibility?: ContentVisibility
  new_state?: ContentState
}

export type WarmupSuiteState = 'draft' | 'review_ready' | 'active' | 'archived'
export type WarmStartBatchKind = 'kickoff' | 'warmup'
export type WarmStartBatchState =
  | 'draft'
  | 'generating'
  | 'review_ready'
  | 'active'
  | 'archived'
  | 'failed'
export type WarmupReviewDecision = 'pass_to_active' | 'not_passed'
export type WarmupReviewReasonCode =
  | 'content_quality'
  | 'distribution_density'
  | 'media_coverage'
  | 'kickoff_invalid'
  | 'process_issue'
export type WarmupGovernanceAction = 'quarantine' | 'restore' | 'archive'

export interface WarmupContentSample {
  post_id: string
  title: string
  community_id: string
  community_slug: string
  community_name: string
  visibility: ContentVisibility
  state: ContentState
  distribution_state: string
  thread_count: number
  turn_count: number
  media_count: number
  vote_count: number
  created_at: string
}

export interface WarmupBatchReadModel {
  id: string
  batch_kind: WarmStartBatchKind
  state: WarmStartBatchState
  source_batch_id: string | null
  revision_key: string | null
  package_hash: string | null
  notes: string | null
  activated_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  stats: {
    posts: number
    threads: number
    turns: number
    votes: number
    media: number
    communities: number
    media_covered_posts: number
    media_coverage_ratio: number
  }
  coverage: Array<{
    community_id: string
    community_slug: string
    community_name: string
    post_count: number
  }>
  samples: WarmupContentSample[]
}

export interface WarmupSuiteListItem {
  id: string
  state: WarmupSuiteState
  suite_label: string | null
  created_at: string
  updated_at: string
  activated_at: string | null
  archived_at: string | null
  latest_review: {
    id: string
    decision: WarmupReviewDecision
    reason_codes: WarmupReviewReasonCode[]
    note: string | null
    created_at: string
  } | null
  summary: {
    posts: number
    threads: number
    turns: number
    votes: number
    media: number
    communities: number
    media_coverage_ratio: number
  }
  kickoff_batch: Pick<WarmupBatchReadModel, 'id' | 'state' | 'stats'> | null
  warmup_batch: Pick<WarmupBatchReadModel, 'id' | 'state' | 'stats'> | null
}

export interface WarmupSuiteDetail {
  id: string
  state: WarmupSuiteState
  suite_label: string | null
  created_by_user_id: string | null
  created_at: string
  updated_at: string
  activated_at: string | null
  archived_at: string | null
  kickoff_batch_id: string | null
  warmup_batch_id: string | null
  latest_review: {
    id: string
    reviewer_user_id: string | null
    decision: WarmupReviewDecision
    reason_codes: WarmupReviewReasonCode[]
    note: string | null
    created_at: string
    is_fresh_for_current_batches: boolean
  } | null
  active_baseline: {
    id: string
    is_current: boolean
    previous_baseline_id: string | null
    activated_by_user_id: string | null
    activated_at: string
    deactivated_at: string | null
  } | null
  summary: {
    posts: number
    threads: number
    turns: number
    votes: number
    media: number
    communities: number
    media_covered_posts: number
    media_coverage_ratio: number
  }
  activation_readiness: {
    ok: boolean
    reasons: string[]
  }
  coverage: Array<{
    community_id: string
    community_slug: string
    community_name: string
    post_count: number
  }>
  programming_health: {
    required_daily_outcomes: Record<string, number>
    observed_daily_outcomes: Record<string, number>
    daypart_readiness: Array<{
      daypart_id: string
      label: string
      ok: boolean
    }>
    community_supply_floor: Array<{
      community_slug: string
      community_name: string
      ok: boolean
      missed_slots: number
    }>
    visual_ratio_ok: boolean
    aftershow_pipeline_ok: boolean
    warning_count: number
    warnings: Array<{
      code: string
      severity: 'warn' | 'critical'
      message: string
      affected_daypart?: string | null
      affected_community_slug?: string | null
    }>
  }
  kickoff_batch: WarmupBatchReadModel | null
  warmup_batch: WarmupBatchReadModel | null
  actions: {
    can_review: boolean
    can_retry: boolean
    can_rebuild: boolean
    can_archive: boolean
  }
}

export interface KickoffSuiteEditApplyPayload extends KickoffSuiteEditApplyResult {
  suite_detail: WarmupSuiteDetail
}

export interface WarmupGovernancePreview {
  action: WarmupGovernanceAction
  suite_id: string | null
  warm_start_batch_ids: string[]
  scope: {
    posts: string[]
    threads: string[]
    turns: string[]
    media: string[]
  }
  counts: {
    posts: number
    threads: number
    turns: number
    media: number
  }
}

export interface RuntimeBaselineAdmission {
  active_baseline_id: string | null
  suite_id: string | null
  kickoff_batch_id: string | null
  warmup_batch_id: string | null
  has_active_baseline: boolean
  kickoff_layer_ready: boolean
  warmup_layer_ready: boolean
  key_communities_ready: boolean
  key_shelves_ready: boolean
  media_access_ok: boolean
  aftershow_pipeline_ok: boolean
  last_review_decision_ok: boolean
  worker_health_ok: boolean
  llm_credentials_ok: boolean
  allow_public_growth: boolean
  reasons: string[]
}

export interface WarmupLaunchResult {
  suite_id: string
  suite_state: WarmupSuiteState
  suite_label: string | null
  kickoff_batch_id: string
  warmup_batch_id: string
  reused_existing_suite: boolean
  created_posts: Array<{
    spec_id: string
    post_id: string
    title: string
    agent_id: string
    community_id: string
    community_slug: string
    batch_id: string
    batch_kind: WarmStartBatchKind
  }>
  skipped_posts: Array<never>
  runtime_top_up: {
    enabled: boolean
    running: boolean
    attempted: number
    triggered: number
    errors: string[]
  }
  verification: {
    ok: boolean
    missing: string[]
    suite_state: WarmupSuiteState
    batch_states: Record<'kickoff' | 'warmup', WarmStartBatchState>
    total_candidate_posts: number
    total_candidate_threads: number
    total_candidate_turns: number
    total_candidate_votes: number
    total_candidate_media: number
    active_baseline: Omit<RuntimeBaselineAdmission, 'worker_health_ok' | 'llm_credentials_ok'>
  }
}

export type ConfigRiskLevel = 'LOW' | 'HIGH'
export type ConfigPatchStatus =
  | 'PROPOSED'
  | 'VALIDATED'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'APPLIED'
  | 'REJECTED'
  | 'ROLLED_BACK'

export interface CommunityConfigPatch {
  id: string
  community_id: string
  base_version_id: string | null
  status: ConfigPatchStatus
  risk_level: ConfigRiskLevel
  patch_json: Record<string, unknown>
  proposed_rules_json: Record<string, unknown> | null
  summary: string | null
  reason: string | null
  proposed_by_user_id: string
  validated_by_user_id: string | null
  approved_by_user_id: string | null
  applied_version_id: string | null
  applied_version_number: number | null
  rejected_reason: string | null
  validated_at: string | null
  validation_failed_at: string | null
  approved_at: string | null
  scheduled_by_user_id: string | null
  scheduled_at: string | null
  effective_at: string | null
  applied_at: string | null
  rolled_back_at: string | null
  scheduler_retry_count: number
  scheduler_last_error: string | null
  scheduler_last_error_at: string | null
  scheduler_next_retry_at: string | null
  scheduler_retry_exhausted_at: string | null
  created_at: string
  updated_at: string
}

export interface CommunityConfigVersion {
  id: string
  community_id: string
  version: number
  rules_json: Record<string, unknown>
  source_patch_id: string | null
  seed_key: string | null
  source: string | null
  status: 'ACTIVE' | 'ROLLED_BACK' | 'RETIRED'
  risk_level: ConfigRiskLevel
  created_by_user_id: string | null
  applied_by_actor_id: string | null
  rollback_from_version_id: string | null
  rollback_reason: string | null
  effective_at: string | null
  applied_at: string | null
  rolled_back_at: string | null
  created_at: string
  updated_at: string
}

export interface CommunityConfigValidationResult {
  patch: CommunityConfigPatch
  validation_errors: string[]
}

export interface CommunityConfigApplyResult {
  patch: CommunityConfigPatch
  version: CommunityConfigVersion | null
}

export interface GovernanceActionLog {
  id: string
  case_id: string | null
  action: string
  target_type: string
  target_id: string
  actor_user_id: string
  reason: string | null
  result: Record<string, unknown> | null
  created_at: string
}

export interface DisclosureCapOverride {
  id: string
  scope_type: 'agent' | 'community'
  scope_id: string
  cap_level: number
  status: 'ACTIVE' | 'RELEASED'
  source: 'manual' | 'owner_endorsement_public' | 'owner_private_leak'
  reason: string | null
  linked_case_id: string | null
  linked_risk_event_id: string | null
  created_by_user_id: string
  released_by_user_id: string | null
  released_reason: string | null
  released_at: string | null
  created_at: string
}

export interface RiskEventLog {
  id: string
  policy_snapshot_id: string | null
  case_id: string | null
  channel: string
  event_type: string
  action: string
  risk_level: string | null
  risk_score: number | null
  risk_categories: string[]
  target_type: string | null
  target_id: string | null
  community_id: string | null
  agent_id: string | null
  user_id: string | null
  room_id: string | null
  session_id: string | null
  message_id: string | null
  detail_text: string | null
  payload: Record<string, unknown> | null
  created_at: string
}

export interface ReviewCase {
  id: string
  case_type:
    | 'MODERATION'
    | 'COMPLAINT'
    | 'APPEAL'
    | 'IDENTITY_REVIEW'
    | 'CONFIG_REVIEW'
    | 'HOT_TOPIC'
  queue:
    | 'MODERATION'
    | 'COMPLAINT'
    | 'APPEAL'
    | 'IDENTITY_REVIEW'
    | 'CONFIG_REVIEW'
    | 'PRIVACY'
    | 'DELETION'
    | 'HOT_TOPIC'
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED'
  priority: number
  summary_text: string | null
  risk_summary: Record<string, unknown> | null
  opened_reason: string | null
  opened_by: string
  primary_target_type: string | null
  primary_target_id: string | null
  assigned_to_user_id: string | null
  sla_due_at: string | null
  claimed_by_user_id: string | null
  claimed_at: string | null
  linked_policy_snapshot_id: string | null
  linked_complaint_ticket_id: string | null
  linked_appeal_request_id: string | null
  resolution_action: string | null
  resolved_by_user_id: string | null
  resolution_note: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface ReviewCaseTarget {
  id: string
  case_id: string
  target_type: string
  target_id: string
  relation_type: 'PRIMARY' | 'RELATED' | 'PARENT_THREAD' | 'SESSION_MEMBER' | 'OWNER' | 'AGENT'
  channel: string
  community_id: string | null
  agent_id: string | null
  user_id: string | null
  room_id: string | null
  session_id: string | null
  message_id: string | null
  created_at: string
}

export interface ReviewEvidenceSnapshot {
  id: string
  case_id: string
  snapshot_type: string
  payload: Record<string, unknown>
  content: Record<string, unknown> | null
  context: Record<string, unknown> | null
  policy_hits: Record<string, unknown> | null
  prompt_memory: Record<string, unknown> | null
  topic_signals: Record<string, unknown> | null
  action_history: Record<string, unknown> | null
  evidence_package: Record<string, unknown> | null
  created_at: string
}

export interface ReviewTask {
  id: string
  case_id: string
  queue:
    | 'MODERATION'
    | 'COMPLAINT'
    | 'APPEAL'
    | 'IDENTITY_REVIEW'
    | 'CONFIG_REVIEW'
    | 'PRIVACY'
    | 'DELETION'
    | 'HOT_TOPIC'
  task_type: string
  status: 'PENDING' | 'ASSIGNED' | 'COMPLETED' | 'CANCELED'
  assignee_user_id: string | null
  claim_token: string | null
  claimed_by_user_id: string | null
  claimed_at: string | null
  assigned_role: string | null
  due_at: string | null
  resolution_code: string | null
  operator_note: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface ClaimedReviewTask {
  task: ReviewTask
  case: ReviewCase | null
}

export interface TransferredReviewCase {
  task: ReviewTask | null
  case: ReviewCase | null
}

export interface ReleasedReviewCase {
  case: ReviewCase | null
  tasks: ReviewTask[]
}

export interface ReviewCaseDetail {
  case: ReviewCase
  targets: ReviewCaseTarget[]
  evidence: ReviewEvidenceSnapshot[]
  tasks: ReviewTask[]
  linked_complaint: ComplaintTicket | null
  linked_appeal: AppealRequest | null
}

export interface ReviewEvidenceExport {
  case: ReviewCase
  linked_complaint: ComplaintTicket | null
  linked_appeal: AppealRequest | null
  targets: ReviewCaseTarget[]
  tasks: ReviewTask[]
  action_logs: GovernanceActionLog[]
  redaction_level: 'operator' | 'share'
  redaction_notes: string[]
  evidence: Array<{
    id: string
    snapshot_type: string
    evidence_package: Record<string, unknown> | null
    created_at: string
  }>
  exported_at: string
}

export interface PromptAuditServerCapSource {
  source_type: 'baseline' | 'agent_override' | 'community_override' | 'hot_topic_runtime'
  scope_type: 'agent' | 'community' | 'runtime'
  scope_id: string | null
  cap_level: number
  source:
    | 'agent_privacy_settings'
    | 'manual'
    | 'owner_endorsement_public'
    | 'owner_private_leak'
    | 'hot_topic_drift'
  override_id?: string | null
  reason?: string | null
  linked_case_id?: string | null
  linked_risk_event_id?: string | null
}

export interface AgentPrivateProvenanceSummary {
  run_id: string
  used_memory_ids: string[]
  requested_disclosure_level: number
  effective_disclosure_level: number
  cap_source: 'owner_setting' | 'server_cap'
  public_disclosure_cap: number | null
  server_cap_sources: PromptAuditServerCapSource[]
}

export interface AgentRiskProfile {
  agent: Agent
  latest_config: AgentConfig | null
  spillover_events: RiskEventLog[]
  recent_config_actions: GovernanceActionLog[]
  recent_private_provenance: AgentPrivateProvenanceSummary[]
  active_cap_overrides: DisclosureCapOverride[]
  cap_history: DisclosureCapOverride[]
  effective_disclosure_cap: number | null
}

export interface DisclosureCapQueryResult {
  scope_type: 'agent' | 'community'
  scope_id: string
  active_override: DisclosureCapOverride | null
  history: DisclosureCapOverride[]
}

export interface HotTopicDashboardItem {
  target_type: 'post' | 'room'
  target_id: string
  title: string
  community_id: string | null
  topic_domain: string
  hot_score: number
  drift_risk_score: number
  report_count_24h: number
  distribution_state: 'NORMAL' | 'NO_RECOMMEND' | 'BLOCKED'
  restriction_state: 'NORMAL' | 'MANUAL_REVIEW_ONLY' | 'BLOCKED'
  sampled_review_required: boolean
  linked_case_id: string | null
  latest_event_at: string | null
}

export interface HotTopicAlert {
  severity: 'low' | 'medium' | 'high'
  reason: string
  item: HotTopicDashboardItem
}

export interface IdentityVerification {
  id: string
  user_id: string
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED'
  method: 'MANUAL_REVIEW' | 'SUPPLIER_PLACEHOLDER'
  reviewed_by_user_id: string | null
  reason: string | null
  submitted_at: string
  reviewed_at: string | null
  expires_at: string | null
}

export interface ComplaintTicket {
  id: string
  reporter_user_id: string
  target_type: string
  target_id: string
  complaint_type:
    | 'CONTENT_REPORT'
    | 'PRIVACY_REQUEST'
    | 'DELETION_REQUEST'
    | 'IMPERSONATION_REPORT'
    | 'MISLABEL_REPORT'
    | 'HARASSMENT_REPORT'
    | 'OTHER'
  reason_code: string
  detail_text: string | null
  attachments: Array<{ ref: string; type: string }>
  status: 'OPEN' | 'LINKED' | 'RESOLVED' | 'REJECTED'
  linked_case_id: string | null
  resolution: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface AppealRequest {
  id: string
  requester_user_id: string
  requester_type: 'USER' | 'OWNER' | 'OPERATOR'
  target_type: string
  target_id: string
  appeal_type: 'CONTENT_APPEAL' | 'ACCOUNT_LIMIT_APPEAL' | 'AGENT_RESTRICTION_APPEAL' | 'OTHER'
  linked_case_id: string | null
  linked_complaint_ticket_id: string | null
  reason: string
  status: 'OPEN' | 'LINKED' | 'RESOLVED' | 'REJECTED'
  result: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type FeedbackCategory =
  | 'PRODUCT_SUGGESTION'
  | 'BUG_REPORT'
  | 'UX_ISSUE'
  | 'OTHER'

export type FeedbackStatus = 'RECEIVED' | 'UNDER_REVIEW' | 'PLANNED' | 'CLOSED'

export interface FeedbackActor {
  id: string
  display_name: string
  email: string | null
}

export interface FeedbackAttachmentView {
  id: string
  mime_type: string
  file_size_bytes: number
  width: number | null
  height: number | null
  url: string
}

export interface FeedbackHistoryEntry {
  id: string
  event_type: 'SUBMITTED' | 'STATUS_CHANGED' | 'PUBLIC_NOTE_UPDATED' | 'INTERNAL_NOTE_UPDATED'
  from_status: FeedbackStatus | null
  to_status: FeedbackStatus | null
  message: string | null
  visibility: 'USER' | 'ADMIN_ONLY'
  created_at: string
  actor: FeedbackActor | null
}

export interface FeedbackTicketSummary {
  id: string
  category: FeedbackCategory
  title: string
  body: string
  entry_surface: string | null
  source_route: string | null
  status: FeedbackStatus
  public_resolution_note: string | null
  updated_at: string
  created_at: string
  attachments: FeedbackAttachmentView[]
}

export interface FeedbackTicketDetail extends FeedbackTicketSummary {
  history: FeedbackHistoryEntry[]
}

export interface AdminFeedbackTicketSummary extends FeedbackTicketSummary {
  submitter: FeedbackActor
}

export interface AdminFeedbackTicketDetail extends FeedbackTicketDetail {
  internal_note: string | null
  submitter: FeedbackActor
}

export interface AdminInviteCodeSummary {
  id: string
  code: string
  status: 'ACTIVE' | 'DISABLED'
  usedCount: number
  maxUses: number
  remainingUses: number
  note: string | null
  lastUsedAt: string | null
  sharePath: string
}

export interface AdminUserSummary {
  id: string
  email: string | null
  phone: string | null
  displayName: string
  planTier: 'FREE' | 'PRO' | 'ADMIN'
  status: 'ACTIVE' | 'SUSPENDED'
  isBootstrapAdmin: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export type HealthCheckStatus = 'ok' | 'fail' | 'skipped'

export interface HealthData {
  ok: boolean
  service: string
  checks: {
    app: HealthCheckStatus
    db?: HealthCheckStatus
    redis?: HealthCheckStatus
  }
  version: string
  ts: string
}

export interface PaginationParams {
  cursor?: string
  limit?: number
}

export type FeedSort = 'new' | 'hot' | 'top'

export interface FeedParams extends PaginationParams {
  community_id?: string
  sort?: FeedSort
  following_only?: boolean
  viewer_agent_id?: string
}

// ─── Chat types ──────────────────────────────────────────────

export type RoomStatus = 'active' | 'cooling' | 'archived'
export type ChatMessageKind = 'normal' | 'skip_feedback' | 'ambient' | 'greeting'
export type RoomSceneType =
  | 'FREE_CHAT'
  | 'TALK_SHOW'
  | 'ROUND_TABLE'
  | 'ROAST'
  | 'DEBATE'
  | 'SLICE_OF_LIFE'
  | 'STORY_LAB'
export type RoomCastRole =
  | 'HOST'
  | 'REGULAR'
  | 'FOIL'
  | 'SKEPTIC'
  | 'EXPLAINER'
  | 'WILDCARD'
  | 'CHRONICLER'
export type RoomBeatType =
  | 'OPENING'
  | 'HOOK'
  | 'EXPLAIN'
  | 'CLASH'
  | 'CALLBACK'
  | 'COOL_DOWN'
  | 'RECAP'
  | 'LANDING'
export type RoomCueType = 'ADVANCE' | 'ASK' | 'CALLBACK' | 'SUMMARIZE' | 'COOL_DOWN' | 'CLOSE'
export type RoomHighlightKind = 'CALLBACK' | 'PUNCHLINE' | 'CHARACTER_MOMENT' | 'SUMMARY' | 'CLASH'
export type SpotlightPreference = 'LOW' | 'MEDIUM' | 'HIGH'

export interface RoomWanderPolicy {
  enabled: boolean
  entry_cooldown_ms: number
  max_parallel_rooms: number
  min_discoverability_score: number
}

export interface AgentPublicProjectionView {
  id: string
  agent_id: string
  scene_affinity_json: Record<string, number>
  banter_style: string
  conflict_threshold: number
  callback_habit: number
  signature_moves_json: string[]
  disclosure_policy_json: Record<string, unknown>
  follow_targets_json: string[]
  avoid_targets_json: string[]
  role_tendency: RoomCastRole | null
  spotlight_preference: SpotlightPreference
  public_projection_hint: string
  created_at: string
  updated_at: string
}

export interface RoomSelectionLedgerEntry {
  id: string
  room_id: string
  episode_id: string | null
  beat_id: string | null
  program_event_id: string
  candidate_agent_id: string
  selected: boolean
  final_score: number
  reasons_json: Array<{
    code: string
    value: number
    message: string
  }>
  created_at: string
}

export interface RoomProgramEventRecord {
  id: string
  room_id: string
  episode_id: string | null
  beat_id: string | null
  event_type: 'RAW_MESSAGE' | 'ROOM_TICK' | 'PROGRAM_CUE'
  status: 'PENDING' | 'PLANNED' | 'EXECUTED' | 'SKIPPED' | 'FAILED'
  cue_type: RoomCueType | null
  director_goal: string | null
  selected_speaker_agent_id: string | null
  idempotency_key: string
  payload_json: Record<string, unknown> | null
  error_text: string | null
  created_at: string
  updated_at: string
  selection_reasons: RoomSelectionLedgerEntry[]
}

export interface RoomSharedMemory {
  id: string
  room_id: string
  episode_id: string | null
  memory_kind: 'CONTINUITY' | 'CAMEO' | 'CANONIZATION'
  summary_text: string
  tags: string[]
  source_message_id: string | null
  source_highlight_id: string | null
  score: number
  created_at: string
  updated_at: string
}

export interface RoomWatchabilitySummary {
  scene_type: RoomSceneType
  current_beat: RoomBeatType | null
  live_hook: string | null
  unresolved_question: string | null
  active_cast_preview: Array<{
    agent_id: string
    name: string
    role: RoomCastRole
  }>
  last_highlight_text: string | null
  energy: number
  tension: number
  continuity_summary?: string | null
  canonization_note?: string | null
  cameo_hint?: string | null
  snapshot_updated_at: string | null
  hot_topic_mode?: 'NORMAL' | 'MANUAL_REVIEW_ONLY' | 'DISABLED' | null
  distribution_state?: 'NORMAL' | 'NO_RECOMMEND' | 'BLOCKED'
  discoverability_tags?: string[]
}

export interface Room {
  id: string
  name: string
  slug: string
  description: string
  community_id: string | null
  created_by_agent_id: string
  max_agents: number
  status: RoomStatus
  last_message_at: string | null
  created_at: string
  updated_at: string
  viewer_can_control?: boolean
  watchability?: RoomWatchabilitySummary | null
}

export interface RoomMember {
  room_id: string
  member_id: string
  member_type: 'agent'
  display_name: string | null
  join_source: 'dispatched' | 'wandering' | 'creator'
  personal_tick_interval: number
  messages_this_hour: number
  last_spoke_at: string | null
  role_hint?: RoomCastRole | null
  wander_eligible?: boolean
  spotlight_weight?: number
  suppressed_until?: string | null
  joined_at: string
}

export interface RoomWithMembers extends Room {
  members: RoomMember[]
}

export interface RoomLiveSnapshot {
  id: string
  room_id: string
  episode_id: string | null
  scene_type: RoomSceneType
  current_beat: RoomBeatType | null
  live_hook: string | null
  unresolved_question: string | null
  recap_short: string | null
  active_cast: Array<{
    agent_id: string
    name: string
    role: RoomCastRole
    last_spoke_at: string | null
  }>
  last_highlight_text: string | null
  energy: number
  tension: number
  message_cursor_id: string | null
  continuity_summary?: string | null
  canonization_note?: string | null
  cameo_hint?: string | null
  version: number
  created_at: string
  updated_at: string
}

export interface RoomCastView {
  room_id: string
  episode_id: string | null
  cast: Array<{
    agent_id: string
    name: string
    role: RoomCastRole
    chemistry_score: number
    spotlight_weight: number
    last_spoke_at: string | null
    role_hint?: RoomCastRole | null
    wander_eligible?: boolean
    suppressed_until?: string | null
    member_spotlight_weight?: number
    projection?: AgentPublicProjectionView | null
  }>
}

export interface RoomProgramView {
  room_id: string
  enabled: boolean
  scene_type: RoomSceneType
  pacing_preset: string
  target_cast_min: number
  target_cast_max: number
  callback_window: number
  recap_every_turns: number
  max_consecutive_turns: number
  idle_cue_after_ms: number
  allow_wandering: boolean
  director_policy: Record<string, unknown>
  wander_policy: RoomWanderPolicy
  discoverability: {
    tags: string[]
    short_hook: string | null
    default_view: string
  }
  current_episode: {
    episode_id: string
    current_beat: RoomBeatType | null
    energy: number
    tension: number
    turn_count: number
    message_count: number
  } | null
}

export interface ChatMessage {
  id: string
  room_id: string
  author_id: string
  author_display_name?: string | null
  author_type: 'agent'
  episode_id: string | null
  beat_id: string | null
  program_event_id: string | null
  speaker_role: RoomCastRole | null
  cue_type: RoomCueType | null
  body: string
  message_kind: ChatMessageKind
  parent_message_id: string | null
  vote_score: number
  visibility: ContentVisibility
  state: ContentState
  moderation_metadata?: Record<string, unknown> | null
  attachments?: SurfaceMediaAttachment[]
  created_at: string
}

export interface RoomHighlight {
  id: string
  room_id: string
  episode_id: string | null
  beat_id: string | null
  source_message_id: string
  kind: RoomHighlightKind
  text: string
  actor_agent_ids: string[]
  score: number
  visual?: SurfaceMediaAttachment | null
  created_at: string
}

export interface AgentChatConfig {
  talkativeness: number
  allow_wandering: boolean
}

export interface RoomControlMember extends RoomMember {
  name: string
  projection: AgentPublicProjectionView | null
}

export interface RoomControlState {
  room_id: string
  room_status: RoomStatus
  program: RoomProgramView
  snapshot: RoomLiveSnapshot | null
  cast: RoomCastView['cast']
  members: RoomControlMember[]
  recent_highlights: RoomHighlight[]
  recent_program_events: RoomProgramEventRecord[]
  recent_shared_memory: RoomSharedMemory[]
  alerts: string[]
}

// ─── Agent Dashboard / XP types ─────────────────────────────

export interface AgentXpInfo {
  xp: number
  xp_per_growth_point: number
  growth_points_total: number
  growth_points_spent: number
  growth_points_available: number
}

export interface AgentBudgetInfo {
  tier: string
  daily_action_limit: number
  monthly_action_limit: number
  daily_actions_used: number
  monthly_actions_used: number
  daily_reset_at: string
  monthly_reset_at: string
}

export interface AgentCreditInfo {
  credit_score: number
  risk_level: string
  violations: number
  last_violation_at: string | null
}

export interface AgentTraitInfo {
  id: string
  trait_code: string
  category: string
  status: string
  acquired_at: string
  equipped_at: string | null
  evidence: string | null
}

export interface XpEventInfo {
  id: string
  source: string
  title: string
  description: string
  xp_delta: number
  created_at: string
}

export interface AgentDashboardData {
  agent_id: string
  xp: AgentXpInfo
  budget: AgentBudgetInfo | null
  credit: AgentCreditInfo
  traits: AgentTraitInfo[]
  recent_events: XpEventInfo[]
}

export interface CostSummary {
  total_tokens_in: number
  total_tokens_out: number
  action_count: number
  by_action_type: Record<string, { tokens_in: number; tokens_out: number; count: number }>
}

export interface BudgetTierOption {
  daily_action_limit: number
  monthly_action_limit: number
}

export interface TraitDefinition {
  code: string
  emoji: string
  name: string
  category: 'system' | 'adjustable'
  promptFragment: string
}

export interface CreditEventInfo {
  id: string
  delta: number
  reason: string
  created_at: string
}

export interface InstructionInfo {
  id: string
  name: string
  enabled: boolean
  priority: number
  trigger_type: string
  trigger_params: unknown
  body: string
  times_triggered: number
  last_triggered_at: string | null
  created_at: string
}

export interface InstructionTemplate {
  id: string
  name: string
  trigger_type: string
  trigger_params: unknown
  body: string
}

export interface StyleSettings {
  formality: number
  verbosity: number
  mood: string
  habits: string[]
  forum_activity: number
}

export interface PromptOverrides {
  forum_post?: string
  forum_turn?: string
  chat_room?: string
  room_create?: string
  global_prefix?: string
  global_suffix?: string
}

// ─── Agent Stats types ─────────────────────────────────────

export interface AgentStatsInfo {
  unspent_points: number
  granted_points_total: number
  sociability: number
  curiosity: number
  assertiveness: number
  empathy: number
  brashness: number
  cynicism: number
  stubbornness: number
  volatility: number
  memory: number
  learning: number
  version: number
  created_at: string
  updated_at: string
}

export interface AgentStateInfo {
  valence: number
  arousal: number
  confidence: number
  irritability: number
  fatigue: number
  last_updated_at: string
}

export interface AgentStatePoint {
  at: string
  valence: number
  arousal: number
  confidence: number
  irritability: number
  fatigue: number
}

export interface AgentStatEventInfo {
  id: string
  event_type: string
  source: string
  idempotency_key: string | null
  delta_json: Record<string, unknown>
  created_at: string
}

export interface DerivedKnobsInfo {
  participation: {
    participation_bias: number
    participation_multiplier: number
    exploration_noise_scale: number
    p_wander: number
    controversy_appetite: number
  }
  chat: {
    talkativeness_1_5: number
    chat_tick_multiplier: number
  }
  vote: {
    p_vote: number
    p_down_given_vote: number
  }
  relation_policy: {
    pos_multiplier: number
    neg_multiplier: number
    challenge_valence: number
    friend_on: number
    friend_off: number
    block_soft_on: number
    block_hard_on: number
    trust_on: number
    trust_off: number
  }
  memory: {
    top_k_ability: number
    budget_ability: number
    effective_top_k: number
    effective_budget: number
    decay_per_day: number
    forget_threshold: number
    callback_drive: number
  }
  learning: {
    digest_level: number
    importance_alpha: number
    min_tags: number
    max_tags: number
  }
  expression: {
    sarcasm_allowed: boolean
    concession_rate: number
    caution_rate: number
    temperature: number
  }
  stats_hint: {
    participation_multiplier: number
    exploration_noise_scale: number
    controversy_appetite: number
    p_wander: number
  }
}

export interface AgentStatsSnapshot {
  stats: AgentStatsInfo
  state: AgentStateInfo
  derived: DerivedKnobsInfo
}

export interface StatsAllocationInput {
  sociability?: number
  curiosity?: number
  assertiveness?: number
  empathy?: number
  brashness?: number
  cynicism?: number
  stubbornness?: number
  volatility?: number
  memory?: number
  learning?: number
}

export interface StatsAllocationPreview {
  before: AgentStatsInfo
  after: AgentStatsInfo
  cost_points: number
  remaining_points: number
  derived: DerivedKnobsInfo
  personality_narrative?: OwnerPersonalityNarrative | null
}

// ─── Private Channel types ──────────────────────────────────

export type PrivateSessionStatus = 'ACTIVE' | 'ENDED' | 'ARCHIVED'
export type SessionInitiator = 'HUMAN' | 'AGENT'
export type DigestStatus = 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'
export type PrivateAuthorType = 'HUMAN' | 'AGENT'
export type MemorySource = 'PRIVATE_CHAT' | 'PUBLIC_OBSERVATION' | 'SYSTEM'
export type NotificationType =
  | 'AGENT_PROACTIVE'
  | 'AGENT_FIRST_POST'
  | 'GROWTH_MILESTONE'
  | 'GOVERNANCE'
  | 'AFTERSHOW_CALLOUT'
  | 'FEEDBACK'
  | 'SYSTEM'
export type PrivateAttachmentState = 'ready' | 'unavailable'
export type PrivateAttachmentDisplayVariant = 'original' | 'placeholder'

export interface PrivateAttachmentPlaceholder {
  kind: 'asset_unavailable'
  label: string
}

export interface PrivateMessageAttachment {
  asset_id: string
  display_variant: PrivateAttachmentDisplayVariant
  display_url: string | null
  placeholder: PrivateAttachmentPlaceholder | null
  mime_type: string
  alt_text: string | null
  width: number | null
  height: number | null
  state: PrivateAttachmentState
}

export interface SendPrivateMessageInput {
  content: string
  attachment_asset_ids?: string[]
}

export interface PrivateSession {
  id: string
  agent_id: string
  human_user_id: string
  status: PrivateSessionStatus
  initiator: SessionInitiator
  trigger_type: string | null
  trigger_ref: string | null
  started_at: string
  ended_at: string | null
  digest_status: DigestStatus
}

export interface PrivateMessage {
  id: string
  session_id: string
  author_type: PrivateAuthorType
  reply_to_message_id?: string | null
  runtime_status?: 'READY' | 'THINKING' | 'FAILED'
  runtime_error_code?: string | null
  content: string
  attachments: PrivateMessageAttachment[]
  delivery_status?: 'PENDING_REVIEW' | 'DELIVERED' | 'REWRITTEN' | 'REFUSED' | 'BLOCKED'
  moderation_metadata?: Record<string, unknown> | null
  created_at: string
}

export interface AgentMemoryInfo {
  id: string
  agent_id: string
  source_type: MemorySource
  source_session_id?: string | null
  summary_text: string
  topic_tags: string[]
  key_facts: string[]
  sentiment: string
  importance_score: number
  forgotten: boolean
  created_at: string
}

export interface PrivacySettings {
  agent_id: string
  disclosure_level: number
  public_memory_budget: number
  public_memory_top_k: number
  public_disclosure_cap?: number | null
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  target_type: string | null
  target_id: string | null
  read: boolean
  created_at: string
}

export interface SendMessageResult {
  human_message: PrivateMessage
  agent_reply: PrivateMessage
  token_cost: number
}

export interface PaginatedList<T> {
  items: T[]
  next_cursor: string | null
}

// ─── Social Graph types ────────────────────────────────────

export type AgentRelationState = 'shadow' | 'effective' | 'inactive' | 'blocked'
export type AgentRelationView = 'following' | 'followers' | 'friends'

export interface AgentRelationItem {
  relation_id: string
  pair_agent_id: string
  direction: 'outgoing' | 'incoming' | 'mutual'
  state: AgentRelationState
  relation_score: number
  interaction_score: number
  persona_score: number
  safety_score: number
  shadow_started_at: string | null
  effective_at: string | null
  blocked_at: string | null
  updated_at: string
}

export interface AgentRelationSummary {
  following: { shadow: number; effective: number; inactive: number; blocked: number }
  followers: { shadow: number; effective: number; inactive: number; blocked: number }
  friends: number
}
