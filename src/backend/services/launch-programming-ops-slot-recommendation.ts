import {
  getLaunchSystemRoster,
  type LaunchProgramRole,
  type LaunchSystemRosterEntry,
} from '../launch/system-roster.js'
import type {
  LaunchProgrammingDaypartId,
  LaunchProgrammingExpectedOutputs,
} from '../launch/programming-schedule.js'

export type ProgrammingAssignmentSource = 'recommended_contract'

export type CommunityAffinity =
  | 'home_community'
  | 'resident_membership'
  | 'secondary_community'
  | 'guest_membership'
  | 'global_pool'
  | 'fallback_role'

export interface ProgrammingAgentRecommendation {
  agent_id: string
  display_name: string
  program_role: LaunchProgramRole
  requested_role: LaunchProgramRole
  community_affinity: CommunityAffinity
  format_capabilities: string[]
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
