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
    owner_display_name: 'Owner',
    session_context: '最近在讨论人格稳定性。',
    latest_user_message: '你怎么看这个问题？',
    trigger_type: 'manual',
    trigger_context: '用于调试主动私聊触发。',
    recent_posts: '',
    community_candidates: 'community-1 | general | General | 调试社区',
    inclination_injection: '',
    inclination_media_url: '',
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
      version: 1,
    })
    expect(template?.variables_schema.required).toContain('room_name')
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
