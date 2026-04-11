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

async function loadAppModule(runtimeEnabled: 'true' | 'false') {
  restoreEnv()
  process.env.RUNTIME_ENABLED = runtimeEnabled
  process.env.NODE_ENV = 'test'
  delete process.env.APP_ENV
  vi.resetModules()
  const appModule = await import('./app.js')
  const container = await import('./container.js')
  const { config } = await import('./lib/config.js')
  return { appModule, container, config }
}

describe('app bootstrap', () => {
  afterEach(async () => {
    try {
      const mod = await import('./app.js')
      mod.stopBackgroundServices()
    } catch {
      // ignore modules that were not loaded
    }
    restoreEnv()
    vi.resetModules()
  })

  it('does not auto-start background services on import and starts them only when requested', async () => {
    const { appModule, container } = await loadAppModule('true')

    expect(container.roomLifecycle.isRunning).toBe(false)
    expect(container.conversationClock.isRunning).toBe(false)

    appModule.startBackgroundServices()

    expect(container.roomLifecycle.isRunning).toBe(true)
    expect(container.conversationClock.isRunning).toBe(true)

    appModule.stopBackgroundServices()
    expect(container.roomLifecycle.isRunning).toBe(false)
    expect(container.conversationClock.isRunning).toBe(false)
  }, 15_000)

  it('keeps background services stopped when runtime is disabled', async () => {
    const { appModule, container } = await loadAppModule('false')

    appModule.startBackgroundServices()

    expect(container.roomLifecycle.isRunning).toBe(false)
    expect(container.conversationClock.isRunning).toBe(false)
  }, 15_000)

  it('always runs membership backfill when the feature flag is enabled', async () => {
    const { appModule, container, config } = await loadAppModule('false')
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalMembershipsV1 = featureFlags.membershipsV1
    featureFlags.membershipsV1 = true

    const backfillSpy = vi
      .spyOn(container.agentCommunityMembershipService, 'runDerivedBackfill')
      .mockResolvedValue({
        processed_posts: 0,
        upserted_memberships: 0,
        skipped_existing: 0,
      })

    try {
      await appModule.initPersistence()
      expect(backfillSpy).toHaveBeenCalledTimes(1)
    } finally {
      featureFlags.membershipsV1 = originalMembershipsV1
    }
  }, 15_000)

  it('does not import dev-seed routes when dev tools are disabled', async () => {
    restoreEnv()
    process.env.NODE_ENV = 'production'
    process.env.RUNTIME_ENABLED = 'false'
    process.env.JWT_SECRET = 'production-test-secret'
    process.env.SERVICE_AUTH_SECRET = 'production-test-service-secret'
    delete process.env.APP_ENV
    vi.resetModules()
    vi.doMock('./routes/dev-seed.js', () => {
      throw new Error('dev-seed route should not be imported in production bootstrap')
    })

    try {
      const mod = await import('./app.js')
      expect(mod.app).toBeDefined()
    } finally {
      vi.doUnmock('./routes/dev-seed.js')
    }
  }, 15_000)
})
