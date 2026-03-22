import type { Express } from 'express'
import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest'
import request from 'supertest'

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

describe('Auth API', () => {
  it('switches dev identity by issuing an auth cookie for the dev toolbar', async () => {
    const switchRes = await request(app)
      .post('/v1/auth/dev/switch')
      .set('Host', '127.0.0.1')
      .send({ identity: 'admin' })

    expect(switchRes.status).toBe(200)
    expect(switchRes.body.data.user).toMatchObject({
      email: 'dev-admin@llm-forum.test',
      role: 'admin',
    })

    const cookies = switchRes.headers['set-cookie']
    expect(cookies).toEqual(expect.arrayContaining([expect.stringContaining('auth_token=')]))

    const meRes = await request(app)
      .get('/v1/auth/me')
      .set('Cookie', cookies)

    expect(meRes.status).toBe(200)
    expect(meRes.body.data.user).toMatchObject({
      email: 'dev-admin@llm-forum.test',
      role: 'admin',
    })
  })

  it('clears the dev auth cookie when switching back to anonymous', async () => {
    const switchRes = await request(app)
      .post('/v1/auth/dev/switch')
      .set('Host', '127.0.0.1')
      .send({ identity: 'anonymous' })

    expect(switchRes.status).toBe(200)
    expect(switchRes.body.data.user).toBeNull()

    const cookies = switchRes.headers['set-cookie']
    expect(cookies).toEqual(expect.arrayContaining([expect.stringContaining('auth_token=;')]))

    const meRes = await request(app)
      .get('/v1/auth/me')
      .set('Cookie', cookies)

    expect(meRes.status).toBe(401)
    expect(meRes.body.error.code).toBe('UNAUTHORIZED')
  })

  it('hides the dev identity switch outside local dev hosts', async () => {
    const switchRes = await request(app)
      .post('/v1/auth/dev/switch')
      .set('Host', 'forum.example.com')
      .send({ identity: 'admin' })

    expect(switchRes.status).toBe(404)
    expect(switchRes.body.error.code).toBe('NOT_FOUND')
  })

  it('registers a user in dev in-memory mode and resolves auth/me from the issued cookie', async () => {
    const email = `guidance-auth-${Date.now()}@example.com`
    const password = 'password123'

    const registerRes = await request(app)
      .post('/v1/auth/register')
      .send({
        email,
        password,
        displayName: 'Guidance Tester',
      })

    expect(registerRes.status).toBe(201)
    expect(registerRes.body.data.user).toMatchObject({
      email,
      displayName: 'Guidance Tester',
      role: 'user',
    })
    const cookies = registerRes.headers['set-cookie']
    expect(cookies).toBeTruthy()

    const meRes = await request(app)
      .get('/v1/auth/me')
      .set('Cookie', cookies)

    expect(meRes.status).toBe(200)
    expect(meRes.body.data.user).toMatchObject({
      email,
      displayName: 'Guidance Tester',
      role: 'user',
    })
  })

  it('rejects login with an invalid password', async () => {
    const email = `guidance-auth-negative-${Date.now()}@example.com`

    const registerRes = await request(app)
      .post('/v1/auth/register')
      .send({
        email,
        password: 'password123',
        displayName: 'Guidance Negative',
      })

    expect(registerRes.status).toBe(201)

    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({
        email,
        password: 'wrong-password',
      })

    expect(loginRes.status).toBe(401)
    expect(loginRes.body.error.code).toBe('UNAUTHORIZED')
  })
})
