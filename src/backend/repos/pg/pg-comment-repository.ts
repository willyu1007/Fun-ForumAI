import { type PrismaClient } from '@prisma/client'
import type {
  Comment,
  PaginatedResult,
  PaginationOpts,
} from '../types.js'
import type { CommentRepository } from '../comment-repository.js'
import { PgPublicStageThreadRepository } from './pg-public-stage-thread-repository.js'
import { PgPublicStageTurnRepository } from './pg-public-stage-turn-repository.js'

export class PgCommentRepository implements CommentRepository {
  private readonly threadRepo: PgPublicStageThreadRepository
  private readonly turnRepo: PgPublicStageTurnRepository

  constructor(private readonly prisma: PrismaClient) {
    this.threadRepo = new PgPublicStageThreadRepository(prisma)
    this.turnRepo = new PgPublicStageTurnRepository(prisma)
  }

  // DB-first mode: no local cache to hydrate.
  async hydrate(): Promise<void> {}

  async create(input: import('../types.js').CreateCommentInput): Promise<Comment> {
    if (!input.parent_comment_id) {
      const post = await this.prisma.post.findUnique({
        where: { id: input.post_id },
        select: { communityId: true },
      })
      const thread = await this.threadRepo.create({
        id: input.id,
        post_id: input.post_id,
        community_id: post?.communityId ?? input.post_id,
        author_agent_id: input.author_agent_id,
        body: input.body,
        visibility: input.visibility,
        state: input.state,
      })
      return toCompatThreadComment(thread)
    }

    const parentThread = await this.threadRepo.findById(input.parent_comment_id)
    const parentTurn = parentThread ? null : await this.turnRepo.findById(input.parent_comment_id)
    if (!parentThread && !parentTurn) {
      throw new Error(`Parent comment not found: ${input.parent_comment_id}`)
    }
    const threadId = parentThread?.id ?? parentTurn!.thread_id
    const turnIndex = await this.turnRepo.countByThread(threadId) + 1
    const turn = await this.turnRepo.create({
      id: input.id,
      thread_id: threadId,
      post_id: input.post_id,
      author_agent_id: input.author_agent_id,
      turn_index: turnIndex,
      anchor_turn_id: parentTurn?.id ?? null,
      body: input.body,
      visibility: input.visibility,
      state: input.state,
    })
    return toCompatTurnComment(turn, {
      parent_comment_id: input.parent_comment_id,
    })
  }

  async findById(id: string): Promise<Comment | null> {
    const thread = await this.threadRepo.findById(id)
    if (thread) return toCompatThreadComment(thread)
    const turn = await this.turnRepo.findById(id)
    return turn ? toCompatTurnComment(turn) : null
  }

  async findByPost(
    postId: string,
    opts: PaginationOpts,
  ): Promise<PaginatedResult<Comment>> {
    return paginate(await this.listCompatComments(postId, { includeAll: false }), opts)
  }

  async findByPostAll(
    postId: string,
    opts: PaginationOpts,
  ): Promise<PaginatedResult<Comment>> {
    return paginate(await this.listCompatComments(postId, { includeAll: true }), opts)
  }

  async findPublicByAuthorAgent(
    agentId: string,
    opts: PaginationOpts,
  ): Promise<PaginatedResult<Comment>> {
    const [threads, turns] = await Promise.all([
      this.threadRepo.findPublicByAuthorAgent(agentId, { cursor: undefined, limit: 10_000 }),
      this.turnRepo.findPublicByAuthorAgent(agentId, { cursor: undefined, limit: 10_000 }),
    ])
    return paginate(
      [
        ...threads.items.map((item) => toCompatThreadComment(item)),
        ...turns.items.map((item) => toCompatTurnComment(item)),
      ].sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id)),
      opts,
    )
  }

  async findByPostsSince(postIds: string[], since: Date): Promise<Comment[]> {
    const [threads, turns] = await Promise.all([
      this.threadRepo.findByPostsSince(postIds, since),
      this.turnRepo.findByPostsSince(postIds, since),
    ])
    return [
      ...threads.map((item) => toCompatThreadComment(item)),
      ...turns.map((item) => toCompatTurnComment(item)),
    ].sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id))
  }

  async countByPost(postId: string): Promise<number> {
    const threads = await this.threadRepo.findByPost(postId, { cursor: undefined, limit: 10_000 })
    const turns = await this.turnRepo.findByThreads(threads.items.map((item) => item.id))
    return threads.items.length
      + turns.filter((item) => item.state === 'APPROVED')
        .filter((item) => item.visibility === 'PUBLIC' || item.visibility === 'GRAY')
        .length
  }

  async delete(id: string): Promise<void> {
    const thread = await this.threadRepo.findById(id)
    if (thread) {
      await this.turnRepo.deleteByThread(thread.id)
      await this.threadRepo.delete(thread.id)
      return
    }
    await this.turnRepo.delete(id)
  }

  async updateVisibility(
    id: string,
    visibility: Comment['visibility'],
  ): Promise<Comment | null> {
    const thread = await this.threadRepo.updateVisibility(id, visibility)
    if (thread) return toCompatThreadComment(thread)
    const turn = await this.turnRepo.updateVisibility(id, visibility)
    return turn ? toCompatTurnComment(turn) : null
  }

  async updateState(id: string, state: Comment['state']): Promise<Comment | null> {
    const thread = await this.threadRepo.updateState(id, state)
    if (thread) return toCompatThreadComment(thread)
    const turn = await this.turnRepo.updateState(id, state)
    return turn ? toCompatTurnComment(turn) : null
  }

  private async listCompatComments(postId: string, input: { includeAll: boolean }): Promise<Comment[]> {
    const threads = input.includeAll
      ? await this.threadRepo.findByPostAll(postId, { cursor: undefined, limit: 10_000 })
      : await this.threadRepo.findByPost(postId, { cursor: undefined, limit: 10_000 })
    const turns = await this.turnRepo.findByThreads(threads.items.map((item) => item.id))
    const normalizedTurns = input.includeAll
      ? turns
      : turns
        .filter((item) => item.state === 'APPROVED')
        .filter((item) => item.visibility === 'PUBLIC' || item.visibility === 'GRAY')

    return [
      ...threads.items.map((item) => toCompatThreadComment(item)),
      ...normalizedTurns.map((item) => toCompatTurnComment(item)),
    ].sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id))
  }
}

function toCompatThreadComment(
  thread: import('../types.js').PublicStageThread,
): Comment {
  return {
    id: thread.id,
    post_id: thread.post_id,
    parent_comment_id: null,
    thread_id: thread.id,
    comment_kind: 'THREAD',
    anchor_comment_id: null,
    author_agent_id: thread.author_agent_id,
    body: thread.body,
    visibility: thread.visibility,
    state: thread.state,
    created_at: thread.created_at,
    updated_at: thread.updated_at,
  }
}

function toCompatTurnComment(
  turn: import('../types.js').PublicStageTurn,
  overrides?: { parent_comment_id?: string | null },
): Comment {
  return {
    id: turn.id,
    post_id: turn.post_id,
    parent_comment_id: overrides?.parent_comment_id ?? turn.anchor_turn_id ?? turn.thread_id,
    thread_id: turn.thread_id,
    comment_kind: 'TURN',
    anchor_comment_id: turn.anchor_turn_id,
    author_agent_id: turn.author_agent_id,
    body: turn.body,
    visibility: turn.visibility,
    state: turn.state,
    created_at: turn.created_at,
    updated_at: turn.updated_at,
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
