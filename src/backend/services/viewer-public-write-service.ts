import type { EventRepository } from '../repos/event-repository.js'
import type {
  PublicStageThreadWithAuthor,
} from './forum-read-service.js'
import type { ForumReadService } from './forum-read-service.js'
import type { HumanParticipationService } from './human-participation-service.js'
import type { ParticipationContractService } from './participation-contract-service.js'
import { ForbiddenError } from '../lib/errors.js'
import type {
  ViewerWriteResult,
  ViewerWriteSourceContext,
} from '../../shared/forum-orchestration.js'

export interface ViewerPublicWriteServiceDeps {
  eventRepo: EventRepository
  humanParticipationService: Pick<
    HumanParticipationService,
    'createPublicThread' | 'createPublicTurn'
  >
  forumReadService: Pick<ForumReadService, 'getThread'>
  participationContractService: Pick<ParticipationContractService, 'getPostContract'>
}

export class ViewerPublicWriteService {
  constructor(private readonly deps: ViewerPublicWriteServiceDeps) {}

  async createPublicThread(input: {
    actor_user_id: string
    post_id: string
    body: string
    idempotency_key?: string | null
    source_context?: ViewerWriteSourceContext | null
  }): Promise<ViewerWriteResult<PublicStageThreadWithAuthor>> {
    const contract = await this.deps.participationContractService.getPostContract(input.post_id)
    if (!contract.stage_thread_entry_enabled) {
      throw new ForbiddenError('Post does not allow viewer thread entry on the main stage')
    }

    const existing = await this.resolveExistingResult(input.idempotency_key, input.actor_user_id)
    if (existing) return existing

    const result = await this.deps.humanParticipationService.createPublicThread({
      actor_user_id: input.actor_user_id,
      post_id: input.post_id,
      body: input.body,
      idempotency_key: input.idempotency_key ?? null,
      source_context: input.source_context ?? null,
    })
    const data = await this.deps.forumReadService.getThread(result.thread.id, input.actor_user_id)
    return {
      result: 'CREATED',
      audit_id: result.event.id,
      data,
    }
  }

  async createPublicTurn(input: {
    actor_user_id: string
    post_id: string
    thread_id: string
    body: string
    idempotency_key?: string | null
    source_context?: ViewerWriteSourceContext | null
    focused_turn_id?: string | null
    actual_anchor_turn_id?: string | null
    quoted_excerpt?: string | null
  }): Promise<ViewerWriteResult<PublicStageThreadWithAuthor>> {
    const contract = await this.deps.participationContractService.getPostContract(input.post_id)
    if (!contract.stage_turn_reply_enabled) {
      throw new ForbiddenError('Post does not allow viewer turn replies on the main stage')
    }

    const existing = await this.resolveExistingResult(input.idempotency_key, input.actor_user_id)
    if (existing) return existing

    const result = await this.deps.humanParticipationService.createPublicTurn({
      actor_user_id: input.actor_user_id,
      thread_id: input.thread_id,
      body: input.body,
      anchor_turn_id: input.actual_anchor_turn_id ?? input.focused_turn_id ?? null,
      quoted_excerpt: input.quoted_excerpt ?? null,
      idempotency_key: input.idempotency_key ?? null,
      source_context: input.source_context ?? null,
      focused_turn_id: input.focused_turn_id ?? null,
      actual_anchor_turn_id: input.actual_anchor_turn_id ?? null,
    })
    const data = await this.deps.forumReadService.getThread(input.thread_id, input.actor_user_id)
    return {
      result: 'CREATED',
      audit_id: result.event.id,
      data,
    }
  }

  private async resolveExistingResult(
    idempotencyKey: string | null | undefined,
    viewerUserId: string,
  ): Promise<ViewerWriteResult<PublicStageThreadWithAuthor> | null> {
    if (!idempotencyKey) {
      return null
    }
    const existing = this.deps.eventRepo.findByIdempotencyKey(idempotencyKey)
    const threadId = typeof existing?.payload_json?.thread_id === 'string'
      ? existing.payload_json.thread_id
      : null
    if (!existing || !threadId) {
      return null
    }
    const data = await this.deps.forumReadService.getThread(threadId, viewerUserId)
    return {
      result: 'CREATED',
      audit_id: existing.id,
      data,
    }
  }
}
