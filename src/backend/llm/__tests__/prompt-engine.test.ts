import { describe, expect, it } from 'vitest'
import { PromptEngine } from '../prompt-engine.js'
import { LLMGatewayContractError } from '../gateway-contract.js'
import { PROMPT_TEMPLATE_REFS } from '../prompt-template-refs.js'

function buildVariables(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    persona_name: '测试角色',
    persona_style: '冷静而有判断力',
    persona_interests: '模型,产品',
    persona_language: 'zh-CN',
    persona_seed_code: 'scholar',
    community_name: '调试社区',
    community_description: '一个用于调试的社区',
    community_rules: '保持讨论具体。',
    post_title: '如何做 prompt 契约',
    post_body: '请给出一个可执行方案。',
    post_author: '发帖人',
    existing_comments: '',
    thread_context: '',
    target_comment_author: '评论者',
    target_comment_body: '我想继续追问。',
    room_name: 'Prompt 讨论室',
    room_description: '围绕 Prompt 设计交流。',
    recent_messages: 'A: 最近在做 prompt version contract',
    program_scene: 'TALK_SHOW',
    current_beat: 'CALLBACK',
    cue_type: 'CALLBACK',
    director_goal: '把 benchmark 神话拆开重讲',
    self_role: 'FOIL',
    cast_snapshot: '- Host (HOST)\n- Guest (FOIL)',
    live_hook: 'Host 正在追问 benchmark 崇拜到底该不该拆。',
    unresolved_question: 'benchmark 到底是指标还是幻觉？',
    last_highlight: '昨晚那句“benchmark 不是信仰”炸了。',
    public_projection_hint: '更适合 talk show · 擅长回收梗',
    signature_moves: '反打、接梗',
    shared_memory_summary: '最近总在拿 benchmark 开刀。',
    role_hint: 'FOIL',
    projection_updated_at: '2026-03-10T00:00:00.000Z',
    owner_display_name: 'Owner',
    session_context: '最近在讨论人格稳定性。',
    latest_user_message: '你怎么看这个问题？',
    trigger_type: 'manual',
    trigger_context: '用于调试主动私聊触发。',
    recent_posts: '',
    community_candidates: 'community-1 | general | General | 调试社区',
    inclination_injection: '',
    inclination_media_url: '',
    hard_control_block: '## 边界与约束\n- 不要泄露私聊或隐藏 runtime\n- 先处理当前场景',
    compact_control_block: '## 人格与执行\n- 保持判断力\n- 允许推进但不要跑题',
    current_context_block: '## 当前上下文\n- 这间房的最近连贯记忆\n- 当前帖子和现场都与 prompt 契约有关',
    memory_block: '## 你的记忆与经历\n- 你最近一直在拆 prompt budget 的旧病灶',
    soft_expression_block: '## 风格表达\n- 更适合 talk show\n- 偶尔用反打句式',
    local_intent_block: '## Local Intent\n- episode_id: test-episode\n- initiative: reply',
    topic: '提示词治理',
    layer_traits: '',
    layer_style: '',
    layer_instructions: '',
    layer_community: '',
    layer_relationship: '',
    layer_showrunner: '',
    layer_overrides: '',
    layer_memory: '',
    layer_privacy: '',
    ...overrides,
  }
}

