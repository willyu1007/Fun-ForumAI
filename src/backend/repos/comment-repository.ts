import type { Comment, CreateCommentInput, PaginatedResult, PaginationOpts } from './types.js'

export interface CommentRepository {
  create(input: CreateCommentInput): Promise<Comment>
  findById(id: string): Promise<Comment | null>
  findByPost(postId: string, opts: PaginationOpts): Promise<PaginatedResult<Comment>>
  findByPostAll(postId: string, opts: PaginationOpts): Promise<PaginatedResult<Comment>>
  findByPostsSince(postIds: string[], since: Date): Promise<Comment[]>
  countByPost(postId: string): Promise<number>
  delete(id: string): Promise<void>
  updateVisibility(id: string, visibility: Comment['visibility']): Promise<Comment | null>
  updateState(id: string, state: Comment['state']): Promise<Comment | null>
}

let counter = 0
function cuid(): string {
  return `cmt_${Date.now()}_${++counter}`
}

export class InMemoryCommentRepository implements CommentRepository {
  private store = new Map<string, Comment>()

  async create(input: CreateCommentInput): Promise<Comment> {
    const now = new Date()
    const comment: Comment = {
      id: input.id ?? cuid(),
      post_id: input.post_id,
      parent_comment_id: input.parent_comment_id ?? null,
      author_agent_id: input.author_agent_id,
      body: input.body,
      visibility: input.visibility,
      state: input.state,
      created_at: now,
      updated_at: now,
    }
    this.store.set(comment.id, comment)
    return comment
  }

  async findById(id: string): Promise<Comment | null> {
    return this.store.get(id) ?? null
  }

  async findByPost(postId: string, opts: PaginationOpts): Promise<PaginatedResult<Comment>> {
    const items = Array.from(this.store.values())
      .filter((c) => c.post_id === postId && c.state === 'APPROVED')
      .filter((c) => c.visibility === 'PUBLIC' || c.visibility === 'GRAY')
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
    return paginate(items, opts)
  }

  async findByPostAll(postId: string, opts: PaginationOpts): Promise<PaginatedResult<Comment>> {
    const items = Array.from(this.store.values())
      .filter((c) => c.post_id === postId)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
    return paginate(items, opts)
  }

  async findByPostsSince(postIds: string[], since: Date): Promise<Comment[]> {
    if (postIds.length === 0) return []
    const postIdSet = new Set(postIds)
    return Array.from(this.store.values())
      .filter((c) => postIdSet.has(c.post_id))
      .filter((c) => c.created_at >= since)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id))
  }

  async countByPost(postId: string): Promise<number> {
    return Array.from(this.store.values())
      .filter((c) => c.post_id === postId && c.state === 'APPROVED')
      .filter((c) => c.visibility === 'PUBLIC' || c.visibility === 'GRAY')
      .length
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id)
  }

  async updateVisibility(id: string, visibility: Comment['visibility']): Promise<Comment | null> {
    const c = this.store.get(id)
    if (!c) return null
    c.visibility = visibility
    c.updated_at = new Date()
    return c
  }

  async updateState(id: string, state: Comment['state']): Promise<Comment | null> {
    const c = this.store.get(id)
    if (!c) return null
    c.state = state
    c.updated_at = new Date()
    return c
  }
}

function paginate<T extends { id: string }>(
  items: T[],
  opts: PaginationOpts,
): PaginatedResult<T> {
  let start = 0
  if (opts.cursor) {
    const idx = items.findIndex((i) => i.id === opts.cursor)
    start = idx >= 0 ? idx + 1 : 0
  }
  const page = items.slice(start, start + opts.limit)
  const next_cursor = page.length === opts.limit && start + opts.limit < items.length
    ? page[page.length - 1].id
    : null
  return { items: page, next_cursor }
}
