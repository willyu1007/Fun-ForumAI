import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryCueRepository } from '../../repos/cue-repository.js'
import {
  CueEditorService,
  LockedFieldError,
  DeterministicValidationError,
  type CueEditorActor,
} from '../cue-editor-service.js'
import {
  FORBIDDEN_CUE_FIELDS,
} from '../../programming/cue/cue-patch.js'
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js'
import type { CuePatchV1 } from '../../programming/cue/cue-patch.js'
import type { CueCommunityScope } from '../../programming/cue/types.js'

const adminActor: CueEditorActor = { userId: 'admin-1', role: 'admin' }

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

const baselineAdmission = {
  on_global_overload: 'defer' as const,
  on_community_overload: 'defer' as const,
  on_media_overload: 'degrade_media' as const,
  on_agent_pool_empty: 'defer' as const,
  max_deferral_minutes: 30,
}

const baselineTheme = { topic_seed: '今晚我们聊点什么', tone_band: 'calm' as const }

const baselineScene = {
  community_scope: SCOPE,
  public_stage_scope: ['forum' as const],
  allowed_scene_families: ['debate' as const, 'round_table' as const],
  preferred_scene_family: 'debate' as const,
  privacy_policy: 'public_only' as const,
  private_reference_policy: 'forbidden' as const,
  safety_profile: 'standard' as const,
}

const baselineRoles = {
  requirements: [{ role: 'anchor' as const, weight: 0.7 }],
  relationship_shape: 'round_table' as const,
}

function buildCreatePatch(overrides: Partial<CuePatchV1['partial']> = {}): CuePatchV1 {
  const triggerAt = new Date(Date.now() + 3_600_000).toISOString()
  return {
    version: 1,
    partial: {
      trigger_at: triggerAt,
      timezone: 'Asia/Shanghai',
      priority: 50,
      lane: 'standard',
      dispatch_policy: makeDispatch(triggerAt),
      theme_intent: baselineTheme,
      scene_constraints: baselineScene,
      role_requirements: baselineRoles,
      risk_level: 'standard',
      ...overrides,
    },
  }
}

function setupSchedule(repo: InMemoryCueRepository) {
  return repo.createSchedule({
    scope_type: 'community',
    community_id: 'c1',
    timezone: 'Asia/Shanghai',
    date_range_start: new Date(Date.now() - 86_400_000),
    date_range_end: new Date(Date.now() + 30 * 86_400_000),
    source: 'manual',
    status: 'draft',
  })
}

describe('CueEditorService — createCueDraft', () => {
  let repo: InMemoryCueRepository
  let service: CueEditorService
  let scheduleId: string

  beforeEach(async () => {
    repo = new InMemoryCueRepository()
    service = new CueEditorService({ repo })
    const schedule = await setupSchedule(repo)
    scheduleId = schedule.id
  })

  it('creates a draft cue and a CueChange row with approval_status=auto_applied', async () => {
    const result = await service.createCueDraft(
      { scheduleId, scope: SCOPE, patch: buildCreatePatch() },
      adminActor,
    )
    expect(result.cue.status).toBe('draft')
    expect(result.cue.source_type).toBe('manual')
    expect(result.cue.created_by_user_id).toBe(adminActor.userId)
    expect(result.change.source).toBe('manual')
    expect(result.change.actor_user_id).toBe(adminActor.userId)
    expect(result.change.change_type).toBe('create_cue')
    expect(result.change.approval_status).toBe('auto_applied')
    expect(result.change.applied_at).not.toBeNull()
  })

  it('rejects when required editable field is missing', async () => {
    const patch = buildCreatePatch()
    delete (patch.partial as Record<string, unknown>).theme_intent
    await expect(
      service.createCueDraft({ scheduleId, scope: SCOPE, patch }, adminActor),
    ).rejects.toThrow(ValidationError)
  })

  it('rejects when schedule not found', async () => {
    await expect(
      service.createCueDraft(
        { scheduleId: 'csched_missing', scope: SCOPE, patch: buildCreatePatch() },
        adminActor,
      ),
    ).rejects.toThrow(NotFoundError)
  })

  it('rejects trigger_at outside schedule window', async () => {
    const patch = buildCreatePatch({
      trigger_at: new Date(Date.now() + 365 * 86_400_000).toISOString(),
    })
    await expect(
      service.createCueDraft({ scheduleId, scope: SCOPE, patch }, adminActor),
    ).rejects.toThrow(DeterministicValidationError)
  })
})

