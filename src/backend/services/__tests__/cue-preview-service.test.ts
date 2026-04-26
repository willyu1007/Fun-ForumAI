import { describe, it, expect } from 'vitest'
import { CuePreviewService } from '../cue-preview-service.js'
import { CueEditorService } from '../cue-editor-service.js'
import { InMemoryCueRepository } from '../../repos/cue-repository.js'
import { InMemoryMediaAssetRepository } from '../../repos/media-asset-repository.js'
import { loadSignalServiceStub } from '../__stubs__/load-signal-service-stub.js'
import { directorCueBriefStub } from '../__stubs__/director-cue-brief-stub.js'
import type { CuePatchV1 } from '../../programming/cue/cue-patch.js'
import type { CueCommunityScope } from '../../programming/cue/types.js'

const SCOPE: CueCommunityScope = { mode: 'single', community_id: 'c1' }

function makeDispatch(triggerAt: string) {
  return {
    trigger_at: triggerAt,
    timezone: 'Asia/Shanghai',
    dispatch_mode: 'graceful' as const,
    grace_seconds: 30,
    priority: 50,
    lane: 'standard' as const,
    misfire_policy: 'delay' as const,
    max_attempts: 1,
    retry_backoff_seconds: 60,
  }
}

const baseTheme = { topic_seed: 'topic', tone_band: 'calm' as const }
const baseScene = {
  community_scope: SCOPE,
  public_stage_scope: ['forum' as const],
  privacy_policy: 'public_only' as const,
  private_reference_policy: 'forbidden' as const,
  safety_profile: 'standard' as const,
}
const baseRoles = { requirements: [{ role: 'anchor' as const, weight: 0.7 }] }

function buildCreatePatch(): CuePatchV1 {
  const triggerAt = new Date(Date.now() + 3_600_000).toISOString()
  return {
    version: 1,
    partial: {
      trigger_at: triggerAt,
      timezone: 'Asia/Shanghai',
      priority: 50,
      lane: 'standard',
      dispatch_policy: makeDispatch(triggerAt),
      theme_intent: baseTheme,
      scene_constraints: baseScene,
      role_requirements: baseRoles,
      risk_level: 'standard',
    },
  }
}

async function setup() {
  const repo = new InMemoryCueRepository()
  const mediaAssetRepo = new InMemoryMediaAssetRepository()
  const editor = new CueEditorService({ repo })
  const schedule = await repo.createSchedule({
    scope_type: 'community',
    community_id: 'c1',
    date_range_start: new Date(Date.now() - 86_400_000),
    date_range_end: new Date(Date.now() + 30 * 86_400_000),
    source: 'manual',
    status: 'draft',
  })
  const created = await editor.createCueDraft(
    { scheduleId: schedule.id, scope: SCOPE, patch: buildCreatePatch() },
    { userId: 'admin-1', role: 'admin' },
  )
  const preview = new CuePreviewService({
    repo,
    mediaAssetRepo,
    loadSignalService: loadSignalServiceStub,
    directorCueBrief: directorCueBriefStub,
  })
  return { repo, mediaAssetRepo, preview, cueId: created.cue.id }
}

describe('CuePreviewService — happy path', () => {
  it('runs all 5 stages and returns overall=ok with stub markers', async () => {
    const { preview, cueId } = await setup()
    const result = await preview.preview({
      cueId,
      rawPatch: { version: 1, partial: { priority: 80 } },
    })
    expect(result.cue_id).toBe(cueId)
    expect(result.stages.map((s) => s.stage)).toEqual([
      'schema',
      'deterministic',
      'load',
      'media',
      'director_compile',
    ])
    expect(result.stages.find((s) => s.stage === 'load')?.source).toBe('stub_until_t213')
    expect(result.stages.find((s) => s.stage === 'director_compile')?.source).toBe(
      'stub_until_t212',
    )
    expect(result.overall).toBe('ok')
  })
})

describe('CuePreviewService — short-circuits on schema error', () => {
  it('returns has_errors after stage 1 when patch fails Zod', async () => {
    const { preview, cueId } = await setup()
    const result = await preview.preview({
      cueId,
      rawPatch: { version: 1, partial: { agent_dialogue: 'forbidden' } },
    })
    expect(result.overall).toBe('has_errors')
    expect(result.stages).toHaveLength(1)
    expect(result.stages[0].stage).toBe('schema')
    expect(result.stages[0].status).toBe('error')
  })
})

describe('CuePreviewService — short-circuits on deterministic error', () => {
  it('reports forbidden field caught at server backstop', async () => {
    const { preview, cueId } = await setup()
    // CuePatchV1 with valid shape but server-backstop verifies forbidden again.
    // Schema layer would already catch this; we use a patch that passes schema
    // but trips locked-fields to test the deterministic stage.
    const repo = (preview as unknown as { repo: InMemoryCueRepository }).repo
    const cue = await repo.findCueById(cueId)
    expect(cue).toBeTruthy()
    // Add a lock on theme_intent.tone_band, then preview a patch that touches it.
    await repo.updateCue(cueId, { locked_fields: ['theme_intent.tone_band'] })

    const result = await preview.preview({
      cueId,
      rawPatch: {
        version: 1,
        partial: { theme_intent: { topic_seed: 'topic', tone_band: 'sharp' } },
      },
    })
    expect(result.overall).toBe('has_errors')
    expect(result.stages[result.stages.length - 1].stage).toBe('deterministic')
    expect(result.stages[result.stages.length - 1].status).toBe('error')
  })

  it('errors when trigger_at is in the past', async () => {
    const { preview, cueId } = await setup()
    const result = await preview.preview({
      cueId,
      rawPatch: {
        version: 1,
        partial: { trigger_at: new Date(Date.now() - 3_600_000).toISOString() },
      },
    })
    expect(result.overall).toBe('has_errors')
  })
})

describe('CuePreviewService — media stage warnings', () => {
  it('warns when an attached asset is no longer pickable', async () => {
    const { preview, cueId, repo, mediaAssetRepo } = await setup()

    // Attach media via repo (bypassing service to skip its strength rejection).
    const goodAsset = await mediaAssetRepo.create({
      source_kind: 'owner_console_upload',
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
      storage_key: 'storage/k.png',
      mime_type: 'image/png',
      file_size_bytes: 1024,
      sha256: 'a'.repeat(64),
    })
    const badAsset = await mediaAssetRepo.create({
      source_kind: 'owner_console_upload',
      visibility_policy: 'private_only',
      lifecycle_status: 'active',
      storage_key: 'storage/k2.png',
      mime_type: 'image/png',
      file_size_bytes: 1024,
      sha256: 'b'.repeat(64),
    })
    await repo.attachMedia({
      cue_id: cueId,
      asset_id: goodAsset.id,
      role: 'context_anchor',
      created_by_type: 'admin',
    })
    await repo.attachMedia({
      cue_id: cueId,
      asset_id: badAsset.id,
      role: 'mood_reference',
      created_by_type: 'admin',
    })

    const result = await preview.preview({
      cueId,
      rawPatch: { version: 1, partial: { priority: 60 } },
    })
    const mediaStage = result.stages.find((s) => s.stage === 'media')
    expect(mediaStage).toBeDefined()
    expect(mediaStage!.status).toBe('warning')
    const payload = mediaStage!.payload as { rejected: { asset_id: string }[] }
    expect(payload.rejected.map((r) => r.asset_id)).toContain(badAsset.id)
    expect(result.overall).toBe('has_warnings')
  })
})
