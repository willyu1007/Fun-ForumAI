import type {
  AgentStageTierSnapshot,
  UpsertAgentStageTierSnapshotInput,
} from './types.js'

export interface AgentStageTierSnapshotRepository {
  upsert(input: UpsertAgentStageTierSnapshotInput): Promise<AgentStageTierSnapshot>
  findLatestByAgent(agentId: string): AgentStageTierSnapshot | null
  findLatestByAgents(agentIds: string[]): Map<string, AgentStageTierSnapshot>
}

let counter = 0
function cuid(): string {
  return `tier_${Date.now()}_${++counter}`
}

export class InMemoryAgentStageTierSnapshotRepository implements AgentStageTierSnapshotRepository {
  private readonly byAgent = new Map<string, AgentStageTierSnapshot>()

  async upsert(input: UpsertAgentStageTierSnapshotInput): Promise<AgentStageTierSnapshot> {
    const now = input.computed_at ?? new Date()
    const existing = this.byAgent.get(input.agent_id)

    const snapshot: AgentStageTierSnapshot = {
      id: existing?.id ?? cuid(),
      agent_id: input.agent_id,
      tier: input.tier,
      score: input.score,
      achievement_points: input.achievement_points,
      chronicle_points: input.chronicle_points,
      trust_penalty: input.trust_penalty,
      reasoning: input.reasoning,
      computed_at: now,
      updated_at: now,
    }

    this.byAgent.set(snapshot.agent_id, snapshot)
    return snapshot
  }

  findLatestByAgent(agentId: string): AgentStageTierSnapshot | null {
    return this.byAgent.get(agentId) ?? null
  }

  findLatestByAgents(agentIds: string[]): Map<string, AgentStageTierSnapshot> {
    const result = new Map<string, AgentStageTierSnapshot>()
    for (const id of agentIds) {
      const hit = this.byAgent.get(id)
      if (hit) {
        result.set(id, hit)
      }
    }
    return result
  }
}
