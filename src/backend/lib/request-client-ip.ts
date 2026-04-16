import type { Request } from 'express'

export function getTrustedClientIp(req: Pick<Request, 'ip'>): string | null {
  return req.ip ?? null
}
