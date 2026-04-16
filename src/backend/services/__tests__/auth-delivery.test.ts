import { afterEach, describe, expect, it, vi } from 'vitest'

const ENV_SNAPSHOT = { ...process.env }

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in ENV_SNAPSHOT)) {
      delete process.env[key]
    }
  }
  Object.assign(process.env, ENV_SNAPSHOT)
}

async function loadSenders(overrides: Record<string, string | undefined>) {
  restoreEnv()
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  vi.resetModules()
  return import('../auth-delivery.js')
}

describe('auth-delivery senders', () => {
  afterEach(() => {
    restoreEnv()
    vi.resetModules()
  })

  it('does not crash startup in production-like mode when SMTP is not configured', async () => {
    const { createEmailVerificationSender } = await loadSenders({
      NODE_ENV: 'production',
      APP_ENV: undefined,
      JWT_SECRET: 'prod-jwt-secret',
      SERVICE_AUTH_SECRET: 'prod-service-secret',
      SMTP_HOST: undefined,
      SMTP_USER: undefined,
      SMTP_PASS: undefined,
      SMTP_FROM_EMAIL: undefined,
    })

    const sender = createEmailVerificationSender()
    await expect(
      sender.sendVerificationCode({
        to: 'user@example.com',
        code: '123456',
        expiresInSec: 600,
        purpose: 'EMAIL_SIGNUP',
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'EMAIL_PROVIDER_UNAVAILABLE',
    })
  })

  it('does not crash startup in production-like mode when Aliyun SMS is not configured', async () => {
    const { createSmsVerificationSender } = await loadSenders({
      NODE_ENV: 'production',
      APP_ENV: undefined,
      JWT_SECRET: 'prod-jwt-secret',
      SERVICE_AUTH_SECRET: 'prod-service-secret',
      ALIYUN_SMS_ACCESS_KEY_ID: undefined,
      ALIYUN_SMS_ACCESS_KEY_SECRET: undefined,
      ALIYUN_SMS_SIGN_NAME: undefined,
      ALIYUN_SMS_TEMPLATE_CODE: undefined,
    })

    const sender = createSmsVerificationSender()
    await expect(
      sender.sendVerificationCode({
        phone: '13800000000',
        code: '123456',
        expiresInSec: 600,
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'SMS_PROVIDER_UNAVAILABLE',
    })
  })
})