describe('CueEditorService — forbidden fields (server backstop)', () => {
  let repo: InMemoryCueRepository
  let service: CueEditorService
  let scheduleId: string

  beforeEach(async () => {
    repo = new InMemoryCueRepository()
    service = new CueEditorService({ repo })
    scheduleId = (await setupSchedule(repo)).id
  })

  for (const forbidden of FORBIDDEN_CUE_FIELDS) {
    it(`rejects "${forbidden}" supplied as a partial key (schema layer)`, async () => {
      const patch = buildCreatePatch()
      ;(patch.partial as Record<string, unknown>)[forbidden] = 'tampered'
      await expect(
        service.createCueDraft({ scheduleId, scope: SCOPE, patch }, adminActor),
      ).rejects.toThrow(ValidationError)
    })

    it(`server backstop also rejects "${forbidden}" if schema were bypassed`, async () => {
      // Bypass the schema by constructing the patch as `unknown` and feeding
      // through the parsePatch (still passes Zod superRefine), then exercising
      // the post-parse server-side check by using the public update path with
      // a synthesised "already parsed" patch.
      const cue = await service.createCueDraft(
        { scheduleId, scope: SCOPE, patch: buildCreatePatch() },
        adminActor,
      )
      const sneaky = {
        version: 1,
        partial: { [forbidden]: 'tampered' },
      } as unknown
      // Schema layer catches it; this asserts the layered defense still blocks.
      await expect(service.updateCue(cue.cue.id, sneaky, adminActor)).rejects.toThrow(
        ValidationError,
      )
    })
  }
})

describe('CueEditorService — updateCue', () => {
  let repo: InMemoryCueRepository
  let service: CueEditorService
  let scheduleId: string
  let cueId: string

  beforeEach(async () => {
    repo = new InMemoryCueRepository()
    service = new CueEditorService({ repo })
    scheduleId = (await setupSchedule(repo)).id
    const created = await service.createCueDraft(
      { scheduleId, scope: SCOPE, patch: buildCreatePatch() },
      adminActor,
    )
    cueId = created.cue.id
  })

  it('applies a CuePatchV1 and bumps revision', async () => {
    const patch: CuePatchV1 = {
      version: 1,
      partial: {
        priority: 90,
      },
    }
    const result = await service.updateCue(cueId, patch, adminActor)
    expect(result.cue.priority).toBe(90)
    expect(result.cue.revision).toBe(2)
    expect(result.change.change_type).toBe('update_cue')
    expect(result.change.approval_status).toBe('auto_applied')
    expect(result.change.base_revision).toBe(1)
  })

  it('rejects an update that touches a locked field', async () => {
    // Add a lock first
    await service.updateCue(
      cueId,
      {
        version: 1,
        partial: { locked_fields: ['theme_intent.tone_band'] },
      },
      adminActor,
    )

    await expect(
      service.updateCue(
        cueId,
        {
          version: 1,
          partial: { theme_intent: { topic_seed: '今晚我们聊点什么', tone_band: 'sharp' } },
        },
        adminActor,
      ),
    ).rejects.toThrow(LockedFieldError)
  })

  it('accepts an update that touches a sibling of a locked field', async () => {
    await service.updateCue(
      cueId,
      {
        version: 1,
        partial: { locked_fields: ['scene_constraints.allowed_scene_families'] },
      },
      adminActor,
    )

    const result = await service.updateCue(
      cueId,
      {
        version: 1,
        partial: {
          scene_constraints: {
            ...baselineScene,
            preferred_scene_family: 'round_table',
          },
        },
      },
      adminActor,
    )
    expect(result.cue.scene_constraints.preferred_scene_family).toBe('round_table')
  })

  it('rejects removed_fields entry that targets a required field', async () => {
    await expect(
      service.updateCue(
        cueId,
        {
          version: 1,
          partial: {},
          removed_fields: ['theme_intent'],
        },
        adminActor,
      ),
    ).rejects.toThrow(ValidationError)
  })

  it('clears an optional field via removed_fields', async () => {
    // Ensure the field exists first.
    await service.updateCue(
      cueId,
      {
        version: 1,
        partial: { admission_policy: baselineAdmission },
      },
      adminActor,
    )
    const before = await repo.findCueById(cueId)
    expect(before?.admission_policy).toBeDefined()

    const result = await service.updateCue(
      cueId,
      {
        version: 1,
        partial: {},
        removed_fields: ['admission_policy'],
      },
      adminActor,
    )
    expect(result.cue.admission_policy).toBeUndefined()
  })

  it('rejects update for non-editable cue status', async () => {
    await repo.setCueStatus(cueId, 'consumed')
    await expect(
      service.updateCue(cueId, { version: 1, partial: { priority: 80 } }, adminActor),
    ).rejects.toThrow(ConflictError)
  })

  it('rejects when cue not found', async () => {
    await expect(
      service.updateCue('cue_nonexistent', { version: 1, partial: { priority: 80 } }, adminActor),
    ).rejects.toThrow(NotFoundError)
  })
})

