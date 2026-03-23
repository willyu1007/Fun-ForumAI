import type {
  AgentRun,
  Comment,
  DomainEvent,
  Post,
  Vote,
} from '../repos/index.js'
import { NotFoundError, ValidationError } from '../lib/errors.js'
import { createComment } from './forum-write-service/comment-command.js'
import { createPost } from './forum-write-service/post-command.js'
import type {
  EventHook,
  ForumSceneCarrierInput,
  ForumWriteServiceDeps,
  RouteHandoffInput,
} from './forum-write-service/types.js'
import { upsertVote } from './forum-write-service/vote-command.js'

export type {
  EventHook,
  ForumSceneCarrierInput,
  ForumWriteServiceDeps,
  ModerationEvaluator,
} from './forum-write-service/types.js'

export class ForumWriteService {
  constructor(private readonly deps: ForumWriteServiceDeps) {}

  setEventHook(hook: EventHook): void {
    this.deps.onEventCreated = hook
  }

  async createPost(input: {
    actor_agent_id: string
    run_id: string
    community_id: string
    title: string
    body: string
    tags?: string[]
    chain_depth?: number
    trust_context?: import('./forum-write-service/types.js').TrustContextInput
    scene?: ForumSceneCarrierInput
  }): Promise<{ post: Post; moderation: import('../moderation/types.js').ModerationResult; event: DomainEvent; agentRun: AgentRun }> {
    return createPost({ deps: this.deps }, input)
  }

  async createThread(input: {
    actor_agent_id: string
    run_id: string
    post_id: string
    body: string
    channel?: 'STAGE' | 'ASIDE'
    chain_depth?: number
    route_handoff?: RouteHandoffInput
    scene?: ForumSceneCarrierInput
  }): Promise<{ comment: Comment; moderation: import('../moderation/types.js').ModerationResult; event: DomainEvent }> {
    return createComment({ deps: this.deps }, input)
  }

  async addThreadTurn(input: {
    actor_agent_id: string
    run_id: string
    thread_id: string
    anchor_turn_id?: string
    body: string
    channel?: 'STAGE' | 'ASIDE'
    chain_depth?: number
    route_handoff?: RouteHandoffInput
    scene?: ForumSceneCarrierInput
  }): Promise<{ comment: Comment; moderation: import('../moderation/types.js').ModerationResult; event: DomainEvent }> {
    const thread = await this.deps.publicStageThreadRepo.findById(input.thread_id)
    if (!thread) {
      throw new NotFoundError('Thread', input.thread_id)
    }
    if (thread.thread_state === 'CLOSED' || thread.thread_state === 'SPINOFF') {
      throw new ValidationError(`Thread ${thread.thread_state.toLowerCase()} and cannot accept more turns`)
    }
    const currentTurnCount = await this.deps.publicStageTurnRepo.countByThread(input.thread_id)
    if (currentTurnCount >= thread.reply_budget) {
      throw new ValidationError('Thread reply budget exhausted')
    }

    let parentCommentId = input.thread_id
    if (input.anchor_turn_id) {
      const anchorTurn = await this.deps.commentRepo.findById(input.anchor_turn_id)
      if (!anchorTurn || anchorTurn.comment_kind !== 'TURN') {
        throw new NotFoundError('Turn', input.anchor_turn_id)
      }
      if (anchorTurn.thread_id !== input.thread_id) {
        throw new ValidationError('anchor_turn_id must belong to the target thread')
      }
      parentCommentId = anchorTurn.id
    }

    return createComment(
      { deps: this.deps },
      {
        actor_agent_id: input.actor_agent_id,
        run_id: input.run_id,
        post_id: thread.post_id,
        parent_comment_id: parentCommentId,
        body: input.body,
        channel: input.channel,
        chain_depth: input.chain_depth,
        route_handoff: input.route_handoff,
        scene: input.scene,
      },
    )
  }

  async upsertVote(input: {
    actor_agent_id: string
    run_id: string
    target_type: 'POST' | 'COMMENT' | 'MESSAGE'
    target_id: string
    direction: 'UP' | 'DOWN' | 'NEUTRAL'
    is_autonomous?: boolean
    chain_depth?: number
  }): Promise<{ vote: Vote; event: DomainEvent }> {
    return upsertVote({ deps: this.deps }, input)
  }
}
