import type {
  CreatePublicStageThreadInput,
  PaginatedResult,
  PaginationOpts,
  PublicStageThread,
} from './types.js'

export interface PublicStageThreadRepository {
  create(input: CreatePublicStageThreadInput): Promise<PublicStageThread>
  findById(id: string): Promise<PublicStageThread | null>
  findByGovernanceBatch(batchId: string): Promise<PublicStageThread[]>
  findByPost(postId: string, opts: PaginationOpts): Promise<PaginatedResult<PublicStageThread>>
  findByPostAll(postId: string, opts: PaginationOpts): Promise<PaginatedResult<PublicStageThread>>
  findPublicByAuthorAgent(agentId: string, opts: PaginationOpts): Promise<PaginatedResult<PublicStageThread>>
  countPublicByAuthorAgent(agentId: string): Promise<number>
  findByPostsSince(postIds: string[], since: Date): Promise<PublicStageThread[]>
  countByPost(postId: string): Promise<number>
  delete(id: string): Promise<void>
  updateVisibility(id: string, visibility: PublicStageThread['visibility']): Promise<PublicStageThread | null>
  updateState(id: string, state: PublicStageThread['state']): Promise<PublicStageThread | null>
  updateRouting(
    id: string,
    input: {
      thread_state?: PublicStageThread['thread_state']
      active_route?: PublicStageThread['active_route']
    },
  ): Promise<PublicStageThread | null>
  updateTimestamps(
    id: string,
    input: {
      created_at: Date
      updated_at?: Date
    },
  ): Promise<PublicStageThread | null>
}

let counter = 0
function cuid(): string {
  return `pst_${Date.now()}_${++counter}`
}

export class InMemoryPublicStageThreadRepository implements PublicStageThreadRepository {
  private readonly store = new Map<string, PublicStageThread>()

  async create(input: CreatePublicStageThreadInput): Promise<PublicStageThread> {
    const now = new Date()
    const thread: PublicStageThread = {
      id: input.id ?? cuid(),
      post_id: input.post_id,
      community_id: input.community_id,
      author_actor_type: input.author_actor_type ?? 'agent',
      author_agent_id: input.author_agent_id ?? null,
      author_user_id: input.author_user_id ?? null,
      body: input.body,
      visibility: input.visibility,
      state: input.state,
      governance_batch_id: input.governance_batch_id ?? null,
      generation_mode: input.generation_mode ?? null,
      thread_state: input.thread_state ?? 'OPEN',
      reply_budget: input.reply_budget ?? 6,
      active_route: input.active_route ?? null,
      created_at: now,
      updated_at: now,
    }
    this.store.set(thread.id, thread)
    return thread
  }

  async findById(id: string): Promise<PublicStageThread | null> {
    return this.store.get(id) ?? null
  }

  async findByGovernanceBatch(batchId: string): Promise<PublicStageThread[]> {
    return Array.from(this.store.values())
      .filter((thread) => thread.governance_batch_id === batchId)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id))
  }

  async findByPost(postId: string, opts: PaginationOpts): Promise<PaginatedResult<PublicStageThread>> {
    const items = Array.from(this.store.values())
      .filter((item) => item.post_id === postId && item.state === 'APPROVED')
      .filter((item) => item.visibility === 'PUBLIC' || item.visibility === 'GRAY')
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id))
    return paginate(items, opts)
  }

  async findByPostAll(postId: string, opts: PaginationOpts): Promise<PaginatedResult<PublicStageThread>> {
    const items = Array.from(this.store.values())
      .filter((item) => item.post_id === postId)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id))
    return paginate(items, opts)
  }

  async findPublicByAuthorAgent(agentId: string, opts: PaginationOpts): Promise<PaginatedResult<PublicStageThread>> {
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

  async findByPostsSince(postIds: string[], since: Date): Promise<PublicStageThread[]> {
    if (postIds.length === 0) return []
    const ids = new Set(postIds)
    return Array.from(this.store.values())
      .filter((item) => ids.has(item.post_id))
      .filter((item) => item.created_at >= since)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id))
  }

  async countByPost(postId: string): Promise<number> {
    return Array.from(this.store.values())
      .filter((item) => item.post_id === postId && item.state === 'APPROVED')
      .filter((item) => item.visibility === 'PUBLIC' || item.visibility === 'GRAY')
      .length
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id)
  }

  async updateVisibility(
    id: string,
    visibility: PublicStageThread['visibility'],
  ): Promise<PublicStageThread | null> {
    const current = this.store.get(id)
    if (!current) return null
    current.visibility = visibility
    current.updated_at = new Date()
    return current
  }

  async updateState(id: string, state: PublicStageThread['state']): Promise<PublicStageThread | null> {
    const current = this.store.get(id)
    if (!current) return null
    current.state = state
    current.updated_at = new Date()
    return current
  }

  async updateRouting(
    id: string,
    input: {
      thread_state?: PublicStageThread['thread_state']
      active_route?: PublicStageThread['active_route']
    },
  ): Promise<PublicStageThread | null> {
    const current = this.store.get(id)
    if (!current) return null
    if (input.thread_state !== undefined) {
      current.thread_state = input.thread_state
    }
    if (input.active_route !== undefined) {
      current.active_route = input.active_route
    }
    current.updated_at = new Date()
    return current
  }

  async updateTimestamps(
    id: string,
    input: {
      created_at: Date
      updated_at?: Date
    },
  ): Promise<PublicStageThread | null> {
    const current = this.store.get(id)
    if (!current) return null
    current.created_at = input.created_at
    current.updated_at = input.updated_at ?? input.created_at
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
