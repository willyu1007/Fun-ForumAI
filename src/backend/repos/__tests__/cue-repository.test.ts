import { describe, it, expect, beforeEach } from 'vitest'
import {
  InMemoryCueRepository,
  attemptIdempotencyKey,
  defaultCueIdempotencyKey,
  type AttachCueMediaInput,
  type CreateCueInput,
  type CreateCueScheduleInput,
  type RecordCueChangeInput,
} from '../cue-repository.js'
import { parseIdempotencyKey } from '../../programming/contract/index.js'
import type {
  CueCommunityScope,
  CueRoleRequirementVector,
  CueSceneConstraints,
  CueThemeIntent,
} from '../../programming/cue/types.js'
import type { DispatchPolicy } from '../../programming/contract/index.js'

function makeDispatchPolicy(): DispatchPolicy {
  return {
    trigger_at: '2026-04-25T20:30:00+08:00',
    timezone: 'Asia/Shanghai',
    dispatch_mode: 'graceful',
    grace_seconds: 60,
    priority: 60,
    lane: 'standard',
    misfire_policy: 'delay',
    max_attempts: 3,
    retry_backoff_seconds: 30,
  }
}

function makeThemeIntent(): CueThemeIntent {
  return {
    topic_seed: 'AI 陪伴边界',
    discussion_question: '何时是越界？',
    tone_band: 'tense_but_playful',
  }
}

function makeSceneConstraints(communityId = 'c1'): CueSceneConstraints {
  return {
    community_scope: { mode: 'single', community_id: communityId },
    public_stage_scope: ['forum'],
    privacy_policy: 'public_only',
    private_reference_policy: 'forbidden',
    safety_profile: 'standard',
  }
}

function makeRoleRequirements(): CueRoleRequirementVector {
  return {
    requirements: [
      { role: 'anchor', weight: 0.7 },
      { role: 'challenger', weight: 0.8 },
    ],
    relationship_shape: 'contrast',
  }
}

function makeScope(communityId = 'c1'): CueCommunityScope {
  return { mode: 'single', community_id: communityId }
}

function makeScheduleInput(
  overrides: Partial<CreateCueScheduleInput> = {},
): CreateCueScheduleInput {
  return {
    scope_type: 'global',
    date_range_start: new Date('2026-04-25T00:00:00+08:00'),
    date_range_end: new Date('2026-04-26T00:00:00+08:00'),
    source: 'manual',
    ...overrides,
  }
}

function makeCueInput(
  scheduleId: string,
  overrides: Partial<CreateCueInput> = {},
): CreateCueInput {
  return {
    schedule_id: scheduleId,
    source_type: 'manual',
    community_id: 'c1',
    scope: makeScope(),
    trigger_at: new Date('2026-04-25T20:30:00+08:00'),
    dispatch_policy: makeDispatchPolicy(),
    theme_intent: makeThemeIntent(),
    scene_constraints: makeSceneConstraints(),
    role_requirements: makeRoleRequirements(),
    ...overrides,
  }
}

function makeMediaInput(cueId: string): AttachCueMediaInput {
  return {
    cue_id: cueId,
    asset_id: 'asset_1',
    role: 'mood_reference',
    created_by_type: 'admin',
  }
}

