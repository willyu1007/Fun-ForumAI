import type {
  AgentActiveOverlayEntity,
  AgentPersonaDeltaLogEntity,
  AgentInferenceProfileEntity,
  AgentInferenceShadowReviewEntity,
  AgentPersonaStateEntity,
  CreateAgentInferenceShadowReviewInput,
  CreateAgentPersonaDeltaLogInput,
  SaveAgentInferenceProfileInput,
  SaveAgentActiveOverlayInput,
  SaveAgentPersonaStateInput,
  UpdateAgentInferenceShadowReviewInput,
} from './types.js'

export interface PersonaStateRepository {
  hydrate?(): Promise<void>
  findState(agentId: string): Promise<AgentPersonaStateEntity | null>
  saveState(input: SaveAgentPersonaStateInput): Promise<AgentPersonaStateEntity | null>
  findOverlay(agentId: string): Promise<AgentActiveOverlayEntity | null>
  saveActiveOverlay(input: SaveAgentActiveOverlayInput): Promise<AgentActiveOverlayEntity>
  clearActiveOverlay(agentId: string): Promise<void>
  findInferenceProfile(agentId: string): Promise<AgentInferenceProfileEntity | null>
  saveInferenceProfile(input: SaveAgentInferenceProfileInput): Promise<AgentInferenceProfileEntity>
  findLatestInferenceShadowReview(agentId: string): Promise<AgentInferenceShadowReviewEntity | null>
  createInferenceShadowReview(
    input: CreateAgentInferenceShadowReviewInput,
  ): Promise<AgentInferenceShadowReviewEntity>
  updateInferenceShadowReview(
    reviewId: string,
    input: UpdateAgentInferenceShadowReviewInput,
  ): Promise<AgentInferenceShadowReviewEntity | null>
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
  private readonly inferenceProfiles = new Map<string, AgentInferenceProfileEntity>()
  private readonly inferenceShadowReviews = new Map<string, AgentInferenceShadowReviewEntity>()
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
      last_render_decision_json:
        input.last_render_decision_json ?? existing?.last_render_decision_json ?? null,
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

  async findInferenceProfile(agentId: string): Promise<AgentInferenceProfileEntity | null> {
    return this.inferenceProfiles.get(agentId) ?? null
  }

  async saveInferenceProfile(
    input: SaveAgentInferenceProfileInput,
  ): Promise<AgentInferenceProfileEntity> {
    const existing = this.inferenceProfiles.get(input.agent_id) ?? null
    const row: AgentInferenceProfileEntity = {
      agent_id: input.agent_id,
      profile_version: input.profile_version ?? existing?.profile_version ?? 1,
      incumbent_family: input.incumbent_family,
      challenger_family: input.challenger_family ?? null,
      challenger_voice_line_id: input.challenger_voice_line_id ?? null,
      migration_state: input.migration_state,
      consecutive_lead_windows: input.consecutive_lead_windows,
      challenger_score_delta: input.challenger_score_delta ?? null,
      manual_voice_line_lock: input.manual_voice_line_lock,
      visible_provider_pin: input.visible_provider_pin ?? null,
      visible_model_pin: input.visible_model_pin ?? null,
      candidate_since: input.candidate_since ?? null,
      shadow_started_at: input.shadow_started_at ?? null,
      effective_at: input.effective_at ?? null,
      blocked_at: input.blocked_at ?? null,
      blocked_reason: input.blocked_reason ?? null,
      freeze_until: input.freeze_until ?? null,
      last_compiled_at: input.last_compiled_at,
      last_snapshot_json: input.last_snapshot_json,
      updated_at: new Date(),
    }
    this.inferenceProfiles.set(input.agent_id, row)
    return row
  }

  async findLatestInferenceShadowReview(
    agentId: string,
  ): Promise<AgentInferenceShadowReviewEntity | null> {
    return (
      Array.from(this.inferenceShadowReviews.values())
        .filter((row) => row.agent_id === agentId)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0] ?? null
    )
  }

  async createInferenceShadowReview(
    input: CreateAgentInferenceShadowReviewInput,
  ): Promise<AgentInferenceShadowReviewEntity> {
    const row: AgentInferenceShadowReviewEntity = {
      id: cuid('shadow_review'),
      agent_id: input.agent_id,
      review_case_id: input.review_case_id ?? null,
      incumbent_family: input.incumbent_family,
      incumbent_voice_line_id: input.incumbent_voice_line_id,
      challenger_family: input.challenger_family,
      challenger_voice_line_id: input.challenger_voice_line_id,
      status: input.status,
      summary_json: input.summary_json,
      evidence_json: input.evidence_json,
      started_at: input.started_at,
      collected_at: input.collected_at ?? null,
      decided_at: input.decided_at ?? null,
      decided_by_user_id: input.decided_by_user_id ?? null,
      created_at: new Date(),
      updated_at: new Date(),
    }
    this.inferenceShadowReviews.set(row.id, row)
    return row
  }

  async updateInferenceShadowReview(
    reviewId: string,
    input: UpdateAgentInferenceShadowReviewInput,
  ): Promise<AgentInferenceShadowReviewEntity | null> {
    const existing = this.inferenceShadowReviews.get(reviewId)
    if (!existing) return null
    const row: AgentInferenceShadowReviewEntity = {
      ...existing,
      review_case_id:
        input.review_case_id !== undefined ? input.review_case_id : existing.review_case_id,
      status: input.status ?? existing.status,
      summary_json: input.summary_json ?? existing.summary_json,
      evidence_json: input.evidence_json ?? existing.evidence_json,
      collected_at: input.collected_at !== undefined ? input.collected_at : existing.collected_at,
      decided_at: input.decided_at !== undefined ? input.decided_at : existing.decided_at,
      decided_by_user_id:
        input.decided_by_user_id !== undefined
          ? input.decided_by_user_id
          : existing.decided_by_user_id,
      updated_at: new Date(),
    }
    this.inferenceShadowReviews.set(reviewId, row)
    return row
  }

  async createDeltaLog(
    input: CreateAgentPersonaDeltaLogInput,
  ): Promise<AgentPersonaDeltaLogEntity> {
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
