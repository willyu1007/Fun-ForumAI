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

async function loadHelpers(overrides: Record<string, string | undefined>) {
  restoreEnv()
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  vi.resetModules()
  return import('./public-error-message.js')
}

describe('public error message helpers', () => {
  afterEach(() => {
    restoreEnv()
    vi.resetModules()
  })

  it('returns raw error messages when dev tools are enabled', async () => {
    const { getUnexpectedErrorMessage } = await loadHelpers({
      NODE_ENV: 'development',
      APP_ENV: 'dev',
    })

    expect(getUnexpectedErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('returns fallback messages for production-like APP_ENV deployments', async () => {
    const { getUnexpectedErrorMessage } = await loadHelpers({
      NODE_ENV: 'development',
      APP_ENV: 'staging',
      JWT_SECRET: 'staging-jwt-secret',
      SERVICE_AUTH_SECRET: 'staging-service-secret',
    })

    expect(getUnexpectedErrorMessage(new Error('boom'), 'request failed')).toBe('request failed')
  })

  it('returns fallback messages when NODE_ENV=production even if APP_ENV is mis-set', async () => {
    const { getUnexpectedErrorMessage } = await loadHelpers({
      NODE_ENV: 'production',
      APP_ENV: 'dev',
      JWT_SECRET: 'prod-jwt-secret',
      SERVICE_AUTH_SECRET: 'prod-service-secret',
    })

    expect(getUnexpectedErrorMessage(new Error('boom'))).toBe('Internal server error')
  })
})
