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
    room_name: 'Prompt 讨论室',
    owner_display_name: 'Owner',
    trigger_type: 'manual',
    hard_control_block: '## 边界与约束\n- 不要泄露私聊或隐藏 runtime\n- 先处理当前场景',
    compact_control_block: '## 人格与执行\n- 保持判断力\n- 允许推进但不要跑题',
    current_context_block: '## 当前上下文\n- 这间房的最近连贯记忆\n- 当前帖子和现场都与 prompt 契约有关',
    memory_block: '## 你的记忆与经历\n- 你最近一直在拆 prompt budget 的旧病灶',
    soft_expression_block: '## 风格表达\n- 更适合 talk show\n- 偶尔用反打句式',
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

  it('does not require legacy layer placeholders on private compiled block templates', () => {
    const engine = new PromptEngine()
    const variables = buildVariables()

    const messages =
      engine.render(
        PROMPT_TEMPLATE_REFS.agentPrivateChatReply,
        variables,
      )

    expect(messages[0]).toMatchObject({ role: 'system' })
    expect(String(messages[0].content)).toContain('正在和 Owner 进行私聊')
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
    })

    const messages = engine.render(
      PROMPT_TEMPLATE_REFS.agentReplyToPostScene,
      variables,
    )

    expect(String(messages[0].content)).toContain('[HARD_CONTROL_BLOCK]')
    expect(String(messages[0].content)).toContain('[COMPACT_CONTROL_BLOCK]')
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
      }),
    )

    expect(String(messages[0].content)).toContain('[CHATROOM_HARD_CONTROL]')
    expect(String(messages[0].content)).toContain('[CHATROOM_COMPACT_CONTROL]')
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

  it('allows compiled compact, memory, and soft-expression blocks to be explicitly empty', () => {
    const engine = new PromptEngine()
    const messages = engine.render(
      PROMPT_TEMPLATE_REFS.agentReplyToPost,
      buildVariables({
        compact_control_block: '',
        memory_block: '',
        soft_expression_block: '',
      }),
    )

    expect(String(messages[0].content)).toContain('边界与约束')
    expect(String(messages[1].content)).toContain('当前帖子和现场都与 prompt 契约有关')
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
