import { randomUUID } from 'node:crypto'
import { Prisma, type PrismaClient, type AgentStageTierSnapshot as PrismaAgentStageTierSnapshot } from '@prisma/client'
import type {
  AgentStageTierSnapshot,
  UpsertAgentStageTierSnapshotInput,
} from '../types.js'
import type { AgentStageTierSnapshotRepository } from '../agent-stage-tier-snapshot-repository.js'

const DEFAULT_CACHE_TTL_MS = 5_000

export class PgAgentStageTierSnapshotRepository implements AgentStageTierSnapshotRepository {
  private readonly cache = new Map<string, AgentStageTierSnapshot>()
  private readonly cacheTtlMs: number
  private lastHydratedAt = 0
  private refreshInFlight: Promise<void> | null = null

  constructor(
    private readonly prisma: PrismaClient,
    opts?: { cacheTtlMs?: number },
  ) {
    this.cacheTtlMs = opts?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS
  }

  async hydrate(): Promise<void> {
    const rows = await this.prisma.agentStageTierSnapshot.findMany()
    this.cache.clear()
    for (const row of rows) {
      const mapped = this.toDomain(row)
      this.cache.set(mapped.agent_id, mapped)
    }
    this.lastHydratedAt = Date.now()
  }

  private scheduleRefreshIfStale(): void {
    if (this.refreshInFlight) return
    if (Date.now() - this.lastHydratedAt < this.cacheTtlMs) return
    this.refreshInFlight = this.hydrate()
      .catch((err) => console.error('[PgAgentStageTierSnapshotRepo] background refresh error:', err))
      .finally(() => { this.refreshInFlight = null })
  }

  async upsert(input: UpsertAgentStageTierSnapshotInput): Promise<AgentStageTierSnapshot> {
    const now = input.computed_at ?? new Date()
    const row = await this.prisma.agentStageTierSnapshot.upsert({
      where: { agentId: input.agent_id },
      create: {
        id: randomUUID(),
        agentId: input.agent_id,
        tier: input.tier,
        score: input.score,
        achievementPoints: input.achievement_points,
        chroniclePoints: input.chronicle_points,
        trustPenalty: input.trust_penalty,
        reasoningJson: input.reasoning as Prisma.InputJsonValue,
        computedAt: now,
        updatedAt: now,
      },
      update: {
        tier: input.tier,
        score: input.score,
        achievementPoints: input.achievement_points,
        chroniclePoints: input.chronicle_points,
        trustPenalty: input.trust_penalty,
        reasoningJson: input.reasoning as Prisma.InputJsonValue,
        computedAt: now,
        updatedAt: now,
      },
    })

    const snapshot = this.toDomain(row)
    this.cache.set(snapshot.agent_id, snapshot)
    return snapshot
  }

  findLatestByAgent(agentId: string): AgentStageTierSnapshot | null {
    this.scheduleRefreshIfStale()
    return this.cache.get(agentId) ?? null
  }

  findLatestByAgents(agentIds: string[]): Map<string, AgentStageTierSnapshot> {
    this.scheduleRefreshIfStale()
    const result = new Map<string, AgentStageTierSnapshot>()
    for (const id of agentIds) {
      const hit = this.cache.get(id)
      if (hit) result.set(id, hit)
    }
    return result
  }

  private toDomain(row: PrismaAgentStageTierSnapshot): AgentStageTierSnapshot {
    return {
      id: row.id,
      agent_id: row.agentId,
      tier: row.tier as AgentStageTierSnapshot['tier'],
      score: row.score,
      achievement_points: row.achievementPoints,
      chronicle_points: row.chroniclePoints,
      trust_penalty: row.trustPenalty,
      reasoning: row.reasoningJson as Record<string, unknown>,
      computed_at: row.computedAt,
      updated_at: row.updatedAt,
    }
  }
}
