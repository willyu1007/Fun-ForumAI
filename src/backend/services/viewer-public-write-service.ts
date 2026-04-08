import type { AudienceService } from './audience-service.js'
import type { HumanParticipationService } from './human-participation-service.js'
import type { PublicWriteGovernanceService } from './public-write-governance-service.js'
import type {
  PublicWriteCommunityRole,
  PublicWriteResult,
  ViewerWriteSourceContext,
} from '../../shared/forum-orchestration.js'

export interface ViewerPublicWriteServiceDeps {
  humanParticipationService: Pick<
    HumanParticipationService,
    'createPublicThread' | 'createPublicTurn'
  >
  audienceService: Pick<AudienceService, 'createAcceptedMessage'>
  publicWriteGovernanceService: Pick<PublicWriteGovernanceService, 'handleWrite'>
}

export class ViewerPublicWriteService {
  constructor(private readonly deps: ViewerPublicWriteServiceDeps) {}

  async createPublicThread(input: {
    actor_user_id: string
    actor_role: 'user' | 'admin'
    community_role: PublicWriteCommunityRole
    client_ip: string | null
    session_id: string | null
    user_agent_hash: string | null
    post_id: string
    body: string
    idempotency_key?: string | null
    source_context?: ViewerWriteSourceContext | null
  }): Promise<PublicWriteResult> {
    return this.deps.publicWriteGovernanceService.handleWrite({
      action: 'CREATE_PUBLIC_THREAD',
      actor_user_id: input.actor_user_id,
      actor_role: input.actor_role,
      community_role: input.community_role,
      client_ip: input.client_ip,
      session_id: input.session_id,
      user_agent_hash: input.user_agent_hash,
      post_id: input.post_id,
      body: input.body,
      idempotency_key: input.idempotency_key ?? null,
      source_context: input.source_context ?? null,
      executeAcceptedWrite: async () => {
        const result = await this.deps.humanParticipationService.createPublicThread({
          actor_user_id: input.actor_user_id,
          post_id: input.post_id,
          body: input.body,
          idempotency_key: null,
          source_context: input.source_context ?? null,
        })

        return {
          thread_id: result.thread.id,
          turn_id: null,
          audience_message_id: null,
        }
      },
    })
  }

  async createPublicTurn(input: {
    actor_user_id: string
    actor_role: 'user' | 'admin'
    community_role: PublicWriteCommunityRole
    client_ip: string | null
    session_id: string | null
    user_agent_hash: string | null
    post_id: string
    thread_id: string
    body: string
    idempotency_key?: string | null
    source_context?: ViewerWriteSourceContext | null
    focused_turn_id?: string | null
    actual_anchor_turn_id?: string | null
    quoted_excerpt?: string | null
  }): Promise<PublicWriteResult> {
    return this.deps.publicWriteGovernanceService.handleWrite({
      action: 'CREATE_PUBLIC_TURN',
      actor_user_id: input.actor_user_id,
      actor_role: input.actor_role,
      community_role: input.community_role,
      client_ip: input.client_ip,
      session_id: input.session_id,
      user_agent_hash: input.user_agent_hash,
      post_id: input.post_id,
      thread_id: input.thread_id,
      body: input.body,
      idempotency_key: input.idempotency_key ?? null,
      source_context: input.source_context ?? null,
      executeAcceptedWrite: async () => {
        const result = await this.deps.humanParticipationService.createPublicTurn({
          actor_user_id: input.actor_user_id,
          thread_id: input.thread_id,
          body: input.body,
          anchor_turn_id: input.actual_anchor_turn_id ?? input.focused_turn_id ?? null,
          quoted_excerpt: input.quoted_excerpt ?? null,
          idempotency_key: null,
          source_context: input.source_context ?? null,
          focused_turn_id: input.focused_turn_id ?? null,
          actual_anchor_turn_id: input.actual_anchor_turn_id ?? null,
        })

        return {
          thread_id: input.thread_id,
          turn_id: result.turn.id,
          audience_message_id: null,
        }
      },
    })
  }

  async createAudienceMessage(input: {
    actor_user_id: string
    actor_role: 'user' | 'admin'
    community_role: PublicWriteCommunityRole
    client_ip: string | null
    session_id: string | null
    user_agent_hash: string | null
    post_id: string
    body: string
    idempotency_key?: string | null
    source_context?: ViewerWriteSourceContext | null
  }): Promise<PublicWriteResult> {
    return this.deps.publicWriteGovernanceService.handleWrite({
      action: 'CREATE_AUDIENCE_MESSAGE',
      actor_user_id: input.actor_user_id,
      actor_role: input.actor_role,
      community_role: input.community_role,
      client_ip: input.client_ip,
      session_id: input.session_id,
      user_agent_hash: input.user_agent_hash,
      post_id: input.post_id,
      body: input.body,
      idempotency_key: input.idempotency_key ?? null,
      source_context: input.source_context ?? null,
      executeAcceptedWrite: async () => {
        const result = await this.deps.audienceService.createAcceptedMessage({
          post_id: input.post_id,
          actor_user_id: input.actor_user_id,
          body: input.body,
        })

        return {
          thread_id: result.thread.id,
          turn_id: null,
          audience_message_id: result.message.id,
        }
      },
    })
  }
}
