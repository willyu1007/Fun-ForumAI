import { describe, expect, it } from 'vitest'
import type { ExecutionContext, RoamingArrivalCandidate } from '../types.js'
import {
  buildDecisionHint,
  buildForumRoamingPreparation,
  parseRoamingDecision,
  resolveForumExecutionPlan,
} from '../forum-roaming.js'

function buildBaseContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    event: {
      event_id: 'evt-1',
      event_type: 'ThreadTurnAdded',
      idempotency_key: 'idem-1',
      chain_depth: 0,
      community_id: 'community-1',
      post_id: 'post-1',
      thread_id: 'thread-1',
      turn_id: 'turn-2',
      created_at: new Date('2026-04-12T00:00:00.000Z').toISOString(),
    },
    agent: {
      agent_id: 'agent-1',
      score: 1,
      priority: 1,
      selected_anchor_turn_id: 'turn-2',
    },
    persona: {
      name: 'Roaming Bot',
      style: 'precise',
      interests: ['forums'],
      language: 'zh-CN',
    },
    community: {
      id: 'community-1',
      name: '测试社区',
      description: '',
      rules: '',
    },
    post: {
      id: 'post-1',
      title: '帖子标题',
      body: '帖子正文',
      author_agent_id: 'agent-2',
      author_name: 'Other Bot',
    },
    blocks: {
      hard_control_block: 'hard',
      compact_control_block: 'compact',
      current_context_block: 'context',
      memory_block: 'memory',
      soft_expression_block: 'soft',
    },
    forum_targeting: {
      event_target_entry_id: 'turn-2',
      event_target_thread_id: 'thread-1',
      focus_turn_id: 'turn-2',
      selected_anchor_turn_id: 'turn-2',
      actual_anchor_turn_id: 'turn-1',
      final_write_anchor_turn_id: 'turn-1',
      reply_thread_id: 'thread-1',
      browse_reason: 'REVIVE',
      allowed_actions: ['REPLY', 'START_NEW_THREAD', 'HANDOFF', 'IGNORE'],
    },
    perceived_context_slice: {
      schema_version: 'forum-perceived-context-slice.v1',
      slice_id: 'slice-1',
      agent_id: 'agent-1',
      post_id: 'post-1',
      thread_id: 'thread-1',
      browse_reason: 'REVIVE',
      opportunity_id: 'opp-1',
      focus_turn_id: 'turn-2',
      selected_anchor_turn_id: 'turn-2',
      actual_anchor_turn_id: 'turn-1',
      context_coverage: 'LOCAL_PLUS_POST',
      post_view: {
        premise: 'Premise',
        flow_phase: 'ESCALATION',
        current_tension: 'Tension',
        open_questions: ['Question 1'],
      },
      thread_view: {
        role: 'COUNTERPOINT',
        summary: 'Current thread summary',
        unresolved_points: ['Question 1'],
        thread_state: 'HEATING',
      },
      evidence_window: [],
      unseen_global_notes: [],
      allowed_actions: ['REPLY', 'START_NEW_THREAD', 'HANDOFF', 'IGNORE'],
      visible_node_ids: ['thread-1', 'turn-2'],
      evidence_window_ids: ['turn-2'],
      reason_codes: ['revive_old_branch'],
      post_capsule_excerpt: 'post excerpt',
      branch_capsule_excerpt: 'branch excerpt',
      generated_at: new Date('2026-04-12T00:00:00.000Z').toISOString(),
      expires_at: new Date('2026-04-12T01:00:00.000Z').toISOString(),
      built_at: new Date('2026-04-12T00:00:00.000Z').toISOString(),
    },
    ...overrides,
  } as ExecutionContext
}

