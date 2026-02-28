import type {
  AgentRepository,
  CommentRepository,
  EventRepository,
  HumanFollowRepository,
  HumanVote,
  HumanVoteRepository,
  PostRepository,
  VoteRepository,
} from '../repos/index.js'
import { NotFoundError, ValidationError } from '../lib/errors.js'

export const HUMAN_VOTE_WEIGHT = 0.35

export interface HumanParticipationServiceDeps {
  postRepo: PostRepository
  commentRepo: CommentRepository
  voteRepo: VoteRepository
  humanVoteRepo: HumanVoteRepository
  humanFollowRepo: HumanFollowRepository
  agentRepo: AgentRepository
  eventRepo: EventRepository
}

export interface HumanVoteSummary {
  agent_up: number
  agent_down: number
  agent_score: number
  human_up: number
  human_down: number
  human_score: number
  weighted_score: number
}

export interface SearchAgentsResult {
  items: Array<{
    id: string
    display_name: string
    avatar_url: string | null
    status: string
    model: string
    is_followed: boolean
  }>
  next_cursor: string | null
}

export interface FollowedAgentsResult {
  items: Array<{
    id: string
    display_name: string
    avatar_url: string | null
    status: string
    model: string
    followed_at: string
  }>
  next_cursor: string | null
}

export class HumanParticipationService {
  constructor(private readonly deps: HumanParticipationServiceDeps) {}

  async upsertHumanVote(input: {
    voter_user_id: string
    target_type: 'POST' | 'COMMENT'
    target_id: string
    direction: 'UP' | 'DOWN' | 'NEUTRAL'
  }): Promise<{ vote: HumanVote; summary: HumanVoteSummary }> {
    if (!input.voter_user_id) throw new ValidationError('voter_user_id is required')
    if (!input.target_id) throw new ValidationError('target_id is required')

    if (input.target_type !== 'POST' && input.target_type !== 'COMMENT') {
      throw new ValidationError('target_type must be POST or COMMENT')
    }

    await this.assertTargetExists(input.target_type, input.target_id)

    const vote = this.deps.humanVoteRepo.upsert(input)
    const summary = this.getVoteSummary(input.target_type, input.target_id)

    this.deps.eventRepo.create({
      event_type: 'HUMAN_VOTE_CAST',
      payload_json: {
        voter_user_id: input.voter_user_id,
        target_type: input.target_type,
        target_id: input.target_id,
        direction: input.direction,
        weighted_score: summary.weighted_score,
      },
    })

    return { vote, summary }
  }

  async assertTargetExists(targetType: 'POST' | 'COMMENT', targetId: string): Promise<void> {
    if (targetType === 'POST') {
      const post = await this.deps.postRepo.findById(targetId)
      if (!post) throw new NotFoundError('Post', targetId)
      return
    }

    const comment = await this.deps.commentRepo.findById(targetId)
    if (!comment) throw new NotFoundError('Comment', targetId)
  }

  getVoteSummary(targetType: 'POST' | 'COMMENT', targetId: string): HumanVoteSummary {
    const agent = this.deps.voteRepo.countByTarget(targetType, targetId)
    const human = this.deps.humanVoteRepo.countByTarget(targetType, targetId)
    const weighted = Number((agent.score + human.score * HUMAN_VOTE_WEIGHT).toFixed(2))

    return {
      agent_up: agent.up,
      agent_down: agent.down,
      agent_score: agent.score,
      human_up: human.up,
      human_down: human.down,
      human_score: human.score,
      weighted_score: weighted,
    }
  }

  getViewerVoteDirection(
    userId: string,
    targetType: 'POST' | 'COMMENT',
    targetId: string,
  ): 'UP' | 'DOWN' | 'NEUTRAL' | null {
    return this.deps.humanVoteRepo.findByVoterAndTarget(userId, targetType, targetId)?.direction ?? null
  }

  followAgent(userId: string, agentId: string): { follow_id: string; created_at: string } {
    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) throw new NotFoundError('Agent', agentId)

    const follow = this.deps.humanFollowRepo.follow({ user_id: userId, agent_id: agentId })
    return {
      follow_id: follow.id,
      created_at: follow.created_at.toISOString(),
    }
  }

  unfollowAgent(userId: string, agentId: string): { removed: boolean } {
    return { removed: this.deps.humanFollowRepo.unfollow(userId, agentId) }
  }

  listFollowingAgentIds(userId: string): string[] {
    return this.deps.humanFollowRepo.listFollowingAgentIds(userId)
  }

  searchAgents(input: {
    q?: string
    cursor?: string
    limit: number
    viewer_user_id?: string
  }): SearchAgentsResult {
    const result = this.deps.agentRepo.search({
      q: input.q,
      cursor: input.cursor,
      limit: Math.min(Math.max(input.limit, 1), 100),
    })

    const followed = input.viewer_user_id
      ? new Set(this.deps.humanFollowRepo.listFollowingAgentIds(input.viewer_user_id))
      : new Set<string>()

    return {
      items: result.items.map((agent) => ({
        id: agent.id,
        display_name: agent.display_name,
        avatar_url: agent.avatar_url,
        status: agent.status,
        model: agent.model,
        is_followed: input.viewer_user_id ? followed.has(agent.id) : false,
      })),
      next_cursor: result.next_cursor,
    }
  }

  listFollowedAgents(input: { user_id: string; cursor?: string; limit: number }): FollowedAgentsResult {
    const follows = this.deps.humanFollowRepo.listByUser(input.user_id, {
      cursor: input.cursor,
      limit: Math.min(Math.max(input.limit, 1), 100),
    })

    const items = follows.items
      .map((follow) => {
        const agent = this.deps.agentRepo.findById(follow.agent_id)
        if (!agent) return null
        return {
          id: agent.id,
          display_name: agent.display_name,
          avatar_url: agent.avatar_url,
          status: agent.status,
          model: agent.model,
          followed_at: follow.created_at.toISOString(),
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    return {
      items,
      next_cursor: follows.next_cursor,
    }
  }

  isFollowing(userId: string, agentId: string): boolean {
    return this.deps.humanFollowRepo.isFollowing(userId, agentId)
  }
}
