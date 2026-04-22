import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DiscussionForest } from '../DiscussionForest'
import type { DiscussionForestProjection } from '@/api/types'

const mutateAsyncMock = vi.fn()

vi.mock('@/api/hooks', () => ({
  useCreatePublicTurn: () => ({
    isPending: false,
    mutateAsync: mutateAsyncMock,
  }),
}))

vi.mock('../HumanVoteControls', () => ({
  HumanVoteControls: () => <div data-testid="human-vote-controls" />,
}))

vi.mock('../AgentSentimentBar', () => ({
  AgentSentimentBar: () => <div data-testid="agent-sentiment-net" />,
}))

vi.mock('@/features/agents/components/AgentHoverCard', () => ({
  AgentHoverCard: ({
    children,
    agentId,
  }: {
    children: ReactNode
    agentId: string
  }) => <div data-testid="agent-hover-card" data-agent-id={agentId}>{children}</div>,
}))

vi.mock('@/components/ui/dropdown-menu', async () => {
  const React = await vi.importActual<typeof import('react')>('react')

  return {
    DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children, asChild }: { children: ReactNode; asChild?: boolean }) => {
      if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children)
      }
      return <button type="button">{children}</button>
    },
    DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuItem: ({
      children,
      onSelect,
      disabled,
      ...rest
    }: {
      children: ReactNode
      onSelect?: (event: { preventDefault: () => void }) => void
      disabled?: boolean
    } & Record<string, unknown>) => (
      <button
        type="button"
        role="menuitem"
        disabled={disabled}
        onClick={() => onSelect?.({ preventDefault: () => {} })}
        {...(rest as object)}
      >
        {children}
      </button>
    ),
  }
})

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
          public_identity: {
            agent_kind: 'system',
            identity_badges: [
              {
                badge_id: 'identity:system_resident_badge',
                internal_code: 'system_resident_badge',
                label: '常驻席',
                source_kind: 'system_display',
                priority_rank: 220,
              },
            ],
            identity_visibility_role_id: 'host',
          },
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
        agent_vote_up: 4,
        agent_vote_down: 1,
        human_vote_up: 7,
        human_vote_down: 2,
        viewer_human_vote_direction: null,
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
        agent_vote_up: 1,
        agent_vote_down: 0,
        human_vote_up: 2,
        human_vote_down: 0,
        viewer_human_vote_direction: null,
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
        agent_vote_up: 0,
        agent_vote_down: 0,
        human_vote_up: 0,
        human_vote_down: 0,
        viewer_human_vote_direction: null,
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
  beforeEach(() => {
    mutateAsyncMock.mockReset()
  })

  it('replaces the inline reply affordance with the active route CTA on route-only branches', () => {
    render(
      <MemoryRouter>
        <DiscussionForest
          postId="post-1"
          forest={buildForest()}
          selectedNodeId="turn-late"
          turnReplyEnabled
        />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('button', { name: '回复' })).toBeNull()
    expect(screen.getAllByRole('link', { name: '查看 Aftershow' })[0]?.getAttribute('href')).toBe(
      '/posts/post-1#aftershow-panel',
    )
  })

  it('does not render author badges inside discussion nodes', () => {
    render(
      <MemoryRouter>
        <DiscussionForest postId="post-1" forest={buildForest()} />
      </MemoryRouter>,
    )

    expect(screen.queryByText('常驻席')).toBeNull()
  })

  it('renders a flat tree of top-level nodes without cluster headers or reading-guide banners', () => {
    render(
      <MemoryRouter>
        <DiscussionForest
          postId="post-1"
          forest={buildForest()}
          selectedNodeId="turn-late"
        />
      </MemoryRouter>,
    )

    expect(screen.queryByText('公共观看摘要')).toBeNull()
    expect(screen.queryByText('先看这些公开支线')).toBeNull()
    expect(screen.queryByText('支线簇')).toBeNull()
    expect(screen.queryByText('已经转场的分支')).toBeNull()
    expect(screen.queryByText('稍后接回')).toBeNull()

    const trees = screen.getAllByTestId('discussion-tree')
    expect(trees).toHaveLength(1)
    const primaryTree = trees[0]!
    expect(within(primaryTree).getByText('这条分支已经转去 Aftershow。')).toBeTruthy()
    expect(within(primaryTree).getByText('原始支线节点')).toBeTruthy()
    expect(within(primaryTree).getByText('稍后重新贴回旧点')).toBeTruthy()
    expect(within(primaryTree).getByText('另一条支线')).toBeTruthy()
  })

  it('collapses a subtree when the [-] toggle is pressed', () => {
    render(
      <MemoryRouter>
        <DiscussionForest
          postId="post-1"
          forest={buildForest()}
          selectedNodeId={null}
          turnReplyEnabled
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('稍后重新贴回旧点')).toBeTruthy()

    const rootNode = screen.getByTestId('discussion-forest-tree').querySelector(
      '[data-node-id="thread-route"]',
    ) as HTMLElement | null
    expect(rootNode).toBeTruthy()
    const toggle = within(rootNode as HTMLElement).getAllByTestId('node-collapse-toggle')[0]!
    fireEvent.click(toggle)

    expect(screen.queryByText('稍后重新贴回旧点')).toBeNull()
    expect(screen.queryByText('原始支线节点')).toBeNull()
    expect(screen.queryByText('另一条支线')).toBeNull()
    expect(screen.queryByText(/已折叠 1 条回应/)).toBeNull()
    expect(within(rootNode as HTMLElement).getByLabelText('展开子节点')).toBeTruthy()
    expect(within(rootNode as HTMLElement).getByText('Agent 1')).toBeTruthy()
  })

  it('exposes the audience-discussion entry only when audience posting is enabled', () => {
    const onDiscussInAudience = vi.fn()
    const { rerender } = render(
      <MemoryRouter>
        <DiscussionForest
          postId="post-1"
          forest={buildForest()}
          selectedNodeId={null}
          audiencePostingEnabled={false}
          onDiscussInAudience={onDiscussInAudience}
        />
      </MemoryRouter>,
    )
    expect(screen.queryAllByTestId('node-discuss-in-audience')).toHaveLength(0)

    rerender(
      <MemoryRouter>
        <DiscussionForest
          postId="post-1"
          forest={buildForest()}
          selectedNodeId={null}
          audiencePostingEnabled
          onDiscussInAudience={onDiscussInAudience}
        />
      </MemoryRouter>,
    )
    const entries = screen.getAllByTestId('node-discuss-in-audience')
    expect(entries.length).toBeGreaterThan(0)
    expect(screen.getAllByText('引用').length).toBeGreaterThan(0)
    fireEvent.click(entries[0]!)
    expect(onDiscussInAudience).toHaveBeenCalled()
  })

  it('renders reply footer modules for votes, discussion, and more actions', () => {
    const forest = buildForest()
    forest.branch_groups[0]!.lifecycle!.writeability!.reply_allowed = true
    forest.branch_groups[0]!.lifecycle!.reply_budget.mode = 'OPEN'
    forest.branch_groups[0]!.lifecycle!.state = 'OPEN'
    forest.branch_groups[0]!.lifecycle!.thread_state = 'OPEN'
    forest.branch_groups[0]!.lifecycle!.active_route = null
    forest.branch_groups[0]!.lifecycle!.writeability!.reply_mode = 'OPEN'
    forest.branch_groups[0]!.lifecycle!.writeability!.preferred_action = 'REPLY_IN_THREAD'
    forest.branch_groups[0]!.lifecycle!.writeability!.reason_code = 'THREAD_OPEN'

    render(
      <MemoryRouter>
        <DiscussionForest
          postId="post-1"
          forest={forest}
          selectedNodeId={null}
          turnReplyEnabled
          audiencePostingEnabled
          onDiscussInAudience={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(screen.getAllByTestId('human-vote-controls').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('agent-sentiment-net').length).toBeGreaterThan(0)
    expect(screen.getAllByText('引用').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('node-more-actions').length).toBeGreaterThan(0)
  })

  it('submits root-thread replies without forging a turn anchor id', async () => {
    mutateAsyncMock.mockResolvedValueOnce({
      data: {
        result: 'ACCEPTED',
      },
    })

    const forest = buildForest()
    forest.branch_groups[0]!.lifecycle!.writeability!.reply_allowed = true
    forest.branch_groups[0]!.lifecycle!.reply_budget.mode = 'OPEN'
    forest.branch_groups[0]!.lifecycle!.state = 'OPEN'
    forest.branch_groups[0]!.lifecycle!.thread_state = 'OPEN'
    forest.branch_groups[0]!.lifecycle!.active_route = null
    forest.branch_groups[0]!.lifecycle!.writeability!.reply_mode = 'OPEN'
    forest.branch_groups[0]!.lifecycle!.writeability!.preferred_action = 'REPLY_IN_THREAD'
    forest.branch_groups[0]!.lifecycle!.writeability!.reason_code = 'THREAD_OPEN'

    render(
      <MemoryRouter>
        <DiscussionForest
          postId="post-1"
          forest={forest}
          selectedNodeId={null}
          turnReplyEnabled
        />
      </MemoryRouter>,
    )

    const rootNode = screen.getByTestId('discussion-forest-tree').querySelector(
      '[data-node-id="thread-route"]',
    ) as HTMLElement | null
    expect(rootNode).toBeTruthy()

    const replyButtons = within(rootNode as HTMLElement).getAllByTestId('node-reply-open')
    fireEvent.click(replyButtons[0]!)
    fireEvent.change(screen.getByTestId('inline-node-reply-textarea'), {
      target: { value: '给根发言的回应' },
    })
    fireEvent.click(screen.getByTestId('inline-node-reply-submit'))

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: 'thread-route',
          postId: 'post-1',
          focused_turn_id: 'thread-route',
          actual_anchor_turn_id: null,
          anchor_turn_id: null,
        }),
      )
    })
  })

  it('activates only the main branch rail when the shared spine hit area is hovered', () => {
    const forest = buildForest()
    forest.branch_groups[0]!.lifecycle!.writeability!.reply_allowed = true
    forest.branch_groups[0]!.lifecycle!.reply_budget.mode = 'OPEN'
    forest.branch_groups[0]!.lifecycle!.state = 'OPEN'
    forest.branch_groups[0]!.lifecycle!.thread_state = 'OPEN'
    forest.branch_groups[0]!.lifecycle!.active_route = null
    forest.branch_groups[0]!.lifecycle!.writeability!.reply_mode = 'OPEN'
    forest.branch_groups[0]!.lifecycle!.writeability!.preferred_action = 'REPLY_IN_THREAD'
    forest.branch_groups[0]!.lifecycle!.writeability!.reason_code = 'THREAD_OPEN'

    render(
      <MemoryRouter>
        <DiscussionForest
          postId="post-1"
          forest={forest}
          selectedNodeId={null}
          turnReplyEnabled
        />
      </MemoryRouter>,
    )

    const rootNode = screen.getByTestId('discussion-forest-tree').querySelector(
      '[data-node-id="thread-route"]',
    ) as HTMLElement | null
    expect(rootNode).toBeTruthy()

    fireEvent.mouseEnter(screen.getByTestId('branch-rail-main-hit-area-thread-route'))

    expect(rootNode?.getAttribute('data-rail-main-hovered')).toBe('true')
    expect(rootNode?.getAttribute('data-rail-branch-hovered')).toBeNull()
  })

  it('activates only the hovered child branch path when the reply avatar is hovered', () => {
    const forest = buildForest()
    forest.branch_groups[0]!.lifecycle!.writeability!.reply_allowed = true
    forest.branch_groups[0]!.lifecycle!.reply_budget.mode = 'OPEN'
    forest.branch_groups[0]!.lifecycle!.state = 'OPEN'
    forest.branch_groups[0]!.lifecycle!.thread_state = 'OPEN'
    forest.branch_groups[0]!.lifecycle!.active_route = null
    forest.branch_groups[0]!.lifecycle!.writeability!.reply_mode = 'OPEN'
    forest.branch_groups[0]!.lifecycle!.writeability!.preferred_action = 'REPLY_IN_THREAD'
    forest.branch_groups[0]!.lifecycle!.writeability!.reason_code = 'THREAD_OPEN'

    render(
      <MemoryRouter>
        <DiscussionForest
          postId="post-1"
          forest={forest}
          selectedNodeId={null}
          turnReplyEnabled
        />
      </MemoryRouter>,
    )

    const treeRootNode = screen.getByTestId('discussion-forest-tree').querySelector(
      '[data-node-id="thread-route"]',
    ) as HTMLElement | null
    expect(treeRootNode).toBeTruthy()
    const branchRootNode = screen.getByTestId('discussion-forest-tree').querySelector(
      '[data-node-id="turn-root"]',
    ) as HTMLElement | null
    expect(branchRootNode).toBeTruthy()

    fireEvent.mouseEnter(screen.getByLabelText('Agent 2'))

    expect(treeRootNode?.getAttribute('data-rail-main-hovered')).toBeNull()
    expect(treeRootNode?.getAttribute('data-rail-branch-hovered')).toBeNull()
    expect(branchRootNode?.getAttribute('data-rail-branch-hovered')).toBe('turn-late')
  })

  it('collapses the branch when the main rail hit area is clicked', () => {
    const forest = buildForest()
    forest.branch_groups[0]!.lifecycle!.writeability!.reply_allowed = true
    forest.branch_groups[0]!.lifecycle!.reply_budget.mode = 'OPEN'
    forest.branch_groups[0]!.lifecycle!.state = 'OPEN'
    forest.branch_groups[0]!.lifecycle!.thread_state = 'OPEN'
    forest.branch_groups[0]!.lifecycle!.active_route = null
    forest.branch_groups[0]!.lifecycle!.writeability!.reply_mode = 'OPEN'
    forest.branch_groups[0]!.lifecycle!.writeability!.preferred_action = 'REPLY_IN_THREAD'
    forest.branch_groups[0]!.lifecycle!.writeability!.reason_code = 'THREAD_OPEN'

    render(
      <MemoryRouter>
        <DiscussionForest
          postId="post-1"
          forest={forest}
          selectedNodeId={null}
          turnReplyEnabled
        />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByTestId('branch-rail-main-hit-area-turn-root'))

    expect(screen.queryByText('稍后重新贴回旧点')).toBeNull()
    expect(screen.getByLabelText('展开子节点')).toBeTruthy()
  })

  it('toggles the more-menu label between locate and clear locate based on current selection', () => {
    const onToggleNodeSelection = vi.fn()

    render(
      <MemoryRouter>
        <DiscussionForest
          postId="post-1"
          forest={buildForest()}
          selectedNodeId="turn-root"
          onToggleNodeSelection={onToggleNodeSelection}
        />
      </MemoryRouter>,
    )

    const moreActions = screen.getAllByTestId('node-more-actions')
    fireEvent.click(moreActions[0]!)
    const clearItem = screen.getByText('取消定位')
    expect(clearItem).toBeTruthy()
    fireEvent.click(clearItem)
    expect(onToggleNodeSelection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'turn-root' }),
    )
  })

  it('hides the inline reply button on all nodes when turnReplyEnabled is false', () => {
    const forest = buildForest()
    forest.branch_groups[0]!.lifecycle!.writeability!.reply_allowed = true

    render(
      <MemoryRouter>
        <DiscussionForest
          postId="post-1"
          forest={forest}
          selectedNodeId={null}
          turnReplyEnabled={false}
        />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('button', { name: '回复' })).toBeNull()
  })

  it('renders a transient flash highlight that fades after a deep-link jump', () => {
    vi.useFakeTimers()
    try {
      render(
        <MemoryRouter>
          <DiscussionForest
            postId="post-1"
            forest={buildForest()}
            flashNodeId="thread-route"
            flashToken={1}
          />
        </MemoryRouter>,
      )

      const rootNode = screen.getByTestId('discussion-forest-tree').querySelector(
        '[data-node-id="thread-route"]',
      ) as HTMLElement | null
      expect(rootNode?.getAttribute('data-flash-state')).toBe('active')

      act(() => {
        vi.advanceTimersByTime(1400)
      })
      expect(rootNode?.getAttribute('data-flash-state')).toBe('fading')

      act(() => {
        vi.advanceTimersByTime(700)
      })
      expect(rootNode?.getAttribute('data-flash-state')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
