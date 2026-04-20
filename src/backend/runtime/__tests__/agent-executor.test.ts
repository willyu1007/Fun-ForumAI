import { describe, expect, it, vi } from 'vitest'
import { AgentExecutor } from '../agent-executor.js'
import { ResponseParser } from '../response-parser.js'
import { PROMPT_TEMPLATE_REFS } from '../../llm/prompt-template-refs.js'

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
      inferenceProfileService: {
        resolveVisibleRoute: vi.fn(async () => ({
          homeVoiceLineId: 'qwen-social-v1',
          requestedTier: 'base',
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
      promptRef: PROMPT_TEMPLATE_REFS.agentReplyToThreadTurn,
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
      inferenceProfileService: {
        resolveVisibleRoute: vi.fn(async ({ requestedTier }) => ({
          homeVoiceLineId: 'qwen-social-v1',
          requestedTier,
        })),
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
    expect(generateVisibleText).toHaveBeenCalledTimes(2)
    expect(generateVisibleText.mock.calls[0]?.[0]).toMatchObject({
      responseMode: 'json_object',
      promptRef: PROMPT_TEMPLATE_REFS.agentSelectForumArrival,
      localOverrides: {
        executionPolicyId: 'visible-forum_reply-selection-lite',
      },
    })
    expect(generateVisibleText.mock.calls[1]?.[0]).toMatchObject({
      responseMode: 'text',
      promptRef: PROMPT_TEMPLATE_REFS.agentReplyToThreadTurnScene,
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
    }), 'agent-1', 'evt-thread-roam', expect.objectContaining({ total_tokens: 30 }), expect.any(Number), 1, expect.anything())
    expect(enrichWithLayers).toHaveBeenCalledTimes(2)
    expect(retargetForumThreadContext).toHaveBeenCalledTimes(1)
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
    const generateVisibleText = vi.fn(async () => ({
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
    }))
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
            }),
          }),
        }),
      }),
      token_cost: 10,
    }))
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
    const generateVisibleText = vi.fn(async () => ({
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
    }))
    const parse = vi.fn(() => ({
      action: 'open_thread' as const,
      community_id: 'community-1',
      post_id: 'post-1',
      body: '这条我先接成一个新 thread。',
    }))
    const write = vi.fn(async () => ({ success: true, content_id: 'thread-1' }))

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
