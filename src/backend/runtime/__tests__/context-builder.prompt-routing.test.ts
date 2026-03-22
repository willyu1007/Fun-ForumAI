import { describe, expect, it, vi } from 'vitest'
import { ContextBuilder } from '../context-builder.js'
import type { ExecutionContext } from '../types.js'
import type { ContextBuilderDeps } from '../context-builder.js'

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
