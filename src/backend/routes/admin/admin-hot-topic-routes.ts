import type { IRouter } from 'express'
import { hotTopicOpsService } from '../../container.js'
import { requireAdmin, requireHumanAuth } from '../../middleware/human-auth.js'

const HOT_TOPIC_POST_DISTRIBUTION_STATES = new Set(['NORMAL', 'NO_RECOMMEND'])
const HOT_TOPIC_ROOM_DISTRIBUTION_STATES = new Set(['NORMAL', 'NO_RECOMMEND', 'BLOCKED'])
const HOT_TOPIC_ROOM_MODES = new Set(['NORMAL', 'MANUAL_REVIEW_ONLY', 'DISABLED'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function registerAdminHotTopicRoutes(router: IRouter): void {
  router.get('/admin/hot-topic/dashboard', requireHumanAuth, requireAdmin, async (_req, res) => {
    const dashboard = await hotTopicOpsService.getDashboard()
    res.json({ data: dashboard.items, meta: { generated_at: dashboard.generated_at } })
  })

  router.get('/admin/hot-topic/alerts', requireHumanAuth, requireAdmin, async (_req, res) => {
    const alerts = await hotTopicOpsService.getAlerts()
    res.json({ data: alerts.items, meta: { generated_at: alerts.generated_at } })
  })

  router.post(
    '/admin/hot-topic/posts/:postId/distribution',
    requireHumanAuth,
    requireAdmin,
    async (req, res) => {
      if (!isRecord(req.body)) {
        res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'Request body must be an object' } })
        return
      }

      const distributionState =
        typeof req.body.distribution_state === 'string' ? req.body.distribution_state.trim() : ''
      const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : null
      if (!HOT_TOPIC_POST_DISTRIBUTION_STATES.has(distributionState)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'distribution_state must be NORMAL or NO_RECOMMEND',
          },
        })
        return
      }

      const item = await hotTopicOpsService.updatePostDistribution({
        post_id: String(req.params.postId),
        distribution_state: distributionState as 'NORMAL' | 'NO_RECOMMEND',
        actor_user_id: req.user!.userId,
        reason,
      })
      res.json({ data: item })
    },
  )

  router.post(
    '/admin/hot-topic/rooms/:roomId/control',
    requireHumanAuth,
    requireAdmin,
    async (req, res) => {
      if (!isRecord(req.body)) {
        res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'Request body must be an object' } })
        return
      }

      const hotTopicMode =
        typeof req.body.hot_topic_mode === 'string' ? req.body.hot_topic_mode.trim() : null
      const distributionState =
        typeof req.body.distribution_state === 'string' ? req.body.distribution_state.trim() : null
      const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : null

      if (hotTopicMode !== null && !HOT_TOPIC_ROOM_MODES.has(hotTopicMode)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'hot_topic_mode must be NORMAL, MANUAL_REVIEW_ONLY, or DISABLED',
          },
        })
        return
      }
      if (distributionState !== null && !HOT_TOPIC_ROOM_DISTRIBUTION_STATES.has(distributionState)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'distribution_state must be NORMAL, NO_RECOMMEND, or BLOCKED',
          },
        })
        return
      }

      const item = await hotTopicOpsService.updateRoomControl({
        room_id: String(req.params.roomId),
        actor_user_id: req.user!.userId,
        hot_topic_mode: hotTopicMode as 'NORMAL' | 'MANUAL_REVIEW_ONLY' | 'DISABLED' | undefined,
        distribution_state: distributionState as 'NORMAL' | 'NO_RECOMMEND' | 'BLOCKED' | undefined,
        reason,
      })
      res.json({ data: item })
    },
  )
}
