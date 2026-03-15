import type { RoomRepository } from '../../repos/room-repository.js'
import type { MessageRepository } from '../../repos/message-repository.js'
import type { AgentRepository } from '../../repos/agent-repository.js'
import type { AgentService } from '../agent-service.js'
import type { ChatService } from '../chat-service.js'
import type { LLMGateway } from '../../llm/llm-gateway.js'
import type { PromptLayerService } from '../../runtime/prompt-layer-service.js'
import type { PromptOrchestrator } from '../../runtime/prompt-orchestrator.js'
import type { RenderTierDecisionResult } from '../../runtime/persona-runtime-types.js'
import type { SseHub } from '../../sse/hub.js'
import type { Agent, AgentConfig, ChatMessageKind, CreateChatMessageInput } from '../../repos/types.js'
import type { LeaderElector } from '../../runtime/leader-elector.js'
import type { PersonaStateService } from '../persona-state-service.js'
import type { InferenceProfileService } from '../inference-profile-service.js'
import type {
  ChatroomRuntimeContextBuilder,
  ChatroomRuntimeContextResult,
} from '../chatroom-runtime-context-builder.js'
import type { RoomWatchabilityRepository } from '../../repos/room-watchability-repository.js'
import type { EventRepository, AgentRunRepository } from '../../repos/event-repository.js'
import type { LlmTokenUsage } from '../../llm/types.js'
import type { PersonaObservationV1 } from '../../runtime/persona-observation.js'
import type { RoomProgramEngine } from '../room-program-engine.js'
import type { RoomEcologyService } from '../room-ecology-service.js'
import type { RuntimeSceneStateManager } from '../runtime-scene-state-manager.js'

export interface ConversationClockDeps {
  roomRepo: RoomRepository
  messageRepo: MessageRepository
  agentRepo: AgentRepository
  agentService: AgentService
  chatService: ChatService
  llmGateway: LLMGateway
  sseHub: SseHub
  eventRepo: EventRepository
  agentRunRepo: AgentRunRepository
  promptLayerService?: PromptLayerService | null
  promptOrchestrator?: PromptOrchestrator | null
  personaStateService?: PersonaStateService | null
  inferenceProfileService?: InferenceProfileService | null
  chatroomRuntimeContextBuilder?: ChatroomRuntimeContextBuilder | null
  roomWatchabilityRepo?: RoomWatchabilityRepository | null
  roomProgramEngine?: RoomProgramEngine | null
  roomEcologyService?: RoomEcologyService | null
  runtimeSceneStateManager?: RuntimeSceneStateManager | null
  leaderElector?: LeaderElector
}

export interface AgentTimer {
  roomId: string
  agentId: string
  tickInterval: number
  timer: ReturnType<typeof setTimeout>
}

export interface GeneratedMessageResult {
  kind: 'normal' | 'skip_feedback' | 'empty'
  body: string
  usage?: LlmTokenUsage
  latency_ms?: number
  observation?: PersonaObservationV1
  renderDecision?: RenderTierDecisionResult | null
}

export interface RecordGeneratedMessageRunInput {
  roomId: string
  agentId: string
  body: string
  kind: ChatMessageKind
  usage?: LlmTokenUsage
  latencyMs?: number
  observation?: PersonaObservationV1
}

export type ProgramMessageMetadata = Pick<
  CreateChatMessageInput,
  'episode_id' | 'beat_id' | 'program_event_id' | 'speaker_role' | 'cue_type'
>

export interface ConversationClockContext {
  deps: ConversationClockDeps
  running: boolean
  timers: Map<string, AgentTimer>
  roomLocks: Set<string>
  timerKey(roomId: string, agentId: string): string
  scheduleAgent(
    roomId: string,
    agentId: string,
    tickInterval: number,
    delayMs?: number,
  ): void
  onAgentLeft(roomId: string, agentId: string): void
  handleProgramTick(roomId: string, triggerAgentId: string): Promise<void>
  generateMessage(roomId: string, agentId: string): Promise<GeneratedMessageResult>
  postMessage(
    roomId: string,
    agentId: string,
    body: string,
    kind: ChatMessageKind,
    renderDecision?: RenderTierDecisionResult | null,
    metadata?: ProgramMessageMetadata,
  ): Promise<void>
  recordGeneratedMessageRun(input: RecordGeneratedMessageRunInput): Promise<void>
}

export interface ResolvedClockIdentity {
  visiblePersona: {
    name: string
    style: string
    interests: string[]
    language: string
  }
  homeVoiceLineId: import('../../../shared/agent-persona-catalog.js').VoiceLineId
  observationIdentity: {
    persona_seed_code: import('../../../shared/agent-persona-catalog.js').PersonaSeedCode
    home_voice_line_id: import('../../../shared/agent-persona-catalog.js').VoiceLineId
  } | null
}

export type { Agent, AgentConfig, ChatroomRuntimeContextResult }
