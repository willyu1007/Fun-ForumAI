import type { Express } from 'express'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

function createDevToken(user: { userId: string; email: string; role: 'user' | 'admin' }): string {
  return Buffer.from(JSON.stringify(user)).toString('base64url')
}

async function loadAppWithNodeEnv(nodeEnv: 'test' | 'production'): Promise<Express> {
  const previousNodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = nodeEnv
  vi.resetModules()
  const mod = await import('../../app.js')
  process.env.NODE_ENV = previousNodeEnv
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
        template_version: 2,
        scene: 'chat_room',
      })

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('renders forum template with orchestrator layers injected', async () => {
    const agentId = await createAgent(devApp, 'T034 Forum Bot')

    const markers = {
      layer_traits: '[L1_GROWTH]',
      layer_style: '[L2_STYLE]',
      layer_instructions: '[L3_INSTRUCTIONS]',
      layer_community: '[L_COMMUNITY]',
      layer_relationship: '[L_RELATIONSHIP]',
      layer_showrunner: '[L_SHOWRUNNER]',
      layer_overrides: '[L4_OVERRIDES]',
      layer_memory: '[L5_MEMORY]',
      layer_privacy: '[L6_PRIVACY]',
    }

    const res = await request(devApp)
      .post('/v1/dev/prompts/render')
      .send({
        agent_id: agentId,
        template_id: 'agent-reply-to-post',
        template_version: 1,
        scene: 'forum_post',
        conversation_text: '请对这个观点给出回应',
        variables: markers,
      })

    expect(res.status).toBe(200)
    const systemMessage = (res.body.data.messages as Array<{ role: string; content: string }>)
      .find((m) => m.role === 'system')
    expect(systemMessage).toBeDefined()
    expect(systemMessage?.content).toContain(markers.layer_traits)
    expect(systemMessage?.content).toContain(markers.layer_style)
    expect(systemMessage?.content).toContain(markers.layer_instructions)
    expect(systemMessage?.content).toContain(markers.layer_community)
    expect(systemMessage?.content).toContain(markers.layer_relationship)
    expect(systemMessage?.content).toContain(markers.layer_showrunner)
    expect(systemMessage?.content).toContain(markers.layer_overrides)
    expect(systemMessage?.content).toContain(markers.layer_memory)
    expect(systemMessage?.content).toContain(markers.layer_privacy)
    expect(res.body.data.identity_contract).toMatchObject({
      source: 'contract_v1',
      persona_seed_code: 'scholar',
      home_voice_line_id: 'qwen-social-v1',
    })
    expect(res.body.data.audit).toMatchObject({
      version: 'v1',
      scene: 'forum_post',
    })
    expect(Array.isArray(res.body.data.audit.includedLayerIds)).toBe(true)
    expect(res.body.data.audit).toHaveProperty('tokenEstimates')
    expect(res.body.data.audit).toHaveProperty('lintWarnings')
    expect(res.body.data.audit).toHaveProperty('trimReasons')
    expect(res.body.data.prompt_template).toMatchObject({
      id: 'agent-reply-to-post',
      version: 1,
    })
  })

  it('renders chat template with orchestrator layers injected', async () => {
    const agentId = await createAgent(devApp, 'T034 Chat Bot')

    const markers = {
      layer_traits: '{CHAT_L1}',
      layer_style: '{CHAT_L2}',
      layer_instructions: '{CHAT_L3}',
      layer_community: '{CHAT_COMMUNITY}',
      layer_relationship: '{CHAT_REL}',
      layer_showrunner: '{CHAT_SHOW}',
      layer_overrides: '{CHAT_L4}',
      layer_memory: '{CHAT_L5}',
      layer_privacy: '{CHAT_L6}',
    }

    const res = await request(devApp)
      .post('/v1/dev/prompts/render')
      .send({
        agent_id: agentId,
        template_id: 'agent-chat-reply',
        template_version: 2,
        scene: 'chat_room',
        conversation_text: '最近聊聊模型评测吧',
        variables: markers,
      })

    expect(res.status).toBe(200)
    const systemMessage = (res.body.data.messages as Array<{ role: string; content: string }>)
      .find((m) => m.role === 'system')
    expect(systemMessage).toBeDefined()
    expect(systemMessage?.content).toContain(markers.layer_traits)
    expect(systemMessage?.content).toContain(markers.layer_style)
    expect(systemMessage?.content).toContain(markers.layer_instructions)
    expect(systemMessage?.content).toContain(markers.layer_community)
    expect(systemMessage?.content).toContain(markers.layer_relationship)
    expect(systemMessage?.content).toContain(markers.layer_showrunner)
    expect(systemMessage?.content).toContain(markers.layer_overrides)
    expect(systemMessage?.content).toContain(markers.layer_memory)
    expect(systemMessage?.content).toContain(markers.layer_privacy)
    expect(res.body.data.identity_contract.source).toBe('contract_v1')
  })

  it('supports all six scenes and returns identity_contract', async () => {
    const agentId = await createAgent(devApp, 'T034 Multi Scene Bot')
    const cases: Array<{
      scene: 'forum_comment' | 'private_chat' | 'proactive_dm' | 'scheduled_post'
      template_id: string
      template_version: number
      conversation_text: string
    }> = [
      {
        scene: 'forum_comment',
        template_id: 'agent-reply-to-comment',
        template_version: 1,
        conversation_text: '请针对上一条评论继续回应。',
      },
      {
        scene: 'private_chat',
        template_id: 'agent-private-chat-reply',
        template_version: 1,
        conversation_text: '我今天有点纠结，想听你的建议。',
      },
      {
        scene: 'proactive_dm',
        template_id: 'agent-proactive-dm-opening',
        template_version: 1,
        conversation_text: '你的帖子刚被点赞了，想聊聊后续观点。',
      },
      {
        scene: 'scheduled_post',
        template_id: 'agent-create-post',
        template_version: 1,
        conversation_text: '最近社区都在讨论模型评测基准。',
      },
    ]

    for (const item of cases) {
      const res = await request(devApp)
        .post('/v1/dev/prompts/render')
        .send({
          agent_id: agentId,
          template_id: item.template_id,
          template_version: item.template_version,
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
    }
  })

  it('reports legacy_default identity for agents without contract config', async () => {
    const { agentService } = await import('../../container.js')
    const legacyAgent = agentService.createAgent({
      owner_id: 'legacy-user',
      display_name: 'Legacy Default Bot',
    })

    const res = await request(devApp)
      .post('/v1/dev/prompts/render')
      .send({
        agent_id: legacyAgent.id,
        template_id: 'agent-chat-reply',
        template_version: 2,
        scene: 'chat_room',
        conversation_text: 'legacy prompt render',
      })

    expect(res.status).toBe(200)
    expect(res.body.data.identity_contract).toMatchObject({
      source: 'legacy_default',
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
        template_version: 2,
        scene: 'chat_room',
      })

    expect(res.status).toBe(404)
  })
})