function makeChangeInput(cueId: string): RecordCueChangeInput {
  return {
    cue_id: cueId,
    source: 'manual',
    actor_user_id: 'user_admin',
    change_type: 'create_cue',
    patch_json: { version: 1, partial: {} },
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('InMemoryCueRepository — Schedule', () => {
  let repo: InMemoryCueRepository

  beforeEach(() => {
    repo = new InMemoryCueRepository()
  })

  it('creates a schedule with defaults', async () => {
    const schedule = await repo.createSchedule(makeScheduleInput())
    expect(schedule.id).toMatch(/^csched_/)
    expect(schedule.status).toBe('draft')
    expect(schedule.timezone).toBe('Asia/Shanghai')
    expect(schedule.version).toBe(1)
  })

  it('finds a schedule by id', async () => {
    const created = await repo.createSchedule(makeScheduleInput())
    const found = await repo.findScheduleById(created.id)
    expect(found?.id).toBe(created.id)
  })

  it('returns null for missing schedule id', async () => {
    expect(await repo.findScheduleById('missing')).toBeNull()
  })

  it('updates schedule status and stamps published_at on publish', async () => {
    const schedule = await repo.createSchedule(makeScheduleInput())
    const updated = await repo.updateScheduleStatus(schedule.id, 'published')
    expect(updated?.status).toBe('published')
    expect(updated?.published_at).toBeInstanceOf(Date)
  })

  it('returns null when updating missing schedule', async () => {
    expect(await repo.updateScheduleStatus('missing', 'archived')).toBeNull()
  })

  it('finds active schedule for community scope', async () => {
    const a = await repo.createSchedule(
      makeScheduleInput({ scope_type: 'community', community_id: 'c1' }),
    )
    await repo.updateScheduleStatus(a.id, 'active')
    await repo.createSchedule(
      makeScheduleInput({ scope_type: 'community', community_id: 'c2' }),
    )
    const found = await repo.findActiveScheduleForScope({
      scope_type: 'community',
      community_id: 'c1',
    })
    expect(found?.id).toBe(a.id)
  })

  it('listSchedules respects limit', async () => {
    await repo.createSchedule(makeScheduleInput())
    await repo.createSchedule(makeScheduleInput())
    await repo.createSchedule(makeScheduleInput())
    const items = await repo.listSchedules({ limit: 2 })
    expect(items).toHaveLength(2)
  })
})

describe('InMemoryCueRepository — Cue', () => {
  let repo: InMemoryCueRepository
  let scheduleId: string

  beforeEach(async () => {
    repo = new InMemoryCueRepository()
    const s = await repo.createSchedule(makeScheduleInput())
    scheduleId = s.id
  })

  it('creates a cue with defaults and a derived idempotency_key', async () => {
    const cue = await repo.createCue(makeCueInput(scheduleId))
    expect(cue.id).toMatch(/^cue_/)
    expect(cue.status).toBe('draft')
    expect(cue.priority).toBe(50)
    expect(cue.lane).toBe('standard')
    expect(cue.risk_level).toBe('standard')
    expect(cue.revision).toBe(1)
    expect(cue.idempotency_key.startsWith('cue:')).toBe(true)
    expect(cue.idempotency_key.split(':')).toHaveLength(4)
  })

  it('preserves an explicit idempotency_key', async () => {
    const explicit = 'cue:sched_x:cue_x:0'
    const cue = await repo.createCue(
      makeCueInput(scheduleId, { idempotency_key: explicit }),
    )
    expect(cue.idempotency_key).toBe(explicit)
  })

  it('lists cues for a schedule sorted by trigger_at', async () => {
    const t1 = new Date('2026-04-25T20:30:00+08:00')
    const t2 = new Date('2026-04-25T21:30:00+08:00')
    await repo.createCue(makeCueInput(scheduleId, { trigger_at: t2 }))
    await repo.createCue(makeCueInput(scheduleId, { trigger_at: t1 }))
    const list = await repo.listCuesForSchedule(scheduleId)
    expect(list).toHaveLength(2)
    expect(new Date(list[0]!.trigger_at).getTime()).toBeLessThan(
      new Date(list[1]!.trigger_at).getTime(),
    )
  })

  it('listUpcomingCues filters by community + time window', async () => {
    const within = new Date('2026-04-25T20:30:00+08:00')
    const after = new Date('2026-04-26T20:30:00+08:00')
    const c1 = await repo.createCue(
      makeCueInput(scheduleId, { trigger_at: within, community_id: 'c1' }),
    )
    await repo.createCue(
      makeCueInput(scheduleId, { trigger_at: after, community_id: 'c1' }),
    )
    await repo.createCue(
      makeCueInput(scheduleId, { trigger_at: within, community_id: 'c2' }),
    )
    const list = await repo.listUpcomingCues({
      community_id: 'c1',
      from: new Date('2026-04-25T00:00:00+08:00'),
      to: new Date('2026-04-26T00:00:00+08:00'),
    })
    expect(list).toHaveLength(1)
    expect(list[0]!.id).toBe(c1.id)
  })

  it('setCueStatus transitions status and bumps updated_at', async () => {
    const cue = await repo.createCue(makeCueInput(scheduleId))
    const before = cue.updated_at
    await new Promise((r) => setTimeout(r, 5))
    const updated = await repo.setCueStatus(cue.id, 'scheduled')
    expect(updated?.status).toBe('scheduled')
    expect(updated?.updated_at).not.toBe(before)
  })

  it('setCueStatus returns null on missing cue', async () => {
    expect(await repo.setCueStatus('missing', 'scheduled')).toBeNull()
  })
})

describe('InMemoryCueRepository — Change (audit log)', () => {
  let repo: InMemoryCueRepository
  let scheduleId: string
  let cueId: string

  beforeEach(async () => {
    repo = new InMemoryCueRepository()
    const s = await repo.createSchedule(makeScheduleInput())
    scheduleId = s.id
    const cue = await repo.createCue(makeCueInput(scheduleId))
    cueId = cue.id
  })

  it('records a change with defaults', async () => {
    const change = await repo.recordChange(makeChangeInput(cueId))
    expect(change.id).toMatch(/^cchg_/)
    expect(change.source).toBe('manual')
    expect(change.change_type).toBe('create_cue')
    expect(change.validation_status).toBe('pending')
    expect(change.approval_status).toBe('pending')
    expect(change.risk_level).toBe('standard')
  })

  it('lists changes for cue in reverse-chronological order', async () => {
    await repo.recordChange({ ...makeChangeInput(cueId), reason: 'first' })
    await new Promise((r) => setTimeout(r, 2))
    await repo.recordChange({ ...makeChangeInput(cueId), reason: 'second' })
    const list = await repo.listChangesForCue(cueId)
    expect(list).toHaveLength(2)
    expect(list[0]!.reason).toBe('second')
    expect(list[1]!.reason).toBe('first')
  })

  it('lists changes by schedule when scheduled-id-bound (e.g. publish_schedule)', async () => {
    await repo.recordChange({
      schedule_id: scheduleId,
      source: 'system',
      change_type: 'publish_schedule',
      patch_json: { version: 1, partial: {} },
    })
    const list = await repo.listChangesForSchedule(scheduleId)
    expect(list).toHaveLength(1)
    expect(list[0]!.change_type).toBe('publish_schedule')
  })
})

describe('InMemoryCueRepository — Media', () => {
  let repo: InMemoryCueRepository
  let cueId: string

  beforeEach(async () => {
    repo = new InMemoryCueRepository()
    const s = await repo.createSchedule(makeScheduleInput())
    const cue = await repo.createCue(makeCueInput(s.id))
    cueId = cue.id
  })

  it('attaches media with defaults', async () => {
    const media = await repo.attachMedia(makeMediaInput(cueId))
    expect(media.id).toMatch(/^cmed_/)
    expect(media.usage_strength).toBe('optional')
    expect(media.use_policy).toBe('prefer_runtime_context')
    expect(media.display_policy).toBe('runtime_decides')
    expect(media.validation_status).toBe('valid')
  })

  it('lists media sorted by sort_order then created_at', async () => {
    const m1 = await repo.attachMedia({ ...makeMediaInput(cueId), sort_order: 2 })
    const m2 = await repo.attachMedia({ ...makeMediaInput(cueId), sort_order: 1 })
    const list = await repo.listMediaForCue(cueId)
    expect(list.map((m) => m.id)).toEqual([m2.id, m1.id])
  })

  it('removes media and reports outcome', async () => {
    const media = await repo.attachMedia(makeMediaInput(cueId))
    expect(await repo.removeMedia(media.id)).toBe(true)
    expect(await repo.removeMedia(media.id)).toBe(false)
    expect(await repo.listMediaForCue(cueId)).toHaveLength(0)
  })

  it('reserves all four usage_strength values (T-216 will unlock anchor / selected_only_pool)', async () => {
    for (const strength of [
      'optional',
      'preferred',
      'anchor',
      'selected_only_pool',
    ] as const) {
      await repo.attachMedia({ ...makeMediaInput(cueId), usage_strength: strength })
    }
    const list = await repo.listMediaForCue(cueId)
    expect(list).toHaveLength(4)
    expect(new Set(list.map((m) => m.usage_strength))).toEqual(
      new Set(['optional', 'preferred', 'anchor', 'selected_only_pool']),
    )
  })
})

describe('InMemoryCueRepository — Attempt (read API)', () => {
  let repo: InMemoryCueRepository

  beforeEach(() => {
    repo = new InMemoryCueRepository()
  })

  it('returns empty array for cue with no attempts', async () => {
    const list = await repo.listAttemptsForCue('cue_no_attempts')
    expect(list).toEqual([])
  })
})

describe('InMemoryCueRepository — Idempotency-key derivation (HIGH-1 fix)', () => {
  it('produces unique keys for concurrent creates within the same millisecond', async () => {
    const repo = new InMemoryCueRepository()
    const schedule = await repo.createSchedule(makeScheduleInput())
    const baseInput = makeCueInput(schedule.id)
    // Create 100 cues back-to-back; idempotency keys must all differ even
    // though Date.now() is identical for many of them.
    const keys = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const cue = await repo.createCue(baseInput)
      keys.add(cue.idempotency_key)
    }
    expect(keys.size).toBe(100)
    for (const k of keys) {
      expect(k.startsWith('cue:')).toBe(true)
    }
  })
})

describe('InMemoryCueRepository — Scope consistency (HIGH-2 fix)', () => {
  it('rejects a community-scoped schedule receiving a cue with a different community', async () => {
    const repo = new InMemoryCueRepository()
    const schedule = await repo.createSchedule(
      makeScheduleInput({ scope_type: 'community', community_id: 'c1' }),
    )
    await expect(
      repo.createCue(
        makeCueInput(schedule.id, {
          community_id: 'c2',
          scope: makeScope('c2'),
        }),
      ),
    ).rejects.toThrow(/scoped to community c1/)
  })

  it('rejects a community-scoped schedule when cue.scope.community_id mismatches', async () => {
    const repo = new InMemoryCueRepository()
    const schedule = await repo.createSchedule(
      makeScheduleInput({ scope_type: 'community', community_id: 'c1' }),
    )
    await expect(
      repo.createCue(
        makeCueInput(schedule.id, {
          community_id: 'c1',
          scope: makeScope('c2'),
        }),
      ),
    ).rejects.toThrow(/scope\.community_id is c2/)
  })

  it('accepts a community-scoped schedule when cue community matches', async () => {
    const repo = new InMemoryCueRepository()
    const schedule = await repo.createSchedule(
      makeScheduleInput({ scope_type: 'community', community_id: 'c1' }),
    )
    await expect(
      repo.createCue(
        makeCueInput(schedule.id, {
          community_id: 'c1',
          scope: makeScope('c1'),
        }),
      ),
    ).resolves.toBeDefined()
  })

  it('accepts a global schedule with cues for any community', async () => {
    const repo = new InMemoryCueRepository()
    const schedule = await repo.createSchedule(makeScheduleInput()) // global
    await expect(
      repo.createCue(
        makeCueInput(schedule.id, {
          community_id: 'c_any',
          scope: makeScope('c_any'),
        }),
      ),
    ).resolves.toBeDefined()
  })

  it('rejects createCue when schedule is missing', async () => {
    const repo = new InMemoryCueRepository()
    await expect(
      repo.createCue(makeCueInput('schedule_missing')),
    ).rejects.toThrow(/schedule schedule_missing not found/)
  })
})

// =============================================================================
// T-212 M2 — attempt write API + lease primitives
// =============================================================================

describe('attemptIdempotencyKey — namespace contract (T-212 R8)', () => {
  it('produces cue:<schedule>:<cue>:<attempt_no> for attempt_no >= 1', () => {
    const key = attemptIdempotencyKey('sched-1', 'cue-1', 1)
    expect(key).toBe('cue:sched-1:cue-1:1')
    const parsed = parseIdempotencyKey(key)
    expect(parsed?.namespace).toBe('cue')
    expect(parsed?.segments).toEqual(['sched-1', 'cue-1', '1'])
  })

  it('rejects attempt_no=0 (reserved for cue creation sentinel)', () => {
    expect(() => attemptIdempotencyKey('sched-1', 'cue-1', 0)).toThrow(
      /positive integer/,
    )
  })

  it('rejects negative or non-integer attempt_no', () => {
    expect(() => attemptIdempotencyKey('sched-1', 'cue-1', -1)).toThrow()
    expect(() => attemptIdempotencyKey('sched-1', 'cue-1', 1.5)).toThrow()
  })

  it('cue creation key (revision=0) and attempt key (attempt_no>=1) never collide', () => {
    // defaultCueIdempotencyKey uses 'pending-XXXX' for the cue id segment;
    // attemptIdempotencyKey uses the real cue id. Even if attempt_no were
    // accidentally 0 (it cannot be — guarded above), the key would still be
    // distinct because of the different middle segment.
    const cueKey = defaultCueIdempotencyKey('sched-1')
    const attemptKey = attemptIdempotencyKey('sched-1', 'cue-real-cuid', 1)
    expect(cueKey).not.toEqual(attemptKey)
    const cueParsed = parseIdempotencyKey(cueKey)!
    expect(cueParsed.segments[2]).toBe('0')
    expect(cueParsed.segments[1]).toMatch(/^pending-/)
    const attemptParsed = parseIdempotencyKey(attemptKey)!
    expect(attemptParsed.segments[2]).toBe('1')
    expect(attemptParsed.segments[1]).not.toMatch(/^pending-/)
  })
})

describe('InMemoryCueRepository — claimDueCues', () => {
  let repo: InMemoryCueRepository
  let scheduleId: string
  const now = new Date('2026-04-25T20:30:00.000Z')

  async function seedScheduledCue(
    triggerAt: Date,
    overrides: Partial<CreateCueInput> = {},
  ): Promise<string> {
    const cue = await repo.createCue(
      makeCueInput(scheduleId, {
        trigger_at: triggerAt,
        status: 'scheduled',
        ...overrides,
      }),
    )
    return cue.id
  }

  beforeEach(async () => {
    repo = new InMemoryCueRepository()
    const schedule = await repo.createSchedule(makeScheduleInput())
    scheduleId = schedule.id
  })

  it('claims a due cue and emits a leased attempt', async () => {
    const cueId = await seedScheduledCue(now)
    const result = await repo.claimDueCues({
      now,
      graceSeconds: 60,
      leaseOwner: 'worker-A',
      leaseSeconds: 120,
      batchSize: 5,
    })
    expect(result).toHaveLength(1)
    const claimed = result[0]
    expect(claimed.cue.id).toBe(cueId)
    expect(claimed.cue.status).toBe('claimed')
    expect(claimed.attempt.cue_id).toBe(cueId)
    expect(claimed.attempt.status).toBe('leased')
    expect(claimed.attempt.attempt_no).toBe(1)
    expect(claimed.attempt.lease_owner).toBe('worker-A')
    expect(claimed.attempt.lease_expires_at?.getTime()).toBe(
      now.getTime() + 120_000,
    )
    expect(claimed.attempt.idempotency_key).toBe(
      attemptIdempotencyKey(scheduleId, cueId, 1),
    )
  })

  it('skips cues whose triggerAt is beyond now+grace', async () => {
    await seedScheduledCue(new Date(now.getTime() + 5 * 60_000))
    const result = await repo.claimDueCues({
      now,
      graceSeconds: 60,
      leaseOwner: 'worker-A',
      leaseSeconds: 120,
      batchSize: 5,
    })
    expect(result).toHaveLength(0)
  })

  it('does not double-claim a cue across two sequential workers', async () => {
    const cueId = await seedScheduledCue(now)
    const a = await repo.claimDueCues({
      now,
      graceSeconds: 60,
      leaseOwner: 'worker-A',
      leaseSeconds: 120,
      batchSize: 5,
    })
    const b = await repo.claimDueCues({
      now,
      graceSeconds: 60,
      leaseOwner: 'worker-B',
      leaseSeconds: 120,
      batchSize: 5,
    })
    expect(a.map((r) => r.cue.id)).toEqual([cueId])
    expect(b).toHaveLength(0)
  })

  it('only considers status in {scheduled, due, deferred}', async () => {
    const scheduledId = await seedScheduledCue(now)
    const dueId = await seedScheduledCue(now, { status: 'due' })
    const deferredId = await seedScheduledCue(now, { status: 'deferred' })
    await seedScheduledCue(now, { status: 'cancelled' })
    await seedScheduledCue(now, { status: 'consumed' })
    const result = await repo.claimDueCues({
      now,
      graceSeconds: 60,
      leaseOwner: 'worker-A',
      leaseSeconds: 120,
      batchSize: 10,
    })
    const ids = new Set(result.map((r) => r.cue.id))
    expect(ids).toEqual(new Set([scheduledId, dueId, deferredId]))
  })

  it('orders by priority desc then triggerAt asc', async () => {
    const earlyLowPri = await seedScheduledCue(
      new Date(now.getTime() - 2 * 60_000),
      { priority: 10 },
    )
    const laterHighPri = await seedScheduledCue(
      new Date(now.getTime() - 1 * 60_000),
      { priority: 90 },
    )
    const result = await repo.claimDueCues({
      now,
      graceSeconds: 60,
      leaseOwner: 'worker-A',
      leaseSeconds: 120,
      batchSize: 1,
    })
    expect(result).toHaveLength(1)
    expect(result[0].cue.id).toBe(laterHighPri)
    // sanity: low-pri cue was not claimed
    const second = await repo.claimDueCues({
      now,
      graceSeconds: 60,
      leaseOwner: 'worker-A',
      leaseSeconds: 120,
      batchSize: 1,
    })
    expect(second[0]?.cue.id).toBe(earlyLowPri)
  })

  it('caps the result at batchSize', async () => {
    for (let i = 0; i < 4; i++) await seedScheduledCue(now)
    const result = await repo.claimDueCues({
      now,
      graceSeconds: 60,
      leaseOwner: 'worker-A',
      leaseSeconds: 120,
      batchSize: 2,
    })
    expect(result).toHaveLength(2)
  })

  it('respects scheduleId scope filter when provided', async () => {
    const inScopeCueId = await seedScheduledCue(now)
    const otherSchedule = await repo.createSchedule(makeScheduleInput())
    await repo.createCue(
      makeCueInput(otherSchedule.id, { trigger_at: now, status: 'scheduled' }),
    )
    const result = await repo.claimDueCues({
      now,
      graceSeconds: 60,
      leaseOwner: 'worker-A',
      leaseSeconds: 120,
      batchSize: 10,
      scheduleId,
    })
    expect(result.map((r) => r.cue.id)).toEqual([inScopeCueId])
  })
})

describe('InMemoryCueRepository — attempt update / release / extend / find', () => {
  let repo: InMemoryCueRepository
  let scheduleId: string
  let cueId: string
  const now = new Date('2026-04-25T20:30:00.000Z')

  beforeEach(async () => {
    repo = new InMemoryCueRepository()
    const schedule = await repo.createSchedule(makeScheduleInput())
    scheduleId = schedule.id
    const cue = await repo.createCue(
      makeCueInput(scheduleId, { trigger_at: now, status: 'scheduled' }),
    )
    cueId = cue.id
  })

  async function leaseOnce(): Promise<{ attemptId: string }> {
    const result = await repo.claimDueCues({
      now,
      graceSeconds: 60,
      leaseOwner: 'worker-A',
      leaseSeconds: 120,
      batchSize: 1,
    })
    return { attemptId: result[0].attempt.id }
  }

  it('updateAttempt patches selected fields without touching the rest', async () => {
    const { attemptId } = await leaseOnce()
    const updated = await repo.updateAttempt(attemptId, {
      status: 'executing',
      admission_result_json: { granted: true, decision: 'admit', reason_codes: [] },
    })
    expect(updated?.status).toBe('executing')
    expect((updated?.admission_result_json as { granted?: boolean })?.granted).toBe(true)
    // unchanged
    expect(updated?.lease_owner).toBe('worker-A')
  })

  it('updateAttempt returns null for unknown id', async () => {
    expect(await repo.updateAttempt('does-not-exist', { status: 'failed' })).toBeNull()
  })

  it('releaseLease clears lease_owner and lease_expires_at', async () => {
    const { attemptId } = await leaseOnce()
    const released = await repo.releaseLease(attemptId)
    expect(released?.lease_owner).toBeNull()
    expect(released?.lease_expires_at).toBeNull()
  })

  it('extendLease pushes lease_expires_at by leaseSeconds from supplied now', async () => {
    const { attemptId } = await leaseOnce()
    const later = new Date(now.getTime() + 60_000)
    const extended = await repo.extendLease(attemptId, 30, later)
    expect(extended?.lease_expires_at?.getTime()).toBe(later.getTime() + 30_000)
  })

  it('findInFlightAttemptForCue returns the most recent in-flight attempt', async () => {
    await leaseOnce()
    const found = await repo.findInFlightAttemptForCue(cueId)
    expect(found?.cue_id).toBe(cueId)
    expect(found?.status).toBe('leased')
  })

  it('findInFlightAttemptForCue returns null after attempt finishes', async () => {
    const { attemptId } = await leaseOnce()
    await repo.updateAttempt(attemptId, { status: 'succeeded' })
    expect(await repo.findInFlightAttemptForCue(cueId)).toBeNull()
  })
})

describe('InMemoryCueRepository — reclaimExpiredLeases', () => {
  let repo: InMemoryCueRepository
  let scheduleId: string
  let cueId: string
  const now = new Date('2026-04-25T20:30:00.000Z')

  beforeEach(async () => {
    repo = new InMemoryCueRepository()
    const schedule = await repo.createSchedule(makeScheduleInput())
    scheduleId = schedule.id
    const cue = await repo.createCue(
      makeCueInput(scheduleId, { trigger_at: now, status: 'scheduled' }),
    )
    cueId = cue.id
  })

  it('marks expired in-flight attempts failed with lease_expired and resets cue to deferred', async () => {
    const claimed = await repo.claimDueCues({
      now,
      graceSeconds: 60,
      leaseOwner: 'worker-dead',
      leaseSeconds: 30,
      batchSize: 1,
    })
    const attemptId = claimed[0].attempt.id
    const future = new Date(now.getTime() + 90_000) // past lease_expires_at
    const reclaimed = await repo.reclaimExpiredLeases({ now: future })
    expect(reclaimed).toEqual([{ attempt_id: attemptId, cue_id: cueId }])
    const after = (await repo.listAttemptsForCue(cueId))[0]
    expect(after.status).toBe('failed')
    expect(after.error_code).toBe('lease_expired')
    expect(after.lease_owner).toBeNull()
    const cueAfter = await repo.findCueById(cueId)
    expect(cueAfter?.status).toBe('deferred')
  })

  it('does not reclaim leases that have not yet expired', async () => {
    await repo.claimDueCues({
      now,
      graceSeconds: 60,
      leaseOwner: 'worker-A',
      leaseSeconds: 120,
      batchSize: 1,
    })
    const justAfter = new Date(now.getTime() + 60_000)
    const reclaimed = await repo.reclaimExpiredLeases({ now: justAfter })
    expect(reclaimed).toEqual([])
  })

  it('does not touch attempts already in a terminal state', async () => {
    const claimed = await repo.claimDueCues({
      now,
      graceSeconds: 60,
      leaseOwner: 'worker-A',
      leaseSeconds: 30,
      batchSize: 1,
    })
    await repo.updateAttempt(claimed[0].attempt.id, { status: 'succeeded' })
    const future = new Date(now.getTime() + 90_000)
    const reclaimed = await repo.reclaimExpiredLeases({ now: future })
    expect(reclaimed).toEqual([])
  })

  it('caps reclaim batch size', async () => {
    // Seed three independent cues, all with short leases.
    for (let i = 0; i < 3; i++) {
      const c = await repo.createCue(
        makeCueInput(scheduleId, {
          trigger_at: now,
          status: 'scheduled',
          community_id: `c${i}`,
          scope: { mode: 'single', community_id: `c${i}` },
        }),
      )
      await repo.claimDueCues({
        now,
        graceSeconds: 60,
        leaseOwner: 'w',
        leaseSeconds: 30,
        batchSize: 1,
        scheduleId,
      })
      void c
    }
    const future = new Date(now.getTime() + 90_000)
    const reclaimed = await repo.reclaimExpiredLeases({ now: future, batchSize: 2 })
    expect(reclaimed).toHaveLength(2)
  })
})
