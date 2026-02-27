import type {
  AgentRelation,
  AgentRelationEvent,
  CreateAgentRelationEventInput,
  UpsertAgentRelationInput,
  PaginatedResult,
  PaginationOpts,
  RelationState,
} from './types.js'

export interface RelationRepository {
  createEvent(input: CreateAgentRelationEventInput): Promise<{ event: AgentRelationEvent; deduped: boolean }>
  getRelation(fromAgentId: string, toAgentId: string): Promise<AgentRelation | null>
  upsertRelation(input: UpsertAgentRelationInput): Promise<AgentRelation>
  listOutgoing(
    agentId: string,
    opts: PaginationOpts & { state?: RelationState },
  ): Promise<PaginatedResult<AgentRelation>>
  listIncoming(
    agentId: string,
    opts: PaginationOpts & { state?: RelationState },
  ): Promise<PaginatedResult<AgentRelation>>
  listMutualEffective(
    agentId: string,
    opts: PaginationOpts,
  ): Promise<PaginatedResult<AgentRelation>>
  countOutgoingByStates(agentId: string, states: RelationState[]): Promise<number>
  countIncomingByStates(agentId: string, states: RelationState[]): Promise<number>
  countMutualEffective(agentId: string): Promise<number>
  listPairEvents(
    fromAgentId: string,
    toAgentId: string,
    opts: {
      since?: Date
      severity?: 'info' | 'warning' | 'severe'
      event_type?: string
      limit: number
    },
  ): Promise<AgentRelationEvent[]>
  listRelationsByStates(
    states: RelationState[],
    limit: number,
  ): Promise<AgentRelation[]>
}

let counter = 0
function cuid(prefix: string): string {
  return `${prefix}_${Date.now()}_${++counter}`
}

export class InMemoryRelationRepository implements RelationRepository {
  private relations = new Map<string, AgentRelation>()
  private events = new Map<string, AgentRelationEvent>()
  private eventDedup = new Map<string, string>()

  async createEvent(input: CreateAgentRelationEventInput): Promise<{ event: AgentRelationEvent; deduped: boolean }> {
    const existingId = this.eventDedup.get(input.idempotency_key)
    if (existingId) {
      return {
        event: this.events.get(existingId)!,
        deduped: true,
      }
    }

    const event: AgentRelationEvent = {
      id: cuid('rel_evt'),
      from_agent_id: input.from_agent_id,
      to_agent_id: input.to_agent_id,
      event_type: input.event_type,
      severity: input.severity ?? 'info',
      source_type: input.source_type,
      source_ref_id: input.source_ref_id ?? null,
      idempotency_key: input.idempotency_key,
      payload: input.payload ?? null,
      created_at: new Date(),
    }

    this.events.set(event.id, event)
    this.eventDedup.set(event.idempotency_key, event.id)
    return { event, deduped: false }
  }

  async getRelation(fromAgentId: string, toAgentId: string): Promise<AgentRelation | null> {
    return this.relations.get(this.key(fromAgentId, toAgentId)) ?? null
  }

  async upsertRelation(input: UpsertAgentRelationInput): Promise<AgentRelation> {
    const key = this.key(input.from_agent_id, input.to_agent_id)
    const existing = this.relations.get(key)
    if (existing && input.expected_version !== undefined && existing.version !== input.expected_version) {
      return existing
    }

    const now = new Date()
    const next: AgentRelation = {
      id: existing?.id ?? cuid('rel'),
      from_agent_id: input.from_agent_id,
      to_agent_id: input.to_agent_id,
      state: input.state,
      relation_score: input.relation_score,
      interaction_score: input.interaction_score,
      persona_score: input.persona_score,
      safety_score: input.safety_score,
      shadow_started_at: input.shadow_started_at ?? existing?.shadow_started_at ?? null,
      effective_at: input.effective_at ?? existing?.effective_at ?? null,
      inactive_at: input.inactive_at ?? existing?.inactive_at ?? null,
      blocked_at: input.blocked_at ?? existing?.blocked_at ?? null,
      below_threshold_since: input.below_threshold_since ?? existing?.below_threshold_since ?? null,
      last_signal_at: input.last_signal_at ?? existing?.last_signal_at ?? null,
      last_interaction_at: input.last_interaction_at ?? existing?.last_interaction_at ?? null,
      last_evaluated_at: input.last_evaluated_at ?? existing?.last_evaluated_at ?? null,
      last_state_changed_at: input.last_state_changed_at ?? existing?.last_state_changed_at ?? null,
      version: (existing?.version ?? 0) + 1,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    }

    this.relations.set(key, next)
    return next
  }

