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

describe('Admin user access API', () => {
  it('grants and revokes admin access for an existing user', async () => {
    const suffix = Date.now().toString(36)
    const adminToken = createDevToken({
      userId: `access-admin-${suffix}`,
      email: `access-admin-${suffix}@example.com`,
      role: 'admin',
    })
    const userToken = createDevToken({
      userId: `access-user-${suffix}`,
      email: `access-user-${suffix}@example.com`,
      role: 'user',
    })

    const meRes = await request(app)
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${userToken}`)

    expect(meRes.status).toBe(200)

    const grantRes = await request(app)
      .post('/v1/admin/admin-users/grant')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: `access-user-${suffix}@example.com` })

    expect(grantRes.status).toBe(200)
    expect(grantRes.body.data).toMatchObject({
      email: `access-user-${suffix}@example.com`,
      planTier: 'ADMIN',
      isBootstrapAdmin: false,
    })

    const listRes = await request(app)
      .get('/v1/admin/admin-users')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(listRes.status).toBe(200)
    expect(listRes.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: grantRes.body.data.id,
          email: `access-user-${suffix}@example.com`,
          planTier: 'ADMIN',
        }),
      ]),
    )

    const revokeRes = await request(app)
      .post(`/v1/admin/admin-users/${grantRes.body.data.id}/revoke`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(revokeRes.status).toBe(200)
    expect(revokeRes.body.data).toMatchObject({
      id: grantRes.body.data.id,
      planTier: 'FREE',
    })
  })

  it('rejects non-admin callers', async () => {
    const suffix = Date.now().toString(36)
    const token = createDevToken({
      userId: `access-user-${suffix}`,
      email: `access-user-${suffix}@example.com`,
      role: 'user',
    })

    const res = await request(app)
      .get('/v1/admin/admin-users')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
    expect(res.body.error?.code).toBe('FORBIDDEN')
  })
})
