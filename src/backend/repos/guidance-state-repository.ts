import { randomUUID } from 'node:crypto'
import type {
  GuidanceActorStateEntity,
  GuidanceActorType,
  GuidanceStage,
  GuidanceTrack,
  UpsertGuidanceActorStateInput,
} from './types.js'

export interface GuidanceActorStateRepository {
  findByActor(actorType: GuidanceActorType, actorId: string): Promise<GuidanceActorStateEntity | null>
  listByActorType(actorType: GuidanceActorType, opts?: { limit?: number }): Promise<GuidanceActorStateEntity[]>
  upsert(input: UpsertGuidanceActorStateInput): Promise<GuidanceActorStateEntity>
  deleteByActor(actorType: GuidanceActorType, actorId: string): Promise<void>
}

function createDefaultState(
  actorType: GuidanceActorType,
  actorId: string,
): GuidanceActorStateEntity {
  const now = new Date()
  return {
    id: randomUUID(),
    actor_type: actorType,
    actor_id: actorId,
    current_track: 'UNDECIDED',
    stage: 'NEW_VISITOR',
    explained_two_tracks: false,
    followed_first_agent_at: null,
    following_feed_seen_at: null,
    agent_created_at: null,
    private_session_created_at: null,
    private_session_ended_at: null,
    nurture_receipt_ready_at: null,
    watch_public_effect_at: null,
    latest_owner_agent_id: null,
    latest_receipt_session_id: null,
    created_at: now,
    updated_at: now,
  }
}

function mergeState(
  base: GuidanceActorStateEntity,
  input: UpsertGuidanceActorStateInput,
): GuidanceActorStateEntity {
  return {
    ...base,
    current_track: input.current_track ?? base.current_track,
    stage: input.stage ?? base.stage,
    explained_two_tracks: input.explained_two_tracks ?? base.explained_two_tracks,
    followed_first_agent_at: input.followed_first_agent_at !== undefined ? input.followed_first_agent_at : base.followed_first_agent_at,
    following_feed_seen_at: input.following_feed_seen_at !== undefined ? input.following_feed_seen_at : base.following_feed_seen_at,
    agent_created_at: input.agent_created_at !== undefined ? input.agent_created_at : base.agent_created_at,
    private_session_created_at: input.private_session_created_at !== undefined ? input.private_session_created_at : base.private_session_created_at,
    private_session_ended_at: input.private_session_ended_at !== undefined ? input.private_session_ended_at : base.private_session_ended_at,
    nurture_receipt_ready_at: input.nurture_receipt_ready_at !== undefined ? input.nurture_receipt_ready_at : base.nurture_receipt_ready_at,
    watch_public_effect_at: input.watch_public_effect_at !== undefined ? input.watch_public_effect_at : base.watch_public_effect_at,
    latest_owner_agent_id: input.latest_owner_agent_id !== undefined ? input.latest_owner_agent_id : base.latest_owner_agent_id,
    latest_receipt_session_id: input.latest_receipt_session_id !== undefined ? input.latest_receipt_session_id : base.latest_receipt_session_id,
    updated_at: new Date(),
  }
}

export class InMemoryGuidanceActorStateRepository implements GuidanceActorStateRepository {
  private readonly store = new Map<string, GuidanceActorStateEntity>()

  private key(actorType: GuidanceActorType, actorId: string): string {
    return `${actorType}:${actorId}`
  }

  async findByActor(actorType: GuidanceActorType, actorId: string): Promise<GuidanceActorStateEntity | null> {
    return this.store.get(this.key(actorType, actorId)) ?? null
  }

  async listByActorType(actorType: GuidanceActorType, opts?: { limit?: number }): Promise<GuidanceActorStateEntity[]> {
    const items = Array.from(this.store.values())
      .filter((item) => item.actor_type === actorType)
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
    return typeof opts?.limit === 'number' ? items.slice(0, opts.limit) : items
  }

  async upsert(input: UpsertGuidanceActorStateInput): Promise<GuidanceActorStateEntity> {
    const key = this.key(input.actor_type, input.actor_id)
    const existing = this.store.get(key) ?? createDefaultState(input.actor_type, input.actor_id)
    const next = mergeState(existing, input)
    this.store.set(key, next)
    return next
  }

  async deleteByActor(actorType: GuidanceActorType, actorId: string): Promise<void> {
    this.store.delete(this.key(actorType, actorId))
  }
}

export function guidanceTrackPriority(track: GuidanceTrack): number {
  switch (track) {
    case 'OWNER':
      return 3
    case 'SPECTATOR':
      return 2
    default:
      return 1
  }
}

export function guidanceStagePriority(stage: GuidanceStage): number {
  switch (stage) {
    case 'RETAINED':
      return 4
    case 'FIRST_SUCCESS':
      return 3
    case 'EXPLORING':
      return 2
    default:
      return 1
  }
}
