import { describe, it, expect, beforeEach } from 'vitest'
import express, { type IRouter, type ErrorRequestHandler } from 'express'
import request from 'supertest'
import { registerAdminCueRoutes } from '../admin/admin-cue-routes.js'
import { CueEditorService } from '../../services/cue-editor-service.js'
import { InMemoryCueRepository } from '../../repos/cue-repository.js'
import { createDevToken } from '../../middleware/human-auth.js'
import type { CueCommunityScope } from '../../programming/cue/types.js'

const SCOPE: CueCommunityScope = { mode: 'single', community_id: 'c1' }

const adminToken = createDevToken({
  userId: 'admin-1',
  email: 'admin@example.com',
  phone: null,
  role: 'admin',
})
const userToken = createDevToken({
  userId: 'user-1',
  email: 'user@example.com',
  phone: null,
  role: 'user',
})

function makeApp(repo: InMemoryCueRepository) {
  const service = new CueEditorService({ repo })
  const app = express()
  app.use(express.json())
  const router: IRouter = express.Router()
  registerAdminCueRoutes(router, { service })
  app.use('/v1', router)
  // Translate AppError thrown out of async handlers
  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err && typeof err === 'object' && 'statusCode' in err) {
      const e = err as { statusCode: number; code: string; message: string; details?: unknown }
      res.status(e.statusCode).json({
        error: { code: e.code, message: e.message, ...(e.details !== undefined ? { details: e.details } : {}) },
      })
      return
    }
    res.status(500).json({ error: { code: 'INTERNAL', message: String(err) } })
  }
  app.use(errorHandler)
  return app
}

const baselineTheme = { topic_seed: 't1', tone_band: 'calm' as const }
const baselineScene = {
  community_scope: SCOPE,
  public_stage_scope: ['forum' as const],
  privacy_policy: 'public_only' as const,
  private_reference_policy: 'forbidden' as const,
  safety_profile: 'standard' as const,
}
const baselineRoles = { requirements: [{ role: 'anchor' as const, weight: 0.7 }] }

function buildPatchBody() {
  const triggerAt = new Date(Date.now() + 3_600_000).toISOString()
  return {
    version: 1,
    partial: {
      trigger_at: triggerAt,
      timezone: 'Asia/Shanghai',
      priority: 50,
      lane: 'standard',
      dispatch_policy: {
        trigger_at: triggerAt,
        timezone: 'Asia/Shanghai',
        dispatch_mode: 'graceful',
        grace_seconds: 30,
        priority: 50,
        lane: 'standard',
        misfire_policy: 'delay',
        max_attempts: 1,
        retry_backoff_seconds: 60,
      },
      theme_intent: baselineTheme,
      scene_constraints: baselineScene,
      role_requirements: baselineRoles,
      risk_level: 'standard',
    },
  }
}

describe('admin-cue-routes — permission gates', () => {
  let app: ReturnType<typeof makeApp>
  let scheduleId: string

  beforeEach(async () => {
    const repo = new InMemoryCueRepository()
    const sched = await repo.createSchedule({
      scope_type: 'community',
      community_id: 'c1',
      date_range_start: new Date(Date.now() - 86_400_000),
      date_range_end: new Date(Date.now() + 30 * 86_400_000),
      source: 'manual',
      status: 'draft',
    })
    scheduleId = sched.id
    app = makeApp(repo)
  })

  it('unauthenticated request gets 401', async () => {
    const res = await request(app)
      .post('/v1/admin/programming/cues')
      .send({ schedule_id: scheduleId, scope: SCOPE, patch: buildPatchBody() })
    expect(res.status).toBe(401)
  })

  it('non-admin user gets 403', async () => {
    const res = await request(app)
      .post('/v1/admin/programming/cues')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ schedule_id: scheduleId, scope: SCOPE, patch: buildPatchBody() })
    expect(res.status).toBe(403)
  })

  it('admin gets 201 on create', async () => {
    const res = await request(app)
      .post('/v1/admin/programming/cues')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ schedule_id: scheduleId, scope: SCOPE, patch: buildPatchBody() })
    expect(res.status).toBe(201)
    expect(res.body.data.cue.status).toBe('draft')
    expect(res.body.data.change.approval_status).toBe('auto_applied')
    expect(res.body.data.change.actor_user_id).toBe('admin-1')
  })
})

