import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type {
  GuidanceActorStateEntity,
  GuidanceActorType,
  UpsertGuidanceActorStateInput,
} from '../types.js'
import type { GuidanceActorStateRepository } from '../guidance-state-repository.js'

type GuidanceActorStateTable = {
  findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>
  upsert(args: Record<string, unknown>): Promise<Record<string, unknown>>
  deleteMany(args: Record<string, unknown>): Promise<unknown>
}

function toDomain(row: Record<string, unknown>): GuidanceActorStateEntity {
  return {
    id: String(row.id),
    actor_type: String(row.actorType) as GuidanceActorType,
    actor_id: String(row.actorId),
    current_track: String(row.currentTrack) as GuidanceActorStateEntity['current_track'],
    stage: String(row.stage) as GuidanceActorStateEntity['stage'],
    explained_two_tracks: Boolean(row.explainedTwoTracks),
    followed_first_agent_at: row.followedFirstAgentAt instanceof Date ? row.followedFirstAgentAt : null,
    following_feed_seen_at: row.followingFeedSeenAt instanceof Date ? row.followingFeedSeenAt : null,
    agent_created_at: row.agentCreatedAt instanceof Date ? row.agentCreatedAt : null,
    private_session_created_at: row.privateSessionCreatedAt instanceof Date ? row.privateSessionCreatedAt : null,
    private_session_ended_at: row.privateSessionEndedAt instanceof Date ? row.privateSessionEndedAt : null,
    nurture_receipt_ready_at: row.nurtureReceiptReadyAt instanceof Date ? row.nurtureReceiptReadyAt : null,
    watch_public_effect_at: row.watchPublicEffectAt instanceof Date ? row.watchPublicEffectAt : null,
    latest_owner_agent_id: typeof row.latestOwnerAgentId === 'string' ? row.latestOwnerAgentId : null,
    latest_receipt_session_id: typeof row.latestReceiptSessionId === 'string' ? row.latestReceiptSessionId : null,
    created_at: row.createdAt instanceof Date ? row.createdAt : new Date(),
    updated_at: row.updatedAt instanceof Date ? row.updatedAt : new Date(),
  }
}

export class PgGuidanceActorStateRepository implements GuidanceActorStateRepository {
  private readonly table: GuidanceActorStateTable

  constructor(prisma: PrismaClient) {
    this.table = (prisma as unknown as { guidanceActorState: GuidanceActorStateTable }).guidanceActorState
  }

  async findByActor(actorType: GuidanceActorType, actorId: string): Promise<GuidanceActorStateEntity | null> {
    const row = await this.table.findUnique({
      where: {
        actorType_actorId: {
          actorType,
          actorId,
        },
      },
    })
    return row ? toDomain(row) : null
  }

  async upsert(input: UpsertGuidanceActorStateInput): Promise<GuidanceActorStateEntity> {
    const row = await this.table.upsert({
      where: {
        actorType_actorId: {
          actorType: input.actor_type,
          actorId: input.actor_id,
        },
      },
      create: {
        id: randomUUID(),
        actorType: input.actor_type,
        actorId: input.actor_id,
        currentTrack: input.current_track ?? 'UNDECIDED',
        stage: input.stage ?? 'NEW_VISITOR',
        explainedTwoTracks: input.explained_two_tracks ?? false,
        followedFirstAgentAt: input.followed_first_agent_at ?? null,
        followingFeedSeenAt: input.following_feed_seen_at ?? null,
        agentCreatedAt: input.agent_created_at ?? null,
        privateSessionCreatedAt: input.private_session_created_at ?? null,
        privateSessionEndedAt: input.private_session_ended_at ?? null,
        nurtureReceiptReadyAt: input.nurture_receipt_ready_at ?? null,
        watchPublicEffectAt: input.watch_public_effect_at ?? null,
        latestOwnerAgentId: input.latest_owner_agent_id ?? null,
        latestReceiptSessionId: input.latest_receipt_session_id ?? null,
      },
      update: {
        ...(input.current_track !== undefined ? { currentTrack: input.current_track } : {}),
        ...(input.stage !== undefined ? { stage: input.stage } : {}),
        ...(input.explained_two_tracks !== undefined ? { explainedTwoTracks: input.explained_two_tracks } : {}),
        ...(input.followed_first_agent_at !== undefined ? { followedFirstAgentAt: input.followed_first_agent_at } : {}),
        ...(input.following_feed_seen_at !== undefined ? { followingFeedSeenAt: input.following_feed_seen_at } : {}),
        ...(input.agent_created_at !== undefined ? { agentCreatedAt: input.agent_created_at } : {}),
        ...(input.private_session_created_at !== undefined ? { privateSessionCreatedAt: input.private_session_created_at } : {}),
        ...(input.private_session_ended_at !== undefined ? { privateSessionEndedAt: input.private_session_ended_at } : {}),
        ...(input.nurture_receipt_ready_at !== undefined ? { nurtureReceiptReadyAt: input.nurture_receipt_ready_at } : {}),
        ...(input.watch_public_effect_at !== undefined ? { watchPublicEffectAt: input.watch_public_effect_at } : {}),
        ...(input.latest_owner_agent_id !== undefined ? { latestOwnerAgentId: input.latest_owner_agent_id } : {}),
        ...(input.latest_receipt_session_id !== undefined ? { latestReceiptSessionId: input.latest_receipt_session_id } : {}),
      },
    })
    return toDomain(row)
  }

  async deleteByActor(actorType: GuidanceActorType, actorId: string): Promise<void> {
    await this.table.deleteMany({
      where: { actorType, actorId },
    })
  }
}
