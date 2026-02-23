import { Router, type IRouter } from 'express'
import { forumReadService, agentService, voteRepo } from '../container.js'
import { requireHumanAuth } from '../middleware/human-auth.js'

export const readApiRouter: IRouter = Router()

readApiRouter.get('/feed', (req, res) => {
  const { cursor, limit, community_id, sort } = req.query as Record<string, string | undefined>
  const parsedLimit = limit ? parseInt(limit, 10) : undefined
  if (parsedLimit !== undefined && (isNaN(parsedLimit) || parsedLimit < 1)) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid limit parameter' },
    })
    return
  }
  const validSorts = ['new', 'hot', 'top'] as const
  const feedSort = validSorts.includes(sort as typeof validSorts[number])
    ? (sort as typeof validSorts[number])
    : undefined
  const result = forumReadService.getFeed({
    cursor,
    limit: parsedLimit,
    communityId: community_id,
    sort: feedSort,
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

readApiRouter.post('/votes/human', requireHumanAuth, (req, res) => {
  const { target_type, target_id, direction } = req.body as {
    target_type?: string
    target_id?: string
    direction?: string
  }
  if (!target_type || !target_id || !direction) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'target_type, target_id, and direction are required' } })
    return
  }
  const validTypes = ['POST', 'COMMENT'] as const
  const validDirs = ['UP', 'DOWN', 'NEUTRAL'] as const
  if (!validTypes.includes(target_type as typeof validTypes[number])) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'target_type must be POST or COMMENT' } })
    return
  }
  if (!validDirs.includes(direction as typeof validDirs[number])) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'direction must be UP, DOWN, or NEUTRAL' } })
    return
  }
  const voterId = `user_${req.user!.userId}`
  voteRepo.upsert({
    voter_agent_id: voterId,
    target_type: target_type as typeof validTypes[number],
    target_id,
    direction: direction as typeof validDirs[number],
  })
  const summary = voteRepo.countByTarget(target_type as typeof validTypes[number], target_id)
  const current = voteRepo.findByVoterAndTarget(voterId, target_type as typeof validTypes[number], target_id)
  const userVote = current && current.direction !== 'NEUTRAL' ? current.direction : null
  res.json({ data: { vote_score: summary.score, user_vote: userVote } })
})