describe('PromptEngine', () => {
  it('renders templates by explicit id+version ref', () => {
    const engine = new PromptEngine()
    const messages = engine.render(
      PROMPT_TEMPLATE_REFS.agentReplyToPost,
      buildVariables(),
    )

    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatchObject({ role: 'system' })
    expect(messages[1]).toMatchObject({ role: 'user' })
    expect(String(messages[0].content)).toContain('测试角色')
  })

  it('exposes versioned template metadata', () => {
    const engine = new PromptEngine()
    const template = engine.getTemplate(PROMPT_TEMPLATE_REFS.agentChatReply)

    expect(template).toBeDefined()
    expect(template).toMatchObject({
      prompt_template_id: 'agent-chat-reply',
      version: 6,
    })
    expect(template?.variables_schema.required).toContain('room_name')
  })

  it('renders chatroom templates through the compiled block contract', () => {
    const engine = new PromptEngine()
    const messages = engine.render(
      PROMPT_TEMPLATE_REFS.agentChatReply,
      buildVariables(),
    )

    expect(String(messages[0].content)).toContain('边界与约束')
    expect(String(messages[0].content)).toContain('更适合 talk show')
    expect(String(messages[0].content)).toContain('不要使用论坛/帖子引用格式')
    expect(String(messages[0].content)).toContain('第一行先给态度、判断或推进句')
    expect(String(messages[1].content)).toContain('这间房的最近连贯记忆')
  })

  it('rejects missing required variables from schema', () => {
    const engine = new PromptEngine()

    expect(() =>
      engine.render(
        PROMPT_TEMPLATE_REFS.agentChatReply,
        buildVariables({ room_name: '' }),
      ),
    ).toThrowError(LLMGatewayContractError)

    try {
      engine.render(PROMPT_TEMPLATE_REFS.agentChatReply, buildVariables({ room_name: '' }))
    } catch (error) {
      expect(error).toBeInstanceOf(LLMGatewayContractError)
      expect((error as LLMGatewayContractError).code).toBe('PromptValidationError')
    }
  })

  it('allows private boundary templates to ignore legacy layer_showrunner', () => {
    const engine = new PromptEngine()
    const variables = buildVariables()
    delete variables.layer_showrunner

    const messages =
      engine.render(
        PROMPT_TEMPLATE_REFS.agentPrivateChatReply,
        variables,
      )

    expect(messages[0]).toMatchObject({ role: 'system' })
    expect(String(messages[0].content)).toContain('正在和 Owner 进行私聊')
    expect(String(messages[0].content)).not.toContain('{{layer_showrunner}}')
  })

  it('keeps placeholder validation strict for non-private compiled block templates', () => {
    const engine = new PromptEngine()
    const variables = buildVariables()
    delete variables.hard_control_block

    expect(() =>
      engine.render(
        PROMPT_TEMPLATE_REFS.agentReplyToPost,
        variables,
      ),
    ).toThrowError(LLMGatewayContractError)
  })

  it('renders scene-enabled forum templates with V2 compiled blocks', () => {
    const engine = new PromptEngine()
    const variables = buildVariables({
      hard_control_block: '[HARD_CONTROL_BLOCK]',
      compact_control_block: '[COMPACT_CONTROL_BLOCK]',
      current_context_block: '[CURRENT_CONTEXT_BLOCK]',
      layer_showrunner: '[LEGACY_SHOWRUNNER]',
    })

    const messages = engine.render(
      PROMPT_TEMPLATE_REFS.agentReplyToPostScene,
      variables,
    )

    expect(String(messages[0].content)).toContain('[HARD_CONTROL_BLOCK]')
    expect(String(messages[0].content)).toContain('[COMPACT_CONTROL_BLOCK]')
    expect(String(messages[0].content)).not.toContain('[LEGACY_SHOWRUNNER]')
    expect(String(messages[1].content)).toContain('[CURRENT_CONTEXT_BLOCK]')
  })

  it('renders scene-enabled chatroom templates with compiled block variables as the primary carrier', () => {
    const engine = new PromptEngine()
    const messages = engine.render(
      PROMPT_TEMPLATE_REFS.agentChatReplyScene,
      buildVariables({
        hard_control_block: '[CHATROOM_HARD_CONTROL]',
        compact_control_block: '[CHATROOM_COMPACT_CONTROL]',
        current_context_block: '[ROOM_CURRENT_CONTEXT]',
        layer_showrunner: '[LEGACY_SHOWRUNNER]',
      }),
    )

    expect(String(messages[0].content)).toContain('[CHATROOM_HARD_CONTROL]')
    expect(String(messages[0].content)).toContain('[CHATROOM_COMPACT_CONTROL]')
    expect(String(messages[0].content)).not.toContain('[LEGACY_SHOWRUNNER]')
    expect(String(messages[1].content)).toContain('[ROOM_CURRENT_CONTEXT]')
  })

  it('requires hard_control_block for scene-enabled scheduled_post template', () => {
    const engine = new PromptEngine()
    const variables = buildVariables()
    delete variables.hard_control_block

    expect(() =>
      engine.render(
        PROMPT_TEMPLATE_REFS.agentCreatePostScene,
        variables,
      ),
    ).toThrowError(LLMGatewayContractError)
  })

  it('requires current_context_block for scene-enabled chatroom template', () => {
    const engine = new PromptEngine()
    const variables = buildVariables()
    delete variables.current_context_block

    expect(() =>
      engine.render(
        PROMPT_TEMPLATE_REFS.agentChatReplyScene,
        variables,
      ),
    ).toThrowError(LLMGatewayContractError)
  })

  it('rejects unknown prompt refs instead of falling back by template id', () => {
    const engine = new PromptEngine()

    expect(() =>
      engine.render(
        { id: 'agent-chat-reply', version: 999 },
        buildVariables(),
      ),
    ).toThrowError(LLMGatewayContractError)

    try {
      engine.render({ id: 'agent-chat-reply', version: 999 }, buildVariables())
    } catch (error) {
      expect(error).toBeInstanceOf(LLMGatewayContractError)
      expect((error as LLMGatewayContractError).code).toBe('RegistryResolutionError')
    }
  })

  it('fails fast when the prompt registry cannot be loaded', () => {
    expect(() => new PromptEngine('/definitely-missing/prompt_templates.yaml')).toThrowError(
      LLMGatewayContractError,
    )
  })
})
