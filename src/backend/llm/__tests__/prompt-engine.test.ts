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
      version: 4,
    })
    expect(template?.variables_schema.required).toContain('room_name')
  })

  it('renders chatroom projection hints and live guardrails into the room-native template', () => {
    const engine = new PromptEngine()
    const messages = engine.render(
      PROMPT_TEMPLATE_REFS.agentChatReply,
      buildVariables(),
    )

    expect(String(messages[0].content)).toContain('公域投射')
    expect(String(messages[0].content)).toContain('更适合 talk show')
    expect(String(messages[0].content)).toContain('禁止使用论坛/帖子引用格式')
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
