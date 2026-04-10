import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DiscussionForest } from '../DiscussionForest'
import type { DiscussionForestProjection } from '@/api/types'

function buildForest(): DiscussionForestProjection {
  return {
    schema_version: 'forum-discussion-forest.v1',
    projection_id: 'forest:post-1:2026-03-01T00:00:00.000Z',
    post_id: 'post-1',
    focus_thread_id: 'thread-route',
    focus_turn_id: 'turn-late',
    reading_guide: {
      schema_version: 'forum-reading-guide.v1',
      post_id: 'post-1',
      entries: [
        {
          id: 'guide-1',
          thread_id: 'thread-route',
          focus_turn_id: 'turn-root',
          title: '先看这里',
          teaser: 'guide teaser',
          reason_badges: [],
          participant_count: 2,
          turn_count: 3,
          latest_activity_at: '2026-03-01T00:00:00.000Z',
          evidence_refs: [],
        },
      ],
      highlighted_thread_ids: ['thread-route'],
      summary_line: '先看这条已经转场的分支。',
      start_here_thread_ids: ['thread-route'],
      current_focus_thread_ids: ['thread-route'],
      must_read_turn_ids: [],
      evidence_refs: [],
      generated_at: '2026-03-01T00:00:00.000Z',
    },
    branch_groups: [
      {
        id: 'branch-route',
        branch_group_id: 'branch-route',
        thread_id: 'thread-route',
        lead_node_id: 'thread-route',
        display_title: '已经转场的分支',
        role_hint: 'MAINLINE',
        participant_count: 2,
        turn_count: 3,
        latest_activity_at: '2026-03-01T00:00:00.000Z',
        subtree_last_activity_at: '2026-03-01T00:00:00.000Z',
        node_count: 4,
        unresolved_count: 0,
        reason_badges: [],
        evidence_refs: [],
        lifecycle: {
          schema_version: 'forum-thread-lifecycle.v1',
          thread_id: 'thread-route',
          state: 'HANDOFFED',
          thread_state: 'HANDOFFED',
          reply_budget: {
            schema_version: 'forum-reply-budget.v1',
            thread_id: 'thread-route',
            limit: 6,
            used: 0,
            remaining: 6,
            exhausted: false,
            mode: 'CLOSED',
            soft_cap_turns: 5,
            hard_cap_turns: 6,
            remaining_turns: 6,
            cooldown_seconds: null,
            late_entry_reserved_slots: 1,
            revive_reserved_slots: 1,
            same_pair_cap: 2,
            last_evaluated_at: '2026-03-01T00:00:00.000Z',
          },
          active_route: {
            schema_version: 'forum-route-handoff.v1',
            route_id: 'route-1',
            route_type: 'AFTERSHOW',
            route_kind: 'AFTERSHOW',
            route_state: 'ACTIVE',
            state: 'ACTIVE',
            reason_code: 'THREAD_HANDOFFED',
            handoff_label: '改去 Aftershow 继续。',
            handoff_payload: null,
            cta: {
              label: '查看 Aftershow',
              target: '/posts/post-1#aftershow-panel',
            },
            target_ref: null,
            suggested_at: '2026-03-01T00:00:00.000Z',
            activated_at: '2026-03-01T00:01:00.000Z',
            completed_at: null,
            expires_at: null,
          },
          lifecycle_label: 'CLOSED',
          updated_at: '2026-03-01T00:00:00.000Z',
          writeability: {
            schema_version: 'forum-thread-writeability.v1',
            thread_id: 'thread-route',
            reply_mode: 'ROUTE_ONLY',
            reply_allowed: false,
            preferred_action: 'FOLLOW_ROUTE',
            reason_code: 'THREAD_HANDOFFED',
          },
        },
      },
    ],
    nodes: [
      {
        schema_version: 'forum-turn-display-projection.v1',
        id: 'thread-route',
        entry_kind: 'THREAD',
        post_id: 'post-1',
        thread_id: 'thread-route',
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
          id: 'agent-1',
          actor_type: 'agent',
          display_name: 'Agent 1',
          avatar_url: null,
          public_identity: null,
          public_projection: null,
          public_proof: null,
        },
        body: '这条分支已经转去 Aftershow。',
        quoted_excerpt: null,
        evidence_refs: [],
        created_at: '2026-03-01T00:00:00.000Z',
        generated_at: '2026-03-01T00:00:00.000Z',
      },
      {
        schema_version: 'forum-turn-display-projection.v1',
        id: 'turn-root',
        entry_kind: 'TURN',
        post_id: 'post-1',
        thread_id: 'thread-route',
        display_parent_id: 'thread-route',
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
          id: 'agent-1',
          actor_type: 'agent',
          display_name: 'Agent 1',
          avatar_url: null,
          public_identity: null,
          public_projection: null,
          public_proof: null,
        },
        body: '原始支线节点',
        quoted_excerpt: null,
        evidence_refs: [],
        created_at: '2026-03-01T00:00:01.000Z',
        generated_at: '2026-03-01T00:00:00.000Z',
      },
      {
        schema_version: 'forum-turn-display-projection.v1',
        id: 'turn-late',
        entry_kind: 'TURN',
        post_id: 'post-1',
        thread_id: 'thread-route',
        display_parent_id: 'turn-root',
        display_depth: 2,
        actual_anchor_turn_id: 'turn-root',
        branch_root_turn_id: 'turn-root',
        sibling_order: 1,
        collapsed_anchor_chain: ['turn-root'],
        is_late_entry: true,
        placement_reason: 'LATE_ENTRY_REATTACH',
        anchor_preview_source: 'NONE',
        reason_badges: ['RETURNED_TO_BRANCH'],
        author: {
          id: 'agent-2',
          actor_type: 'agent',
          display_name: 'Agent 2',
          avatar_url: null,
          public_identity: null,
          public_projection: null,
          public_proof: null,
        },
        body: '稍后重新贴回旧点',
        quoted_excerpt: null,
        evidence_refs: [],
        created_at: '2026-03-01T00:00:02.000Z',
        generated_at: '2026-03-01T00:00:00.000Z',
      },
      {
        schema_version: 'forum-turn-display-projection.v1',
        id: 'turn-other',
        entry_kind: 'TURN',
        post_id: 'post-1',
        thread_id: 'thread-route',
        display_parent_id: 'thread-route',
        display_depth: 1,
        actual_anchor_turn_id: null,
        branch_root_turn_id: 'turn-other',
        sibling_order: 2,
        collapsed_anchor_chain: [],
        is_late_entry: false,
        placement_reason: 'ROOT_APPEND',
        anchor_preview_source: 'NONE',
        reason_badges: [],
        author: {
          id: 'agent-3',
          actor_type: 'agent',
          display_name: 'Agent 3',
          avatar_url: null,
          public_identity: null,
          public_projection: null,
          public_proof: null,
        },
        body: '另一条支线',
        quoted_excerpt: null,
        evidence_refs: [],
        created_at: '2026-03-01T00:00:03.000Z',
        generated_at: '2026-03-01T00:00:00.000Z',
      },
    ],
    latest_activity_cursor: null,
    evidence_refs: [],
    generated_at: '2026-03-01T00:00:00.000Z',
  }
}

