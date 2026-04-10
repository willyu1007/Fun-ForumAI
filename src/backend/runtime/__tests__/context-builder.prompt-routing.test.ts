import { describe, expect, it, vi } from 'vitest'
import { buildAgentTarget } from '../../../shared/agent-target.js'
import { ContextBuilder } from '../context-builder.js'
import type { ExecutionContext } from '../types.js'
import type { ContextBuilderDeps } from '../context-builder.js'
import { config } from '../../lib/config.js'

function buildBaseContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    event: {
      event_id: 'evt-1',
      event_type: 'NewPostCreated',
      idempotency_key: 'idem-1',
      chain_depth: 0,
      community_id: 'community-1',
      author_agent_id: 'agent-1',
      created_at: new Date().toISOString(),
    },
    agent: {
      agent_id: 'agent-1',
      score: 1,
      priority: 1,
    },
    persona: {
      name: 'Layer Bot',
      style: '中立',
      interests: ['AI'],
      language: 'zh-CN',
    },
    community: {
      id: 'community-1',
      name: '社区',
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
    ...overrides,
  }
}

describe('ContextBuilder prompt routing', () => {
  it('builds chat runtime context for NewMessageCreated when chat deps are available', async () => {
    const chatService = {
      getRoom: vi.fn(async () => ({
        id: 'room-1',
        name: '测试房间',
        description: '围绕 runtime 和图片链路继续接话',
        members: [],
      })),
      getMessages: vi.fn(async () => ({
        items: [
          {
            id: 'msg-1',
            author_id: 'agent-2',
            body: '上一句已经把梗抛出来了。',
          },
        ],
        next_cursor: null,
      })),
    }
    const chatroomRuntimeContextBuilder = {
      build: vi.fn(async () => ({
        chatContext: {
          room_name: '测试房间',
          room_description: '围绕 runtime 和图片链路继续接话',
          recent_messages: [
            { author_name: 'Agent Two', body: '上一句已经把梗抛出来了。', is_self: false, message_kind: 'normal' },
          ],
        },
        promptVariables: {
          program_scene: 'FREE_CHAT',
          current_beat: 'CALLBACK',
          live_hook: '继续把这个梗接住。',
          unresolved_question: '怎么把图也接进来？',
          local_intent_block: '## Local Intent\n- initiative: reply',
          room_public_context_summary: '上一轮已经形成了共同语境。',
          role_hint: 'FOIL',
        },
      })),
    }

    const builder = new ContextBuilder({
      forumReadService: {
        getCommunities: vi.fn(async () => ({
          items: [{
            id: 'community-1',
            name: '社区',
            description: '',
            rules_json: null,
          }],
        })),
      } as unknown as ContextBuilderDeps['forumReadService'],
      agentService: {
        getAgent: vi.fn(() => ({ display_name: 'Layer Bot' })),
        getLatestConfig: vi.fn(() => null),
      } as unknown as ContextBuilderDeps['agentService'],
      chatService: chatService as unknown as ContextBuilderDeps['chatService'],
      chatroomRuntimeContextBuilder:
        chatroomRuntimeContextBuilder as unknown as ContextBuilderDeps['chatroomRuntimeContextBuilder'],
    })

    const ctx = await builder.build(
      {
        event_id: 'evt-chat-1',
        event_type: 'NewMessageCreated',
        idempotency_key: 'idem-chat-1',
        chain_depth: 0,
        community_id: 'community-1',
        room_id: 'room-1',
        author_agent_id: 'agent-2',
        created_at: new Date().toISOString(),
      },
      {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
    )

    expect(chatService.getRoom).toHaveBeenCalledWith('room-1')
    expect(chatService.getMessages).toHaveBeenCalledWith('room-1', { limit: 10 })
    expect(chatroomRuntimeContextBuilder.build).toHaveBeenCalledTimes(1)
    expect(ctx.chatContext?.room_name).toBe('测试房间')
    expect(ctx.chat_prompt_variables?.local_intent_block).toContain('initiative: reply')
  })

  it('uses PromptOrchestrator when it is available', async () => {
    const compose = vi.fn(async () => ({
      persona: {
        name: 'Orchestrated Bot',
        style: '直接',
        interests: ['prompt'],
        language: 'zh-CN',
      },
      blocks: {
        hard_control_block: 'hard',
        compact_control_block: 'compact',
        current_context_block: 'context',
        memory_block: 'memory',
        soft_expression_block: 'soft',
      },
      audit: {
        version: 'v2',
        scene: 'chat_room' as const,
        includedBlockIds: ['hard_control_block', 'current_context_block'],
        promptContract: 'compiled_blocks_v2',
        tokenEstimates: { hard_control_block: 1, current_context_block: 1 },
        lintWarnings: [],
        trimReasons: [],
      },
      runtimeEnvelope: null,
    }))

    const builder = new ContextBuilder({
      forumReadService: {} as unknown as ContextBuilderDeps['forumReadService'],
      agentService: {} as unknown as ContextBuilderDeps['agentService'],
      promptOrchestrator: {
        isSceneEnabled: vi.fn(() => true),
        compose,
      } as unknown as ContextBuilderDeps['promptOrchestrator'],
    })

    const ctx = buildBaseContext({
      chatContext: {
        room_name: '测试房间',
        room_description: '',
        recent_messages: [
          { author_name: 'A', body: '你好', is_self: false, message_kind: 'normal' },
          { author_name: 'B', body: '我不同意！！', is_self: false, message_kind: 'normal' },
        ],
      },
      post: undefined,
    })

    const result = await builder.enrichWithLayers(ctx)

    expect(compose).toHaveBeenCalledTimes(1)
    expect(result.persona.name).toBe('Orchestrated Bot')
    expect(result.blocks).toEqual({
      hard_control_block: 'hard',
      compact_control_block: 'compact',
      current_context_block: 'context',
      memory_block: 'memory',
      soft_expression_block: 'soft',
    })
  })

  it('prefers forum_runtime_context over raw thread excerpts when envelope cutover is enabled', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalEnvelopeCutover = featureFlags.forumOrchestrationEnvelopeCutover
    featureFlags.forumOrchestrationEnvelopeCutover = true

    const compose = vi.fn(async () => ({
      persona: {
        name: 'Orchestrated Bot',
        style: '直接',
        interests: ['prompt'],
        language: 'zh-CN',
      },
      blocks: {
        hard_control_block: 'hard',
        compact_control_block: 'compact',
        current_context_block: 'context',
        memory_block: 'memory',
        soft_expression_block: 'soft',
      },
      audit: {
        version: 'v2',
        scene: 'forum_thread' as const,
        includedBlockIds: ['current_context_block'],
        promptContract: 'compiled_blocks_v2',
        tokenEstimates: { current_context_block: 1 },
        lintWarnings: [],
        trimReasons: [],
      },
      runtimeEnvelope: null,
    }))

    try {
      const builder = new ContextBuilder({
        forumReadService: {} as unknown as ContextBuilderDeps['forumReadService'],
        agentService: {} as unknown as ContextBuilderDeps['agentService'],
        promptOrchestrator: {
          isSceneEnabled: vi.fn(() => true),
          compose,
        } as unknown as ContextBuilderDeps['promptOrchestrator'],
      })

      await builder.enrichWithLayers(buildBaseContext({
        focusThreadTurn: {
          id: 'turn-1',
          post_id: 'post-1',
          thread_id: 'thread-1',
          entry_kind: 'TURN',
          anchor_turn_id: null,
          body: '最新回复',
          author_agent_id: 'agent-2',
          author_name: 'Other Bot',
        },
        threadTurns: [
          {
            id: 'thread-1',
            post_id: 'post-1',
            thread_id: 'thread-1',
            entry_kind: 'THREAD',
            anchor_turn_id: null,
            body: 'Thread root',
            author_agent_id: 'agent-2',
            author_name: 'Other Bot',
          },
        ],
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
          post_situation: {
            flow_phase: 'ESCALATION',
            premise: 'Premise',
            current_tension: 'Tension',
            open_questions: ['Q1'],
            start_here_thread_ids: ['thread-1'],
            must_read_turn_ids: ['turn-1'],
          },
          focus_thread: {
            thread_id: 'thread-1',
            role: 'COUNTERPOINT',
            summary: 'Thread summary',
            unresolved_points: ['Q1'],
            thread_state: 'HEATING',
            active_route: null,
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
                last_evaluated_at: new Date().toISOString(),
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
              updated_at: new Date().toISOString(),
            },
            salient_turn_ids: ['turn-1'],
          },
          evidence_window: {
            anchor_turn_id: 'turn-1',
            window_strategy: 'AROUND_ANCHOR',
            turns: [],
          },
          memory_refs: [],
          built_at: new Date().toISOString(),
          post_capsule: null as never,
          thread_capsule: null,
          perceived_slice: null,
        },
        forum_targeting: {
          event_target_entry_id: 'turn-2',
          event_target_thread_id: 'thread-1',
          focus_turn_id: 'turn-1',
          selected_anchor_turn_id: 'turn-1',
          actual_anchor_turn_id: 'turn-1',
          final_write_anchor_turn_id: 'turn-1',
          reply_thread_id: 'thread-1',
          browse_reason: 'REVIVE',
          allowed_actions: ['REPLY', 'IGNORE'],
        },
      }))

      const firstComposeCall = vi.mocked(compose).mock.calls.at(0) as unknown as Array<{
        currentContextSources?: Array<{ kind: string; text?: string }>
      }> | undefined
      const currentContextSources = firstComposeCall?.[0]?.currentContextSources ?? []
      expect(currentContextSources.some((source: { kind: string }) => source.kind === 'forum_runtime_context')).toBe(true)
      expect(currentContextSources.some((source: { kind: string }) => source.kind === 'thread_excerpt')).toBe(false)
      expect(currentContextSources.some((source: { kind: string; text?: string }) =>
        source.kind === 'forum_runtime_context'
        && (source.text ?? '').includes('browse_reason=REVIVE')
        && (source.text ?? '').includes('final_write_anchor=turn-1')
        && (source.text ?? '').includes('allowed_actions=REPLY|IGNORE'))).toBe(true)
    } finally {
      featureFlags.forumOrchestrationEnvelopeCutover = originalEnvelopeCutover
    }
  })

  it('loads only the target thread capsule for ThreadTurnAdded and records thread state metadata', async () => {
    const getThread = vi.fn(async () => ({
      id: 'thread-1',
      post_id: 'post-1',
      community_id: 'community-1',
      author_agent_id: 'agent-2',
      body: 'Thread root',
      visibility: 'PUBLIC',
      state: 'APPROVED',
      thread_state: 'PEAKED',
      reply_budget: 6,
      active_route: {
        route_type: 'AFTERSHOW',
        route_state: 'SUGGESTED',
        reason_code: 'THREAD_NEAR_BUDGET_LIMIT',
        handoff_label: '接近峰值，准备收口。',
        handoff_payload: null,
        cta: { label: '查看 Aftershow', target: '/posts/post-1#aftershow-panel' },
      },
      created_at: new Date('2026-03-01T00:00:00.000Z'),
      updated_at: new Date('2026-03-01T00:00:00.000Z'),
      author: {
        id: 'agent-2',
        display_name: 'Other Bot',
        avatar_url: null,
      },
      vote_score: 0,
      agent_vote_score: 0,
      agent_vote_up: 0,
      agent_vote_down: 0,
      human_vote_score: 0,
      human_vote_up: 0,
      human_vote_down: 0,
      weighted_vote_score: 0,
      viewer_human_vote_direction: null,
      ai_label: 'AI生成',
      effective_moderation_label: 'PUBLIC',
      topic_signals: null,
      distribution_state: 'NORMAL',
      attachments: [],
      turn_count: 2,
      participant_count: 2,
      last_activity_at: new Date('2026-03-01T00:02:00.000Z'),
      turns: [
        {
          id: 'turn-1',
          thread_id: 'thread-1',
          post_id: 'post-1',
          author_agent_id: 'agent-3',
          turn_index: 1,
          anchor_turn_id: null,
          anchor_intent: null,
          quoted_excerpt: null,
          body: 'Turn one',
          visibility: 'PUBLIC',
          state: 'APPROVED',
          created_at: new Date('2026-03-01T00:01:00.000Z'),
          updated_at: new Date('2026-03-01T00:01:00.000Z'),
          author: { id: 'agent-3', display_name: 'Turn One', avatar_url: null },
          vote_score: 0,
          agent_vote_score: 0,
          agent_vote_up: 0,
          agent_vote_down: 0,
          human_vote_score: 0,
          human_vote_up: 0,
          human_vote_down: 0,
          weighted_vote_score: 0,
          viewer_human_vote_direction: null,
          ai_label: 'AI生成',
          effective_moderation_label: 'PUBLIC',
          topic_signals: null,
          distribution_state: 'NORMAL',
          attachments: [],
          anchor_preview: null,
        },
        {
          id: 'turn-2',
          thread_id: 'thread-1',
          post_id: 'post-1',
          author_agent_id: 'agent-4',
          turn_index: 2,
          anchor_turn_id: 'turn-1',
          anchor_intent: null,
          quoted_excerpt: null,
          body: 'Turn two',
          visibility: 'PUBLIC',
          state: 'APPROVED',
          created_at: new Date('2026-03-01T00:02:00.000Z'),
          updated_at: new Date('2026-03-01T00:02:00.000Z'),
          author: { id: 'agent-4', display_name: 'Turn Two', avatar_url: null },
          vote_score: 0,
          agent_vote_score: 0,
          agent_vote_up: 0,
          agent_vote_down: 0,
          human_vote_score: 0,
          human_vote_up: 0,
          human_vote_down: 0,
          weighted_vote_score: 0,
          viewer_human_vote_direction: null,
          ai_label: 'AI生成',
          effective_moderation_label: 'PUBLIC',
          topic_signals: null,
          distribution_state: 'NORMAL',
          attachments: [],
          anchor_preview: null,
        },
      ],
    }))
    const getThreads = vi.fn(async () => ({
      items: [],
      next_cursor: null,
    }))

    const builder = new ContextBuilder({
      forumReadService: {
        getCommunities: vi.fn(async () => ({
          items: [{
            id: 'community-1',
            name: '社区',
            description: '',
            rules_json: null,
          }],
        })),
        getPost: vi.fn(async () => ({
          id: 'post-1',
          title: '帖子标题',
          body: '帖子正文',
          author_agent_id: 'agent-2',
          author: { id: 'agent-2', display_name: 'Other Bot', avatar_url: null },
        })),
        getThread,
        getThreads,
      } as unknown as ContextBuilderDeps['forumReadService'],
      agentService: {
        getAgent: vi.fn(() => ({ display_name: 'Layer Bot' })),
        getLatestConfig: vi.fn(() => null),
      } as unknown as ContextBuilderDeps['agentService'],
    })

    const ctx = await builder.build(
      {
        event_id: 'evt-thread-1',
        event_type: 'ThreadTurnAdded',
        idempotency_key: 'idem-thread-1',
        chain_depth: 1,
        community_id: 'community-1',
        post_id: 'post-1',
        thread_id: 'thread-1',
        turn_id: 'turn-2',
        author_agent_id: 'agent-4',
        created_at: new Date().toISOString(),
      },
      {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
    )

    expect(getThread).toHaveBeenCalledWith('thread-1')
    expect(getThreads).not.toHaveBeenCalled()
    expect(ctx.threadMeta).toEqual({
      thread_id: 'thread-1',
      thread_state: 'HANDOFF_PENDING',
      reply_budget: 6,
      reply_budget_remaining: 4,
      active_route: {
        route_type: 'AFTERSHOW',
        route_state: 'SUGGESTED',
      },
      writeability: {
        schema_version: 'forum-thread-writeability.v1',
        thread_id: 'thread-1',
        reply_mode: 'SOFT_CLOSE',
        reply_allowed: true,
        preferred_action: 'FOLLOW_ROUTE',
        reason_code: 'THREAD_HANDOFF_PENDING',
      },
    })
    expect(ctx.threadTurns?.map((item) => item.id)).toEqual(['thread-1', 'turn-1', 'turn-2'])
    expect(ctx.focusThreadTurn?.id).toBe('turn-2')
  })

  it('does not convert thread-root ids or human user ids into write anchors / agent ids', async () => {
    const resolve = vi.fn(async () => null)
    const builder = new ContextBuilder({
      forumReadService: {
        getCommunities: vi.fn(async () => ({
          items: [{
            id: 'community-1',
            name: '社区',
            description: '',
            rules_json: null,
          }],
        })),
        getPost: vi.fn(async () => ({
          id: 'post-1',
          community_id: 'community-1',
          author_agent_id: 'agent-post',
          title: '帖子标题',
          body: '帖子正文',
          tags: [],
          visibility: 'PUBLIC',
          state: 'APPROVED',
          moderation_metadata: null,
          created_at: new Date('2026-04-10T00:00:00.000Z'),
          updated_at: new Date('2026-04-10T00:00:00.000Z'),
        })),
        getThread: vi.fn(async () => ({
          id: 'thread-1',
          post_id: 'post-1',
          community_id: 'community-1',
          author_actor_type: 'human' as const,
          author_agent_id: null,
          author_user_id: 'user-1',
          body: '这是用户开的公开分支。',
          visibility: 'PUBLIC' as const,
          state: 'APPROVED' as const,
          thread_state: 'OPEN' as const,
          reply_budget: 6,
          active_route: null,
          created_at: new Date('2026-04-10T00:00:00.000Z'),
          updated_at: new Date('2026-04-10T00:00:00.000Z'),
          author: {
            id: 'user-1',
            actor_type: 'human' as const,
            display_name: '开发用户',
            avatar_url: null,
          },
          vote_score: 0,
          agent_vote_score: 0,
          agent_vote_up: 0,
          agent_vote_down: 0,
          human_vote_score: 0,
          human_vote_up: 0,
          human_vote_down: 0,
          weighted_vote_score: 0,
          viewer_human_vote_direction: null,
          ai_label: '用户',
          effective_moderation_label: 'PUBLIC',
          topic_signals: null,
          distribution_state: 'NORMAL',
          attachments: [],
          turn_count: 0,
          participant_count: 1,
          last_activity_at: new Date('2026-04-10T00:00:00.000Z'),
          turns: [],
          lifecycle: {
            schema_version: 'forum-thread-lifecycle.v1',
            thread_id: 'thread-1',
            state: 'OPEN' as const,
            thread_state: 'OPEN' as const,
            reply_budget: {
              schema_version: 'forum-reply-budget.v1',
              thread_id: 'thread-1',
              limit: 6,
              used: 0,
              remaining: 6,
              exhausted: false,
              mode: 'SOFT_CAP' as const,
              soft_cap_turns: 6,
              hard_cap_turns: null,
              remaining_turns: 6,
              cooldown_seconds: null,
              late_entry_reserved_slots: 1,
              revive_reserved_slots: 1,
              same_pair_cap: 2,
              last_evaluated_at: new Date('2026-04-10T00:00:00.000Z').toISOString(),
            },
            active_route: null,
            writeability: {
              schema_version: 'forum-thread-writeability.v1',
              thread_id: 'thread-1',
              reply_mode: 'OPEN' as const,
              reply_allowed: true,
              preferred_action: 'REPLY_IN_THREAD' as const,
              reason_code: 'THREAD_OPEN' as const,
            },
            lifecycle_label: 'ACTIVE',
            updated_at: new Date('2026-04-10T00:00:00.000Z').toISOString(),
          },
        })),
      } as unknown as ContextBuilderDeps['forumReadService'],
      agentService: {
        getAgent: vi.fn(() => ({ display_name: 'Layer Bot' })),
        getLatestConfig: vi.fn(() => null),
      } as unknown as ContextBuilderDeps['agentService'],
      forumSceneContinuityService: {
        resolve,
      } as unknown as ContextBuilderDeps['forumSceneContinuityService'],
    })

    const built = await builder.build(
      {
        event_id: 'evt-thread-root-human',
        event_type: 'ThreadOpened',
        idempotency_key: 'idem-thread-root-human',
        chain_depth: 0,
        community_id: 'community-1',
        post_id: 'post-1',
        thread_id: 'thread-1',
        author_actor_type: 'human',
        author_user_id: 'user-1',
        created_at: new Date('2026-04-10T00:00:00.000Z').toISOString(),
      },
      {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
    )

    expect(built.focusThreadTurn).toMatchObject({
      id: 'thread-1',
      entry_kind: 'THREAD',
      author_actor_type: 'human',
      author_agent_id: null,
      author_user_id: 'user-1',
    })
    expect(built.forum_targeting).toMatchObject({
      event_target_entry_id: 'thread-1',
      event_target_thread_id: 'thread-1',
      focus_turn_id: 'thread-1',
      selected_anchor_turn_id: null,
      actual_anchor_turn_id: null,
      final_write_anchor_turn_id: null,
      reply_thread_id: 'thread-1',
    })
    expect(resolve).toHaveBeenCalledWith(expect.objectContaining({
      target_thread_author_agent_id: undefined,
      target_turn_author_agent_id: undefined,
    }))
  })

  it('keeps forum thread followup open when a closed raw thread still resolves to handoff-pending soft-close', async () => {
    const getThread = vi.fn(async () => ({
      id: 'thread-closed',
      post_id: 'post-1',
      community_id: 'community-1',
      author_agent_id: 'agent-2',
      body: 'Closed thread root',
      visibility: 'PUBLIC',
      state: 'APPROVED',
      thread_state: 'CLOSED',
      reply_budget: 3,
      active_route: {
        route_type: 'PRIVATE',
        route_state: 'READY',
        reason_code: 'PRIVATE_HANDOFF_REQUIRED',
        handoff_label: '转入私聊。',
        handoff_payload: null,
        cta: {
          label: '转入私聊',
          target: buildAgentTarget({
            agentId: 'agent-2',
            mode: 'readonly',
            tab: 'chat',
          }),
        },
      },
      created_at: new Date('2026-03-01T00:00:00.000Z'),
      updated_at: new Date('2026-03-01T00:00:00.000Z'),
      author: {
        id: 'agent-2',
        display_name: 'Other Bot',
        avatar_url: null,
      },
      vote_score: 0,
      agent_vote_score: 0,
      agent_vote_up: 0,
      agent_vote_down: 0,
      human_vote_score: 0,
      human_vote_up: 0,
      human_vote_down: 0,
      weighted_vote_score: 0,
      viewer_human_vote_direction: null,
      ai_label: 'AI生成',
      effective_moderation_label: 'PUBLIC',
      topic_signals: null,
      distribution_state: 'NORMAL',
      attachments: [],
      turn_count: 3,
      participant_count: 2,
      last_activity_at: new Date('2026-03-01T00:03:00.000Z'),
      turns: [
        {
          id: 'turn-3',
          thread_id: 'thread-closed',
          post_id: 'post-1',
          author_agent_id: 'agent-4',
          turn_index: 3,
          anchor_turn_id: 'turn-2',
          anchor_intent: null,
          quoted_excerpt: null,
          body: 'Closing turn',
          visibility: 'PUBLIC',
          state: 'APPROVED',
          created_at: new Date('2026-03-01T00:03:00.000Z'),
          updated_at: new Date('2026-03-01T00:03:00.000Z'),
          author: { id: 'agent-4', display_name: 'Turn Three', avatar_url: null },
          vote_score: 0,
          agent_vote_score: 0,
          agent_vote_up: 0,
          agent_vote_down: 0,
          human_vote_score: 0,
          human_vote_up: 0,
          human_vote_down: 0,
          weighted_vote_score: 0,
          viewer_human_vote_direction: null,
          ai_label: 'AI生成',
          effective_moderation_label: 'PUBLIC',
          topic_signals: null,
          distribution_state: 'NORMAL',
          attachments: [],
          anchor_preview: null,
        },
      ],
    }))
    const continuityResolve = vi.fn()

    const builder = new ContextBuilder({
      forumReadService: {
        getCommunities: vi.fn(async () => ({
          items: [{
            id: 'community-1',
            name: '社区',
            description: '',
            rules_json: null,
          }],
        })),
        getPost: vi.fn(async () => ({
          id: 'post-1',
          title: '帖子标题',
          body: '帖子正文',
          author_agent_id: 'agent-2',
          author: { id: 'agent-2', display_name: 'Other Bot', avatar_url: null },
        })),
        getThread,
        getThreads: vi.fn(async () => ({
          items: [],
          next_cursor: null,
        })),
      } as unknown as ContextBuilderDeps['forumReadService'],
      agentService: {
        getAgent: vi.fn(() => ({ display_name: 'Layer Bot' })),
        getLatestConfig: vi.fn(() => null),
      } as unknown as ContextBuilderDeps['agentService'],
      forumSceneContinuityService: {
        resolve: continuityResolve,
      } as unknown as ContextBuilderDeps['forumSceneContinuityService'],
    })

    const ctx = await builder.build(
      {
        event_id: 'evt-thread-closed',
        event_type: 'ThreadTurnAdded',
        idempotency_key: 'idem-thread-closed',
        chain_depth: 2,
        community_id: 'community-1',
        post_id: 'post-1',
        thread_id: 'thread-closed',
        turn_id: 'turn-3',
        author_agent_id: 'agent-4',
        created_at: new Date().toISOString(),
      },
      {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
    )

    expect(getThread).toHaveBeenCalledWith('thread-closed')
    expect(ctx.skip_reason).toBeUndefined()
    expect(ctx.threadMeta).toEqual({
      thread_id: 'thread-closed',
      thread_state: 'HANDOFF_PENDING',
      reply_budget: 3,
      reply_budget_remaining: 0,
      active_route: {
        route_type: 'PRIVATE',
        route_state: 'READY',
      },
      writeability: {
        schema_version: 'forum-thread-writeability.v1',
        thread_id: 'thread-closed',
        reply_mode: 'SOFT_CLOSE',
        reply_allowed: true,
        preferred_action: 'FOLLOW_ROUTE',
        reason_code: 'THREAD_HANDOFF_PENDING',
      },
    })
    expect(continuityResolve).toHaveBeenCalledTimes(1)
  })

  it('still skips forum thread followup when the resolved lifecycle is truly closed', async () => {
    const getThread = vi.fn(async () => ({
      id: 'thread-closed-hard',
      post_id: 'post-1',
      community_id: 'community-1',
      author_agent_id: 'agent-2',
      body: 'Closed thread root',
      visibility: 'PUBLIC',
      state: 'APPROVED',
      thread_state: 'CLOSED',
      reply_budget: 3,
      active_route: null,
      created_at: new Date('2026-03-01T00:00:00.000Z'),
      updated_at: new Date('2026-03-01T00:00:00.000Z'),
      author: {
        id: 'agent-2',
        display_name: 'Other Bot',
        avatar_url: null,
      },
      vote_score: 0,
      agent_vote_score: 0,
      agent_vote_up: 0,
      agent_vote_down: 0,
      human_vote_score: 0,
      human_vote_up: 0,
      human_vote_down: 0,
      weighted_vote_score: 0,
      viewer_human_vote_direction: null,
      ai_label: 'AI生成',
      effective_moderation_label: 'PUBLIC',
      topic_signals: null,
      distribution_state: 'NORMAL',
      attachments: [],
      turn_count: 3,
      participant_count: 2,
      last_activity_at: new Date('2026-03-01T00:03:00.000Z'),
      turns: [],
    }))
    const continuityResolve = vi.fn()

    const builder = new ContextBuilder({
      forumReadService: {
        getCommunities: vi.fn(async () => ({
          items: [{
            id: 'community-1',
            name: '社区',
            description: '',
            rules_json: null,
          }],
        })),
        getPost: vi.fn(async () => ({
          id: 'post-1',
          title: '帖子标题',
          body: '帖子正文',
          author_agent_id: 'agent-2',
          author: { id: 'agent-2', display_name: 'Other Bot', avatar_url: null },
        })),
        getThread,
        getThreads: vi.fn(async () => ({
          items: [],
          next_cursor: null,
        })),
      } as unknown as ContextBuilderDeps['forumReadService'],
      agentService: {
        getAgent: vi.fn(() => ({ display_name: 'Layer Bot' })),
        getLatestConfig: vi.fn(() => null),
      } as unknown as ContextBuilderDeps['agentService'],
      forumSceneContinuityService: {
        resolve: continuityResolve,
      } as unknown as ContextBuilderDeps['forumSceneContinuityService'],
    })

    const ctx = await builder.build(
      {
        event_id: 'evt-thread-closed-hard',
        event_type: 'ThreadTurnAdded',
        idempotency_key: 'idem-thread-closed-hard',
        chain_depth: 2,
        community_id: 'community-1',
        post_id: 'post-1',
        thread_id: 'thread-closed-hard',
        turn_id: 'turn-3',
        author_agent_id: 'agent-4',
        created_at: new Date().toISOString(),
      },
      {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
    )

    expect(getThread).toHaveBeenCalledWith('thread-closed-hard')
    expect(ctx.skip_reason).toBe('thread_closed_no_followup')
    expect(continuityResolve).not.toHaveBeenCalled()
  })

  it('hydrates forum semantic context from the runtime preview envelope and filters thread turns by visible nodes', async () => {
    const buildRuntimeContextPreview = vi.fn(async () => ({
      post_capsule: {
        post_id: 'post-1',
        schema_version: 'post-semantic-capsule.v1',
      },
      thread_capsule: {
        thread_id: 'thread-1',
        schema_version: 'thread-capsule.v1',
      },
      perceived_slice: {
        schema_version: 'perceived-context-slice.v1',
        post_id: 'post-1',
        thread_id: 'thread-1',
        focus_turn_id: 'turn-2',
        actual_anchor_turn_id: 'turn-1',
        visible_node_ids: ['thread-1', 'turn-2'],
        evidence_window_ids: ['turn-2'],
        reason_codes: ['topic_match'],
        post_capsule_excerpt: 'post tension',
        branch_capsule_excerpt: 'thread summary',
        slice_id: 'slice-1',
        built_at: '2026-04-07T10:00:00.000Z',
      },
      runtime_context: {
        schema_version: 'runtime-context-envelope.v1',
        post_id: 'post-1',
        thread_id: 'thread-1',
      },
    }))

    const builder = new ContextBuilder({
      forumReadService: {
        getCommunities: vi.fn(async () => ({
          items: [{
            id: 'community-1',
            name: '社区',
            description: '',
            rules_json: null,
          }],
        })),
        getPost: vi.fn(async () => ({
          id: 'post-1',
          title: '帖子标题',
          body: '帖子正文',
          author_agent_id: 'agent-2',
          author: { id: 'agent-2', display_name: 'Other Bot', avatar_url: null },
        })),
        getThread: vi.fn(async () => ({
          id: 'thread-1',
          post_id: 'post-1',
          community_id: 'community-1',
          author_agent_id: 'agent-2',
          body: 'Thread root',
          visibility: 'PUBLIC',
          state: 'APPROVED',
          thread_state: 'PEAKED',
          reply_budget: 6,
          active_route: null,
          created_at: new Date('2026-03-01T00:00:00.000Z'),
          updated_at: new Date('2026-03-01T00:00:00.000Z'),
          author: {
            id: 'agent-2',
            display_name: 'Other Bot',
            avatar_url: null,
          },
          vote_score: 0,
          agent_vote_score: 0,
          agent_vote_up: 0,
          agent_vote_down: 0,
          human_vote_score: 0,
          human_vote_up: 0,
          human_vote_down: 0,
          weighted_vote_score: 0,
          viewer_human_vote_direction: null,
          ai_label: 'AI生成',
          effective_moderation_label: 'PUBLIC',
          topic_signals: null,
          distribution_state: 'NORMAL',
          attachments: [],
          turn_count: 2,
          participant_count: 2,
          last_activity_at: new Date('2026-03-01T00:02:00.000Z'),
          turns: [
            {
              id: 'turn-1',
              thread_id: 'thread-1',
              post_id: 'post-1',
              author_agent_id: 'agent-3',
              turn_index: 1,
              anchor_turn_id: null,
              anchor_intent: null,
              quoted_excerpt: null,
              body: 'Turn one',
              visibility: 'PUBLIC',
              state: 'APPROVED',
              created_at: new Date('2026-03-01T00:01:00.000Z'),
              updated_at: new Date('2026-03-01T00:01:00.000Z'),
              author: { id: 'agent-3', display_name: 'Turn One', avatar_url: null },
              vote_score: 0,
              agent_vote_score: 0,
              agent_vote_up: 0,
              agent_vote_down: 0,
              human_vote_score: 0,
              human_vote_up: 0,
              human_vote_down: 0,
              weighted_vote_score: 0,
              viewer_human_vote_direction: null,
              ai_label: 'AI生成',
              effective_moderation_label: 'PUBLIC',
              topic_signals: null,
              distribution_state: 'NORMAL',
              attachments: [],
              anchor_preview: null,
            },
            {
              id: 'turn-2',
              thread_id: 'thread-1',
              post_id: 'post-1',
              author_agent_id: 'agent-4',
              turn_index: 2,
              anchor_turn_id: 'turn-1',
              anchor_intent: null,
              quoted_excerpt: null,
              body: 'Turn two',
              visibility: 'PUBLIC',
              state: 'APPROVED',
              created_at: new Date('2026-03-01T00:02:00.000Z'),
              updated_at: new Date('2026-03-01T00:02:00.000Z'),
              author: { id: 'agent-4', display_name: 'Turn Two', avatar_url: null },
              vote_score: 0,
              agent_vote_score: 0,
              agent_vote_up: 0,
              agent_vote_down: 0,
              human_vote_score: 0,
              human_vote_up: 0,
              human_vote_down: 0,
              weighted_vote_score: 0,
              viewer_human_vote_direction: null,
              ai_label: 'AI生成',
              effective_moderation_label: 'PUBLIC',
              topic_signals: null,
              distribution_state: 'NORMAL',
              attachments: [],
              anchor_preview: null,
            },
          ],
        })),
        getThreadLifecycle: vi.fn(async () => ({
          thread_id: 'thread-1',
          thread_state: 'PEAKED',
          reply_budget: {
            hard_cap_turns: 6,
            remaining_turns: 4,
            limit: 6,
            remaining: 4,
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
        })),
        buildRuntimeContextPreview,
      } as unknown as ContextBuilderDeps['forumReadService'],
      agentService: {
        getAgent: vi.fn(() => ({ display_name: 'Layer Bot' })),
        getLatestConfig: vi.fn(() => null),
      } as unknown as ContextBuilderDeps['agentService'],
    })

    const ctx = await builder.build(
      {
        event_id: 'evt-runtime-preview-1',
        event_type: 'ThreadTurnAdded',
        idempotency_key: 'idem-runtime-preview-1',
        chain_depth: 1,
        community_id: 'community-1',
        post_id: 'post-1',
        thread_id: 'thread-1',
        turn_id: 'turn-2',
        author_agent_id: 'agent-4',
        created_at: new Date().toISOString(),
      },
      {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
    )

    expect(buildRuntimeContextPreview).toHaveBeenCalledWith({
      agent_id: 'agent-1',
      post_id: 'post-1',
      thread_id: 'thread-1',
      focus_turn_id: 'turn-2',
    })
    expect(ctx.semantic_post_capsule).toMatchObject({ post_id: 'post-1' })
    expect(ctx.semantic_thread_capsule).toMatchObject({ thread_id: 'thread-1' })
    expect(ctx.perceived_context_slice).toMatchObject({ focus_turn_id: 'turn-2' })
    expect(ctx.forum_runtime_context).toMatchObject({ thread_id: 'thread-1' })
    expect(ctx.focusThreadTurn?.id).toBe('turn-2')
    expect(ctx.forum_targeting).toMatchObject({
      event_target_entry_id: 'turn-2',
      event_target_thread_id: 'thread-1',
      focus_turn_id: 'turn-2',
      actual_anchor_turn_id: 'turn-1',
      final_write_anchor_turn_id: 'turn-1',
      reply_thread_id: 'thread-1',
    })
    expect(ctx.threadTurns?.map((item) => item.id)).toEqual(['thread-1', 'turn-2'])
  })

  it('keeps event target separate from perceived focus and routes prompt inputs through the focus entry', async () => {
    const compose = vi.fn(async () => ({
      persona: {
        name: 'Focused Bot',
        style: '直接',
        interests: ['prompt'],
        language: 'zh-CN',
      },
      blocks: {
        hard_control_block: 'hard',
        compact_control_block: 'compact',
        current_context_block: 'context',
        memory_block: 'memory',
        soft_expression_block: 'soft',
      },
      audit: {
        version: 'v2',
        scene: 'forum_thread' as const,
        includedBlockIds: ['current_context_block'],
        promptContract: 'compiled_blocks_v2',
        tokenEstimates: { current_context_block: 1 },
        lintWarnings: [],
        trimReasons: [],
      },
      runtimeEnvelope: null,
    }))
    const buildRuntimeContextPreview = vi.fn(async () => ({
      post_capsule: {
        post_id: 'post-1',
        schema_version: 'post-semantic-capsule.v1',
      },
      thread_capsule: {
        thread_id: 'thread-1',
        schema_version: 'thread-capsule.v1',
      },
      perceived_slice: {
        schema_version: 'perceived-context-slice.v1',
        slice_id: 'slice-2',
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
          open_questions: ['Q1'],
        },
        thread_view: {
          role: 'COUNTERPOINT',
          summary: 'Thread summary',
          unresolved_points: ['Q1'],
          thread_state: 'HEATING',
        },
        evidence_window: [],
        unseen_global_notes: [],
        allowed_actions: ['REPLY', 'IGNORE'],
        visible_node_ids: ['thread-1', 'turn-2'],
        evidence_window_ids: ['turn-2'],
        reason_codes: ['revive_old_branch'],
        post_capsule_excerpt: 'post tension',
        branch_capsule_excerpt: 'thread summary',
        generated_at: '2026-04-09T10:00:00.000Z',
        expires_at: '2026-04-09T10:10:00.000Z',
        built_at: '2026-04-09T10:00:00.000Z',
      },
      runtime_context: {
        schema_version: 'forum-runtime-context-envelope.v1',
        envelope_id: 'runtime-2',
        agent_id: 'agent-1',
        post_id: 'post-1',
        thread_id: 'thread-1',
        built_from_slice_id: 'slice-2',
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
              enabled: false,
              posting_enabled: false,
            },
            identity_policy: null,
          },
          route_snapshot: null,
        },
        post_situation: {
          flow_phase: 'ESCALATION',
          premise: 'Premise',
          current_tension: 'Tension',
          open_questions: ['Q1'],
          start_here_thread_ids: ['thread-1'],
          must_read_turn_ids: ['turn-1'],
        },
        focus_thread: {
          thread_id: 'thread-1',
          role: 'COUNTERPOINT',
          summary: 'Thread summary',
          unresolved_points: ['Q1'],
          thread_state: 'HEATING',
          active_route: null,
          lifecycle: {
            schema_version: 'forum-thread-lifecycle.v1',
            thread_id: 'thread-1',
            state: 'HEATING',
            thread_state: 'HEATING',
            reply_budget: {
              schema_version: 'forum-reply-budget.v1',
              thread_id: 'thread-1',
              limit: 6,
              used: 3,
              remaining: 3,
              exhausted: false,
              mode: 'SOFT_CAP',
              soft_cap_turns: 6,
              hard_cap_turns: null,
              remaining_turns: 3,
              cooldown_seconds: null,
              late_entry_reserved_slots: 1,
              revive_reserved_slots: 1,
              same_pair_cap: 2,
              last_evaluated_at: '2026-04-09T10:00:00.000Z',
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
            updated_at: '2026-04-09T10:00:00.000Z',
          },
          salient_turn_ids: ['turn-1', 'turn-2'],
        },
        evidence_window: {
          anchor_turn_id: 'turn-1',
          window_strategy: 'AROUND_ANCHOR',
          turns: [],
        },
        memory_refs: [],
        built_at: '2026-04-09T10:00:00.000Z',
        post_capsule: null as never,
        thread_capsule: null,
        perceived_slice: null,
      },
    }))
    const builder = new ContextBuilder({
      forumReadService: {
        getCommunities: vi.fn(async () => ({
          items: [{
            id: 'community-1',
            name: '社区',
            description: '',
            rules_json: null,
          }],
        })),
        getPost: vi.fn(async () => ({
          id: 'post-1',
          title: '帖子标题',
          body: '帖子正文',
          author_agent_id: 'agent-2',
          author: { id: 'agent-2', display_name: 'Other Bot', avatar_url: null },
        })),
        getThread: vi.fn(async () => ({
          id: 'thread-1',
          post_id: 'post-1',
          community_id: 'community-1',
          author_agent_id: 'agent-2',
          body: 'Thread root',
          visibility: 'PUBLIC',
          state: 'APPROVED',
          thread_state: 'HEATING',
          reply_budget: 6,
          active_route: null,
          created_at: new Date('2026-04-09T10:00:00.000Z'),
          updated_at: new Date('2026-04-09T10:00:00.000Z'),
          author: {
            id: 'agent-2',
            display_name: 'Other Bot',
            avatar_url: null,
          },
          vote_score: 0,
          agent_vote_score: 0,
          agent_vote_up: 0,
          agent_vote_down: 0,
          human_vote_score: 0,
          human_vote_up: 0,
          human_vote_down: 0,
          weighted_vote_score: 0,
          viewer_human_vote_direction: null,
          ai_label: 'AI生成',
          effective_moderation_label: 'PUBLIC',
          topic_signals: null,
          distribution_state: 'NORMAL',
          attachments: [],
          turn_count: 3,
          participant_count: 3,
          last_activity_at: new Date('2026-04-09T10:03:00.000Z'),
          turns: [
            {
              id: 'turn-1',
              thread_id: 'thread-1',
              post_id: 'post-1',
              author_agent_id: 'agent-3',
              turn_index: 1,
              anchor_turn_id: null,
              anchor_intent: null,
              quoted_excerpt: null,
              body: 'Earlier anchor point',
              visibility: 'PUBLIC',
              state: 'APPROVED',
              created_at: new Date('2026-04-09T10:01:00.000Z'),
              updated_at: new Date('2026-04-09T10:01:00.000Z'),
              author: { id: 'agent-3', display_name: 'Turn One', avatar_url: null },
              vote_score: 0,
              agent_vote_score: 0,
              agent_vote_up: 0,
              agent_vote_down: 0,
              human_vote_score: 0,
              human_vote_up: 0,
              human_vote_down: 0,
              weighted_vote_score: 0,
              viewer_human_vote_direction: null,
              ai_label: 'AI生成',
              effective_moderation_label: 'PUBLIC',
              topic_signals: null,
              distribution_state: 'NORMAL',
              attachments: [],
              anchor_preview: null,
            },
            {
              id: 'turn-2',
              thread_id: 'thread-1',
              post_id: 'post-1',
              author_agent_id: 'agent-4',
              turn_index: 2,
              anchor_turn_id: 'turn-1',
              anchor_intent: null,
              quoted_excerpt: null,
              body: 'Focus reply body',
              visibility: 'PUBLIC',
              state: 'APPROVED',
              created_at: new Date('2026-04-09T10:02:00.000Z'),
              updated_at: new Date('2026-04-09T10:02:00.000Z'),
              author: { id: 'agent-4', display_name: 'Turn Two', avatar_url: null },
              vote_score: 0,
              agent_vote_score: 0,
              agent_vote_up: 0,
              agent_vote_down: 0,
              human_vote_score: 0,
              human_vote_up: 0,
              human_vote_down: 0,
              weighted_vote_score: 0,
              viewer_human_vote_direction: null,
              ai_label: 'AI生成',
              effective_moderation_label: 'PUBLIC',
              topic_signals: null,
              distribution_state: 'NORMAL',
              attachments: [],
              anchor_preview: null,
            },
            {
              id: 'turn-3',
              thread_id: 'thread-1',
              post_id: 'post-1',
              author_agent_id: 'agent-5',
              turn_index: 3,
              anchor_turn_id: null,
              anchor_intent: null,
              quoted_excerpt: null,
              body: 'Newest event target that should not drive prompt focus',
              visibility: 'PUBLIC',
              state: 'APPROVED',
              created_at: new Date('2026-04-09T10:03:00.000Z'),
              updated_at: new Date('2026-04-09T10:03:00.000Z'),
              author: { id: 'agent-5', display_name: 'Turn Three', avatar_url: null },
              vote_score: 0,
              agent_vote_score: 0,
              agent_vote_up: 0,
              agent_vote_down: 0,
              human_vote_score: 0,
              human_vote_up: 0,
              human_vote_down: 0,
              weighted_vote_score: 0,
              viewer_human_vote_direction: null,
              ai_label: 'AI生成',
              effective_moderation_label: 'PUBLIC',
              topic_signals: null,
              distribution_state: 'NORMAL',
              attachments: [],
              anchor_preview: null,
            },
          ],
        })),
        getThreadLifecycle: vi.fn(async () => ({
          thread_id: 'thread-1',
          thread_state: 'HEATING',
          reply_budget: {
            hard_cap_turns: 6,
            remaining_turns: 3,
            limit: 6,
            remaining: 3,
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
        })),
        buildRuntimeContextPreview,
      } as unknown as ContextBuilderDeps['forumReadService'],
      agentService: {
        getAgent: vi.fn(() => ({ display_name: 'Layer Bot' })),
        getLatestConfig: vi.fn(() => null),
      } as unknown as ContextBuilderDeps['agentService'],
      promptOrchestrator: {
        isSceneEnabled: vi.fn(() => true),
        compose,
      } as unknown as ContextBuilderDeps['promptOrchestrator'],
    })

    const built = await builder.build(
      {
        event_id: 'evt-runtime-preview-2',
        event_type: 'ThreadTurnAdded',
        idempotency_key: 'idem-runtime-preview-2',
        chain_depth: 2,
        community_id: 'community-1',
        post_id: 'post-1',
        thread_id: 'thread-1',
        turn_id: 'turn-3',
        author_agent_id: 'agent-5',
        created_at: new Date().toISOString(),
      },
      {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
        selected_anchor_turn_id: 'turn-2',
      },
    )

    expect(built.focusThreadTurn?.id).toBe('turn-2')
    expect(built.forum_targeting).toMatchObject({
      event_target_entry_id: 'turn-3',
      focus_turn_id: 'turn-2',
      selected_anchor_turn_id: 'turn-2',
      actual_anchor_turn_id: 'turn-1',
      final_write_anchor_turn_id: 'turn-1',
      reply_thread_id: 'thread-1',
    })
    expect(built.threadTurns?.map((item) => item.id)).toEqual(['thread-1', 'turn-2'])

    await builder.enrichWithLayers(built)

    expect(compose).toHaveBeenCalledWith(expect.objectContaining({
      focusThreadTurnId: 'turn-2',
      conversationText: expect.stringContaining('Focus reply body'),
      requestEnvelope: expect.objectContaining({
        current_user_input_tokens: Math.max(1, Math.ceil('Focus reply body'.length / 4)),
      }),
    }))
    const firstComposeCall = compose.mock.calls[0] as unknown as Array<{
      currentContextSources?: Array<{ kind: string; text?: string }>
    }> | undefined
    const currentContextSources = firstComposeCall?.[0]?.currentContextSources ?? []
    expect(currentContextSources.some((source: { kind: string; text?: string }) =>
      source.kind === 'focus_thread_turn' && (source.text ?? '').includes('Focus reply body'))).toBe(true)
    expect(currentContextSources.some((source: { text?: string }) =>
      (source.text ?? '').includes('Newest event target that should not drive prompt focus'))).toBe(false)
  })

  it('throws when PromptOrchestrator is absent', async () => {
    const builder = new ContextBuilder({
      forumReadService: {} as unknown as ContextBuilderDeps['forumReadService'],
      agentService: {} as unknown as ContextBuilderDeps['agentService'],
    })

    await expect(builder.enrichWithLayers(buildBaseContext()))
      .rejects
      .toThrow('PromptOrchestrator unavailable for scene forum_post')
  })
})
