import type {
  AgentCommunityMembership,
  AgentCommunityMembershipStatus,
  AgentCommunityMembershipRepository,
  AgentRepository,
  CommunityRepository,
  PostRepository,
  EventRepository,
  PublicStageThreadRepository,
  PublicStageTurnRepository,
} from '../repos/index.js'
import { ForbiddenError, NotFoundError } from '../lib/errors.js'
import { listPublicStageThreadTurnsByPost } from '../lib/public-stage-thread-turn.js'

export interface AgentCommunityMembershipServiceDeps {
  membershipRepo: AgentCommunityMembershipRepository
  agentRepo: AgentRepository
  communityRepo: CommunityRepository
  postRepo: PostRepository
  publicStageThreadRepo: PublicStageThreadRepository
  publicStageTurnRepo: PublicStageTurnRepository
  eventRepo: EventRepository
}

export interface PatchMembershipsInput {
  agent_id: string
  add: string[]
  remove: string[]
  role?: 'resident' | 'guest'
  actor_user_id: string
}

export interface BackfillMembershipsResult {
  processed_posts: number
  upserted_memberships: number
  skipped_existing: number
}

export interface UpdateMembershipStatusInput {
  agent_id: string
  community_id: string
  status: AgentCommunityMembershipStatus
  reason?: string
  actor_user_id: string
  actor_role: 'admin' | 'user'
}

const DEFAULT_BACKFILL_DAYS = 30
const DEFAULT_POST_THRESHOLD = 2
const DEFAULT_COMMENT_THRESHOLD = 6

const COMPOSITE_KEY_SEP = '\0'
function compositeKey(a: string, b: string): string {
  return `${a}${COMPOSITE_KEY_SEP}${b}`
}
function splitCompositeKey(key: string): [string, string] | null {
  const idx = key.indexOf(COMPOSITE_KEY_SEP)
  if (idx < 1 || idx >= key.length - 1) return null
  return [key.slice(0, idx), key.slice(idx + 1)]
}

export class AgentCommunityMembershipService {
  constructor(private readonly deps: AgentCommunityMembershipServiceDeps) {}

  async patchMemberships(input: PatchMembershipsInput): Promise<{
    agent_id: string
    active_memberships: AgentCommunityMembership[]
    updated: {
      added: string[]
      removed: string[]
      role: 'resident' | 'guest'
    }
  }> {
    const agent = this.deps.agentRepo.findById(input.agent_id)
    if (!agent) throw new NotFoundError('Agent', input.agent_id)

    const addSet = new Set(input.add.map((id) => id.trim()).filter((id) => id.length > 0))
    const removeSet = new Set(input.remove.map((id) => id.trim()).filter((id) => id.length > 0))
    const referencedCommunityIds = new Set([...addSet, ...removeSet])
    for (const communityId of referencedCommunityIds) {
      const community = this.deps.communityRepo.findById(communityId)
      if (!community) {
        throw new NotFoundError('Community', communityId)
      }
    }

    const role = input.role ?? 'resident'
    const mappedRole = role === 'guest' ? 'GUEST' : 'RESIDENT'

    for (const communityId of addSet) {
      const existing = this.deps.membershipRepo.findCurrent(input.agent_id, communityId)
      if (existing && existing.status !== 'ACTIVE') {
        throw new ForbiddenError(
          `Membership status ${existing.status} cannot be recovered via memberships patch; use PATCH /v1/agents/:agentId/memberships/:communityId/status`,
        )
      }
    }

    const added: string[] = []
    for (const communityId of addSet) {
      await this.deps.membershipRepo.upsertActive({
        agent_id: input.agent_id,
        community_id: communityId,
        role: mappedRole,
        source: 'MANUAL',
        created_by: input.actor_user_id,
      })
      added.push(communityId)
      removeSet.delete(communityId)
      this.deps.eventRepo.create({
        event_type: 'COMMUNITY_MEMBER_ADDED',
        plane: 'CONTROL',
        schema_version: 'v1',
        community_id: communityId,
        actor_type: 'human',
        actor_id: input.actor_user_id,
        correlation_id: `membership:${input.agent_id}:${communityId}`,
        payload_json: {
          agent_id: input.agent_id,
          community_id: communityId,
          role: mappedRole,
          source: 'MANUAL',
        },
      })
    }

    const removed: string[] = []
    for (const communityId of removeSet) {
      const removedMembership = await this.deps.membershipRepo.leave(input.agent_id, communityId)
      if (removedMembership) {
        removed.push(communityId)
        this.deps.eventRepo.create({
          event_type: 'COMMUNITY_MEMBER_LEFT',
          plane: 'CONTROL',
          schema_version: 'v1',
          community_id: communityId,
          actor_type: 'human',
          actor_id: input.actor_user_id,
          correlation_id: `membership:${input.agent_id}:${communityId}`,
          payload_json: {
            agent_id: input.agent_id,
            community_id: communityId,
            source: 'MANUAL',
          },
        })
      }
    }

    return {
      agent_id: input.agent_id,
      active_memberships: this.deps.membershipRepo.findActiveByAgent(input.agent_id),
      updated: {
        added,
        removed,
        role,
      },
    }
  }

  listActive(agentId: string): AgentCommunityMembership[] {
    return this.deps.membershipRepo.findActiveByAgent(agentId)
  }

