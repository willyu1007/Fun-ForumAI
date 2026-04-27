#!/usr/bin/env tsx
//
// T-302 — long-running backend for UI smoke.
//
// Boots the same in-memory backend the run-smoke.ts harness uses, but
// keeps listening on PORT (default 4000) so a sibling Vite dev server
// can proxy `/v1` / `/health` calls. Seeds an admin-friendly community
// and prints its slug + id to stdout.
//
// Pair with `vite` started from the same repo to obtain a full
// front+back stack. SIGINT to shut down.

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function main(): Promise<void> {
  const mediaDir = mkdtempSync(join(tmpdir(), 't302-ui-'))
  process.env.MEDIA_LOCAL_DIR = process.env.MEDIA_LOCAL_DIR ?? mediaDir
  process.env.MEDIA_STORAGE_BACKEND = process.env.MEDIA_STORAGE_BACKEND ?? 'local'
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'development'
  process.env.APP_ENV = process.env.APP_ENV ?? 'dev'
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'smoke-jwt-secret-not-for-prod'
  process.env.SERVICE_AUTH_SECRET = process.env.SERVICE_AUTH_SECRET ?? 'smoke-service-secret-not-for-prod'
  process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'info'

  const port = Number(process.env.PORT ?? 4000)

  const [{ app }, container, { healthState }] = await Promise.all([
    import('../../../src/backend/app.js'),
    import('../../../src/backend/container.js'),
    import('../../../src/backend/health/state.js'),
  ])

  const slug = process.env.SMOKE_COMMUNITY_SLUG ?? 't302-ui-smoke'
  const community = container.communityRepo.create({
    name: 'T-302 UI Smoke Community',
    slug,
    description: 'In-memory community used by the UI smoke harness.',
  })

  const adminPayload = {
    userId: 'smoke-admin',
    email: 'smoke-admin@t302.local',
    role: 'admin',
  }
  const adminToken = Buffer.from(JSON.stringify(adminPayload)).toString('base64url')

  const server = app.listen(port, () => {
    healthState.markStartupComplete()
    console.log('[t302-ui] backend listening', JSON.stringify({
      port,
      community_id: community.id,
      community_slug: community.slug,
      admin_dev_token: adminToken,
      admin_user_id: adminPayload.userId,
      media_dir: mediaDir,
    }))
  })

  function shutdown(signal: string): void {
    console.log(`[t302-ui] received ${signal}, shutting down`)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 5_000).unref()
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((err) => {
  console.error('[t302-ui] failed to start:', err)
  process.exit(2)
})
