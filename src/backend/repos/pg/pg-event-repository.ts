import { randomUUID } from 'node:crypto'
import {
  Prisma,
  type PrismaClient,
  type EventActorType as PrismaEventActorType,
  type EventPlane as PrismaEventPlane,
  type Event as PrismaEvent,
  type AgentRun as PrismaAgentRun,
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

// Tracks in-flight event writes so dependent agent_run inserts can wait
// for FK target persistence in the same process.
const pendingEventWrites = new Map<string, Promise<void>>()

export function toPrismaPlane(plane: DomainEvent['plane']): PrismaEventPlane {
  switch (plane) {
    case 'CONTROL':
      return 'CONTROL'
    case 'RUNTIME':
      return 'RUNTIME'
    default:
      return 'DATA'
  }
}

export function toPrismaActorType(actorType: DomainEvent['actor_type']): PrismaEventActorType {
  switch (actorType) {
    case 'agent':
      return 'AGENT'
    case 'human':
      return 'HUMAN'
    default:
      return 'SYSTEM'
  }
}

export function toDomainActorType(actorType: PrismaEventActorType): DomainEvent['actor_type'] {
  switch (actorType) {
    case 'AGENT':
      return 'agent'
    case 'HUMAN':
      return 'human'
    default:
      return 'system'
  }
}

export class PgEventRepository implements EventRepository {
  private cache = new Map<string, DomainEvent>()
  private idempotencyIndex = new Map<string, string>()

  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {
    const rows = await this.prisma.event.findMany()
    for (const row of rows) {
      this.rememberPersisted(this.toDomain(row))
    }
  }

  create(input: CreateEventInput): DomainEvent {
    if (input.idempotency_key) {
      const existingId = this.idempotencyIndex.get(input.idempotency_key)
      if (existingId) return this.cache.get(existingId)!
    }

    const id = input.id ?? randomUUID()
    const now = new Date()
    const event: DomainEvent = {
      id,
      event_type: input.event_type,
      plane: input.plane ?? 'DATA',
      schema_version: input.schema_version ?? 'v1',
      community_id: input.community_id ?? null,
      post_id: input.post_id ?? null,
      room_id: input.room_id ?? null,
      actor_type: input.actor_type ?? 'system',
      actor_id: input.actor_id ?? null,
      cause_event_id: input.cause_event_id ?? null,
      correlation_id: input.correlation_id ?? null,
      payload_json: input.payload_json,
      idempotency_key: input.idempotency_key ?? null,
      created_at: now,
    }
    this.rememberPersisted(event)
    const persistPromise = this.prisma.event
      .create({
        data: {
          id,
          eventType: event.event_type,
          plane: toPrismaPlane(event.plane),
          schemaVersion: event.schema_version,
          communityId: event.community_id,
          postId: event.post_id,
          roomId: event.room_id,
          actorType: toPrismaActorType(event.actor_type),
          actorId: event.actor_id,
          causeEventId: event.cause_event_id,
          correlationId: event.correlation_id,
          payloadJson: event.payload_json as Prisma.InputJsonValue,
          idempotencyKey: event.idempotency_key,
          createdAt: now,
        },
      })
      .then(() => undefined)
      .catch((err) => {
        console.error('[PgEventRepo] create error:', err)
        throw err
      })
      .finally(() => {
        pendingEventWrites.delete(id)
      })

    pendingEventWrites.set(id, persistPromise)
    void persistPromise.catch(() => undefined)
    return event
  }

  findById(id: string): DomainEvent | null {
    return this.cache.get(id) ?? null
  }

  delete(id: string): void {
    const event = this.cache.get(id)
    if (!event) return
    this.cache.delete(id)
    if (event.idempotency_key) {
      this.idempotencyIndex.delete(event.idempotency_key)
    }
    pendingEventWrites.delete(id)
    void this.prisma.event.deleteMany({ where: { id } }).catch((err) => {
      console.error('[PgEventRepo] delete error:', err)
    })
  }

  findByIdempotencyKey(key: string): DomainEvent | null {
    const id = this.idempotencyIndex.get(key)
    if (!id) return null
    return this.cache.get(id) ?? null
  }

  findByPostId(postId: string): DomainEvent[] {
    return Array.from(this.cache.values())
      .filter((event) => event.post_id === postId)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
  }

  rememberPersisted(event: DomainEvent): void {
    this.cache.set(event.id, event)
    if (event.idempotency_key) {
      this.idempotencyIndex.set(event.idempotency_key, event.id)
    }
  }

  static toDomain(row: PrismaEvent): DomainEvent {
    return {
      id: row.id,
      event_type: row.eventType,
      plane: row.plane,
      schema_version: row.schemaVersion as 'v1',
      community_id: row.communityId,
      post_id: row.postId,
      room_id: row.roomId,
      actor_type: toDomainActorType(row.actorType),
      actor_id: row.actorId,
      cause_event_id: row.causeEventId,
      correlation_id: row.correlationId,
      payload_json: row.payloadJson as Record<string, unknown>,
      idempotency_key: row.idempotencyKey,
      created_at: row.createdAt,
    }
  }

  private toDomain(row: PrismaEvent): DomainEvent {
    return PgEventRepository.toDomain(row)
  }
}

export class PgAgentRunRepository implements AgentRunRepository {
  private cache = new Map<string, AgentRun>()

  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {
    const rows = await this.prisma.agentRun.findMany()
    for (const row of rows) {
      this.rememberPersisted(this.toDomain(row))
    }
  }

  create(input: CreateAgentRunInput): AgentRun {
    const id = input.id ?? randomUUID()
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
    this.rememberPersisted(run)

    const persistRun = () =>
      this.prisma.agentRun
        .create({
          data: {
            id,
            agentId: run.agent_id,
            triggerEventId: run.trigger_event_id,
            inputDigest: run.input_digest,
            outputJson:
              run.output_json === null
                ? Prisma.DbNull
                : (run.output_json as Prisma.InputJsonValue),
            moderationResult: run.moderation_result,
            tokenCost: run.token_cost,
            latencyMs: run.latency_ms,
            createdAt: now,
          },
        })
        .catch((err) => console.error('[PgAgentRunRepo] create error:', err))

    const pendingEventPersist = pendingEventWrites.get(run.trigger_event_id)
    if (pendingEventPersist) {
      void pendingEventPersist
        .then(() => persistRun())
        .catch((err) => {
          console.error(
            '[PgAgentRunRepo] skipped create because trigger event persistence failed:',
            err,
          )
        })
    } else {
      void persistRun()
    }
    return run
  }

  findById(id: string): AgentRun | null {
    return this.cache.get(id) ?? null
  }

  delete(id: string): void {
    this.cache.delete(id)
    void this.prisma.agentRun.deleteMany({ where: { id } }).catch((err) => {
      console.error('[PgAgentRunRepo] delete error:', err)
    })
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

  rememberPersisted(run: AgentRun): void {
    this.cache.set(run.id, run)
  }

  static toDomain(row: PrismaAgentRun): AgentRun {
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

  private toDomain(row: PrismaAgentRun): AgentRun {
    return PgAgentRunRepository.toDomain(row)
  }
}
