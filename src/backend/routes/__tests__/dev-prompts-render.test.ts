import type { Express } from 'express'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

function createDevToken(user: { userId: string; email: string; role: 'user' | 'admin' }): string {
  return Buffer.from(JSON.stringify(user)).toString('base64url')
}

async function loadAppWithNodeEnv(nodeEnv: 'test' | 'production'): Promise<Express> {
  const previousNodeEnv = process.env.NODE_ENV
  const previousJwtSecret = process.env.JWT_SECRET
  const previousServiceSecret = process.env.SERVICE_AUTH_SECRET
  process.env.NODE_ENV = nodeEnv
  process.env.JWT_SECRET = 'test-jwt-secret'
  process.env.SERVICE_AUTH_SECRET = 'test-service-secret'
  vi.resetModules()
  const mod = await import('../../app.js')
  process.env.NODE_ENV = previousNodeEnv
  process.env.JWT_SECRET = previousJwtSecret
  process.env.SERVICE_AUTH_SECRET = previousServiceSecret
  return mod.app
}

async function createAgent(app: Express, displayName: string): Promise<string> {
  const token = createDevToken({
    userId: 't034-user',
    email: 't034@example.com',
    role: 'user',
  })

  const res = await request(app)
    .post('/v1/agents')
    .set('Authorization', `Bearer ${token}`)
    .send({ display_name: displayName })

  expect(res.status).toBe(201)
  return res.body.data.id as string
}

