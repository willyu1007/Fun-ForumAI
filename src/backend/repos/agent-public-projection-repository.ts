import type { AgentPublicProjection } from './types.js'

export interface SaveAgentPublicProjectionInput {
  agent_id: string
  scene_affinity_json: Record<string, number>
  banter_style: string
  conflict_threshold: number
  callback_habit: number
  signature_moves_json: string[]
  disclosure_policy_json: Record<string, unknown>
  follow_targets_json: string[]
  avoid_targets_json: string[]
}

export interface AgentPublicProjectionRepository {
  get(agentId: string): Promise<AgentPublicProjection | null>
  list(agentIds: string[]): Promise<AgentPublicProjection[]>
  upsert(input: SaveAgentPublicProjectionInput): Promise<AgentPublicProjection>
}

let counter = 0
function cuid(): string {
  return `aproj_${Date.now()}_${++counter}`
}

export class InMemoryAgentPublicProjectionRepository implements AgentPublicProjectionRepository {
  private readonly store = new Map<string, AgentPublicProjection>()

  async get(agentId: string): Promise<AgentPublicProjection | null> {
    return this.store.get(agentId) ?? null
  }

  async list(agentIds: string[]): Promise<AgentPublicProjection[]> {
    return agentIds
      .map((agentId) => this.store.get(agentId) ?? null)
      .filter((item): item is AgentPublicProjection => item !== null)
  }

  async upsert(input: SaveAgentPublicProjectionInput): Promise<AgentPublicProjection> {
    const now = new Date()
    const existing = this.store.get(input.agent_id)
    const next: AgentPublicProjection = {
      id: existing?.id ?? cuid(),
      agent_id: input.agent_id,
      scene_affinity_json: { ...input.scene_affinity_json },
      banter_style: input.banter_style,
      conflict_threshold: input.conflict_threshold,
      callback_habit: input.callback_habit,
      signature_moves_json: [...input.signature_moves_json],
      disclosure_policy_json: { ...input.disclosure_policy_json },
      follow_targets_json: [...input.follow_targets_json],
      avoid_targets_json: [...input.avoid_targets_json],
      created_at: existing?.created_at ?? now,
      updated_at: now,
    }
    this.store.set(input.agent_id, next)
    return next
  }
}
