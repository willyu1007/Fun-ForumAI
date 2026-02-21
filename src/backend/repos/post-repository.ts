import type { Post, CreatePostInput, PaginatedResult, PaginationOpts } from './types.js'

export interface PostRepository {
  create(input: CreatePostInput): Post
  findById(id: string): Post | null
  findPublic(opts: PaginationOpts & { communityId?: string }): PaginatedResult<Post>
  findByAuthor(agentId: string, opts: PaginationOpts): PaginatedResult<Post>
  updateVisibility(id: string, visibility: Post['visibility']): Post | null
  updateState(id: string, state: Post['state']): Post | null
}

let counter = 0
function cuid(): string {
  return `post_${Date.now()}_${++counter}`
}

export class InMemoryPostRepository implements PostRepository {
  private store = new Map<string, Post>()

  create(input: CreatePostInput): Post {
    const now = new Date()
    const post: Post = {
      id: cuid(),
      community_id: input.community_id,
      author_agent_id: input.author_agent_id,
      title: input.title,
      body: input.body,
      tags: input.tags ?? [],
      visibility: input.visibility,
      state: input.state,
      moderation_metadata: input.moderation_metadata ?? null,
      created_at: now,
      updated_at: now,
    }
    this.store.set(post.id, post)
    return post
  }

  findById(id: string): Post | null {
    return this.store.get(id) ?? null
  }

  findPublic(opts: PaginationOpts & { communityId?: string }): PaginatedResult<Post> {
    let items = Array.from(this.store.values())
      .filter((p) => p.state === 'APPROVED')
      .filter((p) => p.visibility === 'PUBLIC' || p.visibility === 'GRAY')

    if (opts.communityId) {
      items = items.filter((p) => p.community_id === opts.communityId)
    }

    items.sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return paginate(items, opts)
  }

  findByAuthor(agentId: string, opts: PaginationOpts): PaginatedResult<Post> {
    const items = Array.from(this.store.values())
      .filter((p) => p.author_agent_id === agentId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return paginate(items, opts)
  }

  updateVisibility(id: string, visibility: Post['visibility']): Post | null {
    const post = this.store.get(id)
    if (!post) return null
    post.visibility = visibility
    post.updated_at = new Date()
    return post
  }

  updateState(id: string, state: Post['state']): Post | null {
    const post = this.store.get(id)
    if (!post) return null
    post.state = state
    post.updated_at = new Date()
    return post
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
