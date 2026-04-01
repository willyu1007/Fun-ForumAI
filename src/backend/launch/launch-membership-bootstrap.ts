import { ValidationError } from '../lib/errors.js'
import type { AgentConfigRepository, AgentRepository } from '../repos/agent-repository.js'
import type { CommunityRepository } from '../repos/community-repository.js'
import type { Agent } from '../repos/types.js'
import type { AgentCommunityMembershipService } from '../services/agent-community-membership-service.js'
import { listLaunchCommunitySeeds } from './community-rules.js'
import {
  getLaunchSystemRoster,
  readLaunchSystemIdentityConfig,
  type LaunchSystemIdentityConfig,
  type LaunchSystemRosterEntry,
  type LaunchSystemRosterRuntime,
} from './system-roster.js'

interface LaunchMembershipBootstrapDeps {
  agentRepo: AgentRepository
  agentConfigRepo: AgentConfigRepository
  communityRepo: CommunityRepository
  membershipService: Pick<AgentCommunityMembershipService, 'reconcileMemberships'>
}

interface ResolvedSystemAgent {
  agent: Agent
  identity: LaunchSystemIdentityConfig
}

interface LaunchBootstrapQueueItem {
  entry: LaunchSystemRosterEntry
  agent: Agent
  has_missing_communities: boolean
  targets: Array<{
    community_id: string
    role: 'resident' | 'guest'
  }>
}

export interface LaunchMembershipBootstrapResult {
  roster_agents: number
  processed_agents: number
  reconciled_agents: number
  active_memberships: number
  added_memberships: number
  role_changed_memberships: number
  removed_memberships: number
  blocked_memberships: number
  missing_agents: string[]
  agents_missing_identity: string[]
  missing_communities: string[]
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values))
}

function buildCommunityAliasMap(
  communityRepo: CommunityRepository,
): { communityIdByAlias: Map<string, string>; missingCommunities: string[] } {
  const communityIdByAlias = new Map<string, string>()
  const missingCommunities: string[] = []

  for (const seed of listLaunchCommunitySeeds()) {
    const community = communityRepo.findBySlug(seed.slug)
    if (!community) {
      missingCommunities.push(seed.name)
      continue
    }

    communityIdByAlias.set(seed.slug, community.id)
    communityIdByAlias.set(seed.name, community.id)
  }

  return {
    communityIdByAlias,
    missingCommunities: dedupe(missingCommunities),
  }
}

function buildOwnerAgentIndexes(input: {
  agentRepo: AgentRepository
  agentConfigRepo: AgentConfigRepository
  ownerId: string
}): {
  ownerAgentsByDisplayName: Map<string, Agent[]>
  systemAgentsByDisplayName: Map<string, ResolvedSystemAgent[]>
} {
  const ownerAgentsByDisplayName = new Map<string, Agent[]>()
  const systemAgentsByDisplayName = new Map<string, ResolvedSystemAgent[]>()

  for (const agent of input.agentRepo.findByOwner(input.ownerId)) {
    const ownerAgents = ownerAgentsByDisplayName.get(agent.display_name) ?? []
    ownerAgents.push(agent)
    ownerAgentsByDisplayName.set(agent.display_name, ownerAgents)

    const latestConfig = input.agentConfigRepo.findLatest(agent.id)
    const identity = readLaunchSystemIdentityConfig(latestConfig?.config_json)
    if (!identity) continue

    const systemAgents = systemAgentsByDisplayName.get(agent.display_name) ?? []
    systemAgents.push({ agent, identity })
    systemAgentsByDisplayName.set(agent.display_name, systemAgents)
  }

  return {
    ownerAgentsByDisplayName,
    systemAgentsByDisplayName,
  }
}

function resolveSystemAgentForEntry(
  entry: LaunchSystemRosterEntry,
  indexes: ReturnType<typeof buildOwnerAgentIndexes>,
): { agent: Agent | null; missingIdentity: boolean } {
  const candidates = indexes.systemAgentsByDisplayName.get(entry.display_name) ?? []
  const matched =
    candidates.find(({ identity }) =>
      identity.program_role === entry.program_role
      && identity.visibility_role === entry.visibility_role
      && identity.home_community === entry.home_community)
    ?? candidates[0]
    ?? null

  if (matched) {
    return { agent: matched.agent, missingIdentity: false }
  }

  return {
    agent: null,
    missingIdentity: (indexes.ownerAgentsByDisplayName.get(entry.display_name)?.length ?? 0) > 0,
  }
}

