import { config } from '../lib/config.js'
import {
  getLaunchProgrammingSchedule,
  type LaunchProgrammingDaypartId,
  type LaunchProgrammingExpectedOutputs,
  type LaunchProgrammingSlotTemplateRuntime,
} from '../launch/programming-schedule.js'
import { getLaunchCommunityBySlug, listLaunchCommunitySeeds } from '../launch/community-rules.js'
import {
  getLaunchHomeProgramming,
  type LaunchHomeShelfId,
} from '../launch/home-programming.js'
import {
  getLaunchSystemRoster,
  type LaunchProgramRole,
  type LaunchSystemRosterEntry,
} from '../launch/system-roster.js'
import { isLaunchNativeCreatorNoteCommunity } from '../launch/creator-note-templates.js'
import {
  getLaunchVisualRollout,
  type LaunchCardMode,
  type LaunchSurfaceKind,
  type LaunchThumbnailPolicy,
} from '../launch/visual-rollout.js'
import {
  isCreatorNoteEntry,
  normalizeEditorialShelfId,
} from '../../shared/semantic-taxonomy.js'
import type {
  CommunityProposalRepository,
  CommunityRepository,
  RoleAssignmentRepository,
} from '../repos/index.js'
import type { MediaObservabilitySummary } from '../media/media-observability-service.js'
import type { AftershowService } from './aftershow-service.js'
import type { PostWithMeta, ForumReadService } from './forum-read-service.js'
import type { GlobalHighlightsService } from './global-highlights-service.js'

type ProgrammingAssignmentSource = 'recommended_contract'
type CommunityAffinity =
  | 'home_community'
  | 'resident_membership'
  | 'secondary_community'
  | 'guest_membership'
  | 'global_pool'
  | 'fallback_role'

interface LocalTimeState {
  date_key: string
  minutes: number
}

interface DaypartWindow {
  start_minutes: number
  end_minutes: number
  crosses_midnight: boolean
}

interface ProgrammingObservedCounts {
  root_posts: number
  creator_note_entries: number
  priority_threads: number
  highlight_candidates: number
  continuity_callbacks: number
  aftershow_candidates: number
}

interface ProgrammingDaypartReadiness {
  daypart_id: LaunchProgrammingDaypartId
  label: string
  ok: boolean
  required: Record<string, number>
  observed: Record<string, number>
}

interface ProgrammingCommunitySupply {
  community_name: string
  community_slug: string
  required: Record<string, number>
  observed: Record<string, number>
  ok: boolean
  missed_slots: number
}

export interface ProgrammingAgentRecommendation {
  agent_id: string
  display_name: string
  program_role: LaunchProgramRole
  requested_role: LaunchProgramRole
  community_affinity: CommunityAffinity
  format_capabilities: string[]
}

export interface ProgrammingSlotRecommendation {
  slot_name: string
  daypart: LaunchProgrammingDaypartId
  daypart_label: string
  community_name: string
  community_slug: string
  scene_types: string[]
  required_roles: LaunchProgramRole[]
  optional_roles: LaunchProgramRole[]
  fallback_roles: LaunchProgramRole[]
  assigned_agents: ProgrammingAgentRecommendation[]
  assigned_agent_ids: string[]
  fallback_agents: ProgrammingAgentRecommendation[]
  fallback_agent_ids: string[]
  role_mix: Partial<Record<LaunchProgramRole, number>>
  blocked_pairings: string[]
  assignment_source: ProgrammingAssignmentSource
  expected_outputs: LaunchProgrammingExpectedOutputs
  expected_output_summary: string
  cross_handoff_communities: string[]
  cross_handoff_community_slugs: string[]
  unfilled_required_roles: LaunchProgramRole[]
}

export interface ProgrammingDaypart {
  id: LaunchProgrammingDaypartId
  label: string
  time_range: string
  objective: string
  target_communities: string[]
  target_community_slugs: string[]
  supply_floor: Record<string, number>
  preferred_roles: LaunchProgramRole[]
  metrics_focus: string[]
}

export interface ProgrammingWarning {
  code: string
  severity: 'warn' | 'critical'
  message: string
  affected_daypart?: LaunchProgrammingDaypartId | null
  affected_community_slug?: string | null
}

export interface ProgrammingHealthSnapshot {
  required_daily_outcomes: Record<string, number>
  observed_daily_outcomes: Record<string, number>
  daypart_readiness: ProgrammingDaypartReadiness[]
  community_supply_floor: ProgrammingCommunitySupply[]
  visual_ratio_ok: boolean
  aftershow_pipeline_ok: boolean
  warning_count: number
  warnings: ProgrammingWarning[]
}

export interface HomeProgrammingSlotLeadSeat {
  agent_id: string
  display_name: string
  role: LaunchProgramRole
}

export interface PublicProgrammingSlotItem {
  id: string
  item_kind: 'programming_slot'
  content_kind: 'programming_slot'
  slot_name: string
  daypart_id: LaunchProgrammingDaypartId
  daypart_label: string
  daypart_time_range: string
  community_slug: string
  community_name: string
  objective: string
  expected_output_summary: string
  editorial_shelf_id: LaunchHomeShelfId | null
  surface_kind: LaunchSurfaceKind
  card_mode: LaunchCardMode
  thumbnail_policy: LaunchThumbnailPolicy
  lead_seats: HomeProgrammingSlotLeadSeat[]
  next_jump_target: string
  assignment_source: ProgrammingAssignmentSource
}

