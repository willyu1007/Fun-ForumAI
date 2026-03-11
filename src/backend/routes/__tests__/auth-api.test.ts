import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from './e2e-helpers.js'

describe('Auth API', () => {
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
