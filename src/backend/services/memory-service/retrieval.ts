import type { ChronicleRepository } from '../../repos/chronicle-repository.js'
import type {
  ActiveTensionItemRepository,
  ContextRelationStateRepository,
  EpisodicCardRepository,
  PrivateShadowMemoryRepository,
  RawContextEventRepository,
  SelfModelStateRepository,
} from '../../repos/context-memory-repository.js'
import type { ChronicleEntry, ContextMemoryScene, PaginatedResult } from '../../repos/types.js'
import type { TypedRetrievalState } from '../../context-memory/contracts.js'

const TYPED_EPISODIC_RETRIEVAL_LIMIT = 8
const TYPED_SHADOW_RETRIEVAL_LIMIT = 3

export interface RetrievalRuntimeDeps {
  rawEventRepo: RawContextEventRepository
  episodicCardRepo: EpisodicCardRepository
  relationStateRepo: ContextRelationStateRepository
  selfModelStateRepo: SelfModelStateRepository
  activeTensionRepo: ActiveTensionItemRepository
  privateShadowRepo: PrivateShadowMemoryRepository
  chronicleRepo?: ChronicleRepository | null
}

export function emptyTypedRetrievalState(): TypedRetrievalState {
  return {
    privateEpisodicCards: [],
    publicEpisodicCards: [],
    ownerRelation: null,
    communityRelations: [],
    roomRelations: [],
    agentRelations: [],
    selfModel: null,
    tensions: [],
    privateShadows: [],
    chronicleEntries: [],
  }
}

export async function loadTypedRetrievalState(input: {
  runtime: RetrievalRuntimeDeps | null | undefined
  agentId: string
  topK: number
  scene: ContextMemoryScene
}): Promise<TypedRetrievalState> {
  const runtime = input.runtime
  if (!runtime) return emptyTypedRetrievalState()

  const chronicleVisibility = input.scene === 'private_chat'
    ? ['OWNER_ONLY', 'PUBLIC'] as const
    : ['PUBLIC'] as const

  const [
    privateCards,
    allCards,
    ownerRelations,
    communityRelations,
    roomRelations,
    agentRelations,
    selfModel,
    tensions,
    privateShadows,
    chronicleEntries,
  ] = await Promise.all([
    runtime.episodicCardRepo.listByAgent(input.agentId, {
      limit: Math.max(input.topK * 2, TYPED_EPISODIC_RETRIEVAL_LIMIT),
      scene: 'private_chat',
    }),
    runtime.episodicCardRepo.listByAgent(input.agentId, {
      limit: Math.max(input.topK * 3, TYPED_EPISODIC_RETRIEVAL_LIMIT),
    }),
    runtime.relationStateRepo.listByAgent(input.agentId, { limit: 3, channel: 'owner' }),
    runtime.relationStateRepo.listByAgent(input.agentId, { limit: 3, channel: 'community' }),
    runtime.relationStateRepo.listByAgent(input.agentId, { limit: 3, channel: 'room' }),
    runtime.relationStateRepo.listByAgent(input.agentId, { limit: 5, channel: 'agent' }),
    runtime.selfModelStateRepo.findByAgent(input.agentId),
    runtime.activeTensionRepo.listByAgent(input.agentId, 3),
    runtime.privateShadowRepo.listByAgent(input.agentId, TYPED_SHADOW_RETRIEVAL_LIMIT),
    runtime.chronicleRepo
      ? runtime.chronicleRepo.findByAgent(input.agentId, {
          limit: 2,
          visibility: [...chronicleVisibility],
        })
      : Promise.resolve<PaginatedResult<ChronicleEntry>>({ items: [], next_cursor: null }),
  ])

  return {
    privateEpisodicCards: privateCards.items,
    publicEpisodicCards: allCards.items.filter((card) => card.scene !== 'private_chat'),
    ownerRelation: ownerRelations.items[0] ?? null,
    communityRelations: communityRelations.items,
    roomRelations: roomRelations.items,
    agentRelations: agentRelations.items,
    selfModel,
    tensions,
    privateShadows,
    chronicleEntries: chronicleEntries.items,
  }
}