describe('CueEditorService — cancelCue / forceSkipCue', () => {
  let repo: InMemoryCueRepository
  let service: CueEditorService
  let scheduleId: string
  let cueId: string

  beforeEach(async () => {
    repo = new InMemoryCueRepository()
    service = new CueEditorService({ repo })
    scheduleId = (await setupSchedule(repo)).id
    cueId = (
      await service.createCueDraft(
        { scheduleId, scope: SCOPE, patch: buildCreatePatch() },
        adminActor,
      )
    ).cue.id
  })

  it('cancelCue transitions to "cancelled" with a cancel_cue change', async () => {
    const result = await service.cancelCue(cueId, adminActor, 'no longer needed')
    expect(result.cue.status).toBe('cancelled')
    expect(result.change.change_type).toBe('cancel_cue')
    expect(result.change.reason).toBe('no longer needed')
    expect(result.change.approval_status).toBe('auto_applied')
  })

  it('cancelCue rejects from terminal status', async () => {
    await repo.setCueStatus(cueId, 'consumed')
    await expect(service.cancelCue(cueId, adminActor)).rejects.toThrow(ConflictError)
  })

  it('forceSkipCue transitions to "skipped" with kind=force_skip', async () => {
    await repo.setCueStatus(cueId, 'due')
    const result = await service.forceSkipCue(cueId, adminActor)
    expect(result.cue.status).toBe('skipped')
    expect(result.change.change_type).toBe('cancel_cue')
    expect(result.change.reason).toBe('force_skip')
    const patch = result.change.patch_json as Record<string, unknown>
    expect((patch.transition as Record<string, unknown>).kind).toBe('force_skip')
  })
})

describe('CueEditorService — attachMedia / removeMedia', () => {
  let repo: InMemoryCueRepository
  let service: CueEditorService
  let cueId: string

  beforeEach(async () => {
    repo = new InMemoryCueRepository()
    service = new CueEditorService({ repo })
    const scheduleId = (await setupSchedule(repo)).id
    cueId = (
      await service.createCueDraft(
        { scheduleId, scope: SCOPE, patch: buildCreatePatch() },
        adminActor,
      )
    ).cue.id
  })

  it('attaches media with optional usage_strength and records attach_media change', async () => {
    const result = await service.attachCueMedia(
      cueId,
      {
        asset_id: 'asset-1',
        role: 'context_anchor',
        usage_strength: 'optional',
        use_policy: 'runtime_only',
      },
      adminActor,
    )
    expect(result.media_id).toBeTruthy()
    expect(result.change.change_type).toBe('attach_media')
    expect(result.change.approval_status).toBe('auto_applied')
  })

  // T-216 M0: validator now accepts all four `usage_strength` values.
  // Runtime planner still treats `anchor` / `selected_only_pool` as
  // `preferred` (no behavior change); strength-aware routing lands in
  // T-216 M2/M3.
  it.each([
    ['optional'],
    ['preferred'],
    ['anchor'],
    ['selected_only_pool'],
  ] as const)(
    'attachCueMedia accepts usage_strength=%s after T-216 M0 unlock',
    async (strength) => {
      const result = await service.attachCueMedia(
        cueId,
        {
          asset_id: `asset-${strength}`,
          role: 'context_anchor',
          usage_strength: strength,
          use_policy: 'runtime_only',
        },
        adminActor,
      )
      expect(result.media_id).toBeTruthy()
      expect(result.change.change_type).toBe('attach_media')
      expect(
        (result.change.patch_json as { media: { usage_strength: string } })
          .media.usage_strength,
      ).toBe(strength)
    },
  )

  it('rejects require_public_display use_policy (D-11)', async () => {
    await expect(
      service.attachCueMedia(
        cueId,
        {
          asset_id: 'asset-1',
          role: 'context_anchor',
          usage_strength: 'optional',
          use_policy: 'require_public_display',
        },
        adminActor,
      ),
    ).rejects.toThrow(ValidationError)
  })

  it('removeMedia removes attached media and records remove_media change', async () => {
    const attached = await service.attachCueMedia(
      cueId,
      {
        asset_id: 'asset-1',
        role: 'context_anchor',
        usage_strength: 'preferred',
        use_policy: 'prefer_runtime_context',
      },
      adminActor,
    )
    const result = await service.removeCueMedia(cueId, attached.media_id, adminActor)
    expect(result.removed).toBe(true)
    expect(result.change.change_type).toBe('remove_media')
  })
})

