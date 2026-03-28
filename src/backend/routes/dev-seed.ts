import { Router, type IRouter } from 'express'
import { config } from '../lib/config.js'
import { runDevSeed } from '../dev/dev-seed-runner.js'

const devSeedRouter: IRouter = Router()

function readProfile(raw: unknown): 'canonical' | 'smoke-minimal' {
  return raw === 'smoke-minimal' ? 'smoke-minimal' : 'canonical'
}

devSeedRouter.post('/dev/seed', async (req, res) => {
  if (!config.allowDevTools) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } })
    return
  }

  try {
    const profile = readProfile(req.body?.profile)
    const result = await runDevSeed({ profile })
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
