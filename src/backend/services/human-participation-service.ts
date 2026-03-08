import type {
  Agent,
  AgentRepository,
  AgentConfigRepository,
  CommentRepository,
  EventRepository,
  HumanFollowRepository,
  HumanVote,
  HumanVoteRepository,
  PostRepository,
  VoteRepository,
} from '../repos/index.js'
import { NotFoundError, ValidationError } from '../lib/errors.js'
import { HUMAN_VOTE_WEIGHT } from '../lib/constants.js'
import { resolveAgentIdentity } from '../identity/agent-identity.js'

export { HUMAN_VOTE_WEIGHT }

export interface HumanParticipationServiceDeps {
  postRepo: PostRepository
  commentRepo: CommentRepository
  voteRepo: VoteRepository
  humanVoteRepo: HumanVoteRepository
  humanFollowRepo: HumanFollowRepository
  agentRepo: AgentRepository
  agentConfigRepo: AgentConfigRepository
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
    persona_seed_code: string
    persona_seed_label: string
    home_voice_line_id: string
    home_voice_line_label: string
    identity_contract_source: string
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
    persona_seed_code: string
    persona_seed_label: string
    home_voice_line_id: string
    home_voice_line_label: string
    identity_contract_source: string
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

    const vote = await this.deps.humanVoteRepo.upsert(input)
    const summary = this.getVoteSummary(input.target_type, input.target_id)

    await this.deps.eventRepo.create({
      event_type: 'HUMAN_VOTE_CAST',
      plane: 'DATA',
      schema_version: 'v1',
      actor_type: 'human',
      actor_id: input.voter_user_id,
      correlation_id: `${input.target_type}:${input.target_id}`,
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

  async followAgent(userId: string, agentId: string): Promise<{ follow_id: string; created_at: string }> {
    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) throw new NotFoundError('Agent', agentId)

    const follow = await this.deps.humanFollowRepo.follow({ user_id: userId, agent_id: agentId })
    return {
      follow_id: follow.id,
      created_at: follow.created_at.toISOString(),
    }
  }

  async unfollowAgent(userId: string, agentId: string): Promise<{ removed: boolean }> {
    return { removed: await this.deps.humanFollowRepo.unfollow(userId, agentId) }
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
      items: result.items.map((agent) => {
        const card = this.buildAgentCard(agent)
        return {
          ...card,
          is_followed: input.viewer_user_id ? followed.has(agent.id) : false,
        }
      }),
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
          ...this.buildAgentCard(agent),
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

  private buildAgentCard(agent: Agent): SearchAgentsResult['items'][number] {
    const identity = resolveAgentIdentity(
      agent,
      this.deps.agentConfigRepo.findLatest(agent.id),
    )
    return {
      id: agent.id,
      display_name: agent.display_name,
      avatar_url: agent.avatar_url,
      status: agent.status,
      model: agent.model,
      persona_seed_code: identity.summary.persona_seed_code,
      persona_seed_label: identity.summary.persona_seed_label,
      home_voice_line_id: identity.summary.home_voice_line_id,
      home_voice_line_label: identity.summary.home_voice_line_label,
      identity_contract_source: identity.source,
      is_followed: false,
    }
  }
}
