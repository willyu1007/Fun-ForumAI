import {
  Prisma,
  type AgentActiveOverlay as PrismaAgentActiveOverlay,
  type AgentInferenceProfile as PrismaAgentInferenceProfile,
  type AgentInferenceShadowReview as PrismaAgentInferenceShadowReview,
  type AgentPersonaDeltaLog as PrismaAgentPersonaDeltaLog,
  type AgentPersonaState as PrismaAgentPersonaState,
  type PrismaClient,
} from '@prisma/client'
import type {
  AgentActiveOverlayEntity,
  AgentInferenceProfileEntity,
  AgentInferenceShadowReviewEntity,
  AgentPersonaDeltaLogEntity,
  AgentPersonaStateEntity,
  CreateAgentInferenceShadowReviewInput,
  CreateAgentPersonaDeltaLogInput,
  SaveAgentInferenceProfileInput,
  SaveAgentActiveOverlayInput,
  SaveAgentPersonaStateInput,
  UpdateAgentInferenceShadowReviewInput,
} from '../types.js'
import type { PersonaStateRepository } from '../persona-state-repository.js'

export class PgPersonaStateRepository implements PersonaStateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {}

  async findState(agentId: string): Promise<AgentPersonaStateEntity | null> {
    const row = await this.prisma.agentPersonaState.findUnique({ where: { agentId } })
    return row ? this.toStateEntity(row) : null
  }

  async saveState(input: SaveAgentPersonaStateInput): Promise<AgentPersonaStateEntity | null> {
    if (input.expected_version !== undefined) {
      const updated = await this.prisma.agentPersonaState.updateMany({
        where: {
          agentId: input.agent_id,
          version: input.expected_version,
        },
        data: {
          currentVectorJson: input.current_vector_json as Prisma.InputJsonValue,
          anchorVectorJson: input.anchor_vector_json as Prisma.InputJsonValue,
          maturity: input.maturity,
          confidence: input.confidence,
          driftScore: input.drift_score,
          lastRenderDecisionJson: (input.last_render_decision_json ??
            null) as Prisma.InputJsonValue,
          version: { increment: 1 },
        },
      })
      if (updated.count === 0) return null
      const latest = await this.prisma.agentPersonaState.findUnique({
        where: { agentId: input.agent_id },
      })
      return latest ? this.toStateEntity(latest) : null
    }

    const row = await this.prisma.agentPersonaState.upsert({
      where: { agentId: input.agent_id },
      create: {
        agentId: input.agent_id,
        currentVectorJson: input.current_vector_json as Prisma.InputJsonValue,
        anchorVectorJson: input.anchor_vector_json as Prisma.InputJsonValue,
        maturity: input.maturity,
        confidence: input.confidence,
        driftScore: input.drift_score,
        lastRenderDecisionJson: (input.last_render_decision_json ?? null) as Prisma.InputJsonValue,
      },
      update: {
        currentVectorJson: input.current_vector_json as Prisma.InputJsonValue,
        anchorVectorJson: input.anchor_vector_json as Prisma.InputJsonValue,
        maturity: input.maturity,
        confidence: input.confidence,
        driftScore: input.drift_score,
        lastRenderDecisionJson: (input.last_render_decision_json ?? null) as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
    })
    return this.toStateEntity(row)
  }

  async findOverlay(agentId: string): Promise<AgentActiveOverlayEntity | null> {
    const row = await this.prisma.agentActiveOverlay.findUnique({ where: { agentId } })
    return row ? this.toOverlayEntity(row) : null
  }

  async saveActiveOverlay(input: SaveAgentActiveOverlayInput): Promise<AgentActiveOverlayEntity> {
    const row = await this.prisma.agentActiveOverlay.upsert({
      where: { agentId: input.agent_id },
      create: {
        agentId: input.agent_id,
        overlayCode: input.overlay_code,
        intensity: input.intensity,
        remainingTurns: input.remaining_turns,
        enteredAt: input.entered_at,
        expiresAt: input.expires_at,
        cooldownUntil: input.cooldown_until,
        critical: input.critical,
        causeType: input.cause_type,
        causeRefId: input.cause_ref_id ?? null,
        rngSeed: input.rng_seed,
        sampledAtomsJson: input.sampled_atoms_json as Prisma.InputJsonValue,
        deltaJson: input.delta_json as Prisma.InputJsonValue,
      },
      update: {
        overlayCode: input.overlay_code,
        intensity: input.intensity,
        remainingTurns: input.remaining_turns,
        enteredAt: input.entered_at,
        expiresAt: input.expires_at,
        cooldownUntil: input.cooldown_until,
        critical: input.critical,
        causeType: input.cause_type,
        causeRefId: input.cause_ref_id ?? null,
        rngSeed: input.rng_seed,
        sampledAtomsJson: input.sampled_atoms_json as Prisma.InputJsonValue,
        deltaJson: input.delta_json as Prisma.InputJsonValue,
      },
    })
    return this.toOverlayEntity(row)
  }

  async clearActiveOverlay(agentId: string): Promise<void> {
    await this.prisma.agentActiveOverlay.deleteMany({ where: { agentId } })
  }

  async findInferenceProfile(agentId: string): Promise<AgentInferenceProfileEntity | null> {
    const row = await this.prisma.agentInferenceProfile.findUnique({ where: { agentId } })
    return row ? this.toInferenceProfileEntity(row) : null
  }

  async saveInferenceProfile(
    input: SaveAgentInferenceProfileInput,
  ): Promise<AgentInferenceProfileEntity> {
    const row = await this.prisma.agentInferenceProfile.upsert({
      where: { agentId: input.agent_id },
      create: {
        agentId: input.agent_id,
        profileVersion: input.profile_version ?? 1,
        incumbentFamily: input.incumbent_family,
        challengerFamily: input.challenger_family ?? null,
        challengerVoiceLineId: input.challenger_voice_line_id ?? null,
        migrationState: input.migration_state,
        consecutiveLeadWindows: input.consecutive_lead_windows,
        challengerScoreDelta: input.challenger_score_delta ?? null,
        manualVoiceLineLock: input.manual_voice_line_lock,
        candidateSince: input.candidate_since ?? null,
        shadowStartedAt: input.shadow_started_at ?? null,
        effectiveAt: input.effective_at ?? null,
        blockedAt: input.blocked_at ?? null,
        blockedReason: input.blocked_reason ?? null,
        freezeUntil: input.freeze_until ?? null,
        lastCompiledAt: input.last_compiled_at,
        lastSnapshotJson: input.last_snapshot_json as Prisma.InputJsonValue,
      },
      update: {
        profileVersion: input.profile_version ?? undefined,
        incumbentFamily: input.incumbent_family,
        challengerFamily: input.challenger_family ?? null,
        challengerVoiceLineId: input.challenger_voice_line_id ?? null,
        migrationState: input.migration_state,
        consecutiveLeadWindows: input.consecutive_lead_windows,
        challengerScoreDelta: input.challenger_score_delta ?? null,
        manualVoiceLineLock: input.manual_voice_line_lock,
        candidateSince: input.candidate_since ?? null,
        shadowStartedAt: input.shadow_started_at ?? null,
        effectiveAt: input.effective_at ?? null,
        blockedAt: input.blocked_at ?? null,
        blockedReason: input.blocked_reason ?? null,
        freezeUntil: input.freeze_until ?? null,
        lastCompiledAt: input.last_compiled_at,
        lastSnapshotJson: input.last_snapshot_json as Prisma.InputJsonValue,
      },
    })
    return this.toInferenceProfileEntity(row)
  }

  async findLatestInferenceShadowReview(
    agentId: string,
  ): Promise<AgentInferenceShadowReviewEntity | null> {
    const row = await this.prisma.agentInferenceShadowReview.findFirst({
      where: { agentId },
      orderBy: [{ createdAt: 'desc' }],
    })
    return row ? this.toInferenceShadowReviewEntity(row) : null
  }

  async createInferenceShadowReview(
    input: CreateAgentInferenceShadowReviewInput,
  ): Promise<AgentInferenceShadowReviewEntity> {
    const row = await this.prisma.agentInferenceShadowReview.create({
      data: {
        agentId: input.agent_id,
        reviewCaseId: input.review_case_id ?? null,
        incumbentFamily: input.incumbent_family,
        incumbentVoiceLineId: input.incumbent_voice_line_id,
        challengerFamily: input.challenger_family,
        challengerVoiceLineId: input.challenger_voice_line_id,
        status: input.status,
        summaryJson: input.summary_json as Prisma.InputJsonValue,
        evidenceJson: input.evidence_json as Prisma.InputJsonValue,
        startedAt: input.started_at,
        collectedAt: input.collected_at ?? null,
        decidedAt: input.decided_at ?? null,
        decidedByUserId: input.decided_by_user_id ?? null,
      },
    })
    return this.toInferenceShadowReviewEntity(row)
  }

  async updateInferenceShadowReview(
    reviewId: string,
    input: UpdateAgentInferenceShadowReviewInput,
  ): Promise<AgentInferenceShadowReviewEntity | null> {
    const row = await this.prisma.agentInferenceShadowReview
      .update({
        where: { id: reviewId },
        data: {
          reviewCaseId: input.review_case_id,
          status: input.status,
          summaryJson: input.summary_json as Prisma.InputJsonValue | undefined,
          evidenceJson: input.evidence_json as Prisma.InputJsonValue | undefined,
          collectedAt: input.collected_at,
          decidedAt: input.decided_at,
          decidedByUserId: input.decided_by_user_id,
        },
      })
      .catch((err) => {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
          return null
        }
        throw err
      })
    return row ? this.toInferenceShadowReviewEntity(row) : null
  }

  async createDeltaLog(
    input: CreateAgentPersonaDeltaLogInput,
  ): Promise<AgentPersonaDeltaLogEntity> {
    const row = await this.prisma.agentPersonaDeltaLog.create({
      data: {
        agentId: input.agent_id,
        sourceType: input.source_type,
        sourceRef: input.source_ref ?? null,
        scene: input.scene ?? null,
        salience: input.salience,
        rawDeltaJson: input.raw_delta_json as Prisma.InputJsonValue,
        appliedDeltaJson: input.applied_delta_json as Prisma.InputJsonValue,
        writebackApplied: input.writeback_applied,
        reason: input.reason,
      },
    })
    return this.toDeltaEntity(row)
  }

  async listDeltaLogsSince(agentId: string, since: Date): Promise<AgentPersonaDeltaLogEntity[]> {
    const rows = await this.prisma.agentPersonaDeltaLog.findMany({
      where: {
        agentId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map((row) => this.toDeltaEntity(row))
  }

  private toStateEntity(row: PrismaAgentPersonaState): AgentPersonaStateEntity {
    return {
      agent_id: row.agentId,
      current_vector_json: toJsonObject(row.currentVectorJson),
      anchor_vector_json: toJsonObject(row.anchorVectorJson),
      maturity: row.maturity,
      confidence: row.confidence,
      drift_score: row.driftScore,
      last_render_decision_json: row.lastRenderDecisionJson
        ? toJsonObject(row.lastRenderDecisionJson)
        : null,
      updated_at: row.updatedAt,
      version: row.version,
    }
  }

  private toOverlayEntity(row: PrismaAgentActiveOverlay): AgentActiveOverlayEntity {
    return {
      agent_id: row.agentId,
      overlay_code: row.overlayCode,
      intensity: row.intensity,
      remaining_turns: row.remainingTurns,
      entered_at: row.enteredAt,
      expires_at: row.expiresAt,
      cooldown_until: row.cooldownUntil,
      critical: row.critical,
      cause_type: row.causeType,
      cause_ref_id: row.causeRefId,
      rng_seed: row.rngSeed,
      sampled_atoms_json: toJsonObject(row.sampledAtomsJson),
      delta_json: toJsonObject(row.deltaJson),
      updated_at: row.updatedAt,
    }
  }

  private toDeltaEntity(row: PrismaAgentPersonaDeltaLog): AgentPersonaDeltaLogEntity {
    return {
      id: row.id,
      agent_id: row.agentId,
      source_type: row.sourceType,
      source_ref: row.sourceRef,
      scene: row.scene,
      salience: row.salience,
      raw_delta_json: toJsonObject(row.rawDeltaJson),
      applied_delta_json: toJsonObject(row.appliedDeltaJson),
      writeback_applied: row.writebackApplied,
      reason: row.reason,
      created_at: row.createdAt,
    }
  }

  private toInferenceProfileEntity(row: PrismaAgentInferenceProfile): AgentInferenceProfileEntity {
    return {
      agent_id: row.agentId,
      profile_version: row.profileVersion,
      incumbent_family: row.incumbentFamily,
      challenger_family: row.challengerFamily,
      challenger_voice_line_id: row.challengerVoiceLineId,
      migration_state: row.migrationState,
      consecutive_lead_windows: row.consecutiveLeadWindows,
      challenger_score_delta: row.challengerScoreDelta,
      manual_voice_line_lock: row.manualVoiceLineLock,
      candidate_since: row.candidateSince,
      shadow_started_at: row.shadowStartedAt,
      effective_at: row.effectiveAt,
      blocked_at: row.blockedAt,
      blocked_reason: row.blockedReason,
      freeze_until: row.freezeUntil,
      last_compiled_at: row.lastCompiledAt,
      last_snapshot_json: toJsonObject(row.lastSnapshotJson),
      updated_at: row.updatedAt,
    }
  }

  private toInferenceShadowReviewEntity(
    row: PrismaAgentInferenceShadowReview,
  ): AgentInferenceShadowReviewEntity {
    return {
      id: row.id,
      agent_id: row.agentId,
      review_case_id: row.reviewCaseId,
      incumbent_family: row.incumbentFamily,
      incumbent_voice_line_id: row.incumbentVoiceLineId,
      challenger_family: row.challengerFamily,
      challenger_voice_line_id: row.challengerVoiceLineId,
      status: row.status,
      summary_json: toJsonObject(row.summaryJson),
      evidence_json: toJsonObject(row.evidenceJson),
      started_at: row.startedAt,
      collected_at: row.collectedAt,
      decided_at: row.decidedAt,
      decided_by_user_id: row.decidedByUserId,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}

function toJsonObject(value: Prisma.JsonValue): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}
