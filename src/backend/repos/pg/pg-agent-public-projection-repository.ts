import { Prisma, type PrismaClient } from '@prisma/client'
import type { AgentPublicProjection } from '../types.js'
import type {
  AgentPublicProjectionRepository,
  SaveAgentPublicProjectionInput,
} from '../agent-public-projection-repository.js'

function toRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const source = value as Record<string, unknown>
  const out: Record<string, number> = {}
  for (const [key, item] of Object.entries(source)) {
    if (typeof item === 'number') out[key] = item
  }
  return out
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function toUnknownRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function toInputJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

export class PgAgentPublicProjectionRepository implements AgentPublicProjectionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {}

  async get(agentId: string): Promise<AgentPublicProjection | null> {
    const row = await this.prisma.agentPublicProjection.findUnique({
      where: { agentId },
    })
    return row ? this.toDomain(row) : null
  }

  async list(agentIds: string[]): Promise<AgentPublicProjection[]> {
    if (agentIds.length === 0) return []
    const rows = await this.prisma.agentPublicProjection.findMany({
      where: { agentId: { in: agentIds } },
    })
    return rows.map((row) => this.toDomain(row))
  }

  async upsert(input: SaveAgentPublicProjectionInput): Promise<AgentPublicProjection> {
    const row = await this.prisma.agentPublicProjection.upsert({
      where: { agentId: input.agent_id },
      create: {
        agentId: input.agent_id,
        sceneAffinityJson: input.scene_affinity_json,
        banterStyle: input.banter_style,
        conflictThreshold: input.conflict_threshold,
        callbackHabit: input.callback_habit,
        signatureMovesJson: input.signature_moves_json,
        disclosurePolicyJson: toInputJson(input.disclosure_policy_json),
        followTargetsJson: input.follow_targets_json,
        avoidTargetsJson: input.avoid_targets_json,
      },
      update: {
        sceneAffinityJson: input.scene_affinity_json,
        banterStyle: input.banter_style,
        conflictThreshold: input.conflict_threshold,
        callbackHabit: input.callback_habit,
        signatureMovesJson: input.signature_moves_json,
        disclosurePolicyJson: toInputJson(input.disclosure_policy_json),
        followTargetsJson: input.follow_targets_json,
        avoidTargetsJson: input.avoid_targets_json,
      },
    })
    return this.toDomain(row)
  }

  private toDomain(row: {
    id: string
    agentId: string
    sceneAffinityJson: unknown
    banterStyle: string
    conflictThreshold: number
    callbackHabit: number
    signatureMovesJson: unknown
    disclosurePolicyJson: unknown
    followTargetsJson: unknown
    avoidTargetsJson: unknown
    createdAt: Date
    updatedAt: Date
  }): AgentPublicProjection {
    return {
      id: row.id,
      agent_id: row.agentId,
      scene_affinity_json: toRecord(row.sceneAffinityJson),
      banter_style: row.banterStyle,
      conflict_threshold: row.conflictThreshold,
      callback_habit: row.callbackHabit,
      signature_moves_json: toStringArray(row.signatureMovesJson),
      disclosure_policy_json: toUnknownRecord(row.disclosurePolicyJson),
      follow_targets_json: toStringArray(row.followTargetsJson),
      avoid_targets_json: toStringArray(row.avoidTargetsJson),
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
