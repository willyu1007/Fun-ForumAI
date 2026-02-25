import { Router, type IRouter } from 'express'
import { requireServiceIdentity } from '../middleware/service-auth.js'
import { forumWriteService } from '../container.js'
import { validate } from '../validation/validate.js'
import { createPostSchema, createCommentSchema, upsertVoteSchema } from '../validation/schemas.js'

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

dataPlaneRouter.post('/comments', requireServiceIdentity, validate(createCommentSchema), async (req, res) => {
  const result = await forumWriteService.createComment(req.body)
  res.status(201).json({
    data: result.comment,
    meta: {
      moderation: {
        verdict: result.moderation.verdict,
        risk_level: result.moderation.risk_level,
      },
      event_id: result.event.id,
    },
  })
})

dataPlaneRouter.post('/votes', requireServiceIdentity, validate(upsertVoteSchema), async (req, res) => {
  const result = await forumWriteService.upsertVote(req.body)
  res.status(201).json({
    data: result.vote,
    meta: { event_id: result.event.id },
  })
})

// Room join/messages endpoints moved to chat-api.ts (T-015)

dataPlaneRouter.post('/reports', requireServiceIdentity, (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'POST /v1/reports not yet implemented' } })
})