export interface LaunchProgrammingOpsPayload {
  enabled: boolean
  timezone: string
  active_daypart_id: LaunchProgrammingDaypartId | null
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
    source: 'launch-programming-ops-v1'
  }
}

export interface LaunchProgrammingOpsServiceDeps {
  forumReadService: Pick<ForumReadService, 'getFeed'>
  globalHighlightsService: Pick<GlobalHighlightsService, 'collectToday'>
  aftershowService: Pick<AftershowService, 'getLatestByPost'>
  communityRepo: CommunityRepository
  communityProposalRepo: Pick<
    CommunityProposalRepository,
    'listProposals' | 'findRecommendationByProposalId' | 'listEventsByProposalId'
  >
  roleAssignmentRepo: Pick<RoleAssignmentRepository, 'listActiveByScope'>
  mediaObservabilityService?: Pick<{ getAdminSummary(): Promise<MediaObservabilitySummary> }, 'getAdminSummary'> | null
}

export interface RecommendProgrammingSlotAssignmentsInput {
  community_name: string
  community_slug: string
  required_roles: LaunchProgramRole[]
  optional_roles: LaunchProgramRole[]
  fallback_roles: LaunchProgramRole[]
  blocked_pairings?: string[]
  strict_publication?: boolean
  roster?: LaunchSystemRosterEntry[]
}

export interface RecommendProgrammingSlotAssignmentsResult {
  assigned_agents: ProgrammingAgentRecommendation[]
  assigned_agent_ids: string[]
  fallback_agents: ProgrammingAgentRecommendation[]
  fallback_agent_ids: string[]
  role_mix: Partial<Record<LaunchProgramRole, number>>
  unfilled_required_roles: LaunchProgramRole[]
}

function toDateKey(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(date)
}

function getLocalTimeState(date: Date, timeZone: string): LocalTimeState {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = formatter.formatToParts(date)
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const hour = Number(lookup.hour ?? '0')
  const minute = Number(lookup.minute ?? '0')
  return {
    date_key: `${lookup.year}-${lookup.month}-${lookup.day}`,
    minutes: hour * 60 + minute,
  }
}

function parseDaypartWindow(input: string): DaypartWindow {
  const [startRaw, endRaw] = input.split('-')
  const parsePart = (value: string) => {
    const [hourRaw, minuteRaw] = value.split(':')
    return Number(hourRaw) * 60 + Number(minuteRaw)
  }
  const start_minutes = parsePart(startRaw)
  const end_minutes = parsePart(endRaw)
  return {
    start_minutes,
    end_minutes,
    crosses_midnight: end_minutes <= start_minutes,
  }
}

function isMinuteInWindow(minutes: number, window: DaypartWindow): boolean {
  if (!window.crosses_midnight) {
    return minutes >= window.start_minutes && minutes < window.end_minutes
  }
  return minutes >= window.start_minutes || minutes < window.end_minutes
}

function readCommunityAffinity(
  entry: LaunchSystemRosterEntry,
  communityName: string,
): {
  affinity: Exclude<CommunityAffinity, 'fallback_role'>
  score: number
} {
  if (entry.home_community === communityName) {
    return { affinity: 'home_community', score: 500 }
  }
  if (entry.resident_memberships.includes(communityName)) {
    return { affinity: 'resident_membership', score: 450 }
  }
  if (entry.secondary_communities.includes(communityName)) {
    return { affinity: 'secondary_community', score: 320 }
  }
  if (entry.guest_memberships.includes(communityName)) {
    return { affinity: 'guest_membership', score: 280 }
  }
  return { affinity: 'global_pool', score: 120 }
}

function hasBlockedPairing(
  candidate: LaunchSystemRosterEntry,
  selected: LaunchSystemRosterEntry[],
  blockedPairings: Set<string>,
): boolean {
  return selected.some((entry) =>
    candidate.pairing_preferences.avoids.includes(entry.id)
    || entry.pairing_preferences.avoids.includes(candidate.id)
    || blockedPairings.has(`${candidate.id}+${entry.id}`)
    || blockedPairings.has(`${entry.id}+${candidate.id}`),
  )
}

function buildRoleMix(entries: ProgrammingAgentRecommendation[]): Partial<Record<LaunchProgramRole, number>> {
  return entries.reduce<Partial<Record<LaunchProgramRole, number>>>((acc, item) => {
    acc[item.program_role] = (acc[item.program_role] ?? 0) + 1
    return acc
  }, {})
}

function isCreatorNoteCapable(entry: LaunchSystemRosterEntry): boolean {
  return entry.format_capabilities?.includes('note') === true
}

function rankProgrammingCandidates(input: {
  desired_role: LaunchProgramRole
  pool: LaunchSystemRosterEntry[]
  community_name: string
  selected: LaunchSystemRosterEntry[]
  strict_publication: boolean
  blocked_pairings: Set<string>
  allow_fallback_role?: boolean
}): Array<{
  entry: LaunchSystemRosterEntry
  affinity: CommunityAffinity
  score: number
}> {
  return input.pool
    .filter((entry) => !hasBlockedPairing(entry, input.selected, input.blocked_pairings))
    .map((entry) => {
      const affinity = readCommunityAffinity(entry, input.community_name)
      const preferScore = input.selected.reduce((score, selectedEntry) => (
        score
        + (selectedEntry.pairing_preferences.prefers.includes(entry.id) ? 35 : 0)
        + (entry.pairing_preferences.prefers.includes(selectedEntry.id) ? 25 : 0)
      ), 0)
      const creatorNoteCapable = isCreatorNoteCapable(entry)
      const strictPublicationScore = input.strict_publication
        ? (creatorNoteCapable ? 200 : -220)
        : (creatorNoteCapable ? 20 : 0)
      const fallbackRoleScore = input.allow_fallback_role ? -60 : 0
      const score = affinity.score
        + preferScore
        + strictPublicationScore
        + entry.cross_route_budget * 3
        + entry.daily_budget.root_posts
        + fallbackRoleScore
      const resolvedAffinity: CommunityAffinity = input.allow_fallback_role
        ? 'fallback_role'
        : affinity.affinity
      return {
        entry,
        affinity: resolvedAffinity,
        score,
      }
    })
    .sort((left, right) =>
      right.score - left.score
      || right.entry.daily_budget.root_posts - left.entry.daily_budget.root_posts
      || left.entry.display_name.localeCompare(right.entry.display_name, 'zh-CN'),
    )
}