describe('admin-cue-routes — happy paths through full cue lifecycle', () => {
  let app: ReturnType<typeof makeApp>
  let scheduleId: string

  beforeEach(async () => {
    const repo = new InMemoryCueRepository()
    const sched = await repo.createSchedule({
      scope_type: 'community',
      community_id: 'c1',
      date_range_start: new Date(Date.now() - 86_400_000),
      date_range_end: new Date(Date.now() + 30 * 86_400_000),
      source: 'manual',
      status: 'draft',
    })
    scheduleId = sched.id
    app = makeApp(repo)
  })

  it('full lifecycle: create → patch → publish → cancel', async () => {
    const create = await request(app)
      .post('/v1/admin/programming/cues')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ schedule_id: scheduleId, scope: SCOPE, patch: buildPatchBody() })
    expect(create.status).toBe(201)
    const cueId = create.body.data.cue.id

    const patch = await request(app)
      .patch(`/v1/admin/programming/cues/${cueId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ patch: { version: 1, partial: { priority: 80 } } })
    expect(patch.status).toBe(200)
    expect(patch.body.data.cue.priority).toBe(80)
    expect(patch.body.data.change.change_type).toBe('update_cue')

    const publish = await request(app)
      .post(`/v1/admin/programming/cues/${cueId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect(publish.status).toBe(200)
    expect(publish.body.data.cue.status).toBe('scheduled')

    const cancel = await request(app)
      .post(`/v1/admin/programming/cues/${cueId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'no longer needed' })
    expect(cancel.status).toBe(200)
    expect(cancel.body.data.cue.status).toBe('cancelled')
    expect(cancel.body.data.change.reason).toBe('no longer needed')
  })

  it('attach + remove media', async () => {
    const create = await request(app)
      .post('/v1/admin/programming/cues')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ schedule_id: scheduleId, scope: SCOPE, patch: buildPatchBody() })
    const cueId = create.body.data.cue.id

    const attach = await request(app)
      .post(`/v1/admin/programming/cues/${cueId}/media`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        asset_id: 'asset-1',
        role: 'context_anchor',
        usage_strength: 'optional',
        use_policy: 'runtime_only',
      })
    expect(attach.status).toBe(201)
    const mediaId = attach.body.data.media_id

    const remove = await request(app)
      .delete(`/v1/admin/programming/cues/${cueId}/media/${mediaId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(remove.status).toBe(200)
    expect(remove.body.data.removed).toBe(true)
  })

  it('rejects forbidden field via PATCH (schema layer)', async () => {
    const create = await request(app)
      .post('/v1/admin/programming/cues')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ schedule_id: scheduleId, scope: SCOPE, patch: buildPatchBody() })
    const cueId = create.body.data.cue.id

    const res = await request(app)
      .patch(`/v1/admin/programming/cues/${cueId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ patch: { version: 1, partial: { agent_dialogue: 'hi' } } })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  // T-216: route schema accepts all four usage_strength values. Runtime
  // enforcement for anchor / selected_only_pool lives in CueMediaPlanner and
  // worker tests; this route test only covers admin attach validation.
  it.each([['anchor'], ['selected_only_pool']] as const)(
    'attach accepts usage_strength=%s after T-216 M0 unlock',
    async (strength) => {
      const create = await request(app)
        .post('/v1/admin/programming/cues')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ schedule_id: scheduleId, scope: SCOPE, patch: buildPatchBody() })
      const cueId = create.body.data.cue.id

      const res = await request(app)
        .post(`/v1/admin/programming/cues/${cueId}/media`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          asset_id: `asset-${strength}`,
          role: 'context_anchor',
          usage_strength: strength,
          use_policy: 'runtime_only',
        })
      expect(res.status).toBe(201)
      expect(res.body.data.media_id).toBeTruthy()
    },
  )

  it('rollback schedule creates new schedule version', async () => {
    const res = await request(app)
      .post(`/v1/admin/programming/schedule/${scheduleId}/rollback`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ summary: 'incident recovery' })
    expect(res.status).toBe(201)
    expect(res.body.data.schedule.id).not.toBe(scheduleId)
    expect(res.body.data.schedule.rollback_from_schedule_id).toBe(scheduleId)
  })
})
