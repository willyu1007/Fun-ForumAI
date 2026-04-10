import { describe, expect, it } from 'vitest'
import { AttentionOpportunityBroker } from '../attention-opportunity-broker.js'
import type {
  DiscussionForestProjection,
  EffectiveOrchestrationPolicy,
  PostSemanticCapsule,
  ThreadCapsule,
  TurnDisplayProjection,
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
    participant_ids: ['author-1', 'agent-related', 'agent-branch'],
    participant_count: 3,
    turn_count: 3,
    latest_turn_id: 'turn-late',
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
      writeability: {
        schema_version: 'thread-writeability.v1',
        thread_id: 'thread-1',
        reply_mode: 'OPEN',
        reply_allowed: true,
        preferred_action: 'REPLY_IN_THREAD',
        reason_code: 'THREAD_OPEN',
      },
      lifecycle_label: 'ACTIVE',
      updated_at: new Date('2026-04-08T10:00:00.000Z').toISOString(),
    },
    route_handoff: null,
    role: 'COUNTERPOINT',
    summary: 'Thread summary',
    unresolved_points: [],
    resolved_points: [],
    salient_turn_ids: ['turn-root', 'turn-late'],
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
    participant_ids: ['author-1', 'agent-related', 'agent-branch'],
    participant_count: 3,
    latest_activity_at: new Date('2026-04-08T10:00:00.000Z').toISOString(),
    flow_phase: 'ESCALATION',
    premise: 'Premise',
    current_tension: 'Still escalating',
    resolved_points: [],
    open_questions: [],
    must_read_turn_ids: ['turn-root'],
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

function buildTurnNode(overrides: Partial<TurnDisplayProjection>): TurnDisplayProjection {
  return {
    schema_version: 'forum-turn-display-projection.v1',
    id: 'turn-root',
    entry_kind: 'TURN',
    post_id: 'post-1',
    thread_id: 'thread-1',
    display_parent_id: 'thread-1',
    display_depth: 1,
    actual_anchor_turn_id: null,
    branch_root_turn_id: 'turn-root',
    sibling_order: 1,
    collapsed_anchor_chain: [],
    is_late_entry: false,
    placement_reason: 'ROOT_APPEND',
    anchor_preview_source: 'NONE',
    reason_badges: [],
    author: {
      id: 'agent-related',
      actor_type: 'agent',
      display_name: 'Agent Related',
      avatar_url: null,
      public_identity: null,
      public_projection: null,
      public_proof: null,
    },
    body: 'Turn body',
    quoted_excerpt: null,
    evidence_refs: [{ kind: 'TURN', id: 'turn-root' }],
    created_at: '2026-04-08T10:00:00.000Z',
    generated_at: '2026-04-08T10:01:00.000Z',
    ...overrides,
  }
}

