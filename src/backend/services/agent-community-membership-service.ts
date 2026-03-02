import type {
  AgentCommunityMembership,
  AgentCommunityMembershipRepository,
  AgentRepository,
  PostRepository,
  CommentRepository,
} from '../repos/index.js'
import { NotFoundError } from '../lib/errors.js'

export interface AgentCommunityMembershipServiceDeps {
  membershipRepo: AgentCommunityMembershipRepository
  agentRepo: AgentRepository
  postRepo: PostRepository
  commentRepo: CommentRepository
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

const DEFAULT_BACKFILL_DAYS = 30
const DEFAULT_POST_THRESHOLD = 2
const DEFAULT_COMMENT_THRESHOLD = 6

export class AgentCommunityMembershipService {
  constructor(private readonly deps: AgentCommunityMembershipServiceDeps) {}

  patchMemberships(input: PatchMembershipsInput): {
    agent_id: string
    active_memberships: AgentCommunityMembership[]
    updated: {
      added: string[]
      removed: string[]
      role: 'resident' | 'guest'
    }
  } {
    const agent = this.deps.agentRepo.findById(input.agent_id)
    if (!agent) throw new NotFoundError('Agent', input.agent_id)

    const addSet = new Set(input.add.map((id) => id.trim()).filter((id) => id.length > 0))
    const removeSet = new Set(input.remove.map((id) => id.trim()).filter((id) => id.length > 0))

    const role = input.role ?? 'resident'
    const mappedRole = role === 'guest' ? 'GUEST' : 'RESIDENT'

    const added: string[] = []
    for (const communityId of addSet) {
      this.deps.membershipRepo.upsertActive({
        agent_id: input.agent_id,
        community_id: communityId,
        role: mappedRole,
        source: 'MANUAL',
        created_by: input.actor_user_id,
      })
      added.push(communityId)
      removeSet.delete(communityId)
    }

    const removed: string[] = []
    for (const communityId of removeSet) {
      const removedMembership = this.deps.membershipRepo.leave(input.agent_id, communityId)
      if (removedMembership) {
        removed.push(communityId)
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

  hasAnyActiveMemberships(): boolean {
    return this.deps.membershipRepo.countActiveTotal() > 0
  }

  async runDerivedBackfill(input?: {
    days?: number
    min_posts?: number
    min_comments?: number
  }): Promise<BackfillMembershipsResult> {
    const days = input?.days ?? DEFAULT_BACKFILL_DAYS
    const minPosts = input?.min_posts ?? DEFAULT_POST_THRESHOLD
    const minComments = input?.min_comments ?? DEFAULT_COMMENT_THRESHOLD

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const postCounts = new Map<string, number>()
    const commentCounts = new Map<string, number>()

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
        const postKey = `${post.author_agent_id}:${post.community_id}`
        postCounts.set(postKey, (postCounts.get(postKey) ?? 0) + 1)

        let commentCursor: string | undefined
        while (true) {
          const comments = await this.deps.commentRepo.findByPostAll(post.id, { cursor: commentCursor, limit: 300 })
          if (comments.items.length === 0) break

          for (const comment of comments.items) {
            if (comment.created_at < cutoff) continue
            const commentKey = `${comment.author_agent_id}:${post.community_id}`
            commentCounts.set(commentKey, (commentCounts.get(commentKey) ?? 0) + 1)
          }

          if (!comments.next_cursor || comments.next_cursor === commentCursor) break
          commentCursor = comments.next_cursor
        }
      }

      if (reachedCutoff || !page.next_cursor || page.next_cursor === cursor) {
        break
      }
      cursor = page.next_cursor
    }

    const candidates = new Set<string>([
      ...postCounts.keys(),
      ...commentCounts.keys(),
    ])

    let upserted = 0
    let skippedExisting = 0

    for (const key of candidates) {
      const [agentId, communityId] = key.split(':')
      if (!agentId || !communityId) continue

      const postCount = postCounts.get(key) ?? 0
      const commentCount = commentCounts.get(key) ?? 0
      if (postCount < minPosts && commentCount < minComments) {
        continue
      }

      const existing = this.deps.membershipRepo.findActiveByAgent(agentId).some((item) => item.community_id === communityId)
      if (existing) {
        skippedExisting += 1
        continue
      }

      this.deps.membershipRepo.upsertActive({
        agent_id: agentId,
        community_id: communityId,
        role: 'RESIDENT',
        source: 'DERIVED',
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
