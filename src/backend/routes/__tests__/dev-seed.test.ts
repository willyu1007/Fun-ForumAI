import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const runDevSeed = vi.fn()
const warmPersistenceState = vi.fn()
const execFileSync = vi.fn()

vi.mock('../../lib/config.js', () => ({
  config: {
    allowDevTools: true,
  },
}))

vi.mock('../../dev/dev-seed-runner.js', () => ({
  runDevSeed,
}))

vi.mock('../../container.js', () => ({
  warmPersistenceState,
}))

vi.mock('../../dev/dev-seed-reset.js', () => ({
  assertSafeDevSeedResetEnvironment: vi.fn(),
}))

vi.mock('node:child_process', () => ({
  execFileSync,
  default: {
    execFileSync,
  },
}))

async function createApp() {
  vi.resetModules()
  const { devSeedRouter } = await import('../dev-seed.js')
  const app = express()
  app.use(express.json())
  app.use('/v1', devSeedRouter)
  return app
}

describe('dev seed route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    runDevSeed.mockResolvedValue({
      profile: 'canonical',
      counts: {
        communities: 1,
        agents: 1,
        posts: 0,
        threads: 0,
      },
      ids: {
        communities: ['community-1'],
        agents: ['agent-1'],
        posts: [],
        threads: [],
        rooms: [],
      },
    })
  })

  it('resets the local database before loading canonical seed when requested', async () => {
    const app = await createApp()
    const res = await request(app).post('/v1/dev/seed').send({
      profile: 'canonical',
      reset_before_seed: true,
    })

    expect(res.status).toBe(200)
    expect(execFileSync).toHaveBeenNthCalledWith(
      1,
      'pnpm',
      ['exec', 'prisma', 'migrate', 'reset', '--force'],
      expect.objectContaining({
        stdio: 'inherit',
      }),
    )
    expect(execFileSync).toHaveBeenNthCalledWith(
      2,
      'pnpm',
      ['db:generate'],
      expect.objectContaining({
        stdio: 'inherit',
      }),
    )
    expect(warmPersistenceState).toHaveBeenCalledTimes(1)
    expect(runDevSeed).toHaveBeenCalledWith({ profile: 'canonical' })
  })

  it('returns 409 when another dev data operation is already running', async () => {
    const app = await createApp()
    const { devDataOperationLock } = await import('../../services/dev-data-operation-lock.js')
    const token = devDataOperationLock.acquire({
      kind: 'warm_start_bootstrap',
      label: 'run-123',
    })

    try {
      const res = await request(app).post('/v1/dev/seed').send({
        profile: 'canonical',
        reset_before_seed: true,
      })

      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('CONFLICT')
      expect(runDevSeed).not.toHaveBeenCalled()
      expect(execFileSync).not.toHaveBeenCalled()
    } finally {
      devDataOperationLock.release(token)
    }
  })
})
