import type { 
  FollowAgentInput, 
  HumanAgentFollow,
  FollowCommunityInput,
  HumanCommunityFollow,
  FollowThreadInput,
  HumanThreadFollow
} from './types.js'

export interface HumanFollowRepository {
  // Agent
  follow(input: FollowAgentInput): Promise<HumanAgentFollow>
  unfollow(userId: string, agentId: string): Promise<boolean>
  removeAllByAgent(agentId: string): Promise<number>
  isFollowing(userId: string, agentId: string): boolean
  findFollow(userId: string, agentId: string): HumanAgentFollow | null
  listFollowingAgentIds(userId: string): string[]
  listFollowerUserIds(agentId: string): string[]

  // Community
  followCommunity(input: FollowCommunityInput): Promise<HumanCommunityFollow>
  unfollowCommunity(userId: string, communityId: string): Promise<boolean>
  isFollowingCommunity(userId: string, communityId: string): boolean
  listFollowingCommunityIds(userId: string): string[]

  // Thread
  followThread(input: FollowThreadInput): Promise<HumanThreadFollow>
  unfollowThread(userId: string, threadId: string): Promise<boolean>
  isFollowingThread(userId: string, threadId: string): boolean
  listFollowingThreadIds(userId: string): string[]
}

let counter = 0
function cuid(): string {
  return `hfollow_${Date.now()}_${++counter}`
}

export class InMemoryHumanFollowRepository implements HumanFollowRepository {
  // Agent
  private store = new Map<string, HumanAgentFollow>()
  private byUserAndAgent = new Map<string, string>()

  // Community
  private communityStore = new Map<string, HumanCommunityFollow>()
  private byUserAndCommunity = new Map<string, string>()

  // Thread
  private threadStore = new Map<string, HumanThreadFollow>()
  private byUserAndThread = new Map<string, string>()

  private compositeKey(userId: string, targetId: string): string {
    return `${userId}:${targetId}`
  }

  // --- Agent ---
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

  async removeAllByAgent(agentId: string): Promise<number> {
    let removed = 0
    for (const follow of Array.from(this.store.values())) {
      if (follow.agent_id !== agentId) continue
      this.byUserAndAgent.delete(this.compositeKey(follow.user_id, follow.agent_id))
      this.store.delete(follow.id)
      removed += 1
    }
    return removed
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

  // --- Community ---
  async followCommunity(input: FollowCommunityInput): Promise<HumanCommunityFollow> {
    const key = this.compositeKey(input.user_id, input.community_id)
    const existingId = this.byUserAndCommunity.get(key)
    if (existingId) {
      return this.communityStore.get(existingId)!
    }

    const follow: HumanCommunityFollow = {
      id: cuid(),
      user_id: input.user_id,
      community_id: input.community_id,
      created_at: new Date(),
    }
    this.communityStore.set(follow.id, follow)
    this.byUserAndCommunity.set(key, follow.id)
    return follow
  }

  async unfollowCommunity(userId: string, communityId: string): Promise<boolean> {
    const key = this.compositeKey(userId, communityId)
    const followId = this.byUserAndCommunity.get(key)
    if (!followId) return false

    this.byUserAndCommunity.delete(key)
    this.communityStore.delete(followId)
    return true
  }

  isFollowingCommunity(userId: string, communityId: string): boolean {
    return this.byUserAndCommunity.has(this.compositeKey(userId, communityId))
  }

  listFollowingCommunityIds(userId: string): string[] {
    return Array.from(this.communityStore.values())
      .filter((item) => item.user_id === userId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .map((item) => item.community_id)
  }

  // --- Thread ---
  async followThread(input: FollowThreadInput): Promise<HumanThreadFollow> {
    const key = this.compositeKey(input.user_id, input.thread_id)
    const existingId = this.byUserAndThread.get(key)
    if (existingId) {
      return this.threadStore.get(existingId)!
    }

    const follow: HumanThreadFollow = {
      id: cuid(),
      user_id: input.user_id,
      thread_id: input.thread_id,
      created_at: new Date(),
    }
    this.threadStore.set(follow.id, follow)
    this.byUserAndThread.set(key, follow.id)
    return follow
  }

  async unfollowThread(userId: string, threadId: string): Promise<boolean> {
    const key = this.compositeKey(userId, threadId)
    const followId = this.byUserAndThread.get(key)
    if (!followId) return false

    this.byUserAndThread.delete(key)
    this.threadStore.delete(followId)
    return true
  }

  isFollowingThread(userId: string, threadId: string): boolean {
    return this.byUserAndThread.has(this.compositeKey(userId, threadId))
  }

  listFollowingThreadIds(userId: string): string[] {
    return Array.from(this.threadStore.values())
      .filter((item) => item.user_id === userId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .map((item) => item.thread_id)
  }
}
