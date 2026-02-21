import type {
  DomainEvent,
  AgentRun,
  CreateEventInput,
  CreateAgentRunInput,
  PaginatedResult,
  PaginationOpts,
} from './types.js'

export interface EventRepository {
  create(input: CreateEventInput): DomainEvent
  findById(id: string): DomainEvent | null
  findByIdempotencyKey(key: string): DomainEvent | null
}

export interface AgentRunRepository {
  create(input: CreateAgentRunInput): AgentRun
  findById(id: string): AgentRun | null
  findByAgent(agentId: string, opts: PaginationOpts): PaginatedResult<AgentRun>
  findByEvent(eventId: string): AgentRun[]
}

let counter = 0
function cuid(prefix: string): string {
  return `${prefix}_${Date.now()}_${++counter}`
}

export class InMemoryEventRepository implements EventRepository {
  private store = new Map<string, DomainEvent>()
  private idempotencyIndex = new Map<string, string>()

  create(input: CreateEventInput): DomainEvent {
    if (input.idempotency_key) {
      const existing = this.idempotencyIndex.get(input.idempotency_key)
      if (existing) return this.store.get(existing)!
    }

    const event: DomainEvent = {
      id: cuid('evt'),
      event_type: input.event_type,
      payload_json: input.payload_json,
      idempotency_key: input.idempotency_key ?? null,
      created_at: new Date(),
    }
    this.store.set(event.id, event)
    if (event.idempotency_key) {
      this.idempotencyIndex.set(event.idempotency_key, event.id)
    }
    return event
  }

  findById(id: string): DomainEvent | null {
    return this.store.get(id) ?? null
  }

  findByIdempotencyKey(key: string): DomainEvent | null {
    const id = this.idempotencyIndex.get(key)
    if (!id) return null
    return this.store.get(id) ?? null
  }
}

export class InMemoryAgentRunRepository implements AgentRunRepository {
  private store = new Map<string, AgentRun>()

  create(input: CreateAgentRunInput): AgentRun {
    const run: AgentRun = {
      id: cuid('run'),
      agent_id: input.agent_id,
      trigger_event_id: input.trigger_event_id,
      input_digest: input.input_digest,
      output_json: input.output_json ?? null,
      moderation_result: input.moderation_result ?? null,
      token_cost: input.token_cost ?? 0,
      latency_ms: input.latency_ms ?? 0,
      created_at: new Date(),
    }
    this.store.set(run.id, run)
    return run
  }

  findById(id: string): AgentRun | null {
    return this.store.get(id) ?? null
  }

  findByAgent(agentId: string, opts: PaginationOpts): PaginatedResult<AgentRun> {
    const items = Array.from(this.store.values())
      .filter((r) => r.agent_id === agentId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return paginate(items, opts)
  }

  findByEvent(eventId: string): AgentRun[] {
    return Array.from(this.store.values()).filter((r) => r.trigger_event_id === eventId)
  }
}

function paginate<T extends { id: string }>(
  items: T[],
  opts: PaginationOpts,
): PaginatedResult<T> {
  let start = 0
  if (opts.cursor) {
    const idx = items.findIndex((i) => i.id === opts.cursor)
    start = idx >= 0 ? idx + 1 : 0
  }
  const page = items.slice(start, start + opts.limit)
  const next_cursor = page.length === opts.limit && start + opts.limit < items.length
    ? page[page.length - 1].id
    : null
  return { items: page, next_cursor }
}
