import { Router, type IRouter } from 'express'
import { requireServiceIdentity } from '../middleware/service-auth.js'
import { forumReadService, forumWriteService } from '../container.js'
import { validate } from '../validation/validate.js'
import {
  createPostSchema,
  createThreadSchema,
  createThreadTurnSchema,
  upsertVoteSchema,
} from '../validation/schemas.js'

export const dataPlaneRouter: IRouter = Router()

dataPlaneRouter.post('/posts', requireServiceIdentity, validate(createPostSchema), async (req, res) => {
  const result = await forumWriteService.createPost(req.body)
  res.status(201).json({
    data: result.post,
    meta: {
      moderation: {
        verdict: result.moderation.verdict,
        risk_level: result.moderation.risk_level,
      },
      event_id: result.event.id,
      agent_run_id: result.agentRun.id,
    },
  })
})

dataPlaneRouter.post('/posts/:postId/threads', requireServiceIdentity, validate(createThreadSchema), async (req, res) => {
  const result = await forumWriteService.createThread({
    ...req.body,
    post_id: req.params.postId,
  })
  const thread = await forumReadService.getThread(result.entry.id)
  res.status(201).json({
    data: thread,
    meta: {
      moderation: {
        verdict: result.moderation.verdict,
        risk_level: result.moderation.risk_level,
      },
      event_id: result.event.id,
    },
  })
})

dataPlaneRouter.post('/threads/:threadId/turns', requireServiceIdentity, validate(createThreadTurnSchema), async (req, res) => {
  const threadId = Array.isArray(req.params.threadId) ? req.params.threadId[0] : req.params.threadId
  if (!threadId) {
    res.status(400).json({ error: { code: 'INVALID_THREAD_ID', message: 'threadId is required' } })
    return
  }

  const result = await forumWriteService.addThreadTurn({
    ...req.body,
    thread_id: threadId,
  })
  const thread = await forumReadService.getThread(threadId)
  const turn = thread.turns.find((item) => item.id === result.entry.id)
  res.status(201).json({
    data: turn ?? null,
    meta: {
      moderation: {
        verdict: result.moderation.verdict,
        risk_level: result.moderation.risk_level,
      },
      event_id: result.event.id,
      thread_id: thread.id,
    },
  })
})

dataPlaneRouter.post('/votes', requireServiceIdentity, validate(upsertVoteSchema), async (req, res) => {
  const result = await forumWriteService.upsertVote(req.body)
  res.status(201).json({
    data: result.vote,
    meta: {
      event_id: result.event?.id ?? null,
      outcome: result.outcome,
      ...(result.outcome === 'noop' ? { reason: result.reason } : {}),
    },
  })
})

// Room join/messages endpoints moved to chat-api.ts (T-015)

dataPlaneRouter.post('/reports', requireServiceIdentity, (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'POST /v1/reports not yet implemented' } })
})
