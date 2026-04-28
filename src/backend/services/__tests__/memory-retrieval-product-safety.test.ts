import { describe, expect, it } from 'vitest'
import { InMemoryChronicleRepository } from '../../repos/chronicle-repository.js'
import {
  InMemoryActiveTensionItemRepository,
  InMemoryContextRelationStateRepository,
  InMemoryEpisodicCardRepository,
  InMemoryPrivateShadowMemoryRepository,
  InMemoryRawContextEventRepository,
  InMemorySelfModelStateRepository,
} from '../../repos/context-memory-repository.js'
import type { ChronicleRepository } from '../../repos/chronicle-repository.js'
import type { CreateChronicleEntryInput } from '../../repos/types.js'
import {
  loadTypedRetrievalState,
  type RetrievalRuntimeDeps,
} from '../memory-service/retrieval.js'

function createRuntime(chronicleRepo: ChronicleRepository): RetrievalRuntimeDeps {
  return {
    rawEventRepo: new InMemoryRawContextEventRepository(),
    episodicCardRepo: new InMemoryEpisodicCardRepository(),
    relationStateRepo: new InMemoryContextRelationStateRepository(),
    selfModelStateRepo: new InMemorySelfModelStateRepository(),
    activeTensionRepo: new InMemoryActiveTensionItemRepository(),
    privateShadowRepo: new InMemoryPrivateShadowMemoryRepository(),
    chronicleRepo,
  }
}

function chronicle(input: Partial<CreateChronicleEntryInput> = {}): CreateChronicleEntryInput {
  return {
    agent_id: 'agent-1',
    visibility: 'PUBLIC',
    type: 'HIGHLIGHT',
    occurred_at: new Date('2026-04-28T08:00:00.000Z'),
    title: '真实公开经历',
    summary: '这条经历来自真实产品事件。',
    importance_score: 0.8,
    evidence: [{ kind: 'post', ref_id: 'post-1' }],
    entry_source: 'runtime_achievement',
    dedup_key: `runtime:agent-1:${input.title ?? 'safe'}`,
    ...input,
  }
}

describe('memory retrieval chronicle product safety', () => {
  it('uses older real public chronicle when newer seed and signal entries are present', async () => {
    const chronicleRepo = new InMemoryChronicleRepository()
    await chronicleRepo.create(chronicle({
      title: '真实公开经历',
      occurred_at: new Date('2026-04-26T08:00:00.000Z'),
    }))
    await chronicleRepo.create(chronicle({
      title: 'Seed showcase',
      summary: '这条来自 dev seed，不应该作为正式产品经历。',
      occurred_at: new Date('2026-04-28T08:00:00.000Z'),
      entry_source: 'dev_seed_canonical_moments',
      dedup_key: 'canonical-moments:agent-1:1',
    }))
    await chronicleRepo.create(chronicle({
      title: 'Signal · batch_daily',
      summary: 'Signal captured for batch_daily.',
      occurred_at: new Date('2026-04-27T08:00:00.000Z'),
      tags: ['signal:batch_daily'],
      entry_source: 'system_batch_signal',
      dedup_key: 'batch-daily:2026-04-27',
    }))

    const state = await loadTypedRetrievalState({
      runtime: createRuntime(chronicleRepo),
      agentId: 'agent-1',
      topK: 3,
      scene: 'forum',
    })

    expect(state.chronicleEntries.map((entry) => entry.title)).toEqual(['真实公开经历'])
  })

  it('allows real owner-only chronicle in private chat but still excludes seed material', async () => {
    const chronicleRepo = new InMemoryChronicleRepository()
    await chronicleRepo.create(chronicle({
      title: '真实私有经历',
      visibility: 'OWNER_ONLY',
      occurred_at: new Date('2026-04-26T08:00:00.000Z'),
    }))
    await chronicleRepo.create(chronicle({
      title: 'Seed showcase',
      summary: '这条来自 dev seed，不应该作为正式产品经历。',
      occurred_at: new Date('2026-04-28T08:00:00.000Z'),
      entry_source: 'dev_seed_canonical_moments',
      dedup_key: 'canonical-moments:agent-1:private',
    }))

    const state = await loadTypedRetrievalState({
      runtime: createRuntime(chronicleRepo),
      agentId: 'agent-1',
      topK: 3,
      scene: 'private_chat',
    })

    expect(state.chronicleEntries.map((entry) => entry.title)).toEqual(['真实私有经历'])
  })
})
