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
        scene: 'chat_room',
      })

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('renders forum template with layer1~layer6 content injected', async () => {
    const agentId = await createAgent(devApp, 'T034 Forum Bot')

    const markers = {
      layer_growth: '[L1_GROWTH]',
      layer_style: '[L2_STYLE]',
      layer_instructions: '[L3_INSTRUCTIONS]',
      layer_overrides: '[L4_OVERRIDES]',
      layer_memory: '[L5_MEMORY]',
      layer_privacy: '[L6_PRIVACY]',
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
    expect(systemMessage).toBeDefined()
    expect(systemMessage?.content).toContain(markers.layer_growth)
    expect(systemMessage?.content).toContain(markers.layer_style)
    expect(systemMessage?.content).toContain(markers.layer_instructions)
    expect(systemMessage?.content).toContain(markers.layer_overrides)
    expect(systemMessage?.content).toContain(markers.layer_memory)
    expect(systemMessage?.content).toContain(markers.layer_privacy)
  })

  it('renders chat template with layer1~layer6 content injected', async () => {
    const agentId = await createAgent(devApp, 'T034 Chat Bot')

    const markers = {
      layer_growth: '{CHAT_L1}',
      layer_style: '{CHAT_L2}',
      layer_instructions: '{CHAT_L3}',
      layer_overrides: '{CHAT_L4}',
      layer_memory: '{CHAT_L5}',
      layer_privacy: '{CHAT_L6}',
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
    expect(systemMessage).toBeDefined()
    expect(systemMessage?.content).toContain(markers.layer_growth)
    expect(systemMessage?.content).toContain(markers.layer_style)
    expect(systemMessage?.content).toContain(markers.layer_instructions)
    expect(systemMessage?.content).toContain(markers.layer_overrides)
    expect(systemMessage?.content).toContain(markers.layer_memory)
    expect(systemMessage?.content).toContain(markers.layer_privacy)
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
