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

export interface AgentInferenceProfileEntity {
  agent_id: string
  profile_version: number
  incumbent_family: string
  challenger_family: string | null
  challenger_voice_line_id: string | null
  migration_state: string
  consecutive_lead_windows: number
  challenger_score_delta: number | null
  manual_voice_line_lock: boolean
  candidate_since: Date | null
  shadow_started_at: Date | null
  effective_at: Date | null
  blocked_at: Date | null
  blocked_reason: string | null
  freeze_until: Date | null
  last_compiled_at: Date
  last_snapshot_json: Record<string, unknown>
  updated_at: Date
}

export interface AgentInferenceShadowReviewEntity {
  id: string
  agent_id: string
  review_case_id: string | null
  incumbent_family: string
  incumbent_voice_line_id: string
  challenger_family: string
  challenger_voice_line_id: string
  status: string
  summary_json: Record<string, unknown>
  evidence_json: Record<string, unknown>
  started_at: Date
  collected_at: Date | null
  decided_at: Date | null
  decided_by_user_id: string | null
  created_at: Date
  updated_at: Date
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

export interface SaveAgentInferenceProfileInput {
  agent_id: string
  profile_version?: number
  incumbent_family: string
  challenger_family?: string | null
  challenger_voice_line_id?: string | null
  migration_state: string
  consecutive_lead_windows: number
  challenger_score_delta?: number | null
  manual_voice_line_lock: boolean
  candidate_since?: Date | null
  shadow_started_at?: Date | null
  effective_at?: Date | null
  blocked_at?: Date | null
  blocked_reason?: string | null
  freeze_until?: Date | null
  last_compiled_at: Date
  last_snapshot_json: Record<string, unknown>
}

export interface CreateAgentInferenceShadowReviewInput {
  agent_id: string
  review_case_id?: string | null
  incumbent_family: string
  incumbent_voice_line_id: string
  challenger_family: string
  challenger_voice_line_id: string
  status: string
  summary_json: Record<string, unknown>
  evidence_json: Record<string, unknown>
  started_at: Date
  collected_at?: Date | null
  decided_at?: Date | null
  decided_by_user_id?: string | null
}

export interface UpdateAgentInferenceShadowReviewInput {
  review_case_id?: string | null
  status?: string
  summary_json?: Record<string, unknown>
  evidence_json?: Record<string, unknown>
  collected_at?: Date | null
  decided_at?: Date | null
  decided_by_user_id?: string | null
}
