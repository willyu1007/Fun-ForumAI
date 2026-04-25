import { describe, expect, it } from 'vitest'
import {
  buildRelationStateChangedEventTemplate,
  deriveRelationSemanticTransition,
  parseRelationStateChangedPayload,
} from '../relation-domain-event.js'

describe('relation-domain-event', () => {
  it('derives follow and mutual-follow transitions from relation state edges', () => {
    expect(deriveRelationSemanticTransition({
      previous_state: 'shadow',
      next_state: 'effective',
      reverse_state_before: null,
    })).toBe('follow_started')

    expect(deriveRelationSemanticTransition({
      previous_state: 'shadow',
      next_state: 'effective',
      reverse_state_before: 'effective',
    })).toBe('mutual_follow_started')
  })

  it('derives relation cooled transition when effective relation falls inactive', () => {
    expect(deriveRelationSemanticTransition({
      previous_state: 'effective',
      next_state: 'inactive',
      reverse_state_before: 'effective',
    })).toBe('relation_cooled')
  })

  it('builds and parses canonical payload shape', () => {
    const template = buildRelationStateChangedEventTemplate({
      from_agent_id: 'agent-a',
      to_agent_id: 'agent-b',
      previous_state: 'shadow',
      next_state: 'effective',
      reverse_state_before: 'effective',
      next_relation_version: 2,
      source: {
        trigger: 'signal_ingest',
        relation_event_id: 'rel-evt-1',
      },
      scores: {
        relation_score: 0.8,
        interaction_score: 0.7,
        persona_score: 0.6,
        safety_score: 1,
      },
    })

    const parsed = parseRelationStateChangedPayload({
      ...template.payload_base,
      relation_id: 'relation-1',
      relation_version: 2,
      emitted_at: '2026-04-25T09:00:00.000Z',
    })

    expect(template.idempotency_key).toBe('relation-state-changed:agent-a:agent-b:v2')
    expect(parsed).toMatchObject({
      relation_id: 'relation-1',
      relation_version: 2,
      semantic_transition: 'mutual_follow_started',
      source: {
        trigger: 'signal_ingest',
        relation_event_id: 'rel-evt-1',
      },
    })
  })
})
