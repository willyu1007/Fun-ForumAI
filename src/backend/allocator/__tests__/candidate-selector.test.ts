import { describe, it, expect, vi } from 'vitest'
import { DefaultCandidateSelector } from '../candidate-selector.js'
import { DEFAULT_ALLOCATOR_CONFIG } from '../config.js'
import { SnapshotGraphRelevanceProvider } from '../graph-relevance-provider.js'
import { DefaultCastingDirectorPolicy } from '../casting-director-policy.js'
import type { AgentCandidate, DegradationState, EventPayload } from '../types.js'

const NORMAL: DegradationState = { level: 'normal', queue_lag_seconds: 0, factor: 1.0 }
const CRITICAL: DegradationState = { level: 'critical', queue_lag_seconds: 400, factor: 0.1 }

function makeEvent(overrides: Partial<EventPayload> = {}): EventPayload {
  return {
    event_id: 'evt-1',
    event_type: 'NewPostCreated',
    idempotency_key: 'idem-1',
    chain_depth: 0,
    community_id: 'comm-1',
    author_agent_id: 'agent-author',
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeAgent(id: string, overrides: Partial<AgentCandidate> = {}): AgentCandidate {
  return {
    agent_id: id,
    status: 'active',
    tags: [],
    community_ids: ['comm-1'],
    actions_last_hour: 0,
    tokens_last_day: 0,
    last_action_at: null,
    recent_thread_post_ids: [],
    ...overrides,
  }
}

describe('DefaultCandidateSelector', () => {
  const selector = new DefaultCandidateSelector(DEFAULT_ALLOCATOR_CONFIG)

  it('returns empty when quota is 0', async () => {
    const result = await selector.select(makeEvent(), [makeAgent('a1')], 0, NORMAL)
    expect(result).toHaveLength(0)
  })

  it('excludes inactive agents', async () => {
    const agents = [makeAgent('a1', { status: 'banned' }), makeAgent('a2', { status: 'quarantined' })]
    const result = await selector.select(makeEvent(), agents, 5, NORMAL)
    expect(result).toHaveLength(0)
  })

  it('excludes the event author (self-response prevention)', async () => {
    const agents = [makeAgent('agent-author')]
    const result = await selector.select(makeEvent(), agents, 5, NORMAL)
    expect(result).toHaveLength(0)
  })

  it('excludes agents exceeding actions_per_hour budget', async () => {
    const agents = [makeAgent('a1', { actions_last_hour: 999 })]
    const result = await selector.select(makeEvent(), agents, 5, NORMAL)
    expect(result).toHaveLength(0)
  })

  it('excludes agents exceeding tokens_per_day budget', async () => {
    const agents = [makeAgent('a1', { tokens_last_day: 200_000 })]
    const result = await selector.select(makeEvent(), agents, 5, NORMAL)
    expect(result).toHaveLength(0)
  })

  it('excludes agents within cooldown', async () => {
    const recentAction = new Date(Date.now() - 10_000).toISOString() // 10s ago
    const agents = [makeAgent('a1', { last_action_at: recentAction })]
    const result = await selector.select(makeEvent(), agents, 5, NORMAL)
    expect(result).toHaveLength(0)
  })

  it('includes agents past cooldown', async () => {
    const oldAction = new Date(Date.now() - 120_000).toISOString() // 2min ago
    const agents = [makeAgent('a1', { last_action_at: oldAction })]
    const result = await selector.select(makeEvent(), agents, 5, NORMAL)
    expect(result).toHaveLength(1)
  })

  it('community membership boosts score (+3)', async () => {
    const member = makeAgent('a1', { community_ids: ['comm-1'] })
    const nonMember = makeAgent('a2', { community_ids: ['comm-other'] })
    const result = await selector.select(makeEvent(), [member, nonMember], 5, NORMAL)
    const memberScore = result.find((r) => r.agent_id === 'a1')!.score
    const nonMemberScore = result.find((r) => r.agent_id === 'a2')!.score
    expect(memberScore).toBeGreaterThan(nonMemberScore)
  })

  it('thread repeat participation penalizes score (-1)', async () => {
    const event = makeEvent({ post_id: 'post-1' })
    const repeat = makeAgent('a1', { recent_thread_post_ids: ['post-1'], community_ids: ['comm-1'] })
    const fresh = makeAgent('a2', { recent_thread_post_ids: [], community_ids: ['comm-1'] })
    const result = await selector.select(event, [repeat, fresh], 5, NORMAL)
    const repeatScore = result.find((r) => r.agent_id === 'a1')!.score
    const freshScore = result.find((r) => r.agent_id === 'a2')!.score
    expect(freshScore).toBeGreaterThanOrEqual(repeatScore)
  })

  it('respects quota limit (takes top-K)', async () => {
    const agents = Array.from({ length: 10 }, (_, i) => makeAgent(`a${i}`))
    const result = await selector.select(makeEvent(), agents, 3, NORMAL)
    expect(result).toHaveLength(3)
  })

  it('no exploration noise in critical degradation', async () => {
    const agents = [makeAgent('a1', { community_ids: [] })]
    const results = await Promise.all(Array.from({ length: 20 }, () =>
      selector.select(makeEvent(), agents, 1, CRITICAL),
    ))
    const scores = results.map((r) => r[0].score)
    const allSame = scores.every((s) => s === scores[0])
    expect(allSame).toBe(true)
  })

  it('hard-excludes blocked relation hint', async () => {
    const agents = [
      makeAgent('a1', { relation_hint_to_author: 'blocked' }),
      makeAgent('a2', { relation_hint_to_author: 'none' }),
    ]
    const result = await selector.select(makeEvent(), agents, 5, CRITICAL)
    expect(result.map((row) => row.agent_id)).toEqual(['a2'])
  })

  it('relation bonus ranks friend over following over follower', async () => {
    const agents = [
      makeAgent('friend', { relation_hint_to_author: 'friend', community_ids: [] }),
      makeAgent('following', { relation_hint_to_author: 'following', community_ids: [] }),
      makeAgent('follower', { relation_hint_to_author: 'follower', community_ids: [] }),
    ]
    const result = await selector.select(makeEvent(), agents, 5, CRITICAL)
    expect(result[0].agent_id).toBe('friend')
    expect(result[1].agent_id).toBe('following')
    expect(result[2].agent_id).toBe('follower')
  })

  it('consumes typed tags + controversy_score to influence scoring', async () => {
    const event = makeEvent({
      tags: ['ai'],
      controversy_score: 1,
    })
    const highAppetite = makeAgent('high', {
      tags: ['ai'],
      community_ids: [],
      stats_hint: {
        participation_multiplier: 1,
        exploration_noise_scale: 0.5,
        controversy_appetite: 1,
        p_wander: 0,
      },
    })
    const lowAppetite = makeAgent('low', {
      tags: ['ai'],
      community_ids: [],
      stats_hint: {
        participation_multiplier: 1,
        exploration_noise_scale: 0.5,
        controversy_appetite: 0,
        p_wander: 0,
      },
    })

    const result = await selector.select(event, [lowAppetite, highAppetite], 5, CRITICAL)
    expect(result[0].agent_id).toBe('high')
    expect(result[1].agent_id).toBe('low')
  })

  it('annotates forum-thread selections with a legacy baseline attention hint when orchestration services are absent', async () => {
    const result = await selector.select(
      makeEvent({
        event_type: 'ThreadTurnAdded',
        post_id: 'post-1',
        thread_id: 'thread-1',
        turn_id: 'turn-1',
      }),
      [makeAgent('a1', { community_ids: ['comm-1'] })],
      1,
      CRITICAL,
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      forum_attention_hint: {
        opportunity_id: null,
        target_thread_id: null,
        selection_path: 'legacy_baseline',
        fallback_reason: null,
      },
    })
  })

  it('adds PPR bonus from snapshot when enabled', async () => {
    const computedAt = new Date()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const provider = new SnapshotGraphRelevanceProvider()
    provider.hydrate([
      {
        source_agent_id: 'agent-author',
        candidate_agent_id: 'a2',
        community_id: 'comm-1',
        topic_key: '__all__',
        ppr_score: 1,
        rank: 1,
        computed_at: computedAt,
        expires_at: expiresAt,
      },
      {
        source_agent_id: 'agent-author',
        candidate_agent_id: 'a1',
        community_id: 'comm-1',
        topic_key: '__all__',
        ppr_score: 0.1,
        rank: 2,
        computed_at: computedAt,
        expires_at: expiresAt,
      },
    ])

    const selectorWithPpr = new DefaultCandidateSelector(DEFAULT_ALLOCATOR_CONFIG, {
      pprEnabled: true,
      graphRelevanceProvider: provider,
    })

    const agents = [makeAgent('a1', { community_ids: ['comm-1'] }), makeAgent('a2', { community_ids: ['comm-1'] })]
    const result = await selectorWithPpr.select(makeEvent(), agents, 5, CRITICAL)

    expect(result[0].agent_id).toBe('a2')
    expect(result[0].reasons.some((reason) => reason.startsWith('ppr_bonus='))).toBe(true)
  })

  it('bypasses director policy when quota <= 2', async () => {
    const directorSpy = {
      select: vi.fn(() => []),
    }

    const selectorWithDirector = new DefaultCandidateSelector(DEFAULT_ALLOCATOR_CONFIG, {
      directorEnabled: true,
      castingDirectorPolicy: directorSpy,
    })

    await selectorWithDirector.select(makeEvent(), [makeAgent('a1'), makeAgent('a2')], 2, CRITICAL)
    expect(directorSpy.select).not.toHaveBeenCalled()
  })

  it('applies director role allocation when enabled and quota > 2', async () => {
    const selectorWithDirector = new DefaultCandidateSelector(DEFAULT_ALLOCATOR_CONFIG, {
      directorEnabled: true,
      castingDirectorPolicy: new DefaultCastingDirectorPolicy(),
      resolveCommunityDirectorConfig: () => ({
        ratio: { core: 2, contrast: 1, wildcard: 1 },
        wildcard_cap: 1,
      }),
    })

    const event = makeEvent({ tags: ['x'] })
    const agents = [
      makeAgent('a1', { tags: ['x'], community_ids: ['comm-1'] }),
      makeAgent('a2', { tags: ['x'], community_ids: ['comm-1'] }),
      makeAgent('a3', { tags: ['x'], community_ids: ['comm-1'] }),
      makeAgent('a6', { tags: ['x'], community_ids: ['comm-1'] }),
      makeAgent('a4', { tags: [], community_ids: ['comm-1'] }),
      makeAgent('a5', { tags: [], community_ids: ['comm-1'] }),
    ]

    const result = await selectorWithDirector.select(event, agents, 4, CRITICAL)
    const roleReasons = result.flatMap((item) => item.reasons).filter((reason) => reason.startsWith('director_role='))

    expect(result).toHaveLength(4)
    expect(roleReasons).toContain('director_role=core')
    expect(roleReasons).toContain('director_role=contrast')
    expect(roleReasons).toContain('director_role=wildcard')
  })

  it('applies director v2 thread cooldown guard to avoid immediate repeat speakers', async () => {
    const selectorWithDirector = new DefaultCandidateSelector(DEFAULT_ALLOCATOR_CONFIG, {
      directorEnabled: true,
      directorV2Enabled: true,
      castingDirectorPolicy: new DefaultCastingDirectorPolicy(),
      resolveCommunityDirectorConfig: () => ({
        ratio: { core: 2, contrast: 1, wildcard: 1 },
        wildcard_cap: 1,
      }),
    })

    const event = makeEvent({ tags: ['x'], post_id: 'post-guarded' })
    const firstWave = [
      makeAgent('a1', { tags: ['x'], community_ids: ['comm-1'] }),
      makeAgent('a2', { tags: ['x'], community_ids: ['comm-1'] }),
      makeAgent('a3', { tags: ['x'], community_ids: ['comm-1'] }),
      makeAgent('a4', { tags: ['x'], community_ids: ['comm-1'] }),
    ]
    const secondWave = [
      ...firstWave,
      makeAgent('a5', { tags: ['x'], community_ids: ['comm-1'] }),
      makeAgent('a6', { tags: ['x'], community_ids: ['comm-1'] }),
    ]

    const firstResult = await selectorWithDirector.select(event, firstWave, 3, CRITICAL)
    expect(firstResult).toHaveLength(3)

    const secondResult = await selectorWithDirector.select(event, secondWave, 3, CRITICAL)
    const secondIds = new Set(secondResult.map((item) => item.agent_id))

    expect(secondIds.has(firstResult[0].agent_id)).toBe(false)
    expect(secondIds.has(firstResult[1].agent_id)).toBe(false)
  })
})
