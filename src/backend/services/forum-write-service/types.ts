import type {
  PostRepository,
  VoteRepository,
  EventRepository,
  AgentRunRepository,
  CommunityRepository,
  AgentCommunityMembershipRepository,
  RoleAssignmentRepository,
} from '../../repos/index.js'
import type { IncubationRepository } from '../../repos/incubation-repository.js'
import type { PublicSceneWriteRepository } from '../../repos/public-scene-write-repository.js'
import type { ModerationResult } from '../../moderation/types.js'
import type { AgentStageTierService } from '../agent-stage-tier-service.js'
import type { PolicyGatewayService } from '../policy-gateway-service.js'
import type { PublicSceneWritePayload } from '../public-scene-runtime.js'
import type { PublicStageThreadRepository } from '../../repos/public-stage-thread-repository.js'
import type { PublicStageTurnRepository } from '../../repos/public-stage-turn-repository.js'
import type { RouteHandoff } from '../../repos/types.js'
import type { ThreadLifecycleService } from '../thread-lifecycle-service.js'
import type { ThreadInteractionResolver } from '../thread-interaction-resolver.js'

export interface ModerationEvaluator {
  evaluate(input: {
    text: string
    author_agent_id: string
    community_id: string
    content_type: 'post' | 'thread_turn' | 'message'
    community_thresholds?: {
      low_max_score: number
      medium_max_score: number
      auto_reject_score: number
    }
  }): ModerationResult
}

export type EventHook = (event: import('../../repos/index.js').DomainEvent) => Promise<void> | void

export interface ForumWriteServiceDeps {
  postRepo: PostRepository
  publicStageThreadRepo: PublicStageThreadRepository
  publicStageTurnRepo: PublicStageTurnRepository
  publicSceneWriteRepo?: PublicSceneWriteRepository
  voteRepo: VoteRepository
  eventRepo: EventRepository
  agentRunRepo: AgentRunRepository
  communityRepo: CommunityRepository
  membershipRepo?: AgentCommunityMembershipRepository
  roleAssignmentRepo?: RoleAssignmentRepository
  stageTierService?: AgentStageTierService
  incubationRepo?: IncubationRepository
  moderator: ModerationEvaluator
  policyGatewayService?: PolicyGatewayService
  threadLifecycleService?: ThreadLifecycleService
  threadInteractionResolver?: ThreadInteractionResolver
  onEventCreated?: EventHook
}

export interface TrustContextInput {
  job_id: string
  grant_id: string
  source_bundle_ids: string[]
  citation_urls?: string[]
  redaction_profile?: 'strong' | 'medium' | 'light'
}

export type ForumSceneCarrierInput = PublicSceneWritePayload

export interface RouteHandoffInput {
  route_type: RouteHandoff['route_type']
  route_state?: string
  reason_code: string
  handoff_label: string
  handoff_payload?: Record<string, unknown> | null
  cta?: Record<string, unknown> | null
}

export interface ForumWriteContext {
  deps: ForumWriteServiceDeps
}
