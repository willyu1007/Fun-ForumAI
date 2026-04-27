import { describe, expect, it, beforeEach } from 'vitest'
import { AutoPatchApplyService } from '../auto-patch-apply-service.js'
import { CueEditorService, type CueEditorActor } from '../cue-editor-service.js'
import { InMemoryCueRepository } from '../../repos/cue-repository.js'

const ACTOR: CueEditorActor = { userId: 'admin-1', role: 'admin' }

async function seedScheduleAndCue(repo: InMemoryCueRepository) {
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
    idempotency_key: 'idem-1',
  })
  return { schedule, cue }
}

async function seedAutoPatch(
  repo: InMemoryCueRepository,
  overrides: Partial<Parameters<InMemoryCueRepository['recordChange']>[0]> = {},
) {
  return repo.recordChange({
    schedule_id: 'sched-1',
    cue_id: null,
    source: 'automated',
    actor_system: 'auto-cue-editor',
    trigger_id: 'trigger-1',
    trigger_type: 'COMMUNITY_LULL',
    change_type: 'update_cue',
    patch_json: { version: 1, partial: { priority: 80 } },
    risk_level: 'standard',
    approval_status: 'pending',
    reason: 'community lull detected',
    ...overrides,
  })
}

function makeService(repo: InMemoryCueRepository): AutoPatchApplyService {
  const editor = new CueEditorService({ repo })
  return new AutoPatchApplyService({
    cueRepo: repo,
    cueEditorService: editor,
  })
}

describe('AutoPatchApplyService.apply — update_cue', () => {
  let repo: InMemoryCueRepository

  beforeEach(() => {
    repo = new InMemoryCueRepository()
  })

  it('applies update_cue patches and flips the original row to auto_applied', async () => {
    const { cue } = await seedScheduleAndCue(repo)
    const change = await seedAutoPatch(repo, {
      cue_id: cue.id,
      patch_json: { version: 1, partial: { priority: 90 } },
    })

    const applyService = makeService(repo)
    const outcome = await applyService.apply({ change, actor: ACTOR })

    expect(outcome.kind).toBe('applied')
    if (outcome.kind === 'applied') {
      expect(outcome.cue?.priority).toBe(90)
      expect(outcome.change.id).toBe(change.id) // single-row audit: same row
      expect(outcome.change.approval_status).toBe('auto_applied')
      expect(outcome.change.applied_at).toBeTruthy()
      expect(outcome.change.actor_user_id).toBe('admin-1')
      // Original reason preserved (auto-editor's "community lull detected").
      expect(outcome.change.reason).toBe('community lull detected')
    }

    // Cue state in repo reflects the patch.
    const fresh = await repo.findCueById(cue.id)
    expect(fresh?.priority).toBe(90)
  })

  it('single-row audit: produces exactly 1 CueChange row per applied patch', async () => {
    const { cue } = await seedScheduleAndCue(repo)
    const change = await seedAutoPatch(repo, {
      cue_id: cue.id,
      patch_json: { version: 1, partial: { priority: 75 } },
    })

    const applyService = makeService(repo)
    const outcome = await applyService.apply({ change, actor: ACTOR })

    expect(outcome.kind).toBe('applied')
    const allChangesForCue = await repo.listChangesForCue(cue.id)
    // Single-row audit: original automated row only — no duplicate
    // manual row.
    expect(allChangesForCue).toHaveLength(1)
    expect(allChangesForCue[0]?.id).toBe(change.id)
    expect(allChangesForCue[0]?.source).toBe('automated')
    expect(allChangesForCue[0]?.approval_status).toBe('auto_applied')
    expect(allChangesForCue[0]?.actor_user_id).toBe('admin-1')
  })

  it('fails when the patch violates a locked field', async () => {
    const { cue } = await seedScheduleAndCue(repo)
    // Lock the priority field.
    await repo.updateCue(cue.id, { locked_fields: ['priority'] })
    const change = await seedAutoPatch(repo, {
      cue_id: cue.id,
      patch_json: { version: 1, partial: { priority: 99 } },
    })

    const applyService = makeService(repo)
    const outcome = await applyService.apply({ change, actor: ACTOR })

    expect(outcome.kind).toBe('failed')
    if (outcome.kind === 'failed') {
      expect(outcome.error).toContain('locked')
    }
    // Original row stays at 'pending' (route can decide what to do — our
    // service only flips on success).
    const fresh = await repo.findChangeById(change.id)
    expect(fresh?.approval_status).toBe('pending')
  })

  it('fails when the target cue does not exist', async () => {
    const change = await seedAutoPatch(repo, {
      cue_id: 'cue-missing',
      patch_json: { version: 1, partial: { priority: 50 } },
    })
    const applyService = makeService(repo)
    const outcome = await applyService.apply({ change, actor: ACTOR })
    expect(outcome.kind).toBe('failed')
  })

  it('rejects update_cue with no cue_id', async () => {
    const change = await seedAutoPatch(repo, {
      cue_id: null,
      patch_json: { version: 1, partial: { priority: 50 } },
    })
    const applyService = makeService(repo)
    const outcome = await applyService.apply({ change, actor: ACTOR })
    expect(outcome.kind).toBe('failed')
    if (outcome.kind === 'failed') {
      expect(outcome.error).toContain('cue_id')
    }
  })
})

