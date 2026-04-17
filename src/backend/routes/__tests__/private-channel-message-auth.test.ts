import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../../app.js'
import { privateChannelServices } from '../../container.js'
import { createDevToken } from '../../middleware/human-auth.js'

const ownerToken = createDevToken({ userId: 'pcm-owner', email: 'owner@test.com', role: 'user' })
const otherToken = createDevToken({ userId: 'pcm-other', email: 'other@test.com', role: 'user' })

async function createAgent(authToken: string, displayName: string): Promise<string> {
  const res = await request(app)
    .post('/v1/agents')
    .set('Authorization', `Bearer ${authToken}`)
    .send({ display_name: displayName })

  expect(res.status).toBe(201)
  return res.body.data.id as string
}

describe('Private channel message routes owner auth (service unavailable mode)', () => {
  it('GET /v1/agents/:agentId/chat/sessions exposes unavailability metadata after owner auth', async () => {
    expect(privateChannelServices).toBeNull()
    const agentId = await createAgent(ownerToken, 'Private Session Auth Bot')

    const nonOwnerRes = await request(app)
      .get(`/v1/agents/${agentId}/chat/sessions`)
      .set('Authorization', `Bearer ${otherToken}`)
    expect(nonOwnerRes.status).toBe(403)
    expect(nonOwnerRes.body.error.code).toBe('FORBIDDEN')

    const ownerRes = await request(app)
      .get(`/v1/agents/${agentId}/chat/sessions`)
      .set('Authorization', `Bearer ${ownerToken}`)
    expect(ownerRes.status).toBe(200)
    expect(ownerRes.body.data).toEqual({ items: [], next_cursor: null })
    expect(ownerRes.body.meta).toMatchObject({
      private_chat_available: false,
      unavailable_reason: 'DB_UNAVAILABLE',
    })
    expect(ownerRes.body.meta.unavailable_message).toContain('私聊当前不可用')
  })

  it('GET /v1/agents/:agentId/chat/sessions/:sessionId/messages enforces owner-only before fallback', async () => {
    expect(privateChannelServices).toBeNull()
    const agentId = await createAgent(ownerToken, 'Private Message Auth Bot')

    const nonOwnerRes = await request(app)
      .get(`/v1/agents/${agentId}/chat/sessions/session-1/messages`)
      .set('Authorization', `Bearer ${otherToken}`)
    expect(nonOwnerRes.status).toBe(403)
    expect(nonOwnerRes.body.error.code).toBe('FORBIDDEN')

    const ownerRes = await request(app)
      .get(`/v1/agents/${agentId}/chat/sessions/session-1/messages`)
      .set('Authorization', `Bearer ${ownerToken}`)
    expect(ownerRes.status).toBe(200)
    expect(ownerRes.body.data).toEqual({ items: [], next_cursor: null })
  })

  it('POST /v1/agents/:agentId/chat/sessions/:sessionId/attachments enforces owner-only before fallback', async () => {
    expect(privateChannelServices).toBeNull()
    const agentId = await createAgent(ownerToken, 'Private Attachment Auth Bot')

    const nonOwnerRes = await request(app)
      .post(`/v1/agents/${agentId}/chat/sessions/session-1/attachments`)
      .set('Authorization', `Bearer ${otherToken}`)
      .attach('file', Buffer.from('not-a-real-image'), 'test.png')
    expect(nonOwnerRes.status).toBe(403)
    expect(nonOwnerRes.body.error.code).toBe('FORBIDDEN')

    const ownerRes = await request(app)
      .post(`/v1/agents/${agentId}/chat/sessions/session-1/attachments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('file', Buffer.from('not-a-real-image'), 'test.png')
    expect(ownerRes.status).toBe(503)
    expect(ownerRes.body.error.code).toBe('DB_UNAVAILABLE')
  })
})
