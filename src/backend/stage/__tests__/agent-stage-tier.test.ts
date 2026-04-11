import { describe, it, expect } from 'vitest'
import { computeAgentStageTier } from '../agent-stage-tier.js'
import type { AgentAchievement, ChronicleEntry } from '../../repos/types.js'

function makeAchievement(input: Partial<AgentAchievement>): AgentAchievement {
  const now = new Date('2026-03-01T00:00:00.000Z')
  return {
    id: input.id ?? 'ach',
    agent_id: input.agent_id ?? 'a1',
    code: input.code ?? 'code',
    name: input.name ?? 'name',
    category: input.category ?? 'forum',
    tier: input.tier ?? 1,
    scope: input.scope ?? 'global',
    scope_key: input.scope_key ?? '__global__',
    rarity: input.rarity ?? 0.5,
    visibility: input.visibility ?? 'PUBLIC',
    achieved_at: input.achieved_at ?? now,
    evidence: input.evidence ?? [],
    signal_context: input.signal_context ?? null,
    award_context: input.award_context ?? null,
    created_at: input.created_at ?? now,
    updated_at: input.updated_at ?? now,
  }
}

function makeChronicle(input: Partial<ChronicleEntry>): ChronicleEntry {
  const now = new Date('2026-03-01T00:00:00.000Z')
  return {
    id: input.id ?? 'chron',
    agent_id: input.agent_id ?? 'a1',
    visibility: input.visibility ?? 'PUBLIC',
    type: input.type ?? 'HIGHLIGHT',
    occurred_at: input.occurred_at ?? now,
    title: input.title ?? 'title',
    summary: input.summary ?? 'summary',
    importance_score: input.importance_score ?? 0.7,
    evidence: input.evidence ?? [],
    actors: input.actors ?? [],
    location: input.location ?? null,
    tags: input.tags ?? [],
    scope: input.scope ?? 'global',
    scope_key: input.scope_key ?? '__global__',
    signal_context: input.signal_context ?? null,
    story_context: input.story_context ?? null,
    entry_source: input.entry_source ?? null,
    source_event_ids: input.source_event_ids ?? [],
    dedup_key: input.dedup_key ?? null,
    created_at: input.created_at ?? now,
    updated_at: input.updated_at ?? now,
  }
}

describe('computeAgentStageTier', () => {
  it('produces stable T3+ score from achievements + chronicle', () => {
    const result = computeAgentStageTier({
      achievements: [
        makeAchievement({ id: 'a1', tier: 3, scope: 'community', scope_key: 'c1', rarity: 0.9 }),
        makeAchievement({ id: 'a2', tier: 2, scope: 'peer', scope_key: 'p1', rarity: 0.6 }),
      ],
      chronicleLast30d: [
        makeChronicle({ id: 'c1', importance_score: 0.8 }),
        makeChronicle({ id: 'c2', importance_score: 0.9 }),
      ],
    })

    expect(result.score).toBeGreaterThanOrEqual(55)
    expect(result.tier === 'T3' || result.tier === 'T4' || result.tier === 'T5').toBe(true)
  })

  it('downgrades T5 to T4 when cross-domain condition is not met', () => {
    const result = computeAgentStageTier({
      achievements: [
        makeAchievement({ id: 'x1', tier: 3, scope: 'community', scope_key: 'c1', rarity: 1 }),
        makeAchievement({ id: 'x2', tier: 3, scope: 'community', scope_key: 'c1', rarity: 1 }),
        makeAchievement({ id: 'x3', tier: 3, scope: 'community', scope_key: 'c1', rarity: 1 }),
        makeAchievement({ id: 'x4', tier: 3, scope: 'community', scope_key: 'c1', rarity: 1 }),
      ],
      chronicleLast30d: Array.from({ length: 30 }, (_, idx) => makeChronicle({ id: `hc-${idx}`, importance_score: 0.9 })),
    })

    expect(result.score).toBeGreaterThanOrEqual(150)
    expect(result.tier).toBe('T4')
    expect(result.reasoning.t5_cross_domain_ok).toBe(false)
  })

  it('applies trust penalty for moderation reject/quarantine', () => {
    const result = computeAgentStageTier({
      achievements: [
        makeAchievement({ id: 'b1', tier: 2, scope: 'global', rarity: 0.5 }),
      ],
      chronicleLast30d: [
        makeChronicle({ id: 'm1', type: 'MODERATION', tags: ['reject'], summary: 'reject' }),
        makeChronicle({ id: 'm2', type: 'MODERATION', tags: ['quarantine'], summary: 'quarantine' }),
      ],
    })

    expect(result.trust_penalty).toBeGreaterThan(0)
    expect(result.reasoning.moderation_rejects_30d).toBeGreaterThanOrEqual(1)
  })
})
