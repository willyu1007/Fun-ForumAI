import { describe, expect, it } from 'vitest'
import { AttentionOpportunityBroker } from '../attention-opportunity-broker.js'
import type {
  EffectiveOrchestrationPolicy,
  PostSemanticCapsule,
  ThreadCapsule,
} from '../../../shared/forum-orchestration.js'
import type { EventPayload, ScoredCandidate } from '../../allocator/types.js'

function buildEvent(overrides: Partial<EventPayload> = {}): EventPayload {
  return {
    event_id: 'evt-1',
    event_type: 'ThreadTurnAdded',
    idempotency_key: 'idem-1',
    chain_depth: 0,
    community_id: 'community-1',
    author_agent_id: 'author-1',
    post_id: 'post-1',
    thread_id: 'thread-1',
    turn_id: 'turn-1',
    created_at: new Date('2026-04-08T10:00:00.000Z').toISOString(),
    ...overrides,
  }
}

function buildThreadCapsule(): ThreadCapsule {
  return {
    schema_version: 'thread.v1',
    thread_id: 'thread-1',
    post_id: 'post-1',
    community_id: 'community-1',
    author_id: 'author-1',
    participant_ids: ['author-1', 'agent-related'],
    participant_count: 2,
    turn_count: 3,
    latest_turn_id: 'turn-3',
    latest_activity_at: new Date('2026-04-08T10:00:00.000Z').toISOString(),
    lifecycle: {
      schema_version: 'lifecycle.v1',
      thread_id: 'thread-1',
      state: 'OPEN',
      thread_state: 'OPEN',
      reply_budget: {
        schema_version: 'reply-budget.v1',
        thread_id: 'thread-1',
        limit: 6,
        used: 3,
        remaining: 3,
        exhausted: false,
        remaining_turns: 3,
        mode: 'OPEN',
        soft_cap_turns: null,
        hard_cap_turns: null,
        cooldown_seconds: null,
        late_entry_reserved_slots: 0,
        revive_reserved_slots: 0,
        same_pair_cap: 0,
        last_evaluated_at: new Date('2026-04-08T10:00:00.000Z').toISOString(),
      },
      active_route: null,
      can_receive_replies: true,
      lifecycle_label: 'ACTIVE',
      updated_at: new Date('2026-04-08T10:00:00.000Z').toISOString(),
    },
    route_handoff: null,
    role: 'COUNTERPOINT',
    summary: 'Thread summary',
    unresolved_points: [],
    resolved_points: [],
    salient_turn_ids: ['turn-1'],
    reason_badges: [],
    semantic_marks: [],
    audience_signals: null,
    guide_score: 4,
    evidence_refs: [{ kind: 'THREAD', id: 'thread-1' }],
    public_persona_cues: [],
    public_growth_cues: [],
    updated_at: new Date('2026-04-08T10:00:00.000Z').toISOString(),
  } as ThreadCapsule
}

function buildPostCapsule(threadCapsule: ThreadCapsule): PostSemanticCapsule {
  return {
    schema_version: 'post.v1',
    post_id: 'post-1',
    community_id: 'community-1',
    thread_count: 1,
    highlighted_thread_ids: ['thread-1'],
    participant_ids: ['author-1', 'agent-related'],
    participant_count: 2,
    latest_activity_at: new Date('2026-04-08T10:00:00.000Z').toISOString(),
    flow_phase: 'ESCALATION',
    premise: 'Premise',
    current_tension: 'Still escalating',
    resolved_points: [],
    open_questions: [],
    must_read_turn_ids: ['turn-1'],
    start_thread_ids: ['thread-1'],
    thread_capsules: [threadCapsule],
    thread_capsule_ids: ['thread-1'],
    audience_capsule_id: null,
    audience_signals: null,
    public_persona_cues: [],
    public_growth_cues: [],
    evidence_refs: [{ kind: 'THREAD', id: 'thread-1' }],
    updated_at: new Date('2026-04-08T10:00:00.000Z').toISOString(),
  }
}

function buildPolicy(): EffectiveOrchestrationPolicy {
  return {
    schema_version: 'policy.v1',
    scope_type: 'POST',
    scope_id: 'post-1',
    source: 'derived_default',
    profile: 'guided_scene',
    recall_control: {
      schema_version: 'recall.v1',
      pair_window_minutes: 45,
      pair_max_exchanges: 3,
      post_thread_share_cap: 0.6,
      reactive_recall_decay: 'moderate',
      newcomer_min_share: 0.2,
      late_entry_min_share: 0.1,
      revive_old_branch_budget: 1,
    },
    compare_debug: {
      schema_version: 'compare.v1',
      shadow_enabled: false,
      record_metrics: true,
      include_viewer_telemetry: true,
    },
    cutover: {
      schema_version: 'cutover.v1',
      selection_enabled: true,
      envelope_enabled: true,
      fallback_to_baseline: true,
    },
    community_default: null as never,
    post_override: null,
  }
}

describe('AttentionOpportunityBroker', () => {
  const broker = new AttentionOpportunityBroker()

  it('emits RELATION_ECHO from relation-ranked candidates and keeps RELATION_PULL as browse reason', () => {
    const threadCapsule = buildThreadCapsule()
    const postCapsule = buildPostCapsule(threadCapsule)
    const scoredCandidates: ScoredCandidate[] = [
      {
        agent_id: 'agent-related',
        score: 8,
        reasons: ['relation_hint=friend'],
      },
      {
        agent_id: 'agent-other',
        score: 7,
        reasons: [],
      },
    ]

    const [opportunity] = broker.discover({
      event: buildEvent(),
      post_capsule: postCapsule,
      thread_capsule: threadCapsule,
      effective_orchestration_policy: buildPolicy(),
      scored_candidates: scoredCandidates,
      watch_telemetry_snapshot: null,
    })

    expect(opportunity?.source).toBe('RELATION_ECHO')
    expect(opportunity?.browse_reason).toBe('RELATION_PULL')
    expect(opportunity?.priority_agent_ids).toEqual(['agent-related'])
  })

  it('keeps DIRECT_CHALLENGE ahead of relation echo when a target author is present', () => {
    const threadCapsule = buildThreadCapsule()
    const postCapsule = buildPostCapsule(threadCapsule)

    const [opportunity] = broker.discover({
      event: buildEvent({ target_author_agent_id: 'agent-target' }),
      post_capsule: postCapsule,
      thread_capsule: threadCapsule,
      effective_orchestration_policy: buildPolicy(),
      scored_candidates: [{
        agent_id: 'agent-related',
        score: 8,
        reasons: ['relation_hint=friend'],
      }],
      watch_telemetry_snapshot: null,
    })

    expect(opportunity?.source).toBe('DIRECT_CHALLENGE')
    expect(opportunity?.browse_reason).toBe('DIRECT_CHALLENGE')
    expect(opportunity?.priority_agent_ids).toEqual(['agent-target'])
  })
})
