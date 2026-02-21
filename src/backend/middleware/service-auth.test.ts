import { describe, it, expect, beforeAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import { requireServiceIdentity, createServiceToken } from './service-auth.js'
import { createDevToken } from './human-auth.js'
import { errorHandler } from './error-handler.js'

function buildApp() {
  const app = express()
  app.use(express.json())

  // Data plane route protected by service auth
  app.post('/v1/posts', requireServiceIdentity, (_req, res) => {
    res.status(201).json({ data: { id: 'test-post' } })
  })

  // Control plane route (no service auth)
  app.get('/v1/feed', (_req, res) => {
    res.json({ data: [] })
  })

  app.use(errorHandler)
  return app
}

describe('Data Plane Write Guard', () => {
  let app: ReturnType<typeof buildApp>

  beforeAll(() => {
    app = buildApp()
  })

  const validBody = { actor_agent_id: 'agent-1', run_id: 'run-1', title: 'Test', body: 'Content' }

  it('rejects requests without X-Service-Token → 401', async () => {
    const res = await request(app).post('/v1/posts').send(validBody)
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
    expect(res.body.error.message).toContain('X-Service-Token')
  })

  it('rejects requests with invalid service token → 401', async () => {
    const res = await request(app)
      .post('/v1/posts')
      .set('X-Service-Token', 'fake:token:here:bad')
      .send(validBody)
    expect(res.status).toBe(401)
  })

  it('rejects requests with human JWT token (no service token) → 401', async () => {
    const humanToken = createDevToken({ userId: 'u1', email: 'a@b.com', role: 'user' })
    const res = await request(app)
      .post('/v1/posts')
      .set('Authorization', `Bearer ${humanToken}`)
      .send(validBody)
    expect(res.status).toBe(401)
    expect(res.body.error.message).toContain('X-Service-Token')
  })

  it('rejects valid service token but missing actor_agent_id → 401', async () => {
    const body = { run_id: 'run-1', title: 'Test' }
    const token = createServiceToken('agent-runtime', JSON.stringify(body))
    const res = await request(app)
      .post('/v1/posts')
      .set('X-Service-Token', token)
      .send(body)
    expect(res.status).toBe(401)
    expect(res.body.error.message).toContain('actor_agent_id')
  })

  it('rejects valid service token but missing run_id → 401', async () => {
    const body = { actor_agent_id: 'agent-1', title: 'Test' }
    const token = createServiceToken('agent-runtime', JSON.stringify(body))
    const res = await request(app)
      .post('/v1/posts')
      .set('X-Service-Token', token)
      .send(body)
    expect(res.status).toBe(401)
    expect(res.body.error.message).toContain('run_id')
  })

  it('accepts valid service token with required fields → 201', async () => {
    const bodyStr = JSON.stringify(validBody)
    const token = createServiceToken('agent-runtime', bodyStr)
    const res = await request(app)
      .post('/v1/posts')
      .set('X-Service-Token', token)
      .send(validBody)
    expect(res.status).toBe(201)
    expect(res.body.data.id).toBe('test-post')
  })

  it('allows read API without any auth → 200', async () => {
    const res = await request(app).get('/v1/feed')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('rejects replayed nonce → 401', async () => {
    const bodyStr = JSON.stringify(validBody)
    const token = createServiceToken('agent-runtime', bodyStr)

    const res1 = await request(app)
      .post('/v1/posts')
      .set('X-Service-Token', token)
      .send(validBody)
    expect(res1.status).toBe(201)

    const res2 = await request(app)
      .post('/v1/posts')
      .set('X-Service-Token', token)
      .send(validBody)
    expect(res2.status).toBe(401)
    expect(res2.body.error.message).toContain('nonce')
  })

  it('rejects unknown service identity → 401', async () => {
    const body = validBody
    const bodyStr = JSON.stringify(body)
    const timestamp = Date.now().toString()
    const nonce = 'test-nonce-unknown'
    const crypto = await import('node:crypto')
    const bodyHash = crypto.createHash('sha256').update(bodyStr).digest('hex')
    const payload = `unknown-service:${timestamp}:${nonce}:${bodyHash}`
    const secret = 'dev-service-secret-change-in-production'
    const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    const token = `unknown-service:${timestamp}:${nonce}:${sig}`

    const res = await request(app)
      .post('/v1/posts')
      .set('X-Service-Token', token)
      .send(body)
    expect(res.status).toBe(401)
    expect(res.body.error.message).toContain('Unknown service identity')
  })
})
