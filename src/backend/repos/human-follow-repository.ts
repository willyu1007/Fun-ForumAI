import type { FollowAgentInput, HumanAgentFollow, PaginationOpts, PaginatedResult } from './types.js'

export interface HumanFollowRepository {
  follow(input: FollowAgentInput): Promise<HumanAgentFollow>
  unfollow(userId: string, agentId: string): Promise<boolean>
  isFollowing(userId: string, agentId: string): boolean
  listFollowingAgentIds(userId: string): string[]
  listFollowerUserIds(agentId: string): string[]
  listByUser(userId: string, opts: PaginationOpts): PaginatedResult<HumanAgentFollow>
}

let counter = 0
function cuid(): string {
  return `hfollow_${Date.now()}_${++counter}`
}

function paginate<T extends { id: string }>(items: T[], opts: PaginationOpts): PaginatedResult<T> {
  let start = 0
  if (opts.cursor) {
    const idx = items.findIndex((item) => item.id === opts.cursor)
    start = idx >= 0 ? idx + 1 : 0
  }
  const page = items.slice(start, start + opts.limit)
  const next_cursor = page.length === opts.limit && start + opts.limit < items.length
    ? page[page.length - 1].id
    : null
  return { items: page, next_cursor }
}

export class InMemoryHumanFollowRepository implements HumanFollowRepository {
  private store = new Map<string, HumanAgentFollow>()
  private byUserAndAgent = new Map<string, string>()

  private compositeKey(userId: string, agentId: string): string {
    return `${userId}:${agentId}`
  }

  async follow(input: FollowAgentInput): Promise<HumanAgentFollow> {
    const key = this.compositeKey(input.user_id, input.agent_id)
    const existingId = this.byUserAndAgent.get(key)
    if (existingId) {
      return this.store.get(existingId)!
    }

    const follow: HumanAgentFollow = {
      id: cuid(),
      user_id: input.user_id,
      agent_id: input.agent_id,
      created_at: new Date(),
    }
    this.store.set(follow.id, follow)
    this.byUserAndAgent.set(key, follow.id)
    return follow
  }

  async unfollow(userId: string, agentId: string): Promise<boolean> {
    const key = this.compositeKey(userId, agentId)
    const followId = this.byUserAndAgent.get(key)
    if (!followId) return false

    this.byUserAndAgent.delete(key)
    this.store.delete(followId)
    return true
  }

  isFollowing(userId: string, agentId: string): boolean {
    return this.byUserAndAgent.has(this.compositeKey(userId, agentId))
  }

  listFollowingAgentIds(userId: string): string[] {
    return Array.from(this.store.values())
      .filter((item) => item.user_id === userId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .map((item) => item.agent_id)
  }

  listFollowerUserIds(agentId: string): string[] {
    return Array.from(this.store.values())
      .filter((item) => item.agent_id === agentId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .map((item) => item.user_id)
  }

  listByUser(userId: string, opts: PaginationOpts): PaginatedResult<HumanAgentFollow> {
    const rows = Array.from(this.store.values())
      .filter((item) => item.user_id === userId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())

    return paginate(rows, opts)
  }
}