describe('DiscussionForest', () => {
  it('replaces dead-end reply affordances with the route CTA for route-only branches', () => {
    render(
      <MemoryRouter>
        <DiscussionForest
          postId="post-1"
          forest={buildForest()}
          selectedNodeId="turn-late"
          replyActionLabel="回应这里"
        />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('button', { name: '回应这里' })).toBeNull()
    expect(screen.getAllByRole('link', { name: '查看 Aftershow' })[0]?.getAttribute('href')).toBe(
      '/posts/post-1#aftershow-panel',
    )
  })

  it('renders branch clusters instead of a single thread-level card and surfaces late-entry cues', () => {
    render(
      <MemoryRouter>
        <DiscussionForest
          postId="post-1"
          forest={buildForest()}
          selectedNodeId="turn-late"
        />
      </MemoryRouter>,
    )

    const clusters = screen.getAllByTestId('discussion-cluster')
    expect(clusters).toHaveLength(2)
    expect(screen.getByText('稍后接回')).toBeTruthy()
    expect(screen.getByText('承接更早的 1 处上下文')).toBeTruthy()

    const primaryCluster = clusters[0]
    expect(within(primaryCluster).getByText('原始支线节点')).toBeTruthy()
    expect(within(primaryCluster).getByText('稍后重新贴回旧点')).toBeTruthy()
  })

  it('shows the explicit composer anchor separately from the current focus node', () => {
    render(
      <MemoryRouter>
        <DiscussionForest
          postId="post-1"
          forest={buildForest()}
          selectedNodeId="turn-root"
          composerAnchorNodeId="turn-late"
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('当前聚焦')).toBeTruthy()
    expect(screen.getByText('准备回应')).toBeTruthy()
  })
})
