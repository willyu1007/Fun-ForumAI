import type { Express } from 'express'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createDevToken } from '../../middleware/human-auth.js'

let app: Express

beforeAll(async () => {
  vi.resetModules()
  app = (await import('../../app.js')).app
})

afterAll(async () => {
  try {
    const mod = await import('../../app.js')
    mod.stopBackgroundServices()
  } catch {
    // ignore isolated module teardown failures
  }
  vi.resetModules()
})

describe('Admin invite code API', () => {
  it('lists the fixed invite codes for admins', async () => {
    const suffix = Date.now().toString(36)
    const adminToken = createDevToken({
      userId: `invite-admin-${suffix}`,
      email: `invite-admin-${suffix}@example.com`,
      role: 'admin',
    })

    const res = await request(app)
      .get('/v1/admin/invite-codes')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(10)
    expect(res.body.data[0]).toMatchObject({
      code: '100001',
      status: 'ACTIVE',
      maxUses: 500,
      usedCount: 0,
      sharePath: '/register?invite=100001',
    })
  })
})
