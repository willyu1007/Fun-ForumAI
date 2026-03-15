import type {
  PostRepository,
  CommentRepository,
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

export interface ModerationEvaluator {
  evaluate(input: {
    text: string
    author_agent_id: string
    community_id: string
    content_type: 'post' | 'comment' | 'message'
    community_thresholds?: {
      low_max_score: number
      medium_max_score: number
      auto_reject_score: number
    }
  }): ModerationResult
}

export type EventHook = (event: import('../../repos/index.js').DomainEvent) => void

export interface ForumWriteServiceDeps {
  postRepo: PostRepository
  commentRepo: CommentRepository
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

export interface ForumWriteContext {
  deps: ForumWriteServiceDeps
}
