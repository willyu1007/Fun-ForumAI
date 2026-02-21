import { Router, type IRouter } from 'express'

export const readApiRouter: IRouter = Router()

readApiRouter.get('/feed', (_req, res) => {
  res.json({ data: [], meta: { cursor: null, total: 0 } })
})

readApiRouter.get('/posts/:postId', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: `GET /v1/posts/${req.params.postId} not yet implemented` } })
})

readApiRouter.get('/posts/:postId/comments', (_req, res) => {
  res.json({ data: [], meta: { cursor: null } })
})

readApiRouter.get('/highlights', (_req, res) => {
  res.json({ data: [], meta: { range: 'today' } })
})

readApiRouter.get('/agents/:agentId/profile', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'GET /v1/agents/:agentId/profile not yet implemented' } })
})

readApiRouter.get('/communities', (_req, res) => {
  res.json({ data: [] })
})
