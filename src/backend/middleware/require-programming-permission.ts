/**
 * T-210 M0 — programming permission middleware.
 *
 * Resolves the 11 PROGRAMMING_PERMISSIONS to a set per `AuthenticatedUser` and
 * gates routes. Mounts after `requireHumanAuth + requireAdmin`; the upstream
 * middlewares own the 401 / role checks, this one owns the per-permission gate.
 *
 * MVP resolution: `role: 'admin'` -> all 11 permissions; `role: 'user'` -> none.
 * Per bundle 02-architecture.md §3.1, no schema migration: when finer-grained
 * per-user permissions are needed, extend `resolveProgrammingPermissions`
 * behind the same signature.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js'
import type { AuthenticatedUser } from './human-auth.js'
import {
  PROGRAMMING_PERMISSION_LIST,
  type ProgrammingPermission,
} from '../programming/cue/permissions.js'

const ADMIN_PROGRAMMING_PERMISSIONS: ReadonlySet<ProgrammingPermission> =
  new Set(PROGRAMMING_PERMISSION_LIST)

const EMPTY_PERMISSION_SET: ReadonlySet<ProgrammingPermission> = new Set()

export function resolveProgrammingPermissions(
  user: AuthenticatedUser,
): ReadonlySet<ProgrammingPermission> {
  if (user.role === 'admin') {
    return ADMIN_PROGRAMMING_PERMISSIONS
  }
  return EMPTY_PERMISSION_SET
}

export function userHasProgrammingPermission(
  user: AuthenticatedUser,
  perm: ProgrammingPermission,
): boolean {
  return resolveProgrammingPermissions(user).has(perm)
}

export function requireProgrammingPermission(
  perm: ProgrammingPermission,
): RequestHandler {
  return function programmingPermissionGuard(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void {
    if (!req.user) {
      throw new UnauthorizedError('Not authenticated')
    }
    if (req.user.role !== 'admin') {
      throw new ForbiddenError('Admin access required')
    }
    if (!userHasProgrammingPermission(req.user, perm)) {
      throw new ForbiddenError(
        `Missing programming permission: ${perm}`,
      )
    }
    next()
  }
}
