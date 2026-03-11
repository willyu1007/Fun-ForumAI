import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type {
  CreateGuidanceEventLogInput,
  GuidanceActorType,
  GuidanceEventLogEntity,
} from '../types.js'
import type { GuidanceEventLogRepository } from '../guidance-event-log-repository.js'

type GuidanceEventLogTable = {
  findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>
  findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>
  create(args: Record<string, unknown>): Promise<Record<string, unknown>>
  deleteMany(args: Record<string, unknown>): Promise<unknown>
}

function toDomain(row: Record<string, unknown>): GuidanceEventLogEntity {
  return {
    id: String(row.id),
    actor_type: String(row.actorType) as GuidanceActorType,
    actor_id: String(row.actorId),
    event_type: String(row.eventType),
    dedup_key: typeof row.dedupKey === 'string' ? row.dedupKey : null,
    payload_json: (row.payloadJson as Record<string, unknown> | null) ?? null,
    created_at: row.createdAt instanceof Date ? row.createdAt : new Date(),
  }
}

export class PgGuidanceEventLogRepository implements GuidanceEventLogRepository {
  private readonly table: GuidanceEventLogTable

  constructor(prisma: PrismaClient) {
    this.table = (prisma as unknown as { guidanceEventLog: GuidanceEventLogTable }).guidanceEventLog
  }

  async findByDedupKey(actorType: GuidanceActorType, actorId: string, dedupKey: string): Promise<GuidanceEventLogEntity | null> {
    const row = await this.table.findFirst({
      where: {
        actorType,
        actorId,
        dedupKey,
      },
    })
    return row ? toDomain(row) : null
  }

  async listByActor(
    actorType: GuidanceActorType,
    actorId: string,
    opts?: { eventTypes?: string[]; createdAfter?: Date; limit?: number },
  ): Promise<GuidanceEventLogEntity[]> {
    const rows = await this.table.findMany({
      where: {
        actorType,
        actorId,
        ...(opts?.eventTypes ? { eventType: { in: opts.eventTypes } } : {}),
        ...(opts?.createdAfter ? { createdAt: { gte: opts.createdAfter } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      ...(typeof opts?.limit === 'number' ? { take: opts.limit } : {}),
    })
    return rows.map(toDomain)
  }

  async listAll(opts?: {
    actorType?: GuidanceActorType
    eventTypes?: string[]
    createdAfter?: Date
    limit?: number
  }): Promise<GuidanceEventLogEntity[]> {
    const rows = await this.table.findMany({
      where: {
        ...(opts?.actorType ? { actorType: opts.actorType } : {}),
        ...(opts?.eventTypes ? { eventType: { in: opts.eventTypes } } : {}),
        ...(opts?.createdAfter ? { createdAt: { gte: opts.createdAfter } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      ...(typeof opts?.limit === 'number' ? { take: opts.limit } : {}),
    })
    return rows.map(toDomain)
  }

  async create(input: CreateGuidanceEventLogInput): Promise<GuidanceEventLogEntity> {
    const row = await this.table.create({
      data: {
        id: randomUUID(),
        actorType: input.actor_type,
        actorId: input.actor_id,
        eventType: input.event_type,
        dedupKey: input.dedup_key ?? null,
        payloadJson: input.payload_json ?? null,
      },
    })
    return toDomain(row)
  }

  async deleteByActor(actorType: GuidanceActorType, actorId: string): Promise<void> {
    await this.table.deleteMany({
      where: {
        actorType,
        actorId,
      },
    })
  }
}
