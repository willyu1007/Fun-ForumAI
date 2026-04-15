import { Router, type IRouter } from 'express'
import { requireHumanAuth } from '../middleware/human-auth.js'
import {
  agentService,
  humanParticipationService,
  agentCommunityMembershipService,
  searchProjectionService,
} from '../container.js'
import { config } from '../lib/config.js'
import { ForbiddenError } from '../lib/errors.js'
import { validate } from '../validation/validate.js'
import { guidanceOrchestrator } from '../container.js'
import { trackGuidanceEventFromRequest } from '../guidance/http.js'
import {
  updateAgentMembershipsSchema,
  patchAgentMembershipStatusSchema,
} from '../validation/schemas.js'

export const agentSocialRouter: IRouter = Router()

agentSocialRouter.post('/agents/:agentId/follow', requireHumanAuth, async (req, res) => {
  if (!config.launch.capabilities.humanParticipationV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Human participation is disabled by feature flag.' },
    })
    return
  }

  const result = await humanParticipationService.followAgent(req.user!.userId, String(req.params.agentId))
  await searchProjectionService.reconcileAgent(String(req.params.agentId), {
    reason: 'agent_follow',
    scopes: ['agent', 'threads'],
  })
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
  if (!config.launch.capabilities.humanParticipationV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Human participation is disabled by feature flag.' },
    })
    return
  }

  const result = await humanParticipationService.unfollowAgent(req.user!.userId, String(req.params.agentId))
  await searchProjectionService.reconcileAgent(String(req.params.agentId), {
    reason: 'agent_unfollow',
    scopes: ['agent', 'threads'],
  })
  res.json({ data: result })
})

agentSocialRouter.post('/communities/:communityId/follow', requireHumanAuth, async (req, res) => {
  if (!config.launch.capabilities.humanParticipationV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Human participation is disabled by feature flag.' },
    })
    return
  }

  const result = await humanParticipationService.followCommunity(
    req.user!.userId,
    String(req.params.communityId),
  )
  res.status(201).json({ data: result })
})

agentSocialRouter.delete('/communities/:communityId/follow', requireHumanAuth, async (req, res) => {
  if (!config.launch.capabilities.humanParticipationV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Human participation is disabled by feature flag.' },
    })
    return
  }

  const result = await humanParticipationService.unfollowCommunity(
    req.user!.userId,
    String(req.params.communityId),
  )
  res.json({ data: result })
})

agentSocialRouter.patch(
  '/agents/:agentId/memberships',
  requireHumanAuth,
  validate(updateAgentMembershipsSchema),
  async (req, res) => {
    if (!config.launch.capabilities.membershipsV1) {
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
    agentService.assertAgentMutable(existing)

    const result = await agentCommunityMembershipService.patchMemberships({
      agent_id: agentId,
      add: req.body.add ?? [],
      remove: req.body.remove ?? [],
      role: req.body.role,
      actor_user_id: actor.userId,
    })
    await searchProjectionService.reconcileAgent(agentId, {
      reason: 'agent_memberships',
      scopes: ['agent', 'communities'],
    })
    await Promise.all(
      result.updated.added
        .concat(result.updated.removed)
        .map((communityId: string) => searchProjectionService.refreshCommunity(communityId)),
    )
    res.json({ data: result })
  },
)

agentSocialRouter.patch(
  '/agents/:agentId/memberships/:communityId/status',
  requireHumanAuth,
  validate(patchAgentMembershipStatusSchema),
  async (req, res) => {
    if (!config.launch.capabilities.membershipStatusV1) {
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
    agentService.assertAgentMutable(existing)

    const data = await agentCommunityMembershipService.updateMembershipStatus({
      agent_id: agentId,
      community_id: communityId,
      status: req.body.status,
      reason: req.body.reason,
      actor_user_id: actor.userId,
      actor_role: actor.role,
    })
    await searchProjectionService.reconcileAgent(agentId, {
      reason: 'agent_membership_status',
      scopes: ['agent', 'communities'],
    })
    await searchProjectionService.refreshCommunity(communityId)

    res.json({ data })
  },
)