describe('POST /v1/dev/prompts/render', () => {
  let devApp: Express

  beforeAll(async () => {
    devApp = await loadAppWithNodeEnv('test')
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await request(devApp)
      .post('/v1/dev/prompts/render')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 when agent_id does not exist', async () => {
    const res = await request(devApp)
      .post('/v1/dev/prompts/render')
      .send({
        agent_id: 'agent-does-not-exist',
        template_id: 'agent-chat-reply',
        scene: 'chat_room',
      })

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('rejects archived-version requests and resolves latest visible templates only', async () => {
    const agentId = await createAgent(devApp, 'T034 Archived Version Bot')

    const res = await request(devApp)
      .post('/v1/dev/prompts/render')
      .send({
        agent_id: agentId,
        template_id: 'agent-chat-reply',
        template_version: 2,
        scene: 'chat_room',
      })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('renders forum template with compiled blocks injected', async () => {
    const agentId = await createAgent(devApp, 'T034 Forum Bot')

    const markers = {
      hard_control_block: '[HARD_CONTROL]',
      compact_control_block: '[COMPACT_CONTROL]',
      current_context_block: '[CURRENT_CONTEXT]',
      memory_block: '[MEMORY_BLOCK]',
      soft_expression_block: '[SOFT_EXPRESSION]',
    }

    const res = await request(devApp)
      .post('/v1/dev/prompts/render')
      .send({
        agent_id: agentId,
        template_id: 'agent-reply-to-post',
        scene: 'forum_post',
        conversation_text: '请对这个观点给出回应',
        variables: markers,
      })

    expect(res.status).toBe(200)
    const systemMessage = (res.body.data.messages as Array<{ role: string; content: string }>)
      .find((m) => m.role === 'system')
    const userMessage = (res.body.data.messages as Array<{ role: string; content: string }>)
      .find((m) => m.role === 'user')
    expect(systemMessage).toBeDefined()
    expect(systemMessage?.content).toContain(markers.hard_control_block)
    expect(systemMessage?.content).toContain(markers.compact_control_block)
    expect(systemMessage?.content).toContain(markers.memory_block)
    expect(systemMessage?.content).toContain(markers.soft_expression_block)
    expect(userMessage?.content).toContain(markers.current_context_block)
    expect(res.body.data.identity_contract).toMatchObject({
      source: 'contract_v1',
      persona_seed_code: 'scholar',
      home_voice_line_id: 'qwen-social-v1',
    })
    expect(res.body.data.audit).toMatchObject({
      version: 'v2',
      scene: 'forum_post',
    })
    expect(Array.isArray(res.body.data.audit.includedBlockIds)).toBe(true)
    expect(res.body.data.audit).toHaveProperty('tokenEstimates')
    expect(res.body.data.audit).toHaveProperty('lintWarnings')
    expect(res.body.data.audit).toHaveProperty('trimReasons')
    expect(res.body.data.layers).toBeUndefined()
    expect(Object.keys(res.body.data.blocks as Record<string, unknown>).every((key) => !key.startsWith('layer_'))).toBe(true)
    expect(res.body.data.prompt_template).toMatchObject({
      id: 'agent-reply-to-post',
      version: 4,
    })
  })

  it('renders chat template with compiled blocks injected', async () => {
    const agentId = await createAgent(devApp, 'T034 Chat Bot')

    const markers = {
      hard_control_block: '{CHAT_HARD}',
      compact_control_block: '{CHAT_COMPACT}',
      current_context_block: '{CHAT_CONTEXT}',
      memory_block: '{CHAT_MEMORY}',
      soft_expression_block: '{CHAT_SOFT}',
    }

    const res = await request(devApp)
      .post('/v1/dev/prompts/render')
      .send({
        agent_id: agentId,
        template_id: 'agent-chat-reply',
        scene: 'chat_room',
        conversation_text: '最近聊聊模型评测吧',
        variables: markers,
      })

    expect(res.status).toBe(200)
    const systemMessage = (res.body.data.messages as Array<{ role: string; content: string }>)
      .find((m) => m.role === 'system')
    const userMessage = (res.body.data.messages as Array<{ role: string; content: string }>)
      .find((m) => m.role === 'user')
    expect(systemMessage).toBeDefined()
    expect(systemMessage?.content).toContain(markers.hard_control_block)
    expect(systemMessage?.content).toContain(markers.compact_control_block)
    expect(systemMessage?.content).toContain(markers.memory_block)
    expect(systemMessage?.content).toContain(markers.soft_expression_block)
    expect(userMessage?.content).toContain(markers.current_context_block)
    expect(res.body.data.identity_contract.source).toBe('contract_v1')
    expect(res.body.data.prompt_template).toMatchObject({
      id: 'agent-chat-reply',
      version: 6,
    })
  })

  it('supports all six scenes and returns identity_contract', async () => {
    const agentId = await createAgent(devApp, 'T034 Multi Scene Bot')
    const cases: Array<{
      scene: 'forum_turn' | 'private_chat' | 'proactive_dm' | 'scheduled_post'
      template_id: string
      expected_version: number
      conversation_text: string
    }> = [
      {
        scene: 'forum_turn',
        template_id: 'agent-reply-to-thread-turn',
        expected_version: 4,
        conversation_text: '请针对上一条舞台发言继续回应。',
      },
      {
        scene: 'private_chat',
        template_id: 'agent-private-chat-reply',
        expected_version: 3,
        conversation_text: '我今天有点纠结，想听你的建议。',
      },
      {
        scene: 'proactive_dm',
        template_id: 'agent-proactive-dm-opening',
        expected_version: 3,
        conversation_text: '你的帖子刚被点赞了，想聊聊后续观点。',
      },
      {
        scene: 'scheduled_post',
        template_id: 'agent-create-post',
        expected_version: 4,
        conversation_text: '最近社区都在讨论模型评测基准。',
      },
    ]

    for (const item of cases) {
      const res = await request(devApp)
        .post('/v1/dev/prompts/render')
        .send({
          agent_id: agentId,
          template_id: item.template_id,
          scene: item.scene,
          conversation_text: item.conversation_text,
        })

      expect(res.status).toBe(200)
      expect(res.body.data.audit.scene).toBe(item.scene)
      expect(Array.isArray(res.body.data.messages)).toBe(true)
      expect(res.body.data.messages.length).toBeGreaterThan(0)
      expect(res.body.data.identity_contract).toMatchObject({
        source: 'contract_v1',
        persona_seed_code: 'scholar',
      })
      expect(res.body.data.prompt_template).toMatchObject({
        id: item.template_id,
        version: item.expected_version,
      })
    }
  })

  it('reports default contract_v1 identity for agents without contract config', async () => {
    const { agentService } = await import('../../container.js')
    const defaultContractAgent = agentService.createAgent({
      owner_id: 'legacy-user',
      display_name: 'Legacy Default Bot',
    })

    const res = await request(devApp)
      .post('/v1/dev/prompts/render')
      .send({
        agent_id: defaultContractAgent.id,
        template_id: 'agent-chat-reply',
        scene: 'chat_room',
        conversation_text: 'legacy prompt render',
      })

    expect(res.status).toBe(200)
    expect(res.body.data.identity_contract).toMatchObject({
      source: 'contract_v1',
      persona_seed_code: 'scholar',
      home_voice_line_id: 'qwen-social-v1',
    })
  })

  it('does not expose dev prompt render route in production mode', async () => {
    const prodApp = await loadAppWithNodeEnv('production')

    const res = await request(prodApp)
      .post('/v1/dev/prompts/render')
      .send({
        agent_id: 'any',
        template_id: 'agent-chat-reply',
        scene: 'chat_room',
      })

    expect(res.status).toBe(404)
  })
})
