import { Router, type IRouter, type Response } from 'express'
import { requireHumanAuth } from '../middleware/human-auth.js'
import { validate } from '../validation/validate.js'
import { allocateStatsSchema, previewStatsAllocationSchema } from '../validation/schemas.js'
import { config } from '../lib/config.js'
import { inferenceProfileService, statsService } from '../container.js'

export const agentStatsRouter: IRouter = Router()

async function assertAgentOwner(
  agentId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; status: number; code: string; message: string }> {
  const { agentRepo } = await import('../container.js')
  const agent = agentRepo.findById(agentId)
  if (!agent) {
    return { ok: false, status: 404, code: 'NOT_FOUND', message: `Agent ${agentId} not found` }
  }
  if (agent.owner_id !== userId) {
    return { ok: false, status: 403, code: 'FORBIDDEN', message: 'Not your agent' }
  }
  return { ok: true }
}

function ensureFeatureEnabled(res: Response): boolean {
  if (!config.features.agentStatsV1) {
    res
      .status(404)
      .json({ error: { code: 'FEATURE_DISABLED', message: 'Agent stats feature is disabled' } })
    return false
  }
  if (!statsService) {
    res
      .status(503)
      .json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Stats service unavailable' } })
    return false
  }
  return true
}

agentStatsRouter.get('/agents/:agentId/stats', requireHumanAuth, async (req, res) => {
  if (!ensureFeatureEnabled(res)) return

  const agentId = String(req.params.agentId)
  const ownership = await assertAgentOwner(agentId, req.user!.userId)
  if (!ownership.ok) {
    res
      .status(ownership.status)
      .json({ error: { code: ownership.code, message: ownership.message } })
    return
  }

  const snapshot = await statsService!.getSnapshot(agentId)
  res.json({
    data: {
      stats: serializeStats(snapshot.stats),
      state: serializeState(snapshot.state),
      derived: snapshot.derived,
    },
  })
})

agentStatsRouter.get('/agents/:agentId/stats/events', requireHumanAuth, async (req, res) => {
  if (!ensureFeatureEnabled(res)) return

  const agentId = String(req.params.agentId)
  const ownership = await assertAgentOwner(agentId, req.user!.userId)
  if (!ownership.ok) {
    res
      .status(ownership.status)
      .json({ error: { code: ownership.code, message: ownership.message } })
    return
  }

  const limit = Number.parseInt(String(req.query.limit ?? '20'), 10)
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const result = await statsService!.getEvents(agentId, { limit, cursor })

  res.json({
    data: {
      items: result.items.map((event) => ({
        id: event.id,
        event_type: event.event_type,
        source: event.source,
        idempotency_key: event.idempotency_key,
        delta_json: event.delta_json,
        created_at: event.created_at.toISOString(),
      })),
      next_cursor: result.next_cursor,
    },
  })
})

agentStatsRouter.get(
  '/agents/:agentId/stats/state-timeline',
  requireHumanAuth,
  async (req, res) => {
    if (!ensureFeatureEnabled(res)) return

    const agentId = String(req.params.agentId)
    const ownership = await assertAgentOwner(agentId, req.user!.userId)
    if (!ownership.ok) {
      res
        .status(ownership.status)
        .json({ error: { code: ownership.code, message: ownership.message } })
      return
    }

    const hours = Number.parseInt(String(req.query.hours ?? '24'), 10)
    const points = await statsService!.getStateTimeline(agentId, hours)
    res.json({
      data: points.map((point) => ({
        at: point.at.toISOString(),
        valence: point.valence,
        arousal: point.arousal,
        confidence: point.confidence,
        irritability: point.irritability,
        fatigue: point.fatigue,
      })),
    })
  },
)

