import { config } from '../../lib/config.js'
import { personaObservability } from '../../runtime/persona-observability.js'
import {
  emptyTypedRetrievalState,
  loadTypedRetrievalState,
} from './retrieval.js'
import type { PromptMemoryTier } from '../../runtime/types.js'
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
  let effectiveTopK = opts.topK
  let effectiveBudget = opts.tokenCeiling ?? opts.tokenBudget ?? 400
  const requestedMemoryTier = opts.memoryTier ?? 'full'

  if (config.features.agentStatsBehavior && deps.statsService) {
    const knobs = deps.statsService.getDerivedSync(agentId, {
      privacy_top_k: opts.topK,
      privacy_budget: effectiveBudget,
    })
    effectiveTopK = knobs.memory.effective_top_k
    effectiveBudget = knobs.memory.effective_budget
  }

  const typed = deps.contextMemory
    ? await loadTypedRetrievalState({
        runtime: deps.contextMemory,
        agentId,
        topK: effectiveTopK,
        scene: opts.scene,
      })
    : emptyTypedRetrievalState()

  const memoryPack = state.retrievalPacker.pack({
    agentId,
    scene: opts.scene,
    topicHints: opts.topicHints,
    disclosureLevel: opts.disclosureLevel,
    tokenBudget: effectiveBudget,
    typed,
  })
  const renders = buildTierRenders(state, memoryPack, effectiveBudget)
  const selectedTier = pickSelectedTier(requestedMemoryTier, renders)
  const formatted = renders[selectedTier].text

  if (memoryPack.selectedMemories.length > 0) {
    await deps.memoryRepo
      .incrementAccessCount(memoryPack.selectedMemories.map((memory) => memory.id))
      .catch((err) => {
        console.error('[MemoryService] incrementAccessCount failed:', err)
      })
  }

  personaObservability.recordRetrieval(memoryPack.observability)

  return {
    memories: memoryPack.selectedMemories,
    formatted,
    pack: memoryPack,
    renders,
    selected_tier: selectedTier,
  }
}

function buildTierRenders(
  state: MemoryServiceState,
  memoryPack: import('../../context-memory/contracts.js').MemoryPack,
  tokenBudget: number,
): Record<PromptMemoryTier, import('../../context-memory/contracts.js').MemoryPackRenderResult> {
  const tiers: PromptMemoryTier[] = ['full', 'compact', 'sparse', 'minimal', 'drop_low_value']
  return Object.fromEntries(
    tiers.map((tier) => [
      tier,
      state.memoryPackRenderer.render(memoryPack, { tokenBudget, tier }),
    ]),
  ) as Record<PromptMemoryTier, import('../../context-memory/contracts.js').MemoryPackRenderResult>
}

function pickSelectedTier(
  requestedTier: PromptMemoryTier,
  renders: Record<PromptMemoryTier, import('../../context-memory/contracts.js').MemoryPackRenderResult>,
): PromptMemoryTier {
  if (renders[requestedTier].text.trim().length > 0) {
    return requestedTier
  }
  const fallbackOrder: PromptMemoryTier[] = [
    'full',
    'compact',
    'sparse',
    'minimal',
    'drop_low_value',
  ]
  return fallbackOrder.find((tier) => renders[tier].text.trim().length > 0) ?? 'drop_low_value'
}
