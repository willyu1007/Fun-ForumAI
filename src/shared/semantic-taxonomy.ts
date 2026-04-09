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

export const AUTHORING_SHAPE_IDS = [
  'discussion_root',
  'story_episode',
  'aftershow_recap',
  'note_root',
  'programming_slot',
] as const
export type AuthoringShapeId = (typeof AUTHORING_SHAPE_IDS)[number]

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

export type AgentPublicIdentityBadgeSourceKind = 'default_display' | 'system_display'

export interface AgentPublicIdentityBadge {
  badge_id: string
  internal_code: string
  label: string
  source_kind: AgentPublicIdentityBadgeSourceKind
  priority_rank: number
}

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
  authoring_shapes?: AuthoringShapeId[]
  creator_note_policy?: string | null
}

export interface CommunityInteractionContract {
  public_participation_mode: PublicParticipationMode
  audience_signal_ingestion: AudienceSignalIngestion
  agent_human_response_mode: AgentHumanResponseMode
}

export const DEFAULT_COMMUNITY_INTERACTION_CONTRACT: CommunityInteractionContract = {
  public_participation_mode: 'audience_sidecar',
  audience_signal_ingestion: 'summary_only',
  agent_human_response_mode: 'aftershow_only',
}

export const CREATOR_MAIN_THREAD_INTERACTION_CONTRACT: CommunityInteractionContract = {
  public_participation_mode: 'open_reply',
  audience_signal_ingestion: 'none',
  agent_human_response_mode: 'direct_reply',
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
  /** Semantic SoT for default/system identity badges. */
  identity_badges?: AgentPublicIdentityBadge[]
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
  weekly_program: 'weekly_program',
  limited_event: 'limited_event',
}

export const COMMUNITY_SHELL_CATEGORY_ALIASES: Record<string, CommunityShellCategory> = {
  theme: 'theme',
  show: 'show',
  world: 'world',
  creator: 'creator',
}

export const PUBLICATION_REVIEW_PROFILE_ALIASES: Record<string, PublicationReviewProfileId> = {
  standard_publication: 'standard_publication',
  creator_strict_publication: 'creator_strict_publication',
  strict_publication: 'creator_strict_publication',
  strict_evidence_public: 'creator_strict_publication',
}

export const EDITORIAL_SHELF_ALIASES: Record<string, EditorialShelfId> = {
  must_watch_today: 'must_watch_today',
  '今日必看': 'must_watch_today',
  conflict_rising: 'conflict_rising',
  '冲突升级中': 'conflict_rising',
  notes_today: 'notes_today',
  '创作者笔记': 'notes_today',
  creator_notes_today: 'notes_today',
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
  community_entry: 'community_entry',
  programming_slot: 'programming_slot',
}

export const FORMAT_KIND_ALIASES: Record<string, FormatKind> = {
  thread: 'thread',
  note: 'note',
  recap: 'recap',
  schedule: 'schedule',
}

export const AUTHORING_SHAPE_ALIASES: Record<string, AuthoringShapeId> = {
  discussion_root: 'discussion_root',
  story_episode: 'story_episode',
  aftershow_recap: 'aftershow_recap',
  note_root: 'note_root',
  programming_slot: 'programming_slot',
}

export const LAUNCH_SURFACE_KIND_ALIASES: Record<string, LaunchSurfaceKindId> = {
  home_root_card: 'home_root_card',
  note_root_card: 'note_root_card',
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
  showrunner: 'showrunner',
  editor: 'editor',
}

export const IDENTITY_VISIBILITY_ROLE_ALIASES: Record<string, IdentityVisibilityRoleId> = {
  resident: 'resident',
  host: 'host',
  crossover: 'crossover',
  editorial: 'editorial',
}

export const PUBLIC_PARTICIPATION_MODE_ALIASES: Record<string, PublicParticipationMode> = {
  llm_only: 'llm_only',
  audience_sidecar: 'audience_sidecar',
  open_reply: 'open_reply',
}

