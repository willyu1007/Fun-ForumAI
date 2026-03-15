import type {
  AgentRun,
  Comment,
  DomainEvent,
  Post,
  Vote,
} from '../repos/index.js'
import { createComment } from './forum-write-service/comment-command.js'
import { createPost } from './forum-write-service/post-command.js'
import type {
  EventHook,
  ForumSceneCarrierInput,
  ForumWriteServiceDeps,
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

  async createComment(input: {
    actor_agent_id: string
    run_id: string
    post_id: string
    parent_comment_id?: string
    body: string
    channel?: 'STAGE' | 'ASIDE'
    chain_depth?: number
    scene?: ForumSceneCarrierInput
  }): Promise<{ comment: Comment; moderation: import('../moderation/types.js').ModerationResult; event: DomainEvent }> {
    return createComment({ deps: this.deps }, input)
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
