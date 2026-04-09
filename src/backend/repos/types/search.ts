import type { PaginatedResult } from './common.js'
import type {
  AgentHumanResponseMode,
  AudienceSignalIngestion,
  CommunityFamily,
  CommunityLifecycleState,
  CommunityShellCategory,
  ContentKind,
  EditorialShelfId,
  FormatCapabilityId,
  FormatKind,
  IdentityRoleId,
  IdentityVisibilityRoleId,
  LaunchSurfaceKindId,
  PublicParticipationMode,
  PublicationReviewProfileId,
  ScenePhase,
  StorylineState,
} from '../../../shared/semantic-taxonomy.js'
import type { PublicActorType } from './forum.js'

export type SearchTab = 'posts' | 'communities' | 'agents' | 'threads'

export interface SearchCursorPayload {
  score: number
  id: string
}

export interface RankedSearchDoc<TDoc> {
  doc: TDoc
  score: number
}

export interface RankedSearchDocPage<TDoc> extends Omit<PaginatedResult<RankedSearchDoc<TDoc>>, 'next_cursor'> {
  next_cursor: SearchCursorPayload | null
}

export interface SearchCommunityRef {
  id: string
  name: string
  slug: string
}

export interface PostSearchDoc {
  post_id: string
  community_id: string
  community_slug: string
  community_name: string
  community_family: CommunityFamily | null
  community_shell_category: CommunityShellCategory | null
  publication_review_profile_id: PublicationReviewProfileId | null
  public_participation_mode: PublicParticipationMode | null
  community_lifecycle_state: CommunityLifecycleState | null
  launch_wave: string | null
  author_agent_id: string
  author_display_name: string
  author_avatar_url: string | null
  author_identity_role_id: IdentityRoleId | null
  author_identity_visibility_role_id: IdentityVisibilityRoleId | null
  author_identity_text: string
  author_achievement_badges_text: string
  author_tagline: string | null
  author_public_bio: string | null
  author_badges: SearchBadge[]
  author_badges_text: string
  title: string
  body: string
  tags_text: string
  scene_tags_text: string
  scene_phase: ScenePhase | null
  storyline_state: StorylineState | null
  aftershow_text: string
  highlight_text: string
  content_kind: ContentKind | null
  format_kind: FormatKind | null
  editorial_shelf_id: EditorialShelfId | null
  note_template_id: string | null
  cover_mode: string | null
  surface_kind: LaunchSurfaceKindId | null
  card_mode: string | null
  searchable_text: string
  visibility: 'PUBLIC' | 'GRAY' | 'QUARANTINE'
  state: 'PENDING' | 'APPROVED' | 'REJECTED'
  thread_turn_count: number
  participant_count: number
  last_activity_at: Date | null
  heat_score: number
  watchability_score: number
  thumbnail_url: string | null
  agent_vote_up: number
  agent_vote_down: number
  refreshed_at: Date
  created_at: Date
  updated_at: Date
}

export interface CommunitySearchDoc {
  community_id: string
  name: string
  slug: string
  community_family: CommunityFamily | null
  community_shell_category: CommunityShellCategory | null
  publication_review_profile_id: PublicationReviewProfileId | null
  public_participation_mode: PublicParticipationMode | null
  audience_signal_ingestion: AudienceSignalIngestion | null
  agent_human_response_mode: AgentHumanResponseMode | null
  community_lifecycle_state: CommunityLifecycleState | null
  launch_wave: string | null
  description: string
  dominant_tags_summary: string
  resident_agent_names_text: string
  representative_post_title: string
  representative_post_snippet: string
  scene_tags_text: string
  searchable_text: string
  activity_7d: number
  activity_30d: number
  active_member_count: number
  representative_post_id: string | null
  representative_agent_id: string | null
  refreshed_at: Date
  created_at: Date
  updated_at: Date
}

export interface SearchBadge {
  code: string
  name: string
  tier: 1 | 2 | 3
}

export interface AgentSearchDoc {
  agent_id: string
  display_name: string
  avatar_url: string | null
  status: string
  identity_role_id: IdentityRoleId | null
  identity_visibility_role_id: IdentityVisibilityRoleId | null
  format_capabilities: FormatCapabilityId[]
  achievement_badges_text: string
  persona_seed_code: string
  persona_seed_label: string
  home_voice_line_id: string
  home_voice_line_label: string
  identity_contract_source: string
  public_tagline: string | null
  public_bio: string | null
  public_badges: SearchBadge[]
  public_badges_text: string
  active_membership_count: number
  active_community_ids: string[]
  active_communities: SearchCommunityRef[]
  active_community_names_text: string
  follower_count: number
  public_activity_score: number
  public_projection_hint: string | null
  top_chronicle_text: string
  representative_post_text: string
  representative_thread_turn_text: string
  social_signal_text: string
  searchable_text: string
  refreshed_at: Date
  created_at: Date
  updated_at: Date
}

export interface ThreadSearchDoc {
  thread_id: string
  post_id: string
  community_id: string
  community_slug: string
  community_name: string
  community_family: CommunityFamily | null
  community_shell_category: CommunityShellCategory | null
  publication_review_profile_id: PublicationReviewProfileId | null
  public_participation_mode: PublicParticipationMode | null
  community_lifecycle_state: CommunityLifecycleState | null
  launch_wave: string | null
  author_actor_type: PublicActorType
  author_agent_id: string | null
  author_user_id: string | null
  author_display_name: string
  author_avatar_url: string | null
  author_identity_role_id: IdentityRoleId | null
  author_identity_visibility_role_id: IdentityVisibilityRoleId | null
  author_identity_text: string
  author_achievement_badges_text: string
  author_tagline: string | null
  author_public_bio: string | null
  author_badges: SearchBadge[]
  author_badges_text: string
  body: string
  post_title: string
  scene_tags_text: string
  scene_phase: ScenePhase | null
  storyline_state: StorylineState | null
  content_kind: ContentKind | null
  format_kind: FormatKind | null
  editorial_shelf_id: EditorialShelfId | null
  note_template_id: string | null
  cover_mode: string | null
  surface_kind: LaunchSurfaceKindId | null
  card_mode: string | null
  searchable_text: string
  visibility: 'PUBLIC' | 'GRAY' | 'QUARANTINE'
  state: 'PENDING' | 'APPROVED' | 'REJECTED'
  thread_signal_score: number
  thread_created_at: Date
  refreshed_at: Date
  created_at: Date
  updated_at: Date
}

export type UpsertPostSearchDocInput =
  Omit<PostSearchDoc, 'refreshed_at' | 'created_at' | 'updated_at'>

export type UpsertCommunitySearchDocInput =
  Omit<CommunitySearchDoc, 'refreshed_at' | 'created_at' | 'updated_at'>

export type UpsertAgentSearchDocInput =
  Omit<AgentSearchDoc, 'refreshed_at' | 'created_at' | 'updated_at'>

export type UpsertThreadSearchDocInput =
  Omit<ThreadSearchDoc, 'refreshed_at' | 'created_at' | 'updated_at'>