describe('AutoPatchApplyService.apply — cancel_cue', () => {
  let repo: InMemoryCueRepository
  beforeEach(() => {
    repo = new InMemoryCueRepository()
  })

  it('applies cancel_cue and marks original auto_applied', async () => {
    const { cue } = await seedScheduleAndCue(repo)
    const change = await seedAutoPatch(repo, {
      change_type: 'cancel_cue',
      cue_id: cue.id,
      reason: 'lull persisted; defer',
    })
    const applyService = makeService(repo)
    const outcome = await applyService.apply({ change, actor: ACTOR })
    expect(outcome.kind).toBe('applied')
    if (outcome.kind === 'applied') {
      expect(outcome.cue?.status).toBe('cancelled')
      expect(outcome.change.approval_status).toBe('auto_applied')
    }
  })
})

describe('AutoPatchApplyService.apply — create_cue', () => {
  let repo: InMemoryCueRepository
  beforeEach(() => { repo = new InMemoryCueRepository() })

  it('creates a cue against the active community schedule and flips the row', async () => {
    const schedule = await repo.createSchedule({
      scope_type: 'community',
      community_id: 'c1',
      date_range_start: new Date(Date.now() - 86_400_000),
      date_range_end: new Date(Date.now() + 30 * 86_400_000),
      source: 'manual',
      status: 'active',
    })
    const triggerAt = new Date(Date.now() + 3_600_000).toISOString()
    const change = await seedAutoPatch(repo, {
      change_type: 'create_cue',
      cue_id: null,
      patch_json: {
        version: 1,
        partial: {
          trigger_at: triggerAt,
          timezone: 'UTC',
          priority: 50,
          lane: 'standard',
          dispatch_policy: {
            trigger_at: triggerAt,
            timezone: 'UTC',
            dispatch_mode: 'graceful',
            grace_seconds: 30,
            priority: 50,
            lane: 'standard',
            misfire_policy: 'delay',
            max_attempts: 1,
            retry_backoff_seconds: 60,
          },
          theme_intent: { topic_seed: 'auto-topic', tone_band: 'calm' },
          scene_constraints: {
            community_scope: { mode: 'single', community_id: 'c1' },
            public_stage_scope: ['forum'],
            privacy_policy: 'public_only',
            private_reference_policy: 'forbidden',
            safety_profile: 'standard',
          },
          role_requirements: { requirements: [{ role: 'anchor', weight: 0.7 }] },
        },
      },
      load_snapshot_json: {
        load_state: 'green',
        load_signal_source: 'load_signal_service:cached',
        propose_only: false,
        community_id: 'c1',
      },
    })
    const applyService = makeService(repo)
    const outcome = await applyService.apply({ change, actor: ACTOR })
    if (outcome.kind !== 'applied') {
      // Surface the underlying error in the assertion message.
      throw new Error(`expected 'applied', got '${outcome.kind}': ${'error' in outcome ? outcome.error : 'reason' in outcome ? outcome.reason : 'unknown'}`)
    }
    // Cue's scope.community_id always reflects the bundle.scope passed
    // in by the apply service; cue.community_id (top-level) is set
    // only if `partial.community_id` was in the patch.
    expect(outcome.cue?.scope?.community_id).toBe('c1')
    expect(outcome.cue?.schedule_id).toBe(schedule.id)
    expect(outcome.change.id).toBe(change.id)
    expect(outcome.change.approval_status).toBe('auto_applied')
    // Single-row audit
    const all = await repo.listChangesForCue(outcome.cue!.id)
    expect(all).toHaveLength(1)
  })

  it('fails when load_snapshot_json is missing community_id', async () => {
    const change = await seedAutoPatch(repo, {
      change_type: 'create_cue',
      load_snapshot_json: { load_state: 'green' },
    })
    const applyService = makeService(repo)
    const outcome = await applyService.apply({ change, actor: ACTOR })
    expect(outcome.kind).toBe('failed')
    if (outcome.kind === 'failed') {
      expect(outcome.error).toContain('community_id')
    }
  })

  it('fails when no active schedule exists for the community', async () => {
    const change = await seedAutoPatch(repo, {
      change_type: 'create_cue',
      load_snapshot_json: {
        load_state: 'green',
        community_id: 'c-no-schedule',
      },
    })
    const applyService = makeService(repo)
    const outcome = await applyService.apply({ change, actor: ACTOR })
    expect(outcome.kind).toBe('failed')
    if (outcome.kind === 'failed') {
      expect(outcome.error).toContain('no active schedule')
    }
  })
})

