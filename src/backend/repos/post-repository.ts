import type { Post, CreatePostInput, PaginatedResult, PaginationOpts } from './types.js'

export interface PostRepository {
  create(input: CreatePostInput): Promise<Post>
  findById(id: string): Promise<Post | null>
  findByGovernanceBatch(batchId: string): Promise<Post[]>
  findByGovernanceBatches(batchIds: string[]): Promise<Post[]>
  findPublic(opts: PaginationOpts & { communityId?: string; authorAgentIds?: string[] }): Promise<PaginatedResult<Post>>
  findByAuthor(agentId: string, opts: PaginationOpts): Promise<PaginatedResult<Post>>
  delete(id: string): Promise<void>
  updateContent(id: string, patch: {
    community_id?: string
    author_agent_id?: string
    title?: string
    body?: string
    tags?: string[]
    visibility?: Post['visibility']
    state?: Post['state']
    moderation_metadata?: CreatePostInput['moderation_metadata']
    governance_batch_id?: string | null
    generation_mode?: Post['generation_mode']
  }): Promise<Post | null>
  updateVisibility(id: string, visibility: Post['visibility']): Promise<Post | null>
  updateState(id: string, state: Post['state']): Promise<Post | null>
  updateModerationMetadata(
    id: string,
    moderationMetadata: CreatePostInput['moderation_metadata'],
  ): Promise<Post | null>
  updateTimestamps(
    id: string,
    input: {
      created_at: Date
      updated_at?: Date
    },
  ): Promise<Post | null>
  /**
   * T-213 M1 — count root posts created within `[since, now)` for the
   * community. Used by `AdmissionLoadService` as the
   * `recent_root_post_count_20m` signal. "Root post" in the cue/PostScheduler
   * world is any `Post` row (replies live in a separate table); no extra
   * filter is required here.
   */
  countRecentRootPostsForCommunity(input: {
    communityId: string
    since: Date
  }): Promise<number>
}

let counter = 0
function cuid(): string {
  return `post_${Date.now()}_${++counter}`
}

export class InMemoryPostRepository implements PostRepository {
  private store = new Map<string, Post>()

  async create(input: CreatePostInput): Promise<Post> {
    const now = new Date()
    const post: Post = {
      id: input.id ?? cuid(),
      community_id: input.community_id,
      author_agent_id: input.author_agent_id,
      title: input.title,
      body: input.body,
      tags: input.tags ?? [],
      visibility: input.visibility,
      state: input.state,
      moderation_metadata: input.moderation_metadata ?? null,
      governance_batch_id: input.governance_batch_id ?? null,
      generation_mode: input.generation_mode ?? null,
      created_at: now,
      updated_at: now,
    }
    this.store.set(post.id, post)
    return post
  }

  async findById(id: string): Promise<Post | null> {
    return this.store.get(id) ?? null
  }

  async findByGovernanceBatch(batchId: string): Promise<Post[]> {
    return Array.from(this.store.values())
      .filter((post) => post.governance_batch_id === batchId)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
  }

  async findByGovernanceBatches(batchIds: string[]): Promise<Post[]> {
    if (batchIds.length === 0) return []
    const ids = new Set(batchIds)
    return Array.from(this.store.values())
      .filter((post) => post.governance_batch_id && ids.has(post.governance_batch_id))
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
  }

  async findPublic(opts: PaginationOpts & { communityId?: string; authorAgentIds?: string[] }): Promise<PaginatedResult<Post>> {
    let items = Array.from(this.store.values())
      .filter((p) => p.state === 'APPROVED')
      .filter((p) => p.visibility === 'PUBLIC' || p.visibility === 'GRAY')

    if (opts.communityId) {
      items = items.filter((p) => p.community_id === opts.communityId)
    }
    if (opts.authorAgentIds) {
      const allowed = new Set(opts.authorAgentIds)
      items = items.filter((p) => allowed.has(p.author_agent_id))
    }

    items.sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return paginate(items, opts)
  }

  async findByAuthor(agentId: string, opts: PaginationOpts): Promise<PaginatedResult<Post>> {
    const items = Array.from(this.store.values())
      .filter((p) => p.author_agent_id === agentId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return paginate(items, opts)
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id)
  }

  async updateContent(
    id: string,
    patch: {
      community_id?: string
      author_agent_id?: string
      title?: string
      body?: string
      tags?: string[]
      visibility?: Post['visibility']
      state?: Post['state']
      moderation_metadata?: CreatePostInput['moderation_metadata']
      governance_batch_id?: string | null
      generation_mode?: Post['generation_mode']
    },
  ): Promise<Post | null> {
    const post = this.store.get(id)
    if (!post) return null
    if (patch.community_id !== undefined) post.community_id = patch.community_id
    if (patch.author_agent_id !== undefined) post.author_agent_id = patch.author_agent_id
    if (patch.title !== undefined) post.title = patch.title
    if (patch.body !== undefined) post.body = patch.body
    if (patch.tags !== undefined) post.tags = patch.tags
    if (patch.visibility !== undefined) post.visibility = patch.visibility
    if (patch.state !== undefined) post.state = patch.state
    if (patch.moderation_metadata !== undefined) {
      post.moderation_metadata = patch.moderation_metadata
    }
    if (patch.governance_batch_id !== undefined) post.governance_batch_id = patch.governance_batch_id
    if (patch.generation_mode !== undefined) post.generation_mode = patch.generation_mode
    post.updated_at = new Date()
    return post
  }

  async updateVisibility(id: string, visibility: Post['visibility']): Promise<Post | null> {
    const post = this.store.get(id)
    if (!post) return null
    post.visibility = visibility
    post.updated_at = new Date()
    return post
  }

  async updateState(id: string, state: Post['state']): Promise<Post | null> {
    const post = this.store.get(id)
    if (!post) return null
    post.state = state
    post.updated_at = new Date()
    return post
  }

  async updateModerationMetadata(id: string, moderationMetadata: CreatePostInput['moderation_metadata']): Promise<Post | null> {
    const post = this.store.get(id)
    if (!post) return null
    post.moderation_metadata = moderationMetadata ?? null
    post.updated_at = new Date()
    return post
  }

  async updateTimestamps(
    id: string,
    input: {
      created_at: Date
      updated_at?: Date
    },
  ): Promise<Post | null> {
    const post = this.store.get(id)
    if (!post) return null
    post.created_at = input.created_at
    post.updated_at = input.updated_at ?? input.created_at
    return post
  }

  async countRecentRootPostsForCommunity(input: {
    communityId: string
    since: Date
  }): Promise<number> {
    const sinceMs = input.since.getTime()
    let total = 0
    for (const post of this.store.values()) {
      if (post.community_id !== input.communityId) continue
      if (post.created_at.getTime() < sinceMs) continue
      total++
    }
    return total
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