export const AUDIENCE_SIGNAL_INGESTION_ALIASES: Record<string, AudienceSignalIngestion> = {
  none: 'none',
  summary_only: 'summary_only',
  direct_read: 'direct_read',
}

export const AGENT_HUMAN_RESPONSE_MODE_ALIASES: Record<string, AgentHumanResponseMode> = {
  none: 'none',
  aftershow_only: 'aftershow_only',
  direct_reply: 'direct_reply',
}

export const SCENE_PHASE_ALIASES: Record<string, ScenePhase> = {
  opening: 'opening',
  escalation: 'escalation',
  pivot: 'pivot',
  closure: 'closure',
  aftershow: 'aftershow',
}

export const STORYLINE_STATE_ALIASES: Record<string, StorylineState> = {
  opening: 'opening',
  escalating: 'escalating',
  callback: 'callback',
  closed: 'closed',
}

export const COMMUNITY_LIFECYCLE_STATE_ALIASES: Record<string, CommunityLifecycleState> = {
  launch_core: 'launch_core',
  launch_support: 'launch_support',
  seasonal_active: 'seasonal_active',
  incubating_gray: 'incubating_gray',
  dormant: 'dormant',
  merged: 'merged',
  archived: 'archived',
}

export const FORMAT_CAPABILITY_ALIASES: Record<string, FormatCapabilityId> = {
  note: 'note',
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

export function normalizePublicParticipationMode(
  value: string | null | undefined,
): PublicParticipationMode | null {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return PUBLIC_PARTICIPATION_MODE_ALIASES[normalized] ?? null
}

export function normalizeAudienceSignalIngestion(
  value: string | null | undefined,
): AudienceSignalIngestion | null {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return AUDIENCE_SIGNAL_INGESTION_ALIASES[normalized] ?? null
}

export function normalizeAgentHumanResponseMode(
  value: string | null | undefined,
): AgentHumanResponseMode | null {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return AGENT_HUMAN_RESPONSE_MODE_ALIASES[normalized] ?? null
}

export function normalizeScenePhase(value: string | null | undefined): ScenePhase | null {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return SCENE_PHASE_ALIASES[normalized] ?? null
}

export function normalizeStorylineState(value: string | null | undefined): StorylineState | null {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return STORYLINE_STATE_ALIASES[normalized] ?? null
}

export function normalizeCommunityLifecycleState(
  value: string | null | undefined,
): CommunityLifecycleState | null {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return COMMUNITY_LIFECYCLE_STATE_ALIASES[normalized] ?? null
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

export function normalizeFormatCapabilityId(value: string | null | undefined): FormatCapabilityId | null {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return FORMAT_CAPABILITY_ALIASES[normalized] ?? null
}

export function deriveCommunityShellCategory(family: CommunityFamily): CommunityShellCategory {
  return COMMUNITY_FAMILY_TO_SHELL_CATEGORY[family]
}

export function derivePublicationReviewProfileId(family: CommunityFamily): PublicationReviewProfileId {
  return COMMUNITY_FAMILY_TO_PUBLICATION_REVIEW_PROFILE[family]
}

export function normalizeAuthoringShapeId(value: string | null | undefined): AuthoringShapeId | null {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return AUTHORING_SHAPE_ALIASES[normalized] ?? null
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

export function isCreatorCommunityFamily(
  communityFamily: string | null | undefined,
): communityFamily is CommunityFamily {
  return communityFamily === 'creator_recommendation' || communityFamily === 'creator_relationship'
}

export function resolveCommunityInteractionContract(input: {
  public_participation_mode?: string | null
  audience_signal_ingestion?: string | null
  agent_human_response_mode?: string | null
} | null | undefined, fallback: CommunityInteractionContract = DEFAULT_COMMUNITY_INTERACTION_CONTRACT): CommunityInteractionContract {
  const publicParticipationMode =
    normalizeString(input?.public_participation_mode) ?? fallback.public_participation_mode
  const audienceSignalIngestion =
    normalizeString(input?.audience_signal_ingestion) ?? fallback.audience_signal_ingestion
  const agentHumanResponseMode =
    normalizeString(input?.agent_human_response_mode) ?? fallback.agent_human_response_mode

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

  return { ...fallback }
}

export function deriveDefaultCommunityInteractionContract(
  communityFamily: string | null | undefined,
): CommunityInteractionContract {
  return isCreatorCommunityFamily(communityFamily)
    ? { ...CREATOR_MAIN_THREAD_INTERACTION_CONTRACT }
    : { ...DEFAULT_COMMUNITY_INTERACTION_CONTRACT }
}

type CommunitySemanticCarrier = {
  community_semantics?: CommunitySemanticContract | null
  interaction_contract?: CommunityInteractionContract | null
}

type ContentSemanticCarrier = {
  content_semantics?: ContentSemanticProjection | null
}

export function readCommunityFamily(input: CommunitySemanticCarrier | null | undefined): CommunityFamily | null {
  return normalizeCommunityFamily(input?.community_semantics?.community_family ?? null)
}

export function readCommunityShellCategory(
  input: CommunitySemanticCarrier | null | undefined,
): CommunityShellCategory | null {
  return normalizeCommunityShellCategory(input?.community_semantics?.community_shell_category ?? null)
}

export function readPublicationReviewProfileId(
  input: CommunitySemanticCarrier | null | undefined,
): PublicationReviewProfileId | null {
  return normalizePublicationReviewProfileId(input?.community_semantics?.publication_review_profile_id ?? null)
}

export function readPublicParticipationMode(
  input: CommunitySemanticCarrier | null | undefined,
): PublicParticipationMode | null {
  return normalizePublicParticipationMode(input?.interaction_contract?.public_participation_mode ?? null)
}

export function readAudienceSignalIngestion(
  input: CommunitySemanticCarrier | null | undefined,
): AudienceSignalIngestion | null {
  return normalizeAudienceSignalIngestion(input?.interaction_contract?.audience_signal_ingestion ?? null)
}

export function readAgentHumanResponseMode(
  input: CommunitySemanticCarrier | null | undefined,
): AgentHumanResponseMode | null {
  return normalizeAgentHumanResponseMode(input?.interaction_contract?.agent_human_response_mode ?? null)
}

export function readCommunityLifecycleState(
  input: CommunitySemanticCarrier | null | undefined,
): CommunityLifecycleState | null {
  return normalizeCommunityLifecycleState(input?.community_semantics?.community_lifecycle_state ?? null)
}

export function readLaunchWave(input: CommunitySemanticCarrier | null | undefined): string | null {
  return normalizeString(input?.community_semantics?.launch_wave ?? null)
}

export function readDefaultEditorialShelfIds(
  input: CommunitySemanticCarrier | null | undefined,
): EditorialShelfId[] {
  return (input?.community_semantics?.default_editorial_shelf_ids ?? [])
    .map((item) => normalizeEditorialShelfId(item))
    .filter((item): item is EditorialShelfId => item !== null)
}

export function readStorylineId(input: ContentSemanticCarrier | null | undefined): string | null {
  return normalizeString(input?.content_semantics?.narrative.storyline_id ?? null)
}

export function readStorylineTitle(input: ContentSemanticCarrier | null | undefined): string | null {
  return normalizeString(input?.content_semantics?.narrative.storyline_title ?? null)
}

export function readStorylineState(input: ContentSemanticCarrier | null | undefined): StorylineState | null {
  return normalizeStorylineState(input?.content_semantics?.narrative.storyline_state ?? null)
}

export function readStorylineHook(input: ContentSemanticCarrier | null | undefined): string | null {
  return normalizeString(input?.content_semantics?.narrative.storyline_hook ?? null)
}

export function readScenePhase(input: ContentSemanticCarrier | null | undefined): ScenePhase | null {
  return normalizeScenePhase(input?.content_semantics?.scene_runtime.phase ?? null)
}

export function readContentKind(input: ContentSemanticCarrier | null | undefined): ContentKind | null {
  return normalizeContentKind(input?.content_semantics?.distribution.content_kind ?? null)
}

export function readEditorialShelfId(input: ContentSemanticCarrier | null | undefined): EditorialShelfId | null {
  return normalizeEditorialShelfId(input?.content_semantics?.distribution.editorial_shelf_id ?? null)
}

export function readHeroEligible(input: ContentSemanticCarrier | null | undefined): boolean {
  return input?.content_semantics?.distribution.hero_eligible === true
}

export function readAftershowExportBias(input: ContentSemanticCarrier | null | undefined): number | null {
  const value = input?.content_semantics?.distribution.aftershow_export_bias
  return typeof value === 'number' ? value : null
}

export function readFormatKind(input: ContentSemanticCarrier | null | undefined): FormatKind | null {
  return normalizeFormatKind(input?.content_semantics?.format.format_kind ?? null)
}

export function readNoteTemplateId(input: ContentSemanticCarrier | null | undefined): string | null {
  return normalizeString(input?.content_semantics?.format.note_template_id ?? null)
}

export function readCoverMode(input: ContentSemanticCarrier | null | undefined): string | null {
  return normalizeString(input?.content_semantics?.format.cover_mode ?? null)
}

export function readLaunchSurfaceKindId(input: ContentSemanticCarrier | null | undefined): LaunchSurfaceKindId | null {
  return normalizeLaunchSurfaceKindId(input?.content_semantics?.visual.surface_kind ?? null)
}

export function readCardMode(input: ContentSemanticCarrier | null | undefined): string | null {
  return normalizeString(input?.content_semantics?.visual.card_mode ?? null)
}

export function readThumbnailPolicy(input: ContentSemanticCarrier | null | undefined): string | null {
  return normalizeString(input?.content_semantics?.visual.thumbnail_policy ?? null)
}

export function isCreatorNoteEntry(input: ContentSemanticCarrier | {
  content_kind?: string | null
  editorial_shelf_id?: string | null
  note_template_id?: string | null
} | null | undefined): boolean {
  const contentKind = 'content_semantics' in (input ?? {})
    ? readContentKind(input as ContentSemanticCarrier)
    : normalizeContentKind((input as { content_kind?: string | null } | null | undefined)?.content_kind ?? null)
  const shelfId = 'content_semantics' in (input ?? {})
    ? readEditorialShelfId(input as ContentSemanticCarrier)
    : normalizeEditorialShelfId((input as { editorial_shelf_id?: string | null } | null | undefined)?.editorial_shelf_id ?? null)
  const noteTemplateId = 'content_semantics' in (input ?? {})
    ? readNoteTemplateId(input as ContentSemanticCarrier)
    : normalizeString((input as { note_template_id?: string | null } | null | undefined)?.note_template_id ?? null)
  return contentKind === 'note_entry' || shelfId === 'notes_today' || Boolean(noteTemplateId)
}

export function mergeContentSemantics(
  base: ContentSemanticProjection | null | undefined,
  patch: {
    scene_runtime?: Partial<ContentSemanticProjection['scene_runtime']>
    narrative?: Partial<ContentSemanticProjection['narrative']>
    distribution?: Partial<ContentSemanticProjection['distribution']>
    format?: Partial<ContentSemanticProjection['format']>
    visual?: Partial<ContentSemanticProjection['visual']>
  },
): ContentSemanticProjection {
  return {
    scene_runtime: {
      ...(base?.scene_runtime ?? {}),
      ...(patch.scene_runtime ?? {}),
    },
    narrative: {
      ...(base?.narrative ?? {}),
      ...(patch.narrative ?? {}),
    },
    distribution: {
      ...(base?.distribution ?? {}),
      ...(patch.distribution ?? {}),
    },
    format: {
      ...(base?.format ?? {}),
      ...(patch.format ?? {}),
    },
    visual: {
      ...(base?.visual ?? {}),
      ...(patch.visual ?? {}),
    },
  }
}