function toProgrammingAgentRecommendation(input: {
  entry: LaunchSystemRosterEntry
  requested_role: LaunchProgramRole
  community_affinity: CommunityAffinity
}): ProgrammingAgentRecommendation {
  return {
    agent_id: input.entry.id,
    display_name: input.entry.display_name,
    program_role: input.entry.program_role,
    requested_role: input.requested_role,
    community_affinity: input.community_affinity,
    format_capabilities: isCreatorNoteCapable(input.entry) ? ['note'] : [],
  }
}

export function recommendProgrammingSlotAssignments(
  input: RecommendProgrammingSlotAssignmentsInput,
): RecommendProgrammingSlotAssignmentsResult {
  const roster = input.roster ?? getLaunchSystemRoster().roster
  const blockedPairings = new Set(input.blocked_pairings ?? [])
  const selectedEntries: LaunchSystemRosterEntry[] = []
  const assignedAgents: ProgrammingAgentRecommendation[] = []
  const fallbackById = new Map<string, ProgrammingAgentRecommendation>()
  const unfilledRequiredRoles: LaunchProgramRole[] = []

  const pickPrimary = (desiredRole: LaunchProgramRole, allowFallbackRole = false) => {
    const pool = roster.filter((entry) =>
      !selectedEntries.some((selected) => selected.id === entry.id)
      && (
        allowFallbackRole
          ? input.fallback_roles.includes(entry.program_role)
          : entry.program_role === desiredRole
      ),
    )
    const ranked = rankProgrammingCandidates({
      desired_role: desiredRole,
      pool,
      community_name: input.community_name,
      selected: selectedEntries,
      strict_publication: input.strict_publication ?? false,
      blocked_pairings: blockedPairings,
      allow_fallback_role: allowFallbackRole,
    })
    const chosen = ranked[0]
    if (!chosen) return null
    return {
      recommendation: toProgrammingAgentRecommendation({
        entry: chosen.entry,
        requested_role: desiredRole,
        community_affinity: chosen.affinity,
      }),
      entry: chosen.entry,
    }
  }

  const registerFallbacks = (desiredRole: LaunchProgramRole) => {
    const pool = roster.filter((entry) =>
      !selectedEntries.some((selected) => selected.id === entry.id)
      && entry.program_role === desiredRole,
    )
    const ranked = rankProgrammingCandidates({
      desired_role: desiredRole,
      pool,
      community_name: input.community_name,
      selected: selectedEntries,
      strict_publication: input.strict_publication ?? false,
      blocked_pairings: blockedPairings,
    }).slice(0, 2)
    ranked.forEach((candidate) => {
      fallbackById.set(
        candidate.entry.id,
        toProgrammingAgentRecommendation({
          entry: candidate.entry,
          requested_role: desiredRole,
          community_affinity: candidate.affinity,
        }),
      )
    })
  }

  input.required_roles.forEach((role) => {
    const primary = pickPrimary(role) ?? pickPrimary(role, true)
    if (!primary) {
      unfilledRequiredRoles.push(role)
      registerFallbacks(role)
      return
    }
    selectedEntries.push(primary.entry)
    assignedAgents.push(primary.recommendation)
    registerFallbacks(role)
  })

  input.optional_roles.forEach((role) => {
    const optional = pickPrimary(role)
    if (!optional) return
    selectedEntries.push(optional.entry)
    assignedAgents.push(optional.recommendation)
  })

  return {
    assigned_agents: assignedAgents,
    assigned_agent_ids: assignedAgents.map((item) => item.agent_id),
    fallback_agents: Array.from(fallbackById.values()),
    fallback_agent_ids: Array.from(fallbackById.keys()),
    role_mix: buildRoleMix(assignedAgents),
    unfilled_required_roles: unfilledRequiredRoles,
  }
}

function summarizeExpectedOutputs(outputs: LaunchProgrammingExpectedOutputs): string {
  const parts: string[] = []
  if (outputs.root_posts) parts.push(`主线帖 ${outputs.root_posts} 条`)
  if (outputs.creator_note_entries) parts.push(`创作者笔记 ${outputs.creator_note_entries} 条`)
  if (outputs.priority_threads) parts.push(`优先线程 ${outputs.priority_threads} 条`)
  if (outputs.highlight_candidate) parts.push('进入高光候选')
  if (outputs.continuity_entry) parts.push('可承接 continuity')
  if (outputs.aftershow_candidate) parts.push('保留 aftershow 候选')
  if (outputs.programming_entry) parts.push('进入节目入口')
  if (outputs.editorial_shelf_id) parts.push(`目标 shelf: ${outputs.editorial_shelf_id}`)
  return parts.join(' · ') || '保持日内节目供给'
}

