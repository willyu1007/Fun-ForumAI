import { describe, expect, it } from 'vitest'
import {
  InMemoryAgentRunRepository,
  InMemoryEventRepository,
} from '../event-repository.js'
import {
  InMemoryForumSceneMetadataRepository,
  type ForumSceneMetadataRepository,
} from '../forum-scene-metadata-repository.js'
import { InMemoryPostRepository } from '../post-repository.js'
import { InMemoryPublicSceneWriteRepository } from '../public-scene-write-repository.js'
import { InMemoryPublicStageThreadRepository } from '../public-stage-thread-repository.js'
import { InMemoryPublicStageTurnRepository } from '../public-stage-turn-repository.js'
import type { AgentRunRepository, EventRepository } from '../event-repository.js'

class FailingSceneMetadataRepository implements ForumSceneMetadataRepository {
  async create(): Promise<never> {
    throw new Error('sidecar write failed')
  }

  async findByPostId(): Promise<null> {
    return null
  }

  async findByThreadId(): Promise<null> {
    return null
  }

  async findByTurnId(): Promise<null> {
    return null
  }

  async findByCommentId(): Promise<null> {
    return null
  }

  async findLatestByCommunityId(): Promise<null> {
    return null
  }

  async listByCommunityIdSince(): Promise<[]> {
    return []
  }

  async listByEpisodeId(): Promise<[]> {
    return []
  }

  async deleteByTarget(): Promise<void> {}
}

class FailingEventRepository implements Pick<EventRepository, 'create'> {
  create(): never {
    throw new Error('event write failed')
  }

  delete(): void {}
}

class FailingAgentRunRepository implements Pick<AgentRunRepository, 'create'> {
  create(): never {
    throw new Error('agent run write failed')
  }

  delete(): void {}
}

const baseSceneMetadata = {
  target_type: 'POST' as const,
  community_id: 'community-1',
  episode_id: 'episode-1',
  selection_id: 'selection-1',
  episode_plan_id: 'plan-1',
  local_intent_id: 'intent-1',
  director_surface: 'scheduled_post',
  actor_surface: 'forum_post',
  scene_template_id: 'stage-theme-01',
  scene_template_version: 'v2',
  scene_binding_id: 'binding-1',
  overlay_id: null,
  beat_id: null,
  phase: 'opening' as const,
  selection_mode: 'pool_guided' as const,
  expires_at: null,
  payload_json: { scene_metadata: { episode_id: 'episode-1' } },
}

const baseEvent = {
  id: 'evt-1',
  event_type: 'POST_CREATED',
  plane: 'DATA' as const,
  schema_version: 'v1' as const,
  community_id: 'community-1',
  post_id: 'post-1',
  actor_type: 'agent' as const,
  actor_id: 'agent-1',
  correlation_id: 'post:post-1',
  payload_json: { post_id: 'post-1' },
}

const baseAgentRun = {
  id: 'run-1',
  agent_id: 'agent-1',
  trigger_event_id: 'evt-1',
  input_digest: 'digest',
  output_json: { post_id: 'post-1' },
  moderation_result: 'APPROVE' as const,
}

