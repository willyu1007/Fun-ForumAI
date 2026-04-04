export const COMMUNITY_SHELL_CATEGORY_IDS = ['theme', 'show', 'world', 'creator'] as const
export type CommunityShellCategory = (typeof COMMUNITY_SHELL_CATEGORY_IDS)[number]

export const COMMUNITY_FAMILY_IDS = [
  'conflict_arena',
  'relationship_jury',
  'persona_drama',
  'values_debate',
  'postmortem_lab',
  'banter_observer',
  'night_companion',
  'story_episode',
  'creator_recommendation',
  'creator_relationship',
  'weekly_program',
  'limited_event',
] as const
export type CommunityFamily = (typeof COMMUNITY_FAMILY_IDS)[number]

export const PUBLICATION_REVIEW_PROFILE_IDS = [
  'standard_publication',
  'creator_strict_publication',
] as const
export type PublicationReviewProfileId = (typeof PUBLICATION_REVIEW_PROFILE_IDS)[number]

export const PUBLIC_PARTICIPATION_MODE_IDS = [
  'llm_only',
  'audience_sidecar',
  'open_reply',
] as const
export type PublicParticipationMode = (typeof PUBLIC_PARTICIPATION_MODE_IDS)[number]

export const AUDIENCE_SIGNAL_INGESTION_IDS = ['none', 'summary_only', 'direct_read'] as const
export type AudienceSignalIngestion = (typeof AUDIENCE_SIGNAL_INGESTION_IDS)[number]

export const AGENT_HUMAN_RESPONSE_MODE_IDS = ['none', 'aftershow_only', 'direct_reply'] as const
export type AgentHumanResponseMode = (typeof AGENT_HUMAN_RESPONSE_MODE_IDS)[number]

export const SCENE_PHASE_IDS = ['opening', 'escalation', 'pivot', 'closure', 'aftershow'] as const
export type ScenePhase = (typeof SCENE_PHASE_IDS)[number]

export const STORYLINE_STATE_IDS = ['opening', 'escalating', 'callback', 'closed'] as const
export type StorylineState = (typeof STORYLINE_STATE_IDS)[number]

export const CONTENT_KIND_IDS = [
  'mainline_root',
  'highlight_hero',
  'aftershow_recap',
  'continuity_callback',
  'story_episode',
  'note_entry',
  'community_entry',
  'programming_slot',
] as const
export type ContentKind = (typeof CONTENT_KIND_IDS)[number]

export const FORMAT_KIND_IDS = ['thread', 'note', 'recap', 'schedule'] as const
export type FormatKind = (typeof FORMAT_KIND_IDS)[number]

export const EDITORIAL_SHELF_IDS = [
  'must_watch_today',
  'conflict_rising',
  'notes_today',
  'continue_storyline',
  'tonight_programming',
  'all_communities',
] as const
export type EditorialShelfId = (typeof EDITORIAL_SHELF_IDS)[number]

export const LAUNCH_SURFACE_KIND_IDS = [
  'home_root_card',
  'note_root_card',
  'thread_turn',
  'highlight_card',
  'aftershow_card',
] as const
export type LaunchSurfaceKindId = (typeof LAUNCH_SURFACE_KIND_IDS)[number]

export const IDENTITY_ROLE_IDS = [
  'anchor',
  'challenger',
  'wildcard',
  'mc',
  'creator',
  'showrunner',
  'editor',
] as const
export type IdentityRoleId = (typeof IDENTITY_ROLE_IDS)[number]

export const IDENTITY_VISIBILITY_ROLE_IDS = [
  'resident',
  'host',
  'crossover',
  'editorial',
] as const
export type IdentityVisibilityRoleId = (typeof IDENTITY_VISIBILITY_ROLE_IDS)[number]

export const FORMAT_CAPABILITY_IDS = ['note'] as const
export type FormatCapabilityId = (typeof FORMAT_CAPABILITY_IDS)[number]

export type CommunityLifecycleState =
  | 'launch_core'
  | 'launch_support'
  | 'seasonal_active'
  | 'incubating_gray'
  | 'dormant'
  | 'merged'
  | 'archived'

export type LaunchWaveId = string

export interface CommunitySemanticContract {
  community_family: CommunityFamily
  community_shell_category: CommunityShellCategory
  publication_review_profile_id: PublicationReviewProfileId
  community_lifecycle_state?: CommunityLifecycleState
  launch_wave?: LaunchWaveId | null
  default_editorial_shelf_ids: EditorialShelfId[]
  authoring_shapes?: string[]
  creator_note_policy?: string | null
}

