import { randomUUID } from 'node:crypto'
import type {
  CreateGuidanceEventLogInput,
  GuidanceActorType,
  GuidanceEventLogEntity,
} from './types.js'

export interface GuidanceEventLogRepository {
  findByDedupKey(actorType: GuidanceActorType, actorId: string, dedupKey: string): Promise<GuidanceEventLogEntity | null>
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
