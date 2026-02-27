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
} from './types.js'

export interface StatsRepository {
  hydrate?(): Promise<void>
  getOrCreateStats(agentId: string): Promise<AgentStats>
  getCachedStats(agentId: string): AgentStats | null
  saveStats(input: SaveAgentStatsInput): Promise<AgentStats | null>

  getOrCreateState(agentId: string): Promise<AgentState>
  getCachedState(agentId: string): AgentState | null
  saveState(input: SaveAgentStateInput): Promise<AgentState>

  createEvent(input: CreateAgentStatEventInput): Promise<{ event: AgentStatEvent; deduped: boolean }>
  findEventByIdempotencyKey(agentId: string, idempotencyKey: string): Promise<AgentStatEvent | null>
  listEvents(agentId: string, opts: PaginationOpts): Promise<PaginatedResult<AgentStatEvent>>
  listStateTimeline(agentId: string, since: Date, limit: number): Promise<AgentStatePoint[]>
}

let counter = 0
function cuid(prefix: string): string {
  return `${prefix}_${Date.now()}_${++counter}`
}

function defaultStats(agentId: string): AgentStats {
  const now = new Date()
  return {
    agent_id: agentId,
    unspent_points: 0,
    sociability: 0,
    curiosity: 0,
    assertiveness: 0,
    empathy: 0,
    brashness: 0,
    cynicism: 0,
    stubbornness: 0,
    volatility: 0,
    memory: 30,
    learning: 30,
    version: 1,
    created_at: now,
    updated_at: now,
  }
}

function defaultState(agentId: string): AgentState {
  const now = new Date()
  return {
    agent_id: agentId,
    valence: 0,
    arousal: 0,
    confidence: 0,
    irritability: 0,
    fatigue: 0,
    last_updated_at: now,
  }
}

export class InMemoryStatsRepository implements StatsRepository {
  private readonly stats = new Map<string, AgentStats>()
  private readonly states = new Map<string, AgentState>()
  private readonly events = new Map<string, AgentStatEvent>()
  private readonly eventDedup = new Map<string, string>()

  async getOrCreateStats(agentId: string): Promise<AgentStats> {
    const existing = this.stats.get(agentId)
    if (existing) return existing

    const created = defaultStats(agentId)
    this.stats.set(agentId, created)
    return created
  }

  getCachedStats(agentId: string): AgentStats | null {
    return this.stats.get(agentId) ?? null
  }

  async saveStats(input: SaveAgentStatsInput): Promise<AgentStats | null> {
    const existing = await this.getOrCreateStats(input.agent_id)
    if (existing.version !== input.expected_version) {
      return null
    }

    const next: AgentStats = {
      ...existing,
      unspent_points: input.unspent_points,
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
      version: existing.version + 1,
      updated_at: new Date(),
    }

    this.stats.set(input.agent_id, next)
    return next
  }

  async getOrCreateState(agentId: string): Promise<AgentState> {
    const existing = this.states.get(agentId)
    if (existing) return existing

    const created = defaultState(agentId)
    this.states.set(agentId, created)
    return created
  }

  getCachedState(agentId: string): AgentState | null {
    return this.states.get(agentId) ?? null
  }

  async saveState(input: SaveAgentStateInput): Promise<AgentState> {
    const existing = await this.getOrCreateState(input.agent_id)
    const next: AgentState = {
      ...existing,
      valence: input.valence,
      arousal: input.arousal,
      confidence: input.confidence,
      irritability: input.irritability,
      fatigue: input.fatigue,
      last_updated_at: new Date(),
    }

    this.states.set(input.agent_id, next)
    return next
  }

  async createEvent(input: CreateAgentStatEventInput): Promise<{ event: AgentStatEvent; deduped: boolean }> {
    if (input.idempotency_key) {
      const dedupId = this.eventDedup.get(`${input.agent_id}:${input.idempotency_key}`)
      if (dedupId) {
        return { event: this.events.get(dedupId)!, deduped: true }
      }
    }

    const event: AgentStatEvent = {
      id: cuid('stat_evt'),
      agent_id: input.agent_id,
      event_type: input.event_type,
      source: input.source,
      idempotency_key: input.idempotency_key ?? null,
      delta_json: input.delta_json,
      created_at: new Date(),
    }

    this.events.set(event.id, event)
    if (event.idempotency_key) {
      this.eventDedup.set(`${event.agent_id}:${event.idempotency_key}`, event.id)
    }
    return { event, deduped: false }
  }

  async findEventByIdempotencyKey(agentId: string, idempotencyKey: string): Promise<AgentStatEvent | null> {
    const id = this.eventDedup.get(`${agentId}:${idempotencyKey}`)
    if (!id) return null
    return this.events.get(id) ?? null
  }

  async listEvents(agentId: string, opts: PaginationOpts): Promise<PaginatedResult<AgentStatEvent>> {
    const items = Array.from(this.events.values())
      .filter((event) => event.agent_id === agentId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())

    return paginate(items, opts)
  }

  async listStateTimeline(agentId: string, since: Date, limit: number): Promise<AgentStatePoint[]> {
    const stateEvents = Array.from(this.events.values())
      .filter((event) => event.agent_id === agentId)
      .filter((event) => event.event_type === 'STATE_UPDATED')
      .filter((event) => event.created_at >= since)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
      .slice(-limit)

    const points: AgentStatePoint[] = stateEvents
      .map((event) => {
        const payload = event.delta_json
        const after = payload.state_after as Record<string, unknown> | undefined
        if (!after) return null

        return {
          at: event.created_at,
          valence: Number(after.valence ?? 0),
          arousal: Number(after.arousal ?? 0),
          confidence: Number(after.confidence ?? 0),
          irritability: Number(after.irritability ?? 0),
          fatigue: Number(after.fatigue ?? 0),
        }
      })
      .filter((item): item is AgentStatePoint => item !== null)

    if (points.length === 0) {
      const current = await this.getOrCreateState(agentId)
      return [{
        at: current.last_updated_at,
        valence: current.valence,
        arousal: current.arousal,
        confidence: current.confidence,
        irritability: current.irritability,
        fatigue: current.fatigue,
      }]
    }

    return points
  }
}

function paginate<T extends { id: string }>(items: T[], opts: PaginationOpts): PaginatedResult<T> {
  let start = 0
  if (opts.cursor) {
    const idx = items.findIndex((item) => item.id === opts.cursor)
    start = idx >= 0 ? idx + 1 : 0
  }

  const page = items.slice(start, start + opts.limit)
  const next_cursor = page.length === opts.limit && start + opts.limit < items.length
    ? page[page.length - 1].id
    : null

  return { items: page, next_cursor }
}
