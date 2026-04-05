import type {
  CreatePublicStageTurnInput,
  PaginatedResult,
  PaginationOpts,
  PublicStageTurn,
} from './types.js'

export interface PublicStageTurnRepository {
  create(input: CreatePublicStageTurnInput): Promise<PublicStageTurn>
  findById(id: string): Promise<PublicStageTurn | null>
  findByThread(threadId: string, opts: PaginationOpts): Promise<PaginatedResult<PublicStageTurn>>
  findByThreads(threadIds: string[]): Promise<PublicStageTurn[]>
  findPublicByAuthorAgent(agentId: string, opts: PaginationOpts): Promise<PaginatedResult<PublicStageTurn>>
  countPublicByAuthorAgent(agentId: string): Promise<number>
  findByPostsSince(postIds: string[], since: Date): Promise<PublicStageTurn[]>
  countByThread(threadId: string): Promise<number>
  delete(id: string): Promise<void>
  deleteByThread(threadId: string): Promise<void>
  updateVisibility(id: string, visibility: PublicStageTurn['visibility']): Promise<PublicStageTurn | null>
  updateState(id: string, state: PublicStageTurn['state']): Promise<PublicStageTurn | null>
}

let counter = 0
function cuid(): string {
  return `ptn_${Date.now()}_${++counter}`
}

export class InMemoryPublicStageTurnRepository implements PublicStageTurnRepository {
  private readonly store = new Map<string, PublicStageTurn>()

  async create(input: CreatePublicStageTurnInput): Promise<PublicStageTurn> {
    const now = new Date()
    const turn: PublicStageTurn = {
      id: input.id ?? cuid(),
      thread_id: input.thread_id,
      post_id: input.post_id,
      author_actor_type: input.author_actor_type ?? 'agent',
      author_agent_id: input.author_agent_id ?? null,
      author_user_id: input.author_user_id ?? null,
      turn_index: input.turn_index,
      anchor_turn_id: input.anchor_turn_id ?? null,
      anchor_intent: input.anchor_intent ?? null,
      quoted_excerpt: input.quoted_excerpt ?? null,
      body: input.body,
      visibility: input.visibility,
      state: input.state,
      created_at: now,
      updated_at: now,
    }
    this.store.set(turn.id, turn)
    return turn
  }

  async findById(id: string): Promise<PublicStageTurn | null> {
    return this.store.get(id) ?? null
  }

  async findByThread(threadId: string, opts: PaginationOpts): Promise<PaginatedResult<PublicStageTurn>> {
    const items = Array.from(this.store.values())
      .filter((item) => item.thread_id === threadId && item.state === 'APPROVED')
      .filter((item) => item.visibility === 'PUBLIC' || item.visibility === 'GRAY')
      .sort((a, b) => a.turn_index - b.turn_index || a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id))
    return paginate(items, opts)
  }

  async findByThreads(threadIds: string[]): Promise<PublicStageTurn[]> {
    if (threadIds.length === 0) return []
    const ids = new Set(threadIds)
    return Array.from(this.store.values())
      .filter((item) => ids.has(item.thread_id))
      .sort((a, b) => a.turn_index - b.turn_index || a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id))
  }

  async findPublicByAuthorAgent(agentId: string, opts: PaginationOpts): Promise<PaginatedResult<PublicStageTurn>> {
    const items = Array.from(this.store.values())
      .filter((item) => item.author_actor_type === 'agent' && item.author_agent_id === agentId && item.state === 'APPROVED')
      .filter((item) => item.visibility === 'PUBLIC' || item.visibility === 'GRAY')
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id))
    return paginate(items, opts)
  }

  async countPublicByAuthorAgent(agentId: string): Promise<number> {
    return Array.from(this.store.values())
      .filter((item) => item.author_agent_id === agentId && item.state === 'APPROVED')
      .filter((item) => item.visibility === 'PUBLIC' || item.visibility === 'GRAY')
      .length
  }

  async findByPostsSince(postIds: string[], since: Date): Promise<PublicStageTurn[]> {
    if (postIds.length === 0) return []
    const ids = new Set(postIds)
    return Array.from(this.store.values())
      .filter((item) => ids.has(item.post_id))
      .filter((item) => item.created_at >= since)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id))
  }

  async countByThread(threadId: string): Promise<number> {
    return Array.from(this.store.values())
      .filter((item) => item.thread_id === threadId && item.state === 'APPROVED')
      .filter((item) => item.visibility === 'PUBLIC' || item.visibility === 'GRAY')
      .length
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id)
  }

  async deleteByThread(threadId: string): Promise<void> {
    for (const [id, item] of this.store.entries()) {
      if (item.thread_id === threadId) {
        this.store.delete(id)
      }
    }
  }

  async updateVisibility(
    id: string,
    visibility: PublicStageTurn['visibility'],
  ): Promise<PublicStageTurn | null> {
    const current = this.store.get(id)
    if (!current) return null
    current.visibility = visibility
    current.updated_at = new Date()
    return current
  }

  async updateState(id: string, state: PublicStageTurn['state']): Promise<PublicStageTurn | null> {
    const current = this.store.get(id)
    if (!current) return null
    current.state = state
    current.updated_at = new Date()
    return current
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
