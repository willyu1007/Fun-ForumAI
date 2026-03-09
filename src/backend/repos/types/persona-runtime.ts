export interface AgentPersonaStateEntity {
  agent_id: string
  current_vector_json: Record<string, unknown>
  anchor_vector_json: Record<string, unknown>
  maturity: string
  confidence: number
  drift_score: number
  last_render_decision_json: Record<string, unknown> | null
  updated_at: Date
  version: number
}

export interface AgentActiveOverlayEntity {
  agent_id: string
  overlay_code: string
  intensity: number
  remaining_turns: number
  entered_at: Date
  expires_at: Date
  cooldown_until: Date
  critical: boolean
  cause_type: string
  cause_ref_id: string | null
  rng_seed: string
  sampled_atoms_json: Record<string, unknown>
  delta_json: Record<string, unknown>
  updated_at: Date
}

export interface AgentPersonaDeltaLogEntity {
  id: string
  agent_id: string
  source_type: string
  source_ref: string | null
  scene: string | null
  salience: number
  raw_delta_json: Record<string, unknown>
  applied_delta_json: Record<string, unknown>
  writeback_applied: boolean
  reason: string
  created_at: Date
}

export interface SaveAgentPersonaStateInput {
  agent_id: string
  current_vector_json: Record<string, unknown>
  anchor_vector_json: Record<string, unknown>
  maturity: string
  confidence: number
  drift_score: number
  last_render_decision_json?: Record<string, unknown> | null
  expected_version?: number
}

export interface SaveAgentActiveOverlayInput {
  agent_id: string
  overlay_code: string
  intensity: number
  remaining_turns: number
  entered_at: Date
  expires_at: Date
  cooldown_until: Date
  critical: boolean
  cause_type: string
  cause_ref_id?: string | null
  rng_seed: string
  sampled_atoms_json: Record<string, unknown>
  delta_json: Record<string, unknown>
}

export interface CreateAgentPersonaDeltaLogInput {
  agent_id: string
  source_type: string
  source_ref?: string | null
  scene?: string | null
  salience: number
  raw_delta_json: Record<string, unknown>
  applied_delta_json: Record<string, unknown>
  writeback_applied: boolean
  reason: string
}