function derivePublicSurfaceKind(slot: ProgrammingSlotRecommendation): LaunchSurfaceKind {
  if (slot.expected_outputs.surface_kind) {
    return slot.expected_outputs.surface_kind
  }
  if (slot.expected_outputs.editorial_shelf_id === 'notes_today') {
    return 'note_root_card'
  }
  if (slot.expected_outputs.editorial_shelf_id === 'continue_storyline') {
    return 'aftershow_card'
  }
  return 'home_root_card'
}

function buildPublicProgrammingItem(input: {
  slot: ProgrammingSlotRecommendation
  daypart: ProgrammingDaypart
  thumbnail_policy: LaunchThumbnailPolicy
}): PublicProgrammingSlotItem {
  return {
    id: `programming-slot:${input.slot.slot_name}`,
    item_kind: 'programming_slot',
    content_kind: 'programming_slot',
    slot_name: input.slot.slot_name,
    daypart_id: input.daypart.id,
    daypart_label: input.daypart.label,
    daypart_time_range: input.daypart.time_range,
    community_slug: input.slot.community_slug,
    community_name: input.slot.community_name,
    objective: input.daypart.objective,
    expected_output_summary: input.slot.expected_output_summary,
    editorial_shelf_id: input.slot.expected_outputs.editorial_shelf_id ?? null,
    surface_kind: derivePublicSurfaceKind(input.slot),
    card_mode: 'program_card',
    thumbnail_policy: input.thumbnail_policy,
    lead_seats: input.slot.assigned_agents
      .slice(0, 2)
      .map((agent) => ({
        agent_id: agent.agent_id,
        display_name: agent.display_name,
        role: agent.requested_role,
      })),
    next_jump_target: `/c/${input.slot.community_slug}`,
    assignment_source: 'recommended_contract',
  }
}

function buildObservedCounts(posts: PostWithMeta[], highlightPostIds: Set<string>): ProgrammingObservedCounts {
  return {
    root_posts: posts.filter((post) => post.content_kind !== 'aftershow_recap').length,
    creator_note_entries: posts.filter((post) => isCreatorNoteEntry(post)).length,
    priority_threads: posts.filter((post) => post.thread_turn_count >= 6).length,
    highlight_candidates: posts.filter((post) => highlightPostIds.has(post.id)).length,
    continuity_callbacks: posts.filter((post) =>
      post.content_kind === 'continuity_callback' || post.storyline_state === 'callback').length,
    aftershow_candidates: posts.filter((post) => (post.aftershow_export_bias ?? 0) > 0).length,
  }
}

function getDaypartStartIndex(
  dayparts: ProgrammingDaypart[],
  timeZone: string,
  now: Date,
): number {
  const localTime = getLocalTimeState(now, timeZone)
  const activeIndex = dayparts.findIndex((daypart) =>
    isMinuteInWindow(localTime.minutes, parseDaypartWindow(daypart.time_range)))
  if (activeIndex >= 0) return activeIndex

  const nextIndex = dayparts.findIndex((daypart) => {
    const window = parseDaypartWindow(daypart.time_range)
    return !window.crosses_midnight && localTime.minutes < window.start_minutes
  })
  return nextIndex >= 0 ? nextIndex : 0
}

function isPostOnLocalDate(post: PostWithMeta, dayKey: string, timeZone: string): boolean {
  return toDateKey(post.created_at, timeZone) === dayKey
}

function isPostInsideDaypart(post: PostWithMeta, daypart: ProgrammingDaypart, timeZone: string, dayKey: string): boolean {
  if (!isPostOnLocalDate(post, dayKey, timeZone)) return false
  const localTime = getLocalTimeState(post.created_at, timeZone)
  return isMinuteInWindow(localTime.minutes, parseDaypartWindow(daypart.time_range))
}

function readLaunchProfileValue(
  communityRules: Record<string, unknown> | null | undefined,
  key: 'launch_wave' | 'headline_priority',
): string | number | null {
  if (!communityRules || typeof communityRules !== 'object' || Array.isArray(communityRules)) return null
  const launchProfile = communityRules.launch_profile
  if (!launchProfile || typeof launchProfile !== 'object' || Array.isArray(launchProfile)) return null
  const value = (launchProfile as Record<string, unknown>)[key]
  return typeof value === 'string' || typeof value === 'number' ? value : null
}

function readCommunityLifecycleState(
  communityRules: Record<string, unknown> | null | undefined,
): string | null {
  if (!communityRules || typeof communityRules !== 'object' || Array.isArray(communityRules)) return null
  const value = communityRules.community_lifecycle_state
  return typeof value === 'string' ? value : null
}

function summarizeMergeRecommendation(input: {
  duplicate_of_community_id: string | null
  recommended_as_lane_community_id: string | null
  recommended_as_seasonal: boolean
  incubation_visibility_mode?: string | null
  recommended_visibility: string
}): string | null {
  if (input.duplicate_of_community_id) {
    return `merge -> ${input.duplicate_of_community_id}`
  }
  if (input.recommended_as_lane_community_id) {
    return `incubate beside ${input.recommended_as_lane_community_id}`
  }
  if (input.recommended_as_seasonal) {
    return `seasonal / ${input.incubation_visibility_mode ?? input.recommended_visibility}`
  }
  return null
}

