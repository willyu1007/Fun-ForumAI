import { execFileSync } from 'node:child_process'
import { Router, type IRouter } from 'express'
import { config } from '../lib/config.js'
import { runDevSeed } from '../dev/dev-seed-runner.js'
import { assertSafeDevSeedResetEnvironment } from '../dev/dev-seed-reset.js'
import { AppError } from '../lib/errors.js'
import { warmPersistenceState } from '../container.js'
import { devDataOperationLock } from '../services/dev-data-operation-lock.js'

const devSeedRouter: IRouter = Router()
const DEV_SEED_TIMEOUT_MS = 60_000
const DEV_SEED_RESET_TIMEOUT_MS = 3 * 60_000

function readProfile(raw: unknown): 'canonical' | 'smoke-minimal' | 'launch' {
  // `smoke-minimal` is kept for internal automation such as mobile smoke
  // preparation, not as a general-purpose interactive dev mode.
  if (raw === 'smoke-minimal' || raw === 'launch') {
    return raw
  }
  return 'canonical'
}

function readResetBeforeSeed(raw: unknown): boolean {
  return raw === true
}

function resetDatabaseBeforeSeed(): void {
  assertSafeDevSeedResetEnvironment({})
  const env = {
    ...process.env,
    DB_PERSISTENCE: process.env.DB_PERSISTENCE ?? 'true',
  }
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'reset', '--force'], {
    stdio: 'inherit',
    env,
  })
  execFileSync('pnpm', ['db:generate'], {
    stdio: 'inherit',
    env,
  })
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new AppError(
            504,
            'Dev seed operation timed out. Retry after the current run settles.',
            'DEV_SEED_TIMEOUT',
            { timeout_ms: timeoutMs },
          ))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

devSeedRouter.post('/dev/seed', async (req, res) => {
  if (!config.allowDevTools) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } })
    return
  }

  let lockToken: symbol | null = null
  try {
    const profile = readProfile(req.body?.profile)
    const resetBeforeSeed = readResetBeforeSeed(req.body?.reset_before_seed)
    lockToken = devDataOperationLock.acquire({
      kind: 'dev_seed',
      label: `${profile}${resetBeforeSeed ? ':reset' : ''}`,
    })
    devDataOperationLock.update(lockToken, {
      label: `${profile}${resetBeforeSeed ? ':reset' : ''}`,
    })
    if (resetBeforeSeed) {
      resetDatabaseBeforeSeed()
      await warmPersistenceState()
    }
    const result = await withTimeout(
      runDevSeed({ profile }),
      resetBeforeSeed ? DEV_SEED_RESET_TIMEOUT_MS : DEV_SEED_TIMEOUT_MS,
    )
    res.json({
      data: {
        message: 'Seed data created successfully',
        profile: result.profile,
        counts: result.counts,
        ids: result.ids,
      },
    })
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
          ...(err.details !== undefined ? { details: err.details } : {}),
        },
      })
      return
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: { code: 'SEED_ERROR', message } })
  } finally {
    if (lockToken) {
      devDataOperationLock.release(lockToken)
    }
  }
})

devSeedRouter.delete('/dev/seed', (_req, res) => {
  if (!config.allowDevTools) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } })
    return
  }
  res.status(400).json({
    error: {
      code: 'SEED_RESET_SCRIPT_REQUIRED',
      message: 'Use `pnpm dev:reset:seed` from a local dev shell to clear and rebuild seed data.',
    },
  })
})

export { devSeedRouter }
