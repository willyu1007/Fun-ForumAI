import { describe, expect, it } from 'vitest'
import { InMemoryChronicleRepository } from '../../repos/chronicle-repository.js'
import {
  countProductSafePublicChronicleEntries,
  isProductSafePublicChronicleEntry,
} from '../chronicle-product-safety.js'
import type { ChronicleEntry } from '../../repos/types.js'

function chronicle(overrides: Partial<ChronicleEntry> = {}): ChronicleEntry {
  const now = new Date('2026-04-28T08:00:00.000Z')
  return {
    id: overrides.id ?? 'chronicle-1',
    agent_id: overrides.agent_id ?? 'agent-1',
    visibility: overrides.visibility ?? 'PUBLIC',
    type: overrides.type ?? 'HIGHLIGHT',
    occurred_at: overrides.occurred_at ?? now,
    title: overrides.title ?? '真实公开经历',
    summary: overrides.summary ?? '这是一条真实公开经历。',
    importance_score: overrides.importance_score ?? 0.8,
    evidence: overrides.evidence ?? [{ kind: 'post', ref_id: 'post-1' }],
    actors: overrides.actors ?? ['agent-1'],
    location: overrides.location ?? null,
    tags: overrides.tags ?? [],
    scope: overrides.scope ?? 'global',
    scope_key: overrides.scope_key ?? '__global__',
    signal_context: overrides.signal_context ?? null,
    story_context: overrides.story_context ?? null,
    entry_source: overrides.entry_source ?? 'runtime_achievement',
    source_event_ids: overrides.source_event_ids ?? [],
    dedup_key: overrides.dedup_key ?? 'achievement:agent-1:forum_post_crafter:1:global:__global__',
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
  }
}

describe('chronicle product safety', () => {
  it('rejects dev seed, batch, signal-only, and owner-only entries for public product use', () => {
    expect(isProductSafePublicChronicleEntry(chronicle())).toBe(true)
    expect(isProductSafePublicChronicleEntry(chronicle({
      entry_source: 'dev_seed_canonical_moments',
      dedup_key: 'canonical-moments:agent:1',
    }))).toBe(false)
    expect(isProductSafePublicChronicleEntry(chronicle({
      entry_source: 'system_batch_signal',
      dedup_key: 'batch-daily:2026-04-28',
    }))).toBe(false)
    expect(isProductSafePublicChronicleEntry(chronicle({
      tags: ['signal:forum_post'],
    }))).toBe(false)
    expect(isProductSafePublicChronicleEntry(chronicle({
      visibility: 'OWNER_ONLY',
    }))).toBe(false)
  })

  it('counts only product-safe public chronicle from repositories', async () => {
    const repo = new InMemoryChronicleRepository()
    await repo.create(chronicle({ id: 'safe-1' }))
    await repo.create(chronicle({
      id: 'seed-1',
      entry_source: 'dev_seed_canonical_moments',
      dedup_key: 'canonical-moments:agent:1',
    }))
    await repo.create(chronicle({
      id: 'batch-1',
      tags: ['signal:batch_daily'],
      entry_source: 'system_batch_signal',
      dedup_key: 'batch-daily:2026-04-28',
    }))

    await expect(countProductSafePublicChronicleEntries(repo, 'agent-1')).resolves.toBe(1)
  })
})
