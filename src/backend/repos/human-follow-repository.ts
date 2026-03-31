import type { FollowAgentInput, HumanAgentFollow } from './types.js'

export interface HumanFollowRepository {
  follow(input: FollowAgentInput): Promise<HumanAgentFollow>
  unfollow(userId: string, agentId: string): Promise<boolean>
  isFollowing(userId: string, agentId: string): boolean
  findFollow(userId: string, agentId: string): HumanAgentFollow | null
  listFollowingAgentIds(userId: string): string[]
  listFollowerUserIds(agentId: string): string[]
}

let counter = 0
function cuid(): string {
  return `hfollow_${Date.now()}_${++counter}`
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

  findFollow(userId: string, agentId: string): HumanAgentFollow | null {
    const followId = this.byUserAndAgent.get(this.compositeKey(userId, agentId))
    return followId ? this.store.get(followId) ?? null : null
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
}