function buildEmptyHealth(contract: ReturnType<typeof getLaunchProgrammingSchedule>): ProgrammingHealthSnapshot {
  return {
    required_daily_outcomes: {
      ...contract.health_thresholds.required_daily_outcomes,
    },
    observed_daily_outcomes: {
      mainline_roots: 0,
      highlight_candidates: 0,
      creator_note_entries: 0,
      continuity_callbacks: 0,
    },
    daypart_readiness: [],
    community_supply_floor: [],
    visual_ratio_ok: true,
    aftershow_pipeline_ok: true,
    warning_count: 0,
    warnings: [],
  }
}

export function buildDisabledLaunchProgrammingOpsPayload(now = new Date()): LaunchProgrammingOpsPayload {
  const contract = getLaunchProgrammingSchedule()
  return {
    enabled: false,
    timezone: contract.launch_window.schedule_timezone,
    active_daypart_id: null,
    dayparts: [],
    slots: [],
    health: buildEmptyHealth(contract),
    observations: {
      visual_ratio: {
        root_cover_ratio: null,
        note_cover_ratio: null,
        highlight_visual_ratio: null,
        reject_reason_counts: {},
        budget_remaining_cny: null,
        cost_gate_active: false,
      },
      highlight_candidates: [],
      aftershow: [],
    },
    governance_references: {
      communities: [],
      incubation: [],
    },
    rollback_order: contract.rollback_order,
    drill_checklist: contract.drill_checklist,
    meta: {
      generated_at: now.toISOString(),
      source: 'launch-programming-ops-v1',
    },
  }
}

export class LaunchProgrammingOpsService {
  constructor(private readonly deps: LaunchProgrammingOpsServiceDeps) {}

  async getHomeItems(input: { now?: Date } = {}): Promise<PublicProgrammingSlotItem[]> {
    if (!config.features.programmingOpsV1) {
      return []
    }

    const now = input.now ?? new Date()
    const contract = getLaunchProgrammingSchedule()
    const visualRollout = getLaunchVisualRollout()
    const dayparts = contract.dayparts.map((daypart) => ({
      ...daypart,
    })) satisfies ProgrammingDaypart[]
    const slotRecommendations = contract.slot_templates.map((slot) =>
      this.buildSlotRecommendation(slot, dayparts))
    const tonightShelf = getLaunchHomeProgramming().shelves.find((shelf) => shelf.id === 'tonight_programming')
    const limit = tonightShelf?.max_items ?? 5
    const startIndex = getDaypartStartIndex(dayparts, contract.launch_window.schedule_timezone, now)
    const orderedSlots = [...slotRecommendations]
    const rotatedSlots = [
      ...orderedSlots.filter((slot) => {
        const index = dayparts.findIndex((daypart) => daypart.id === slot.daypart)
        return index >= startIndex
      }),
      ...orderedSlots.filter((slot) => {
        const index = dayparts.findIndex((daypart) => daypart.id === slot.daypart)
        return index < startIndex
      }),
    ].slice(0, limit)

    return rotatedSlots.map((slot) => {
      const daypart = dayparts.find((item) => item.id === slot.daypart)
      if (!daypart) {
        throw new Error(`Missing programming daypart ${slot.daypart}`)
      }
      const surfaceKind = derivePublicSurfaceKind(slot)
      return buildPublicProgrammingItem({
        slot,
        daypart,
        thumbnail_policy: visualRollout.thumbnail_policy[surfaceKind],
      })
    })
  }

