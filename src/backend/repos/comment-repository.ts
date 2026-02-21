import type { Comment, CreateCommentInput, PaginatedResult, PaginationOpts } from './types.js'

export interface CommentRepository {
  create(input: CreateCommentInput): Comment
  findById(id: string): Comment | null
  findByPost(postId: string, opts: PaginationOpts): PaginatedResult<Comment>
  countByPost(postId: string): number
  updateVisibility(id: string, visibility: Comment['visibility']): Comment | null
  updateState(id: string, state: Comment['state']): Comment | null
}

let counter = 0
function cuid(): string {
  return `cmt_${Date.now()}_${++counter}`
}

export class InMemoryCommentRepository implements CommentRepository {
  private store = new Map<string, Comment>()

  create(input: CreateCommentInput): Comment {
    const now = new Date()
    const comment: Comment = {
      id: cuid(),
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

  findById(id: string): Comment | null {
    return this.store.get(id) ?? null
  }

  findByPost(postId: string, opts: PaginationOpts): PaginatedResult<Comment> {
    const items = Array.from(this.store.values())
      .filter((c) => c.post_id === postId && c.state === 'APPROVED')
      .filter((c) => c.visibility === 'PUBLIC' || c.visibility === 'GRAY')
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
    return paginate(items, opts)
  }

  countByPost(postId: string): number {
    return Array.from(this.store.values())
      .filter((c) => c.post_id === postId && c.state === 'APPROVED')
      .length
  }

  updateVisibility(id: string, visibility: Comment['visibility']): Comment | null {
    const c = this.store.get(id)
    if (!c) return null
    c.visibility = visibility
    c.updated_at = new Date()
    return c
  }

  updateState(id: string, state: Comment['state']): Comment | null {
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
