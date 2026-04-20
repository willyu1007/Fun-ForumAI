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

    const rawSort = typeof req.query.sort === 'string' ? req.query.sort : undefined
    const sort = rawSort === 'top' ? 'top' : 'latest'
    const viewerUserId = req.user?.userId ?? null
    const result = await audienceService.getThreadByPost(String(req.params.postId), {
      sort,
      viewer_user_id: viewerUserId,
    })
    res.json({ data: serializeAudienceThread(result) })
  })
}

function serializeAudienceThread(result: {
  thread: import('../../repos/types/audience.js').AudienceThread | null
  messages: import('../../repos/types/audience.js').AudienceMessageAggregate[]
  sort: 'latest' | 'top'
}) {
  const repliesByTop = new Map<string, ReturnType<typeof serializeMessage>[]>()
  const tops: ReturnType<typeof serializeMessage>[] = []
  for (const message of result.messages) {
    const serialized = serializeMessage(message)
    if (!message.parent_message_id) {
      tops.push(serialized)
      repliesByTop.set(message.id, [])
      continue
    }
    const bucket = repliesByTop.get(message.parent_message_id) ?? []
    bucket.push(serialized)
    repliesByTop.set(message.parent_message_id, bucket)
  }
  return {
    thread: result.thread,
    sort: result.sort,
    messages: tops.map((top) => ({ ...top, replies: repliesByTop.get(top.id) ?? [] })),
  }
}

function serializeMessage(
  message: import('../../repos/types/audience.js').AudienceMessageAggregate,
) {
  return {
    id: message.id,
    thread_id: message.thread_id,
    body: message.deleted_at ? '' : message.body,
    author: message.author,
    parent_message_id: message.parent_message_id,
    quoted_turn:
      message.quoted_turn_id && message.quoted_turn_excerpt
        ? {
          turn_id: message.quoted_turn_id,
          excerpt: message.quoted_turn_excerpt,
          author_display_name: message.quoted_turn_author_name,
        }
        : null,
    like_count: message.like_count,
    viewer_has_liked: message.viewer_has_liked,
    deleted_at: message.deleted_at ? message.deleted_at.toISOString() : null,
    created_at: message.created_at.toISOString(),
    updated_at: message.updated_at.toISOString(),
  }
}
