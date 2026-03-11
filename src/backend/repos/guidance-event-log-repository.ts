import { randomUUID } from 'node:crypto'
import type {
  CreateGuidanceEventLogInput,
  GuidanceActorType,
  GuidanceEventLogEntity,
} from './types.js'

export interface GuidanceEventLogRepository {
  findByDedupKey(actorType: GuidanceActorType, actorId: string, dedupKey: string): Promise<GuidanceEventLogEntity | null>
  listByActor(
    actorType: GuidanceActorType,
    actorId: string,
    opts?: { eventTypes?: string[]; createdAfter?: Date; limit?: number },
  ): Promise<GuidanceEventLogEntity[]>
  listAll(opts?: { actorType?: GuidanceActorType; eventTypes?: string[]; createdAfter?: Date; limit?: number }): Promise<GuidanceEventLogEntity[]>
  create(input: CreateGuidanceEventLogInput): Promise<GuidanceEventLogEntity>
  deleteByActor(actorType: GuidanceActorType, actorId: string): Promise<void>
}

export class InMemoryGuidanceEventLogRepository implements GuidanceEventLogRepository {
  private readonly store = new Map<string, GuidanceEventLogEntity>()

  async findByDedupKey(actorType: GuidanceActorType, actorId: string, dedupKey: string): Promise<GuidanceEventLogEntity | null> {
    for (const item of this.store.values()) {
      if (item.actor_type === actorType && item.actor_id === actorId && item.dedup_key === dedupKey) {
        return item
      }
    }
    return null
  }

  async listByActor(
    actorType: GuidanceActorType,
    actorId: string,
    opts?: { eventTypes?: string[]; createdAfter?: Date; limit?: number },
  ): Promise<GuidanceEventLogEntity[]> {
    const items = Array.from(this.store.values())
      .filter((item) =>
        item.actor_type === actorType
        && item.actor_id === actorId
        && (!opts?.eventTypes || opts.eventTypes.includes(item.event_type))
        && (!opts?.createdAfter || item.created_at >= opts.createdAfter))
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return typeof opts?.limit === 'number' ? items.slice(0, opts.limit) : items
  }

  async listAll(opts?: {
    actorType?: GuidanceActorType
    eventTypes?: string[]
    createdAfter?: Date
    limit?: number
  }): Promise<GuidanceEventLogEntity[]> {
    const items = Array.from(this.store.values())
      .filter((item) =>
        (!opts?.actorType || item.actor_type === opts.actorType)
        && (!opts?.eventTypes || opts.eventTypes.includes(item.event_type))
        && (!opts?.createdAfter || item.created_at >= opts.createdAfter))
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return typeof opts?.limit === 'number' ? items.slice(0, opts.limit) : items
  }

  async create(input: CreateGuidanceEventLogInput): Promise<GuidanceEventLogEntity> {
    const entity: GuidanceEventLogEntity = {
      id: randomUUID(),
      actor_type: input.actor_type,
      actor_id: input.actor_id,
      event_type: input.event_type,
      dedup_key: input.dedup_key ?? null,
      payload_json: input.payload_json ?? null,
      created_at: new Date(),
    }
    this.store.set(entity.id, entity)
    return entity
  }

  async deleteByActor(actorType: GuidanceActorType, actorId: string): Promise<void> {
    for (const [id, item] of this.store.entries()) {
      if (item.actor_type === actorType && item.actor_id === actorId) {
        this.store.delete(id)
      }
    }
  }
}
