import { randomUUID } from 'node:crypto'
import type {
  GuidanceActorType,
  GuidanceInboxItemEntity,
  GuidanceInboxStatus,
  UpdateGuidanceInboxItemInput,
  UpsertGuidanceInboxItemInput,
} from './types.js'

export interface GuidanceInboxRepository {
  listByActor(
    actorType: GuidanceActorType,
    actorId: string,
    opts?: { statuses?: GuidanceInboxStatus[]; limit?: number },
  ): Promise<GuidanceInboxItemEntity[]>
  findById(id: string): Promise<GuidanceInboxItemEntity | null>
  findByDedupKey(
    actorType: GuidanceActorType,
    actorId: string,
    dedupKey: string,
  ): Promise<GuidanceInboxItemEntity | null>
  upsert(input: UpsertGuidanceInboxItemInput): Promise<GuidanceInboxItemEntity>
  update(input: UpdateGuidanceInboxItemInput): Promise<GuidanceInboxItemEntity | null>
  deleteByActor(actorType: GuidanceActorType, actorId: string): Promise<void>
}

function sortItems(items: GuidanceInboxItemEntity[]): GuidanceInboxItemEntity[] {
  return [...items].sort((a, b) => {
    if (a.unread !== b.unread) return a.unread ? -1 : 1
    return b.updated_at.getTime() - a.updated_at.getTime()
  })
}

export class InMemoryGuidanceInboxRepository implements GuidanceInboxRepository {
  private readonly store = new Map<string, GuidanceInboxItemEntity>()

  async listByActor(
    actorType: GuidanceActorType,
    actorId: string,
    opts?: { statuses?: GuidanceInboxStatus[]; limit?: number },
  ): Promise<GuidanceInboxItemEntity[]> {
    const rows = Array.from(this.store.values()).filter((item) =>
      item.actor_type === actorType
      && item.actor_id === actorId
      && (!opts?.statuses || opts.statuses.includes(item.status)))
    const sorted = sortItems(rows)
    return typeof opts?.limit === 'number' ? sorted.slice(0, opts.limit) : sorted
  }

  async findById(id: string): Promise<GuidanceInboxItemEntity | null> {
    return this.store.get(id) ?? null
  }

  async findByDedupKey(
    actorType: GuidanceActorType,
    actorId: string,
    dedupKey: string,
  ): Promise<GuidanceInboxItemEntity | null> {
    for (const item of this.store.values()) {
      if (item.actor_type === actorType && item.actor_id === actorId && item.dedup_key === dedupKey) {
        return item
      }
    }
    return null
  }

  async upsert(input: UpsertGuidanceInboxItemInput): Promise<GuidanceInboxItemEntity> {
    const existing = input.dedup_key
      ? await this.findByDedupKey(input.actor_type, input.actor_id, input.dedup_key)
      : null

    if (existing) {
      const updated: GuidanceInboxItemEntity = {
        ...existing,
        module_type: input.module_type,
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
        completed_at: input.status === 'COMPLETED' ? new Date() : existing.completed_at,
        dismissed_at: input.status === 'DISMISSED' ? new Date() : existing.dismissed_at,
        updated_at: new Date(),
      }
      this.store.set(updated.id, updated)
      return updated
    }

    const now = new Date()
    const created: GuidanceInboxItemEntity = {
      id: randomUUID(),
      actor_type: input.actor_type,
      actor_id: input.actor_id,
      module_type: input.module_type,
      reason_code: input.reason_code,
      status: input.status ?? 'ACTIVE',
      dedup_key: input.dedup_key ?? null,
      unread: input.unread ?? true,
      title: input.title,
      body: input.body,
      cta_label: input.cta_label ?? null,
      cta_target: input.cta_target ?? null,
      payload_json: input.payload_json ?? null,
      related_agent_id: input.related_agent_id ?? null,
      related_session_id: input.related_session_id ?? null,
      completed_at: input.status === 'COMPLETED' ? now : null,
      dismissed_at: input.status === 'DISMISSED' ? now : null,
      created_at: now,
      updated_at: now,
    }
    this.store.set(created.id, created)
    return created
  }

  async update(input: UpdateGuidanceInboxItemInput): Promise<GuidanceInboxItemEntity | null> {
    const existing = this.store.get(input.id)
    if (!existing) return null

    const updated: GuidanceInboxItemEntity = {
      ...existing,
      reason_code: input.reason_code ?? existing.reason_code,
      status: input.status ?? existing.status,
      unread: input.unread ?? existing.unread,
      title: input.title ?? existing.title,
      body: input.body ?? existing.body,
      cta_label: input.cta_label !== undefined ? input.cta_label : existing.cta_label,
      cta_target: input.cta_target !== undefined ? input.cta_target : existing.cta_target,
      payload_json: input.payload_json !== undefined ? input.payload_json : existing.payload_json,
      related_agent_id: input.related_agent_id !== undefined ? input.related_agent_id : existing.related_agent_id,
      related_session_id: input.related_session_id !== undefined ? input.related_session_id : existing.related_session_id,
      completed_at: input.status === 'COMPLETED' ? new Date() : existing.completed_at,
      dismissed_at: input.status === 'DISMISSED' ? new Date() : existing.dismissed_at,
      updated_at: new Date(),
    }
    this.store.set(updated.id, updated)
    return updated
  }

  async deleteByActor(actorType: GuidanceActorType, actorId: string): Promise<void> {
    for (const [id, item] of this.store.entries()) {
      if (item.actor_type === actorType && item.actor_id === actorId) {
        this.store.delete(id)
      }
    }
  }
}
