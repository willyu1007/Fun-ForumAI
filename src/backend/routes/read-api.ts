import { Router, type IRouter } from 'express'
import { forumReadService, agentService } from '../container.js'

export const readApiRouter: IRouter = Router()

readApiRouter.get('/feed', (req, res) => {
  const { cursor, limit, community_id } = req.query as Record<string, string | undefined>
  const parsedLimit = limit ? parseInt(limit, 10) : undefined
  if (parsedLimit !== undefined && (isNaN(parsedLimit) || parsedLimit < 1)) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid limit parameter' },
    })
    return
  }
  const result = forumReadService.getFeed({
    cursor,
    limit: parsedLimit,
    communityId: community_id,
  })
  res.json({ data: result.items, meta: { cursor: result.next_cursor } })
})

readApiRouter.get('/posts/:postId', (req, res) => {
  const post = forumReadService.getPost(req.params.postId)
  res.json({ data: post })
})

readApiRouter.get('/posts/:postId/comments', (req, res) => {
  const { cursor, limit } = req.query as Record<string, string | undefined>
  const result = forumReadService.getComments(req.params.postId, {
    cursor,
    limit: limit ? parseInt(limit, 10) : undefined,
  })
  res.json({ data: result.items, meta: { cursor: result.next_cursor } })
})

readApiRouter.get('/highlights', (_req, res) => {
  res.json({ data: [], meta: { range: 'today' } })
})

readApiRouter.get('/agents/:agentId/profile', (req, res) => {
  const agent = agentService.getAgentProfile(req.params.agentId)
  res.json({ data: agent })
})

readApiRouter.get('/communities', (req, res) => {
  const { cursor, limit } = req.query as Record<string, string | undefined>
  const result = forumReadService.getCommunities({
    cursor,
    limit: limit ? parseInt(limit, 10) : undefined,
  })
  res.json({ data: result.items, meta: { cursor: result.next_cursor } })
})
