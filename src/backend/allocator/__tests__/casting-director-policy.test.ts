import { describe, expect, it } from 'vitest'
import {
  DefaultCastingDirectorPolicy,
  resolveDirectorCommunityConfig,
} from '../casting-director-policy.js'
import type { ScoredCandidate } from '../types.js'

function makeScored(agentId: string, score: number, reasons: string[] = []): ScoredCandidate {
  return { agent_id: agentId, score, reasons }
}

describe('resolveDirectorCommunityConfig', () => {
  it('uses pilot defaults when rules are missing', () => {
    const config = resolveDirectorCommunityConfig({
      communitySlug: 'plot-twist-club',
      rulesJson: null,
    })

    expect(config.ratio.wildcard).toBeGreaterThan(1)
  })

  it('allows rules_json override', () => {
    const config = resolveDirectorCommunityConfig({
      communitySlug: 'hot-arena',
      rulesJson: {
        personality: {
          director_v1: {
            ratio: {
              core: 4,
              contrast: 1,
              wildcard: 1,
            },
            wildcard_cap: 0,
          },
        },
      },
    })

    expect(config.ratio.core).toBe(4)
    expect(config.wildcard_cap).toBe(0)
  })
})

describe('DefaultCastingDirectorPolicy', () => {
  it('allocates role budgets and tags selected roles', () => {
    const policy = new DefaultCastingDirectorPolicy()
    const scored: ScoredCandidate[] = [
      makeScored('a1', 9, ['tag_overlap=1']),
      makeScored('a2', 8, ['tag_overlap=1']),
      makeScored('a3', 7, ['tag_overlap=1']),
      makeScored('a4', 6, []),
      makeScored('a5', 5, []),
      makeScored('a6', 4, ['tag_overlap=1']),
    ]

    const selected = policy.select({
      event: {
        event_id: 'evt-1',
        event_type: 'NewPostCreated',
        idempotency_key: 'idem-1',
        chain_depth: 0,
        community_id: 'c1',
        author_agent_id: 'author',
        tags: ['ai'],
        created_at: new Date().toISOString(),
      },
      scored,
      quota: 4,
      community_config: {
        ratio: { core: 2, contrast: 1, wildcard: 1 },
        wildcard_cap: 1,
      },
    })

    expect(selected).toHaveLength(4)
    const roles = selected
      .flatMap((candidate) => candidate.reasons)
      .filter((reason) => reason.startsWith('director_role='))
    expect(roles).toContain('director_role=core')
    expect(roles).toContain('director_role=contrast')
    expect(roles).toContain('director_role=wildcard')
  })

  it('returns empty for zero quota', () => {
    const policy = new DefaultCastingDirectorPolicy()
    const selected = policy.select({
      event: {
        event_id: 'evt-1',
        event_type: 'NewPostCreated',
        idempotency_key: 'idem-1',
        chain_depth: 0,
        community_id: 'c1',
        author_agent_id: 'author',
        created_at: new Date().toISOString(),
      },
      scored: [makeScored('a1', 1)],
      quota: 0,
    })

    expect(selected).toEqual([])
  })
})
