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
})
