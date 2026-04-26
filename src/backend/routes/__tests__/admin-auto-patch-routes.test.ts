import { describe, it, expect, beforeEach } from 'vitest'
import express, { type IRouter, type ErrorRequestHandler } from 'express'
import request from 'supertest'
import { registerAdminCueRoutes } from '../admin/admin-cue-routes.js'
import { CueEditorService } from '../../services/cue-editor-service.js'
import { InMemoryCueRepository } from '../../repos/cue-repository.js'
import { createDevToken } from '../../middleware/human-auth.js'

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
  registerAdminCueRoutes(router, { service, cueRepo: repo })
  app.use('/v1', router)
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

async function seedAutoPatch(
  repo: InMemoryCueRepository,
  overrides: Partial<Parameters<InMemoryCueRepository['recordChange']>[0]> = {},
) {
  return repo.recordChange({
    schedule_id: 'sched-1',
    cue_id: null,
    source: 'automated',
    actor_user_id: null,
    actor_system: 'auto-cue-editor',
    trigger_id: 'trigger-1',
    trigger_type: 'COMMUNITY_LULL',
    change_type: 'create_cue',
    base_revision: null,
    patch_json: {
      version: 1,
      partial: { trigger_at: '2026-04-27T20:00:00Z', priority: 50 },
    },
    diff_json: null,
    validation_status: 'passed',
    validation_json: null,
    risk_level: 'standard',
    approval_status: 'pending',
    load_snapshot_json: null,
    reason: 'community lull detected',
    applied_at: null,
    ...overrides,
  })
}

describe('admin-auto-patch-routes — list', () => {
  let app: ReturnType<typeof makeApp>
  let repo: InMemoryCueRepository

  beforeEach(async () => {
    repo = new InMemoryCueRepository()
    app = makeApp(repo)
  })

  it('returns pending automated changes for admin', async () => {
    await seedAutoPatch(repo)
    await seedAutoPatch(repo, { trigger_type: 'GLOBAL_RUNTIME_IDLE' })
    const res = await request(app)
      .get('/v1/admin/programming/auto-patches')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.items).toHaveLength(2)
    expect(res.body.data.total).toBe(2)
    for (const item of res.body.data.items) {
      expect(item.source).toBe('automated')
      expect(item.approval_status).toBe('pending')
    }
  })

  it('filters by approval_status=approved', async () => {
    const pending = await seedAutoPatch(repo)
    await repo.updateChangeApproval({
      id: pending.id,
      approval_status: 'approved',
      applied_at: new Date(),
      actor_user_id: 'admin-1',
    })
    await seedAutoPatch(repo) // a second pending row
    const res = await request(app)
      .get('/v1/admin/programming/auto-patches?approval_status=approved')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.items).toHaveLength(1)
    expect(res.body.data.items[0].approval_status).toBe('approved')
  })

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/v1/admin/programming/auto-patches')
    expect(res.status).toBe(401)
  })

  it('rejects non-admin users with 403', async () => {
    const res = await request(app)
      .get('/v1/admin/programming/auto-patches')
      .set('Authorization', `Bearer ${userToken}`)
    expect(res.status).toBe(403)
  })
})

