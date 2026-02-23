import { randomUUID } from 'node:crypto'
import type {
  PrismaClient,
  Event as PrismaEvent,
  AgentRun as PrismaAgentRun,
} from '@prisma/client'
import type {
  DomainEvent,
  AgentRun,
  CreateEventInput,
  CreateAgentRunInput,
  PaginatedResult,
  PaginationOpts,
} from '../types.js'
import type { EventRepository, AgentRunRepository } from '../event-repository.js'

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
  const next_cursor =
    page.length === opts.limit && start + opts.limit < items.length
      ? page[page.length - 1].id
      : null
  return { items: page, next_cursor }
}

export class PgEventRepository implements EventRepository {
  private cache = new Map<string, DomainEvent>()
  private idempotencyIndex = new Map<string, string>()

  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {
    const rows = await this.prisma.event.findMany()
    for (const row of rows) {
      const event = this.toDomain(row)
      this.cache.set(event.id, event)
      if (event.idempotency_key) {
        this.idempotencyIndex.set(event.idempotency_key, event.id)
      }
    }
  }

  create(input: CreateEventInput): DomainEvent {
    if (input.idempotency_key) {
      const existingId = this.idempotencyIndex.get(input.idempotency_key)
      if (existingId) return this.cache.get(existingId)!
    }

    const id = randomUUID()
    const now = new Date()
    const event: DomainEvent = {
      id,
      event_type: input.event_type,
      payload_json: input.payload_json,
      idempotency_key: input.idempotency_key ?? null,
      created_at: now,
    }
    this.cache.set(id, event)
    if (event.idempotency_key) {
      this.idempotencyIndex.set(event.idempotency_key, id)
    }
    this.prisma.event
      .create({
        data: {
          id,
          eventType: event.event_type,
          payloadJson: event.payload_json,
          idempotencyKey: event.idempotency_key,
          createdAt: now,
        },
      })
      .catch((err) => console.error('[PgEventRepo] create error:', err))
    return event
  }

  findById(id: string): DomainEvent | null {
    return this.cache.get(id) ?? null
  }

  findByIdempotencyKey(key: string): DomainEvent | null {
    const id = this.idempotencyIndex.get(key)
    if (!id) return null
    return this.cache.get(id) ?? null
  }

  private toDomain(row: PrismaEvent): DomainEvent {
    return {
      id: row.id,
      event_type: row.eventType,
      payload_json: row.payloadJson as Record<string, unknown>,
      idempotency_key: row.idempotencyKey,
      created_at: row.createdAt,
    }
  }
}

export class PgAgentRunRepository implements AgentRunRepository {
  private cache = new Map<string, AgentRun>()

  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {
    const rows = await this.prisma.agentRun.findMany()
    for (const row of rows) {
      this.cache.set(row.id, this.toDomain(row))
    }
  }

  create(input: CreateAgentRunInput): AgentRun {
    const id = randomUUID()
    const now = new Date()
    const run: AgentRun = {
      id,
      agent_id: input.agent_id,
      trigger_event_id: input.trigger_event_id,
      input_digest: input.input_digest,
      output_json: input.output_json ?? null,
      moderation_result: input.moderation_result ?? null,
      token_cost: input.token_cost ?? 0,
      latency_ms: input.latency_ms ?? 0,
      created_at: now,
    }
    this.cache.set(id, run)
    this.prisma.agentRun
      .create({
        data: {
          id,
          agentId: run.agent_id,
          triggerEventId: run.trigger_event_id,
          inputDigest: run.input_digest,
          outputJson: run.output_json,
          moderationResult: run.moderation_result,
          tokenCost: run.token_cost,
          latencyMs: run.latency_ms,
          createdAt: now,
        },
      })
      .catch((err) => console.error('[PgAgentRunRepo] create error:', err))
    return run
  }

  findById(id: string): AgentRun | null {
    return this.cache.get(id) ?? null
  }

  findByAgent(agentId: string, opts: PaginationOpts): PaginatedResult<AgentRun> {
    const items = Array.from(this.cache.values())
      .filter((r) => r.agent_id === agentId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return paginate(items, opts)
  }

  findByEvent(eventId: string): AgentRun[] {
    return Array.from(this.cache.values()).filter((r) => r.trigger_event_id === eventId)
  }

  private toDomain(row: PrismaAgentRun): AgentRun {
    return {
      id: row.id,
      agent_id: row.agentId,
      trigger_event_id: row.triggerEventId,
      input_digest: row.inputDigest,
      output_json: row.outputJson as Record<string, unknown> | null,
      moderation_result: row.moderationResult,
      token_cost: row.tokenCost,
      latency_ms: row.latencyMs,
      created_at: row.createdAt,
    }
  }
}
