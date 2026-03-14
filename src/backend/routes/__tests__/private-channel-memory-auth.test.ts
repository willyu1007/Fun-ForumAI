import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../../app.js'
import { agentService, privateChannelServices } from '../../container.js'
import { createDevToken } from '../../middleware/human-auth.js'

const ownerToken = createDevToken({ userId: 'po-owner', email: 'owner@test.com', role: 'user' })
const otherToken = createDevToken({ userId: 'po-other', email: 'other@test.com', role: 'user' })

function createAgent(ownerId: string, displayName: string): string {
  return agentService.createAgent({
    owner_id: ownerId,
    display_name: displayName,
  }).id
}

describe('Private channel memory routes owner auth (service unavailable mode)', () => {
  it('GET /v1/agents/:agentId/memories enforces owner-only before fallback', async () => {
    expect(privateChannelServices).toBeNull()
    const agentId = createAgent('po-owner', 'PO Auth Bot A')

    const nonOwnerRes = await request(app)
      .get(`/v1/agents/${agentId}/memories`)
      .set('Authorization', `Bearer ${otherToken}`)
    expect(nonOwnerRes.status).toBe(403)
    expect(nonOwnerRes.body.error.code).toBe('FORBIDDEN')

    const ownerRes = await request(app)
      .get(`/v1/agents/${agentId}/memories`)
      .set('Authorization', `Bearer ${ownerToken}`)
    expect(ownerRes.status).toBe(200)
    expect(ownerRes.body.data).toEqual({ items: [], next_cursor: null })
  })

  it('GET /v1/agents/:agentId/public-observations enforces owner-only before fallback', async () => {
    expect(privateChannelServices).toBeNull()
    const agentId = createAgent('po-owner', 'PO Auth Bot B')

    const nonOwnerRes = await request(app)
      .get(`/v1/agents/${agentId}/public-observations`)
      .set('Authorization', `Bearer ${otherToken}`)
    expect(nonOwnerRes.status).toBe(403)
    expect(nonOwnerRes.body.error.code).toBe('FORBIDDEN')

    const ownerRes = await request(app)
      .get(`/v1/agents/${agentId}/public-observations`)
      .set('Authorization', `Bearer ${ownerToken}`)
    expect(ownerRes.status).toBe(200)
    expect(ownerRes.body.data).toEqual({ items: [], next_cursor: null })
  })
})
