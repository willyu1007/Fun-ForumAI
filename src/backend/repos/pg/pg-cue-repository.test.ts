/**
 * T-209 Pg integration smoke. Hits a real local Postgres instance.
 *
 * Skipped automatically when DATABASE_URL is not set or when the dev DB
 * isn't reachable, so this test never blocks CI in headless environments
 * but provides real-DB confidence locally.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import pg from 'pg'
import { PrismaClient, Prisma } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { PgCueRepository } from './pg-cue-repository.js'
import { BaselineCueImporter } from '../../programming/cue/baseline-cue-importer.js'
import type {
  CreateCueInput,
  CreateCueScheduleInput,
} from '../cue-repository.js'

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://yurui@localhost:5432/llm_forum_dev'

let prisma: PrismaClient | null = null
let pool: pg.Pool | null = null
let dbAvailable = false

beforeAll(async () => {
  try {
    pool = new pg.Pool({ connectionString: DATABASE_URL })
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
    await prisma.$queryRaw`SELECT 1`
    await prisma.publicDiscussionCueSchedule.count()
    dbAvailable = true
  } catch (err) {
    console.warn('[pg-cue-repository.test] DB probe failed:', (err as Error).message)
    dbAvailable = false
  }
})

afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect()
  }
  if (pool) {
    await pool.end()
  }
})

beforeEach(async () => {
  if (!dbAvailable || !prisma) return
  // Wipe cue tables before each test, in dependency order.
  await prisma.cueExecutionAttempt.deleteMany()
  await prisma.publicDiscussionCueChange.deleteMany()
  await prisma.publicDiscussionCueMedia.deleteMany()
  await prisma.publicDiscussionCue.deleteMany()
  await prisma.publicDiscussionCueSchedule.deleteMany()
  await prisma.communityRuntimeLoadSnapshot.deleteMany()
})

function makeScheduleInput(
  overrides: Partial<CreateCueScheduleInput> = {},
): CreateCueScheduleInput {
  return {
    scope_type: 'global',
    date_range_start: new Date('2026-04-26T00:00:00+08:00'),
    date_range_end: new Date('2026-04-27T00:00:00+08:00'),
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
    scope: { mode: 'single', community_id: 'c1' },
    trigger_at: new Date('2026-04-26T20:30:00+08:00'),
    dispatch_policy: {
      trigger_at: '2026-04-26T20:30:00+08:00',
      timezone: 'Asia/Shanghai',
      dispatch_mode: 'graceful',
      grace_seconds: 60,
      priority: 60,
      lane: 'standard',
      misfire_policy: 'delay',
      max_attempts: 3,
      retry_backoff_seconds: 30,
    },
    theme_intent: { topic_seed: 'pg integration topic' },
    scene_constraints: {
      community_scope: { mode: 'single', community_id: 'c1' },
      public_stage_scope: ['forum'],
      privacy_policy: 'public_only',
      private_reference_policy: 'forbidden',
      safety_profile: 'standard',
    },
    role_requirements: {
      requirements: [{ role: 'anchor', weight: 0.7 }],
    },
    ...overrides,
  }
}

describe.runIf(true)('PgCueRepository — integration smoke', () => {
  it('round-trips a schedule + cue + change through real Postgres', async () => {
    if (!dbAvailable || !prisma) {
      console.warn('[pg-cue-repository.test] skipping — DB unavailable')
      return
    }
    const repo = new PgCueRepository(prisma)
    const schedule = await repo.createSchedule(makeScheduleInput())
    const cue = await repo.createCue(makeCueInput(schedule.id))

    const fetchedCue = await repo.findCueById(cue.id)
    expect(fetchedCue?.id).toBe(cue.id)
    expect(fetchedCue?.idempotency_key.startsWith('cue:')).toBe(true)
    expect(fetchedCue?.theme_intent.topic_seed).toBe('pg integration topic')
    expect(fetchedCue?.scope.mode).toBe('single')
    expect(fetchedCue?.scope.community_id).toBe('c1')
    expect(fetchedCue?.locked_fields).toEqual([])

    const change = await repo.recordChange({
      cue_id: cue.id,
      source: 'manual',
      change_type: 'create_cue',
      patch_json: { version: 1, partial: {} },
    })
    expect(change.id).toBeTruthy()

    const changeList = await repo.listChangesForCue(cue.id)
    expect(changeList).toHaveLength(1)
  })

  it('rejects scope-inconsistent cues at the Pg layer (HIGH-2 fix)', async () => {
    if (!dbAvailable || !prisma) return
    const repo = new PgCueRepository(prisma)
    const schedule = await repo.createSchedule(
      makeScheduleInput({ scope_type: 'community', community_id: 'c1' }),
    )
    await expect(
      repo.createCue(
        makeCueInput(schedule.id, {
          community_id: 'c1',
          scope: { mode: 'single', community_id: 'c2' },
        }),
      ),
    ).rejects.toThrow(/scope\.community_id is c2/)
  })

  it('produces unique idempotency keys for concurrent creates (HIGH-1 fix)', async () => {
    if (!dbAvailable || !prisma) return
    const repo = new PgCueRepository(prisma)
    const schedule = await repo.createSchedule(makeScheduleInput())
    // Create 50 cues sequentially but rapidly (sub-ms gap).
    const keys = new Set<string>()
    for (let i = 0; i < 50; i++) {
      const cue = await repo.createCue(makeCueInput(schedule.id))
      keys.add(cue.idempotency_key)
    }
    expect(keys.size).toBe(50)
  })

  it('hydrates locked_fields through LockedFieldsSchema (CRITICAL-2 fix)', async () => {
    if (!dbAvailable || !prisma) return
    const repo = new PgCueRepository(prisma)
    const schedule = await repo.createSchedule(makeScheduleInput())
    const cue = await repo.createCue(
      makeCueInput(schedule.id, { locked_fields: ['priority', 'risk_level'] }),
    )
    const fetched = await repo.findCueById(cue.id)
    expect(fetched?.locked_fields).toEqual(['priority', 'risk_level'])
  })

  it('surfaces ZodError when JSON columns are tampered with (CRITICAL-1 fix)', async () => {
    if (!dbAvailable || !prisma) return
    const repo = new PgCueRepository(prisma)
    const schedule = await repo.createSchedule(makeScheduleInput())
    const cue = await repo.createCue(makeCueInput(schedule.id))
    // Bypass repo to write malformed scope_json directly.
    await prisma.publicDiscussionCue.update({
      where: { id: cue.id },
      data: { scopeJson: { mode: 'unknown' } as Prisma.InputJsonValue },
    })
    await expect(repo.findCueById(cue.id)).rejects.toThrow()
  })

  it('runs BaselineCueImporter against real DB and is idempotent', async () => {
    if (!dbAvailable || !prisma) return
    const repo = new PgCueRepository(prisma)
    const importer = new BaselineCueImporter({ repo })
    const first = await importer.run({
      now: new Date('2026-04-26T12:00:00+08:00'),
    })
    expect(first.is_new).toBe(true)
    expect(first.cues.length).toBeGreaterThan(0)

    const second = await importer.run({
      now: new Date('2026-04-26T20:00:00+08:00'),
    })
    expect(second.is_new).toBe(false)
    expect(second.schedule.id).toBe(first.schedule.id)
    expect(second.cues.length).toBe(first.cues.length)

    const allSchedules = await repo.listSchedules()
    expect(allSchedules.length).toBe(1)
  })

  // ===========================================================================
  // T-212 M2 — attempt write API + lease semantics on real Postgres
  // ===========================================================================

  it('claimDueCues atomically transitions a cue to claimed and emits a leased attempt', async () => {
    if (!dbAvailable || !prisma) return
    const repo = new PgCueRepository(prisma)
    const schedule = await repo.createSchedule(makeScheduleInput())
    const cue = await repo.createCue(
      makeCueInput(schedule.id, {
        trigger_at: new Date('2026-04-26T12:00:00+08:00'),
        status: 'scheduled',
      }),
    )

    const now = new Date('2026-04-26T12:00:30+08:00')
    const claimed = await repo.claimDueCues({
      now,
      graceSeconds: 60,
      leaseOwner: 'worker-A',
      leaseSeconds: 120,
      batchSize: 10,
    })
    expect(claimed).toHaveLength(1)
    expect(claimed[0].cue.id).toBe(cue.id)
    expect(claimed[0].cue.status).toBe('claimed')
    expect(claimed[0].attempt.status).toBe('leased')
    expect(claimed[0].attempt.attempt_no).toBe(1)
    expect(claimed[0].attempt.lease_owner).toBe('worker-A')
    expect(claimed[0].attempt.lease_expires_at?.getTime()).toBe(
      now.getTime() + 120_000,
    )
    expect(claimed[0].attempt.idempotency_key).toMatch(
      /^cue:[^:]+:[^:]+:1$/,
    )
  })

  it('does not double-claim under concurrent claimers (FOR UPDATE SKIP LOCKED)', async () => {
    if (!dbAvailable || !prisma) return
    const repo = new PgCueRepository(prisma)
    const schedule = await repo.createSchedule(makeScheduleInput())
    // Seed 5 cues all due at the same instant.
    const triggerAt = new Date('2026-04-26T13:00:00+08:00')
    for (let i = 0; i < 5; i++) {
      await repo.createCue(
        makeCueInput(schedule.id, {
          trigger_at: triggerAt,
          status: 'scheduled',
          community_id: `c${i}`,
          scope: { mode: 'single', community_id: `c${i}` },
        }),
      )
    }
    const now = new Date(triggerAt.getTime() + 30_000)
    // Two parallel workers, batchSize=3 each. Combined they may claim at most 5.
    const [a, b] = await Promise.all([
      repo.claimDueCues({
        now,
        graceSeconds: 60,
        leaseOwner: 'worker-A',
        leaseSeconds: 120,
        batchSize: 3,
      }),
      repo.claimDueCues({
        now,
        graceSeconds: 60,
        leaseOwner: 'worker-B',
        leaseSeconds: 120,
        batchSize: 3,
      }),
    ])
    const claimedIds = [
      ...a.map((r) => r.cue.id),
      ...b.map((r) => r.cue.id),
    ]
    // No double-claim
    expect(new Set(claimedIds).size).toBe(claimedIds.length)
    // Combined cap is 5
    expect(claimedIds.length).toBeLessThanOrEqual(5)
  })

  it('lease expiry — reclaim resets cue to deferred and marks attempt failed', async () => {
    if (!dbAvailable || !prisma) return
    const repo = new PgCueRepository(prisma)
    const schedule = await repo.createSchedule(makeScheduleInput())
    const cue = await repo.createCue(
      makeCueInput(schedule.id, {
        trigger_at: new Date('2026-04-26T14:00:00+08:00'),
        status: 'scheduled',
      }),
    )
    const claimAt = new Date('2026-04-26T14:00:30+08:00')
    const claimed = await repo.claimDueCues({
      now: claimAt,
      graceSeconds: 60,
      leaseOwner: 'worker-dead',
      leaseSeconds: 30,
      batchSize: 1,
    })
    expect(claimed).toHaveLength(1)
    const attemptId = claimed[0].attempt.id

    // Move past lease_expires_at
    const future = new Date(claimAt.getTime() + 90_000)
    const reclaimed = await repo.reclaimExpiredLeases({ now: future })
    expect(reclaimed).toEqual([{ attempt_id: attemptId, cue_id: cue.id }])

    const cueAfter = await repo.findCueById(cue.id)
    expect(cueAfter?.status).toBe('deferred')

    const attemptsAfter = await repo.listAttemptsForCue(cue.id)
    expect(attemptsAfter[0].status).toBe('failed')
    expect(attemptsAfter[0].error_code).toBe('lease_expired')
    expect(attemptsAfter[0].lease_owner).toBeNull()
  })

  it('updateAttempt + releaseLease + extendLease end-to-end', async () => {
    if (!dbAvailable || !prisma) return
    const repo = new PgCueRepository(prisma)
    const schedule = await repo.createSchedule(makeScheduleInput())
    await repo.createCue(
      makeCueInput(schedule.id, {
        trigger_at: new Date('2026-04-26T15:00:00+08:00'),
        status: 'scheduled',
      }),
    )
    const now = new Date('2026-04-26T15:00:30+08:00')
    const claimed = await repo.claimDueCues({
      now,
      graceSeconds: 60,
      leaseOwner: 'worker-A',
      leaseSeconds: 60,
      batchSize: 1,
    })
    const attemptId = claimed[0].attempt.id

    const updated = await repo.updateAttempt(attemptId, {
      status: 'executing',
      admission_result_json: { granted: true, decision: 'admit', reason_codes: [] },
    })
    expect(updated?.status).toBe('executing')

    const extended = await repo.extendLease(attemptId, 120, now)
    expect(extended?.lease_expires_at?.getTime()).toBe(now.getTime() + 120_000)

    const released = await repo.releaseLease(attemptId)
    expect(released?.lease_owner).toBeNull()
    expect(released?.lease_expires_at).toBeNull()
  })
})
