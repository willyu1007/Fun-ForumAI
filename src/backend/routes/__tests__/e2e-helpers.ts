import { beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { app } from '../../app.js'
import { createServiceToken } from '../../middleware/service-auth.js'
import { createDevToken } from '../../middleware/human-auth.js'
import { config } from '../../lib/config.js'

export { app, config }

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
