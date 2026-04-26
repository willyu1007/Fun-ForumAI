/**
 * T-210 closure smoke test — full lifecycle through the admin cue editor.
 *
 * Walks one cue from `create` to `cancel`, exercising every M0 / M1 / M2 / M3 / M4
 * surface in order, and verifying the audit chain reconstructs all transitions
 * with the correct discriminators.
 *
 * The flow:
 *   1. Permission gate — non-admin gets 403 on the create endpoint.
 *   2. Create draft cue.
 *   3. PATCH with a routine update (priority bump). Audit row #2: update_cue.
 *   4. PATCH adding a locked path. Audit row #3: update_cue.
 *   5. PATCH attempting to overwrite the locked field — expect 400.
 *   6. POST /media — expect 201, audit row #4: attach_media.
 *   7. POST /preview with a touch on the locked field — expect overall='has_errors'.
 *   8. POST /preview with a clean patch — expect 5 stages and the two stub markers.
 *   9. POST /publish — audit row #5: update_cue with transition.kind='publish_cue'.
 *   10. POST /cancel — audit row #6: cancel_cue.
 *   11. GET /audit — expect 6 change rows newest-first; verify discriminators.
 *
 * Boundary intent: ensures the editor produces coherent audit lineage so T-215
 * (public projection) and T-214 (auto-editor inbox) can rely on the channel.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import express, { type IRouter, type ErrorRequestHandler } from 'express'
import request from 'supertest'
import { registerAdminCueRoutes } from '../admin/admin-cue-routes.js'
import { CueEditorService } from '../../services/cue-editor-service.js'
import { CuePreviewService } from '../../services/cue-preview-service.js'
import { MediaPickerService } from '../../services/media-picker-service.js'
import { InMemoryCueRepository } from '../../repos/cue-repository.js'
import { InMemoryMediaAssetRepository } from '../../repos/media-asset-repository.js'
import { loadSignalServiceStub } from '../../services/__stubs__/load-signal-service-stub.js'
import { directorCueBriefStub } from '../../services/__stubs__/director-cue-brief-stub.js'
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

interface Harness {
  app: ReturnType<typeof express>
  cueRepo: InMemoryCueRepository
  mediaAssetRepo: InMemoryMediaAssetRepository
  scheduleId: string
  pickableAssetId: string
}

async function setup(): Promise<Harness> {
  const cueRepo = new InMemoryCueRepository()
  const mediaAssetRepo = new InMemoryMediaAssetRepository()

  const cueEditorService = new CueEditorService({ repo: cueRepo })
  const mediaPickerService = new MediaPickerService({ mediaAssetRepo })
  const previewService = new CuePreviewService({
    repo: cueRepo,
    mediaAssetRepo,
    loadSignalService: loadSignalServiceStub,
    directorCueBrief: directorCueBriefStub,
  })

  const schedule = await cueRepo.createSchedule({
    scope_type: 'community',
    community_id: 'c1',
    date_range_start: new Date(Date.now() - 86_400_000),
    date_range_end: new Date(Date.now() + 30 * 86_400_000),
    source: 'manual',
    status: 'draft',
  })

  const asset = await mediaAssetRepo.create({
    source_kind: 'owner_console_upload',
    visibility_policy: 'public_original_allowed',
    lifecycle_status: 'active',
    storage_key: 'storage/lifecycle.png',
    mime_type: 'image/png',
    file_size_bytes: 2048,
    sha256: 'c'.repeat(64),
  })

  const app = express()
  app.use(express.json())
  const router: IRouter = express.Router()
  registerAdminCueRoutes(router, {
    service: cueEditorService,
    mediaPicker: mediaPickerService,
    previewService,
    cueRepo,
  })
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

  return { app, cueRepo, mediaAssetRepo, scheduleId: schedule.id, pickableAssetId: asset.id }
}

function buildCreatePatch() {
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
      theme_intent: { topic_seed: 'lifecycle topic', tone_band: 'calm' },
      scene_constraints: {
        community_scope: SCOPE,
        public_stage_scope: ['forum'],
        privacy_policy: 'public_only',
        private_reference_policy: 'forbidden',
        safety_profile: 'standard',
      },
      role_requirements: { requirements: [{ role: 'anchor', weight: 0.7 }] },
      risk_level: 'standard',
    },
  }
}

describe('T-210 closure — full editor lifecycle', () => {
  let harness: Harness

  beforeEach(async () => {
    harness = await setup()
  })

  it('walks a cue from draft to cancellation with a complete audit trail', async () => {
    const { app, scheduleId, pickableAssetId } = harness

    // 1. Permission gate — non-admin denied.
    const denied = await request(app)
      .post('/v1/admin/programming/cues')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ schedule_id: scheduleId, scope: SCOPE, patch: buildCreatePatch() })
    expect(denied.status).toBe(403)

    // 2. Create draft.
    const createRes = await request(app)
      .post('/v1/admin/programming/cues')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ schedule_id: scheduleId, scope: SCOPE, patch: buildCreatePatch() })
    expect(createRes.status).toBe(201)
    const cueId = createRes.body.data.cue.id as string
    expect(createRes.body.data.cue.status).toBe('draft')
    expect(createRes.body.data.cue.revision).toBe(1)
    expect(createRes.body.data.change.change_type).toBe('create_cue')
    expect(createRes.body.data.change.approval_status).toBe('auto_applied')
    expect(createRes.body.data.change.actor_user_id).toBe('admin-1')

    // 3. Routine update — priority bump.
    const update1 = await request(app)
      .patch(`/v1/admin/programming/cues/${cueId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ patch: { version: 1, partial: { priority: 80 } } })
    expect(update1.status).toBe(200)
    expect(update1.body.data.cue.priority).toBe(80)
    expect(update1.body.data.cue.revision).toBe(2)
    expect(update1.body.data.change.change_type).toBe('update_cue')
    expect(update1.body.data.change.base_revision).toBe(1)

    // 4. Add a lock on theme_intent.tone_band.
    const update2 = await request(app)
      .patch(`/v1/admin/programming/cues/${cueId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ patch: { version: 1, partial: { locked_fields: ['theme_intent.tone_band'] } } })
    expect(update2.status).toBe(200)
    expect(update2.body.data.cue.locked_fields).toEqual(['theme_intent.tone_band'])
    expect(update2.body.data.cue.revision).toBe(3)

    // 5. Attempt to update the locked field — must be rejected.
    const lockReject = await request(app)
      .patch(`/v1/admin/programming/cues/${cueId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patch: {
          version: 1,
          partial: { theme_intent: { topic_seed: 'lifecycle topic', tone_band: 'sharp' } },
        },
      })
    expect(lockReject.status).toBe(400)
    expect(lockReject.body.error.message).toMatch(/locked/i)

    // Confirm the locked-field rejection did NOT bump revision.
    const stillUntouched = await request(app)
      .get(`/v1/admin/programming/cues/${cueId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(stillUntouched.status).toBe(200)
    expect(stillUntouched.body.data.cue.revision).toBe(3)
    expect(stillUntouched.body.data.cue.theme_intent.tone_band).toBe('calm')

    // 6. Attach media.
    const attach = await request(app)
      .post(`/v1/admin/programming/cues/${cueId}/media`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        asset_id: pickableAssetId,
        role: 'context_anchor',
        usage_strength: 'optional',
        use_policy: 'runtime_only',
      })
    expect(attach.status).toBe(201)
    expect(attach.body.data.change.change_type).toBe('attach_media')

    // 7. Preview with a patch that touches the locked field — overall=has_errors.
    const previewBlocked = await request(app)
      .post(`/v1/admin/programming/cues/${cueId}/preview`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patch: {
          version: 1,
          partial: { theme_intent: { topic_seed: 'lifecycle topic', tone_band: 'sharp' } },
        },
      })
    expect(previewBlocked.status).toBe(200)
    expect(previewBlocked.body.data.overall).toBe('has_errors')
    const lastStage =
      previewBlocked.body.data.stages[previewBlocked.body.data.stages.length - 1]
    expect(lastStage.stage).toBe('deterministic')
    expect(lastStage.status).toBe('error')
    const lastPayload = lastStage.payload as { issues: string[] }
    expect(lastPayload.issues.some((s) => s.includes('locked'))).toBe(true)

    // 8. Preview with a clean patch — five stages, two stub markers.
    const previewClean = await request(app)
      .post(`/v1/admin/programming/cues/${cueId}/preview`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ patch: { version: 1, partial: { priority: 70 } } })
    expect(previewClean.status).toBe(200)
    expect(previewClean.body.data.overall).toBe('ok')
    expect(previewClean.body.data.stages.map((s: { stage: string }) => s.stage)).toEqual([
      'schema',
      'deterministic',
      'load',
      'media',
      'director_compile',
    ])
    const stubSources = previewClean.body.data.stages
      .map((s: { source?: string }) => s.source)
      .filter((s: string | undefined): s is string => Boolean(s))
    expect(stubSources).toContain('stub_until_t213')
    expect(stubSources).toContain('stub_until_t212')

    // 9. Publish (draft -> scheduled). Audit row uses change_type='update_cue'
    //     with patch_json.transition.kind='publish_cue' (DRIFT-B fix).
    const publishRes = await request(app)
      .post(`/v1/admin/programming/cues/${cueId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect(publishRes.status).toBe(200)
    expect(publishRes.body.data.cue.status).toBe('scheduled')
    expect(publishRes.body.data.change.change_type).toBe('update_cue')
    const publishTransition = publishRes.body.data.change.patch_json.transition
    expect(publishTransition.kind).toBe('publish_cue')
    expect(publishTransition.from).toBe('draft')
    expect(publishTransition.to).toBe('scheduled')

    // 10. Cancel scheduled cue — change_type='cancel_cue', transition.from='scheduled'.
    const cancelRes = await request(app)
      .post(`/v1/admin/programming/cues/${cueId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'admin_cancel' })
    expect(cancelRes.status).toBe(200)
    expect(cancelRes.body.data.cue.status).toBe('cancelled')
    expect(cancelRes.body.data.change.change_type).toBe('cancel_cue')
    const cancelTransition = cancelRes.body.data.change.patch_json.transition
    expect(cancelTransition.kind).toBe('cancel')
    expect(cancelTransition.from).toBe('scheduled')
    expect(cancelTransition.to).toBe('cancelled')
    expect(cancelRes.body.data.change.reason).toBe('admin_cancel')

    // 11. Audit chain — newest first, six rows, every audit-relevant discriminator
    //     present and consistent. M4 surface validation.
    const auditRes = await request(app)
      .get(`/v1/admin/programming/audit?cue_id=${cueId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(auditRes.status).toBe(200)
    const items = auditRes.body.data.items as Array<{
      change_type: string
      approval_status: string
      source: string
      base_revision: number | null
      patch_json: Record<string, unknown>
    }>
    expect(auditRes.body.data.total).toBe(6)
    expect(items).toHaveLength(6)

    // Newest first. The published transition lives at row[1] (cancel is newest).
    expect(items[0].change_type).toBe('cancel_cue')
    expect(items[1].change_type).toBe('update_cue') // publish
    expect((items[1].patch_json.transition as { kind: string }).kind).toBe('publish_cue')
    expect(items[2].change_type).toBe('attach_media')
    expect(items[3].change_type).toBe('update_cue') // locked_fields add
    expect(items[4].change_type).toBe('update_cue') // priority bump
    expect(items[5].change_type).toBe('create_cue')

    for (const row of items) {
      expect(row.source).toBe('manual')
      expect(row.approval_status).toBe('auto_applied')
    }
  })
})