  async listOutgoing(
    agentId: string,
    opts: PaginationOpts & { state?: RelationState },
  ): Promise<PaginatedResult<AgentRelation>> {
    const rows = Array.from(this.relations.values())
      .filter((r) => r.from_agent_id === agentId)
      .filter((r) => (opts.state ? r.state === opts.state : true))
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
    return paginate(rows, opts)
  }

  async listIncoming(
    agentId: string,
    opts: PaginationOpts & { state?: RelationState },
  ): Promise<PaginatedResult<AgentRelation>> {
    const rows = Array.from(this.relations.values())
      .filter((r) => r.to_agent_id === agentId)
      .filter((r) => (opts.state ? r.state === opts.state : true))
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
    return paginate(rows, opts)
  }

  async listMutualEffective(
    agentId: string,
    opts: PaginationOpts,
  ): Promise<PaginatedResult<AgentRelation>> {
    const outgoing = Array.from(this.relations.values())
      .filter((r) => r.from_agent_id === agentId && r.state === 'effective')
    const incomingSet = new Set(
      Array.from(this.relations.values())
        .filter((r) => r.to_agent_id === agentId && r.state === 'effective')
        .map((r) => r.from_agent_id),
    )

    const rows = outgoing
      .filter((r) => incomingSet.has(r.to_agent_id))
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())

    return paginate(rows, opts)
  }

  async countOutgoingByStates(agentId: string, states: RelationState[]): Promise<number> {
    const set = new Set(states)
    return Array.from(this.relations.values()).filter((r) => r.from_agent_id === agentId && set.has(r.state)).length
  }

  async countIncomingByStates(agentId: string, states: RelationState[]): Promise<number> {
    const set = new Set(states)
    return Array.from(this.relations.values()).filter((r) => r.to_agent_id === agentId && set.has(r.state)).length
  }

  async countMutualEffective(agentId: string): Promise<number> {
    const outgoing = new Set(
      Array.from(this.relations.values())
        .filter((r) => r.from_agent_id === agentId && r.state === 'effective')
        .map((r) => r.to_agent_id),
    )
    const incoming = new Set(
      Array.from(this.relations.values())
        .filter((r) => r.to_agent_id === agentId && r.state === 'effective')
        .map((r) => r.from_agent_id),
    )
    let count = 0
    for (const id of outgoing) {
      if (incoming.has(id)) count++
    }
    return count
  }

  async listPairEvents(
    fromAgentId: string,
    toAgentId: string,
    opts: {
      since?: Date
      severity?: 'info' | 'warning' | 'severe'
      event_type?: string
      limit: number
    },
  ): Promise<AgentRelationEvent[]> {
    return Array.from(this.events.values())
      .filter((e) => e.from_agent_id === fromAgentId && e.to_agent_id === toAgentId)
      .filter((e) => (opts.since ? e.created_at >= opts.since : true))
      .filter((e) => (opts.severity ? e.severity === opts.severity : true))
      .filter((e) => (opts.event_type ? e.event_type === opts.event_type : true))
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, opts.limit)
  }

  async listRelationsByStates(states: RelationState[], limit: number): Promise<AgentRelation[]> {
    const set = new Set(states)
    return Array.from(this.relations.values())
      .filter((r) => set.has(r.state))
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
      .slice(0, limit)
  }

  private key(fromAgentId: string, toAgentId: string): string {
    return `${fromAgentId}:${toAgentId}`
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