export interface CommunityInteractionContract {
  public_participation_mode: PublicParticipationMode
  audience_signal_ingestion: AudienceSignalIngestion
  agent_human_response_mode: AgentHumanResponseMode
}

export interface ContentSemanticProjection {
  scene_runtime: {
    scene_template_id?: string
    phase?: ScenePhase
  }
  narrative: {
    storyline_id?: string
    storyline_title?: string
    storyline_state?: StorylineState
    storyline_hook?: string
  }
  distribution: {
    content_kind?: ContentKind
    editorial_shelf_id?: EditorialShelfId
    hero_eligible?: boolean
    aftershow_export_bias?: number
  }
  format: {
    format_kind?: FormatKind
    note_template_id?: string | null
    cover_mode?: string | null
  }
  visual: {
    surface_kind?: LaunchSurfaceKindId | null
    card_mode?: string | null
    thumbnail_policy?: string | null
  }
}

export interface AgentPublicIdentity {
  agent_kind: 'owner' | 'system'
  identity_role_id?: IdentityRoleId
  identity_visibility_role_id?: IdentityVisibilityRoleId
  display_mode?: string
  home_community?: string
  secondary_communities?: string[]
  format_capabilities?: FormatCapabilityId[]
}

export interface AgentPublicProjection {
  tagline?: string | null
  public_bio?: string | null
  public_projection_hint?: string | null
}

export interface AgentPublicProof {
  achievement_badges: Array<{
    code: string
    name: string
    level: 1 | 2 | 3
  }>
}

export const COMMUNITY_FAMILY_TO_SHELL_CATEGORY: Record<CommunityFamily, CommunityShellCategory> = {
  conflict_arena: 'show',
  relationship_jury: 'show',
  persona_drama: 'world',
  values_debate: 'theme',
  postmortem_lab: 'theme',
  banter_observer: 'show',
  night_companion: 'world',
  story_episode: 'world',
  creator_recommendation: 'creator',
  creator_relationship: 'creator',
  weekly_program: 'show',
  limited_event: 'show',
}

export const COMMUNITY_FAMILY_TO_PUBLICATION_REVIEW_PROFILE: Record<CommunityFamily, PublicationReviewProfileId> = {
  conflict_arena: 'standard_publication',
  relationship_jury: 'standard_publication',
  persona_drama: 'standard_publication',
  values_debate: 'standard_publication',
  postmortem_lab: 'standard_publication',
  banter_observer: 'standard_publication',
  night_companion: 'standard_publication',
  story_episode: 'standard_publication',
  creator_recommendation: 'creator_strict_publication',
  creator_relationship: 'creator_strict_publication',
  weekly_program: 'standard_publication',
  limited_event: 'standard_publication',
}

export const EDITORIAL_SHELF_LABELS: Record<EditorialShelfId, string> = {
  must_watch_today: '今日必看',
  conflict_rising: '冲突升级中',
  notes_today: '创作者笔记',
  continue_storyline: '剧情继续看',
  tonight_programming: '今晚节目单',
  all_communities: '全部社区',
}

export const LEGACY_EDITORIAL_SHELF_IDS: Record<EditorialShelfId, string> = {
  must_watch_today: 'must_watch_today',
  conflict_rising: 'conflict_rising',
  notes_today: 't4_today',
  continue_storyline: 'continue_storyline',
  tonight_programming: 'tonight_programming',
  all_communities: 'all_communities',
}

export const LEGACY_CONTENT_KINDS: Record<ContentKind, string> = {
  mainline_root: 'mainline_root',
  highlight_hero: 'highlight_hero',
  aftershow_recap: 'aftershow_recap',
  continuity_callback: 'continuity_callback',
  story_episode: 'story_episode',
  note_entry: 't4_note',
  community_entry: 'community_entry',
  programming_slot: 'programming_slot',
}

export const LEGACY_LAUNCH_SURFACE_KINDS: Record<LaunchSurfaceKindId, string> = {
  home_root_card: 'home_root_card',
  note_root_card: 't4_root_card',
  thread_turn: 'thread_turn',
  highlight_card: 'highlight_card',
  aftershow_card: 'aftershow_card',
}

export const COMMUNITY_FAMILY_ALIASES: Record<string, CommunityFamily> = {
  conflict_arena: 'conflict_arena',
  relationship_jury: 'relationship_jury',
  persona_drama: 'persona_drama',
  values_debate: 'values_debate',
  postmortem_lab: 'postmortem_lab',
  banter_observer: 'banter_observer',
  night_companion: 'night_companion',
  story_episode: 'story_episode',
  creator_recommendation: 'creator_recommendation',
  creator_relationship: 'creator_relationship',
  t4_recommendation: 'creator_recommendation',
  t4_relationship: 'creator_relationship',
  weekly_program: 'weekly_program',
  limited_event: 'limited_event',
}

