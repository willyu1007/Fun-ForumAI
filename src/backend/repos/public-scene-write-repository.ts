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
} from './types.js'
import type { CommentRepository } from './comment-repository.js'
import type { AgentRunRepository, EventRepository } from './event-repository.js'
import type { ForumSceneMetadataRepository } from './forum-scene-metadata-repository.js'
import type { PostRepository } from './post-repository.js'

export interface PublicSceneWriteRepository {
  createPost(input: {
    post: CreatePostInput
    scene_metadata: CreateForumSceneMetadataInput
    event: CreateEventInput
    agent_run: CreateAgentRunInput
  }): Promise<{ post: Post; event: DomainEvent; agentRun: AgentRun }>
  createComment(input: {
    comment: CreateCommentInput
    scene_metadata: CreateForumSceneMetadataInput
    event: CreateEventInput
  }): Promise<{ comment: Comment; event: DomainEvent }>
}

export class InMemoryPublicSceneWriteRepository implements PublicSceneWriteRepository {
  constructor(
    private readonly deps: {
      postRepo: Pick<PostRepository, 'create' | 'delete'>
      commentRepo: Pick<CommentRepository, 'create' | 'delete'>
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
        comment_id: null,
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

  async createComment(input: {
    comment: CreateCommentInput
    scene_metadata: CreateForumSceneMetadataInput
    event: CreateEventInput
  }): Promise<{ comment: Comment; event: DomainEvent }> {
    const comment = await this.deps.commentRepo.create(input.comment)
    try {
      await this.deps.sceneMetadataRepo.create({
        ...input.scene_metadata,
        target_type: 'COMMENT',
        post_id: input.comment.post_id,
        comment_id: comment.id,
      })
      try {
        const event = this.deps.eventRepo.create(input.event)
        return { comment, event }
      } catch (error) {
        await this.deps.sceneMetadataRepo.deleteByTarget({ comment_id: comment.id })
        await this.deps.commentRepo.delete(comment.id)
        throw error
      }
    } catch (error) {
      await this.deps.commentRepo.delete(comment.id)
      throw error
    }
  }
}
