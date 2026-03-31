import type { PrismaClient, ViewerPublicViewEvent as PrismaViewerPublicViewEvent } from '@prisma/client'
import type {
  CreateViewerPublicViewEventInput,
  ViewerPublicActorType,
  ViewerPublicViewEvent,
} from '../types.js'
import type { ViewerPublicViewEventRepository } from '../viewer-public-view-event-repository.js'

export class PgViewerPublicViewEventRepository implements ViewerPublicViewEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {}

  async createMany(entries: CreateViewerPublicViewEventInput[]): Promise<ViewerPublicViewEvent[]> {
    if (entries.length === 0) return []
    const now = new Date()
    const rows = await this.prisma.$transaction(
      entries.map((entry) => this.prisma.viewerPublicViewEvent.create({
        data: {
          actorType: entry.actor_type,
          actorId: entry.actor_id,
          viewerUserId: entry.viewer_user_id ?? null,
          viewerAgentId: entry.viewer_agent_id ?? null,
          sourceSurface: entry.source_surface,
          sourceShelf: entry.source_shelf ?? null,
          sourcePosition: entry.source_position ?? null,
          targetKind: entry.target_kind,
          targetId: entry.target_id,
          targetAgentId: entry.target_agent_id ?? null,
          communityId: entry.community_id ?? null,
          storylineId: entry.storyline_id ?? null,
          isT4: entry.is_t4 ?? false,
          noteTemplateId: entry.note_template_id ?? null,
          occurredAt: entry.occurred_at ?? now,
        },
      })),
    )
    return rows.map((row) => this.toDomain(row))
  }

  async listRecentByActor(
    actors: Array<{ actor_type: ViewerPublicActorType; actor_id: string }>,
    opts?: { since?: Date; limit?: number },
  ): Promise<ViewerPublicViewEvent[]> {
    if (actors.length === 0) return []
    const since = opts?.since ?? new Date(0)
    const limit = typeof opts?.limit === 'number' && opts.limit > 0
      ? Math.trunc(opts.limit)
      : 200

    const rows = await this.prisma.viewerPublicViewEvent.findMany({
      where: {
        occurredAt: { gte: since },
        OR: actors.map((actor) => ({
          actorType: actor.actor_type,
          actorId: actor.actor_id,
        })),
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    })

    return rows.map((row) => this.toDomain(row))
  }

  async mergeVisitorIntoUser(visitorId: string, userId: string): Promise<number> {
    const result = await this.prisma.viewerPublicViewEvent.updateMany({
      where: {
        actorType: 'VISITOR',
        actorId: visitorId,
      },
      data: {
        actorType: 'USER',
        actorId: userId,
        viewerUserId: userId,
      },
    })
    return result.count
  }

  async purgeOlderThan(cutoff: Date): Promise<number> {
    const result = await this.prisma.viewerPublicViewEvent.deleteMany({
      where: {
        occurredAt: { lt: cutoff },
      },
    })
    return result.count
  }

  private toDomain(row: PrismaViewerPublicViewEvent): ViewerPublicViewEvent {
    return {
      id: row.id,
      actor_type: row.actorType as ViewerPublicActorType,
      actor_id: row.actorId,
      viewer_user_id: row.viewerUserId,
      viewer_agent_id: row.viewerAgentId,
      source_surface: row.sourceSurface,
      source_shelf: row.sourceShelf,
      source_position: row.sourcePosition,
      target_kind: row.targetKind as ViewerPublicViewEvent['target_kind'],
      target_id: row.targetId,
      target_agent_id: row.targetAgentId,
      community_id: row.communityId,
      storyline_id: row.storylineId,
      is_t4: row.isT4,
      note_template_id: row.noteTemplateId,
      occurred_at: row.occurredAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
