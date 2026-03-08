import { Prisma, type AgentActiveOverlay as PrismaAgentActiveOverlay, type AgentPersonaDeltaLog as PrismaAgentPersonaDeltaLog, type AgentPersonaState as PrismaAgentPersonaState, type PrismaClient } from '@prisma/client'
import type {
  AgentActiveOverlayEntity,
  AgentPersonaDeltaLogEntity,
  AgentPersonaStateEntity,
  CreateAgentPersonaDeltaLogInput,
  SaveAgentActiveOverlayInput,
  SaveAgentPersonaStateInput,
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
          lastRenderDecisionJson: (input.last_render_decision_json ?? null) as Prisma.InputJsonValue,
          version: { increment: 1 },
        },
      })
      if (updated.count === 0) return null
      const latest = await this.prisma.agentPersonaState.findUnique({ where: { agentId: input.agent_id } })
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

  async createDeltaLog(input: CreateAgentPersonaDeltaLogInput): Promise<AgentPersonaDeltaLogEntity> {
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
      last_render_decision_json: row.lastRenderDecisionJson ? toJsonObject(row.lastRenderDecisionJson) : null,
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
}

function toJsonObject(value: Prisma.JsonValue): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}
