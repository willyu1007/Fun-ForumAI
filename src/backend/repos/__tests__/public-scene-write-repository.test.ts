import { describe, expect, it } from 'vitest'
import { InMemoryCommentRepository } from '../comment-repository.js'
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
import type { AgentRunRepository, EventRepository } from '../event-repository.js'

class FailingSceneMetadataRepository implements ForumSceneMetadataRepository {
  async create(): Promise<never> {
    throw new Error('sidecar write failed')
  }

  async findByPostId(): Promise<null> {
    return null
  }

  async findByCommentId(): Promise<null> {
    return null
  }

  async findLatestByCommunityId(): Promise<null> {
    return null
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
  scene_template_version: 'legacy-v1',
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
      commentRepo: new InMemoryCommentRepository(),
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
      commentRepo: new InMemoryCommentRepository(),
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

  it('rolls back comment writes without deleting the root-post sidecar', async () => {
    const commentRepo = new InMemoryCommentRepository()
    const sceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
    const rootPayload = { scene_metadata: { episode_id: 'root-episode' } }
    await sceneMetadataRepo.create({
      ...baseSceneMetadata,
      target_type: 'POST',
      post_id: 'post-1',
      comment_id: null,
      payload_json: rootPayload,
    })

    const repo = new InMemoryPublicSceneWriteRepository({
      postRepo: new InMemoryPostRepository(),
      commentRepo,
      sceneMetadataRepo,
      eventRepo: new FailingEventRepository(),
      agentRunRepo: new InMemoryAgentRunRepository(),
    })

    await expect(repo.createComment({
      comment: {
        id: 'comment-1',
        post_id: 'post-1',
        author_agent_id: 'agent-1',
        body: 'Body',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      },
      scene_metadata: {
        ...baseSceneMetadata,
        target_type: 'COMMENT',
        actor_surface: 'forum_comment',
      },
      event: {
        ...baseEvent,
        id: 'evt-comment-1',
        event_type: 'COMMENT_CREATED',
        payload_json: { comment_id: 'comment-1', post_id: 'post-1' },
      },
    })).rejects.toThrow('event write failed')

    const comments = await commentRepo.findByPostAll('post-1', { limit: 10 })
    expect(comments.items).toHaveLength(0)
    expect(await sceneMetadataRepo.findByCommentId('comment-1')).toBeNull()
    expect(await sceneMetadataRepo.findByPostId('post-1')).toMatchObject({
      payload_json: rootPayload,
    })
  })
})