agentStatsRouter.post(
  '/agents/:agentId/stats/preview-allocation',
  requireHumanAuth,
  validate(previewStatsAllocationSchema),
  async (req, res) => {
    if (!ensureFeatureEnabled(res)) return

    const agentId = String(req.params.agentId)
    const ownership = await assertAgentOwner(agentId, req.user!.userId)
    if (!ownership.ok) {
      res
        .status(ownership.status)
        .json({ error: { code: ownership.code, message: ownership.message } })
      return
    }

    const preview = await statsService!.previewAllocation(agentId, req.body)
    const personalityNarrative = await inferenceProfileService.previewNarrative(
      agentId,
      preview.after,
    )
    res.json({
      data: {
        before: serializeStats(preview.before),
        after: serializeStats(preview.after),
        cost_points: preview.cost_points,
        remaining_points: preview.remaining_points,
        derived: preview.derived,
        personality_narrative: personalityNarrative,
      },
    })
  },
)

agentStatsRouter.post(
  '/agents/:agentId/stats/allocate',
  requireHumanAuth,
  validate(allocateStatsSchema),
  async (req, res) => {
    if (!ensureFeatureEnabled(res)) return

    const agentId = String(req.params.agentId)
    const ownership = await assertAgentOwner(agentId, req.user!.userId)
    if (!ownership.ok) {
      res
        .status(ownership.status)
        .json({ error: { code: ownership.code, message: ownership.message } })
      return
    }

    const allocated = await statsService!.allocate(agentId, req.body)
    res.json({
      data: {
        stats: serializeStats(allocated.stats),
        state: serializeState(allocated.state),
        derived: allocated.derived,
        spent_points: allocated.spent_points,
        remaining_points: allocated.remaining_points,
        deduped: allocated.deduped,
      },
    })
  },
)

agentStatsRouter.get('/agents/:agentId/stats/derived', requireHumanAuth, async (req, res) => {
  if (!ensureFeatureEnabled(res)) return

  const agentId = String(req.params.agentId)
  const ownership = await assertAgentOwner(agentId, req.user!.userId)
  if (!ownership.ok) {
    res
      .status(ownership.status)
      .json({ error: { code: ownership.code, message: ownership.message } })
    return
  }

  const sceneRaw = typeof req.query.scene === 'string' ? req.query.scene : 'forum'
  const scene =
    sceneRaw === 'forum' ||
    sceneRaw === 'chat' ||
    sceneRaw === 'relation' ||
    sceneRaw === 'vote' ||
    sceneRaw === 'memory'
      ? sceneRaw
      : 'forum'

  const privacyTopK =
    req.query.privacy_top_k !== undefined ? Number(req.query.privacy_top_k) : undefined
  const privacyBudget =
    req.query.privacy_budget !== undefined ? Number(req.query.privacy_budget) : undefined

  const derived = await statsService!.derive(agentId, scene, {
    privacy_top_k: Number.isFinite(privacyTopK) ? privacyTopK : undefined,
    privacy_budget: Number.isFinite(privacyBudget) ? privacyBudget : undefined,
  })

  res.json({ data: derived })
})

function serializeStats(stats: {
  unspent_points: number
  granted_points_total: number
  sociability: number
  curiosity: number
  assertiveness: number
  empathy: number
  brashness: number
  cynicism: number
  stubbornness: number
  volatility: number
  memory: number
  learning: number
  version: number
  created_at: Date
  updated_at: Date
}) {
  return {
    unspent_points: stats.unspent_points,
    granted_points_total: stats.granted_points_total,
    sociability: stats.sociability,
    curiosity: stats.curiosity,
    assertiveness: stats.assertiveness,
    empathy: stats.empathy,
    brashness: stats.brashness,
    cynicism: stats.cynicism,
    stubbornness: stats.stubbornness,
    volatility: stats.volatility,
    memory: stats.memory,
    learning: stats.learning,
    version: stats.version,
    created_at: stats.created_at.toISOString(),
    updated_at: stats.updated_at.toISOString(),
  }
}

function serializeState(state: {
  valence: number
  arousal: number
  confidence: number
  irritability: number
  fatigue: number
  last_updated_at: Date
}) {
  return {
    valence: state.valence,
    arousal: state.arousal,
    confidence: state.confidence,
    irritability: state.irritability,
    fatigue: state.fatigue,
    last_updated_at: state.last_updated_at.toISOString(),
  }
}