describe('forum-roaming', () => {
  it('builds a compact decision hint and keeps it within two lines', () => {
    const lowVerbosity = buildDecisionHint({
      ctx: buildBaseContext(),
      identity: {
        agent_id: 'agent-1',
        display_name: 'Roaming Bot',
        persona_seed_code: 'scholar',
        owner_style_pins: {
          mood: 'neutral',
          verbosity: 2,
          habits: ['summarizes'],
        },
      },
    })
    const highVerbosity = buildDecisionHint({
      ctx: buildBaseContext(),
      identity: {
        agent_id: 'agent-1',
        display_name: 'Roaming Bot',
        persona_seed_code: 'scholar',
        owner_style_pins: {
          mood: 'critical',
          verbosity: 5,
          habits: ['asks_questions'],
        },
      },
    })

    expect(lowVerbosity.text.split('\n').length).toBeLessThanOrEqual(2)
    expect(lowVerbosity.text).toContain('旧分支返场')
    expect(highVerbosity.text).not.toBe(lowVerbosity.text)
  })

  it('builds non-audience arrival candidates and includes a sibling-thread slot', () => {
    const currentThread = {
      schema_version: 'forum-thread-capsule.v1',
      thread_id: 'thread-1',
      post_id: 'post-1',
      community_id: 'community-1',
      author_id: 'agent-2',
      participant_ids: ['agent-2', 'agent-3'],
      participant_count: 2,
      turn_count: 2,
      latest_turn_id: 'turn-2',
      latest_activity_at: new Date('2026-04-12T00:00:00.000Z').toISOString(),
      lifecycle: {
        schema_version: 'forum-thread-lifecycle.v1',
        thread_id: 'thread-1',
        state: 'HEATING',
        thread_state: 'HEATING',
        reply_budget: {
          schema_version: 'forum-reply-budget.v1',
          thread_id: 'thread-1',
          limit: 6,
          used: 2,
          remaining: 4,
          exhausted: false,
          mode: 'SOFT_CAP',
          soft_cap_turns: 6,
          hard_cap_turns: null,
          remaining_turns: 4,
          cooldown_seconds: null,
          late_entry_reserved_slots: 1,
          revive_reserved_slots: 1,
          same_pair_cap: 2,
          last_evaluated_at: new Date('2026-04-12T00:00:00.000Z').toISOString(),
        },
        active_route: null,
        writeability: {
          schema_version: 'forum-thread-writeability.v1',
          thread_id: 'thread-1',
          reply_mode: 'OPEN',
          reply_allowed: true,
          preferred_action: 'REPLY_IN_THREAD',
          reason_code: 'THREAD_OPEN',
        },
        lifecycle_label: 'ACTIVE',
        updated_at: new Date('2026-04-12T00:00:00.000Z').toISOString(),
      },
      route_handoff: null,
      role: 'COUNTERPOINT',
      summary: 'Current branch summary',
      unresolved_points: ['Question 1'],
      resolved_points: [],
      salient_turn_ids: ['turn-2'],
      reason_badges: ['RETURNED_TO_BRANCH'],
      semantic_marks: [],
      audience_signals: null,
      guide_score: 1,
      evidence_refs: [],
      public_persona_cues: [],
      public_growth_cues: [],
      updated_at: new Date('2026-04-12T00:00:00.000Z').toISOString(),
    }
    const audienceThread = {
      ...currentThread,
      thread_id: 'thread-audience',
      latest_turn_id: 'turn-audience',
      lifecycle: {
        ...currentThread.lifecycle,
        thread_id: 'thread-audience',
        active_route: {
          route_type: 'AUDIENCE',
          route_state: 'READY',
        },
        writeability: {
          ...currentThread.lifecycle.writeability,
          thread_id: 'thread-audience',
          reply_mode: 'ROUTE_ONLY',
          reply_allowed: false,
          preferred_action: 'FOLLOW_ROUTE',
          reason_code: 'THREAD_HANDOFFED',
        },
      },
      route_handoff: {
        route_id: 'route-1',
        route_type: 'AUDIENCE',
        route_kind: 'AUDIENCE',
        route_state: 'READY',
        state: 'OPEN',
        reason_code: 'AUDIENCE_ONLY',
        handoff_label: '去观众区',
        handoff_payload: null,
        cta: null,
        target_ref: null,
        suggested_at: new Date('2026-04-12T00:00:00.000Z').toISOString(),
        activated_at: null,
        completed_at: null,
        expires_at: null,
      },
      summary: 'Audience route thread',
      salient_turn_ids: ['turn-audience'],
    }

    const ctx = buildBaseContext({
      semantic_post_capsule: {
        schema_version: 'forum-post-semantic-capsule.v1',
        post_id: 'post-1',
        community_id: 'community-1',
        thread_count: 2,
        highlighted_thread_ids: ['thread-1', 'thread-audience'],
        participant_ids: ['agent-1', 'agent-2', 'agent-3'],
        participant_count: 3,
        latest_activity_at: new Date('2026-04-12T00:00:00.000Z').toISOString(),
        audience_signals: null,
        thread_capsules: [currentThread, audienceThread],
        flow_phase: 'ESCALATION',
        premise: 'Premise',
        current_tension: 'Tension',
        resolved_points: [],
        open_questions: ['Question 1'],
        must_read_turn_ids: ['turn-2'],
        start_thread_ids: ['thread-1'],
        thread_capsule_ids: ['thread-1', 'thread-audience'],
        audience_capsule_id: null,
        evidence_refs: [],
        public_persona_cues: [],
        public_growth_cues: [],
        updated_at: new Date('2026-04-12T00:00:00.000Z').toISOString(),
      },
      semantic_thread_capsule: currentThread,
      discussion_forest: {
        schema_version: 'forum-discussion-forest.v1',
        projection_id: 'forest-1',
        post_id: 'post-1',
        focus_thread_id: 'thread-1',
        focus_turn_id: 'turn-2',
        reading_guide: {
          schema_version: 'forum-reading-guide.v1',
          post_id: 'post-1',
          entries: [
            {
              id: 'guide-1',
              thread_id: 'thread-1',
              focus_turn_id: 'turn-2',
              title: '当前分支',
              teaser: '继续这个分支',
              reason_badges: [],
              participant_count: 2,
              turn_count: 2,
              latest_activity_at: new Date('2026-04-12T00:00:00.000Z').toISOString(),
              evidence_refs: [],
            },
            {
              id: 'guide-2',
              thread_id: 'thread-audience',
              focus_turn_id: 'turn-audience',
              title: '观众区',
              teaser: '不应入选',
              reason_badges: [],
              participant_count: 1,
              turn_count: 1,
              latest_activity_at: new Date('2026-04-12T00:00:00.000Z').toISOString(),
              evidence_refs: [],
            },
          ],
          highlighted_thread_ids: ['thread-1', 'thread-audience'],
          summary_line: 'summary',
          start_here_thread_ids: ['thread-1'],
          current_focus_thread_ids: ['thread-1'],
          must_read_turn_ids: ['turn-2'],
          evidence_refs: [],
          generated_at: new Date('2026-04-12T00:00:00.000Z').toISOString(),
        },
        branch_groups: [],
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
            author: { id: 'agent-2', actor_type: 'agent', display_name: 'Agent Two', avatar_url: null },
            body: 'Thread root',
            quoted_excerpt: null,
            evidence_refs: [],
            created_at: new Date('2026-04-12T00:00:00.000Z').toISOString(),
            generated_at: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          },
          {
            schema_version: 'forum-turn-display-projection.v1',
            id: 'turn-2',
            entry_kind: 'TURN',
            post_id: 'post-1',
            thread_id: 'thread-1',
            display_parent_id: 'thread-1',
            display_depth: 1,
            actual_anchor_turn_id: 'turn-1',
            branch_root_turn_id: 'thread-1',
            sibling_order: 1,
            collapsed_anchor_chain: [],
            is_late_entry: true,
            placement_reason: 'LATE_ENTRY_REATTACH',
            anchor_preview_source: 'VISIBLE_TURN',
            reason_badges: ['RETURNED_TO_BRANCH'],
            author: { id: 'agent-3', actor_type: 'agent', display_name: 'Agent Three', avatar_url: null },
            body: 'Focus reply body',
            quoted_excerpt: null,
            evidence_refs: [],
            created_at: new Date('2026-04-12T00:00:00.000Z').toISOString(),
            generated_at: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          },
          {
            schema_version: 'forum-turn-display-projection.v1',
            id: 'thread-audience',
            entry_kind: 'THREAD',
            post_id: 'post-1',
            thread_id: 'thread-audience',
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
            author: { id: 'agent-4', actor_type: 'agent', display_name: 'Agent Four', avatar_url: null },
            body: 'Audience root',
            quoted_excerpt: null,
            evidence_refs: [],
            created_at: new Date('2026-04-12T00:00:00.000Z').toISOString(),
            generated_at: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          },
        ],
        latest_activity_cursor: null,
        evidence_refs: [],
        generated_at: new Date('2026-04-12T00:00:00.000Z').toISOString(),
      },
      forum_runtime_context: {
        schema_version: 'forum-runtime-context-envelope.v1',
        envelope_id: 'runtime-1',
        agent_id: 'agent-1',
        post_id: 'post-1',
        thread_id: 'thread-1',
        built_from_slice_id: 'slice-1',
        foundation_skeleton: {
          post: {
            post_id: 'post-1',
            title: '帖子标题',
            body_excerpt: '帖子正文',
            author: {
              actor_type: 'agent',
              actor_id: 'agent-2',
              display_name: 'Other Bot',
            },
            community_id: 'community-1',
          },
          participation_contract: {
            stage_open_reply: {
              enabled: true,
              new_thread_enabled: true,
              turn_reply_enabled: true,
            },
            audience_lane: {
              enabled: true,
              posting_enabled: false,
            },
            identity_policy: null,
          },
          route_snapshot: null,
        },
        post_situation: null,
        focus_thread: null,
        evidence_window: null,
        memory_refs: [],
        built_at: new Date('2026-04-12T00:00:00.000Z').toISOString(),
        post_capsule: {} as never,
        thread_capsule: null,
        perceived_slice: null,
      },
    })

    const preparation = buildForumRoamingPreparation({
      ctx,
      identity: {
        agent_id: 'agent-1',
        display_name: 'Roaming Bot',
        persona_seed_code: 'scholar',
        owner_style_pins: null,
      },
    })

    expect(preparation.arrival_candidates.length).toBeLessThanOrEqual(5)
    expect(preparation.arrival_candidates.some((candidate) => candidate.candidate_kind === 'sibling_thread_slot')).toBe(true)
    expect(preparation.arrival_candidates.some((candidate) => candidate.thread_id === 'thread-audience')).toBe(false)
    expect(preparation.arrival_candidates.every((candidate) => candidate.route_handoff?.route_type !== 'AUDIENCE')).toBe(true)
    expect(preparation.decision_prompt_input.decision_control_block)
      .toContain('candidate_id 必须逐字照抄候选里的完整值')
    expect(preparation.decision_prompt_input.arrival_candidates_json)
      .toContain('"candidate_id": "branch:thread-1"')
  })

  it('fails closed when roaming decision JSON includes wrappers or extra fields', () => {
    const candidates: RoamingArrivalCandidate[] = [
      {
        candidate_id: 'branch:thread-1',
        candidate_kind: 'branch_entry',
        label: '当前分支入口',
        summary: 'summary',
        thread_id: 'thread-1',
        focus_turn_id: 'turn-2',
        anchor_turn_id: 'turn-1',
        branch_root_turn_id: 'thread-1',
        local_evidence: [],
        reason_codes: [],
        allowed_actions: ['reply_in_branch', 'observe_only'],
        expires_at: new Date('2026-04-12T01:00:00.000Z').toISOString(),
        route_handoff: null,
      },
    ]

    expect(parseRoamingDecision('note\n{"candidate_id":"branch:thread-1","action":"reply_in_branch"}', candidates))
      .toMatchObject({ status: 'invalid_json' })
    expect(parseRoamingDecision('{"candidate_id":"branch:thread-1","action":"reply_in_branch","why":"extra"}', candidates))
      .toMatchObject({ status: 'invalid_shape' })
    expect(parseRoamingDecision('{"candidate_id":"branch:missing","action":"reply_in_branch"}', candidates))
      .toMatchObject({ status: 'invalid_candidate' })
  })

  it('maps roaming actions into execution plans and downgrades stale candidates to no_write', () => {
    const handoffCandidate: RoamingArrivalCandidate = {
      candidate_id: 'branch:thread-1',
      candidate_kind: 'branch_entry',
      label: '当前分支入口',
      summary: 'summary',
      thread_id: 'thread-1',
      focus_turn_id: 'turn-2',
      anchor_turn_id: 'turn-1',
      branch_root_turn_id: 'thread-1',
      local_evidence: [],
      reason_codes: [],
      allowed_actions: ['handoff_or_route_elsewhere', 'observe_only'],
      expires_at: new Date('2099-04-12T01:00:00.000Z').toISOString(),
      route_handoff: {
        route_type: 'PRIVATE',
        route_state: 'READY',
        reason_code: 'PRIVATE_HANDOFF_REQUIRED',
        handoff_label: '去私聊',
        handoff_payload: null,
        cta: null,
      },
    }
    const siblingCandidate: RoamingArrivalCandidate = {
      ...handoffCandidate,
      candidate_id: 'sibling:thread-1',
      candidate_kind: 'sibling_thread_slot',
      allowed_actions: ['start_sibling_thread', 'observe_only'],
      route_handoff: null,
    }

    expect(resolveForumExecutionPlan({
      post_id: 'post-1',
      candidates: [handoffCandidate],
      decision_result: {
        status: 'selected',
        candidate_id: 'branch:thread-1',
        action: 'handoff_or_route_elsewhere',
        raw_output: '{"candidate_id":"branch:thread-1","action":"handoff_or_route_elsewhere"}',
      },
    })).toMatchObject({
      write_action: 'add_thread_turn_with_route',
      write_thread_id: 'thread-1',
      validation_status: 'resolved',
    })

    expect(resolveForumExecutionPlan({
      post_id: 'post-1',
      candidates: [siblingCandidate],
      decision_result: {
        status: 'selected',
        candidate_id: 'sibling:thread-1',
        action: 'start_sibling_thread',
        raw_output: '{"candidate_id":"sibling:thread-1","action":"start_sibling_thread"}',
      },
    })).toMatchObject({
      write_action: 'open_thread',
      validation_status: 'resolved',
    })

    expect(resolveForumExecutionPlan({
      post_id: 'post-1',
      candidates: [{
        ...handoffCandidate,
        expires_at: new Date('2026-04-11T23:59:00.000Z').toISOString(),
      }],
      decision_result: {
        status: 'selected',
        candidate_id: 'branch:thread-1',
        action: 'handoff_or_route_elsewhere',
        raw_output: '{"candidate_id":"branch:thread-1","action":"handoff_or_route_elsewhere"}',
      },
      now: new Date('2026-04-12T00:00:00.000Z'),
    })).toMatchObject({
      write_action: 'no_write',
      validation_status: 'candidate_expired',
    })
  })
})
