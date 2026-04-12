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
} from './types.js'
import type { AgentRunRepository, EventRepository } from './event-repository.js'
import type { ForumSceneMetadataRepository } from './forum-scene-metadata-repository.js'
import type { PostRepository } from './post-repository.js'
import type { PublicStageThreadRepository } from './public-stage-thread-repository.js'
import type { PublicStageTurnRepository } from './public-stage-turn-repository.js'

export interface PublicSceneWriteRepository {
  createPost(input: {
    post: CreatePostInput
    scene_metadata: CreateForumSceneMetadataInput
    event: CreateEventInput
    agent_run: CreateAgentRunInput
  }): Promise<{ post: Post; event: DomainEvent; agentRun: AgentRun }>
  createThread(input: {
    thread: CreatePublicStageThreadInput
    scene_metadata: CreateForumSceneMetadataInput
    event: CreateEventInput
  }): Promise<{ thread: PublicStageThread; event: DomainEvent }>
  createThreadTurn(input: {
    turn: CreatePublicStageTurnInput
    scene_metadata: CreateForumSceneMetadataInput
    event: CreateEventInput
  }): Promise<{ turn: PublicStageTurn; event: DomainEvent }>
}

export class InMemoryPublicSceneWriteRepository implements PublicSceneWriteRepository {
  constructor(
    private readonly deps: {
      postRepo: Pick<PostRepository, 'create' | 'delete'>
      publicStageThreadRepo: Pick<PublicStageThreadRepository, 'create' | 'delete'>
      publicStageTurnRepo: Pick<PublicStageTurnRepository, 'create' | 'delete'>
      sceneMetadataRepo: ForumSceneMetadataRepository
      eventRepo: Pick<EventRepository, 'create'> & { delete(id: string): void }
      agentRunRepo: Pick<AgentRunRepository, 'create'> & { delete(id: string): void }
    },
  ) {}

  async createPost(input: {
    post: CreatePostInput
    scene_metadata: CreateForumSceneMetadataInput
    event: CreateEventInput
    agent_run: CreateAgentRunInput
  }): Promise<{ post: Post; event: DomainEvent; agentRun: AgentRun }> {
    const post = await this.deps.postRepo.create(input.post)
    try {
      await this.deps.sceneMetadataRepo.create({
        ...input.scene_metadata,
        target_type: 'POST',
        post_id: post.id,
      })
      try {
        const event = this.deps.eventRepo.create(input.event)
        try {
          const agentRun = this.deps.agentRunRepo.create(input.agent_run)
          return { post, event, agentRun }
        } catch (error) {
          this.deps.eventRepo.delete(event.id)
          await this.deps.sceneMetadataRepo.deleteByTarget({ post_id: post.id })
          await this.deps.postRepo.delete(post.id)
          throw error
        }
      } catch (error) {
        await this.deps.sceneMetadataRepo.deleteByTarget({ post_id: post.id })
        await this.deps.postRepo.delete(post.id)
        throw error
      }
    } catch (error) {
      await this.deps.postRepo.delete(post.id)
      throw error
    }
  }

  async createThread(input: {
    thread: CreatePublicStageThreadInput
    scene_metadata: CreateForumSceneMetadataInput
    event: CreateEventInput
  }): Promise<{ thread: PublicStageThread; event: DomainEvent }> {
    const thread = await this.deps.publicStageThreadRepo.create(input.thread)
    try {
      await this.deps.sceneMetadataRepo.create({
        ...input.scene_metadata,
        target_type: 'THREAD',
        post_id: input.thread.post_id,
        thread_id: thread.id,
        turn_id: null,
      })
      try {
        const event = this.deps.eventRepo.create(input.event)
        return { thread, event }
      } catch (error) {
        await this.deps.sceneMetadataRepo.deleteByTarget({ thread_id: thread.id })
        await this.deps.publicStageThreadRepo.delete(thread.id)
        throw error
      }
    } catch (error) {
      await this.deps.publicStageThreadRepo.delete(thread.id)
      throw error
    }
  }

  async createThreadTurn(input: {
    turn: CreatePublicStageTurnInput
    scene_metadata: CreateForumSceneMetadataInput
    event: CreateEventInput
  }): Promise<{ turn: PublicStageTurn; event: DomainEvent }> {
    const turn = await this.deps.publicStageTurnRepo.create(input.turn)
    try {
      await this.deps.sceneMetadataRepo.create({
        ...input.scene_metadata,
        target_type: 'TURN',
        post_id: input.turn.post_id,
        thread_id: input.turn.thread_id,
        turn_id: turn.id,
      })
      try {
        const event = this.deps.eventRepo.create(input.event)
        return { turn, event }
      } catch (error) {
        await this.deps.sceneMetadataRepo.deleteByTarget({ turn_id: turn.id })
        await this.deps.publicStageTurnRepo.delete(turn.id)
        throw error
      }
    } catch (error) {
      await this.deps.publicStageTurnRepo.delete(turn.id)
      throw error
    }
  }
}