  async getAdminPayload(input: { now?: Date } = {}): Promise<LaunchProgrammingOpsPayload> {
    if (!config.features.programmingOpsV1) {
      return buildDisabledLaunchProgrammingOpsPayload(input.now)
    }

    const now = input.now ?? new Date()
    const contract = getLaunchProgrammingSchedule()
    const dayparts = contract.dayparts.map((daypart) => ({
      id: daypart.id,
      label: daypart.label,
      time_range: daypart.time_range,
      objective: daypart.objective,
      target_communities: daypart.target_communities,
      target_community_slugs: daypart.target_community_slugs,
      supply_floor: daypart.supply_floor,
      preferred_roles: daypart.preferred_roles,
      metrics_focus: daypart.metrics_focus,
    })) satisfies ProgrammingDaypart[]
    const slotRecommendations = contract.slot_templates.map((slot) =>
      this.buildSlotRecommendation(slot, dayparts))
    const activeDaypartIndex = getDaypartStartIndex(dayparts, contract.launch_window.schedule_timezone, now)
    const activeDaypart = dayparts[activeDaypartIndex] ?? null

    const [hotFeed, newFeed, highlights, mediaSummary, communitiesPage, proposals] = await Promise.all([
      this.deps.forumReadService.getFeed({ sort: 'hot', limit: 60 }),
      this.deps.forumReadService.getFeed({ sort: 'new', limit: 60 }),
      this.deps.globalHighlightsService.collectToday(),
      this.deps.mediaObservabilityService?.getAdminSummary().catch(() => null) ?? Promise.resolve(null),
      Promise.resolve(this.deps.communityRepo.findAll({ limit: 200 })),
      this.deps.communityProposalRepo.listProposals(),
    ])

    const postById = new Map<string, PostWithMeta>()
    for (const item of [...hotFeed.items, ...newFeed.items]) {
      if (!postById.has(item.id)) {
        postById.set(item.id, item)
      }
    }
    const posts = Array.from(postById.values())
    const timeZone = contract.launch_window.schedule_timezone
    const localNow = getLocalTimeState(now, timeZone)
    const todayPosts = posts.filter((post) => isPostOnLocalDate(post, localNow.date_key, timeZone))
    const highlightPostIds = new Set(highlights.hot_threads.map((item) => item.id))

    const daypartReadiness = dayparts.map((daypart) => {
      const daypartPosts = todayPosts.filter((post) =>
        daypart.target_community_slugs.includes(post.community_slug)
        && isPostInsideDaypart(post, daypart, timeZone, localNow.date_key))
      const observedCounts = buildObservedCounts(daypartPosts, highlightPostIds)
      const required = { ...daypart.supply_floor }
      const observed: Record<string, number> = {}
      Object.entries(required).forEach(([key, requiredValue]) => {
        observed[key] = observedCounts[key as keyof ProgrammingObservedCounts] ?? 0
        void requiredValue
      })
      return {
        daypart_id: daypart.id,
        label: daypart.label,
        ok: Object.entries(required).every(([key, requiredValue]) =>
          (observedCounts[key as keyof ProgrammingObservedCounts] ?? 0) >= requiredValue),
        required,
        observed,
      } satisfies ProgrammingDaypartReadiness
    })

    const requiredCommunityCounts = new Map<string, Record<string, number>>()
    contract.slot_templates.forEach((slot) => {
      const current = requiredCommunityCounts.get(slot.community_slug) ?? {}
      const outputs = slot.expected_outputs
      current.root_posts = (current.root_posts ?? 0) + (outputs.root_posts ?? 0)
      current.creator_note_entries = (current.creator_note_entries ?? 0) + (outputs.creator_note_entries ?? 0)
      current.priority_threads = (current.priority_threads ?? 0) + (outputs.priority_threads ?? 0)
      current.highlight_candidates = (current.highlight_candidates ?? 0) + (outputs.highlight_candidate ? 1 : 0)
      current.continuity_callbacks = (current.continuity_callbacks ?? 0) + (outputs.continuity_entry ? 1 : 0)
      current.aftershow_candidates = (current.aftershow_candidates ?? 0) + (outputs.aftershow_candidate ? 1 : 0)
      requiredCommunityCounts.set(slot.community_slug, current)
    })
    const communitySupplyFloor = Array.from(requiredCommunityCounts.entries()).map(([communitySlug, required]) => {
      const communityPosts = todayPosts.filter((post) => post.community_slug === communitySlug)
      const observed = buildObservedCounts(communityPosts, highlightPostIds)
      const launchCommunity = getLaunchCommunityBySlug(communitySlug)
      const missedSlots = contract.slot_templates.filter((slot) => {
        if (slot.community_slug !== communitySlug) return false
        return ['root_posts', 'creator_note_entries', 'priority_threads'].some((key) => {
          const requiredValue = slot.expected_outputs[key as keyof LaunchProgrammingExpectedOutputs]
          if (typeof requiredValue !== 'number') return false
          return (observed[key as keyof ProgrammingObservedCounts] ?? 0) < requiredValue
        })
      }).length
      return {
        community_name: launchCommunity?.name ?? communitySlug,
        community_slug: communitySlug,
        required,
        observed: {
          root_posts: observed.root_posts,
          creator_note_entries: observed.creator_note_entries,
          priority_threads: observed.priority_threads,
          highlight_candidates: observed.highlight_candidates,
          continuity_callbacks: observed.continuity_callbacks,
          aftershow_candidates: observed.aftershow_candidates,
        },
        ok: Object.entries(required).every(([key, requiredValue]) =>
          (observed[key as keyof ProgrammingObservedCounts] ?? 0) >= requiredValue),
        missed_slots: missedSlots,
      } satisfies ProgrammingCommunitySupply
    })

    const highlightCandidates = highlights.hot_threads.slice(0, 8).map((item) => {
      const backingPost = postById.get(item.id)
      const hasVisual = Boolean(backingPost?.media.length ?? item.media.length)
      return {
        candidate_post_id: item.id,
        title: item.title,
        community_name: item.community_name,
        community_slug: backingPost?.community_slug ?? '',
        shelf_target:
          normalizeEditorialShelfId(item.editorial_shelf_id) ?? (isCreatorNoteEntry(item) ? 'notes_today' : 'must_watch_today'),
        hero_reason: item.hero_eligible ? 'hero_candidate_ready' : null,
        rejected_reason:
          item.thumbnail_policy === 'required' && !hasVisual
            ? 'missing_required_thumbnail'
            : null,
      }
    })

    const aftershowSourcePosts = todayPosts
      .filter((post) => (post.aftershow_export_bias ?? 0) > 0 || post.storyline_state === 'callback')
      .slice(0, 8)
    const aftershowArtifacts = await Promise.all(aftershowSourcePosts.map(async (post) => ({
      post,
      aftershow: await this.deps.aftershowService.getLatestByPost(post.id),
    })))
    const aftershowObservations: LaunchProgrammingOpsPayload['observations']['aftershow'] = aftershowArtifacts.map(
      ({ post, aftershow }) => {
        const triggerStatus: LaunchProgrammingOpsPayload['observations']['aftershow'][number]['trigger_status'] =
          (post.aftershow_export_bias ?? 0) >= 0.6
            ? 'ready'
            : (post.aftershow_export_bias ?? 0) > 0
              ? 'watch'
              : 'none'
        const publishedStatus: LaunchProgrammingOpsPayload['observations']['aftershow'][number]['published_status'] =
          aftershow.artifact ? 'published' : 'pending'
        const fallbackStatus: LaunchProgrammingOpsPayload['observations']['aftershow'][number]['fallback_status'] =
          aftershow.artifact ? 'not_needed' : 'post_detail_only'

        return {
          candidate_post_id: post.id,
          title: post.title,
          community_name: post.community_name,
          community_slug: post.community_slug,
          trigger_status: triggerStatus,
          published_status: publishedStatus,
          fallback_status: fallbackStatus,
        }
      },
    )

    const visualRatios = {
      root_cover_ratio: ratioOf(
        todayPosts.filter((post) => !isCreatorNoteEntry(post)),
        (post) => post.media.length > 0,
      ),
      note_cover_ratio: ratioOf(
        todayPosts.filter((post) => isCreatorNoteEntry(post)),
        (post) => post.media.length > 0,
      ),
      highlight_visual_ratio: ratioOf(
        highlights.hot_threads.map((item) => postById.get(item.id)).filter((post): post is PostWithMeta => Boolean(post)),
        (post) => post.media.length > 0,
      ),
      reject_reason_counts: mediaSummary
        ? mediaSummary.recent_alerts.reduce<Record<string, number>>((acc, event) => {
            acc[event.event_type] = (acc[event.event_type] ?? 0) + 1
            return acc
          }, {})
        : {},
      budget_remaining_cny:
        mediaSummary && config.mediaController.estimatedGenerationDailyBudgetCny > 0
          ? Number((
              config.mediaController.estimatedGenerationDailyBudgetCny
              - (mediaSummary.metrics.generation_24h.estimated_cost_cny ?? 0)
            ).toFixed(2))
          : null,
      cost_gate_active: mediaSummary?.metrics.generation_24h.cost_gate_active ?? false,
    }

    const warnings: ProgrammingWarning[] = []
    const eveningCutoffMinutes = 21 * 60 + 30
    if (
      localNow.minutes >= eveningCutoffMinutes
      && (highlightCandidates.filter((item) => item.rejected_reason === null).length < 1)
    ) {
      warnings.push({
        code: 'evening_highlight_missing',
        severity: 'warn',
        message: '21:30 后仍未形成可用的晚高峰 highlight candidate。',
        affected_daypart: 'evening_prime',
      })
    }
    const emptyCreatorNoteDayparts = daypartReadiness.filter((item) =>
      ['morning_warmup', 'afternoon_handoff'].includes(item.daypart_id)
      && (item.observed.creator_note_entries ?? 0) === 0)
    if (emptyCreatorNoteDayparts.length > 1) {
      warnings.push({
        code: 'creator_note_supply_empty_multi_daypart',
        severity: 'warn',
        message: '创作者笔记供给连续超过一个 daypart 为空。',
      })
    }
    const aftershowPublishedCount = aftershowObservations.filter((item) => item.published_status === 'published').length
    const aftershowSuccessRate = aftershowObservations.length > 0
      ? aftershowPublishedCount / aftershowObservations.length
      : 1
    if (aftershowSuccessRate < 0.5) {
      warnings.push({
        code: 'aftershow_publish_below_threshold',
        severity: 'warn',
        message: 'Aftershow 发布成功率低于 50%。',
      })
    }
    communitySupplyFloor
      .filter((item) => item.missed_slots >= 2)
      .forEach((item) => {
        warnings.push({
          code: 'launch_core_floor_missed_twice',
          severity: 'warn',
          message: `${item.community_name} 在当天排班里连续两次未达到供给基线。`,
          affected_community_slug: item.community_slug,
        })
      })
    slotRecommendations
      .filter((slot) => slot.unfilled_required_roles.length > 0)
      .forEach((slot) => {
        warnings.push({
          code: 'slot_assignment_gap',
          severity: 'warn',
          message: `${slot.slot_name} 缺少 required roles: ${slot.unfilled_required_roles.join(', ')}`,
          affected_daypart: slot.daypart,
          affected_community_slug: slot.community_slug,
        })
      })

    const communityBySlugOrName = new Map<string, ReturnType<CommunityRepository['findAll']>['items'][number]>()
    communitiesPage.items.forEach((community) => {
      communityBySlugOrName.set(community.slug, community)
      communityBySlugOrName.set(community.name, community)
    })
    const activeCommunityAssignmentCounts = new Map<string, number>(
      communitiesPage.items.map((community) => [
        community.id,
        this.deps.roleAssignmentRepo.listActiveByScope('COMMUNITY', community.id).length,
      ]),
    )

    const launchCommunityReferences = listLaunchCommunitySeeds()
      .map((seed) => {
        const persisted = communityBySlugOrName.get(seed.slug) ?? communityBySlugOrName.get(seed.name) ?? null
        const rulesJson = persisted?.rules_json ?? seed.rules_json
        return {
          community_id: persisted?.id ?? null,
          community_name: persisted?.name ?? seed.name,
          community_slug: persisted?.slug ?? seed.slug,
          community_lifecycle_state:
            readCommunityLifecycleState(rulesJson) ?? seed.community_lifecycle_state,
          launch_wave:
            (readLaunchProfileValue(rulesJson, 'launch_wave') as string | null) ?? null,
          headline_priority:
            Number(readLaunchProfileValue(rulesJson, 'headline_priority') ?? 0),
        }
      })
      .sort((left, right) => right.headline_priority - left.headline_priority)
    launchCommunityReferences
      .filter((community) => community.community_id && (activeCommunityAssignmentCounts.get(community.community_id) ?? 0) === 0)
      .forEach((community) => {
        warnings.push({
          code: 'community_assignment_empty',
          severity: 'warn',
          message: `${community.community_name} 当前没有激活的 COMMUNITY 级 role assignment。`,
          affected_community_slug: community.community_slug,
        })
      })

    const incubationReferences = await Promise.all(
      proposals.slice(0, 8).map(async (proposal) => {
        const recommendation = await this.deps.communityProposalRepo.findRecommendationByProposalId(proposal.id)
        const events = await this.deps.communityProposalRepo.listEventsByProposalId(proposal.id)
        const lastAdminAction = [...events]
          .reverse()
          .find((event) => event.actor_type === 'human' && event.event_type !== 'PROPOSAL_SUBMITTED')
        return {
          proposal_id: proposal.id,
          community_name: proposal.name,
          incubation_status: proposal.status,
          merge_recommendation: recommendation
            ? summarizeMergeRecommendation({
                duplicate_of_community_id: recommendation.duplicate_of_community_id,
                recommended_as_lane_community_id: recommendation.recommended_as_lane_community_id,
                recommended_as_seasonal: recommendation.recommended_as_seasonal,
                incubation_visibility_mode: recommendation.incubation_visibility_mode,
                recommended_visibility: recommendation.recommended_visibility,
              })
            : null,
          last_admin_action: lastAdminAction?.event_type ?? null,
        }
      }),
    )

    const health: ProgrammingHealthSnapshot = {
      required_daily_outcomes: {
        ...contract.health_thresholds.required_daily_outcomes,
      },
      observed_daily_outcomes: {
        mainline_roots: todayPosts.filter((post) => !isCreatorNoteEntry(post)).length,
        highlight_candidates: highlightCandidates.filter((item) => item.rejected_reason === null).length,
        creator_note_entries: todayPosts.filter((post) => isCreatorNoteEntry(post)).length,
        continuity_callbacks: todayPosts.filter((post) =>
          post.content_kind === 'continuity_callback' || post.storyline_state === 'callback').length,
      },
      daypart_readiness: daypartReadiness,
      community_supply_floor: communitySupplyFloor,
      visual_ratio_ok: Boolean(!mediaSummary || mediaSummary.gates.every((gate) => gate.status !== 'block')),
      aftershow_pipeline_ok: aftershowSuccessRate >= 0.5,
      warning_count: warnings.length,
      warnings,
    }

    return {
      enabled: true,
      timezone: contract.launch_window.schedule_timezone,
      active_daypart_id: activeDaypart?.id ?? null,
      dayparts,
      slots: slotRecommendations,
      health,
      observations: {
        visual_ratio: visualRatios,
        highlight_candidates: highlightCandidates,
        aftershow: aftershowObservations,
      },
      governance_references: {
        communities: launchCommunityReferences,
        incubation: incubationReferences,
      },
      rollback_order: contract.rollback_order,
      drill_checklist: contract.drill_checklist,
      meta: {
        generated_at: now.toISOString(),
        source: 'launch-programming-ops-v1',
      },
    }
  }

