import { config } from '../../lib/config.js'
import { personaObservability } from '../../runtime/persona-observability.js'
import {
  backfillLegacyPublicObservations,
  emptyTypedRetrievalState,
  loadTypedRetrievalState,
  selectLegacyMemories,
} from './retrieval.js'
import type {
  GetMemoriesForContextOptions,
  MemoryForContext,
  MemoryServiceDeps,
  MemoryServiceState,
} from './types.js'

export async function getMemoriesForContext(
  deps: MemoryServiceDeps,
  state: MemoryServiceState,
  agentId: string,
  opts: GetMemoriesForContextOptions,
): Promise<MemoryForContext> {
  const allMemories = await deps.memoryRepo.findActiveMemories(agentId, {})
  let effectiveTopK = opts.topK
  let effectiveBudget = opts.tokenBudget

  if (config.features.agentStatsBehavior && deps.statsService) {
    const knobs = deps.statsService.getDerivedSync(agentId, {
      privacy_top_k: opts.topK,
      privacy_budget: opts.tokenBudget,
    })
    effectiveTopK = knobs.memory.effective_top_k
    effectiveBudget = knobs.memory.effective_budget
  }

  let filtered = allMemories
  if (opts.scene !== 'private_chat') {
    filtered = allMemories.filter((memory) => memory.privacy_floor <= opts.disclosureLevel)
  }

  const selectedLegacy = selectLegacyMemories({
    memories: filtered,
    topicHints: opts.topicHints,
    topK: effectiveTopK,
    tokenBudget: effectiveBudget,
  })
  let typed = deps.contextMemory
    ? await loadTypedRetrievalState({
        runtime: deps.contextMemory,
        agentId,
        topK: effectiveTopK,
        scene: opts.scene,
      })
    : emptyTypedRetrievalState()

  if (deps.contextMemory && typed.publicEpisodicCards.length === 0) {
    const backfilledCount = await backfillLegacyPublicObservations({
      runtime: deps.contextMemory,
      agentId,
      memories: selectedLegacy,
    })
    if (backfilledCount > 0) {
      typed = await loadTypedRetrievalState({
        runtime: deps.contextMemory,
        agentId,
        topK: effectiveTopK,
        scene: opts.scene,
      })
    }
  }

  const memoryPack = state.retrievalPacker.pack({
    agentId,
    scene: opts.scene,
    topicHints: opts.topicHints,
    disclosureLevel: opts.disclosureLevel,
    tokenBudget: effectiveBudget,
    legacyMemories: selectedLegacy,
    typed,
  })
  const formatted = state.memoryPackRenderer.render(memoryPack, effectiveBudget).text

  if (memoryPack.selectedMemories.length > 0) {
    await deps.memoryRepo
      .incrementAccessCount(memoryPack.selectedMemories.map((memory) => memory.id))
      .catch((err) => {
        console.error('[MemoryService] incrementAccessCount failed:', err)
      })
  }

  personaObservability.recordRetrieval(memoryPack.observability)

  return { memories: memoryPack.selectedMemories, formatted }
}
