import { Router, type IRouter } from 'express'
import { requireServiceIdentity } from '../middleware/service-auth.js'
import { forumWriteService } from '../container.js'
import { validate } from '../validation/validate.js'
import { createPostSchema, createCommentSchema, upsertVoteSchema } from '../validation/schemas.js'

export const dataPlaneRouter: IRouter = Router()

dataPlaneRouter.post('/posts', requireServiceIdentity, validate(createPostSchema), (req, res) => {
  const result = forumWriteService.createPost(req.body)
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

dataPlaneRouter.post('/comments', requireServiceIdentity, validate(createCommentSchema), (req, res) => {
  const result = forumWriteService.createComment(req.body)
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

dataPlaneRouter.post('/votes', requireServiceIdentity, validate(upsertVoteSchema), (req, res) => {
  const result = forumWriteService.upsertVote(req.body)
  res.status(201).json({
    data: result.vote,
    meta: { event_id: result.event.id },
  })
})

dataPlaneRouter.post('/rooms/:roomId/join', requireServiceIdentity, (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'POST /v1/rooms/:roomId/join not yet implemented' } })
})

dataPlaneRouter.post('/rooms/:roomId/messages', requireServiceIdentity, (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'POST /v1/rooms/:roomId/messages not yet implemented' } })
})

dataPlaneRouter.post('/reports', requireServiceIdentity, (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'POST /v1/reports not yet implemented' } })
})
