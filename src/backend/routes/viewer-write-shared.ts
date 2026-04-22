import { createHash } from 'node:crypto'
import type { Request } from 'express'
import { forumReadService, viewerPublicWriteService } from '../container.js'
import { getTrustedClientIp } from '../lib/request-client-ip.js'
import type {
  PublicWriteCommunityRole,
  PublicWriteResult,
} from '../../shared/forum-orchestration.js'

function resolveRequestCredential(req: Request): string | null {
  const authHeader = req.headers.authorization
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  const cookie = req.cookies?.auth_token
  return typeof cookie === 'string' && cookie.trim().length > 0 ? cookie : null
}

function hashNullableValue(value: string | null): string | null {
  if (!value) return null
  return createHash('sha256').update(value).digest('hex')
}

function getViewerSessionId(req: Request): string | null {
  return hashNullableValue(resolveRequestCredential(req))
}

function getUserAgentHash(req: Request): string | null {
  const header = req.headers['user-agent']
  return typeof header === 'string' && header.trim().length > 0
    ? hashNullableValue(header.trim())
    : null
}

function getViewerCommunityRole(req: Request): PublicWriteCommunityRole {
  return req.user?.role === 'admin' ? 'ADMIN' : 'VIEWER'
}

export function getViewerWriteStatus(result: PublicWriteResult): number {
  if (result.result === 'ACCEPTED') return 201
  if (result.result === 'PENDING_MODERATION') return 202
  if (result.result === 'RATE_LIMITED') return 429
  return 200
}

export async function executeViewerPublicThreadWrite(req: Request): Promise<PublicWriteResult> {
  return viewerPublicWriteService.createPublicThread({
    actor_user_id: req.user!.userId,
    actor_role: req.user!.role,
    community_role: getViewerCommunityRole(req),
    client_ip: getTrustedClientIp(req),
    session_id: getViewerSessionId(req),
    user_agent_hash: getUserAgentHash(req),
    post_id: String(req.params.postId),
    body: req.body.body,
    idempotency_key: req.body.idempotency_key ?? null,
    source_context: req.body.source_context ?? null,
  })
}

export async function executeViewerPublicTurnWrite(req: Request): Promise<PublicWriteResult> {
  const thread = await forumReadService.getThread(String(req.params.threadId), req.user!.userId)
  return viewerPublicWriteService.createPublicTurn({
    actor_user_id: req.user!.userId,
    actor_role: req.user!.role,
    community_role: getViewerCommunityRole(req),
    client_ip: getTrustedClientIp(req),
    session_id: getViewerSessionId(req),
    user_agent_hash: getUserAgentHash(req),
    post_id: thread.post_id,
    thread_id: String(req.params.threadId),
    body: req.body.body,
    idempotency_key: req.body.idempotency_key ?? null,
    source_context: req.body.source_context ?? null,
    focused_turn_id: req.body.focused_turn_id ?? req.body.anchor_turn_id ?? null,
    actual_anchor_turn_id: req.body.actual_anchor_turn_id ?? req.body.anchor_turn_id ?? null,
    quoted_excerpt: req.body.quoted_excerpt ?? null,
  })
}

export async function executeViewerAudienceMessageWrite(req: Request): Promise<PublicWriteResult> {
  return viewerPublicWriteService.createAudienceMessage({
    actor_user_id: req.user!.userId,
    actor_role: req.user!.role,
    community_role: getViewerCommunityRole(req),
    client_ip: getTrustedClientIp(req),
    session_id: getViewerSessionId(req),
    user_agent_hash: getUserAgentHash(req),
    post_id: String(req.params.postId),
    body: req.body.body,
    parent_message_id: req.body.parent_message_id ?? null,
    quoted_turn: req.body.quoted_turn ?? null,
    idempotency_key: req.body.idempotency_key ?? null,
    source_context: req.body.source_context ?? null,
  })
}

export async function executeViewerAudienceMessageDelete(req: Request): Promise<{
  message_id: string
  deleted_at: string
}> {
  return viewerPublicWriteService.deleteAudienceMessage({
    actor_user_id: req.user!.userId,
    message_id: String(req.params.messageId),
  })
}
