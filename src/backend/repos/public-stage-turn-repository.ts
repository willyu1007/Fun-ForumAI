import type {
  CreatePublicStageTurnInput,
  PaginatedResult,
  PaginationOpts,
  PublicStageTurn,
} from './types.js'

export interface PublicStageTurnRepository {
  create(input: CreatePublicStageTurnInput): Promise<PublicStageTurn>
  findById(id: string): Promise<PublicStageTurn | null>
  findByWarmStartBatch(batchId: string): Promise<PublicStageTurn[]>
  findByThread(threadId: string, opts: PaginationOpts): Promise<PaginatedResult<PublicStageTurn>>
  findWindowByThread(threadId: string, opts: PublicStageTurnWindowOpts): Promise<PublicStageTurnWindowResult>
  findRecentByThread(threadId: string, limit: number): Promise<PublicStageTurn[]>
  findMatchingByThread(threadId: string, query: string, limit: number): Promise<PublicStageTurn[]>
  findByThreads(threadIds: string[]): Promise<PublicStageTurn[]>
  findPublicByAuthorAgent(agentId: string, opts: PaginationOpts): Promise<PaginatedResult<PublicStageTurn>>
  countPublicByAuthorAgent(agentId: string): Promise<number>
  findByPostsSince(postIds: string[], since: Date): Promise<PublicStageTurn[]>
  countByThread(threadId: string): Promise<number>
  countAllByThread(threadId: string): Promise<number>
  delete(id: string): Promise<void>
  deleteByThread(threadId: string): Promise<void>
  updateVisibility(id: string, visibility: PublicStageTurn['visibility']): Promise<PublicStageTurn | null>
  updateState(id: string, state: PublicStageTurn['state']): Promise<PublicStageTurn | null>
  updateTimestamps(
    id: string,
    input: {
      created_at: Date
      updated_at?: Date
    },
  ): Promise<PublicStageTurn | null>
}

export interface PublicStageTurnWindowOpts {
  cursor?: string | null
  limit: number
  aroundTurnId?: string | null
}

export type PublicStageTurnWindowResult = PaginatedResult<PublicStageTurn> & {
  returned_mode: 'full' | 'cursor' | 'around'
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
      warm_start_batch_id: input.warm_start_batch_id ?? null,
      generation_mode: input.generation_mode ?? null,
      created_at: now,
      updated_at: now,
    }
    this.store.set(turn.id, turn)
    return turn
  }

  async findById(id: string): Promise<PublicStageTurn | null> {
    return this.store.get(id) ?? null
  }

  async findByWarmStartBatch(batchId: string): Promise<PublicStageTurn[]> {
    return Array.from(this.store.values())
      .filter((turn) => turn.warm_start_batch_id === batchId)
      .sort((a, b) => a.turn_index - b.turn_index || a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id))
  }

  async findByThread(threadId: string, opts: PaginationOpts): Promise<PaginatedResult<PublicStageTurn>> {
    const items = this.listVisibleByThread(threadId)
    return paginate(items, opts)
  }

  async findWindowByThread(threadId: string, opts: PublicStageTurnWindowOpts): Promise<PublicStageTurnWindowResult> {
    const items = this.listVisibleByThread(threadId)
    if (opts.aroundTurnId) {
      const focusIndex = items.findIndex((turn) => turn.id === opts.aroundTurnId)
      if (focusIndex < 0) {
        return { items: [], next_cursor: null, returned_mode: 'around' }
      }
      const halfWindow = Math.floor((opts.limit - 1) / 2)
      let start = Math.max(0, focusIndex - halfWindow)
      const end = Math.min(items.length, start + opts.limit)
      if (end - start < opts.limit) {
        start = Math.max(0, end - opts.limit)
      }
      const page = items.slice(start, end)
      return {
        items: page,
        next_cursor: end < items.length ? page[page.length - 1]?.id ?? null : null,
        returned_mode: 'around',
      }
    }

    const page = paginate(items, { cursor: opts.cursor ?? undefined, limit: opts.limit })
    return {
      ...page,
      returned_mode: opts.cursor ? 'cursor' : 'full',
    }
  }

  async findRecentByThread(threadId: string, limit: number): Promise<PublicStageTurn[]> {
    return this.listVisibleByThread(threadId).slice(-limit)
  }

  async findMatchingByThread(threadId: string, query: string, limit: number): Promise<PublicStageTurn[]> {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return []
    const tokens = Array.from(new Set(normalizedQuery.split(/\s+/).filter(Boolean)))
    return this.listVisibleByThread(threadId)
      .filter((turn) => {
        const body = turn.body.toLowerCase()
        return body.includes(normalizedQuery) || tokens.some((token) => body.includes(token))
      })
      .slice(-limit)
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

  async countAllByThread(threadId: string): Promise<number> {
    return Array.from(this.store.values())
      .filter((item) => item.thread_id === threadId)
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

  async updateTimestamps(
    id: string,
    input: {
      created_at: Date
      updated_at?: Date
    },
  ): Promise<PublicStageTurn | null> {
    const current = this.store.get(id)
    if (!current) return null
    current.created_at = input.created_at
    current.updated_at = input.updated_at ?? input.created_at
    return current
  }

  private listVisibleByThread(threadId: string): PublicStageTurn[] {
    return Array.from(this.store.values())
      .filter((item) => item.thread_id === threadId && item.state === 'APPROVED')
      .filter((item) => item.visibility === 'PUBLIC' || item.visibility === 'GRAY')
      .sort((a, b) => a.turn_index - b.turn_index || a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id))
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