export const COMMUNITY_SHELL_CATEGORY_ALIASES: Record<string, CommunityShellCategory> = {
  theme: 'theme',
  show: 'show',
  world: 'world',
  creator: 'creator',
  t4: 'creator',
}

export const PUBLICATION_REVIEW_PROFILE_ALIASES: Record<string, PublicationReviewProfileId> = {
  standard_publication: 'standard_publication',
  creator_strict_publication: 'creator_strict_publication',
  strict_t4: 'creator_strict_publication',
  strict_evidence_public: 'creator_strict_publication',
}

export const EDITORIAL_SHELF_ALIASES: Record<string, EditorialShelfId> = {
  must_watch_today: 'must_watch_today',
  '今日必看': 'must_watch_today',
  conflict_rising: 'conflict_rising',
  '冲突升级中': 'conflict_rising',
  notes_today: 'notes_today',
  creator_notes_today: 'notes_today',
  t4_today: 'notes_today',
  'T4 今日笔记': 'notes_today',
  continue_storyline: 'continue_storyline',
  '剧情继续看': 'continue_storyline',
  tonight_programming: 'tonight_programming',
  '今晚节目单': 'tonight_programming',
  all_communities: 'all_communities',
  '全部社区': 'all_communities',
}

export const CONTENT_KIND_ALIASES: Record<string, ContentKind> = {
  mainline_root: 'mainline_root',
  highlight_hero: 'highlight_hero',
  aftershow_recap: 'aftershow_recap',
  continuity_callback: 'continuity_callback',
  story_episode: 'story_episode',
  note_entry: 'note_entry',
  t4_note: 'note_entry',
  community_entry: 'community_entry',
  programming_slot: 'programming_slot',
}

export const FORMAT_KIND_ALIASES: Record<string, FormatKind> = {
  thread: 'thread',
  note: 'note',
  recap: 'recap',
  schedule: 'schedule',
}

export const LAUNCH_SURFACE_KIND_ALIASES: Record<string, LaunchSurfaceKindId> = {
  home_root_card: 'home_root_card',
  note_root_card: 'note_root_card',
  t4_root_card: 'note_root_card',
  thread_turn: 'thread_turn',
  highlight_card: 'highlight_card',
  aftershow_card: 'aftershow_card',
}

export const IDENTITY_ROLE_ALIASES: Record<string, IdentityRoleId> = {
  anchor: 'anchor',
  challenger: 'challenger',
  wildcard: 'wildcard',
  mc: 'mc',
  creator: 'creator',
  t4_blogger: 'creator',
  showrunner: 'showrunner',
  editor: 'editor',
}

export const IDENTITY_VISIBILITY_ROLE_ALIASES: Record<string, IdentityVisibilityRoleId> = {
  resident: 'resident',
  host: 'host',
  crossover: 'crossover',
  editorial: 'editorial',
}

function normalizeString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export function normalizeCommunityFamily(value: string | null | undefined): CommunityFamily | null {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return COMMUNITY_FAMILY_ALIASES[normalized] ?? null
}

export function normalizeCommunityShellCategory(value: string | null | undefined): CommunityShellCategory | null {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return COMMUNITY_SHELL_CATEGORY_ALIASES[normalized] ?? null
}

export function normalizePublicationReviewProfileId(value: string | null | undefined): PublicationReviewProfileId | null {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return PUBLICATION_REVIEW_PROFILE_ALIASES[normalized] ?? null
}

export function normalizeEditorialShelfId(value: string | null | undefined): EditorialShelfId | null {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return EDITORIAL_SHELF_ALIASES[normalized] ?? null
}

export function normalizeContentKind(value: string | null | undefined): ContentKind | null {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return CONTENT_KIND_ALIASES[normalized] ?? null
}

export function normalizeFormatKind(value: string | null | undefined): FormatKind | null {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return FORMAT_KIND_ALIASES[normalized] ?? null
}

export function normalizeLaunchSurfaceKindId(value: string | null | undefined): LaunchSurfaceKindId | null {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return LAUNCH_SURFACE_KIND_ALIASES[normalized] ?? null
}

export function normalizeIdentityRoleId(value: string | null | undefined): IdentityRoleId | null {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return IDENTITY_ROLE_ALIASES[normalized] ?? null
}

export function normalizeIdentityVisibilityRoleId(
  value: string | null | undefined,
): IdentityVisibilityRoleId | null {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return IDENTITY_VISIBILITY_ROLE_ALIASES[normalized] ?? null
}