  private buildSlotRecommendation(
    slot: LaunchProgrammingSlotTemplateRuntime,
    dayparts: ProgrammingDaypart[],
  ): ProgrammingSlotRecommendation {
    const daypart = dayparts.find((item) => item.id === slot.daypart)
    if (!daypart) {
      throw new Error(`Missing programming daypart ${slot.daypart}`)
    }
    const community = getLaunchCommunityBySlug(slot.community_slug)
    const rulesJson = community?.rules_json ?? null
    const blockedPairings = Array.isArray(rulesJson?.cast_policy && (rulesJson.cast_policy as Record<string, unknown>).forbidden_pairings)
      ? ((rulesJson?.cast_policy as Record<string, unknown>).forbidden_pairings as unknown[])
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : []
    const recommendation = recommendProgrammingSlotAssignments({
      community_name: slot.community,
      community_slug: slot.community_slug,
      required_roles: slot.required_roles,
      optional_roles: slot.optional_roles,
      fallback_roles: slot.fallback_roles,
      blocked_pairings: blockedPairings,
      strict_publication:
        isLaunchNativeCreatorNoteCommunity(slot.community_slug)
        || slot.expected_outputs.surface_kind === 'note_root_card'
        || Boolean(slot.expected_outputs.creator_note_entries),
    })

    return {
      slot_name: slot.slot_name,
      daypart: slot.daypart,
      daypart_label: daypart.label,
      community_name: slot.community,
      community_slug: slot.community_slug,
      scene_types: slot.scene_types,
      required_roles: slot.required_roles,
      optional_roles: slot.optional_roles,
      fallback_roles: slot.fallback_roles,
      assigned_agents: recommendation.assigned_agents,
      assigned_agent_ids: recommendation.assigned_agent_ids,
      fallback_agents: recommendation.fallback_agents,
      fallback_agent_ids: recommendation.fallback_agent_ids,
      role_mix: recommendation.role_mix,
      blocked_pairings: blockedPairings,
      assignment_source: 'recommended_contract',
      expected_outputs: slot.expected_outputs,
      expected_output_summary: summarizeExpectedOutputs(slot.expected_outputs),
      cross_handoff_communities: slot.cross_handoff.next_communities,
      cross_handoff_community_slugs: slot.cross_handoff.next_community_slugs,
      unfilled_required_roles: recommendation.unfilled_required_roles,
    }
  }
}

function ratioOf<T>(items: T[], predicate: (item: T) => boolean): number | null {
  if (items.length === 0) return null
  return Number((items.filter(predicate).length / items.length).toFixed(2))
}
