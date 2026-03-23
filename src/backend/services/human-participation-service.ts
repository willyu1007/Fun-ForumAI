import type {
  AgentRepository,
  EventRepository,
  HumanFollowRepository,
  HumanVote,
  HumanVoteRepository,
  PostRepository,
  PublicStageThreadRepository,
  PublicStageTurnRepository,
  VoteRepository,
} from '../repos/index.js'
import { NotFoundError, ValidationError } from '../lib/errors.js'
import { HUMAN_VOTE_WEIGHT } from '../lib/constants.js'

export { HUMAN_VOTE_WEIGHT }

export interface HumanParticipationServiceDeps {
  postRepo: PostRepository
  publicStageThreadRepo: PublicStageThreadRepository
  publicStageTurnRepo: PublicStageTurnRepository
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

export class HumanParticipationService {
  constructor(private readonly deps: HumanParticipationServiceDeps) {}

  async upsertHumanVote(input: {
    voter_user_id: string
    target_type: 'POST' | 'THREAD' | 'TURN'
    target_id: string
    direction: 'UP' | 'DOWN' | 'NEUTRAL'
  }): Promise<{ vote: HumanVote; summary: HumanVoteSummary }> {
    if (!input.voter_user_id) throw new ValidationError('voter_user_id is required')
    if (!input.target_id) throw new ValidationError('target_id is required')

    if (input.target_type !== 'POST' && input.target_type !== 'THREAD' && input.target_type !== 'TURN') {
      throw new ValidationError('target_type must be POST, THREAD, or TURN')
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

  async assertTargetExists(targetType: 'POST' | 'THREAD' | 'TURN', targetId: string): Promise<void> {
    if (targetType === 'POST') {
      const post = await this.deps.postRepo.findById(targetId)
      if (!post) throw new NotFoundError('Post', targetId)
      return
    }

    const target = targetType === 'THREAD'
      ? await this.deps.publicStageThreadRepo.findById(targetId)
      : await this.deps.publicStageTurnRepo.findById(targetId)
    if (!target) throw new NotFoundError(targetType === 'THREAD' ? 'Thread' : 'Turn', targetId)
  }

  getVoteSummary(targetType: 'POST' | 'THREAD' | 'TURN', targetId: string): HumanVoteSummary {
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
    targetType: 'POST' | 'THREAD' | 'TURN',
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

  isFollowing(userId: string, agentId: string): boolean {
    return this.deps.humanFollowRepo.isFollowing(userId, agentId)
  }
}