  getCurrent(agentId: string, communityId: string): AgentCommunityMembership | null {
    return this.deps.membershipRepo.findCurrent(agentId, communityId)
  }

  async updateMembershipStatus(input: UpdateMembershipStatusInput): Promise<AgentCommunityMembership> {
    const agent = this.deps.agentRepo.findById(input.agent_id)
    if (!agent) throw new NotFoundError('Agent', input.agent_id)
    const community = this.deps.communityRepo.findById(input.community_id)
    if (!community) throw new NotFoundError('Community', input.community_id)

    const current = this.deps.membershipRepo.findCurrent(input.agent_id, input.community_id)
    if (!current) {
      throw new NotFoundError('Membership', `${input.agent_id}:${input.community_id}`)
    }

    if (input.actor_role !== 'admin') {
      if (input.status === 'BANNED') {
        throw new ForbiddenError('Only admin can set BANNED status')
      }
      if (current.status === 'BANNED') {
        throw new ForbiddenError('Only admin can recover from BANNED status')
      }
    }

    const previousStatus = current.status
    const updated = await this.deps.membershipRepo.updateStatus({
      agent_id: input.agent_id,
      community_id: input.community_id,
      status: input.status,
      reason: input.reason?.trim() || null,
      set_by: input.actor_user_id,
      set_at: new Date(),
    })
    if (!updated) {
      throw new NotFoundError('Membership', `${input.agent_id}:${input.community_id}`)
    }

    if (previousStatus !== input.status) {
      this.deps.eventRepo.create({
        event_type: 'COMMUNITY_MEMBER_STATUS_CHANGED',
        plane: 'CONTROL',
        schema_version: 'v1',
        community_id: input.community_id,
        actor_type: 'human',
        actor_id: input.actor_user_id,
        correlation_id: `membership:${input.agent_id}:${input.community_id}`,
        payload_json: {
          agent_id: input.agent_id,
          community_id: input.community_id,
          status_before: previousStatus,
          status_after: input.status,
          reason: input.reason?.trim() || null,
        },
      })
    }

    return updated
  }

  async runDerivedBackfill(input?: {
    days?: number
    min_posts?: number
    min_thread_turn_count?: number
  }): Promise<BackfillMembershipsResult> {
    const days = input?.days ?? DEFAULT_BACKFILL_DAYS
    const minPosts = input?.min_posts ?? DEFAULT_POST_THRESHOLD
    const minThreadTurns = input?.min_thread_turn_count ?? DEFAULT_COMMENT_THRESHOLD

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const postCounts = new Map<string, number>()
    const threadTurnCounts = new Map<string, number>()

    let cursor: string | undefined
    let processedPosts = 0

    while (true) {
      const page = await this.deps.postRepo.findPublic({ cursor, limit: 200 })
      if (page.items.length === 0) break

      let reachedCutoff = false
      for (const post of page.items) {
        if (post.created_at < cutoff) {
          reachedCutoff = true
          continue
        }

        processedPosts += 1
        const postKey = compositeKey(post.author_agent_id, post.community_id)
        postCounts.set(postKey, (postCounts.get(postKey) ?? 0) + 1)

        const threadTurns = await listPublicStageThreadTurnsByPost(this.deps, post.id, { includeAll: true })
        for (const threadTurn of threadTurns) {
          if (threadTurn.created_at < cutoff) continue
          const threadTurnKey = compositeKey(threadTurn.author_agent_id, post.community_id)
          threadTurnCounts.set(threadTurnKey, (threadTurnCounts.get(threadTurnKey) ?? 0) + 1)
        }
      }

      if (reachedCutoff || !page.next_cursor || page.next_cursor === cursor) {
        break
      }
      cursor = page.next_cursor
    }

    const candidates = new Set<string>([
      ...postCounts.keys(),
      ...threadTurnCounts.keys(),
    ])

    let upserted = 0
    let skippedExisting = 0

    for (const key of candidates) {
      const parts = splitCompositeKey(key)
      if (!parts) continue
      const [agentId, communityId] = parts

      const postCount = postCounts.get(key) ?? 0
      const threadTurnCount = threadTurnCounts.get(key) ?? 0
      if (postCount < minPosts && threadTurnCount < minThreadTurns) {
        continue
      }

      const existing = this.deps.membershipRepo.findCurrent(agentId, communityId)
      if (existing) {
        skippedExisting += 1
        continue
      }

      await this.deps.membershipRepo.upsertActive({
        agent_id: agentId,
        community_id: communityId,
        role: 'RESIDENT',
        source: 'DERIVED',
      })
      this.deps.eventRepo.create({
        event_type: 'COMMUNITY_MEMBER_ADDED',
        plane: 'CONTROL',
        schema_version: 'v1',
        community_id: communityId,
        actor_type: 'system',
        actor_id: 'derived-backfill',
        correlation_id: `membership:${agentId}:${communityId}`,
        payload_json: {
          agent_id: agentId,
          community_id: communityId,
          role: 'RESIDENT',
          source: 'DERIVED',
        },
      })
      upserted += 1
    }

    return {
      processed_posts: processedPosts,
      upserted_memberships: upserted,
      skipped_existing: skippedExisting,
    }
  }
}
