import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../lib/config.js'
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js'

export interface AuthenticatedUser {
  userId: string
  email: string | null
  phone?: string | null
  role: 'user' | 'admin'
  /** True when the identity comes from a base64 dev token, not a real JWT */
  _devToken?: boolean
}

interface JwtPayload {
  userId: string
  email: string | null
  phone: string | null
  role: 'user' | 'admin'
}

type DevTokenSyncFn = (user: AuthenticatedUser) => Promise<void>
let devTokenSyncFn: DevTokenSyncFn | null = null

function allowDevTokenAuth(): boolean {
  return config.allowDevTools || config.nodeEnv === 'test'
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  const cookie = req.cookies?.auth_token
  if (cookie) return cookie as string
  return null
}

function verifyJwt(token: string): JwtPayload {
  return jwt.verify(token, config.auth.jwtSecret) as JwtPayload
}

function tryDevToken(token: string): JwtPayload | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString())
    if (decoded.userId && (decoded.email || decoded.phone)) {
      return {
        userId: decoded.userId,
        email: decoded.email ?? null,
        phone: decoded.phone ?? null,
        role: decoded.role || 'user',
      }
    }
  } catch {
    // not a dev token
  }
  return null
}

function resolveUserFromToken(token: string): AuthenticatedUser | null {
  try {
    const payload = verifyJwt(token)
    return {
      userId: payload.userId,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      role: payload.role,
    }
  } catch {
    // JWT verification failed — fall through to dev token in non-production
  }

  if (allowDevTokenAuth()) {
    const devPayload = tryDevToken(token)
    if (devPayload) {
      return { ...devPayload, _devToken: true }
    }
  }

  return null
}

export function tryAuthenticateHuman(req: Request): AuthenticatedUser | null {
  const token = extractToken(req)
  if (!token) return null

  const user = resolveUserFromToken(token)
  if (!user) return null
  req.user = user
  return user
}

async function syncDevTokenIdentityIfNeeded(user: AuthenticatedUser): Promise<void> {
  if (!user._devToken) return
  if (!allowDevTokenAuth()) return
  if (!config.db.usePrisma) return
  if (!devTokenSyncFn) return
  await devTokenSyncFn(user)
}

export function registerDevTokenSync(fn: DevTokenSyncFn | null): void {
  devTokenSyncFn = fn
}

export async function requireHumanAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req)
  if (!token) {
    throw new UnauthorizedError('Missing authentication token')
  }

  const user = resolveUserFromToken(token)
  if (!user) throw new UnauthorizedError('Invalid authentication token')

  req.user = user
  await syncDevTokenIdentityIfNeeded(user)
  next()
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated')
  }
  if (req.user.role !== 'admin') {
    throw new ForbiddenError('Admin access required')
  }
  next()
}

export function createDevToken(user: AuthenticatedUser): string {
  return Buffer.from(JSON.stringify(user)).toString('base64url')
}