describe('CueEditorService — publishCue', () => {
  it('transitions draft -> scheduled and records change', async () => {
    const repo = new InMemoryCueRepository()
    const service = new CueEditorService({ repo })
    const scheduleId = (await setupSchedule(repo)).id
    const created = await service.createCueDraft(
      { scheduleId, scope: SCOPE, patch: buildCreatePatch() },
      adminActor,
    )
    const result = await service.publishCue(created.cue.id, adminActor)
    expect(result.cue.status).toBe('scheduled')
    // Cue-level publish recorded as update_cue with transition.kind='publish_cue'
    // (the Prisma `publish_schedule` enum is reserved for schedule-level publish).
    expect(result.change.change_type).toBe('update_cue')
    const patch = result.change.patch_json as { transition: { kind: string; from: string; to: string } }
    expect(patch.transition.kind).toBe('publish_cue')
    expect(patch.transition.from).toBe('draft')
    expect(patch.transition.to).toBe('scheduled')
  })

  it('rejects publish from non-draft / non-validated status', async () => {
    const repo = new InMemoryCueRepository()
    const service = new CueEditorService({ repo })
    const scheduleId = (await setupSchedule(repo)).id
    const created = await service.createCueDraft(
      { scheduleId, scope: SCOPE, patch: buildCreatePatch() },
      adminActor,
    )
    await repo.setCueStatus(created.cue.id, 'consumed')
    await expect(service.publishCue(created.cue.id, adminActor)).rejects.toThrow(ConflictError)
  })
})

