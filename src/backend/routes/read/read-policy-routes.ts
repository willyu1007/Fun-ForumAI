import type { IRouter } from 'express'
import { config } from '../../lib/config.js'
import {
  audienceService,
  forumOrchestrationPolicyService,
  forumReadService,
  participationContractService,
} from '../../container.js'
import { requireHumanAuth } from '../../middleware/human-auth.js'
import { validate } from '../../validation/validate.js'
import {
  updateOrchestrationPolicyOverrideSchema,
  updateParticipationContractOverrideSchema,
} from '../../validation/schemas.js'

export function registerReadPolicyRoutes(router: IRouter): void {
  router.get('/communities/:communityId/participation-contract', async (req, res) => {
    const data = await forumReadService.getCommunityParticipationContract(req.params.communityId)
    res.json({ data })
  })

  router.get('/posts/:postId/participation-contract', async (req, res) => {
    const data = await forumReadService.getPostParticipationContract(req.params.postId)
    res.json({ data })
  })

  router.get('/posts/:postId/orchestration-policy', async (req, res) => {
    const data = await forumReadService.getPostOrchestrationPolicy(req.params.postId)
    res.json({ data })
  })

  router.put(
    '/posts/:postId/participation-contract-override',
    requireHumanAuth,
    validate(updateParticipationContractOverrideSchema),
    async (req, res) => {
      const data = await participationContractService.setPostOverride({
        post_id: String(req.params.postId),
        actor_user_id: req.user!.userId,
        actor_role: req.user!.role,
        override: req.body,
      })
      res.json({ data })
    },
  )

  router.delete(
    '/posts/:postId/participation-contract-override',
    requireHumanAuth,
    async (req, res) => {
      const data = await participationContractService.clearPostOverride({
        post_id: String(req.params.postId),
        actor_user_id: req.user!.userId,
        actor_role: req.user!.role,
      })
      res.json({ data })
    },
  )

  router.put(
    '/posts/:postId/orchestration-policy-override',
    requireHumanAuth,
    validate(updateOrchestrationPolicyOverrideSchema),
    async (req, res) => {
      const data = await forumOrchestrationPolicyService.setPostOverride({
        post_id: String(req.params.postId),
        actor_user_id: req.user!.userId,
        actor_role: req.user!.role,
        override: req.body,
      })
      res.json({ data })
    },
  )

  router.delete(
    '/posts/:postId/orchestration-policy-override',
    requireHumanAuth,
    async (req, res) => {
      const data = await forumOrchestrationPolicyService.clearPostOverride({
        post_id: String(req.params.postId),
        actor_user_id: req.user!.userId,
        actor_role: req.user!.role,
      })
      res.json({ data })
    },
  )

  router.get('/posts/:postId/audience-thread', async (req, res) => {
    if (!config.launch.capabilities.audienceZoneV1) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Audience API is disabled by feature flag.' },
      })
      return
    }

    const contract = await participationContractService.getPostContract(String(req.params.postId))
    if (!contract.audience_lane.enabled) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Audience lane is not enabled for this post.' },
      })
      return
    }

    const result = await audienceService.getThreadByPost(String(req.params.postId))
    res.json({ data: result })
  })
}
