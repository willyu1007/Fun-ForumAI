import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../../app.js'
import { createDevToken } from '../../middleware/human-auth.js'

const ownerToken = createDevToken({ userId: 'olo-owner', email: 'owner@test.com', role: 'user' })
const otherToken = createDevToken({ userId: 'olo-other', email: 'other@test.com', role: 'user' })

async function createAgent(authToken: string, displayName: string): Promise<string> {
  const res = await request(app)
    .post('/v1/agents')
    .set('Authorization', `Bearer ${authToken}`)
    .send({ display_name: displayName })

  expect(res.status).toBe(201)
  return res.body.data.id as string
}

describe('Owner life overview private routes', () => {
  it('enforces owner-only access across the private aggregate endpoints', async () => {
    const agentId = await createAgent(ownerToken, 'Owner Life Bot')

    for (const path of [
      `/v1/private/agents/${agentId}/life-overview`,
      `/v1/private/agents/${agentId}/chronicle-feed`,
      `/v1/private/agents/${agentId}/nurture-suggestions`,
    ]) {
      const nonOwnerRes = await request(app)
        .get(path)
        .set('Authorization', `Bearer ${otherToken}`)
      expect(nonOwnerRes.status).toBe(403)
      expect(nonOwnerRes.body.error.code).toBe('FORBIDDEN')

      const ownerRes = await request(app)
        .get(path)
        .set('Authorization', `Bearer ${ownerToken}`)
      expect(ownerRes.status).toBe(200)
      expect(ownerRes.body.data.agent_id).toBe(agentId)
    }
  })
})
