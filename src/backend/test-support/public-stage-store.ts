import type { PaginatedResult, PaginationOpts, PostRepository, PublicStageThreadTurn } from '../repos/index.js'
import { InMemoryPublicStageThreadRepository, type PublicStageThreadRepository } from '../repos/public-stage-thread-repository.js'
import { InMemoryPublicStageTurnRepository, type PublicStageTurnRepository } from '../repos/public-stage-turn-repository.js'
import {
  countVisiblePublicStageThreadTurnsByPost,
  findPublicStageThreadTurnById,
  listPublicStageThreadTurnsByPost,
  toPublicStageThreadTurnFromThread,
  toPublicStageThreadTurnFromTurn,
} from '../lib/public-stage-thread-turn.js'

export class InMemoryPublicStageStore {
  readonly threadRepo: PublicStageThreadRepository
  readonly turnRepo: PublicStageTurnRepository

  constructor(deps?: {
    threadRepo?: PublicStageThreadRepository
    turnRepo?: PublicStageTurnRepository
    postRepo?: Pick<PostRepository, 'findById'> | null
  }) {
    this.threadRepo = deps?.threadRepo ?? new InMemoryPublicStageThreadRepository()
    this.turnRepo = deps?.turnRepo ?? new InMemoryPublicStageTurnRepository()
    this.postRepo = deps?.postRepo ?? null
  }

  private readonly postRepo: Pick<PostRepository, 'findById'> | null

  async create(input: {
    id?: string
    post_id: string
    parent_entry_id?: string | null
    author_actor_type?: 'agent' | 'human'
    author_agent_id?: string | null
    author_user_id?: string | null
    body: string
    visibility: PublicStageThreadTurn['visibility']
    state: PublicStageThreadTurn['state']
  }): Promise<PublicStageThreadTurn> {
    if (!input.parent_entry_id) {
      const post = this.postRepo ? await this.postRepo.findById(input.post_id) : null
      const thread = await this.threadRepo.create({
        id: input.id,
        post_id: input.post_id,
        community_id: post?.community_id ?? input.post_id,
        author_actor_type: input.author_actor_type ?? 'agent',
        author_agent_id: input.author_agent_id ?? null,
        author_user_id: input.author_user_id ?? null,
        body: input.body,
        visibility: input.visibility,
        state: input.state,
      })
      return toPublicStageThreadTurnFromThread(thread)
    }

    const parentThread = await this.threadRepo.findById(input.parent_entry_id)
    const parentTurn = parentThread ? null : await this.turnRepo.findById(input.parent_entry_id)
    if (!parentThread && !parentTurn) {
      throw new Error(`Parent stage entry not found: ${input.parent_entry_id}`)
    }

    const threadId = parentThread?.id ?? parentTurn!.thread_id
    const turnIndex = await this.turnRepo.countAllByThread(threadId) + 1
    const turn = await this.turnRepo.create({
      id: input.id,
      thread_id: threadId,
      post_id: input.post_id,
      author_actor_type: input.author_actor_type ?? 'agent',
      author_agent_id: input.author_agent_id ?? null,
      author_user_id: input.author_user_id ?? null,
      turn_index: turnIndex,
      anchor_turn_id: parentTurn?.id ?? null,
      body: input.body,
      visibility: input.visibility,
      state: input.state,
    })
    return toPublicStageThreadTurnFromTurn(turn)
  }

  async findById(id: string): Promise<PublicStageThreadTurn | null> {
    return findPublicStageThreadTurnById({
      publicStageThreadRepo: this.threadRepo,
      publicStageTurnRepo: this.turnRepo,
    }, id)
  }

  async findByPostAll(postId: string, opts: PaginationOpts): Promise<PaginatedResult<PublicStageThreadTurn>> {
    const items = await listPublicStageThreadTurnsByPost({
      publicStageThreadRepo: this.threadRepo,
      publicStageTurnRepo: this.turnRepo,
    }, postId, { includeAll: true })
    return paginate(items, opts)
  }

  async countByPost(postId: string): Promise<number> {
    return countVisiblePublicStageThreadTurnsByPost({
      publicStageThreadRepo: this.threadRepo,
      publicStageTurnRepo: this.turnRepo,
    }, postId)
  }
}

function paginate<T extends { id: string }>(items: T[], opts: PaginationOpts): PaginatedResult<T> {
  let start = 0
  if (opts.cursor) {
    const index = items.findIndex((item) => item.id === opts.cursor)
    start = index >= 0 ? index + 1 : 0
  }
  const page = items.slice(start, start + opts.limit)
  const next_cursor = page.length === opts.limit && start + opts.limit < items.length
    ? page[page.length - 1].id
    : null
  return { items: page, next_cursor }
}
