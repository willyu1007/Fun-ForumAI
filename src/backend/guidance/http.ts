import { randomUUID } from 'node:crypto'
import type { Request, Response } from 'express'
import { config } from '../lib/config.js'
import { tryAuthenticateHuman } from '../middleware/human-auth.js'
import type { GuidanceOrchestrator } from './guidance-orchestrator.js'
import type {
  GuidanceInboxView,
  GuidanceResolvedActor,
  GuidanceActorRef,
  GuidanceSummaryView,
} from './guidance-types.js'

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

export function peekGuidanceActorContext(req: Request): GuidanceActorRef {
  const user = req.user ?? tryAuthenticateHuman(req)
  const visitorId = typeof req.cookies?.[VISITOR_COOKIE] === 'string'
    ? req.cookies[VISITOR_COOKIE] as string
    : 'guidance-disabled'
  return {
    actor_type: user ? 'USER' : 'VISITOR',
    actor_id: user?.userId ?? visitorId,
  }
}

export function toGuidanceActorChannelKey(actor: GuidanceActorRef): string {
  return `${actor.actor_type}:${actor.actor_id}`
}

export function buildDisabledGuidanceSummary(actor: GuidanceActorRef): GuidanceSummaryView {
  return {
    actor: {
      actor_type: actor.actor_type,
      actor_id: actor.actor_id,
      current_track: 'UNDECIDED',
      stage: 'NEW_VISITOR',
      explained: {
        two_tracks: false,
      },
      completed: {
        followed_first_agent: false,
        used_following_feed: false,
        created_agent: false,
        started_private_chat: false,
        nurture_receipt_ready: false,
        watch_public_effect: false,
      },
      first_success: {
        achieved: false,
        at: null,
      },
      reveal: {
        style: true,
        instructions: true,
        advanced: true,
      },
      latest_owner_agent_id: null,
      latest_receipt_session_id: null,
    },
    modules: [],
  }
}

export function buildDisabledGuidanceInbox(): GuidanceInboxView {
  return {
    items: [],
    unread_count: 0,
  }
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
    if (!config.features.guidanceV1) return
    const actor = resolveGuidanceActorContext(req, res)
    await orchestrator.prepareActor(actor)
    await orchestrator.ingestEvent(actor, eventType, payload, opts)
  } catch (err) {
    console.error('[Guidance] request event ingest failed:', err)
  }
}
