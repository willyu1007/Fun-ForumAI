import {
  Prisma,
  type Post as PrismaPost,
  type PrismaClient,
} from '@prisma/client'
import type {
  AgentRun,
  Comment,
  CreateAgentRunInput,
  CreateCommentInput,
  CreateEventInput,
  CreateForumSceneMetadataInput,
  CreatePostInput,
  DomainEvent,
  Post,
} from '../types.js'
import type { PublicSceneWriteRepository } from '../public-scene-write-repository.js'
import {
  PgAgentRunRepository,
  PgEventRepository,
  toPrismaActorType,
  toPrismaPlane,
} from './pg-event-repository.js'

export class PgPublicSceneWriteRepository implements PublicSceneWriteRepository {
  constructor(
    private readonly deps: {
      prisma: PrismaClient
      eventRepo: PgEventRepository
      agentRunRepo: PgAgentRunRepository
    },
  ) {}

  async createPost(input: {
    post: CreatePostInput
    scene_metadata: CreateForumSceneMetadataInput
    event: CreateEventInput
    agent_run: CreateAgentRunInput
  }): Promise<{ post: Post; event: DomainEvent; agentRun: AgentRun }> {
    const result = await this.deps.prisma.$transaction(async (tx) => {
      const postRow = await tx.post.create({
        data: {
          ...(input.post.id ? { id: input.post.id } : {}),
          communityId: input.post.community_id,
          authorAgentId: input.post.author_agent_id,
          title: input.post.title,
          body: input.post.body,
          tagsJson: (input.post.tags ?? []) as Prisma.InputJsonValue,
          visibility: input.post.visibility,
          state: input.post.state,
          moderationMetadataJson:
            (input.post.moderation_metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      })

      await tx.forumSceneMetadata.create({
        data: {
          targetType: 'POST',
          communityId: input.scene_metadata.community_id,
          postId: postRow.id,
          commentId: null,
          episodeId: input.scene_metadata.episode_id,
          selectionId: input.scene_metadata.selection_id,
          episodePlanId: input.scene_metadata.episode_plan_id,
          localIntentId: input.scene_metadata.local_intent_id,
          directorSurface: input.scene_metadata.director_surface,
          actorSurface: input.scene_metadata.actor_surface,
          sceneTemplateId: input.scene_metadata.scene_template_id,
          sceneTemplateVersion: input.scene_metadata.scene_template_version,
          sceneBindingId: input.scene_metadata.scene_binding_id ?? null,
          overlayId: input.scene_metadata.overlay_id ?? null,
          beatId: input.scene_metadata.beat_id ?? null,
          phase: input.scene_metadata.phase,
          selectionMode: input.scene_metadata.selection_mode,
          expiresAt: input.scene_metadata.expires_at ?? null,
          payloadJson: input.scene_metadata.payload_json as Prisma.InputJsonValue,
        },
      })

      const eventRow = await tx.event.create({
        data: {
          ...(input.event.id ? { id: input.event.id } : {}),
          eventType: input.event.event_type,
          plane: toPrismaPlane(input.event.plane ?? 'DATA'),
          schemaVersion: input.event.schema_version ?? 'v1',
          communityId: input.post.community_id,
          postId: postRow.id,
          roomId: input.event.room_id ?? null,
          actorType: toPrismaActorType(input.event.actor_type ?? 'system'),
          actorId: input.event.actor_id ?? null,
          causeEventId: input.event.cause_event_id ?? null,
          correlationId: input.event.correlation_id ?? null,
          payloadJson: input.event.payload_json as Prisma.InputJsonValue,
          idempotencyKey: input.event.idempotency_key ?? null,
        },
      })

      const agentRunRow = await tx.agentRun.create({
        data: {
          ...(input.agent_run.id ? { id: input.agent_run.id } : {}),
          agentId: input.agent_run.agent_id,
          triggerEventId: eventRow.id,
          inputDigest: input.agent_run.input_digest,
          outputJson:
            input.agent_run.output_json === null || input.agent_run.output_json === undefined
              ? Prisma.DbNull
              : (input.agent_run.output_json as Prisma.InputJsonValue),
          moderationResult: input.agent_run.moderation_result,
          tokenCost: input.agent_run.token_cost ?? 0,
          latencyMs: input.agent_run.latency_ms ?? 0,
        },
      })

      return { postRow, eventRow, agentRunRow }
    })

    const event = PgEventRepository.toDomain(result.eventRow)
    const agentRun = PgAgentRunRepository.toDomain(result.agentRunRow)
    this.deps.eventRepo.rememberPersisted(event)
    this.deps.agentRunRepo.rememberPersisted(agentRun)

    return {
      post: this.toPost(result.postRow),
      event,
      agentRun,
    }
  }

  async createComment(input: {
    comment: CreateCommentInput
    scene_metadata: CreateForumSceneMetadataInput
    event: CreateEventInput
  }): Promise<{ comment: Comment; event: DomainEvent }> {
    const result = await this.deps.prisma.$transaction(async (tx) => {
      const parentThread = input.comment.parent_comment_id
        ? await tx.publicStageThread.findUnique({ where: { id: input.comment.parent_comment_id } })
        : null
      const parentTurn = input.comment.parent_comment_id && !parentThread
        ? await tx.publicStageTurn.findUnique({ where: { id: input.comment.parent_comment_id } })
        : null

      if (input.comment.parent_comment_id && !parentThread && !parentTurn) {
        throw new Error(`Parent comment not found: ${input.comment.parent_comment_id}`)
      }

      const createdTarget = !input.comment.parent_comment_id
        ? await tx.publicStageThread.create({
            data: {
              ...(input.comment.id ? { id: input.comment.id } : {}),
              postId: input.comment.post_id,
              communityId: input.scene_metadata.community_id,
              authorAgentId: input.comment.author_agent_id,
              body: input.comment.body,
              visibility: input.comment.visibility,
              state: input.comment.state,
              threadState: 'OPEN',
              replyBudget: 6,
              activeRouteJson: Prisma.DbNull,
            },
          })
        : await tx.publicStageTurn.create({
            data: {
              ...(input.comment.id ? { id: input.comment.id } : {}),
              threadId: parentThread?.id ?? parentTurn!.threadId,
              postId: input.comment.post_id,
              authorAgentId: input.comment.author_agent_id,
              turnIndex: await tx.publicStageTurn.count({
                where: { threadId: parentThread?.id ?? parentTurn!.threadId },
              }) + 1,
              anchorTurnId: parentTurn?.id ?? null,
              body: input.comment.body,
              visibility: input.comment.visibility,
              state: input.comment.state,
            },
          })

      await tx.forumSceneMetadata.create({
        data: {
          targetType: input.comment.parent_comment_id ? 'TURN' : 'THREAD',
          communityId: input.scene_metadata.community_id,
          postId: input.comment.post_id,
          threadId: input.comment.parent_comment_id ? null : createdTarget.id,
          turnId: input.comment.parent_comment_id ? createdTarget.id : null,
          commentId: null,
          episodeId: input.scene_metadata.episode_id,
          selectionId: input.scene_metadata.selection_id,
          episodePlanId: input.scene_metadata.episode_plan_id,
          localIntentId: input.scene_metadata.local_intent_id,
          directorSurface: input.scene_metadata.director_surface,
          actorSurface: input.scene_metadata.actor_surface,
          sceneTemplateId: input.scene_metadata.scene_template_id,
          sceneTemplateVersion: input.scene_metadata.scene_template_version,
          sceneBindingId: input.scene_metadata.scene_binding_id ?? null,
          overlayId: input.scene_metadata.overlay_id ?? null,
          beatId: input.scene_metadata.beat_id ?? null,
          phase: input.scene_metadata.phase,
          selectionMode: input.scene_metadata.selection_mode,
          expiresAt: input.scene_metadata.expires_at ?? null,
          payloadJson: input.scene_metadata.payload_json as Prisma.InputJsonValue,
        },
      })

      const eventRow = await tx.event.create({
        data: {
          ...(input.event.id ? { id: input.event.id } : {}),
          eventType: input.event.event_type,
          plane: toPrismaPlane(input.event.plane ?? 'DATA'),
          schemaVersion: input.event.schema_version ?? 'v1',
          communityId: input.event.community_id ?? input.scene_metadata.community_id,
          postId: input.comment.post_id,
          roomId: input.event.room_id ?? null,
          actorType: toPrismaActorType(input.event.actor_type ?? 'system'),
          actorId: input.event.actor_id ?? null,
          causeEventId: input.event.cause_event_id ?? null,
          correlationId: input.event.correlation_id ?? null,
          payloadJson: input.event.payload_json as Prisma.InputJsonValue,
          idempotencyKey: input.event.idempotency_key ?? null,
        },
      })

      return { createdTarget, eventRow, parentId: input.comment.parent_comment_id ?? null }
    })

    const event = PgEventRepository.toDomain(result.eventRow)
    this.deps.eventRepo.rememberPersisted(event)

    return {
      comment: input.comment.parent_comment_id
        ? toCompatTurnComment(result.createdTarget as unknown as {
            id: string
            threadId: string
            postId: string
            authorAgentId: string
            anchorTurnId: string | null
            body: string
            visibility: Comment['visibility']
            state: Comment['state']
            createdAt: Date
            updatedAt: Date
          }, result.parentId)
        : toCompatThreadComment(result.createdTarget as unknown as {
            id: string
            postId: string
            authorAgentId: string
            body: string
            visibility: Comment['visibility']
            state: Comment['state']
            createdAt: Date
            updatedAt: Date
          }),
      event,
    }
  }

  private toPost(row: PrismaPost): Post {
    return {
      id: row.id,
      community_id: row.communityId,
      author_agent_id: row.authorAgentId,
      title: row.title,
      body: row.body,
      tags: (row.tagsJson as string[] | null) ?? [],
      visibility: row.visibility,
      state: row.state,
      moderation_metadata:
        (row.moderationMetadataJson as Record<string, unknown> | null) ?? null,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

}

function toCompatThreadComment(row: {
  id: string
  postId: string
  authorAgentId: string
  body: string
  visibility: Comment['visibility']
  state: Comment['state']
  createdAt: Date
  updatedAt: Date
}): Comment {
  return {
    id: row.id,
    post_id: row.postId,
    parent_comment_id: null,
    thread_id: row.id,
    comment_kind: 'THREAD',
    anchor_comment_id: null,
    author_agent_id: row.authorAgentId,
    body: row.body,
    visibility: row.visibility,
    state: row.state,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function toCompatTurnComment(row: {
  id: string
  threadId: string
  postId: string
  authorAgentId: string
  anchorTurnId: string | null
  body: string
  visibility: Comment['visibility']
  state: Comment['state']
  createdAt: Date
  updatedAt: Date
}, parentId: string | null): Comment {
  return {
    id: row.id,
    post_id: row.postId,
    parent_comment_id: parentId ?? row.anchorTurnId ?? row.threadId,
    thread_id: row.threadId,
    comment_kind: 'TURN',
    anchor_comment_id: row.anchorTurnId,
    author_agent_id: row.authorAgentId,
    body: row.body,
    visibility: row.visibility,
    state: row.state,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}
