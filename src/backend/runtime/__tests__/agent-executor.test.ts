import { describe, expect, it, vi } from 'vitest'
import { AgentExecutor } from '../agent-executor.js'
import { ResponseParser } from '../response-parser.js'
import { PROMPT_TEMPLATE_REFS } from '../../llm/prompt-template-refs.js'
import { InMemoryVoteRepository } from '../../repos/vote-repository.js'

describe('AgentExecutor', () => {
  it('uses the chat-room prompt contract and carries chat media plans into create_message writes', async () => {
    const context = {
      event: {
        event_id: 'evt-1',
        event_type: 'NewMessageCreated' as const,
        idempotency_key: 'idem-1',
        chain_depth: 0,
        community_id: 'community-1',
        room_id: 'room-1',
        author_agent_id: 'agent-2',
        created_at: new Date().toISOString(),
      },
      agent: {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
      persona: {
        name: 'Chat Bot',
        style: 'sharp',
        interests: ['chat'],
        language: 'zh-CN',
      },
      community: {
        id: 'community-1',
        name: '测试社区',
        description: '围绕多 surface 媒体做验收',
        rules: '',
      },
      chatContext: {
        room_name: '测试房间',
        room_description: '围绕多 surface 媒体做验收',
        recent_messages: [
          {
            author_name: 'Agent Two',
            body: '上一句已经把梗抛出来了。',
            is_self: false,
            message_kind: 'normal',
          },
        ],
      },
      chat_prompt_variables: {
        program_scene: 'FREE_CHAT',
        current_beat: 'CALLBACK',
        live_hook: '继续把这个梗接住。',
        unresolved_question: '怎么把图也接进来？',
        local_intent_block: '## Local Intent\n- initiative: reply',
        room_public_context_summary: '上一轮已经形成了共同语境。',
        role_hint: 'FOIL',
      },
      blocks: {
        hard_control_block: 'hard',
        compact_control_block: 'compact',
        current_context_block: 'context',
        memory_block: 'memory',
        soft_expression_block: 'soft',
      },
      prompt_audit: null,
    }

    const build = vi.fn(async () => context)
    const enrichWithLayers = vi.fn(async (ctx) => ctx)
    const generateVisibleText = vi.fn(async () => ({
      content: '先把这个梗接住，再往前推半步。',
      usage: { prompt_tokens: 10, completion_tokens: 6, total_tokens: 16 },
      latencyMs: 12,
      platformRetryCount: 0,
      renderDecision: {
        voiceLineId: 'qwen-social-v1',
        tier: 'base',
        profileId: 'profile-1',
        providerId: 'dashscope-openai',
        modelId: 'qwen-plus',
        region: 'cn',
        endpointId: 'default',
        credentialId: 'cred-1',
        fallbackLevel: 'none',
        reasons: ['test'],
        promptTemplateId: 'agent-chat-reply',
        promptVersion: 6,
      },
      promptRef: PROMPT_TEMPLATE_REFS.agentChatReplyScene,
    }))
    const parse = vi.fn(() => ({
      action: 'create_message' as const,
      community_id: 'community-1',
      room_id: 'room-1',
      body: '先把这个梗接住，再往前推半步。',
      message_kind: 'normal',
    }))
    const write = vi.fn(async () => ({ success: true, content_id: 'msg-2' }))
    const prepareChatRoomMessagePlan = vi.fn(async () => ({
      image_plan_id: 'image-plan-1',
      display_attachment_refs: [{
        asset_id: 'asset-1',
        slot: 0,
        display_variant: 'original' as const,
      }],
      planning_audit: {
        visual_directive_id: 'directive-1',
      },
      current_context_source: {
        kind: 'public_media_card',
        text: 'public media card',
        priority: 'high' as const,
        source_id: 'card-1',
      },
    }))

    const executor = new AgentExecutor({
      llmGateway: { generateVisibleText } as never,
      contextBuilder: { build, enrichWithLayers } as never,
      responseParser: { parse } as never,
      dataplaneWriter: { write } as never,
      agentRunRepo: { create: vi.fn() } as never,
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-1' })),
        getLatestConfig: vi.fn(() => null),
      } as never,
      voteRepo: new InMemoryVoteRepository(),
      inferenceProfileService: {
        resolveVisibleRoute: vi.fn(async ({ requestedTier }) => ({
          homeVoiceLineId: 'qwen-social-v1',
          requestedTier,
        })),
      } as never,
      surfaceMediaPlanningService: {
        prepareChatRoomMessagePlan,
      } as never,
    })

    const [result] = await executor.execute(context.event, {
      event_id: 'evt-1',
      quota_applied: 1,
      degradation_level: 'normal',
      agents: [{ agent_id: 'agent-1', score: 1, priority: 1 }],
      skipped_reasons: {},
    })

    expect(result?.success).toBe(true)
    expect(prepareChatRoomMessagePlan).toHaveBeenCalledWith(expect.objectContaining({
      agent_id: 'agent-1',
      room_id: 'room-1',
      room_name: '测试房间',
      semantic_hint: '## Local Intent\n- initiative: reply',
    }))
    expect(generateVisibleText).toHaveBeenCalledWith(expect.objectContaining({
      intent: 'chat_reply',
      scene: 'chat_room',
      promptRef: PROMPT_TEMPLATE_REFS.agentChatReplyScene,
      requestedTier: 'lite',
      variables: expect.objectContaining({
        room_name: '测试房间',
      }),
    }))
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create_message',
      image_plan_id: 'image-plan-1',
      display_attachment_refs: [{
        asset_id: 'asset-1',
        slot: 0,
        display_variant: 'original',
      }],
      audit_metadata: expect.objectContaining({
        surface_media: expect.objectContaining({
          visual_directive_id: 'directive-1',
        }),
      }),
    }), 'agent-1', 'evt-1', expect.anything(), expect.any(Number), 0, expect.anything())
  })

  it('records forum targeting audit metadata for resolved thread-anchor writes', async () => {
    const context = {
      event: {
        event_id: 'evt-thread-1',
        event_type: 'ThreadTurnAdded' as const,
        idempotency_key: 'idem-thread-1',
        chain_depth: 1,
        community_id: 'community-1',
        post_id: 'post-1',
        thread_id: 'thread-1',
        turn_id: 'turn-3',
        author_agent_id: 'agent-2',
        created_at: new Date().toISOString(),
      },
      agent: {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
      persona: {
        name: 'Thread Bot',
        style: 'precise',
        interests: ['forums'],
        language: 'zh-CN',
      },
      community: {
        id: 'community-1',
        name: '测试社区',
        description: '围绕 forum targeting 做收口',
        rules: '',
      },
      post: {
        id: 'post-1',
        title: '帖子标题',
        body: '帖子正文',
        author_agent_id: 'agent-2',
        author_name: 'Other Bot',
      },
      focusThreadTurn: {
        id: 'turn-2',
        post_id: 'post-1',
        thread_id: 'thread-1',
        entry_kind: 'TURN' as const,
        anchor_turn_id: 'turn-1',
        body: '旧分支里的关键一句。',
        author_agent_id: 'agent-3',
        author_name: 'Focus Bot',
      },
      forum_targeting: {
        event_target_entry_id: 'turn-3',
        event_target_thread_id: 'thread-1',
        focus_turn_id: 'turn-2',
        selected_anchor_turn_id: 'turn-2',
        actual_anchor_turn_id: 'turn-1',
        final_write_anchor_turn_id: 'turn-1',
        reply_thread_id: 'thread-1',
        browse_reason: 'REVIVE' as const,
        allowed_actions: ['REPLY', 'IGNORE'] as const,
      },
      blocks: {
        hard_control_block: 'hard',
        compact_control_block: 'compact',
        current_context_block: 'context',
        memory_block: 'memory',
        soft_expression_block: 'soft',
      },
      prompt_audit: null,
    }

    const build = vi.fn(async () => context)
    const enrichWithLayers = vi.fn(async (ctx) => ctx)
    const generateVisibleText = vi.fn(async (input: { promptRef: { id: string } }) => {
      if (input.promptRef.id === 'agent-plan-forum-actions') {
        return {
          content: JSON.stringify({
            version: 'v1',
            actions: [{ kind: 'add_thread_turn', target_ref: 'reply_thread' }],
          }),
          usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
          latencyMs: 10,
          platformRetryCount: 0,
          renderDecision: {
            voiceLineId: 'qwen-social-v1',
            tier: 'lite',
            profileId: 'profile-1',
            providerId: 'dashscope-openai',
            modelId: 'qwen-plus',
            region: 'cn',
            endpointId: 'default',
            credentialId: 'cred-1',
            fallbackLevel: 'none',
            reasons: ['test'],
            promptTemplateId: 'agent-plan-forum-actions',
            promptVersion: 1,
          },
          promptRef: PROMPT_TEMPLATE_REFS.agentPlanForumActions,
        }
      }
      return {
        content: '那我就沿着旧分支继续把这一句说完。',
        usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 },
        latencyMs: 10,
        platformRetryCount: 0,
        renderDecision: {
          voiceLineId: 'qwen-social-v1',
          tier: 'base',
          profileId: 'profile-1',
          providerId: 'dashscope-openai',
          modelId: 'qwen-plus',
          region: 'cn',
          endpointId: 'default',
          credentialId: 'cred-1',
          fallbackLevel: 'none',
          reasons: ['test'],
          promptTemplateId: 'agent-reply-to-thread-turn',
          promptVersion: 6,
        },
        promptRef: PROMPT_TEMPLATE_REFS.agentReplyToThreadTurn,
      }
    })
    const write = vi.fn(async () => ({ success: true, content_id: 'turn-4' }))

    const executor = new AgentExecutor({
      llmGateway: { generateVisibleText } as never,
      contextBuilder: { build, enrichWithLayers } as never,
      responseParser: { parse: vi.fn() } as never,
      dataplaneWriter: { write } as never,
      agentRunRepo: { create: vi.fn() } as never,
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-1', model: 'qwen-plus' })),
        getLatestConfig: vi.fn(() => null),
      } as never,
      voteRepo: new InMemoryVoteRepository(),
      inferenceProfileService: {
        resolveVisibleRoute: vi.fn(async () => ({
          homeVoiceLineId: 'qwen-social-v1',
          preferredModelId: 'qwen-plus',
          requestedTier: 'base',
        })),
      } as never,
    })

    const [result] = await executor.execute(context.event, {
      event_id: 'evt-thread-1',
      quota_applied: 1,
      degradation_level: 'normal',
      agents: [{ agent_id: 'agent-1', score: 1, priority: 1 }],
      skipped_reasons: {},
    })

    expect(result?.success).toBe(true)
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'add_thread_turn',
      thread_id: 'thread-1',
      anchor_turn_id: 'turn-1',
      audit_metadata: expect.objectContaining({
        forum_targeting: expect.objectContaining({
          event_target_entry_id: 'turn-3',
          focus_turn_id: 'turn-2',
          selected_anchor_turn_id: 'turn-2',
          actual_anchor_turn_id: 'turn-1',
          final_write_anchor_turn_id: 'turn-1',
          written_anchor_turn_id: 'turn-1',
        }),
      }),
    }), 'agent-1', 'evt-thread-1', expect.anything(), expect.any(Number), 1, expect.anything())
  })

  it('writes the first follow-up turn without an anchor when add_thread_turn targets a fresh thread root', async () => {
    const context = {
      event: {
        event_id: 'evt-thread-root-1',
        event_type: 'ThreadOpened' as const,
        idempotency_key: 'idem-thread-root-1',
        chain_depth: 0,
        community_id: 'community-1',
        post_id: 'post-1',
        thread_id: 'thread-1',
        author_agent_id: 'agent-2',
        created_at: new Date().toISOString(),
      },
      agent: {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
      persona: {
        name: 'Thread Bot',
        style: 'precise',
        interests: ['forums'],
        language: 'zh-CN',
      },
      community: {
        id: 'community-1',
        name: '测试社区',
        description: '围绕 fresh thread root 的首条 turn 写入做验收',
        rules: '',
      },
      post: {
        id: 'post-1',
        title: '帖子标题',
        body: '帖子正文',
        author_agent_id: 'agent-2',
        author_name: 'Other Bot',
      },
      focusThreadTurn: {
        id: 'thread-1',
        post_id: 'post-1',
        thread_id: 'thread-1',
        entry_kind: 'THREAD' as const,
        anchor_turn_id: null,
        body: '这是分支根节点。',
        author_agent_id: 'agent-3',
        author_name: 'Root Bot',
      },
      threadTurns: [
        {
          id: 'thread-1',
          post_id: 'post-1',
          thread_id: 'thread-1',
          entry_kind: 'THREAD' as const,
          anchor_turn_id: null,
          body: '这是分支根节点。',
          author_agent_id: 'agent-3',
          author_name: 'Root Bot',
        },
      ],
      forum_targeting: {
        event_target_entry_id: 'thread-1',
        event_target_thread_id: 'thread-1',
        focus_turn_id: 'thread-1',
        selected_anchor_turn_id: null,
        actual_anchor_turn_id: null,
        final_write_anchor_turn_id: null,
        reply_thread_id: 'thread-1',
        browse_reason: 'DIRECT_REPLY' as const,
        allowed_actions: ['REPLY'] as const,
      },
      blocks: {
        hard_control_block: 'hard',
        compact_control_block: 'compact',
        current_context_block: 'context',
        memory_block: 'memory',
        soft_expression_block: 'soft',
      },
      prompt_audit: null,
    }

    const build = vi.fn(async () => context)
    const enrichWithLayers = vi.fn(async (ctx) => ctx)
    const canServeRoute = vi.fn(() => true)
    const generateVisibleText = vi
      .fn()
      .mockResolvedValueOnce({
        content: JSON.stringify({
          version: 'v1',
          actions: [{ kind: 'add_thread_turn', target_ref: 'focus_turn' }],
        }),
        usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
        latencyMs: 10,
        platformRetryCount: 0,
        renderDecision: {
          voiceLineId: 'qwen-social-v1',
          tier: 'lite',
          profileId: 'profile-1',
          providerId: 'dashscope-openai',
          modelId: 'qwen-plus',
          region: 'cn',
          endpointId: 'default',
          credentialId: 'cred-1',
          fallbackLevel: 'none',
          reasons: ['test'],
          promptTemplateId: 'agent-plan-forum-actions',
          promptVersion: 1,
        },
        promptRef: PROMPT_TEMPLATE_REFS.agentPlanForumActions,
      })
      .mockResolvedValueOnce({
        content: '那我先接住这条新分支的第一句。',
        usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 },
        latencyMs: 10,
        platformRetryCount: 0,
        renderDecision: {
          voiceLineId: 'qwen-social-v1',
          tier: 'base',
          profileId: 'profile-1',
          providerId: 'dashscope-openai',
          modelId: 'qwen-plus',
          region: 'cn',
          endpointId: 'default',
          credentialId: 'cred-1',
          fallbackLevel: 'none',
          reasons: ['test'],
          promptTemplateId: 'agent-reply-to-thread-turn',
          promptVersion: 6,
        },
        promptRef: PROMPT_TEMPLATE_REFS.agentReplyToThreadTurn,
      })
    const write = vi.fn(async () => ({ success: true, content_id: 'turn-2' }))

    const executor = new AgentExecutor({
      llmGateway: { generateVisibleText, canServeRoute } as never,
      contextBuilder: { build, enrichWithLayers } as never,
      responseParser: { parse: vi.fn() } as never,
      dataplaneWriter: { write } as never,
      agentRunRepo: { create: vi.fn() } as never,
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-1', model: 'qwen-plus' })),
        getLatestConfig: vi.fn(() => null),
      } as never,
      voteRepo: new InMemoryVoteRepository(),
      inferenceProfileService: {
        resolveVisibleRoute: vi.fn(async ({ requestedTier }) => ({
          homeVoiceLineId: 'qwen-social-v1',
          preferredModelId: 'qwen-plus',
          requestedTier,
        })),
      } as never,
    })

    const [result] = await executor.execute(context.event, {
      event_id: 'evt-thread-root-1',
      quota_applied: 1,
      degradation_level: 'normal',
      agents: [{ agent_id: 'agent-1', score: 1, priority: 1 }],
      skipped_reasons: {},
    })

    expect(result?.success).toBe(true)
    expect(canServeRoute).toHaveBeenCalledTimes(2)
    expect(canServeRoute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      promptRef: PROMPT_TEMPLATE_REFS.agentPlanForumActions,
      responseMode: 'json_object',
      allowFallbackWithinLine: true,
      allowCrossFamily: false,
    }))
    expect(canServeRoute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      promptRef: PROMPT_TEMPLATE_REFS.agentReplyToThreadTurn,
      responseMode: 'text',
      allowFallbackWithinLine: true,
      allowCrossFamily: false,
    }))
    expect(generateVisibleText).toHaveBeenCalledTimes(2)
    expect(generateVisibleText.mock.calls[0]?.[0]).toMatchObject({
      promptRef: PROMPT_TEMPLATE_REFS.agentPlanForumActions,
      responseMode: 'json_object',
      allowFallbackWithinLine: true,
      allowCrossFamily: false,
    })
    expect(generateVisibleText.mock.calls[1]?.[0]).toMatchObject({
      promptRef: PROMPT_TEMPLATE_REFS.agentReplyToThreadTurn,
      responseMode: 'text',
      allowFallbackWithinLine: true,
      allowCrossFamily: false,
    })
    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'add_thread_turn',
      thread_id: 'thread-1',
      body: '那我先接住这条新分支的第一句。',
      audit_metadata: expect.objectContaining({
        forum_targeting: expect.objectContaining({
          event_target_entry_id: 'thread-1',
          focus_turn_id: 'thread-1',
          final_write_anchor_turn_id: null,
          written_anchor_turn_id: null,
        }),
      }),
    }), 'agent-1', 'evt-thread-root-1', expect.anything(), expect.any(Number), 0, expect.anything())
    expect(write.mock.calls[0]?.[0]).not.toHaveProperty('anchor_turn_id')
  })

  it('uses focus-thread semantics for forum media planning during branch revive', async () => {
    const context = {
      event: {
        event_id: 'evt-thread-2',
        event_type: 'ThreadTurnAdded' as const,
        idempotency_key: 'idem-thread-2',
        chain_depth: 1,
        community_id: 'community-1',
        post_id: 'post-1',
        thread_id: 'thread-1',
        turn_id: 'turn-3',
        author_agent_id: 'agent-2',
        created_at: new Date().toISOString(),
      },
      agent: {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
      persona: {
        name: 'Thread Bot',
        style: 'precise',
        interests: ['forums'],
        language: 'zh-CN',
      },
      community: {
        id: 'community-1',
        name: '测试社区',
        description: '围绕 forum media planning 做收口',
        rules: '',
      },
      post: {
        id: 'post-1',
        title: '帖子标题',
        body: '帖子正文',
        author_agent_id: 'agent-2',
        author_name: 'Other Bot',
      },
      focusThreadTurn: {
        id: 'turn-2',
        post_id: 'post-1',
        thread_id: 'thread-1',
        entry_kind: 'TURN' as const,
        anchor_turn_id: 'turn-1',
        body: '真正应该继续的是这条旧分支。',
        author_agent_id: 'agent-3',
        author_name: 'Focus Bot',
      },
      forum_targeting: {
        event_target_entry_id: 'turn-3',
        event_target_thread_id: 'thread-1',
        focus_turn_id: 'turn-2',
        selected_anchor_turn_id: 'turn-2',
        actual_anchor_turn_id: 'turn-1',
        final_write_anchor_turn_id: 'turn-1',
        reply_thread_id: 'thread-1',
        browse_reason: 'REVIVE' as const,
        allowed_actions: ['REPLY'] as const,
      },
      public_scene: {
        scene_metadata: {
          phase: 'LIVE' as const,
          episode_id: 'episode-1',
          selection_id: 'selection-1',
          episode_plan_id: 'plan-1',
          local_intent_id: 'intent-1',
          actor_surface: 'forum_thread',
          director_surface: 'forum_thread_followup',
          selection_mode: 'direct_reply',
        },
        episode_brief: {
          scene_goal: {
            viewer_goal: '继续原分支',
            growth_goal: '延续上下文',
          },
        },
        local_intent: {
          hard_constraints: [],
          soft_constraints: [],
          prohibited_reference_types: [],
          tone_hint: 'warm',
          memory_scope: 'none',
          reference_scope: 'public_only',
          relation_focus: 'branch_author',
        },
        local_intent_block: '## Local Intent\n- initiative: reply',
      },
      blocks: {
        hard_control_block: 'hard',
        compact_control_block: 'compact',
        current_context_block: 'context',
        memory_block: 'memory',
        soft_expression_block: 'soft',
      },
      prompt_audit: null,
    }

    const build = vi.fn(async () => context)
    const enrichWithLayers = vi.fn(async (ctx) => ctx)
    const generateVisibleText = vi.fn(async () => ({
      content: '那我就沿着旧分支继续把这一句说完。',
      usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 },
      latencyMs: 10,
      platformRetryCount: 0,
      renderDecision: {
        voiceLineId: 'qwen-social-v1',
        tier: 'base',
        profileId: 'profile-1',
        providerId: 'dashscope-openai',
        modelId: 'qwen-plus',
        region: 'cn',
        endpointId: 'default',
        credentialId: 'cred-1',
        fallbackLevel: 'none',
        reasons: ['test'],
        promptTemplateId: 'agent-reply-to-thread-turn',
        promptVersion: 6,
      },
      promptRef: PROMPT_TEMPLATE_REFS.agentReplyToThreadTurnScene,
    }))
    const parse = vi.fn(() => ({
      action: 'add_thread_turn' as const,
      community_id: 'community-1',
      post_id: 'post-1',
      thread_id: 'thread-1',
      anchor_turn_id: 'turn-1',
      body: '那我就沿着旧分支继续把这一句说完。',
    }))
    const write = vi.fn(async () => ({ success: true, content_id: 'turn-4' }))
    const prepareForumThreadPlan = vi.fn(async () => null)

    const executor = new AgentExecutor({
      llmGateway: { generateVisibleText } as never,
      contextBuilder: { build, enrichWithLayers } as never,
      responseParser: { parse } as never,
      dataplaneWriter: { write } as never,
      agentRunRepo: { create: vi.fn() } as never,
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-1', model: 'qwen-plus' })),
        getLatestConfig: vi.fn(() => null),
      } as never,
      voteRepo: new InMemoryVoteRepository(),
      inferenceProfileService: {
        resolveVisibleRoute: vi.fn(async () => ({
          homeVoiceLineId: 'qwen-social-v1',
          preferredModelId: 'qwen-plus',
          requestedTier: 'base',
        })),
      } as never,
      surfaceMediaPlanningService: {
        prepareForumThreadPlan,
      } as never,
    })

    const [result] = await executor.execute(context.event, {
      event_id: 'evt-thread-2',
      quota_applied: 1,
      degradation_level: 'normal',
      agents: [{ agent_id: 'agent-1', score: 1, priority: 1 }],
      skipped_reasons: {},
    })

    expect(result?.success).toBe(true)
    expect(prepareForumThreadPlan).toHaveBeenCalledWith(expect.objectContaining({
      post_id: 'post-1',
      thread_id: 'thread-1',
      turn_id: 'turn-2',
      surface: 'forum_turn',
      focus_hint: '真正应该继续的是这条旧分支。',
    }))
  })

  it('uses forum_thread surface when the focus entry is the thread root', async () => {
    const context = {
      event: {
        event_id: 'evt-thread-3',
        event_type: 'ThreadOpened' as const,
        idempotency_key: 'idem-thread-3',
        chain_depth: 0,
        community_id: 'community-1',
        post_id: 'post-1',
        thread_id: 'thread-1',
        author_agent_id: 'agent-2',
        created_at: new Date().toISOString(),
      },
      agent: {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
      persona: {
        name: 'Thread Bot',
        style: 'precise',
        interests: ['forums'],
        language: 'zh-CN',
      },
      community: {
        id: 'community-1',
        name: '测试社区',
        description: '围绕 forum media planning 做收口',
        rules: '',
      },
      post: {
        id: 'post-1',
        title: '帖子标题',
        body: '帖子正文',
        author_agent_id: 'agent-2',
        author_name: 'Other Bot',
      },
      focusThreadTurn: {
        id: 'thread-1',
        post_id: 'post-1',
        thread_id: 'thread-1',
        entry_kind: 'THREAD' as const,
        anchor_turn_id: null,
        body: '这是分支根节点。',
        author_agent_id: 'agent-3',
        author_name: 'Root Bot',
      },
      forum_targeting: {
        event_target_entry_id: 'thread-1',
        event_target_thread_id: 'thread-1',
        focus_turn_id: 'thread-1',
        selected_anchor_turn_id: null,
        actual_anchor_turn_id: null,
        final_write_anchor_turn_id: null,
        reply_thread_id: 'thread-1',
        browse_reason: 'DIRECT_REPLY' as const,
        allowed_actions: ['REPLY'] as const,
      },
      public_scene: {
        scene_metadata: {
          phase: 'LIVE' as const,
          episode_id: 'episode-1',
          selection_id: 'selection-1',
          episode_plan_id: 'plan-1',
          local_intent_id: 'intent-1',
          actor_surface: 'forum_thread',
          director_surface: 'forum_thread_followup',
          selection_mode: 'direct_reply',
        },
        episode_brief: {
          scene_goal: {
            viewer_goal: '开一条新分支',
            growth_goal: '接住主题',
          },
        },
        local_intent: {
          hard_constraints: [],
          soft_constraints: [],
          prohibited_reference_types: [],
          tone_hint: 'warm',
          memory_scope: 'none',
          reference_scope: 'public_only',
          relation_focus: 'branch_author',
        },
        local_intent_block: '## Local Intent\n- initiative: reply',
      },
      blocks: {
        hard_control_block: 'hard',
        compact_control_block: 'compact',
        current_context_block: 'context',
        memory_block: 'memory',
        soft_expression_block: 'soft',
      },
      prompt_audit: null,
    }

    const build = vi.fn(async () => context)
    const enrichWithLayers = vi.fn(async (ctx) => ctx)
    const generateVisibleText = vi.fn(async () => ({
      content: '那我就在这条公开分支上接一句。',
      usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 },
      latencyMs: 10,
      platformRetryCount: 0,
      renderDecision: {
        voiceLineId: 'qwen-social-v1',
        tier: 'base',
        profileId: 'profile-1',
        providerId: 'dashscope-openai',
        modelId: 'qwen-plus',
        region: 'cn',
        endpointId: 'default',
        credentialId: 'cred-1',
        fallbackLevel: 'none',
        reasons: ['test'],
        promptTemplateId: 'agent-reply-to-thread-turn',
        promptVersion: 6,
      },
      promptRef: PROMPT_TEMPLATE_REFS.agentReplyToThreadTurnScene,
    }))
    const parse = vi.fn(() => ({
      action: 'add_thread_turn' as const,
      community_id: 'community-1',
      post_id: 'post-1',
      thread_id: 'thread-1',
      body: '那我就在这条公开分支上接一句。',
    }))
    const write = vi.fn(async () => ({ success: true, content_id: 'turn-4' }))
    const prepareForumThreadPlan = vi.fn(async () => null)

    const executor = new AgentExecutor({
      llmGateway: { generateVisibleText } as never,
      contextBuilder: { build, enrichWithLayers } as never,
      responseParser: { parse } as never,
      dataplaneWriter: { write } as never,
      agentRunRepo: { create: vi.fn() } as never,
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-1', model: 'qwen-plus' })),
        getLatestConfig: vi.fn(() => null),
      } as never,
      voteRepo: new InMemoryVoteRepository(),
      inferenceProfileService: {
        resolveVisibleRoute: vi.fn(async () => ({
          homeVoiceLineId: 'qwen-social-v1',
          preferredModelId: 'qwen-plus',
          requestedTier: 'base',
        })),
      } as never,
      surfaceMediaPlanningService: {
        prepareForumThreadPlan,
      } as never,
    })

    const [result] = await executor.execute(context.event, {
      event_id: 'evt-thread-3',
      quota_applied: 1,
      degradation_level: 'normal',
      agents: [{ agent_id: 'agent-1', score: 1, priority: 1 }],
      skipped_reasons: {},
    })

    expect(result?.success).toBe(true)
    expect(prepareForumThreadPlan).toHaveBeenCalledWith(expect.objectContaining({
      post_id: 'post-1',
      thread_id: 'thread-1',
      turn_id: null,
      surface: 'forum_thread',
      focus_hint: '这是分支根节点。',
    }))
  })

  it('runs a two-call roaming flow and opens a sibling thread when Call 1 selects start_sibling_thread', async () => {
    const threadCapsule = {
      schema_version: 'forum-thread-capsule.v1',
      thread_id: 'thread-1',
      post_id: 'post-1',
      community_id: 'community-1',
      author_id: 'agent-2',
      participant_ids: ['agent-2', 'agent-3'],
      participant_count: 2,
      turn_count: 2,
      latest_turn_id: 'turn-2',
      latest_activity_at: new Date().toISOString(),
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
      updated_at: new Date().toISOString(),
    }
    const context = {
      event: {
        event_id: 'evt-thread-roam',
        event_type: 'ThreadTurnAdded' as const,
        idempotency_key: 'idem-thread-roam',
        chain_depth: 1,
        community_id: 'community-1',
        post_id: 'post-1',
        thread_id: 'thread-1',
        turn_id: 'turn-2',
        author_agent_id: 'agent-2',
        created_at: new Date().toISOString(),
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
        description: '讨论 roaming',
        rules: '',
      },
      post: {
        id: 'post-1',
        title: '帖子标题',
        body: '帖子正文',
        author_agent_id: 'agent-2',
        author_name: 'Other Bot',
      },
      focusThreadTurn: {
        id: 'turn-2',
        post_id: 'post-1',
        thread_id: 'thread-1',
        entry_kind: 'TURN' as const,
        anchor_turn_id: 'turn-1',
        body: 'Focus reply body',
        author_agent_id: 'agent-3',
        author_name: 'Focus Bot',
      },
      forum_targeting: {
        event_target_entry_id: 'turn-2',
        event_target_thread_id: 'thread-1',
        focus_turn_id: 'turn-2',
        selected_anchor_turn_id: 'turn-2',
        actual_anchor_turn_id: 'turn-1',
        final_write_anchor_turn_id: 'turn-1',
        reply_thread_id: 'thread-1',
        browse_reason: 'REVIVE' as const,
        allowed_actions: ['REPLY', 'START_NEW_THREAD', 'HANDOFF', 'IGNORE'] as const,
      },
      perceived_context_slice: {
        schema_version: 'forum-perceived-context-slice.v1',
        slice_id: 'slice-1',
        agent_id: 'agent-1',
        post_id: 'post-1',
        thread_id: 'thread-1',
        browse_reason: 'REVIVE' as const,
        opportunity_id: 'opp-1',
        focus_turn_id: 'turn-2',
        selected_anchor_turn_id: 'turn-2',
        actual_anchor_turn_id: 'turn-1',
        context_coverage: 'LOCAL_PLUS_POST' as const,
        post_view: {
          premise: 'Premise',
          flow_phase: 'ESCALATION' as const,
          current_tension: 'Tension',
          open_questions: ['Question 1'],
        },
        thread_view: {
          role: 'COUNTERPOINT' as const,
          summary: 'Current branch summary',
          unresolved_points: ['Question 1'],
          thread_state: 'HEATING' as const,
        },
        evidence_window: [],
        unseen_global_notes: [],
        allowed_actions: ['REPLY', 'START_NEW_THREAD', 'HANDOFF', 'IGNORE'] as const,
        visible_node_ids: ['thread-1', 'turn-2'],
        evidence_window_ids: ['turn-2'],
        reason_codes: ['revive_old_branch'],
        post_capsule_excerpt: 'post excerpt',
        branch_capsule_excerpt: 'branch excerpt',
        generated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        built_at: new Date().toISOString(),
      },
      semantic_post_capsule: {
        schema_version: 'forum-post-semantic-capsule.v1',
        post_id: 'post-1',
        community_id: 'community-1',
        thread_count: 1,
        highlighted_thread_ids: ['thread-1'],
        participant_ids: ['agent-1', 'agent-2', 'agent-3'],
        participant_count: 3,
        latest_activity_at: new Date().toISOString(),
        audience_signals: null,
        thread_capsules: [threadCapsule],
        flow_phase: 'ESCALATION' as const,
        premise: 'Premise',
        current_tension: 'Tension',
        resolved_points: [],
        open_questions: ['Question 1'],
        must_read_turn_ids: ['turn-2'],
        start_thread_ids: ['thread-1'],
        thread_capsule_ids: ['thread-1'],
        audience_capsule_id: null,
        evidence_refs: [],
        public_persona_cues: [],
        public_growth_cues: [],
        updated_at: new Date().toISOString(),
      },
      semantic_thread_capsule: threadCapsule,
      discussion_forest: {
        schema_version: 'forum-discussion-forest.v1',
        projection_id: 'forest-1',
        post_id: 'post-1',
        focus_thread_id: 'thread-1',
        focus_turn_id: 'turn-2',
        reading_guide: {
          schema_version: 'forum-reading-guide.v1',
          post_id: 'post-1',
          entries: [{
            id: 'guide-1',
            thread_id: 'thread-1',
            focus_turn_id: 'turn-2',
            title: '当前分支',
            teaser: 'teaser',
            reason_badges: [],
            participant_count: 2,
            turn_count: 2,
            latest_activity_at: new Date().toISOString(),
            evidence_refs: [],
          }],
          highlighted_thread_ids: ['thread-1'],
          summary_line: 'summary',
          start_here_thread_ids: ['thread-1'],
          current_focus_thread_ids: ['thread-1'],
          must_read_turn_ids: ['turn-2'],
          evidence_refs: [],
          generated_at: new Date().toISOString(),
        },
        branch_groups: [],
        nodes: [
          {
            schema_version: 'forum-turn-display-projection.v1',
            id: 'thread-1',
            entry_kind: 'THREAD' as const,
            post_id: 'post-1',
            thread_id: 'thread-1',
            display_parent_id: null,
            display_depth: 0 as const,
            actual_anchor_turn_id: null,
            branch_root_turn_id: null,
            sibling_order: 0,
            collapsed_anchor_chain: [],
            is_late_entry: false,
            placement_reason: 'ROOT_APPEND' as const,
            anchor_preview_source: 'NONE' as const,
            reason_badges: [],
            author: { id: 'agent-2', actor_type: 'agent' as const, display_name: 'Other Bot', avatar_url: null },
            body: 'Thread root',
            quoted_excerpt: null,
            evidence_refs: [],
            created_at: new Date().toISOString(),
            generated_at: new Date().toISOString(),
          },
          {
            schema_version: 'forum-turn-display-projection.v1',
            id: 'turn-2',
            entry_kind: 'TURN' as const,
            post_id: 'post-1',
            thread_id: 'thread-1',
            display_parent_id: 'thread-1',
            display_depth: 1 as const,
            actual_anchor_turn_id: 'turn-1',
            branch_root_turn_id: 'thread-1',
            sibling_order: 1,
            collapsed_anchor_chain: [],
            is_late_entry: true,
            placement_reason: 'LATE_ENTRY_REATTACH' as const,
            anchor_preview_source: 'VISIBLE_TURN' as const,
            reason_badges: ['RETURNED_TO_BRANCH'],
            author: { id: 'agent-3', actor_type: 'agent' as const, display_name: 'Focus Bot', avatar_url: null },
            body: 'Focus reply body',
            quoted_excerpt: null,
            evidence_refs: [],
            created_at: new Date().toISOString(),
            generated_at: new Date().toISOString(),
          },
        ],
        latest_activity_cursor: null,
        evidence_refs: [],
        generated_at: new Date().toISOString(),
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
              actor_type: 'agent' as const,
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
        post_situation: null,
        focus_thread: null,
        evidence_window: null,
        memory_refs: [],
        built_at: new Date().toISOString(),
        post_capsule: {} as never,
        thread_capsule: null,
        perceived_slice: null,
      },
      forum_orchestration_policy: {
        schema_version: 'forum-orchestration-policy.v1',
        scope_type: 'POST' as const,
        scope_id: 'post-1',
        source: 'post_override' as const,
        profile: 'ambient_roaming' as const,
        recall_control: {
          schema_version: 'forum-orchestration-policy.v1',
          pair_window_minutes: 30,
          pair_max_exchanges: 4,
          post_thread_share_cap: 0.6,
          reactive_recall_decay: 'fast' as const,
          newcomer_min_share: 0.1,
          late_entry_min_share: 0.1,
          revive_old_branch_budget: 2,
        },
        compare_debug: {
          schema_version: 'forum-orchestration-policy.v1',
          shadow_enabled: false,
          record_metrics: true,
          include_viewer_telemetry: false,
        },
        cutover: {
          schema_version: 'forum-orchestration-policy.v1',
          selection_enabled: true,
          envelope_enabled: true,
          fallback_to_baseline: true,
        },
        community_default: null,
        post_override: null,
      },
      blocks: {
        hard_control_block: 'hard',
        compact_control_block: 'compact',
        current_context_block: 'context',
        memory_block: 'memory',
        soft_expression_block: 'soft',
      },
      prompt_audit: null,
    }

    const build = vi.fn(async () => context)
    const enrichWithLayers = vi.fn(async (ctx) => ctx)
    const retargetForumThreadContext = vi.fn(async (ctx) => ({
      ...ctx,
      focusThreadTurn: ctx.focusThreadTurn,
    }))
    const generateVisibleText = vi.fn(async (input: { promptRef: { id: string } }) => {
      if (input.promptRef.id === 'agent-select-forum-arrival') {
        return {
          content: '{"candidate_id":"sibling:thread-1","action":"start_sibling_thread"}',
          usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
          latencyMs: 5,
          platformRetryCount: 0,
          renderDecision: {
            voiceLineId: 'qwen-social-v1',
            tier: 'lite',
            profileId: 'profile-lite',
            providerId: 'dashscope-openai',
            modelId: 'qwen-plus',
            region: 'cn',
            endpointId: 'default',
            credentialId: 'cred-1',
            fallbackLevel: 'none',
            reasons: ['test'],
            promptTemplateId: 'agent-select-forum-arrival',
            promptVersion: 1,
          },
          promptRef: PROMPT_TEMPLATE_REFS.agentSelectForumArrival,
        }
      }
      if (input.promptRef.id === 'agent-plan-forum-actions') {
        return {
          content: JSON.stringify({
            version: 'v1',
            actions: [{ kind: 'open_thread' }],
          }),
          usage: { prompt_tokens: 6, completion_tokens: 3, total_tokens: 9 },
          latencyMs: 5,
          platformRetryCount: 0,
          renderDecision: {
            voiceLineId: 'qwen-social-v1',
            tier: 'lite',
            profileId: 'profile-lite',
            providerId: 'dashscope-openai',
            modelId: 'qwen-plus',
            region: 'cn',
            endpointId: 'default',
            credentialId: 'cred-1',
            fallbackLevel: 'none',
            reasons: ['test'],
            promptTemplateId: 'agent-plan-forum-actions',
            promptVersion: 1,
          },
          promptRef: PROMPT_TEMPLATE_REFS.agentPlanForumActions,
        }
      }
      return {
        content: '那我开一条并列分支，单独把这个问题拆开。',
        usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
        latencyMs: 5,
        platformRetryCount: 0,
        renderDecision: {
          voiceLineId: 'qwen-social-v1',
          tier: 'base',
          profileId: 'profile-base',
          providerId: 'dashscope-openai',
          modelId: 'qwen-plus',
          region: 'cn',
          endpointId: 'default',
          credentialId: 'cred-1',
          fallbackLevel: 'none',
          reasons: ['test'],
          promptTemplateId: 'agent-reply-to-thread-turn',
          promptVersion: 4,
        },
        promptRef: PROMPT_TEMPLATE_REFS.agentReplyToThreadTurnScene,
      }
    })
    const write = vi.fn(async () => ({ success: true, content_id: 'thread-2' }))

    const resolveVisibleRoute = vi.fn(async ({ requestedTier }) => ({
      homeVoiceLineId: 'qwen-social-v1',
      requestedTier,
    }))

    const executor = new AgentExecutor({
      llmGateway: { generateVisibleText } as never,
      contextBuilder: { build, enrichWithLayers, retargetForumThreadContext } as never,
      responseParser: new ResponseParser() as never,
      dataplaneWriter: { write } as never,
      agentRunRepo: { create: vi.fn() } as never,
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-1', display_name: 'Roaming Bot', model: 'qwen-plus' })),
        getLatestConfig: vi.fn(() => null),
      } as never,
      voteRepo: new InMemoryVoteRepository(),
      inferenceProfileService: {
        resolveVisibleRoute,
      } as never,
    })

    const [result] = await executor.execute(context.event, {
      event_id: 'evt-thread-roam',
      quota_applied: 1,
      degradation_level: 'normal',
      agents: [{ agent_id: 'agent-1', score: 1, priority: 1, selected_anchor_turn_id: 'turn-2' }],
      skipped_reasons: {},
    })

    expect(result?.success).toBe(true)
    expect(generateVisibleText).toHaveBeenCalledTimes(3)
    expect(generateVisibleText.mock.calls[0]?.[0]).toMatchObject({
      responseMode: 'json_object',
      promptRef: PROMPT_TEMPLATE_REFS.agentSelectForumArrival,
      requestedTier: 'lite',
      allowFallbackWithinLine: true,
      allowCrossFamily: false,
      localOverrides: {
        executionPolicyId: 'visible-forum_reply-selection-lite',
      },
    })
    expect(generateVisibleText.mock.calls[1]?.[0]).toMatchObject({
      responseMode: 'json_object',
      promptRef: PROMPT_TEMPLATE_REFS.agentPlanForumActions,
      requestedTier: 'lite',
      allowFallbackWithinLine: true,
      allowCrossFamily: false,
      localOverrides: {
        executionPolicyId: 'visible-forum_reply-action-plan-lite',
      },
    })
    expect(generateVisibleText.mock.calls[2]?.[0]).toMatchObject({
      responseMode: 'text',
      promptRef: PROMPT_TEMPLATE_REFS.agentReplyToThreadTurnScene,
      allowFallbackWithinLine: true,
      allowCrossFamily: false,
      localOverrides: {
        executionPolicyId: 'visible-forum_reply-thread-base',
      },
    })
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'open_thread',
      post_id: 'post-1',
      audit_metadata: expect.objectContaining({
        forum_roaming: expect.objectContaining({
          decision_result: expect.objectContaining({
            action: 'start_sibling_thread',
          }),
          resolved_execution_plan: expect.objectContaining({
            write_action: 'open_thread',
          }),
        }),
      }),
    }), 'agent-1', 'evt-thread-roam', expect.objectContaining({ total_tokens: 39 }), expect.any(Number), 1, expect.anything())
    expect(enrichWithLayers).toHaveBeenCalledTimes(2)
    expect(retargetForumThreadContext).toHaveBeenCalledTimes(1)
    expect(resolveVisibleRoute).toHaveBeenCalledTimes(1)
    expect(resolveVisibleRoute).toHaveBeenNthCalledWith(1, {
      agentId: 'agent-1',
      requestedTier: 'lite',
      requestedTierCeiling: 'lite',
    })
  })

  it('records a no-write run when Call 1 selects observe_only', async () => {
    const context = {
      event: {
        event_id: 'evt-thread-no-write',
        event_type: 'ThreadTurnAdded' as const,
        idempotency_key: 'idem-thread-no-write',
        chain_depth: 0,
        community_id: 'community-1',
        post_id: 'post-1',
        thread_id: 'thread-1',
        turn_id: 'turn-2',
        created_at: new Date().toISOString(),
      },
      agent: {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
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
      semantic_post_capsule: {
        schema_version: 'forum-post-semantic-capsule.v1',
        post_id: 'post-1',
        community_id: 'community-1',
        thread_count: 1,
        highlighted_thread_ids: ['thread-1'],
        participant_ids: ['agent-1', 'agent-2'],
        participant_count: 2,
        latest_activity_at: new Date().toISOString(),
        audience_signals: null,
        thread_capsules: [{
          schema_version: 'forum-thread-capsule.v1',
          thread_id: 'thread-1',
          post_id: 'post-1',
          community_id: 'community-1',
          author_id: 'agent-2',
          participant_ids: ['agent-2'],
          participant_count: 1,
          turn_count: 1,
          latest_turn_id: 'turn-2',
          latest_activity_at: new Date().toISOString(),
          lifecycle: {
            schema_version: 'forum-thread-lifecycle.v1',
            thread_id: 'thread-1',
            state: 'HEATING',
            thread_state: 'HEATING',
            reply_budget: {
              schema_version: 'forum-reply-budget.v1',
              thread_id: 'thread-1',
              limit: 6,
              used: 1,
              remaining: 5,
              exhausted: false,
              mode: 'SOFT_CAP',
              soft_cap_turns: 6,
              hard_cap_turns: null,
              remaining_turns: 5,
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
              reply_mode: 'CLOSED',
              reply_allowed: false,
              preferred_action: 'READ_ONLY',
              reason_code: 'THREAD_CLOSED',
            },
            lifecycle_label: 'ACTIVE',
            updated_at: new Date().toISOString(),
          },
          route_handoff: null,
          role: 'COUNTERPOINT',
          summary: 'Current branch summary',
          unresolved_points: ['Question 1'],
          resolved_points: [],
          salient_turn_ids: ['turn-2'],
          reason_badges: [],
          semantic_marks: [],
          audience_signals: null,
          guide_score: 1,
          evidence_refs: [],
          public_persona_cues: [],
          public_growth_cues: [],
          updated_at: new Date().toISOString(),
        }],
        flow_phase: 'ESCALATION' as const,
        premise: 'Premise',
        current_tension: 'Tension',
        resolved_points: [],
        open_questions: ['Question 1'],
        must_read_turn_ids: ['turn-2'],
        start_thread_ids: ['thread-1'],
        thread_capsule_ids: ['thread-1'],
        audience_capsule_id: null,
        evidence_refs: [],
        public_persona_cues: [],
        public_growth_cues: [],
        updated_at: new Date().toISOString(),
      },
      semantic_thread_capsule: {
        thread_id: 'thread-1',
      },
      discussion_forest: {
        schema_version: 'forum-discussion-forest.v1',
        projection_id: 'forest-1',
        post_id: 'post-1',
        focus_thread_id: 'thread-1',
        focus_turn_id: 'turn-2',
        reading_guide: {
          schema_version: 'forum-reading-guide.v1',
          post_id: 'post-1',
          entries: [{
            id: 'guide-1',
            thread_id: 'thread-1',
            focus_turn_id: 'turn-2',
            title: '当前分支',
            teaser: 'teaser',
            reason_badges: [],
            participant_count: 1,
            turn_count: 1,
            latest_activity_at: new Date().toISOString(),
            evidence_refs: [],
          }],
          highlighted_thread_ids: ['thread-1'],
          summary_line: 'summary',
          start_here_thread_ids: ['thread-1'],
          current_focus_thread_ids: ['thread-1'],
          must_read_turn_ids: ['turn-2'],
          evidence_refs: [],
          generated_at: new Date().toISOString(),
        },
        branch_groups: [],
        nodes: [{
          schema_version: 'forum-turn-display-projection.v1',
          id: 'turn-2',
          entry_kind: 'TURN' as const,
          post_id: 'post-1',
          thread_id: 'thread-1',
          display_parent_id: 'thread-1',
          display_depth: 1 as const,
          actual_anchor_turn_id: 'turn-1',
          branch_root_turn_id: 'thread-1',
          sibling_order: 1,
          collapsed_anchor_chain: [],
          is_late_entry: false,
          placement_reason: 'DIRECT_REPLY' as const,
          anchor_preview_source: 'VISIBLE_TURN' as const,
          reason_badges: [],
          author: { id: 'agent-2', actor_type: 'agent' as const, display_name: 'Other Bot', avatar_url: null },
          body: 'Focus reply body',
          quoted_excerpt: null,
          evidence_refs: [],
          created_at: new Date().toISOString(),
          generated_at: new Date().toISOString(),
        }],
        latest_activity_cursor: null,
        evidence_refs: [],
        generated_at: new Date().toISOString(),
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
              actor_type: 'agent' as const,
              actor_id: 'agent-2',
              display_name: 'Other Bot',
            },
            community_id: 'community-1',
          },
          participation_contract: {
            stage_open_reply: {
              enabled: true,
              new_thread_enabled: false,
              turn_reply_enabled: false,
            },
            audience_lane: {
              enabled: false,
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
        built_at: new Date().toISOString(),
        post_capsule: {} as never,
        thread_capsule: null,
        perceived_slice: null,
      },
      forum_orchestration_policy: {
        schema_version: 'forum-orchestration-policy.v1',
        scope_type: 'POST' as const,
        scope_id: 'post-1',
        source: 'post_override' as const,
        profile: 'ambient_roaming' as const,
        recall_control: {
          schema_version: 'forum-orchestration-policy.v1',
          pair_window_minutes: 30,
          pair_max_exchanges: 4,
          post_thread_share_cap: 0.6,
          reactive_recall_decay: 'fast' as const,
          newcomer_min_share: 0.1,
          late_entry_min_share: 0.1,
          revive_old_branch_budget: 2,
        },
        compare_debug: {
          schema_version: 'forum-orchestration-policy.v1',
          shadow_enabled: false,
          record_metrics: true,
          include_viewer_telemetry: false,
        },
        cutover: {
          schema_version: 'forum-orchestration-policy.v1',
          selection_enabled: true,
          envelope_enabled: true,
          fallback_to_baseline: true,
        },
        community_default: null,
        post_override: null,
      },
      blocks: {
        hard_control_block: 'hard',
        compact_control_block: 'compact',
        current_context_block: 'context',
        memory_block: 'memory',
        soft_expression_block: 'soft',
      },
      prompt_audit: null,
    }

    const build = vi.fn(async () => context)
    const enrichWithLayers = vi.fn(async (ctx) => ctx)
    const generateVisibleText = vi.fn(async (input: { promptRef: { id: string } }) => {
      if (input.promptRef.id === 'agent-select-forum-arrival') {
        return {
          content: '{"candidate_id":"branch:thread-1","action":"observe_only"}',
          usage: { prompt_tokens: 8, completion_tokens: 2, total_tokens: 10 },
          latencyMs: 5,
          platformRetryCount: 0,
          renderDecision: {
            voiceLineId: 'qwen-social-v1',
            tier: 'lite',
            profileId: 'profile-lite',
            providerId: 'dashscope-openai',
            modelId: 'qwen-plus',
            region: 'cn',
            endpointId: 'default',
            credentialId: 'cred-1',
            fallbackLevel: 'none',
            reasons: ['test'],
            promptTemplateId: 'agent-select-forum-arrival',
            promptVersion: 1,
          },
          promptRef: PROMPT_TEMPLATE_REFS.agentSelectForumArrival,
        }
      }
      return {
        content: JSON.stringify({
          version: 'v1',
          actions: [{ kind: 'no_write', reason: 'observe_only' }],
        }),
        usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 },
        latencyMs: 5,
        platformRetryCount: 0,
        renderDecision: {
          voiceLineId: 'qwen-social-v1',
          tier: 'lite',
          profileId: 'profile-lite',
          providerId: 'dashscope-openai',
          modelId: 'qwen-plus',
          region: 'cn',
          endpointId: 'default',
          credentialId: 'cred-1',
          fallbackLevel: 'none',
          reasons: ['test'],
          promptTemplateId: 'agent-plan-forum-actions',
          promptVersion: 1,
        },
        promptRef: PROMPT_TEMPLATE_REFS.agentPlanForumActions,
      }
    })
    const agentRunCreate = vi.fn()
    const write = vi.fn(async () => ({ success: true, content_id: 'ignored' }))

    const executor = new AgentExecutor({
      llmGateway: { generateVisibleText } as never,
      contextBuilder: { build, enrichWithLayers, retargetForumThreadContext: vi.fn() } as never,
      responseParser: new ResponseParser() as never,
      dataplaneWriter: { write } as never,
      agentRunRepo: { create: agentRunCreate } as never,
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-1', display_name: 'Roaming Bot', model: 'qwen-plus' })),
        getLatestConfig: vi.fn(() => null),
      } as never,
      voteRepo: new InMemoryVoteRepository(),
      inferenceProfileService: {
        resolveVisibleRoute: vi.fn(async ({ requestedTier }) => ({
          homeVoiceLineId: 'qwen-social-v1',
          requestedTier,
        })),
      } as never,
    })

    const [result] = await executor.execute(context.event, {
      event_id: 'evt-thread-no-write',
      quota_applied: 1,
      degradation_level: 'normal',
      agents: [{ agent_id: 'agent-1', score: 1, priority: 1 }],
      skipped_reasons: {},
    })

    expect(result?.success).toBe(true)
    expect(result?.write_instruction).toBeUndefined()
    expect(generateVisibleText).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
    expect(agentRunCreate).toHaveBeenCalledWith(expect.objectContaining({
      input_digest: expect.stringContaining('no_write'),
      output_json: expect.objectContaining({
        no_write: true,
        audit_metadata: expect.objectContaining({
          forum_roaming: expect.objectContaining({
            decision_result: expect.objectContaining({
              action: 'observe_only',
            }),
            resolved_execution_plan: expect.objectContaining({
              write_action: 'no_write',
              validation_status: 'observe_only',
            }),
          }),
        }),
      }),
      token_cost: 0,
    }))
  })

  it('skips roaming arrival selection for later agents when thread reply budget is already exhausted', async () => {
    const threadCapsule = {
      schema_version: 'forum-thread-capsule.v1',
      thread_id: 'thread-1',
      post_id: 'post-1',
      community_id: 'community-1',
      author_id: 'agent-2',
      participant_ids: ['agent-2', 'agent-3'],
      participant_count: 2,
      turn_count: 2,
      latest_turn_id: 'turn-2',
      latest_activity_at: new Date().toISOString(),
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
      updated_at: new Date().toISOString(),
    }
    const baseContext = {
      event: {
        event_id: 'evt-thread-budget-short-circuit',
        event_type: 'ThreadTurnAdded' as const,
        idempotency_key: 'idem-thread-budget-short-circuit',
        chain_depth: 1,
        community_id: 'community-1',
        post_id: 'post-1',
        thread_id: 'thread-1',
        turn_id: 'turn-2',
        author_agent_id: 'agent-2',
        created_at: new Date().toISOString(),
      },
      agent: {
        agent_id: 'agent-1',
        score: 2,
        priority: 2,
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
        description: '验证 reply budget 耗尽后的 roaming 短路',
        rules: '',
      },
      post: {
        id: 'post-1',
        title: '帖子标题',
        body: '帖子正文',
        author_agent_id: 'agent-2',
        author_name: 'Other Bot',
      },
      focusThreadTurn: {
        id: 'turn-2',
        post_id: 'post-1',
        thread_id: 'thread-1',
        entry_kind: 'TURN' as const,
        anchor_turn_id: 'turn-1',
        body: 'Focus reply body',
        author_agent_id: 'agent-3',
        author_name: 'Focus Bot',
      },
      forum_targeting: {
        event_target_entry_id: 'turn-2',
        event_target_thread_id: 'thread-1',
        focus_turn_id: 'turn-2',
        selected_anchor_turn_id: 'turn-2',
        actual_anchor_turn_id: 'turn-1',
        final_write_anchor_turn_id: 'turn-1',
        reply_thread_id: 'thread-1',
        browse_reason: 'REVIVE' as const,
        allowed_actions: ['REPLY', 'START_NEW_THREAD', 'HANDOFF', 'IGNORE'] as const,
      },
      perceived_context_slice: {
        schema_version: 'forum-perceived-context-slice.v1',
        slice_id: 'slice-1',
        agent_id: 'agent-1',
        post_id: 'post-1',
        thread_id: 'thread-1',
        browse_reason: 'REVIVE' as const,
        opportunity_id: 'opp-1',
        focus_turn_id: 'turn-2',
        selected_anchor_turn_id: 'turn-2',
        actual_anchor_turn_id: 'turn-1',
        context_coverage: 'LOCAL_PLUS_POST' as const,
        post_view: {
          premise: 'Premise',
          flow_phase: 'ESCALATION' as const,
          current_tension: 'Tension',
          open_questions: ['Question 1'],
        },
        thread_view: {
          role: 'COUNTERPOINT' as const,
          summary: 'Current branch summary',
          unresolved_points: ['Question 1'],
          thread_state: 'HEATING' as const,
        },
        evidence_window: [],
        unseen_global_notes: [],
        allowed_actions: ['REPLY', 'START_NEW_THREAD', 'HANDOFF', 'IGNORE'] as const,
        visible_node_ids: ['thread-1', 'turn-2'],
        evidence_window_ids: ['turn-2'],
        reason_codes: ['revive_old_branch'],
        post_capsule_excerpt: 'post excerpt',
        branch_capsule_excerpt: 'branch excerpt',
        generated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        built_at: new Date().toISOString(),
      },
      semantic_post_capsule: {
        schema_version: 'forum-post-semantic-capsule.v1',
        post_id: 'post-1',
        community_id: 'community-1',
        thread_count: 1,
        highlighted_thread_ids: ['thread-1'],
        participant_ids: ['agent-1', 'agent-2', 'agent-3'],
        participant_count: 3,
        latest_activity_at: new Date().toISOString(),
        audience_signals: null,
        thread_capsules: [threadCapsule],
        flow_phase: 'ESCALATION' as const,
        premise: 'Premise',
        current_tension: 'Tension',
        resolved_points: [],
        open_questions: ['Question 1'],
        must_read_turn_ids: ['turn-2'],
        start_thread_ids: ['thread-1'],
        thread_capsule_ids: ['thread-1'],
        audience_capsule_id: null,
        evidence_refs: [],
        public_persona_cues: [],
        public_growth_cues: [],
        updated_at: new Date().toISOString(),
      },
      semantic_thread_capsule: threadCapsule,
      discussion_forest: {
        schema_version: 'forum-discussion-forest.v1',
        projection_id: 'forest-1',
        post_id: 'post-1',
        focus_thread_id: 'thread-1',
        focus_turn_id: 'turn-2',
        reading_guide: {
          schema_version: 'forum-reading-guide.v1',
          post_id: 'post-1',
          entries: [{
            id: 'guide-1',
            thread_id: 'thread-1',
            focus_turn_id: 'turn-2',
            title: '当前分支',
            teaser: 'teaser',
            reason_badges: [],
            participant_count: 2,
            turn_count: 2,
            latest_activity_at: new Date().toISOString(),
            evidence_refs: [],
          }],
          highlighted_thread_ids: ['thread-1'],
          summary_line: 'summary',
          start_here_thread_ids: ['thread-1'],
          current_focus_thread_ids: ['thread-1'],
          must_read_turn_ids: ['turn-2'],
          evidence_refs: [],
          generated_at: new Date().toISOString(),
        },
        branch_groups: [],
        nodes: [
          {
            schema_version: 'forum-turn-display-projection.v1',
            id: 'thread-1',
            entry_kind: 'THREAD' as const,
            post_id: 'post-1',
            thread_id: 'thread-1',
            display_parent_id: null,
            display_depth: 0 as const,
            actual_anchor_turn_id: null,
            branch_root_turn_id: null,
            sibling_order: 0,
            collapsed_anchor_chain: [],
            is_late_entry: false,
            placement_reason: 'ROOT_APPEND' as const,
            anchor_preview_source: 'NONE' as const,
            reason_badges: [],
            author: { id: 'agent-2', actor_type: 'agent' as const, display_name: 'Other Bot', avatar_url: null },
            body: 'Thread root',
            quoted_excerpt: null,
            evidence_refs: [],
            created_at: new Date().toISOString(),
            generated_at: new Date().toISOString(),
          },
          {
            schema_version: 'forum-turn-display-projection.v1',
            id: 'turn-2',
            entry_kind: 'TURN' as const,
            post_id: 'post-1',
            thread_id: 'thread-1',
            display_parent_id: 'thread-1',
            display_depth: 1 as const,
            actual_anchor_turn_id: 'turn-1',
            branch_root_turn_id: 'thread-1',
            sibling_order: 1,
            collapsed_anchor_chain: [],
            is_late_entry: true,
            placement_reason: 'LATE_ENTRY_REATTACH' as const,
            anchor_preview_source: 'VISIBLE_TURN' as const,
            reason_badges: ['RETURNED_TO_BRANCH'],
            author: { id: 'agent-3', actor_type: 'agent' as const, display_name: 'Focus Bot', avatar_url: null },
            body: 'Focus reply body',
            quoted_excerpt: null,
            evidence_refs: [],
            created_at: new Date().toISOString(),
            generated_at: new Date().toISOString(),
          },
        ],
        latest_activity_cursor: null,
        evidence_refs: [],
        generated_at: new Date().toISOString(),
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
              actor_type: 'agent' as const,
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
        post_situation: null,
        focus_thread: null,
        evidence_window: null,
        memory_refs: [],
        built_at: new Date().toISOString(),
        post_capsule: {} as never,
        thread_capsule: null,
        perceived_slice: null,
      },
      forum_orchestration_policy: {
        schema_version: 'forum-orchestration-policy.v1',
        scope_type: 'POST' as const,
        scope_id: 'post-1',
        source: 'post_override' as const,
        profile: 'ambient_roaming' as const,
        recall_control: {
          schema_version: 'forum-orchestration-policy.v1',
          pair_window_minutes: 30,
          pair_max_exchanges: 4,
          post_thread_share_cap: 0.6,
          reactive_recall_decay: 'fast' as const,
          newcomer_min_share: 0.1,
          late_entry_min_share: 0.1,
          revive_old_branch_budget: 2,
        },
        compare_debug: {
          schema_version: 'forum-orchestration-policy.v1',
          shadow_enabled: false,
          record_metrics: true,
          include_viewer_telemetry: false,
        },
        cutover: {
          schema_version: 'forum-orchestration-policy.v1',
          selection_enabled: true,
          envelope_enabled: true,
          fallback_to_baseline: true,
        },
        community_default: null,
        post_override: null,
      },
      blocks: {
        hard_control_block: 'hard',
        compact_control_block: 'compact',
        current_context_block: 'context',
        memory_block: 'memory',
        soft_expression_block: 'soft',
      },
      prompt_audit: null,
    }

    const build = vi.fn(async (_event, agent) => {
      const ctx = JSON.parse(JSON.stringify(baseContext))
      ctx.agent = {
        ...ctx.agent,
        agent_id: agent.agent_id,
        score: agent.score,
        priority: agent.priority,
      }
      ctx.perceived_context_slice.agent_id = agent.agent_id
      ctx.forum_runtime_context.agent_id = agent.agent_id
      return ctx
    })
    const enrichWithLayers = vi.fn(async (ctx) => ctx)
    const retargetForumThreadContext = vi.fn(async (ctx) => ({
      ...ctx,
      focusThreadTurn: ctx.focusThreadTurn,
    }))
    const generateVisibleText = vi
      .fn()
      .mockResolvedValueOnce({
        content: '{"candidate_id":"branch:thread-1","action":"reply_in_branch"}',
        usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
        latencyMs: 5,
        platformRetryCount: 0,
        renderDecision: {
          voiceLineId: 'qwen-social-v1',
          tier: 'lite',
          profileId: 'profile-lite',
          providerId: 'dashscope-openai',
          modelId: 'qwen-plus',
          region: 'cn',
          endpointId: 'default',
          credentialId: 'cred-1',
          fallbackLevel: 'none',
          reasons: ['test'],
          promptTemplateId: 'agent-select-forum-arrival',
          promptVersion: 1,
        },
        promptRef: PROMPT_TEMPLATE_REFS.agentSelectForumArrival,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          version: 'v1',
          actions: [{ kind: 'add_thread_turn', target_ref: 'reply_thread' }],
        }),
        usage: { prompt_tokens: 6, completion_tokens: 3, total_tokens: 9 },
        latencyMs: 5,
        platformRetryCount: 0,
        renderDecision: {
          voiceLineId: 'qwen-social-v1',
          tier: 'lite',
          profileId: 'profile-lite',
          providerId: 'dashscope-openai',
          modelId: 'qwen-plus',
          region: 'cn',
          endpointId: 'default',
          credentialId: 'cred-1',
          fallbackLevel: 'none',
          reasons: ['test'],
          promptTemplateId: 'agent-plan-forum-actions',
          promptVersion: 1,
        },
        promptRef: PROMPT_TEMPLATE_REFS.agentPlanForumActions,
      })
      .mockResolvedValueOnce({
        content: '第一位 agent 先把这条分支接住。',
        usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
        latencyMs: 5,
        platformRetryCount: 0,
        renderDecision: {
          voiceLineId: 'qwen-social-v1',
          tier: 'base',
          profileId: 'profile-base',
          providerId: 'dashscope-openai',
          modelId: 'qwen-plus',
          region: 'cn',
          endpointId: 'default',
          credentialId: 'cred-1',
          fallbackLevel: 'none',
          reasons: ['test'],
          promptTemplateId: 'agent-reply-to-thread-turn',
          promptVersion: 4,
        },
        promptRef: PROMPT_TEMPLATE_REFS.agentReplyToThreadTurnScene,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          version: 'v1',
          actions: [
            { kind: 'vote', target_ref: 'event_post', direction: 'UP', confidence: 0.9, rationale_code: 'agree' },
            { kind: 'add_thread_turn', target_ref: 'reply_thread' },
          ],
        }),
        usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
        latencyMs: 5,
        platformRetryCount: 0,
        renderDecision: {
          voiceLineId: 'qwen-social-v1',
          tier: 'lite',
          profileId: 'profile-lite',
          providerId: 'dashscope-openai',
          modelId: 'qwen-plus',
          region: 'cn',
          endpointId: 'default',
          credentialId: 'cred-1',
          fallbackLevel: 'none',
          reasons: ['test'],
          promptTemplateId: 'agent-plan-forum-actions',
          promptVersion: 1,
        },
        promptRef: PROMPT_TEMPLATE_REFS.agentPlanForumActions,
      })
    const write = vi.fn(async () => ({ success: true, content_id: 'content-id' }))
    const resolveVisibleRoute = vi.fn(async ({ requestedTier }) => ({
      homeVoiceLineId: 'qwen-social-v1',
      requestedTier,
    }))

    const executor = new AgentExecutor({
      llmGateway: { generateVisibleText, canServeRoute: vi.fn(() => true) } as never,
      contextBuilder: { build, enrichWithLayers, retargetForumThreadContext } as never,
      responseParser: new ResponseParser() as never,
      dataplaneWriter: { write } as never,
      agentRunRepo: { create: vi.fn() } as never,
      agentService: {
        getAgent: vi.fn((id: string) => ({ id, display_name: `Bot ${id}`, model: 'qwen-plus' })),
        getLatestConfig: vi.fn(() => null),
      } as never,
      voteRepo: new InMemoryVoteRepository(),
      inferenceProfileService: {
        resolveVisibleRoute,
      } as never,
    })

    const results = await executor.execute(baseContext.event, {
      event_id: 'evt-thread-budget-short-circuit',
      quota_applied: 2,
      degradation_level: 'normal',
      agents: [
        { agent_id: 'agent-1', score: 2, priority: 2, selected_anchor_turn_id: 'turn-2' },
        { agent_id: 'agent-4', score: 1, priority: 1, selected_anchor_turn_id: 'turn-2' },
      ],
      skipped_reasons: {},
    })

    expect(results).toHaveLength(2)
    expect(generateVisibleText).toHaveBeenCalledTimes(4)
    expect(generateVisibleText.mock.calls[0]?.[0]).toMatchObject({
      promptRef: PROMPT_TEMPLATE_REFS.agentSelectForumArrival,
      responseMode: 'json_object',
    })
    expect(generateVisibleText.mock.calls[1]?.[0]).toMatchObject({
      promptRef: PROMPT_TEMPLATE_REFS.agentPlanForumActions,
      responseMode: 'json_object',
    })
    expect(generateVisibleText.mock.calls[2]?.[0]).toMatchObject({
      promptRef: PROMPT_TEMPLATE_REFS.agentReplyToThreadTurnScene,
      responseMode: 'text',
    })
    expect(generateVisibleText.mock.calls[3]?.[0]).toMatchObject({
      promptRef: PROMPT_TEMPLATE_REFS.agentPlanForumActions,
      responseMode: 'json_object',
    })
    expect(resolveVisibleRoute).toHaveBeenCalledTimes(2)
    expect(retargetForumThreadContext).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledTimes(2)
    expect(write).toHaveBeenNthCalledWith(1, expect.objectContaining({
      action: 'add_thread_turn',
      thread_id: 'thread-1',
      body: '第一位 agent 先把这条分支接住。',
    }), 'agent-1', 'evt-thread-budget-short-circuit', expect.anything(), expect.any(Number), 1, expect.anything())
    expect(write).toHaveBeenNthCalledWith(2, expect.objectContaining({
      action: 'vote',
      target_type: 'POST',
      target_id: 'post-1',
      direction: 'UP',
      audit_metadata: expect.objectContaining({
        reply_budget_degradation: 'reply_dropped_vote_retained',
      }),
    }), 'agent-4', 'evt-thread-budget-short-circuit', expect.objectContaining({ total_tokens: 14 }), expect.any(Number), 1, null)
    expect(results[1]).toMatchObject({
      agent_id: 'agent-4',
      success: true,
      write_instruction: {
        action: 'vote',
        target_type: 'POST',
        target_id: 'post-1',
        direction: 'UP',
      },
    })
  })

  it('degrades to no-write when the forum action-plan route is not serviceable', async () => {
    const context = {
      event: {
        event_id: 'evt-route-unavailable-1',
        event_type: 'NewPostCreated' as const,
        idempotency_key: 'idem-route-unavailable-1',
        chain_depth: 0,
        community_id: 'community-1',
        post_id: 'post-1',
        author_agent_id: 'agent-2',
        created_at: new Date().toISOString(),
      },
      agent: {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
      persona: {
        name: 'Guarded Bot',
        style: 'precise',
        interests: ['forums'],
        language: 'zh-CN',
      },
      community: {
        id: 'community-1',
        name: '测试社区',
        description: '验证 route serviceability 降级',
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
      prompt_audit: null,
    }

    const build = vi.fn(async () => context)
    const enrichWithLayers = vi.fn(async (ctx) => ctx)
    const canServeRoute = vi.fn(() => false)
    const generateVisibleText = vi.fn()
    const agentRunCreate = vi.fn()
    const write = vi.fn(async () => ({ success: true, content_id: 'ignored' }))

    const executor = new AgentExecutor({
      llmGateway: { generateVisibleText, canServeRoute } as never,
      contextBuilder: { build, enrichWithLayers } as never,
      responseParser: { parse: vi.fn() } as never,
      dataplaneWriter: { write } as never,
      agentRunRepo: { create: agentRunCreate } as never,
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-1', display_name: 'Guarded Bot', model: 'qwen-plus' })),
        getLatestConfig: vi.fn(() => null),
      } as never,
      voteRepo: new InMemoryVoteRepository(),
      inferenceProfileService: {
        resolveVisibleRoute: vi.fn(async ({ requestedTier }) => ({
          homeVoiceLineId: 'doubao-deep-v1',
          requestedTier,
        })),
      } as never,
    })

    const [result] = await executor.execute(context.event, {
      event_id: 'evt-route-unavailable-1',
      quota_applied: 1,
      degradation_level: 'normal',
      agents: [{ agent_id: 'agent-1', score: 1, priority: 1 }],
      skipped_reasons: {},
    })

    expect(result?.success).toBe(true)
    expect(canServeRoute).toHaveBeenCalledWith(expect.objectContaining({
      intent: 'forum_reply',
      scene: 'forum_post',
      responseMode: 'json_object',
      promptRef: PROMPT_TEMPLATE_REFS.agentPlanForumActions,
      requestedTier: 'lite',
      allowFallbackWithinLine: true,
      allowCrossFamily: false,
      localOverrides: {
        executionPolicyId: 'visible-forum_reply-action-plan-lite',
      },
    }))
    expect(generateVisibleText).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
    expect(agentRunCreate).toHaveBeenCalledWith(expect.objectContaining({
      input_digest: expect.stringContaining('reason:route_unavailable'),
      output_json: expect.objectContaining({
        no_write: true,
        reason: 'route_unavailable',
      }),
      token_cost: 0,
    }))
  })

  it('degrades to no-write when the forum action-plan call throws a credential resolution error after route preflight passes', async () => {
    const context = {
      event: {
        event_id: 'evt-route-unavailable-1b',
        event_type: 'NewPostCreated' as const,
        idempotency_key: 'idem-route-unavailable-1b',
        chain_depth: 0,
        community_id: 'community-1',
        post_id: 'post-1',
        author_agent_id: 'agent-2',
        created_at: new Date().toISOString(),
      },
      agent: {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
      persona: {
        name: 'Guarded Bot',
        style: 'precise',
        interests: ['forums'],
        language: 'zh-CN',
      },
      community: {
        id: 'community-1',
        name: '测试社区',
        description: '验证 action-plan 调用阶段的 route degrade',
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
      prompt_audit: null,
    }

    const build = vi.fn(async () => context)
    const enrichWithLayers = vi.fn(async (ctx) => ctx)
    const canServeRoute = vi.fn(() => true)
    const generateVisibleText = vi.fn(async () => {
      throw new Error('Failed to resolve any credential for ark-openai/doubao-seed-2-0-lite-260215')
    })
    const agentRunCreate = vi.fn()
    const write = vi.fn(async () => ({ success: true, content_id: 'ignored' }))

    const executor = new AgentExecutor({
      llmGateway: { generateVisibleText, canServeRoute } as never,
      contextBuilder: { build, enrichWithLayers } as never,
      responseParser: { parse: vi.fn() } as never,
      dataplaneWriter: { write } as never,
      agentRunRepo: { create: agentRunCreate } as never,
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-1', display_name: 'Guarded Bot', model: 'qwen-plus' })),
        getLatestConfig: vi.fn(() => null),
      } as never,
      voteRepo: new InMemoryVoteRepository(),
      inferenceProfileService: {
        resolveVisibleRoute: vi.fn(async ({ requestedTier }) => ({
          homeVoiceLineId: 'qwen-social-v1',
          requestedTier,
        })),
      } as never,
    })

    const [result] = await executor.execute(context.event, {
      event_id: 'evt-route-unavailable-1b',
      quota_applied: 1,
      degradation_level: 'normal',
      agents: [{ agent_id: 'agent-1', score: 1, priority: 1 }],
      skipped_reasons: {},
    })

    expect(result?.success).toBe(true)
    expect(canServeRoute).toHaveBeenCalledOnce()
    expect(generateVisibleText).toHaveBeenCalledOnce()
    expect(write).not.toHaveBeenCalled()
    expect(agentRunCreate).toHaveBeenCalledWith(expect.objectContaining({
      input_digest: expect.stringContaining('reason:route_unavailable'),
      output_json: expect.objectContaining({
        no_write: true,
        reason: 'route_unavailable',
      }),
      token_cost: 0,
    }))
  })

  it('degrades to decision_failed when the forum action-plan call returns empty content', async () => {
    const context = {
      event: {
        event_id: 'evt-empty-plan-1',
        event_type: 'NewPostCreated' as const,
        idempotency_key: 'idem-empty-plan-1',
        chain_depth: 0,
        community_id: 'community-1',
        post_id: 'post-1',
        author_agent_id: 'agent-2',
        created_at: new Date().toISOString(),
      },
      agent: {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
      persona: {
        name: 'Guarded Bot',
        style: 'precise',
        interests: ['forums'],
        language: 'zh-CN',
      },
      community: {
        id: 'community-1',
        name: '测试社区',
        description: '验证 empty action-plan 的受控降级',
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
      prompt_audit: null,
    }

    const build = vi.fn(async () => context)
    const enrichWithLayers = vi.fn(async (ctx) => ctx)
    const canServeRoute = vi.fn(() => true)
    const generateVisibleText = vi.fn(async () => ({
      content: '\u200B\u2060\uFEFF   ',
      usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
      latencyMs: 8,
      platformRetryCount: 0,
      renderDecision: {
        voiceLineId: 'glm-deep-v1',
        tier: 'lite',
        profileId: 'glm-deep-forum-reply-lite',
        providerId: 'zai-openai',
        modelId: 'glm-4.7-flash',
        region: 'cn',
        endpointId: 'zai-cn',
        credentialId: 'cred-1',
        fallbackLevel: 'none',
        reasons: ['test'],
        promptTemplateId: 'agent-plan-forum-actions',
        promptVersion: 1,
      },
      promptRef: PROMPT_TEMPLATE_REFS.agentPlanForumActions,
    }))
    const agentRunCreate = vi.fn()
    const write = vi.fn(async () => ({ success: true, content_id: 'ignored' }))

    const executor = new AgentExecutor({
      llmGateway: { generateVisibleText, canServeRoute } as never,
      contextBuilder: { build, enrichWithLayers } as never,
      responseParser: { parse: vi.fn() } as never,
      dataplaneWriter: { write } as never,
      agentRunRepo: { create: agentRunCreate } as never,
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-1', display_name: 'Guarded Bot', model: 'glm-4.7-flash' })),
        getLatestConfig: vi.fn(() => null),
      } as never,
      voteRepo: new InMemoryVoteRepository(),
      inferenceProfileService: {
        resolveVisibleRoute: vi.fn(async ({ requestedTier }) => ({
          homeVoiceLineId: 'glm-deep-v1',
          requestedTier,
        })),
      } as never,
    })

    const [result] = await executor.execute(context.event, {
      event_id: 'evt-empty-plan-1',
      quota_applied: 1,
      degradation_level: 'normal',
      agents: [{ agent_id: 'agent-1', score: 1, priority: 1 }],
      skipped_reasons: {},
    })

    expect(result?.success).toBe(true)
    expect(canServeRoute).toHaveBeenCalledOnce()
    expect(generateVisibleText).toHaveBeenCalledOnce()
    expect(write).not.toHaveBeenCalled()
    expect(agentRunCreate).toHaveBeenCalledWith(expect.objectContaining({
      input_digest: expect.stringContaining('reason:decision_failed'),
      output_json: expect.objectContaining({
        no_write: true,
        reason: 'decision_failed',
        audit_metadata: expect.objectContaining({
          planner_failure: 'empty_plan',
        }),
      }),
      token_cost: 10,
    }))
  })

  it('parses a forum action-plan after stripping a leading BOM/format characters', async () => {
    const context = {
      event: {
        event_id: 'evt-plan-normalized-1',
        event_type: 'NewPostCreated' as const,
        idempotency_key: 'idem-plan-normalized-1',
        chain_depth: 0,
        community_id: 'community-1',
        post_id: 'post-1',
        author_agent_id: 'agent-2',
        created_at: new Date().toISOString(),
      },
      agent: {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
      persona: {
        name: 'Voting Bot',
        style: 'precise',
        interests: ['forums'],
        language: 'zh-CN',
      },
      community: {
        id: 'community-1',
        name: '测试社区',
        description: '验证 BOM/格式字符前缀的 planner JSON 仍可执行',
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
      prompt_audit: null,
    }

    const build = vi.fn(async () => context)
    const enrichWithLayers = vi.fn(async (ctx) => ctx)
    const canServeRoute = vi.fn(() => true)
    const generateVisibleText = vi.fn(async () => ({
      content: '\uFEFF\u200B' + JSON.stringify({
        version: 'v1',
        actions: [
          { kind: 'vote', target_ref: 'event_post', direction: 'UP', confidence: 0.9, rationale_code: 'agree' },
        ],
      }),
      usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
      latencyMs: 8,
      platformRetryCount: 0,
      renderDecision: {
        voiceLineId: 'glm-deep-v1',
        tier: 'lite',
        profileId: 'glm-deep-forum-reply-lite',
        providerId: 'zai-openai',
        modelId: 'glm-4.7-flash',
        region: 'cn',
        endpointId: 'zai-cn',
        credentialId: 'cred-1',
        fallbackLevel: 'none',
        reasons: ['test'],
        promptTemplateId: 'agent-plan-forum-actions',
        promptVersion: 1,
      },
      promptRef: PROMPT_TEMPLATE_REFS.agentPlanForumActions,
    }))
    const write = vi.fn(async () => ({ success: true, content_id: 'vote-1' }))
    const agentRunCreate = vi.fn()

    const executor = new AgentExecutor({
      llmGateway: { generateVisibleText, canServeRoute } as never,
      contextBuilder: { build, enrichWithLayers } as never,
      responseParser: { parse: vi.fn() } as never,
      dataplaneWriter: { write } as never,
      agentRunRepo: { create: agentRunCreate } as never,
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-1', display_name: 'Voting Bot', model: 'glm-4.7-flash' })),
        getLatestConfig: vi.fn(() => null),
      } as never,
      voteRepo: new InMemoryVoteRepository(),
      inferenceProfileService: {
        resolveVisibleRoute: vi.fn(async ({ requestedTier }) => ({
          homeVoiceLineId: 'glm-deep-v1',
          requestedTier,
        })),
      } as never,
    })

    const [result] = await executor.execute(context.event, {
      event_id: 'evt-plan-normalized-1',
      quota_applied: 1,
      degradation_level: 'normal',
      agents: [{ agent_id: 'agent-1', score: 1, priority: 1 }],
      skipped_reasons: {},
    })

    expect(result?.success).toBe(true)
    expect(write).toHaveBeenCalledOnce()
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'vote',
      target_type: 'POST',
      target_id: 'post-1',
      direction: 'UP',
      rationale_code: 'agree',
    }), 'agent-1', 'evt-plan-normalized-1', expect.objectContaining({ total_tokens: 14 }), expect.any(Number), 0, null)
    expect(agentRunCreate).not.toHaveBeenCalledWith(expect.objectContaining({
      input_digest: expect.stringContaining('reason:decision_failed'),
    }))
  })

  it('degrades to decision_failed with empty_body when forum body generation returns only non-printing content', async () => {
    const context = {
      event: {
        event_id: 'evt-empty-body-1',
        event_type: 'NewPostCreated' as const,
        idempotency_key: 'idem-empty-body-1',
        chain_depth: 0,
        community_id: 'community-1',
        post_id: 'post-1',
        author_agent_id: 'agent-2',
        created_at: new Date().toISOString(),
      },
      agent: {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
      persona: {
        name: 'Reply Bot',
        style: 'precise',
        interests: ['forums'],
        language: 'zh-CN',
      },
      community: {
        id: 'community-1',
        name: '测试社区',
        description: '验证 empty body 分支',
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
      prompt_audit: null,
    }

    const build = vi.fn(async () => context)
    const enrichWithLayers = vi.fn(async (ctx) => ctx)
    const canServeRoute = vi.fn(() => true)
    const generateVisibleText = vi
      .fn()
      .mockResolvedValueOnce({
        content: JSON.stringify({
          version: 'v1',
          actions: [
            { kind: 'open_thread' },
          ],
        }),
        usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
        latencyMs: 8,
        platformRetryCount: 0,
        renderDecision: {
          voiceLineId: 'qwen-social-v1',
          tier: 'lite',
          profileId: 'profile-lite',
          providerId: 'dashscope-openai',
          modelId: 'qwen-plus',
          region: 'cn',
          endpointId: 'default',
          credentialId: 'cred-1',
          fallbackLevel: 'none',
          reasons: ['test'],
          promptTemplateId: 'agent-plan-forum-actions',
          promptVersion: 1,
        },
        promptRef: PROMPT_TEMPLATE_REFS.agentPlanForumActions,
      })
      .mockResolvedValueOnce({
        content: '\u200B\u2060\uFEFF   ',
        usage: { prompt_tokens: 6, completion_tokens: 1, total_tokens: 7 },
        latencyMs: 6,
        platformRetryCount: 0,
        renderDecision: {
          voiceLineId: 'qwen-social-v1',
          tier: 'base',
          profileId: 'profile-base',
          providerId: 'dashscope-openai',
          modelId: 'qwen-plus',
          region: 'cn',
          endpointId: 'default',
          credentialId: 'cred-1',
          fallbackLevel: 'none',
          reasons: ['test'],
          promptTemplateId: 'agent-reply-to-post',
          promptVersion: 1,
        },
        promptRef: PROMPT_TEMPLATE_REFS.agentReplyToPost,
      })
    const agentRunCreate = vi.fn()
    const write = vi.fn(async () => ({ success: true, content_id: 'ignored' }))

    const executor = new AgentExecutor({
      llmGateway: { generateVisibleText, canServeRoute } as never,
      contextBuilder: { build, enrichWithLayers } as never,
      responseParser: { parse: vi.fn() } as never,
      dataplaneWriter: { write } as never,
      agentRunRepo: { create: agentRunCreate } as never,
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-1', display_name: 'Reply Bot', model: 'qwen-plus' })),
        getLatestConfig: vi.fn(() => null),
      } as never,
      voteRepo: new InMemoryVoteRepository(),
      inferenceProfileService: {
        resolveVisibleRoute: vi.fn(async ({ requestedTier }) => ({
          homeVoiceLineId: 'qwen-social-v1',
          requestedTier,
        })),
      } as never,
    })

    const [result] = await executor.execute(context.event, {
      event_id: 'evt-empty-body-1',
      quota_applied: 1,
      degradation_level: 'normal',
      agents: [{ agent_id: 'agent-1', score: 1, priority: 1 }],
      skipped_reasons: {},
    })

    expect(result?.success).toBe(true)
    expect(canServeRoute).toHaveBeenCalledTimes(2)
    expect(generateVisibleText).toHaveBeenCalledTimes(2)
    expect(generateVisibleText.mock.calls[1]?.[0]).toMatchObject({
      promptRef: PROMPT_TEMPLATE_REFS.agentReplyToPost,
      responseMode: 'text',
      requestedTier: 'base',
      allowFallbackWithinLine: true,
      allowCrossFamily: false,
      localOverrides: {
        executionPolicyId: 'visible-forum_reply-post-base',
      },
    })
    expect(write).not.toHaveBeenCalled()
    expect(agentRunCreate).toHaveBeenCalledWith(expect.objectContaining({
      input_digest: expect.stringContaining('reason:decision_failed'),
      output_json: expect.objectContaining({
        no_write: true,
        reason: 'decision_failed',
        audit_metadata: expect.objectContaining({
          planner_failure: 'empty_body',
        }),
      }),
      token_cost: 21,
    }))
  })

  it('keeps a vote-only write when forum body generation normalizes to empty content', async () => {
    const context = {
      event: {
        event_id: 'evt-empty-body-vote-1',
        event_type: 'NewPostCreated' as const,
        idempotency_key: 'idem-empty-body-vote-1',
        chain_depth: 0,
        community_id: 'community-1',
        post_id: 'post-1',
        author_agent_id: 'agent-2',
        created_at: new Date().toISOString(),
      },
      agent: {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
      persona: {
        name: 'Voting Bot',
        style: 'precise',
        interests: ['forums'],
        language: 'zh-CN',
      },
      community: {
        id: 'community-1',
        name: '测试社区',
        description: '验证 empty body 但保留 vote',
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
      prompt_audit: null,
    }

    const build = vi.fn(async () => context)
    const enrichWithLayers = vi.fn(async (ctx) => ctx)
    const canServeRoute = vi.fn(() => true)
    const generateVisibleText = vi
      .fn()
      .mockResolvedValueOnce({
        content: JSON.stringify({
          version: 'v1',
          actions: [
            { kind: 'vote', target_ref: 'event_post', direction: 'UP', confidence: 0.9, rationale_code: 'agree' },
            { kind: 'open_thread' },
          ],
        }),
        usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
        latencyMs: 8,
        platformRetryCount: 0,
        renderDecision: {
          voiceLineId: 'qwen-social-v1',
          tier: 'lite',
          profileId: 'profile-lite',
          providerId: 'dashscope-openai',
          modelId: 'qwen-plus',
          region: 'cn',
          endpointId: 'default',
          credentialId: 'cred-1',
          fallbackLevel: 'none',
          reasons: ['test'],
          promptTemplateId: 'agent-plan-forum-actions',
          promptVersion: 1,
        },
        promptRef: PROMPT_TEMPLATE_REFS.agentPlanForumActions,
      })
      .mockResolvedValueOnce({
        content: '\u200B\u2060\uFEFF   ',
        usage: { prompt_tokens: 6, completion_tokens: 1, total_tokens: 7 },
        latencyMs: 6,
        platformRetryCount: 0,
        renderDecision: {
          voiceLineId: 'qwen-social-v1',
          tier: 'base',
          profileId: 'profile-base',
          providerId: 'dashscope-openai',
          modelId: 'qwen-plus',
          region: 'cn',
          endpointId: 'default',
          credentialId: 'cred-1',
          fallbackLevel: 'none',
          reasons: ['test'],
          promptTemplateId: 'agent-reply-to-post',
          promptVersion: 1,
        },
        promptRef: PROMPT_TEMPLATE_REFS.agentReplyToPost,
      })
    const agentRunCreate = vi.fn()
    const write = vi.fn(async () => ({ success: true, content_id: 'vote-1' }))

    const executor = new AgentExecutor({
      llmGateway: { generateVisibleText, canServeRoute } as never,
      contextBuilder: { build, enrichWithLayers } as never,
      responseParser: { parse: vi.fn() } as never,
      dataplaneWriter: { write } as never,
      agentRunRepo: { create: agentRunCreate } as never,
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-1', display_name: 'Voting Bot', model: 'qwen-plus' })),
        getLatestConfig: vi.fn(() => null),
      } as never,
      voteRepo: new InMemoryVoteRepository(),
      inferenceProfileService: {
        resolveVisibleRoute: vi.fn(async ({ requestedTier }) => ({
          homeVoiceLineId: 'qwen-social-v1',
          requestedTier,
        })),
      } as never,
    })

    const [result] = await executor.execute(context.event, {
      event_id: 'evt-empty-body-vote-1',
      quota_applied: 1,
      degradation_level: 'normal',
      agents: [{ agent_id: 'agent-1', score: 1, priority: 1 }],
      skipped_reasons: {},
    })

    expect(result?.success).toBe(true)
    expect(generateVisibleText).toHaveBeenCalledTimes(2)
    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'vote',
      target_type: 'POST',
      target_id: 'post-1',
      direction: 'UP',
    }), 'agent-1', 'evt-empty-body-vote-1', expect.objectContaining({ total_tokens: 14 }), expect.any(Number), 0, null)
    expect(agentRunCreate).not.toHaveBeenCalledWith(expect.objectContaining({
      input_digest: expect.stringContaining('reason:decision_failed'),
    }))
  })

  it('degrades to no_write when all forum actions are dropped after guardrails', async () => {
    const context = {
      event: {
        event_id: 'evt-all-actions-dropped-1',
        event_type: 'NewPostCreated' as const,
        idempotency_key: 'idem-all-actions-dropped-1',
        chain_depth: 0,
        community_id: 'community-1',
        post_id: 'post-1',
        author_agent_id: 'agent-1',
        created_at: new Date().toISOString(),
      },
      agent: {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
      persona: {
        name: 'Self Voting Bot',
        style: 'precise',
        interests: ['forums'],
        language: 'zh-CN',
      },
      community: {
        id: 'community-1',
        name: '测试社区',
        description: '验证 guardrail 导致的 all_actions_dropped',
        rules: '',
      },
      post: {
        id: 'post-1',
        title: '帖子标题',
        body: '帖子正文',
        author_agent_id: 'agent-1',
        author_name: 'Self Voting Bot',
      },
      blocks: {
        hard_control_block: 'hard',
        compact_control_block: 'compact',
        current_context_block: 'context',
        memory_block: 'memory',
        soft_expression_block: 'soft',
      },
      prompt_audit: null,
    }

    const build = vi.fn(async () => context)
    const enrichWithLayers = vi.fn(async (ctx) => ctx)
    const canServeRoute = vi.fn(() => true)
    const generateVisibleText = vi.fn(async () => ({
      content: JSON.stringify({
        version: 'v1',
        actions: [
          { kind: 'vote', target_ref: 'event_post', direction: 'UP', confidence: 0.9, rationale_code: 'agree' },
        ],
      }),
      usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
      latencyMs: 8,
      platformRetryCount: 0,
      renderDecision: {
        voiceLineId: 'qwen-social-v1',
        tier: 'lite',
        profileId: 'profile-lite',
        providerId: 'dashscope-openai',
        modelId: 'qwen-plus',
        region: 'cn',
        endpointId: 'default',
        credentialId: 'cred-1',
        fallbackLevel: 'none',
        reasons: ['test'],
        promptTemplateId: 'agent-plan-forum-actions',
        promptVersion: 1,
      },
      promptRef: PROMPT_TEMPLATE_REFS.agentPlanForumActions,
    }))
    const agentRunCreate = vi.fn()
    const write = vi.fn(async () => ({ success: true, content_id: 'ignored' }))

    const executor = new AgentExecutor({
      llmGateway: { generateVisibleText, canServeRoute } as never,
      contextBuilder: { build, enrichWithLayers } as never,
      responseParser: { parse: vi.fn() } as never,
      dataplaneWriter: { write } as never,
      agentRunRepo: { create: agentRunCreate } as never,
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-1', display_name: 'Self Voting Bot', model: 'qwen-plus' })),
        getLatestConfig: vi.fn(() => null),
      } as never,
      voteRepo: new InMemoryVoteRepository(),
      inferenceProfileService: {
        resolveVisibleRoute: vi.fn(async ({ requestedTier }) => ({
          homeVoiceLineId: 'qwen-social-v1',
          requestedTier,
        })),
      } as never,
    })

    const [result] = await executor.execute(context.event, {
      event_id: 'evt-all-actions-dropped-1',
      quota_applied: 1,
      degradation_level: 'normal',
      agents: [{ agent_id: 'agent-1', score: 1, priority: 1 }],
      skipped_reasons: {},
    })

    expect(result?.success).toBe(true)
    expect(generateVisibleText).toHaveBeenCalledOnce()
    expect(write).not.toHaveBeenCalled()
    expect(agentRunCreate).toHaveBeenCalledWith(expect.objectContaining({
      input_digest: expect.stringContaining('reason:no_write'),
      output_json: expect.objectContaining({
        no_write: true,
        reason: 'no_write',
        audit_metadata: expect.objectContaining({
          execution_degradation: 'all_actions_dropped',
          vote_dropped_by_guardrail: true,
          text_dropped_by: null,
        }),
      }),
      token_cost: 14,
    }))
  })

  it('keeps a vote-only write when the forum body route is not serviceable', async () => {
    const context = {
      event: {
        event_id: 'evt-route-unavailable-2',
        event_type: 'NewPostCreated' as const,
        idempotency_key: 'idem-route-unavailable-2',
        chain_depth: 0,
        community_id: 'community-1',
        post_id: 'post-1',
        author_agent_id: 'agent-2',
        created_at: new Date().toISOString(),
      },
      agent: {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
      persona: {
        name: 'Voting Bot',
        style: 'precise',
        interests: ['forums'],
        language: 'zh-CN',
      },
      community: {
        id: 'community-1',
        name: '测试社区',
        description: '验证 body route 不可用时的 vote-only 降级',
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
      prompt_audit: null,
    }

    const build = vi.fn(async () => context)
    const enrichWithLayers = vi.fn(async (ctx) => ctx)
    const canServeRoute = vi
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
    const generateVisibleText = vi.fn(async () => ({
      content: JSON.stringify({
        version: 'v1',
        actions: [
          { kind: 'vote', target_ref: 'event_post', direction: 'UP', confidence: 0.9, rationale_code: 'agree' },
          { kind: 'open_thread' },
        ],
      }),
      usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
      latencyMs: 8,
      platformRetryCount: 0,
      renderDecision: {
        voiceLineId: 'qwen-social-v1',
        tier: 'lite',
        profileId: 'profile-lite',
        providerId: 'dashscope-openai',
        modelId: 'qwen-plus',
        region: 'cn',
        endpointId: 'default',
        credentialId: 'cred-1',
        fallbackLevel: 'none',
        reasons: ['test'],
        promptTemplateId: 'agent-plan-forum-actions',
        promptVersion: 1,
      },
      promptRef: PROMPT_TEMPLATE_REFS.agentPlanForumActions,
    }))
    const write = vi.fn(async () => ({ success: true, content_id: 'vote-1' }))

    const executor = new AgentExecutor({
      llmGateway: { generateVisibleText, canServeRoute } as never,
      contextBuilder: { build, enrichWithLayers } as never,
      responseParser: { parse: vi.fn() } as never,
      dataplaneWriter: { write } as never,
      agentRunRepo: { create: vi.fn() } as never,
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-1', display_name: 'Voting Bot', model: 'qwen-plus' })),
        getLatestConfig: vi.fn(() => null),
      } as never,
      voteRepo: new InMemoryVoteRepository(),
      inferenceProfileService: {
        resolveVisibleRoute: vi.fn(async ({ requestedTier }) => ({
          homeVoiceLineId: 'qwen-social-v1',
          requestedTier,
        })),
      } as never,
    })

    const [result] = await executor.execute(context.event, {
      event_id: 'evt-route-unavailable-2',
      quota_applied: 1,
      degradation_level: 'normal',
      agents: [{ agent_id: 'agent-1', score: 1, priority: 1 }],
      skipped_reasons: {},
    })

    expect(result?.success).toBe(true)
    expect(canServeRoute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      promptRef: PROMPT_TEMPLATE_REFS.agentPlanForumActions,
      responseMode: 'json_object',
      requestedTier: 'lite',
      allowFallbackWithinLine: true,
      allowCrossFamily: false,
    }))
    expect(canServeRoute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      promptRef: PROMPT_TEMPLATE_REFS.agentReplyToPost,
      responseMode: 'text',
      requestedTier: 'base',
      allowFallbackWithinLine: true,
      allowCrossFamily: false,
      localOverrides: {
        executionPolicyId: 'visible-forum_reply-post-base',
      },
    }))
    expect(generateVisibleText).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'vote',
      target_type: 'POST',
      target_id: 'post-1',
      direction: 'UP',
      audit_metadata: expect.objectContaining({
        body_generation_degradation: 'route_unavailable_vote_retained',
      }),
    }), 'agent-1', 'evt-route-unavailable-2', expect.objectContaining({ total_tokens: 14 }), expect.any(Number), 0, null)
    expect(result?.write_instruction).toMatchObject({
      action: 'vote',
      target_type: 'POST',
      target_id: 'post-1',
      direction: 'UP',
    })
  })

  it('keeps a vote-only write when the forum body call throws a credential resolution error after route preflight passes', async () => {
    const context = {
      event: {
        event_id: 'evt-route-unavailable-2b',
        event_type: 'NewPostCreated' as const,
        idempotency_key: 'idem-route-unavailable-2b',
        chain_depth: 0,
        community_id: 'community-1',
        post_id: 'post-1',
        author_agent_id: 'agent-2',
        created_at: new Date().toISOString(),
      },
      agent: {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
      persona: {
        name: 'Voting Bot',
        style: 'precise',
        interests: ['forums'],
        language: 'zh-CN',
      },
      community: {
        id: 'community-1',
        name: '测试社区',
        description: '验证 body 调用阶段的 vote-only degrade',
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
      prompt_audit: null,
    }

    const build = vi.fn(async () => context)
    const enrichWithLayers = vi.fn(async (ctx) => ctx)
    const canServeRoute = vi.fn(() => true)
    const generateVisibleText = vi
      .fn()
      .mockResolvedValueOnce({
        content: JSON.stringify({
          version: 'v1',
          actions: [
            { kind: 'vote', target_ref: 'event_post', direction: 'UP', confidence: 0.9, rationale_code: 'agree' },
            { kind: 'open_thread' },
          ],
        }),
        usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
        latencyMs: 8,
        platformRetryCount: 0,
        renderDecision: {
          voiceLineId: 'qwen-social-v1',
          tier: 'lite',
          profileId: 'profile-lite',
          providerId: 'dashscope-openai',
          modelId: 'qwen-plus',
          region: 'cn',
          endpointId: 'default',
          credentialId: 'cred-1',
          fallbackLevel: 'none',
          reasons: ['test'],
          promptTemplateId: 'agent-plan-forum-actions',
          promptVersion: 1,
        },
        promptRef: PROMPT_TEMPLATE_REFS.agentPlanForumActions,
      })
      .mockImplementationOnce(async () => {
        throw new Error('Failed to resolve any credential for ark-openai/doubao-seed-2-0-lite-260215')
      })
    const write = vi.fn(async () => ({ success: true, content_id: 'vote-1' }))

    const executor = new AgentExecutor({
      llmGateway: { generateVisibleText, canServeRoute } as never,
      contextBuilder: { build, enrichWithLayers } as never,
      responseParser: { parse: vi.fn() } as never,
      dataplaneWriter: { write } as never,
      agentRunRepo: { create: vi.fn() } as never,
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-1', display_name: 'Voting Bot', model: 'qwen-plus' })),
        getLatestConfig: vi.fn(() => null),
      } as never,
      voteRepo: new InMemoryVoteRepository(),
      inferenceProfileService: {
        resolveVisibleRoute: vi.fn(async ({ requestedTier }) => ({
          homeVoiceLineId: 'qwen-social-v1',
          requestedTier,
        })),
      } as never,
    })

    const [result] = await executor.execute(context.event, {
      event_id: 'evt-route-unavailable-2b',
      quota_applied: 1,
      degradation_level: 'normal',
      agents: [{ agent_id: 'agent-1', score: 1, priority: 1 }],
      skipped_reasons: {},
    })

    expect(result?.success).toBe(true)
    expect(canServeRoute).toHaveBeenCalledTimes(2)
    expect(generateVisibleText).toHaveBeenCalledTimes(2)
    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'vote',
      target_type: 'POST',
      target_id: 'post-1',
      direction: 'UP',
      audit_metadata: expect.objectContaining({
        body_generation_degradation: 'route_unavailable_vote_retained',
      }),
    }), 'agent-1', 'evt-route-unavailable-2b', expect.objectContaining({ total_tokens: 14 }), expect.any(Number), 0, null)
    expect(result?.write_instruction).toMatchObject({
      action: 'vote',
      target_type: 'POST',
      target_id: 'post-1',
      direction: 'UP',
    })
  })

  it('propagates governed event lineage into runtime writes', async () => {
    const context = {
      event: {
        event_id: 'evt-governed-1',
        event_type: 'NewPostCreated' as const,
        idempotency_key: 'idem-governed-1',
        chain_depth: 1,
        community_id: 'community-1',
        post_id: 'post-1',
        author_agent_id: 'agent-2',
        governance_batch_id: 'warmup-batch-1',
        generation_mode: 'warmup_runtime' as const,
        created_at: new Date().toISOString(),
      },
      agent: {
        agent_id: 'agent-1',
        score: 1,
        priority: 1,
      },
      persona: {
        name: 'Governed Bot',
        style: 'precise',
        interests: ['forums'],
        language: 'zh-CN',
      },
      community: {
        id: 'community-1',
        name: '测试社区',
        description: '验证 governed lineage 传递',
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
      prompt_audit: null,
    }

    const build = vi.fn(async () => context)
    const enrichWithLayers = vi.fn(async (ctx) => ctx)
    const generateVisibleText = vi.fn(async (input: { promptRef: { id: string } }) => {
      if (input.promptRef.id === 'agent-plan-forum-actions') {
        return {
          content: JSON.stringify({
            version: 'v1',
            actions: [{ kind: 'open_thread' }],
          }),
          usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
          latencyMs: 8,
          platformRetryCount: 0,
          renderDecision: {
            voiceLineId: 'qwen-social-v1',
            tier: 'lite',
            profileId: 'profile-1',
            providerId: 'dashscope-openai',
            modelId: 'qwen-plus',
            region: 'cn',
            endpointId: 'default',
            credentialId: 'cred-1',
            fallbackLevel: 'none',
            reasons: ['test'],
            promptTemplateId: 'agent-plan-forum-actions',
            promptVersion: 1,
          },
          promptRef: PROMPT_TEMPLATE_REFS.agentPlanForumActions,
        }
      }
      return {
        content: '这条我先接成一个新 thread。',
        usage: { prompt_tokens: 10, completion_tokens: 6, total_tokens: 16 },
        latencyMs: 8,
        platformRetryCount: 0,
        renderDecision: {
          voiceLineId: 'qwen-social-v1',
          tier: 'base',
          profileId: 'profile-1',
          providerId: 'dashscope-openai',
          modelId: 'qwen-plus',
          region: 'cn',
          endpointId: 'default',
          credentialId: 'cred-1',
          fallbackLevel: 'none',
          reasons: ['test'],
          promptTemplateId: 'agent-reply-to-post',
          promptVersion: 1,
        },
        promptRef: PROMPT_TEMPLATE_REFS.agentReplyToPostScene,
      }
    })
    const write = vi.fn(async () => ({ success: true, content_id: 'thread-1' }))

    const executor = new AgentExecutor({
      llmGateway: { generateVisibleText } as never,
      contextBuilder: { build, enrichWithLayers } as never,
      responseParser: { parse: vi.fn() } as never,
      dataplaneWriter: { write } as never,
      agentRunRepo: { create: vi.fn() } as never,
      agentService: {
        getAgent: vi.fn(() => ({ id: 'agent-1' })),
        getLatestConfig: vi.fn(() => null),
      } as never,
      voteRepo: new InMemoryVoteRepository(),
      inferenceProfileService: {
        resolveVisibleRoute: vi.fn(async () => ({
          homeVoiceLineId: 'qwen-social-v1',
          requestedTier: 'base',
        })),
      } as never,
    })

    const [result] = await executor.execute(context.event, {
      event_id: 'evt-governed-1',
      quota_applied: 1,
      degradation_level: 'normal',
      agents: [{ agent_id: 'agent-1', score: 1, priority: 1 }],
      skipped_reasons: {},
    })

    expect(result?.success).toBe(true)
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'open_thread',
      governance_context: {
        governance_batch_id: 'warmup-batch-1',
        generation_mode: 'warmup_runtime',
      },
    }), 'agent-1', 'evt-governed-1', expect.anything(), expect.any(Number), 1, expect.anything())
  })
})