describe('AutoPatchApplyService.apply — defer_cue', () => {
  let repo: InMemoryCueRepository
  beforeEach(() => { repo = new InMemoryCueRepository() })

  it('routes defer_cue through cancelCue with reason="auto_defer" (single-row audit)', async () => {
    const { cue } = await seedScheduleAndCue(repo)
    const change = await seedAutoPatch(repo, {
      change_type: 'defer_cue',
      cue_id: cue.id,
    })
    const applyService = makeService(repo)
    const outcome = await applyService.apply({ change, actor: ACTOR })
    expect(outcome.kind).toBe('applied')
    if (outcome.kind === 'applied') {
      expect(outcome.cue?.status).toBe('cancelled')
      expect(outcome.change.id).toBe(change.id)
    }
    const all = await repo.listChangesForCue(cue.id)
    expect(all).toHaveLength(1)
  })
})

describe('AutoPatchApplyService.apply — media types', () => {
  let repo: InMemoryCueRepository
  beforeEach(() => { repo = new InMemoryCueRepository() })

  it('attach_media: attaches asset and flips original row', async () => {
    const { cue } = await seedScheduleAndCue(repo)
    const change = await seedAutoPatch(repo, {
      change_type: 'attach_media',
      cue_id: cue.id,
      patch_json: {
        version: 1,
        partial: {},
        media: {
          op: 'attach',
          asset_id: 'asset-test-1',
          role: 'context_anchor',
          usage_strength: 'optional',
          use_policy: 'runtime_only',
        },
      },
    })
    const applyService = makeService(repo)
    const outcome = await applyService.apply({ change, actor: ACTOR })
    expect(outcome.kind).toBe('applied')
    if (outcome.kind === 'applied') {
      expect(outcome.change.id).toBe(change.id)
      expect(outcome.change.approval_status).toBe('auto_applied')
    }
    const media = await repo.listMediaForCue(cue.id)
    expect(media).toHaveLength(1)
    expect(media[0]?.asset_id).toBe('asset-test-1')
    // Single-row audit
    const all = await repo.listChangesForCue(cue.id)
    expect(all).toHaveLength(1)
  })

  it('remove_media: removes asset and flips original row', async () => {
    const { cue } = await seedScheduleAndCue(repo)
    const attached = await repo.attachMedia({
      cue_id: cue.id,
      asset_id: 'asset-rm',
      role: 'context_anchor',
      usage_strength: 'optional',
      use_policy: 'runtime_only',
      sort_order: 0,
      created_by_type: 'admin',
      created_by_id: 'admin-1',
    })
    const change = await seedAutoPatch(repo, {
      change_type: 'remove_media',
      cue_id: cue.id,
      patch_json: {
        version: 1,
        partial: {},
        media: { op: 'remove', media_id: attached.id },
      },
    })
    const applyService = makeService(repo)
    const outcome = await applyService.apply({ change, actor: ACTOR })
    expect(outcome.kind).toBe('applied')
    const media = await repo.listMediaForCue(cue.id)
    expect(media).toHaveLength(0)
  })

  it('attach_media: rejects when patch_json missing media block', async () => {
    const { cue } = await seedScheduleAndCue(repo)
    const change = await seedAutoPatch(repo, {
      change_type: 'attach_media',
      cue_id: cue.id,
      patch_json: { version: 1, partial: {} }, // no media block
    })
    const applyService = makeService(repo)
    const outcome = await applyService.apply({ change, actor: ACTOR })
    expect(outcome.kind).toBe('failed')
    if (outcome.kind === 'failed') {
      expect(outcome.error).toContain('media block')
    }
  })
})

describe('AutoPatchApplyService.apply — unsupported types', () => {
  let repo: InMemoryCueRepository
  beforeEach(() => {
    repo = new InMemoryCueRepository()
  })

  for (const change_type of [
    'update_dispatch_policy',
    'merge_into_existing_cue',
    'split_cue',
    'update_risk_level',
    'publish_schedule',
    'rollback_schedule',
  ] as const) {
    it(`reports 'unsupported' for change_type=${change_type}`, async () => {
      const change = await seedAutoPatch(repo, { change_type })
      const applyService = makeService(repo)
      const outcome = await applyService.apply({ change, actor: ACTOR })
      expect(outcome.kind).toBe('unsupported')
      if (outcome.kind === 'unsupported') {
        expect(outcome.reason).toContain(change_type)
      }
    })
  }
})

describe('AutoPatchApplyService.apply — guard rails', () => {
  let repo: InMemoryCueRepository
  beforeEach(() => {
    repo = new InMemoryCueRepository()
  })

  it('refuses to apply manual-source changes (defense in depth)', async () => {
    const { cue } = await seedScheduleAndCue(repo)
    const change = await repo.recordChange({
      schedule_id: cue.schedule_id,
      cue_id: cue.id,
      source: 'manual',
      change_type: 'update_cue',
      patch_json: { version: 1, partial: { priority: 80 } },
      approval_status: 'pending',
    })
    const applyService = makeService(repo)
    const outcome = await applyService.apply({ change, actor: ACTOR })
    expect(outcome.kind).toBe('unsupported')
    if (outcome.kind === 'unsupported') {
      expect(outcome.reason).toContain('automated')
    }
  })
})