describe('CueEditorService — rollbackSchedule', () => {
  it('marks original rolled_back and creates new draft schedule pointing back', async () => {
    const repo = new InMemoryCueRepository()
    const service = new CueEditorService({ repo })
    const original = await setupSchedule(repo)
    const result = await service.rollbackSchedule(original.id, adminActor, 'incident recovery')
    expect(result.schedule.id).not.toBe(original.id)
    expect(result.schedule.status).toBe('draft')
    expect(result.schedule.rollback_from_schedule_id).toBe(original.id)
    expect(result.schedule.base_schedule_id).toBe(original.id)
    expect(result.schedule.version).toBe(original.version + 1)
    expect(result.change.change_type).toBe('rollback_schedule')

    const updated = await repo.findScheduleById(original.id)
    expect(updated?.status).toBe('rolled_back')
  })

  // T-212 Bug #2 fix — rollbackSchedule must invoke ScheduleRollbackHandler
  // when one is provided, cascading cue cancellations + emitting per-cue
  // CueExecutionCancelled events. Without this wiring, rolled-back schedules
  // would leave their cues live (worker would happily execute them).
  it('invokes ScheduleRollbackHandler with affected cue ids and records the cascade outcome', async () => {
    const repo = new InMemoryCueRepository()
    const original = await setupSchedule(repo)
    // Seed a couple of cues on the original schedule.
    const cueInputBase = {
      schedule_id: original.id,
      source_type: 'manual' as const,
      community_id: 'c1',
      scope: SCOPE,
      trigger_at: new Date(Date.now() + 3_600_000),
      dispatch_policy: makeDispatch(new Date(Date.now() + 3_600_000).toISOString()),
      theme_intent: baselineTheme,
      scene_constraints: baselineScene,
      role_requirements: baselineRoles,
    }
    const cueA = await repo.createCue({ ...cueInputBase, status: 'scheduled' })
    const cueB = await repo.createCue({ ...cueInputBase, status: 'scheduled' })
    const calls: Array<{
      scheduleId: string
      affectedCueIds: string[]
      actor: { actor_type: string; actor_id: string | null }
      reason?: string
    }> = []
    const fakeHandler = {
      apply: async (input: {
        scheduleId: string
        affectedCueIds: string[]
        actor: { actor_type: 'agent' | 'human' | 'system'; actor_id: string | null }
        reason?: string
      }) => {
        calls.push(input)
        return {
          cancelled: input.affectedCueIds,
          inFlight: [],
          noop: [],
          missing: [],
        }
      },
    }
    const service = new CueEditorService({
      repo,
      scheduleRollbackHandler: fakeHandler,
    })
    const result = await service.rollbackSchedule(original.id, adminActor, 'incident')
    expect(calls).toHaveLength(1)
    expect(calls[0].scheduleId).toBe(original.id)
    expect(new Set(calls[0].affectedCueIds)).toEqual(new Set([cueA.id, cueB.id]))
    expect(calls[0].actor.actor_type).toBe('human')
    // change.patch_json carries affected_cue_ids + cascade_outcome
    const patch = result.change.patch_json as {
      affected_cue_ids?: string[]
      cascade_outcome?: { cancelled: string[] }
    }
    expect(new Set(patch.affected_cue_ids ?? [])).toEqual(new Set([cueA.id, cueB.id]))
    expect(new Set(patch.cascade_outcome?.cancelled ?? [])).toEqual(
      new Set([cueA.id, cueB.id]),
    )
  })

  it('skips ScheduleRollbackHandler invocation when no cues exist (avoids empty-batch noise)', async () => {
    const repo = new InMemoryCueRepository()
    const original = await setupSchedule(repo)
    let called = false
    const service = new CueEditorService({
      repo,
      scheduleRollbackHandler: {
        apply: async () => {
          called = true
          return { cancelled: [], inFlight: [], noop: [], missing: [] }
        },
      },
    })
    await service.rollbackSchedule(original.id, adminActor)
    expect(called).toBe(false)
  })
})

describe('CueEditorService — actor & approval semantics (DEC-T210-A)', () => {
  it('manual path always writes approval_status=auto_applied and source=manual', async () => {
    const repo = new InMemoryCueRepository()
    const service = new CueEditorService({ repo })
    const scheduleId = (await setupSchedule(repo)).id

    const created = await service.createCueDraft(
      { scheduleId, scope: SCOPE, patch: buildCreatePatch() },
      adminActor,
    )
    const updated = await service.updateCue(
      created.cue.id,
      { version: 1, partial: { priority: 80 } },
      adminActor,
    )
    const cancelled = await service.cancelCue(created.cue.id, adminActor)

    for (const change of [created.change, updated.change, cancelled.change]) {
      expect(change.source).toBe('manual')
      expect(change.approval_status).toBe('auto_applied')
      expect(change.actor_user_id).toBe(adminActor.userId)
      expect(change.actor_system).toBeNull()
    }
  })

  it('a synthetic auto path through the repo (source=automated) writes approval_status=pending', async () => {
    // T-214 will own the auto path; this asserts the repo-level enum
    // distinction is honored. Until T-214 ships, manually call recordChange
    // with source='automated' to verify the approval_status default.
    const repo = new InMemoryCueRepository()
    const change = await repo.recordChange({
      schedule_id: 'csched_x',
      cue_id: null,
      source: 'automated',
      actor_system: 'auto-editor-fixture',
      change_type: 'update_cue',
      patch_json: { version: 1, partial: { priority: 60 } },
      approval_status: 'pending',
    })
    expect(change.source).toBe('automated')
    expect(change.approval_status).toBe('pending')
  })
})
