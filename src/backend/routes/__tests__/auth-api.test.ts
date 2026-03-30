import type { Express } from 'express'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
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

  it('registers an email user via challenge verification and resolves auth/me from the issued cookie', async () => {
    const email = `guidance-auth-${Date.now()}@example.com`
    const password = 'password123'

    const startRes = await request(app)
      .post('/v1/auth/register')
      .send({
        email,
        password,
        displayName: 'Guidance Tester',
      })

    expect(startRes.status).toBe(200)
    expect(startRes.body.data).toMatchObject({
      challengeId: expect.any(String),
      maskedTarget: expect.stringContaining('@example.com'),
      debugCode: expect.any(String),
    })

    const verifyRes = await request(app)
      .post('/v1/auth/register/verify')
      .send({
        challengeId: startRes.body.data.challengeId,
        code: startRes.body.data.debugCode,
      })

    expect(verifyRes.status).toBe(201)
    expect(verifyRes.body.data.user).toMatchObject({
      email,
      displayName: 'Guidance Tester',
      role: 'user',
    })

    const cookies = verifyRes.headers['set-cookie']
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

    const startRes = await request(app)
      .post('/v1/auth/register')
      .send({
        email,
        password: 'password123',
        displayName: 'Guidance Negative',
      })

    await request(app)
      .post('/v1/auth/register/verify')
      .send({
        challengeId: startRes.body.data.challengeId,
        code: startRes.body.data.debugCode,
      })

    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({
        email,
        password: 'wrong-password',
      })

    expect(loginRes.status).toBe(401)
    expect(loginRes.body.error.code).toBe('UNAUTHORIZED')
  })

  it('replaces an email challenge on resend and only accepts the latest code', async () => {
    const { config } = await import('../../lib/config.js')
    const otpConfig = config.auth.otp as {
      resendCooldownSeconds: number
    }
    const originalCooldown = otpConfig.resendCooldownSeconds
    otpConfig.resendCooldownSeconds = 0

    const email = `guidance-auth-resend-${Date.now()}@example.com`

    try {
      const firstStartRes = await request(app)
        .post('/v1/auth/register')
        .send({
          email,
          password: 'password123',
          displayName: 'Resend Tester',
        })

      const resendRes = await request(app)
        .post('/v1/auth/register/resend')
        .send({
          challengeId: firstStartRes.body.data.challengeId,
        })

      expect(resendRes.status).toBe(200)
      expect(resendRes.body.data.challengeId).not.toBe(firstStartRes.body.data.challengeId)

      const oldVerifyRes = await request(app)
        .post('/v1/auth/register/verify')
        .send({
          challengeId: firstStartRes.body.data.challengeId,
          code: firstStartRes.body.data.debugCode,
        })

      expect(oldVerifyRes.status).toBe(400)
      expect(oldVerifyRes.body.error.code).toBe('CODE_EXPIRED')

      const latestVerifyRes = await request(app)
        .post('/v1/auth/register/verify')
        .send({
          challengeId: resendRes.body.data.challengeId,
          code: resendRes.body.data.debugCode,
        })

      expect(latestVerifyRes.status).toBe(201)
      expect(latestVerifyRes.body.data.user.email).toBe(email)
    } finally {
      otpConfig.resendCooldownSeconds = originalCooldown
    }
  })

  it('creates a phone-only account on first sms verification and reuses it on later logins', async () => {
    const phone = `13${Date.now().toString().slice(-9)}`

    const sendRes = await request(app)
      .post('/v1/auth/sms/send')
      .send({ phone })

    expect(sendRes.status).toBe(200)
    expect(sendRes.body.data).toMatchObject({
      challengeId: expect.any(String),
      debugCode: expect.any(String),
    })

    const firstVerifyRes = await request(app)
      .post('/v1/auth/sms/verify')
      .send({
        challengeId: sendRes.body.data.challengeId,
        code: sendRes.body.data.debugCode,
        displayName: 'Phone Tester',
      })

    expect(firstVerifyRes.status).toBe(200)
    expect(firstVerifyRes.body.data).toMatchObject({
      isNewUser: true,
      user: {
        email: null,
        phone,
        displayName: 'Phone Tester',
      },
    })

    const secondSendRes = await request(app)
      .post('/v1/auth/sms/send')
      .send({ phone })

    const secondVerifyRes = await request(app)
      .post('/v1/auth/sms/verify')
      .send({
        challengeId: secondSendRes.body.data.challengeId,
        code: secondSendRes.body.data.debugCode,
      })

    expect(secondVerifyRes.status).toBe(200)
    expect(secondVerifyRes.body.data).toMatchObject({
      isNewUser: false,
      user: {
        email: null,
        phone,
        displayName: 'Phone Tester',
      },
    })
  })

  it('does not burn a first-time sms code when displayName is missing', async () => {
    const phone = `13${(Date.now() + 1).toString().slice(-9)}`

    const sendRes = await request(app)
      .post('/v1/auth/sms/send')
      .send({ phone })

    const missingNameRes = await request(app)
      .post('/v1/auth/sms/verify')
      .send({
        challengeId: sendRes.body.data.challengeId,
        code: sendRes.body.data.debugCode,
      })

    expect(missingNameRes.status).toBe(400)
    expect(missingNameRes.body.error.code).toBe('DISPLAY_NAME_REQUIRED')

    const retryRes = await request(app)
      .post('/v1/auth/sms/verify')
      .send({
        challengeId: sendRes.body.data.challengeId,
        code: sendRes.body.data.debugCode,
        displayName: 'Retry Phone Tester',
      })

    expect(retryRes.status).toBe(200)
    expect(retryRes.body.data).toMatchObject({
      isNewUser: true,
      user: {
        phone,
        displayName: 'Retry Phone Tester',
      },
    })
  })

})
