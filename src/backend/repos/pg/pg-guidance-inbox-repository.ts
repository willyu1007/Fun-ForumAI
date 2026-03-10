import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type {
  GuidanceActorType,
  GuidanceInboxItemEntity,
  GuidanceInboxStatus,
  UpdateGuidanceInboxItemInput,
  UpsertGuidanceInboxItemInput,
} from '../types.js'
import type { GuidanceInboxRepository } from '../guidance-inbox-repository.js'

type GuidanceInboxTable = {
  findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>
  findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>
  findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>
  create(args: Record<string, unknown>): Promise<Record<string, unknown>>
  update(args: Record<string, unknown>): Promise<Record<string, unknown>>
  deleteMany(args: Record<string, unknown>): Promise<unknown>
}

function toDomain(row: Record<string, unknown>): GuidanceInboxItemEntity {
  return {
    id: String(row.id),
    actor_type: String(row.actorType) as GuidanceActorType,
    actor_id: String(row.actorId),
    module_type: String(row.moduleType) as GuidanceInboxItemEntity['module_type'],
    reason_code: String(row.reasonCode),
    status: String(row.status) as GuidanceInboxStatus,
    dedup_key: typeof row.dedupKey === 'string' ? row.dedupKey : null,
    unread: Boolean(row.unread),
    title: String(row.title),
    body: String(row.body),
    cta_label: typeof row.ctaLabel === 'string' ? row.ctaLabel : null,
    cta_target: typeof row.ctaTarget === 'string' ? row.ctaTarget : null,
    payload_json: (row.payloadJson as Record<string, unknown> | null) ?? null,
    related_agent_id: typeof row.relatedAgentId === 'string' ? row.relatedAgentId : null,
    related_session_id: typeof row.relatedSessionId === 'string' ? row.relatedSessionId : null,
    completed_at: row.completedAt instanceof Date ? row.completedAt : null,
    dismissed_at: row.dismissedAt instanceof Date ? row.dismissedAt : null,
    created_at: row.createdAt instanceof Date ? row.createdAt : new Date(),
    updated_at: row.updatedAt instanceof Date ? row.updatedAt : new Date(),
  }
}

export class PgGuidanceInboxRepository implements GuidanceInboxRepository {
  private readonly table: GuidanceInboxTable

  constructor(prisma: PrismaClient) {
    this.table = (prisma as unknown as { guidanceInbox: GuidanceInboxTable }).guidanceInbox
  }

  async listByActor(
    actorType: GuidanceActorType,
    actorId: string,
    opts?: { statuses?: GuidanceInboxStatus[]; limit?: number },
  ): Promise<GuidanceInboxItemEntity[]> {
    const rows = await this.table.findMany({
      where: {
        actorType,
        actorId,
        ...(opts?.statuses ? { status: { in: opts.statuses } } : {}),
      },
      orderBy: [
        { unread: 'desc' },
        { updatedAt: 'desc' },
      ],
      ...(typeof opts?.limit === 'number' ? { take: opts.limit } : {}),
    })
    return rows.map(toDomain)
  }

  async findById(id: string): Promise<GuidanceInboxItemEntity | null> {
    const row = await this.table.findUnique({ where: { id } })
    return row ? toDomain(row) : null
  }

  async findByDedupKey(
    actorType: GuidanceActorType,
    actorId: string,
    dedupKey: string,
  ): Promise<GuidanceInboxItemEntity | null> {
    const row = await this.table.findFirst({
      where: {
        actorType,
        actorId,
        dedupKey,
      },
    })
    return row ? toDomain(row) : null
  }

  async upsert(input: UpsertGuidanceInboxItemInput): Promise<GuidanceInboxItemEntity> {
    const existing = input.dedup_key
      ? await this.findByDedupKey(input.actor_type, input.actor_id, input.dedup_key)
      : null

    if (existing) {
      return this.update({
        id: existing.id,
        reason_code: input.reason_code,
        status: input.status ?? existing.status,
        unread: input.unread ?? existing.unread,
        title: input.title,
        body: input.body,
        cta_label: input.cta_label ?? null,
        cta_target: input.cta_target ?? null,
        payload_json: input.payload_json ?? null,
        related_agent_id: input.related_agent_id ?? null,
        related_session_id: input.related_session_id ?? null,
      }) as Promise<GuidanceInboxItemEntity>
    }

    const row = await this.table.create({
      data: {
        id: randomUUID(),
        actorType: input.actor_type,
        actorId: input.actor_id,
        moduleType: input.module_type,
        reasonCode: input.reason_code,
        status: input.status ?? 'ACTIVE',
        dedupKey: input.dedup_key ?? null,
        unread: input.unread ?? true,
        title: input.title,
        body: input.body,
        ctaLabel: input.cta_label ?? null,
        ctaTarget: input.cta_target ?? null,
        payloadJson: input.payload_json ?? null,
        relatedAgentId: input.related_agent_id ?? null,
        relatedSessionId: input.related_session_id ?? null,
      },
    })
    return toDomain(row)
  }

  async update(input: UpdateGuidanceInboxItemInput): Promise<GuidanceInboxItemEntity | null> {
    try {
      const row = await this.table.update({
        where: { id: input.id },
        data: {
          ...(input.reason_code !== undefined ? { reasonCode: input.reason_code } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.unread !== undefined ? { unread: input.unread } : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.body !== undefined ? { body: input.body } : {}),
          ...(input.cta_label !== undefined ? { ctaLabel: input.cta_label } : {}),
          ...(input.cta_target !== undefined ? { ctaTarget: input.cta_target } : {}),
          ...(input.payload_json !== undefined ? { payloadJson: input.payload_json } : {}),
          ...(input.related_agent_id !== undefined ? { relatedAgentId: input.related_agent_id } : {}),
          ...(input.related_session_id !== undefined ? { relatedSessionId: input.related_session_id } : {}),
          ...(input.status === 'COMPLETED' ? { completedAt: new Date() } : {}),
          ...(input.status === 'DISMISSED' ? { dismissedAt: new Date() } : {}),
        },
      })
      return toDomain(row)
    } catch {
      return null
    }
  }

  async deleteByActor(actorType: GuidanceActorType, actorId: string): Promise<void> {
    await this.table.deleteMany({ where: { actorType, actorId } })
  }
}
