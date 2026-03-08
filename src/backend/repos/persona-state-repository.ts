import type {
  AgentActiveOverlayEntity,
  AgentPersonaDeltaLogEntity,
  AgentPersonaStateEntity,
  CreateAgentPersonaDeltaLogInput,
  SaveAgentActiveOverlayInput,
  SaveAgentPersonaStateInput,
} from './types.js'

export interface PersonaStateRepository {
  hydrate?(): Promise<void>
  findState(agentId: string): Promise<AgentPersonaStateEntity | null>
  saveState(input: SaveAgentPersonaStateInput): Promise<AgentPersonaStateEntity | null>
  findOverlay(agentId: string): Promise<AgentActiveOverlayEntity | null>
  saveActiveOverlay(input: SaveAgentActiveOverlayInput): Promise<AgentActiveOverlayEntity>
  clearActiveOverlay(agentId: string): Promise<void>
  createDeltaLog(input: CreateAgentPersonaDeltaLogInput): Promise<AgentPersonaDeltaLogEntity>
  listDeltaLogsSince(agentId: string, since: Date): Promise<AgentPersonaDeltaLogEntity[]>
}

let counter = 0
function cuid(prefix: string): string {
  return `${prefix}_${Date.now()}_${++counter}`
}

export class InMemoryPersonaStateRepository implements PersonaStateRepository {
  private readonly states = new Map<string, AgentPersonaStateEntity>()
  private readonly overlays = new Map<string, AgentActiveOverlayEntity>()
  private readonly deltaLogs = new Map<string, AgentPersonaDeltaLogEntity>()

  async findState(agentId: string): Promise<AgentPersonaStateEntity | null> {
    return this.states.get(agentId) ?? null
  }

  async saveState(input: SaveAgentPersonaStateInput): Promise<AgentPersonaStateEntity | null> {
    const existing = this.states.get(input.agent_id) ?? null
    if (
      existing &&
      input.expected_version !== undefined &&
      existing.version !== input.expected_version
    ) {
      return null
    }

    const nextVersion = existing ? existing.version + 1 : 1
    const row: AgentPersonaStateEntity = {
      agent_id: input.agent_id,
      current_vector_json: input.current_vector_json,
      anchor_vector_json: input.anchor_vector_json,
      maturity: input.maturity,
      confidence: input.confidence,
      drift_score: input.drift_score,
      last_render_decision_json: input.last_render_decision_json ?? existing?.last_render_decision_json ?? null,
      updated_at: new Date(),
      version: nextVersion,
    }
    this.states.set(input.agent_id, row)
    return row
  }

  async findOverlay(agentId: string): Promise<AgentActiveOverlayEntity | null> {
    return this.overlays.get(agentId) ?? null
  }

  async saveActiveOverlay(input: SaveAgentActiveOverlayInput): Promise<AgentActiveOverlayEntity> {
    const row: AgentActiveOverlayEntity = {
      agent_id: input.agent_id,
      overlay_code: input.overlay_code,
      intensity: input.intensity,
      remaining_turns: input.remaining_turns,
      entered_at: input.entered_at,
      expires_at: input.expires_at,
      cooldown_until: input.cooldown_until,
      critical: input.critical,
      cause_type: input.cause_type,
      cause_ref_id: input.cause_ref_id ?? null,
      rng_seed: input.rng_seed,
      sampled_atoms_json: input.sampled_atoms_json,
      delta_json: input.delta_json,
      updated_at: new Date(),
    }
    this.overlays.set(input.agent_id, row)
    return row
  }

  async clearActiveOverlay(agentId: string): Promise<void> {
    this.overlays.delete(agentId)
  }

  async createDeltaLog(input: CreateAgentPersonaDeltaLogInput): Promise<AgentPersonaDeltaLogEntity> {
    const row: AgentPersonaDeltaLogEntity = {
      id: cuid('persona_delta'),
      agent_id: input.agent_id,
      source_type: input.source_type,
      source_ref: input.source_ref ?? null,
      scene: input.scene ?? null,
      salience: input.salience,
      raw_delta_json: input.raw_delta_json,
      applied_delta_json: input.applied_delta_json,
      writeback_applied: input.writeback_applied,
      reason: input.reason,
      created_at: new Date(),
    }
    this.deltaLogs.set(row.id, row)
    return row
  }

  async listDeltaLogsSince(agentId: string, since: Date): Promise<AgentPersonaDeltaLogEntity[]> {
    return Array.from(this.deltaLogs.values())
      .filter((item) => item.agent_id === agentId)
      .filter((item) => item.created_at >= since)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
  }
}
