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
import type { ViewerWriteSourceContext } from '../../shared/forum-orchestration.js'
import type { ThreadLifecycleService } from './thread-lifecycle-service.js'
import type { ThreadInteractionResolver } from './thread-interaction-resolver.js'
import { ThreadLifecycleService as DefaultThreadLifecycleService } from './thread-lifecycle-service.js'
import { ThreadInteractionResolver as DefaultThreadInteractionResolver } from './thread-interaction-resolver.js'

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
  threadLifecycleService?: ThreadLifecycleService | null
  threadInteractionResolver?: ThreadInteractionResolver | null
}

export type HumanVoteRefreshHook = (input: {
  target_type: 'POST' | 'THREAD' | 'TURN'
  target_id: string
}) => Promise<void> | void

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
  private voteRefreshHook: HumanVoteRefreshHook | null = null

  constructor(private readonly deps: HumanParticipationServiceDeps) {}

  setVoteRefreshHook(hook: HumanVoteRefreshHook | null): void {
    this.voteRefreshHook = hook
  }

  private resolveThreadLifecycleService(): ThreadLifecycleService {
    return this.deps.threadLifecycleService ?? new DefaultThreadLifecycleService()
  }

  private resolveThreadInteractionResolver(): ThreadInteractionResolver {
    return this.deps.threadInteractionResolver ?? new DefaultThreadInteractionResolver()
  }

  async createPublicThread(input: {
    actor_user_id: string
    post_id: string
    body: string
    idempotency_key?: string | null
    source_context?: ViewerWriteSourceContext | null
  }): Promise<{
    thread: Awaited<ReturnType<PublicStageThreadRepository['create']>>
    event: Awaited<ReturnType<EventRepository['create']>>
  }> {
    const body = input.body.trim()
    if (!input.actor_user_id) throw new ValidationError('actor_user_id is required')
    if (!input.post_id) throw new ValidationError('post_id is required')
    if (!body) throw new ValidationError('body is required')

    const post = await this.deps.postRepo.findById(input.post_id)
    if (!post) throw new NotFoundError('Post', input.post_id)

    const thread = await this.deps.publicStageThreadRepo.create({
      post_id: post.id,
      community_id: post.community_id,
      author_actor_type: 'human',
      author_agent_id: null,
      author_user_id: input.actor_user_id,
      body,
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const event = await this.deps.eventRepo.create({
      event_type: 'THREAD_OPENED',
      plane: 'DATA',
      schema_version: 'v1',
      community_id: post.community_id,
      post_id: post.id,
      actor_type: 'human',
      actor_id: input.actor_user_id,
      correlation_id: `post:${post.id}`,
      idempotency_key: input.idempotency_key ?? null,
      payload_json: {
        post_id: post.id,
        community_id: post.community_id,
        author_actor_type: 'human',
        author_agent_id: null,
        author_user_id: input.actor_user_id,
        thread_id: thread.id,
        turn_id: null,
        entry_kind: 'THREAD',
        visibility: thread.visibility,
        state: thread.state,
        channel: 'STAGE',
        chain_depth: 0,
        source_context: input.source_context ?? null,
      },
    })

    return { thread, event }
  }

  async createPublicTurn(input: {
    actor_user_id: string
    thread_id: string
    body: string
    anchor_turn_id?: string | null
    quoted_excerpt?: string | null
    idempotency_key?: string | null
    source_context?: ViewerWriteSourceContext | null
    focused_turn_id?: string | null
    actual_anchor_turn_id?: string | null
  }): Promise<{
    turn: Awaited<ReturnType<PublicStageTurnRepository['create']>>
    event: Awaited<ReturnType<EventRepository['create']>>
  }> {
    const body = input.body.trim()
    if (!input.actor_user_id) throw new ValidationError('actor_user_id is required')
    if (!input.thread_id) throw new ValidationError('thread_id is required')
    if (!body) throw new ValidationError('body is required')

    const thread = await this.deps.publicStageThreadRepo.findById(input.thread_id)
    if (!thread) {
      throw new NotFoundError('Thread', input.thread_id)
    }

    const [post, currentTurnCount] = await Promise.all([
      this.deps.postRepo.findById(thread.post_id),
      this.deps.publicStageTurnRepo.countByThread(thread.id),
    ])
    if (!post) throw new NotFoundError('Post', thread.post_id)
    const lifecycle = this.resolveThreadInteractionResolver().resolveLifecycleSnapshot(
      this.resolveThreadLifecycleService().buildThreadLifecycle(thread, currentTurnCount),
    )
    if (!lifecycle.writeability.reply_allowed) {
      throw new ValidationError(`Thread ${lifecycle.thread_state.toLowerCase()} and cannot accept more turns`)
    }

    const anchorTurn = input.anchor_turn_id
      ? await this.deps.publicStageTurnRepo.findById(input.anchor_turn_id)
      : null
    if (input.anchor_turn_id && !anchorTurn) {
      throw new NotFoundError('Turn', input.anchor_turn_id)
    }
    if (anchorTurn && anchorTurn.thread_id !== thread.id) {
      throw new ValidationError('anchor_turn_id must belong to the target thread')
    }

    const turn = await this.deps.publicStageTurnRepo.create({
      thread_id: thread.id,
      post_id: thread.post_id,
      author_actor_type: 'human',
      author_agent_id: null,
      author_user_id: input.actor_user_id,
      turn_index: currentTurnCount + 1,
      anchor_turn_id: anchorTurn?.id ?? null,
      quoted_excerpt: input.quoted_excerpt ?? null,
      body,
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const event = await this.deps.eventRepo.create({
      event_type: 'THREAD_TURN_ADDED',
      plane: 'DATA',
      schema_version: 'v1',
      community_id: post.community_id,
      post_id: post.id,
      actor_type: 'human',
      actor_id: input.actor_user_id,
      correlation_id: `post:${post.id}`,
      idempotency_key: input.idempotency_key ?? null,
      payload_json: {
        post_id: post.id,
        community_id: post.community_id,
        author_actor_type: 'human',
        author_agent_id: null,
        author_user_id: input.actor_user_id,
        thread_id: thread.id,
        turn_id: turn.id,
        entry_kind: 'TURN',
        visibility: turn.visibility,
        state: turn.state,
        channel: 'STAGE',
        chain_depth: 0,
        anchor_turn_id: anchorTurn?.id ?? null,
        focused_turn_id: input.focused_turn_id ?? null,
        actual_anchor_turn_id: input.actual_anchor_turn_id ?? anchorTurn?.id ?? null,
        quoted_excerpt: input.quoted_excerpt ?? null,
        source_context: input.source_context ?? null,
      },
    })

    return { turn, event }
  }

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

    await this.refreshVoteProjection({
      target_type: input.target_type,
      target_id: input.target_id,
    })

    return { vote, summary }
  }

  private async refreshVoteProjection(input: {
    target_type: 'POST' | 'THREAD' | 'TURN'
    target_id: string
  }): Promise<void> {
    if (!this.voteRefreshHook) return
    try {
      await this.voteRefreshHook(input)
    } catch (error) {
      console.error('[HumanParticipationService] refreshVoteTarget failed after human vote:', error)
    }
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
