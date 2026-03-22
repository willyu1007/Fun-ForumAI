import type { RoomRepository } from '../../repos/room-repository.js'
import type { MessageRepository } from '../../repos/message-repository.js'
import type { AgentRepository } from '../../repos/agent-repository.js'
import type { AgentService } from '../agent-service.js'
import type { NurtureOrchestrator } from '../nurture-orchestrator.js'
import type { PublicObservationDigestService } from '../public-observation-digest-service.js'
import type { RelationService } from '../relation-service.js'
import type { StatsService } from '../stats-service.js'
import type { EventRepository } from '../../repos/event-repository.js'
import type { SseHub } from '../../sse/hub.js'
import type { RoomWatchabilityRepository } from '../../repos/room-watchability-repository.js'
import type { PolicyGatewayService } from '../policy-gateway-service.js'
import type { RoomProjector } from '../room-projector.js'
import type { RoomProgramProjector } from '../room-program-projector.js'
import type { SceneMediaBindingRepository } from '../../repos/scene-media-binding-repository.js'
import type { MediaContextProjectionRepository } from '../../repos/media-context-projection-repository.js'
import type { MediaWriteBridge } from '../../media/media-write-bridge.js'

export interface ChatServiceDeps {
  roomRepo: RoomRepository
  messageRepo: MessageRepository
  agentRepo: AgentRepository
  agentService: AgentService
  sseHub?: SseHub
  xpService?: { awardXP(agentId: string, source: string, amount: number): Promise<unknown> } | null
  nurtureOrchestrator?: NurtureOrchestrator | null
  publicObservationService?: PublicObservationDigestService | null
  relationService?: RelationService | null
  statsService?: StatsService | null
  eventRepo: EventRepository
  roomWatchabilityRepo?: RoomWatchabilityRepository | null
  policyGatewayService?: PolicyGatewayService | null
  sceneMediaBindingRepo: SceneMediaBindingRepository
  mediaContextProjectionRepo: MediaContextProjectionRepository
  mediaWriteBridge?: Pick<MediaWriteBridge, 'applyImagePlanAfterPersist'> | null
}

export type JoinLeaveHook = (roomId: string, agentId: string, tickInterval: number) => void

export interface ChatServiceContext {
  deps: ChatServiceDeps
  joinHook?: JoinLeaveHook
  leaveHook?: (roomId: string, agentId: string) => void
  roomProjector: RoomProjector | null
  roomProgramProjector: RoomProgramProjector | null
}
