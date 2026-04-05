import type { Agent } from '@/api/types'
import { MAX_LEFT_RAIL_DISPLAY_AGENTS } from '@/shared/stores/left-rail-agent-display-store'

function getAgentCreatedAtTime(agent: Agent) {
  return new Date(agent.created_at).getTime()
}

export function resolveLeftRailDisplayOwnerId(
  agents: Agent[],
  userId: string | null | undefined,
) {
  return userId ?? agents.find((agent) => agent.owner_id)?.owner_id ?? null
}

export function sortAgentsByCreatedAt(agents: Agent[]) {
  return [...agents].sort((left, right) => getAgentCreatedAtTime(left) - getAgentCreatedAtTime(right))
}

export function resolveLeftRailDisplayAgents(
  agents: Agent[],
  selectedAgentIds: string[],
) {
  const sortedAgents = sortAgentsByCreatedAt(agents)

  if (selectedAgentIds.length === 0) {
    return sortedAgents.slice(0, MAX_LEFT_RAIL_DISPLAY_AGENTS)
  }

  const agentById = new Map(sortedAgents.map((agent) => [agent.id, agent]))
  return Array.from(new Set(selectedAgentIds))
    .map((agentId) => agentById.get(agentId) ?? null)
    .filter((agent): agent is Agent => agent !== null)
    .sort((left, right) => getAgentCreatedAtTime(left) - getAgentCreatedAtTime(right))
    .slice(0, MAX_LEFT_RAIL_DISPLAY_AGENTS)
}
