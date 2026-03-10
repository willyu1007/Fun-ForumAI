import { randomUUID } from 'node:crypto'
import type { Request, Response } from 'express'
import { tryAuthenticateHuman } from '../middleware/human-auth.js'
import type { GuidanceOrchestrator } from './guidance-orchestrator.js'
import type { GuidanceResolvedActor, GuidanceActorRef } from './guidance-types.js'

const VISITOR_COOKIE = 'ff_vid'
const VISITOR_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 365

export function resolveGuidanceActorContext(req: Request, res: Response): GuidanceResolvedActor {
  const user = req.user ?? tryAuthenticateHuman(req)
  const existingVisitorId = typeof req.cookies?.[VISITOR_COOKIE] === 'string'
    ? req.cookies[VISITOR_COOKIE] as string
    : null
  const visitorId = existingVisitorId ?? randomUUID()
  if (!existingVisitorId) {
    res.cookie(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: VISITOR_COOKIE_MAX_AGE_MS,
      path: '/',
    })
  }
  return {
    actor_type: user ? 'USER' : 'VISITOR',
    actor_id: user?.userId ?? visitorId,
    visitor_id: visitorId,
    user_id: user?.userId ?? null,
  }
}

export function toGuidanceActorChannelKey(actor: GuidanceActorRef): string {
  return `${actor.actor_type}:${actor.actor_id}`
}

export async function trackGuidanceEventFromRequest(
  req: Request,
  res: Response,
  orchestrator: GuidanceOrchestrator,
  eventType: string,
  payload: Record<string, unknown> = {},
  opts: { dedup_key?: string } = {},
): Promise<void> {
  try {
    const actor = resolveGuidanceActorContext(req, res)
    await orchestrator.prepareActor(actor)
    await orchestrator.ingestEvent(actor, eventType, payload, opts)
  } catch (err) {
    console.error('[Guidance] request event ingest failed:', err)
  }
}
