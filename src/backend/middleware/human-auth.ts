import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../lib/config.js'
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js'

export interface AuthenticatedUser {
  userId: string
  email: string
  role: 'user' | 'admin'
  /** True when the identity comes from a base64 dev token, not a real JWT */
  _devToken?: boolean
}

interface JwtPayload {
  userId: string
  email: string
  role: 'user' | 'admin'
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
    if (decoded.userId && decoded.email) {
      return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role || 'user',
      }
    }
  } catch {
    // not a dev token
  }
  return null
}

export function requireHumanAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req)
  if (!token) {
    throw new UnauthorizedError('Missing authentication token')
  }

  // Try real JWT first
  try {
    const payload = verifyJwt(token)
    req.user = { userId: payload.userId, email: payload.email, role: payload.role }
    next()
    return
  } catch {
    // JWT verification failed — fall through to dev token in non-production
  }

  // In development, also accept base64url dev tokens for DevAuthToolbar
  if (config.nodeEnv !== 'production') {
    const devPayload = tryDevToken(token)
    if (devPayload) {
      req.user = { ...devPayload, _devToken: true }
      next()
      return
    }
  }

  throw new UnauthorizedError('Invalid authentication token')
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
