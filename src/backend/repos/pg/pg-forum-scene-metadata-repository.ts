import { Prisma, type ForumSceneMetadata as PrismaForumSceneMetadata, type PrismaClient } from '@prisma/client'
import type {
  CreateForumSceneMetadataInput,
  ForumSceneMetadata,
} from '../types.js'
import type { ForumSceneMetadataRepository } from '../forum-scene-metadata-repository.js'

export class PgForumSceneMetadataRepository implements ForumSceneMetadataRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {}

  async create(input: CreateForumSceneMetadataInput): Promise<ForumSceneMetadata> {
    const row = await this.prisma.forumSceneMetadata.create({
      data: {
        targetType: input.target_type,
        communityId: input.community_id,
        postId: input.post_id ?? null,
        commentId: input.comment_id ?? null,
        episodeId: input.episode_id,
        selectionId: input.selection_id,
        episodePlanId: input.episode_plan_id,
        localIntentId: input.local_intent_id,
        directorSurface: input.director_surface,
        actorSurface: input.actor_surface,
        sceneTemplateId: input.scene_template_id,
        sceneTemplateVersion: input.scene_template_version,
        sceneBindingId: input.scene_binding_id ?? null,
        overlayId: input.overlay_id ?? null,
        beatId: input.beat_id ?? null,
        phase: input.phase,
        selectionMode: input.selection_mode,
        expiresAt: input.expires_at ?? null,
        payloadJson: input.payload_json as Prisma.InputJsonValue,
      },
    })
    return this.toDomain(row)
  }

  async findByPostId(postId: string): Promise<ForumSceneMetadata | null> {
    const row = await this.prisma.forumSceneMetadata.findFirst({
      where: {
        postId,
        targetType: 'POST',
      },
    })
    return row ? this.toDomain(row) : null
  }

  async findByCommentId(commentId: string): Promise<ForumSceneMetadata | null> {
    const row = await this.prisma.forumSceneMetadata.findUnique({
      where: { commentId },
    })
    return row ? this.toDomain(row) : null
  }

  async findLatestByCommunityId(communityId: string): Promise<ForumSceneMetadata | null> {
    const row = await this.prisma.forumSceneMetadata.findFirst({
      where: { communityId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return row ? this.toDomain(row) : null
  }

  async listByCommunityIdSince(communityId: string, since: Date): Promise<ForumSceneMetadata[]> {
    const rows = await this.prisma.forumSceneMetadata.findMany({
      where: {
        communityId,
        createdAt: {
          gte: since,
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map((row) => this.toDomain(row))
  }

  async deleteByTarget(input: { post_id?: string | null; comment_id?: string | null }): Promise<void> {
    if (input.post_id) {
      await this.prisma.forumSceneMetadata.deleteMany({
        where: {
          postId: input.post_id,
          targetType: 'POST',
        },
      })
      return
    }
    if (input.comment_id) {
      await this.prisma.forumSceneMetadata.deleteMany({ where: { commentId: input.comment_id } })
    }
  }

  private toDomain(row: PrismaForumSceneMetadata): ForumSceneMetadata {
    return {
      id: row.id,
      target_type: row.targetType,
      community_id: row.communityId,
      post_id: row.postId,
      comment_id: row.commentId,
      episode_id: row.episodeId,
      selection_id: row.selectionId,
      episode_plan_id: row.episodePlanId,
      local_intent_id: row.localIntentId,
      director_surface: row.directorSurface,
      actor_surface: row.actorSurface,
      scene_template_id: row.sceneTemplateId,
      scene_template_version: row.sceneTemplateVersion,
      scene_binding_id: row.sceneBindingId,
      overlay_id: row.overlayId,
      beat_id: row.beatId,
      phase: row.phase as ForumSceneMetadata['phase'],
      selection_mode: row.selectionMode as ForumSceneMetadata['selection_mode'],
      expires_at: row.expiresAt,
      payload_json: row.payloadJson as Record<string, unknown>,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
