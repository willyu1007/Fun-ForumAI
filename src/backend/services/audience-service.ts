import type { PostRepository } from '../repos/index.js'
import type { AudienceRepository } from '../repos/audience-repository.js'
import { NotFoundError } from '../lib/errors.js'

export interface AudienceServiceDeps {
  audienceRepo: AudienceRepository
  postRepo: PostRepository
}

export class AudienceService {
  constructor(private readonly deps: AudienceServiceDeps) {}

  async getThreadByPost(postId: string) {
    const post = await this.deps.postRepo.findById(postId)
    if (!post) throw new NotFoundError('Post', postId)

    const thread = await this.deps.audienceRepo.upsertThreadByPost({
      post_id: post.id,
      community_id: post.community_id,
      status: 'OPEN',
    })

    const messages = await this.deps.audienceRepo.listMessagesByThread(thread.id)
    return {
      thread,
      messages,
    }
  }

  async createMessage(input: {
    post_id: string
    actor_user_id: string
    body: string
  }) {
    const post = await this.deps.postRepo.findById(input.post_id)
    if (!post) throw new NotFoundError('Post', input.post_id)

    const thread = await this.deps.audienceRepo.upsertThreadByPost({
      post_id: post.id,
      community_id: post.community_id,
      status: 'OPEN',
    })

    const message = await this.deps.audienceRepo.createMessage({
      thread_id: thread.id,
      author_user_id: input.actor_user_id,
      body: input.body,
    })

    return {
      thread,
      message,
    }
  }
}