describe('admin-auto-patch-routes — detail', () => {
  let app: ReturnType<typeof makeApp>
  let repo: InMemoryCueRepository

  beforeEach(() => {
    repo = new InMemoryCueRepository()
    app = makeApp(repo)
  })

  it('returns the change row by id', async () => {
    const change = await seedAutoPatch(repo)
    const res = await request(app)
      .get(`/v1/admin/programming/auto-patches/${change.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.change.id).toBe(change.id)
    expect(res.body.data.change.source).toBe('automated')
  })

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/v1/admin/programming/auto-patches/does-not-exist')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
  })

  it('returns 404 when the row exists but source is manual (not auto)', async () => {
    const manualChange = await repo.recordChange({
      schedule_id: 'sched-1',
      source: 'manual',
      change_type: 'create_cue',
      patch_json: { version: 1, partial: {} },
    })
    const res = await request(app)
      .get(`/v1/admin/programming/auto-patches/${manualChange.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
  })
})

describe('admin-auto-patch-routes — approve', () => {
  let app: ReturnType<typeof makeApp>
  let repo: InMemoryCueRepository

  beforeEach(() => {
    repo = new InMemoryCueRepository()
    app = makeApp(repo)
  })

  it('unsupported change_type (update_dispatch_policy): marks approved + apply_outcome=unsupported', async () => {
    const change = await seedAutoPatch(repo, { change_type: 'update_dispatch_policy' })
    const res = await request(app)
      .post(`/v1/admin/programming/auto-patches/${change.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect(res.status).toBe(200)
    expect(res.body.data.change.approval_status).toBe('approved')
    expect(res.body.data.change.actor_user_id).toBe('admin-1')
    expect(res.body.data.change.applied_at).toBeTruthy()
    expect(res.body.data.apply_outcome).toBe('unsupported')
    expect(res.body.data.apply_unsupported_reason).toContain('update_dispatch_policy')
  })

  it('rejects re-approval (409 INVALID_STATE)', async () => {
    // Use an unsupported type so first approve marks the row as
    // 'approved' (rather than 'auto_applied') — the second approve
    // then trips the INVALID_STATE guard.
    const change = await seedAutoPatch(repo, { change_type: 'update_dispatch_policy' })
    await request(app)
      .post(`/v1/admin/programming/auto-patches/${change.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    const second = await request(app)
      .post(`/v1/admin/programming/auto-patches/${change.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect(second.status).toBe(409)
    expect(second.body.error?.code).toBe('INVALID_STATE')
  })

  it('rejects unknown id with 404', async () => {
    const res = await request(app)
      .post('/v1/admin/programming/auto-patches/does-not-exist/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect(res.status).toBe(404)
  })

  it('returns 403 for non-admin', async () => {
    const change = await seedAutoPatch(repo)
    const res = await request(app)
      .post(`/v1/admin/programming/auto-patches/${change.id}/approve`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({})
    expect(res.status).toBe(403)
  })
})

describe('admin-auto-patch-routes — approve closes the inbox loop (apply integration)', () => {
  let app: ReturnType<typeof makeApp>
  let repo: InMemoryCueRepository

  beforeEach(() => {
    repo = new InMemoryCueRepository()
    app = makeApp(repo)
  })

  async function seedScheduleAndCue() {
    const schedule = await repo.createSchedule({
      scope_type: 'community',
      community_id: 'c1',
      date_range_start: new Date(Date.now() - 86_400_000),
      date_range_end: new Date(Date.now() + 30 * 86_400_000),
      source: 'manual',
      status: 'published',
    })
    const triggerAt = new Date(Date.now() + 3_600_000)
    const cue = await repo.createCue({
      schedule_id: schedule.id,
      source_type: 'manual',
      community_id: 'c1',
      scope: { mode: 'single', community_id: 'c1' },
      trigger_at: triggerAt,
      timezone: 'UTC',
      priority: 50,
      lane: 'standard',
      dispatch_policy: {
        trigger_at: triggerAt.toISOString(),
        timezone: 'UTC',
        dispatch_mode: 'graceful',
        grace_seconds: 30,
        priority: 50,
        lane: 'standard',
        misfire_policy: 'delay',
        max_attempts: 1,
        retry_backoff_seconds: 60,
      },
      theme_intent: { topic_seed: 't1', tone_band: 'calm' },
      scene_constraints: {
        community_scope: { mode: 'single', community_id: 'c1' },
        public_stage_scope: ['forum'],
        privacy_policy: 'public_only',
        private_reference_policy: 'forbidden',
        safety_profile: 'standard',
      },
      role_requirements: { requirements: [{ role: 'anchor', weight: 0.7 }] },
      locked_fields: [],
      risk_level: 'standard',
      status: 'scheduled',
      idempotency_key: 'idem-route-1',
    })
    return { schedule, cue }
  }

  it('update_cue: applies the patch + flips original to auto_applied (single-row audit)', async () => {
    const { cue } = await seedScheduleAndCue()
    const change = await seedAutoPatch(repo, {
      change_type: 'update_cue',
      cue_id: cue.id,
      patch_json: { version: 1, partial: { priority: 88 } },
    })
    const res = await request(app)
      .post(`/v1/admin/programming/auto-patches/${change.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect(res.status).toBe(200)
    expect(res.body.data.apply_outcome).toBe('applied')
    expect(res.body.data.change.id).toBe(change.id) // same row, flipped in place
    expect(res.body.data.change.approval_status).toBe('auto_applied')
    expect(res.body.data.cue.priority).toBe(88)

    // Cue actually mutated.
    const fresh = await repo.findCueById(cue.id)
    expect(fresh?.priority).toBe(88)

    // Single-row audit: only the original row exists.
    const all = await repo.listChangesForCue(cue.id)
    expect(all).toHaveLength(1)
    expect(all[0]?.id).toBe(change.id)
  })

  it('cancel_cue: cancels the cue + flips original to auto_applied', async () => {
    const { cue } = await seedScheduleAndCue()
    const change = await seedAutoPatch(repo, {
      change_type: 'cancel_cue',
      cue_id: cue.id,
      reason: 'lull persisted, cancel evening cue',
    })
    const res = await request(app)
      .post(`/v1/admin/programming/auto-patches/${change.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect(res.status).toBe(200)
    expect(res.body.data.apply_outcome).toBe('applied')
    expect(res.body.data.cue.status).toBe('cancelled')
  })

  it('locked-field collision returns 422 APPLY_FAILED, leaves original at pending', async () => {
    const { cue } = await seedScheduleAndCue()
    await repo.updateCue(cue.id, { locked_fields: ['priority'] })
    const change = await seedAutoPatch(repo, {
      change_type: 'update_cue',
      cue_id: cue.id,
      patch_json: { version: 1, partial: { priority: 99 } },
    })
    const res = await request(app)
      .post(`/v1/admin/programming/auto-patches/${change.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect(res.status).toBe(422)
    expect(res.body.error?.code).toBe('APPLY_FAILED')
    const fresh = await repo.findChangeById(change.id)
    expect(fresh?.approval_status).toBe('pending')
  })
})

describe('admin-auto-patch-routes — reject', () => {
  let app: ReturnType<typeof makeApp>
  let repo: InMemoryCueRepository

  beforeEach(() => {
    repo = new InMemoryCueRepository()
    app = makeApp(repo)
  })

  it('flips approval_status to rejected and stores reason', async () => {
    const change = await seedAutoPatch(repo)
    const res = await request(app)
      .post(`/v1/admin/programming/auto-patches/${change.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'wrong scene family' })
    expect(res.status).toBe(200)
    expect(res.body.data.change.approval_status).toBe('rejected')
    expect(res.body.data.change.reason).toBe('wrong scene family')
    expect(res.body.data.change.applied_at).toBeNull()
  })

  it('requires a non-empty reason', async () => {
    const change = await seedAutoPatch(repo)
    const res = await request(app)
      .post(`/v1/admin/programming/auto-patches/${change.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('rejects re-reject after approval (409 INVALID_STATE)', async () => {
    // Same reasoning as above — unsupported change_type so first
    // approve flips to 'approved' (not 'auto_applied'), then the
    // reject is blocked by INVALID_STATE.
    const change = await seedAutoPatch(repo, { change_type: 'update_dispatch_policy' })
    await request(app)
      .post(`/v1/admin/programming/auto-patches/${change.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    const res = await request(app)
      .post(`/v1/admin/programming/auto-patches/${change.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'changed mind' })
    expect(res.status).toBe(409)
  })
})