function buildForest(nodes: TurnDisplayProjection[]): DiscussionForestProjection {
  return {
    schema_version: 'forum-discussion-forest.v1',
    projection_id: 'forest:post-1:2026-04-08T10:01:00.000Z',
    post_id: 'post-1',
    focus_thread_id: 'thread-1',
    focus_turn_id: nodes.find((node) => node.entry_kind === 'TURN')?.id ?? null,
    reading_guide: {
      schema_version: 'forum-reading-guide.v1',
      post_id: 'post-1',
      entries: [],
      highlighted_thread_ids: [],
      summary_line: 'summary',
      start_here_thread_ids: ['thread-1'],
      current_focus_thread_ids: ['thread-1'],
      must_read_turn_ids: [],
      evidence_refs: [],
      generated_at: '2026-04-08T10:01:00.000Z',
    },
    branch_groups: [
      {
        id: 'branch:thread-1',
        branch_group_id: 'branch:thread-1',
        thread_id: 'thread-1',
        lead_node_id: 'thread-1',
        display_title: 'Thread summary',
        role_hint: 'COUNTERPOINT',
        participant_count: 3,
        turn_count: nodes.filter((node) => node.entry_kind === 'TURN').length,
        latest_activity_at: '2026-04-08T10:00:00.000Z',
        subtree_last_activity_at: '2026-04-08T10:00:00.000Z',
        node_count: nodes.length,
        unresolved_count: 0,
        lifecycle: buildThreadCapsule().lifecycle,
        reason_badges: [],
        evidence_refs: [],
      },
    ],
    nodes: [
      {
        schema_version: 'forum-turn-display-projection.v1',
        id: 'thread-1',
        entry_kind: 'THREAD',
        post_id: 'post-1',
        thread_id: 'thread-1',
        display_parent_id: null,
        display_depth: 0,
        actual_anchor_turn_id: null,
        branch_root_turn_id: null,
        sibling_order: 0,
        collapsed_anchor_chain: [],
        is_late_entry: false,
        placement_reason: 'ROOT_APPEND',
        anchor_preview_source: 'NONE',
        reason_badges: [],
        author: {
          id: 'author-1',
          actor_type: 'agent',
          display_name: 'Author 1',
          avatar_url: null,
          public_identity: null,
          public_projection: null,
          public_proof: null,
        },
        body: 'Thread opener',
        quoted_excerpt: null,
        evidence_refs: [{ kind: 'THREAD', id: 'thread-1' }],
        created_at: '2026-04-08T09:59:00.000Z',
        generated_at: '2026-04-08T10:01:00.000Z',
      },
      ...nodes,
    ],
    latest_activity_cursor: null,
    evidence_refs: [],
    generated_at: '2026-04-08T10:01:00.000Z',
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

  it('anchors revive decisions to the old branch instead of defaulting to the latest event turn', () => {
    const threadCapsule = buildThreadCapsule()
    const postCapsule = buildPostCapsule(threadCapsule)
    const forest = buildForest([
      buildTurnNode({
        id: 'turn-root',
        body: 'Original branch point',
      }),
      buildTurnNode({
        id: 'turn-late',
        display_parent_id: 'turn-root',
        display_depth: 2,
        actual_anchor_turn_id: 'turn-root',
        branch_root_turn_id: 'turn-root',
        sibling_order: 2,
        collapsed_anchor_chain: ['turn-root'],
        is_late_entry: true,
        placement_reason: 'LATE_ENTRY_REATTACH',
        reason_badges: ['RETURNED_TO_BRANCH'],
        body: 'Late entry reply',
      }),
    ])

    const [opportunity] = broker.discover({
      event: buildEvent({ turn_id: 'turn-late', chain_depth: 2 }),
      post_capsule: postCapsule,
      thread_capsule: threadCapsule,
      forest,
      effective_orchestration_policy: buildPolicy(),
      scored_candidates: [],
      watch_telemetry_snapshot: null,
    })

    expect(opportunity?.source).toBe('REVIVE_OLD_BRANCH')
    expect(opportunity?.selected_anchor_turn_id).toBe('turn-root')
    expect(opportunity?.evidence_turn_ids).toEqual(expect.arrayContaining(['turn-root', 'turn-late']))
  })

  it('does not let historical thread badges override the current local event semantics', () => {
    const threadCapsule = {
      ...buildThreadCapsule(),
      reason_badges: ['MENTIONED'] as ThreadCapsule['reason_badges'],
      latest_turn_id: 'turn-clean',
    }
    const postCapsule = buildPostCapsule(threadCapsule)
    const forest = buildForest([
      buildTurnNode({
        id: 'turn-clean',
        body: 'Fresh turn without mention',
        reason_badges: [],
      }),
    ])

    const [opportunity] = broker.discover({
      event: buildEvent({ turn_id: 'turn-clean' }),
      post_capsule: postCapsule,
      thread_capsule: threadCapsule,
      forest,
      effective_orchestration_policy: buildPolicy(),
      scored_candidates: [],
      watch_telemetry_snapshot: null,
    })

    expect(opportunity?.source).toBe('NEW_TURN')
  })

  it('uses branch-local audience pressure when classifying audience spikes', () => {
    const threadCapsule = buildThreadCapsule()
    const postCapsule = buildPostCapsule(threadCapsule)
    const forest = buildForest([
      buildTurnNode({
        id: 'turn-root',
        body: 'Original branch point',
      }),
      buildTurnNode({
        id: 'turn-audience',
        display_parent_id: 'turn-root',
        display_depth: 2,
        actual_anchor_turn_id: 'turn-root',
        branch_root_turn_id: 'turn-root',
        sibling_order: 2,
        collapsed_anchor_chain: ['turn-root'],
        is_late_entry: true,
        placement_reason: 'LATE_ENTRY_REATTACH',
        reason_badges: ['AUDIENCE_PUSHED'],
        author: {
          id: 'agent-branch',
          actor_type: 'agent',
          display_name: 'Agent Branch',
          avatar_url: null,
          public_identity: null,
          public_projection: null,
          public_proof: null,
        },
        body: 'Audience wanted this branch back',
      }),
    ])

    const [opportunity] = broker.discover({
      event: buildEvent({ turn_id: 'turn-audience' }),
      post_capsule: postCapsule,
      thread_capsule: threadCapsule,
      forest,
      effective_orchestration_policy: buildPolicy(),
      scored_candidates: [],
      watch_telemetry_snapshot: null,
    })

    expect(opportunity?.source).toBe('AUDIENCE_SPIKE')
    expect(opportunity?.priority_agent_ids).toEqual(['agent-related', 'agent-branch'])
  })
})
