import type { DefaultMemoryPackRenderer, DefaultRetrievalPacker } from '../../context-memory/memory-pack.js'
import type { MemoryPack, MemoryPackRenderResult } from '../../context-memory/contracts.js'
import type { ChronicleRepository } from '../../repos/chronicle-repository.js'
import type {
  ActiveTensionItemRepository,
  ContextRelationStateRepository,
  EpisodicCardRepository,
  PrivateShadowMemoryRepository,
  RawContextEventRepository,
  SelfModelStateRepository,
} from '../../repos/context-memory-repository.js'
import type { MemoryRepository } from '../../repos/memory-repository.js'
import type { PrivateChannelRepository } from '../../repos/private-channel-repository.js'
import type {
  AgentMemory,
  AgentPrivacySettingsEntity,
  ContextMemoryScene,
  MemorySource,
  PaginatedResult,
  PaginationOpts,
} from '../../repos/types.js'
import type { PromptMemoryTier } from '../../runtime/types.js'
import type { ContextJournalService, IdentityFinalizer, SummaryOrchestrator } from '../../context-memory/contracts.js'
import type { AgentService } from '../agent-service.js'
import type { NurtureOrchestrator } from '../nurture-orchestrator.js'
import type { RelationService } from '../relation-service.js'
import type { StatsService } from '../stats-service.js'
import type { XpService } from '../xp-service.js'

export interface ContextMemoryRuntimeDeps {
  journalService: ContextJournalService
  rawEventRepo: RawContextEventRepository
  summaryOrchestrator: SummaryOrchestrator
  identityFinalizer: IdentityFinalizer
  episodicCardRepo: EpisodicCardRepository
  relationStateRepo: ContextRelationStateRepository
  selfModelStateRepo: SelfModelStateRepository
  activeTensionRepo: ActiveTensionItemRepository
  privateShadowRepo: PrivateShadowMemoryRepository
  chronicleRepo?: ChronicleRepository | null
}

export interface DigestHookInput {
  agent_id: string
  session_id: string
  memory_id: string
  importance_score: number
  sentiment: string | null
}

export type DigestHook = (input: DigestHookInput) => Promise<void> | void

export interface MemoryServiceDeps {
  memoryRepo: MemoryRepository
  channelRepo: PrivateChannelRepository
  agentService?: AgentService | null
  xpService?: XpService | null
  nurtureOrchestrator?: NurtureOrchestrator | null
  relationService?: RelationService | null
  statsService?: StatsService | null
  contextMemory?: ContextMemoryRuntimeDeps | null
  onDigestCompleted?: DigestHook
}

export interface MemoryForContext {
  memories: AgentMemory[]
  formatted: string
  pack: MemoryPack
  renders: Record<PromptMemoryTier, MemoryPackRenderResult>
  selected_tier: PromptMemoryTier
}

export interface MemoryServiceState {
  retrievalPacker: DefaultRetrievalPacker
  memoryPackRenderer: DefaultMemoryPackRenderer
  getDigestHooks(): DigestHook[]
}

export interface MemoryContextRequest {
  scene: 'private_chat' | 'forum' | 'chat_room'
  topicHints: string[]
  disclosureLevel: number
  tokenCeiling?: number
  tokenBudget?: number
  bucketTarget?: number
  memoryTier?: PromptMemoryTier
  topK: number
}

export type GetMemoriesForContextOptions = MemoryContextRequest

export interface ListMemoriesOptions extends PaginationOpts {
  source_type?: MemorySource
  forgotten?: boolean
  source_session_id?: string
  source_ref_type?: string
  source_ref_id?: string
  source_event_id?: string
}

export interface PublicObservationMemoryInput {
  agent_id: string
  source_ref_type: string
  source_ref_id: string
  source_event_id?: string
  summary_text: string
  topic_tags: string[]
  key_facts: string[]
  sentiment?: string | null
  importance_score: number
  typed_context?: {
    scene: Extract<ContextMemoryScene, 'forum' | 'chat_room'>
    transcript: string
    counterpart_id?: string | null
    evidence_refs?: string[]
    created_at?: Date
  }
}

export type { AgentMemory, AgentPrivacySettingsEntity, ContextMemoryScene, PaginatedResult }
