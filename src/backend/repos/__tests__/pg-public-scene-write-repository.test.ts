import { describe, expect, it, vi } from 'vitest'
import { PgPublicSceneWriteRepository } from '../pg/pg-public-scene-write-repository.js'

describe('PgPublicSceneWriteRepository', () => {
  it('does not reuse threadId when persisting turn scene metadata', async () => {
    const publicStageTurnCreate = vi.fn().mockResolvedValue({
      id: 'turn-1',
      threadId: 'thread-1',
      postId: 'post-1',
      authorActorType: 'AGENT',
      authorAgentId: 'agent-2',
      authorUserId: null,
      turnIndex: 1,
      anchorTurnId: null,
      anchorIntent: null,
      quotedExcerpt: null,
      body: 'Turn body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
      governanceBatchId: null,
      generationMode: null,
      createdAt: new Date('2026-04-23T12:00:00.000Z'),
      updatedAt: new Date('2026-04-23T12:00:00.000Z'),
    })
    const sceneMetadataCreate = vi.fn().mockResolvedValue({
      id: 'fsm-turn-1',
    })
    const eventCreate = vi.fn().mockResolvedValue({
      id: 'evt-turn-1',
      eventType: 'THREAD_TURN_ADDED',
      plane: 'DATA',
      schemaVersion: 'v1',
      communityId: 'community-1',
      postId: 'post-1',
      roomId: null,
      actorType: 'AGENT',
      actorId: 'agent-2',
      causeEventId: null,
      correlationId: 'thread:thread-1',
      payloadJson: { thread_id: 'thread-1', turn_id: 'turn-1', post_id: 'post-1' },
      idempotencyKey: null,
      createdAt: new Date('2026-04-23T12:00:00.000Z'),
    })
    const prisma = {
      $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback({
        publicStageTurn: { create: publicStageTurnCreate },
        forumSceneMetadata: { create: sceneMetadataCreate },
        event: { create: eventCreate },
      })),
    }
    const eventRepo = {
      rememberPersisted: vi.fn(),
    }
    const agentRunRepo = {
      rememberPersisted: vi.fn(),
    }
    const repo = new PgPublicSceneWriteRepository({
      prisma: prisma as never,
      eventRepo: eventRepo as never,
      agentRunRepo: agentRunRepo as never,
    })

    await repo.createThreadTurn({
      turn: {
        id: 'turn-1',
        thread_id: 'thread-1',
        post_id: 'post-1',
        author_actor_type: 'agent',
        author_agent_id: 'agent-2',
        body: 'Turn body',
        turn_index: 1,
        visibility: 'PUBLIC',
        state: 'APPROVED',
      },
      scene_metadata: {
        target_type: 'TURN',
        community_id: 'community-1',
        post_id: 'post-1',
        thread_id: 'thread-1',
        episode_id: 'episode-1',
        selection_id: 'selection-1',
        episode_plan_id: 'plan-1',
        local_intent_id: 'intent-1',
        director_surface: 'scheduled_post',
        actor_surface: 'forum_thread',
        scene_template_id: 'stage-theme-01',
        scene_template_version: 'v2',
        scene_binding_id: 'binding-1',
        overlay_id: null,
        beat_id: null,
        phase: 'opening',
        selection_mode: 'pool_guided',
        expires_at: null,
        payload_json: { scene_metadata: { episode_id: 'episode-1' } },
      },
      event: {
        id: 'evt-turn-1',
        event_type: 'THREAD_TURN_ADDED',
        plane: 'DATA',
        schema_version: 'v1',
        community_id: 'community-1',
        post_id: 'post-1',
        actor_type: 'agent',
        actor_id: 'agent-2',
        correlation_id: 'thread:thread-1',
        payload_json: { thread_id: 'thread-1', turn_id: 'turn-1', post_id: 'post-1' },
      },
    })

    expect(sceneMetadataCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        targetType: 'TURN',
        postId: 'post-1',
        threadId: null,
        turnId: 'turn-1',
      }),
    }))
  })
})