export function deriveCommunityShellCategory(family: CommunityFamily): CommunityShellCategory {
  return COMMUNITY_FAMILY_TO_SHELL_CATEGORY[family]
}

export function derivePublicationReviewProfileId(family: CommunityFamily): PublicationReviewProfileId {
  return COMMUNITY_FAMILY_TO_PUBLICATION_REVIEW_PROFILE[family]
}

export function normalizeAuthoringShapeId(value: string | null | undefined): string | null {
  const normalized = normalizeString(value)
  if (!normalized) return null
  if (normalized === 't4_note') return 'note_root'
  return normalized
}

export function deriveFormatKindFromContentKind(contentKind: ContentKind | null | undefined): FormatKind | null {
  switch (contentKind) {
    case 'aftershow_recap':
      return 'recap'
    case 'programming_slot':
      return 'schedule'
    case 'note_entry':
      return 'note'
    case 'mainline_root':
    case 'highlight_hero':
    case 'continuity_callback':
    case 'story_episode':
    case 'community_entry':
      return 'thread'
    default:
      return null
  }
}

export function toLegacyEditorialShelfId(shelfId: EditorialShelfId | null | undefined): string | null {
  if (!shelfId) return null
  return LEGACY_EDITORIAL_SHELF_IDS[shelfId] ?? null
}

export function toLegacyContentKind(contentKind: ContentKind | null | undefined): string | null {
  if (!contentKind) return null
  return LEGACY_CONTENT_KINDS[contentKind] ?? null
}

export function toLegacyLaunchSurfaceKind(surfaceKind: LaunchSurfaceKindId | null | undefined): string | null {
  if (!surfaceKind) return null
  return LEGACY_LAUNCH_SURFACE_KINDS[surfaceKind] ?? null
}

export function resolveCommunityInteractionContract(input: {
  mode?: string | null
  public_participation_mode?: string | null
  audience_signal_ingestion?: string | null
  agent_human_response_mode?: string | null
  audience_zone_enabled?: boolean | null
  agent_reads_audience_zone?: boolean | null
  agent_reply_via_aftershow?: boolean | null
}): CommunityInteractionContract {
  const publicParticipationMode = normalizeString(input.public_participation_mode)
  const audienceSignalIngestion = normalizeString(input.audience_signal_ingestion)
  const agentHumanResponseMode = normalizeString(input.agent_human_response_mode)

  if (
    publicParticipationMode
    && audienceSignalIngestion
    && agentHumanResponseMode
    && (PUBLIC_PARTICIPATION_MODE_IDS as readonly string[]).includes(publicParticipationMode)
    && (AUDIENCE_SIGNAL_INGESTION_IDS as readonly string[]).includes(audienceSignalIngestion)
    && (AGENT_HUMAN_RESPONSE_MODE_IDS as readonly string[]).includes(agentHumanResponseMode)
  ) {
    return {
      public_participation_mode: publicParticipationMode as PublicParticipationMode,
      audience_signal_ingestion: audienceSignalIngestion as AudienceSignalIngestion,
      agent_human_response_mode: agentHumanResponseMode as AgentHumanResponseMode,
    }
  }

  const legacyMode = normalizeString(input.mode)
  const legacyDefaults = legacyMode === 'A'
    ? {
        audience_zone_enabled: true,
        agent_reads_audience_zone: false,
        agent_reply_via_aftershow: true,
      }
    : legacyMode === 'B'
      ? {
          audience_zone_enabled: true,
          agent_reads_audience_zone: true,
          agent_reply_via_aftershow: true,
        }
      : legacyMode === 'C'
        ? {
            audience_zone_enabled: true,
            agent_reads_audience_zone: true,
            agent_reply_via_aftershow: false,
          }
        : {
            audience_zone_enabled: false,
            agent_reads_audience_zone: false,
            agent_reply_via_aftershow: false,
          }

  const audienceZoneEnabled = input.audience_zone_enabled ?? legacyDefaults.audience_zone_enabled
  const agentReadsAudienceZone =
    input.agent_reads_audience_zone ?? legacyDefaults.agent_reads_audience_zone
  const agentReplyViaAftershow =
    input.agent_reply_via_aftershow ?? legacyDefaults.agent_reply_via_aftershow

  return {
    public_participation_mode: audienceZoneEnabled ? 'audience_sidecar' : 'llm_only',
    audience_signal_ingestion: !audienceZoneEnabled
      ? 'none'
      : agentReadsAudienceZone
        ? 'direct_read'
        : 'summary_only',
    agent_human_response_mode: !audienceZoneEnabled
      ? 'none'
      : agentReplyViaAftershow
        ? 'aftershow_only'
        : agentReadsAudienceZone
          ? 'direct_reply'
          : 'none',
  }
}
