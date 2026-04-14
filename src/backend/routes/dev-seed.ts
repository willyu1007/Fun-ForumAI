import { execFileSync } from 'node:child_process'
import { Router, type IRouter } from 'express'
import { config } from '../lib/config.js'
import { runDevSeed } from '../dev/dev-seed-runner.js'
import { assertSafeDevSeedResetEnvironment } from '../dev/dev-seed-reset.js'
import { kickoffRunArtifactService, warmPersistenceState } from '../container.js'

const devSeedRouter: IRouter = Router()

function readProfile(raw: unknown): 'canonical' | 'smoke-minimal' | 'launch' {
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

devSeedRouter.post('/dev/seed', async (req, res) => {
  if (!config.allowDevTools) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } })
    return
  }

  try {
    const profile = readProfile(req.body?.profile)
    const resetBeforeSeed = readResetBeforeSeed(req.body?.reset_before_seed)
    if (resetBeforeSeed) {
      resetDatabaseBeforeSeed()
      await warmPersistenceState()
    }
    const result = await runDevSeed({ profile })
    await kickoffRunArtifactService.recordDataMode({
      mode: profile === 'launch' ? 'unknown' : profile,
      profile,
    })
    res.json({
      data: {
        message: 'Seed data created successfully',
        profile: result.profile,
        counts: result.counts,
        ids: result.ids,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: { code: 'SEED_ERROR', message } })
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
