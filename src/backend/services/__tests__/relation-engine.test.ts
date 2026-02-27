import { describe, expect, it } from 'vitest'
import { RelationEngine } from '../relation-engine.js'

const engine = new RelationEngine()

describe('RelationEngine', () => {
  it('creates shadow when admission gates pass', () => {
    const now = new Date('2026-02-27T00:00:00.000Z')
    const result = engine.evaluate({
      existing: null,
      stats: {
        co_presence_count: 5,
        reciprocal_reply_count: 3,
        interaction_count_7d: 12,
        warning_count_24h: 0,
        warning_count_7d: 0,
        severe_count_7d: 0,
        last_interaction_at: now,
      },
      persona_score: 0.8,
      safety_score: 1,
      capacity_allowed: true,
      now,
    })

    expect(result.should_persist).toBe(true)
    expect(result.next_state).toBe('shadow')
    expect(result.shadow_started_at?.toISOString()).toBe(now.toISOString())
  })

  it('moves shadow to effective after 7 days when still eligible', () => {
    const shadowStart = new Date('2026-02-20T00:00:00.000Z')
    const now = new Date('2026-02-27T00:00:00.000Z')

    const result = engine.evaluate({
      existing: {
        id: 'r1',
        from_agent_id: 'a1',
        to_agent_id: 'a2',
        state: 'shadow',
        relation_score: 0.7,
        interaction_score: 0.7,
        persona_score: 0.7,
        safety_score: 1,
        shadow_started_at: shadowStart,
        effective_at: null,
        inactive_at: null,
        blocked_at: null,
        below_threshold_since: null,
        last_signal_at: now,
        last_interaction_at: now,
        last_evaluated_at: now,
        last_state_changed_at: new Date('2026-02-20T00:00:00.000Z'),
        version: 1,
        created_at: shadowStart,
        updated_at: shadowStart,
      },
      stats: {
        co_presence_count: 6,
        reciprocal_reply_count: 4,
        interaction_count_7d: 15,
        warning_count_24h: 0,
        warning_count_7d: 0,
        severe_count_7d: 0,
        last_interaction_at: now,
      },
      persona_score: 0.8,
      safety_score: 1,
      capacity_allowed: true,
      now,
    })

    expect(result.next_state).toBe('effective')
    expect(result.effective_at?.toISOString()).toBe(now.toISOString())
  })

  it('moves effective to inactive after sustained low score', () => {
    const now = new Date('2026-02-27T00:00:00.000Z')
    const below = new Date('2026-02-23T00:00:00.000Z')
    const lastStateChange = new Date('2026-02-20T00:00:00.000Z')

    const result = engine.evaluate({
      existing: {
        id: 'r2',
        from_agent_id: 'a1',
        to_agent_id: 'a2',
        state: 'effective',
        relation_score: 0.6,
        interaction_score: 0.6,
        persona_score: 0.6,
        safety_score: 1,
        shadow_started_at: new Date('2026-02-01T00:00:00.000Z'),
        effective_at: new Date('2026-02-10T00:00:00.000Z'),
        inactive_at: null,
        blocked_at: null,
        below_threshold_since: below,
        last_signal_at: now,
        last_interaction_at: now,
        last_evaluated_at: now,
        last_state_changed_at: lastStateChange,
        version: 1,
        created_at: new Date('2026-02-01T00:00:00.000Z'),
        updated_at: new Date('2026-02-10T00:00:00.000Z'),
      },
      stats: {
        co_presence_count: 0,
        reciprocal_reply_count: 0,
        interaction_count_7d: 0,
        warning_count_24h: 0,
        warning_count_7d: 0,
        severe_count_7d: 0,
        last_interaction_at: new Date('2026-02-26T00:00:00.000Z'),
      },
      persona_score: 0.2,
      safety_score: 0.6,
      capacity_allowed: true,
      now,
    })

    expect(result.next_state).toBe('inactive')
    expect(result.inactive_at?.toISOString()).toBe(now.toISOString())
  })

  it('applies immediate block on severe/warning threshold', () => {
    const now = new Date('2026-02-27T00:00:00.000Z')
    const result = engine.evaluate({
      existing: null,
      stats: {
        co_presence_count: 0,
        reciprocal_reply_count: 0,
        interaction_count_7d: 0,
        warning_count_24h: 3,
        warning_count_7d: 3,
        severe_count_7d: 0,
        last_interaction_at: null,
      },
      persona_score: 0.5,
      safety_score: 1,
      capacity_allowed: true,
      now,
    })

    expect(result.should_persist).toBe(true)
    expect(result.next_state).toBe('blocked')
    expect(result.blocked_at?.toISOString()).toBe(now.toISOString())
  })
})
