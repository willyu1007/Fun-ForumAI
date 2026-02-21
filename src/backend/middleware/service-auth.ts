import crypto from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import { config } from '../lib/config.js'
import { UnauthorizedError } from '../lib/errors.js'

const ALLOWED_SERVICE_IDENTITIES = ['agent-runtime'] as const
const NONCE_CACHE = new Map<string, number>()
const NONCE_CLEANUP_INTERVAL_MS = 60_000
const NONCE_MAX_AGE_MS = config.serviceAuth.timestampToleranceMs * 2

setInterval(() => {
  const now = Date.now()
  for (const [nonce, ts] of NONCE_CACHE) {
    if (now - ts > NONCE_MAX_AGE_MS) NONCE_CACHE.delete(nonce)
  }
}, NONCE_CLEANUP_INTERVAL_MS).unref()

function verifyServiceToken(token: string, bodyRaw: string): { identity: string } {
  const parts = token.split(':')
  if (parts.length !== 4) {
    throw new UnauthorizedError('Malformed service token')
  }

  const [identity, timestamp, nonce, signature] = parts

  if (!ALLOWED_SERVICE_IDENTITIES.includes(identity as (typeof ALLOWED_SERVICE_IDENTITIES)[number])) {
    throw new UnauthorizedError(`Unknown service identity: ${identity}`)
  }

  const ts = parseInt(timestamp, 10)
  if (isNaN(ts) || Math.abs(Date.now() - ts) > config.serviceAuth.timestampToleranceMs) {
    throw new UnauthorizedError('Service token expired or clock skew too large')
  }

  if (NONCE_CACHE.has(nonce)) {
    throw new UnauthorizedError('Replayed nonce')
  }

  const bodyHash = crypto.createHash('sha256').update(bodyRaw || '').digest('hex')
  const payload = `${identity}:${timestamp}:${nonce}:${bodyHash}`
  const expected = crypto.createHmac('sha256', config.serviceAuth.secret).update(payload).digest('hex')

  if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
    throw new UnauthorizedError('Invalid service token signature')
  }

  NONCE_CACHE.set(nonce, Date.now())
  return { identity }
}

export function requireServiceIdentity(req: Request, _res: Response, next: NextFunction): void {
  const token = req.headers['x-service-token'] as string | undefined

  if (!token) {
    throw new UnauthorizedError('Missing X-Service-Token header')
  }

  const actorAgentId = req.body?.actor_agent_id
  const runId = req.body?.run_id

  if (!actorAgentId) {
    throw new UnauthorizedError('Missing actor_agent_id in request body')
  }
  if (!runId) {
    throw new UnauthorizedError('Missing run_id in request body')
  }

  const bodyRaw = JSON.stringify(req.body)
  verifyServiceToken(token, bodyRaw)

  next()
}

export function createServiceToken(
  identity: string,
  body: string,
  secret = config.serviceAuth.secret,
): string {
  const timestamp = Date.now().toString()
  const nonce = crypto.randomUUID()
  const bodyHash = crypto.createHash('sha256').update(body || '').digest('hex')
  const payload = `${identity}:${timestamp}:${nonce}:${bodyHash}`
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return `${identity}:${timestamp}:${nonce}:${signature}`
}
