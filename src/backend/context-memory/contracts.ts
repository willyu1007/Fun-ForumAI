import type { OwnerStylePins } from '../identity/agent-identity.js'
import type {
  AgentMemory,
  ChronicleEntry,
  ContextActiveTensionItem,
  ContextEpisodicCard,
  ContextMemorySourceType,
  ContextPrivateShadowMemory,
  ContextRawEvent,
  ContextRelationState,
  ContextSelfModelState,
  ContextMemoryScene,
  UpsertContextActiveTensionItemInput,
  UpsertContextEpisodicCardInput,
  UpsertContextPrivateShadowMemoryInput,
  UpsertContextRelationStateInput,
  UpsertContextSelfModelStateInput,
} from '../repos/types.js'

export type RawContextEvent = ContextRawEvent
export type EpisodicCard = ContextEpisodicCard
export type RelationState = ContextRelationState
export type SelfModelState = ContextSelfModelState
export type ActiveTensionItem = ContextActiveTensionItem
export type PrivateShadowMemory = ContextPrivateShadowMemory

export interface SummaryExtractResult {
  summaryText: string
  topicTags: string[]
  keyFacts: string[]
  sentiment: string
  importanceScore: number
  ownerSignals: string[]
  notableMoments: string[]
  candidateTensions: string[]
  publicSafeShadowHint: string
}

export interface SummaryDistillResult {
  origin: {
    eventId: string
    scene: ContextMemoryScene
    sourceType: ContextMemorySourceType
  }
  episodicCards: UpsertContextEpisodicCardInput[]
  relationState: UpsertContextRelationStateInput | null
  selfModel: UpsertContextSelfModelStateInput | null
  tensions: UpsertContextActiveTensionItemInput[]
  privateShadow: UpsertContextPrivateShadowMemoryInput | null
  memoryDigest: {
    summary_text: string
    topic_tags: string[]
    key_facts: string[]
    sentiment: string
    importance_score: number
  }
}

export interface IdentityFinalizeResult {
  relationState: UpsertContextRelationStateInput | null
  selfModel: UpsertContextSelfModelStateInput | null
  tensions: UpsertContextActiveTensionItemInput[]
  privateShadow: UpsertContextPrivateShadowMemoryInput | null
  ownerStylePinsPatch: Partial<OwnerStylePins>
}

export interface MemoryPackSlot {
  slotId:
    | 'owner_private'
    | 'public_observation'
    | 'topic_recall'
    | 'recent_recall'
    | 'durable_threads'
    | 'safe_shadow'
  title: string
  items: string[]
}

export interface MemoryPack {
  slots: MemoryPackSlot[]
  selectedMemories: AgentMemory[]
  tokenEstimate: number
  observability: {
    publicObservationSource: 'typed' | 'empty'
  }
}

export interface TypedRetrievalState {
  privateEpisodicCards: EpisodicCard[]
  publicEpisodicCards: EpisodicCard[]
  ownerRelation: RelationState | null
  communityRelations: RelationState[]
  roomRelations: RelationState[]
  agentRelations: RelationState[]
  selfModel: SelfModelState | null
  tensions: ActiveTensionItem[]
  privateShadows: PrivateShadowMemory[]
  chronicleEntries: ChronicleEntry[]
}

export interface ContextJournalService {
  record(event: RawContextEvent): Promise<RawContextEvent>
}

export interface SummaryOrchestrator {
  extract(event: RawContextEvent): Promise<SummaryExtractResult>
  distill(event: RawContextEvent, extracted: SummaryExtractResult): Promise<SummaryDistillResult>
}

export interface IdentityFinalizer {
  finalize(agentId: string, input: SummaryDistillResult): Promise<IdentityFinalizeResult>
}

export interface RetrievalPacker {
  pack(input: {
    agentId: string
    scene: ContextMemoryScene
    topicHints: string[]
    disclosureLevel: number
    tokenBudget: number
    typed: TypedRetrievalState
  }): MemoryPack
}

export interface MemoryPackRenderer {
  render(pack: MemoryPack, tokenBudget: number): {
    text: string
    tokenEstimate: number
  }
}
