import type { IRouter } from 'express'
import { forumReadService, forumWatchTelemetryService } from '../../container.js'
import { resolveGuidanceActorContext } from '../../guidance/http.js'
import { requireAdmin, requireHumanAuth, tryAuthenticateHuman } from '../../middleware/human-auth.js'
import type { ForumWatchTelemetryEventType } from '../../services/forum-watch-telemetry-service.js'
import {
  buildRuntimeContextPreviewSchema,
  forumWatchTelemetrySchema,
} from '../../validation/schemas.js'
import { validate } from '../../validation/validate.js'

function readQueryString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

export function registerReadDiscussionRoutes(router: IRouter): void {
  router.get('/posts/:postId/threads', async (req, res) => {
    const user = tryAuthenticateHuman(req)
    const { cursor, limit } = req.query as Record<string, string | undefined>
    const parsedLimit = limit ? parseInt(limit, 10) : undefined
    if (parsedLimit !== undefined && (isNaN(parsedLimit) || parsedLimit < 1)) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid limit parameter' },
      })
      return
    }
    const result = await forumReadService.getThreads(
      req.params.postId,
      {
        cursor,
        limit: parsedLimit,
      },
      user?.userId,
    )
    res.json({ data: result.items, meta: { cursor: result.next_cursor } })
  })

  router.get('/posts/:postId/reading-guide', async (req, res) => {
    const user = tryAuthenticateHuman(req)
    const data = await forumReadService.getReadingGuide(req.params.postId, user?.userId)
    res.json({ data })
  })

  router.get('/posts/:postId/discussion-forest', async (req, res) => {
    const user = tryAuthenticateHuman(req)
    const data = await forumReadService.getDiscussionForest(
      req.params.postId,
      {
        focus_thread_id: readQueryString(req.query.focus_thread_id) ?? readQueryString(req.query.threadId),
        focus_turn_id: readQueryString(req.query.focus_turn_id) ?? readQueryString(req.query.turnId),
      },
      user?.userId,
    )
    res.json({ data })
  })

  router.post('/posts/:postId/watch-telemetry', validate(forumWatchTelemetrySchema), (req, res) => {
    const parsed = req.body as {
      event_type: ForumWatchTelemetryEventType
      thread_id?: string | string[]
      turn_id?: string | string[]
      branch_group_id?: string | string[]
      source_surface?: string | string[]
      source_shelf?: string | string[]
    }
    const threadId = typeof parsed.thread_id === 'string' ? parsed.thread_id : undefined
    const turnId = typeof parsed.turn_id === 'string' ? parsed.turn_id : undefined
    const branchGroupId = typeof parsed.branch_group_id === 'string' ? parsed.branch_group_id : undefined
    const sourceSurface = typeof parsed.source_surface === 'string' ? parsed.source_surface : undefined
    const sourceShelf = typeof parsed.source_shelf === 'string' ? parsed.source_shelf : undefined
    const actor = resolveGuidanceActorContext(req, res)
    forumWatchTelemetryService.record({
      post_id: String(req.params.postId),
      event_type: parsed.event_type,
      actor_type: actor.actor_type,
      actor_id: actor.actor_id,
      thread_id: threadId,
      turn_id: turnId,
      branch_group_id: branchGroupId,
      source_surface: sourceSurface,
      source_shelf: sourceShelf,
    })
    res.status(202).json({ data: { accepted: true } })
  })

  router.get(
    '/internal/threads/:threadId/lifecycle',
    requireHumanAuth,
    requireAdmin,
    async (req, res) => {
      const data = await forumReadService.getThreadLifecycle(String(req.params.threadId))
      res.json({ data })
    },
  )

  router.get(
    '/internal/posts/:postId/semantic-capsule',
    requireHumanAuth,
    requireAdmin,
    async (req, res) => {
      const data = await forumReadService.getPostSemanticCapsule(
        String(req.params.postId),
        req.user?.userId,
      )
      res.json({ data })
    },
  )

  router.get(
    '/internal/threads/:threadId/semantic-capsule',
    requireHumanAuth,
    requireAdmin,
    async (req, res) => {
      const data = await forumReadService.getThreadSemanticCapsule(
        String(req.params.threadId),
        req.user?.userId,
      )
      res.json({ data })
    },
  )

  router.get(
    '/internal/posts/:postId/reading-guide',
    requireHumanAuth,
    requireAdmin,
    async (req, res) => {
      const data = await forumReadService.getReadingGuide(String(req.params.postId), req.user?.userId)
      res.json({ data })
    },
  )

  router.get(
    '/internal/posts/:postId/discussion-forest',
    requireHumanAuth,
    requireAdmin,
    async (req, res) => {
      const data = await forumReadService.getDiscussionForest(
        String(req.params.postId),
        {
          focus_thread_id: readQueryString(req.query.focus_thread_id) ?? readQueryString(req.query.threadId),
          focus_turn_id: readQueryString(req.query.focus_turn_id) ?? readQueryString(req.query.turnId),
        },
        req.user?.userId,
      )
      res.json({ data })
    },
  )

  router.post(
    '/internal/runtime-contexts/build',
    requireHumanAuth,
    requireAdmin,
    validate(buildRuntimeContextPreviewSchema),
    async (req, res) => {
      const data = await forumReadService.buildRuntimeContextPreview(
        {
          post_id: req.body.post_id,
          thread_id: req.body.thread_id ?? null,
          focus_turn_id: req.body.focus_turn_id ?? null,
          agent_id: req.body.agent_id ?? null,
          compare_debug: req.body.compare_debug ?? false,
        },
        req.user?.userId,
      )
      res.json({ data })
    },
  )
}
