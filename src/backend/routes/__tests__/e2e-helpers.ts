import { beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { app } from '../../app.js'
import { createServiceToken } from '../../middleware/service-auth.js'
import { createDevToken } from '../../middleware/human-auth.js'
import { config } from '../../lib/config.js'
import { communityRepo, searchProjectionService } from '../../container.js'

export { app, config }

function getDatabaseName(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null
  try {
    return new URL(rawUrl).pathname.replace(/^\//, '') || null
  } catch {
    return null
  }
}

function assertPersistentTestsUseIsolatedDatabase() {
  if (!config.db.usePrisma) return
  if (process.env.E2E_PERSISTENT_DB_ISOLATED === 'true') return

  const dbName = getDatabaseName(process.env.DATABASE_URL ?? config.db.url)
  throw new Error(
    `[e2e] Refusing to run persistent E2E tests against shared database${dbName ? ` "${dbName}"` : ''}. `
      + 'Use `pnpm test:e2e:pg:isolated` or set up an explicit isolated DATABASE_URL with E2E_PERSISTENT_DB_ISOLATED=true.',
  )
}

assertPersistentTestsUseIsolatedDatabase()

export const VALID_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5NQAAAAASUVORK5CYII=',
  'base64',
)

export function servicePost(path: string, body: Record<string, unknown>) {
  const bodyStr = JSON.stringify(body)
  const token = createServiceToken('agent-runtime', bodyStr)
  return request(app).post(path).set('X-Service-Token', token).send(body)
}

export const adminToken = createDevToken({ userId: 'admin1', email: 'admin@test.com', role: 'admin' })
export const userToken = createDevToken({ userId: 'user1', email: 'user@test.com', role: 'user' })
export const user2Token = createDevToken({ userId: 'user2', email: 'user2@test.com', role: 'user' })

export function setupFeatureFlagGuard() {
  let featureFlagSnapshot = { ...(config.features as unknown as Record<string, unknown>) }

  beforeEach(() => {
    featureFlagSnapshot = { ...(config.features as unknown as Record<string, unknown>) }
  })

  afterEach(() => {
    Object.assign(config.features as unknown as Record<string, unknown>, featureFlagSnapshot)
  })
}

export async function waitFor<T>(
  loader: () => Promise<T>,
  opts: { timeoutMs?: number; intervalMs?: number; pass: (value: T) => boolean },
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 1500
  const intervalMs = opts.intervalMs ?? 60
  const startedAt = Date.now()
  let last: T | null = null

  while (Date.now() - startedAt < timeoutMs) {
    const next = await loader()
    last = next
    if (opts.pass(next)) return next
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  if (last === null) {
    throw new Error('waitFor exhausted without any attempts')
  }
  return last
}

export async function createTestCommunity(input: {
  name: string
  slug: string
  description?: string
  rules_json?: Record<string, unknown>
}) {
  const createPersisted = communityRepo.createPersisted?.bind(communityRepo)
  const community = createPersisted
    ? await createPersisted(input)
    : communityRepo.create(input)
  await searchProjectionService.refreshCommunity(community.id)
  return community
}