describe('InMemoryPublicSceneWriteRepository', () => {
  it('rolls back post writes when scene sidecar persistence fails', async () => {
    const postRepo = new InMemoryPostRepository()
    const eventRepo = new InMemoryEventRepository()
    const agentRunRepo = new InMemoryAgentRunRepository()
    const repo = new InMemoryPublicSceneWriteRepository({
      postRepo,
      publicStageThreadRepo: new InMemoryPublicStageThreadRepository(),
      publicStageTurnRepo: new InMemoryPublicStageTurnRepository(),
      sceneMetadataRepo: new FailingSceneMetadataRepository(),
      eventRepo,
      agentRunRepo,
    })

    await expect(repo.createPost({
      post: {
        id: 'post-1',
        community_id: 'community-1',
        author_agent_id: 'agent-1',
        title: 'Title',
        body: 'Body',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      },
      scene_metadata: baseSceneMetadata,
      event: baseEvent,
      agent_run: baseAgentRun,
    })).rejects.toThrow('sidecar write failed')

    const posts = await postRepo.findByAuthor('agent-1', { limit: 10 })
    expect(posts.items).toHaveLength(0)
    expect(eventRepo.findByPostId('post-1')).toHaveLength(0)
    expect(agentRunRepo.findByAgent('agent-1', { limit: 10 }).items).toHaveLength(0)
  })

  it('rolls back post, sidecar, and event when agent run persistence fails', async () => {
    const postRepo = new InMemoryPostRepository()
    const sceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
    const eventRepo = new InMemoryEventRepository()
    const repo = new InMemoryPublicSceneWriteRepository({
      postRepo,
      publicStageThreadRepo: new InMemoryPublicStageThreadRepository(),
      publicStageTurnRepo: new InMemoryPublicStageTurnRepository(),
      sceneMetadataRepo,
      eventRepo,
      agentRunRepo: new FailingAgentRunRepository(),
    })

    await expect(repo.createPost({
      post: {
        id: 'post-1',
        community_id: 'community-1',
        author_agent_id: 'agent-1',
        title: 'Title',
        body: 'Body',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      },
      scene_metadata: baseSceneMetadata,
      event: baseEvent,
      agent_run: baseAgentRun,
    })).rejects.toThrow('agent run write failed')

    const posts = await postRepo.findByAuthor('agent-1', { limit: 10 })
    expect(posts.items).toHaveLength(0)
    expect(await sceneMetadataRepo.findByPostId('post-1')).toBeNull()
    expect(eventRepo.findByPostId('post-1')).toHaveLength(0)
  })

  it('rolls back thread writes without deleting the root-post sidecar', async () => {
    const publicStageThreadRepo = new InMemoryPublicStageThreadRepository()
    const publicStageTurnRepo = new InMemoryPublicStageTurnRepository()
    const sceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
    const rootPayload = { scene_metadata: { episode_id: 'root-episode' } }
    await sceneMetadataRepo.create({
      ...baseSceneMetadata,
      target_type: 'POST',
      post_id: 'post-1',
      thread_id: null,
      turn_id: null,
      payload_json: rootPayload,
    })

    const repo = new InMemoryPublicSceneWriteRepository({
      postRepo: new InMemoryPostRepository(),
      publicStageThreadRepo,
      publicStageTurnRepo,
      sceneMetadataRepo,
      eventRepo: new FailingEventRepository(),
      agentRunRepo: new InMemoryAgentRunRepository(),
    })

    await expect(repo.createThread({
      thread: {
        id: 'thread-1',
        post_id: 'post-1',
        community_id: 'community-1',
        author_agent_id: 'agent-1',
        body: 'Body',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      },
      scene_metadata: {
        ...baseSceneMetadata,
        target_type: 'THREAD',
        actor_surface: 'forum_thread',
      },
      event: {
        ...baseEvent,
        id: 'evt-thread-1',
        event_type: 'THREAD_OPENED',
        payload_json: { thread_id: 'thread-1', post_id: 'post-1' },
      },
    })).rejects.toThrow('event write failed')

    const threads = await publicStageThreadRepo.findByPostAll('post-1', { limit: 10 })
    expect(threads.items).toHaveLength(0)
    expect(await sceneMetadataRepo.findByThreadId('thread-1')).toBeNull()
    expect(await sceneMetadataRepo.findByPostId('post-1')).toMatchObject({
      payload_json: rootPayload,
    })
  })

  it('stores turn scene metadata on the turn only and preserves thread scene ownership', async () => {
    const eventRepo = new InMemoryEventRepository()
    const sceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
    const repo = new InMemoryPublicSceneWriteRepository({
      postRepo: new InMemoryPostRepository(),
      publicStageThreadRepo: new InMemoryPublicStageThreadRepository(),
      publicStageTurnRepo: new InMemoryPublicStageTurnRepository(),
      sceneMetadataRepo,
      eventRepo,
      agentRunRepo: new InMemoryAgentRunRepository(),
    })

    const threadResult = await repo.createThread({
      thread: {
        id: 'thread-1',
        post_id: 'post-1',
        community_id: 'community-1',
        author_agent_id: 'agent-1',
        body: 'Thread body',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      },
      scene_metadata: {
        ...baseSceneMetadata,
        target_type: 'THREAD',
        actor_surface: 'forum_thread',
      },
      event: {
        ...baseEvent,
        id: 'evt-thread-1',
        event_type: 'THREAD_OPENED',
        payload_json: { thread_id: 'thread-1', post_id: 'post-1' },
      },
    })

    const turnResult = await repo.createThreadTurn({
      turn: {
        id: 'turn-1',
        thread_id: threadResult.thread.id,
        post_id: 'post-1',
        author_actor_type: 'agent',
        author_agent_id: 'agent-2',
        body: 'Turn body',
        turn_index: 1,
        visibility: 'PUBLIC',
        state: 'APPROVED',
      },
      scene_metadata: {
        ...baseSceneMetadata,
        target_type: 'TURN',
        actor_surface: 'forum_thread',
      },
      event: {
        ...baseEvent,
        id: 'evt-turn-1',
        event_type: 'THREAD_TURN_ADDED',
        payload_json: { thread_id: threadResult.thread.id, turn_id: 'turn-1', post_id: 'post-1' },
      },
    })

    const threadSidecar = await sceneMetadataRepo.findByThreadId(threadResult.thread.id)
    const turnSidecar = await sceneMetadataRepo.findByTurnId(turnResult.turn.id)
    expect(threadSidecar?.thread_id).toBe(threadResult.thread.id)
    expect(turnSidecar?.turn_id).toBe(turnResult.turn.id)
    expect(turnSidecar?.thread_id).toBeNull()
    expect(eventRepo.findByPostId('post-1')).toHaveLength(2)
  })
})
