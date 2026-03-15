import type { ChronicleRepository } from '../../repos/chronicle-repository.js'
import type {
  ActiveTensionItemRepository,
  ContextRelationStateRepository,
  EpisodicCardRepository,
  PrivateShadowMemoryRepository,
  RawContextEventRepository,
  SelfModelStateRepository,
} from '../../repos/context-memory-repository.js'
import type { AgentMemory, ChronicleEntry, ContextMemoryScene, PaginatedResult } from '../../repos/types.js'
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

export async function backfillLegacyPublicObservations(input: {
  runtime: RetrievalRuntimeDeps | null | undefined
  agentId: string
  memories: AgentMemory[]
}): Promise<number> {
  const runtime = input.runtime
  if (!runtime) return 0

  const candidates = input.memories
    .filter((memory) => memory.agent_id === input.agentId)
    .filter((memory) => memory.source_type === 'PUBLIC_OBSERVATION')
    .sort(
      (a, b) =>
        b.importance_score - a.importance_score || b.created_at.getTime() - a.created_at.getTime(),
    )
    .slice(0, 2)

  let backfilled = 0
  for (const memory of candidates) {
    const scene = inferLegacyPublicObservationScene(memory)
    const rawEventId = legacyPublicObservationRawEventId(memory.id)
    const existing = await runtime.rawEventRepo.findById(rawEventId)
    if (existing) continue

    const sourceRefId = memory.source_ref_id ?? memory.id
    const counterpartId = scene === 'chat_room' ? sourceRefId : null

    await runtime.rawEventRepo.upsert({
      id: rawEventId,
      agent_id: memory.agent_id,
      scene,
      source_type: scene === 'chat_room' ? 'chat_room_window' : 'forum_thread',
      source_ref_id: sourceRefId,
      counterpart_id: counterpartId,
      transcript: buildLegacyPublicObservationTranscript(memory),
      evidence_refs: [
        `legacy_memory:${memory.id}`,
        ...(memory.source_event_id ? [`legacy_event:${memory.source_event_id}`] : []),
      ],
      created_at: memory.created_at,
    })

    await runtime.episodicCardRepo.upsert({
      id: legacyPublicObservationCardId(memory.id),
      agent_id: memory.agent_id,
      event_id: rawEventId,
      scene,
      title: buildLegacyPublicObservationTitle(memory),
      summary: memory.summary_text,
      topic_tags: [...memory.topic_tags],
      evidence_refs: [
        `legacy_memory:${memory.id}`,
        ...(memory.source_event_id ? [`legacy_event:${memory.source_event_id}`] : []),
      ],
      salience: clamp01(memory.importance_score),
      created_at: memory.created_at,
    })
    backfilled += 1
  }

  return backfilled
}

export function selectLegacyMemories(input: {
  memories: AgentMemory[]
  topicHints: string[]
  topK: number
  tokenBudget: number
}): AgentMemory[] {
  const scored = input.memories.map((memory) => {
    const tagMatchScore = computeTagMatch(memory.topic_tags, input.topicHints)
    const memoryAgeDays = Math.max(
      0,
      (Date.now() - memory.created_at.getTime()) / (24 * 60 * 60 * 1000),
    )
    const recencyBoost = Math.max(0, 1 - memoryAgeDays / 7) * 0.15
    const combinedScore = tagMatchScore * 0.45 + memory.importance_score * 0.4 + recencyBoost
    return { memory, score: combinedScore }
  })

  scored.sort((a, b) => b.score - a.score)
  const selected: AgentMemory[] = []
  const usedPrimaryTags = new Set<string>()
  for (const item of scored) {
    if (selected.length >= input.topK) break
    const primaryTag = item.memory.topic_tags[0]?.toLowerCase() ?? ''
    if (primaryTag && usedPrimaryTags.has(primaryTag) && selected.length < input.topK - 1) {
      continue
    }
    selected.push(item.memory)
    if (primaryTag) usedPrimaryTags.add(primaryTag)
  }

  let totalTokens = 0
  const budgetFiltered: AgentMemory[] = []
  for (const memory of selected) {
    const estimatedTokens = Math.ceil(memory.summary_text.length / 3)
    if (totalTokens + estimatedTokens > input.tokenBudget) break
    budgetFiltered.push(memory)
    totalTokens += estimatedTokens
  }
  return budgetFiltered
}

function computeTagMatch(memoryTags: string[], topicHints: string[]): number {
  if (memoryTags.length === 0 || topicHints.length === 0) return 0
  const hintSet = new Set(topicHints.map((hint) => hint.toLowerCase()))
  let matches = 0
  for (const tag of memoryTags) {
    if (hintSet.has(tag.toLowerCase())) matches++
  }
  return matches / Math.max(memoryTags.length, topicHints.length)
}

function legacyPublicObservationRawEventId(memoryId: string): string {
  return `ctxevent:legacy-public-observation:${memoryId}`
}

function legacyPublicObservationCardId(memoryId: string): string {
  return `ctxepisode:legacy-public-observation:${memoryId}:1`
}

function inferLegacyPublicObservationScene(
  memory: AgentMemory,
): Extract<ContextMemoryScene, 'forum' | 'chat_room'> {
  return memory.source_ref_type === 'room' ? 'chat_room' : 'forum'
}

function buildLegacyPublicObservationTranscript(memory: AgentMemory): string {
  const keyFacts = memory.key_facts.length > 0
    ? memory.key_facts.map((fact, index) => `线索${index + 1}: ${fact}`)
    : ['线索1: 缺少结构化线索，使用兼容摘要回填 typed public observation。']
  return [`兼容摘要: ${memory.summary_text}`, ...keyFacts].join('\n')
}

function buildLegacyPublicObservationTitle(memory: AgentMemory): string {
  const firstFact = memory.key_facts[0]?.trim()
  if (firstFact) return trim(firstFact, 32)
  const prefix = memory.source_ref_type === 'room' ? '聊天室公共观察' : '论坛公共观察'
  return trim(`${prefix} | ${memory.summary_text}`, 32)
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function trim(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`
}