function buildTargetsForEntry(
  entry: LaunchSystemRosterEntry,
  communityIdByAlias: Map<string, string>,
): {
  targets: Array<{
    community_id: string
    role: 'resident' | 'guest'
  }>
  missingCommunities: string[]
} {
  const residentAliases = new Set<string>([
    entry.home_community,
    ...entry.resident_memberships,
  ])
  const targets = new Map<string, 'resident' | 'guest'>()
  const missingCommunities: string[] = []

  for (const alias of residentAliases) {
    const communityId = communityIdByAlias.get(alias)
    if (!communityId) {
      missingCommunities.push(alias)
      continue
    }
    targets.set(communityId, 'resident')
  }

  for (const alias of entry.guest_memberships) {
    const communityId = communityIdByAlias.get(alias)
    if (!communityId) {
      missingCommunities.push(alias)
      continue
    }
    if (!targets.has(communityId)) {
      targets.set(communityId, 'guest')
    }
  }

  return {
    targets: Array.from(targets.entries()).map(([community_id, role]) => ({
      community_id,
      role,
    })),
    missingCommunities: dedupe(missingCommunities),
  }
}

function toBlockingMessage(result: LaunchMembershipBootstrapResult): string {
  const parts: string[] = []
  if (result.missing_agents.length > 0) {
    parts.push(`missing agents: ${result.missing_agents.join(', ')}`)
  }
  if (result.agents_missing_identity.length > 0) {
    parts.push(`agents missing launch identity: ${result.agents_missing_identity.join(', ')}`)
  }
  if (result.missing_communities.length > 0) {
    parts.push(`missing communities: ${result.missing_communities.join(', ')}`)
  }
  return parts.join('; ')
}

export async function bootstrapLaunchRosterMemberships(
  deps: LaunchMembershipBootstrapDeps,
  input: {
    roster?: LaunchSystemRosterRuntime
    strict?: boolean
  } = {},
): Promise<LaunchMembershipBootstrapResult> {
  const roster = input.roster ?? getLaunchSystemRoster()
  const strict = input.strict !== false
  const { communityIdByAlias, missingCommunities: missingSeedCommunities } =
    buildCommunityAliasMap(deps.communityRepo)
  const indexes = buildOwnerAgentIndexes({
    agentRepo: deps.agentRepo,
    agentConfigRepo: deps.agentConfigRepo,
    ownerId: roster.owner_model.owner_id,
  })

  const queue: LaunchBootstrapQueueItem[] = []
  const missingAgents: string[] = []
  const agentsMissingIdentity: string[] = []
  const missingCommunities = new Set<string>(missingSeedCommunities)

  for (const entry of roster.roster) {
    const resolvedAgent = resolveSystemAgentForEntry(entry, indexes)
    if (!resolvedAgent.agent) {
      if (resolvedAgent.missingIdentity) {
        agentsMissingIdentity.push(entry.display_name)
      } else {
        missingAgents.push(entry.display_name)
      }
      continue
    }

    const targetResolution = buildTargetsForEntry(entry, communityIdByAlias)
    for (const missingCommunity of targetResolution.missingCommunities) {
      missingCommunities.add(missingCommunity)
    }

    queue.push({
      entry,
      agent: resolvedAgent.agent,
      has_missing_communities: targetResolution.missingCommunities.length > 0,
      targets: targetResolution.targets,
    })
  }

  const baseResult: LaunchMembershipBootstrapResult = {
    roster_agents: roster.roster.length,
    processed_agents: 0,
    reconciled_agents: 0,
    active_memberships: 0,
    added_memberships: 0,
    role_changed_memberships: 0,
    removed_memberships: 0,
    blocked_memberships: 0,
    missing_agents: dedupe(missingAgents),
    agents_missing_identity: dedupe(agentsMissingIdentity),
    missing_communities: dedupe(Array.from(missingCommunities)),
  }

  if (
    strict
    && (
      baseResult.missing_agents.length > 0
      || baseResult.agents_missing_identity.length > 0
      || baseResult.missing_communities.length > 0
    )
  ) {
    throw new ValidationError(`Launch roster membership bootstrap is blocked: ${toBlockingMessage(baseResult)}`)
  }

  for (const item of queue) {
    if (item.targets.length === 0 || item.has_missing_communities) {
      continue
    }

    const reconciled = await deps.membershipService.reconcileMemberships({
      agent_id: item.agent.id,
      targets: item.targets,
      actor_id: 'launch-membership-bootstrap',
      actor_type: 'system',
      source: 'DERIVED',
      remove_missing: true,
      reason: `launch_roster:${item.entry.id}`,
    })

    baseResult.processed_agents += 1
    baseResult.active_memberships += reconciled.active_memberships.length
    baseResult.added_memberships += reconciled.updated.added.length
    baseResult.role_changed_memberships += reconciled.updated.role_changed.length
    baseResult.removed_memberships += reconciled.updated.removed.length
    baseResult.blocked_memberships += reconciled.updated.blocked.length
    if (
      reconciled.updated.added.length > 0
      || reconciled.updated.role_changed.length > 0
      || reconciled.updated.removed.length > 0
    ) {
      baseResult.reconciled_agents += 1
    }
  }

  return baseResult
}
