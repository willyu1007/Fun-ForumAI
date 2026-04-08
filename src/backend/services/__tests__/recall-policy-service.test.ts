import { describe, expect, it } from 'vitest'
import type { AttentionOpportunity, EffectiveOrchestrationPolicy } from '../../../shared/forum-orchestration.js'
import type { EventPayload, ScoredCandidate } from '../../allocator/types.js'
import { RecallPolicyService } from '../recall-policy-service.js'

function makeEvent(overrides: Partial<EventPayload> = {}): EventPayload {
  return {
    event_id: 'evt-1',
    event_type: 'ThreadTurnAdded',
    idempotency_key: 'idem-1',
    chain_depth: 0,
    community_id: 'comm-1',
    post_id: 'post-1',
    thread_id: 'thread-1',
    author_agent_id: 'agent-author',
    turn_id: 'turn-1',
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function makePolicy(overrides: Partial<EffectiveOrchestrationPolicy> = {}): EffectiveOrchestrationPolicy {
  const communityDefault = {
    schema_version: 'forum-orchestration-policy.v1',
    scope_type: 'COMMUNITY' as const,
    scope_id: 'comm-1',
    source: 'stage_spec' as const,
    profile: 'ambient_roaming' as const,
    recall_control: {
      schema_version: 'forum-orchestration-policy.v1',
      pair_window_minutes: 30,
      pair_max_exchanges: 1,
      post_thread_share_cap: 0.7,
      reactive_recall_decay: 'moderate' as const,
      newcomer_min_share: 0.2,
      late_entry_min_share: 0.1,
      revive_old_branch_budget: 1,
    },
    compare_debug: {
      schema_version: 'forum-orchestration-policy.v1',
      shadow_enabled: false,
      record_metrics: true,
      include_viewer_telemetry: true,
    },
    cutover: {
      schema_version: 'forum-orchestration-policy.v1',
      selection_enabled: true,
      envelope_enabled: true,
      fallback_to_baseline: true,
    },
  }
  return {
    ...communityDefault,
    scope_type: 'POST',
    scope_id: 'post-1',
    community_default: communityDefault,
    post_override: null,
    ...overrides,
  }
}

function makeOpportunity(overrides: Partial<AttentionOpportunity> = {}): AttentionOpportunity {
  return {
    id: 'opp-1',
    source: 'DIRECT_CHALLENGE',
    browse_reason: 'DIRECT_CHALLENGE',
    profile: 'ambient_roaming',
    post_id: 'post-1',
    thread_id: 'thread-1',
    turn_id: 'turn-1',
    selected_anchor_turn_id: 'turn-1',
    target_agent_ids: ['insider-1', 'insider-2'],
    priority_agent_ids: ['insider-1'],
    suppressed_agent_ids: [],
    reason_codes: ['direct_challenge'],
    evidence_turn_ids: ['turn-1'],
    post_attention_state: {
      dominant_thread_share: 0.5,
      branch_entropy: 0.4,
      duel_risk: 0.2,
      newcomer_share_recent: 0.2,
      late_entry_share_recent: 0.1,
    },
    thread_attention_state: {
      contention_score: 0.8,
      unresolved_score: 0.6,
      audience_pull_score: 0.3,
      saturation_score: 0.4,
      pair_loop_risk: 0.1,
      recall_budget_remaining: 2,
    },
    ...overrides,
  }
}

const candidates: ScoredCandidate[] = [
  { agent_id: 'insider-1', score: 5, reasons: ['match'] },
  { agent_id: 'outsider-1', score: 4, reasons: ['match'] },
]

describe('RecallPolicyService', () => {
  it('grants the first direct challenge and suppresses the second within the pair window', () => {
    const service = new RecallPolicyService()
    const event = makeEvent()
    const opportunity = makeOpportunity()
    const policy = makePolicy()

    const first = service.evaluate({
      event,
      opportunity,
      candidates: [candidates[0]],
      policy,
    })
    expect(first.granted.map((candidate) => candidate.agent_id)).toEqual(['insider-1'])

    const second = service.evaluate({
      event,
      opportunity,
      candidates: [candidates[0]],
      policy,
    })
    expect(second.granted).toEqual([])
    expect(second.decisions[0]?.suppression_reason).toBe('pair_window_cap')
  })

  it('prefers outsiders when the dominant thread share is above the cap', () => {
    const service = new RecallPolicyService()
    const evaluation = service.evaluate({
      event: makeEvent(),
      opportunity: makeOpportunity({
        source: 'AUDIENCE_SPIKE',
        browse_reason: 'AUDIENCE_HEAT',
        post_attention_state: {
          dominant_thread_share: 0.9,
          branch_entropy: 0.2,
          duel_risk: 0.8,
          newcomer_share_recent: 0.05,
          late_entry_share_recent: 0.05,
        },
      }),
      candidates,
      policy: makePolicy(),
    })

    expect(evaluation.granted.map((candidate) => candidate.agent_id)).toEqual(['outsider-1'])
    expect(evaluation.decisions.find((decision) => decision.agent_id === 'insider-1')?.suppression_reason)
      .toBe('dominant_thread_cap')
  })

  it('caps revive_old_branch opportunities with a per-thread budget', () => {
    const service = new RecallPolicyService()
    const event = makeEvent({ chain_depth: 2 })
    const opportunity = makeOpportunity({
      source: 'REVIVE_OLD_BRANCH',
      browse_reason: 'REVIVE',
    })
    const policy = makePolicy()

    const first = service.evaluate({
      event,
      opportunity,
      candidates: [candidates[0]],
      policy,
    })
    expect(first.granted).toHaveLength(1)

    const second = service.evaluate({
      event,
      opportunity,
      candidates: [candidates[1]],
      policy,
    })
    expect(second.granted).toEqual([])
    expect(second.decisions[0]?.suppression_reason).toBe('revive_budget_exhausted')
  })
})
