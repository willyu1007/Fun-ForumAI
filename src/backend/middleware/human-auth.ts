import type { Request, Response, NextFunction } from 'express'
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js'

export interface AuthenticatedUser {
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

export function requireHumanAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req)
  if (!token) {
    throw new UnauthorizedError('Missing authentication token')
  }

  // TODO: Replace with real JWT verification once auth flow is implemented
  // For now, reject all tokens in production to be safe; in dev, accept a test format
  if (process.env.NODE_ENV === 'production') {
    throw new UnauthorizedError('Auth not yet implemented')
  }

  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString())
    if (!decoded.userId || !decoded.email) {
      throw new Error('Invalid token payload')
    }
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role || 'user',
    }
  } catch {
    throw new UnauthorizedError('Invalid authentication token')
  }

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
