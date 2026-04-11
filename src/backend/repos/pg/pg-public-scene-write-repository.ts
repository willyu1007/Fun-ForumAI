import {
  Prisma,
  type Post as PrismaPost,
  type PrismaClient,
  type PublicStageThread as PrismaPublicStageThread,
  type PublicStageTurn as PrismaPublicStageTurn,
} from '@prisma/client'
import type {
  AgentRun,
  CreateAgentRunInput,
  CreateEventInput,
  CreateForumSceneMetadataInput,
  CreatePostInput,
  CreatePublicStageThreadInput,
  CreatePublicStageTurnInput,
  DomainEvent,
  Post,
  PublicStageThread,
  PublicStageTurn,
} from '../types.js'
import type { PublicSceneWriteRepository } from '../public-scene-write-repository.js'
import {
  PgAgentRunRepository,
  PgEventRepository,
  toPrismaActorType,
  toPrismaPlane,
} from './pg-event-repository.js'
import {
  buildPostModerationColumns,
  readPostModerationColumns,
} from './pg-content-moderation.js'

function toPrismaJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue
}

function toPrismaPublicActorType(actorType: CreatePublicStageThreadInput['author_actor_type'] | CreatePublicStageTurnInput['author_actor_type']) {
  return actorType === 'human' ? 'HUMAN' : 'AGENT'
}

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
          ...buildPostModerationColumns(input.post.moderation_metadata),
        },
      })

      await tx.forumSceneMetadata.create({
        data: {
          targetType: 'POST',
          communityId: input.scene_metadata.community_id,
          postId: postRow.id,
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
          payloadJson: toPrismaJsonValue(input.scene_metadata.payload_json),
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

  async createThread(input: {
    thread: CreatePublicStageThreadInput
    scene_metadata: CreateForumSceneMetadataInput
    event: CreateEventInput
  }): Promise<{ thread: PublicStageThread; event: DomainEvent }> {
    const result = await this.deps.prisma.$transaction(async (tx) => {
      const threadRow = await tx.publicStageThread.create({
        data: {
          ...(input.thread.id ? { id: input.thread.id } : {}),
          postId: input.thread.post_id,
          communityId: input.thread.community_id,
          authorActorType: toPrismaPublicActorType(input.thread.author_actor_type),
          authorAgentId: input.thread.author_agent_id,
          authorUserId: input.thread.author_user_id ?? null,
          body: input.thread.body,
          visibility: input.thread.visibility,
          state: input.thread.state,
          threadState: input.thread.thread_state ?? 'OPEN',
          replyBudget: input.thread.reply_budget ?? 6,
          activeRouteJson: input.thread.active_route === null || input.thread.active_route === undefined
            ? Prisma.DbNull
            : toPrismaJsonValue(input.thread.active_route),
        },
      })

      await tx.forumSceneMetadata.create({
        data: {
          targetType: 'THREAD',
          communityId: input.scene_metadata.community_id,
          postId: input.thread.post_id,
          threadId: threadRow.id,
          turnId: null,
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
          payloadJson: toPrismaJsonValue(input.scene_metadata.payload_json),
        },
      })

      const eventRow = await tx.event.create({
        data: {
          ...(input.event.id ? { id: input.event.id } : {}),
          eventType: input.event.event_type,
          plane: toPrismaPlane(input.event.plane ?? 'DATA'),
          schemaVersion: input.event.schema_version ?? 'v1',
          communityId: input.event.community_id ?? input.scene_metadata.community_id,
          postId: input.thread.post_id,
          roomId: input.event.room_id ?? null,
          actorType: toPrismaActorType(input.event.actor_type ?? 'system'),
          actorId: input.event.actor_id ?? null,
          causeEventId: input.event.cause_event_id ?? null,
          correlationId: input.event.correlation_id ?? null,
          payloadJson: input.event.payload_json as Prisma.InputJsonValue,
          idempotencyKey: input.event.idempotency_key ?? null,
        },
      })

      return { threadRow, eventRow }
    })

    const event = PgEventRepository.toDomain(result.eventRow)
    this.deps.eventRepo.rememberPersisted(event)

    return {
      thread: this.toThread(result.threadRow),
      event,
    }
  }

  async createThreadTurn(input: {
    turn: CreatePublicStageTurnInput
    scene_metadata: CreateForumSceneMetadataInput
    event: CreateEventInput
  }): Promise<{ turn: PublicStageTurn; event: DomainEvent }> {
    const result = await this.deps.prisma.$transaction(async (tx) => {
      const turnRow = await tx.publicStageTurn.create({
        data: {
          ...(input.turn.id ? { id: input.turn.id } : {}),
          threadId: input.turn.thread_id,
          postId: input.turn.post_id,
          authorActorType: toPrismaPublicActorType(input.turn.author_actor_type),
          authorAgentId: input.turn.author_agent_id,
          authorUserId: input.turn.author_user_id ?? null,
          turnIndex: input.turn.turn_index,
          anchorTurnId: input.turn.anchor_turn_id ?? null,
          anchorIntent: input.turn.anchor_intent ?? null,
          quotedExcerpt: input.turn.quoted_excerpt ?? null,
          body: input.turn.body,
          visibility: input.turn.visibility,
          state: input.turn.state,
        },
      })

      await tx.forumSceneMetadata.create({
        data: {
          targetType: 'TURN',
          communityId: input.scene_metadata.community_id,
          postId: input.turn.post_id,
          threadId: null,
          turnId: turnRow.id,
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
          postId: input.turn.post_id,
          roomId: input.event.room_id ?? null,
          actorType: toPrismaActorType(input.event.actor_type ?? 'system'),
          actorId: input.event.actor_id ?? null,
          causeEventId: input.event.cause_event_id ?? null,
          correlationId: input.event.correlation_id ?? null,
          payloadJson: input.event.payload_json as Prisma.InputJsonValue,
          idempotencyKey: input.event.idempotency_key ?? null,
        },
      })

      return { turnRow, eventRow }
    })

    const event = PgEventRepository.toDomain(result.eventRow)
    this.deps.eventRepo.rememberPersisted(event)

    return {
      turn: this.toTurn(result.turnRow),
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
      moderation_metadata: readPostModerationColumns(row),
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private toThread(row: PrismaPublicStageThread): PublicStageThread {
    return {
      id: row.id,
      post_id: row.postId,
      community_id: row.communityId,
      author_actor_type: row.authorActorType === 'HUMAN' ? 'human' : 'agent',
      author_agent_id: row.authorAgentId,
      author_user_id: row.authorUserId,
      body: row.body,
      visibility: row.visibility,
      state: row.state,
      thread_state: row.threadState,
      reply_budget: row.replyBudget,
      active_route: (row.activeRouteJson as PublicStageThread['active_route']) ?? null,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private toTurn(row: PrismaPublicStageTurn): PublicStageTurn {
    return {
      id: row.id,
      thread_id: row.threadId,
      post_id: row.postId,
      author_actor_type: row.authorActorType === 'HUMAN' ? 'human' : 'agent',
      author_agent_id: row.authorAgentId,
      author_user_id: row.authorUserId,
      turn_index: row.turnIndex,
      anchor_turn_id: row.anchorTurnId,
      anchor_intent: row.anchorIntent,
      quoted_excerpt: row.quotedExcerpt,
      body: row.body,
      visibility: row.visibility,
      state: row.state,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
