import { Router, type IRouter } from 'express'
import { requireHumanAuth } from '../middleware/human-auth.js'
import { agentService, achievementChronicleService } from '../container.js'
import { ForbiddenError } from '../lib/errors.js'
import { guidanceOrchestrator } from '../container.js'
import { trackGuidanceEventFromRequest } from '../guidance/http.js'

export const agentChronicleRouter: IRouter = Router()

agentChronicleRouter.get('/agents/:agentId/achievements', requireHumanAuth, async (req, res) => {
  const agentId = String(req.params.agentId)
  const actor = req.user!
  const existing = agentService.getAgent(agentId)
  const isAllowed = actor.role === 'admin' || existing.owner_id === actor.userId
  if (!isAllowed) {
    throw new ForbiddenError('Only owner or admin can access achievements')
  }

  if (actor.role === 'admin') {
    console.log('AchievementAccessAudit', JSON.stringify({
      actor_user_id: actor.userId,
      actor_role: actor.role,
      target_agent_id: agentId,
      endpoint: 'GET /v1/agents/:agentId/achievements',
      at: new Date().toISOString(),
    }))
  }

  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const limitRaw = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : undefined
  const result = await achievementChronicleService.listAchievementsForOwner(agentId, {
    cursor,
    limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
  })
  await trackGuidanceEventFromRequest(
    req,
    res,
    guidanceOrchestrator,
    'ACHIEVEMENTS_VIEWED',
    { agent_id: agentId },
    { dedup_key: `achievements:${actor.userId}:${agentId}:${cursor ?? 'root'}` },
  )
  res.json({ data: result.items, meta: { cursor: result.next_cursor } })
})

agentChronicleRouter.get('/agents/:agentId/chronicle', requireHumanAuth, async (req, res) => {
  const agentId = String(req.params.agentId)
  const actor = req.user!
  const existing = agentService.getAgent(agentId)
  const isAllowed = actor.role === 'admin' || existing.owner_id === actor.userId
  if (!isAllowed) {
    throw new ForbiddenError('Only owner or admin can access chronicle')
  }

  if (actor.role === 'admin') {
    console.log('AchievementAccessAudit', JSON.stringify({
      actor_user_id: actor.userId,
      actor_role: actor.role,
      target_agent_id: agentId,
      endpoint: 'GET /v1/agents/:agentId/chronicle',
      at: new Date().toISOString(),
    }))
  }

  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const limitRaw = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : undefined
  const includeFolded = String(req.query.include_folded ?? 'false') === 'true'

  const result = await achievementChronicleService.listChronicleForOwner(agentId, {
    cursor,
    limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
    include_folded: includeFolded,
  })

  await trackGuidanceEventFromRequest(
    req,
    res,
    guidanceOrchestrator,
    'CHRONICLE_VIEWED',
    { agent_id: agentId },
    { dedup_key: `chronicle:${actor.userId}:${agentId}:${cursor ?? 'root'}` },
  )
  res.json({
    data: result.items,
    meta: {
      cursor: result.next_cursor,
      folded_count: result.folded_count,
    },
  })
})
