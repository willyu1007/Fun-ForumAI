import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../../app.js'
import { relationService } from '../../container.js'
import { createDevToken } from '../../middleware/human-auth.js'

const ownerToken = createDevToken({ userId: 'rel-owner', email: 'owner@test.com', role: 'user' })
const otherToken = createDevToken({ userId: 'rel-other', email: 'other@test.com', role: 'user' })

async function createAgent(authToken: string, displayName: string): Promise<string> {
  const res = await request(app)
    .post('/v1/agents')
    .set('Authorization', `Bearer ${authToken}`)
    .send({ display_name: displayName })

  expect(res.status).toBe(201)
  return res.body.data.id as string
}

describe('Agent relation routes owner auth (service unavailable mode)', () => {
  it('GET /v1/agents/:agentId/relations enforces owner-only before fallback', async () => {
    expect(relationService).toBeNull()
    const agentId = await createAgent(ownerToken, 'Relation Auth Bot A')

    const nonOwnerRes = await request(app)
      .get(`/v1/agents/${agentId}/relations?view=following`)
      .set('Authorization', `Bearer ${otherToken}`)

    expect(nonOwnerRes.status).toBe(403)
    expect(nonOwnerRes.body.error.code).toBe('FORBIDDEN')

    const ownerRes = await request(app)
      .get(`/v1/agents/${agentId}/relations?view=following`)
      .set('Authorization', `Bearer ${ownerToken}`)

    expect(ownerRes.status).toBe(200)
    expect(ownerRes.body.data).toEqual({ items: [], next_cursor: null })
    expect(ownerRes.body.meta.degraded).toBe(true)
  })

  it('GET /v1/agents/:agentId/relations/summary enforces owner-only before fallback', async () => {
    expect(relationService).toBeNull()
    const agentId = await createAgent(ownerToken, 'Relation Auth Bot B')

    const nonOwnerRes = await request(app)
      .get(`/v1/agents/${agentId}/relations/summary`)
      .set('Authorization', `Bearer ${otherToken}`)

    expect(nonOwnerRes.status).toBe(403)
    expect(nonOwnerRes.body.error.code).toBe('FORBIDDEN')

    const ownerRes = await request(app)
      .get(`/v1/agents/${agentId}/relations/summary`)
      .set('Authorization', `Bearer ${ownerToken}`)

    expect(ownerRes.status).toBe(200)
    expect(ownerRes.body.data).toEqual({
      following: { shadow: 0, effective: 0, inactive: 0, blocked: 0 },
      followers: { shadow: 0, effective: 0, inactive: 0, blocked: 0 },
      friends: 0,
    })
    expect(ownerRes.body.meta.degraded).toBe(true)
  })
})
