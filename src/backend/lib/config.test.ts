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

async function loadConfig(overrides: Record<string, string | undefined>) {
  restoreEnv()
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  vi.resetModules()
  return import('./config.js')
}

describe('config', () => {
  afterEach(() => {
    restoreEnv()
    vi.resetModules()
  })

  it('fails fast when a production-like deployment is missing JWT_SECRET', async () => {
    await expect(loadConfig({
      NODE_ENV: 'production',
      APP_ENV: undefined,
      JWT_SECRET: undefined,
      SERVICE_AUTH_SECRET: 'service-secret',
    })).rejects.toThrow('JWT_SECRET')
  })

  it('fails fast when NODE_ENV=production even if APP_ENV is mis-set to dev', async () => {
    await expect(loadConfig({
      NODE_ENV: 'production',
      APP_ENV: 'dev',
      JWT_SECRET: undefined,
      SERVICE_AUTH_SECRET: 'service-secret',
    })).rejects.toThrow('NODE_ENV=production')
  })

  it('derives prod mode from NODE_ENV and disables dev-only surfaces', async () => {
    const { config } = await loadConfig({
      NODE_ENV: 'production',
      APP_ENV: undefined,
      JWT_SECRET: 'prod-jwt-secret',
      SERVICE_AUTH_SECRET: 'prod-service-secret',
    })

    expect(config.appEnv).toBe('prod')
    expect(config.allowDevTools).toBe(false)
    expect(config.secureCookies).toBe(true)
  })

  it('keeps dev-only surfaces disabled when NODE_ENV=production even if APP_ENV=dev', async () => {
    const { config } = await loadConfig({
      NODE_ENV: 'production',
      APP_ENV: 'dev',
      JWT_SECRET: 'prod-jwt-secret',
      SERVICE_AUTH_SECRET: 'prod-service-secret',
    })

    expect(config.appEnv).toBe('dev')
    expect(config.allowDevTools).toBe(false)
    expect(config.secureCookies).toBe(true)
  })

  it('uses relaxed default timeouts for media generation flows', async () => {
    const { config } = await loadConfig({
      NODE_ENV: 'development',
      APP_ENV: 'dev',
      JWT_SECRET: 'dev-jwt-secret',
      SERVICE_AUTH_SECRET: 'dev-service-secret',
      MEDIA_GENERATION_TIMEOUT_MS: undefined,
      MEDIA_GENERATION_RUNNING_TIMEOUT_MS: undefined,
    })

    expect(config.mediaGeneration.timeoutMs).toBe(180_000)
    expect(config.mediaGeneration.runningTimeoutMs).toBe(360_000)
  })
})
