import type {
  AgentStatEvent as PrismaAgentStatEvent,
  AgentState as PrismaAgentState,
  AgentStats as PrismaAgentStats,
  Prisma,
  PrismaClient,
} from '@prisma/client'
import type {
  AgentState,
  AgentStatePoint,
  AgentStatEvent,
  AgentStats,
  CreateAgentStatEventInput,
  PaginatedResult,
  PaginationOpts,
  SaveAgentStateInput,
  SaveAgentStatsInput,
} from '../types.js'
import type { StatsRepository } from '../stats-repository.js'

export class PgStatsRepository implements StatsRepository {
  private readonly statsCache = new Map<string, AgentStats>()
  private readonly stateCache = new Map<string, AgentState>()

  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {
    const [statsRows, stateRows] = await Promise.all([
      this.prisma.agentStats.findMany(),
      this.prisma.agentState.findMany(),
    ])

    for (const row of statsRows) {
      this.statsCache.set(row.agentId, this.statsToDomain(row))
    }

    for (const row of stateRows) {
      this.stateCache.set(row.agentId, this.stateToDomain(row))
    }
  }

  async getOrCreateStats(agentId: string): Promise<AgentStats> {
    const cached = this.statsCache.get(agentId)
    if (cached) return cached

    const row = await this.prisma.agentStats.upsert({
      where: { agentId },
      create: { agentId },
      update: {},
    })

    const domain = this.statsToDomain(row)
    this.statsCache.set(agentId, domain)
    return domain
  }

  getCachedStats(agentId: string): AgentStats | null {
    return this.statsCache.get(agentId) ?? null
  }

  async saveStats(input: SaveAgentStatsInput): Promise<AgentStats | null> {
    const updated = await this.prisma.agentStats.updateMany({
      where: {
        agentId: input.agent_id,
        version: input.expected_version,
      },
      data: {
        unspentPoints: input.unspent_points,
        sociability: input.sociability,
        curiosity: input.curiosity,
        assertiveness: input.assertiveness,
        empathy: input.empathy,
        brashness: input.brashness,
        cynicism: input.cynicism,
        stubbornness: input.stubbornness,
        volatility: input.volatility,
        memory: input.memory,
        learning: input.learning,
        version: { increment: 1 },
      },
    })

    if (updated.count === 0) {
      return null
    }

    const latest = await this.prisma.agentStats.findUnique({ where: { agentId: input.agent_id } })
    if (!latest) return null

    const domain = this.statsToDomain(latest)
    this.statsCache.set(input.agent_id, domain)
    return domain
  }

  async getOrCreateState(agentId: string): Promise<AgentState> {
    const cached = this.stateCache.get(agentId)
    if (cached) return cached

    const row = await this.prisma.agentState.upsert({
      where: { agentId },
      create: { agentId },
      update: {},
    })

    const domain = this.stateToDomain(row)
    this.stateCache.set(agentId, domain)
    return domain
  }

  getCachedState(agentId: string): AgentState | null {
    return this.stateCache.get(agentId) ?? null
  }

  async saveState(input: SaveAgentStateInput): Promise<AgentState> {
    const row = await this.prisma.agentState.upsert({
      where: { agentId: input.agent_id },
      create: {
        agentId: input.agent_id,
        valence: input.valence,
        arousal: input.arousal,
        confidence: input.confidence,
        irritability: input.irritability,
        fatigue: input.fatigue,
        lastUpdatedAt: new Date(),
      },
      update: {
        valence: input.valence,
        arousal: input.arousal,
        confidence: input.confidence,
        irritability: input.irritability,
        fatigue: input.fatigue,
        lastUpdatedAt: new Date(),
      },
    })

    const domain = this.stateToDomain(row)
    this.stateCache.set(input.agent_id, domain)
    return domain
  }

  async createEvent(input: CreateAgentStatEventInput): Promise<{ event: AgentStatEvent; deduped: boolean }> {
    try {
      const row = await this.prisma.agentStatEvent.create({
        data: {
          agentId: input.agent_id,
          eventType: input.event_type,
          source: input.source,
          idempotencyKey: input.idempotency_key ?? null,
          deltaJson: input.delta_json as Prisma.InputJsonValue,
        },
      })
      return { event: this.eventToDomain(row), deduped: false }
    } catch (err) {
      if (!input.idempotency_key || !isUniqueConstraintError(err)) {
        throw err
      }

      const row = await this.prisma.agentStatEvent.findUnique({
        where: { idempotencyKey: input.idempotency_key },
      })
      if (!row) throw err

      return { event: this.eventToDomain(row), deduped: true }
    }
  }

  async findEventByIdempotencyKey(agentId: string, idempotencyKey: string): Promise<AgentStatEvent | null> {
    const row = await this.prisma.agentStatEvent.findUnique({ where: { idempotencyKey } })
    if (!row || row.agentId !== agentId) return null
    return this.eventToDomain(row)
  }

  async listEvents(agentId: string, opts: PaginationOpts): Promise<PaginatedResult<AgentStatEvent>> {
    const rows = await this.prisma.agentStatEvent.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: opts.limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
    })

    const hasMore = rows.length > opts.limit
    const slice = hasMore ? rows.slice(0, opts.limit) : rows

    return {
      items: slice.map((row) => this.eventToDomain(row)),
      next_cursor: hasMore ? slice[slice.length - 1].id : null,
    }
  }

  async listStateTimeline(agentId: string, since: Date, limit: number): Promise<AgentStatePoint[]> {
    const rows = await this.prisma.agentStatEvent.findMany({
      where: {
        agentId,
        eventType: 'STATE_UPDATED',
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, limit),
    })

    if (rows.length === 0) {
      const state = await this.getOrCreateState(agentId)
      return [{
        at: state.last_updated_at,
        valence: state.valence,
        arousal: state.arousal,
        confidence: state.confidence,
        irritability: state.irritability,
        fatigue: state.fatigue,
      }]
    }

    return rows
      .reverse()
      .map((row) => {
        const payload = toJsonObjectOrEmpty(row.deltaJson)
        const after = toJsonObjectOrEmpty(payload.state_after)
        return {
          at: row.createdAt,
          valence: toNumber(after.valence),
          arousal: toNumber(after.arousal),
          confidence: toNumber(after.confidence),
          irritability: toNumber(after.irritability),
          fatigue: toNumber(after.fatigue),
        }
      })
  }

  private statsToDomain(row: PrismaAgentStats): AgentStats {
    return {
      agent_id: row.agentId,
      unspent_points: row.unspentPoints,
      sociability: row.sociability,
      curiosity: row.curiosity,
      assertiveness: row.assertiveness,
      empathy: row.empathy,
      brashness: row.brashness,
      cynicism: row.cynicism,
      stubbornness: row.stubbornness,
      volatility: row.volatility,
      memory: row.memory,
      learning: row.learning,
      version: row.version,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private stateToDomain(row: PrismaAgentState): AgentState {
    return {
      agent_id: row.agentId,
      valence: row.valence,
      arousal: row.arousal,
      confidence: row.confidence,
      irritability: row.irritability,
      fatigue: row.fatigue,
      last_updated_at: row.lastUpdatedAt,
    }
  }

  private eventToDomain(row: PrismaAgentStatEvent): AgentStatEvent {
    return {
      id: row.id,
      agent_id: row.agentId,
      event_type: row.eventType,
      source: row.source,
      idempotency_key: row.idempotencyKey,
      delta_json: toJsonObjectOrEmpty(row.deltaJson),
      created_at: row.createdAt,
    }
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002',
  )
}

function toJsonObjectOrEmpty(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function toNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
