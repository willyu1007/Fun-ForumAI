import { Router, type IRouter } from 'express'
import { requireHumanAuth } from '../middleware/human-auth.js'
import { agentService, humanParticipationService, agentCommunityMembershipService } from '../container.js'
import { config } from '../lib/config.js'
import { ForbiddenError } from '../lib/errors.js'
import { validate } from '../validation/validate.js'
import { guidanceOrchestrator } from '../container.js'
import { trackGuidanceEventFromRequest } from '../guidance/http.js'
import {
  updateAgentMembershipsSchema,
  patchAgentMembershipStatusSchema,
} from '../validation/schemas.js'
import { attachPublicAgentBadges } from './agent-badge-view.js'

export const agentSocialRouter: IRouter = Router()

agentSocialRouter.post('/agents/:agentId/follow', requireHumanAuth, async (req, res) => {
  if (!config.features.humanParticipationV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Human participation is disabled by feature flag.' },
    })
    return
  }

  const result = await humanParticipationService.followAgent(req.user!.userId, String(req.params.agentId))
  await trackGuidanceEventFromRequest(
    req,
    res,
    guidanceOrchestrator,
    'AGENT_FOLLOWED',
    { agent_id: String(req.params.agentId) },
    { dedup_key: `agent_followed:${req.user!.userId}:${String(req.params.agentId)}` },
  )
  res.status(201).json({ data: result })
})

agentSocialRouter.delete('/agents/:agentId/follow', requireHumanAuth, async (req, res) => {
  if (!config.features.humanParticipationV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Human participation is disabled by feature flag.' },
    })
    return
  }

  const result = await humanParticipationService.unfollowAgent(req.user!.userId, String(req.params.agentId))
  res.json({ data: result })
})

agentSocialRouter.patch(
  '/agents/:agentId/memberships',
  requireHumanAuth,
  validate(updateAgentMembershipsSchema),
  async (req, res) => {
    if (!config.features.membershipsV1) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Membership management is disabled by feature flag.' },
      })
      return
    }

    const agentId = String(req.params.agentId)
    const actor = req.user!
    const existing = agentService.getAgent(agentId)
    const isAllowed = actor.role === 'admin' || existing.owner_id === actor.userId
    if (!isAllowed) {
      throw new ForbiddenError('Only owner or admin can update memberships')
    }

    const result = await agentCommunityMembershipService.patchMemberships({
      agent_id: agentId,
      add: req.body.add ?? [],
      remove: req.body.remove ?? [],
      role: req.body.role,
      actor_user_id: actor.userId,
    })
    res.json({ data: result })
  },
)

agentSocialRouter.patch(
  '/agents/:agentId/memberships/:communityId/status',
  requireHumanAuth,
  validate(patchAgentMembershipStatusSchema),
  async (req, res) => {
    if (!config.features.membershipStatusV1) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Membership status control is disabled by feature flag.' },
      })
      return
    }

    const agentId = String(req.params.agentId)
    const communityId = String(req.params.communityId)
    const actor = req.user!
    const existing = agentService.getAgent(agentId)
    const isAllowed = actor.role === 'admin' || existing.owner_id === actor.userId
    if (!isAllowed) {
      throw new ForbiddenError('Only owner or admin can update membership status')
    }

    const data = await agentCommunityMembershipService.updateMembershipStatus({
      agent_id: agentId,
      community_id: communityId,
      status: req.body.status,
      reason: req.body.reason,
      actor_user_id: actor.userId,
      actor_role: actor.role,
    })

    res.json({ data })
  },
)

agentSocialRouter.get('/me/followed-agents', requireHumanAuth, async (req, res) => {
  if (!config.features.humanParticipationV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Human participation is disabled by feature flag.' },
    })
    return
  }

  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 20
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20

  const result = humanParticipationService.listFollowedAgents({
    user_id: req.user!.userId,
    cursor,
    limit,
  })

  const items = await attachPublicAgentBadges(result.items)
  res.json({ data: items, meta: { cursor: result.next_cursor } })
})
