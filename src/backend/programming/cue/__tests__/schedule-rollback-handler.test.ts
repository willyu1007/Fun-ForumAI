/**
 * T-212 M5 — ScheduleRollbackHandler.
 *
 * Verifies the cancel-cascade per T-212 overview §6.1:
 *   - pre-execution states → cancelled + emit Cancelled
 *   - in-flight states (claimed / executing) → preserved (run-to-completion)
 *   - terminal states → no-op
 */

import { describe, it, expect } from 'vitest'
import {
  InMemoryCueRepository,
  type CreateCueInput,
  type CreateCueScheduleInput,
} from '../../../repos/cue-repository.js'
import { InMemoryEventRepository } from '../../../repos/event-repository.js'
import { ScheduleRollbackHandler } from '../schedule-rollback-handler.js'
import type { PublicDiscussionCueStatus } from '../types.js'
import { CUE_EXECUTION_CANCELLED } from '../cue-domain-events.js'

function makeScheduleInput(): CreateCueScheduleInput {
  return {
    scope_type: 'global',
    date_range_start: new Date('2026-04-26T00:00:00.000Z'),
    date_range_end: new Date('2026-04-27T00:00:00.000Z'),
    source: 'manual',
  }
}

function makeCueInput(scheduleId: string): CreateCueInput {
  return {
    schedule_id: scheduleId,
    source_type: 'manual',
    community_id: 'c1',
    scope: { mode: 'single', community_id: 'c1' },
    trigger_at: new Date('2026-04-26T20:30:00.000Z'),
    dispatch_policy: {
      trigger_at: '2026-04-26T20:30:00.000Z',
      timezone: 'UTC',
      dispatch_mode: 'graceful',
      grace_seconds: 60,
      priority: 50,
      lane: 'standard',
      misfire_policy: 'delay',
      max_attempts: 3,
      retry_backoff_seconds: 30,
    },
    theme_intent: { topic_seed: 'topic' },
    scene_constraints: {
      community_scope: { mode: 'single', community_id: 'c1' },
      public_stage_scope: ['forum'],
      privacy_policy: 'public_only',
      private_reference_policy: 'forbidden',
      safety_profile: 'standard',
    },
    role_requirements: { requirements: [{ role: 'anchor', weight: 0.7 }] },
  }
}

async function setup() {
  const cueRepo = new InMemoryCueRepository()
  const eventRepo = new InMemoryEventRepository()
  const schedule = await cueRepo.createSchedule(makeScheduleInput())
  const handler = new ScheduleRollbackHandler({
    cueRepo,
    eventRepo,
    now: () => new Date('2026-04-26T20:30:30.000Z'),
  })
  return { cueRepo, eventRepo, schedule, handler }
}

async function seedCue(
  cueRepo: InMemoryCueRepository,
  scheduleId: string,
  status: PublicDiscussionCueStatus,
): Promise<string> {
  const cue = await cueRepo.createCue({
    ...makeCueInput(scheduleId),
    status,
  })
  return cue.id
}

const ACTOR = { actor_type: 'human' as const, actor_id: 'admin-1' }

describe('ScheduleRollbackHandler — pre-execution cancel-cascade', () => {
  it('cancels cues in scheduled / prewarming / due / deferred / draft / validating / validated', async () => {
    const { cueRepo, eventRepo, schedule, handler } = await setup()
    const ids = await Promise.all([
      seedCue(cueRepo, schedule.id, 'draft'),
      seedCue(cueRepo, schedule.id, 'validating'),
      seedCue(cueRepo, schedule.id, 'validated'),
      seedCue(cueRepo, schedule.id, 'scheduled'),
      seedCue(cueRepo, schedule.id, 'prewarming'),
      seedCue(cueRepo, schedule.id, 'due'),
      seedCue(cueRepo, schedule.id, 'deferred'),
    ])
    const outcome = await handler.apply({
      scheduleId: schedule.id,
      affectedCueIds: ids,
      actor: ACTOR,
      reason: 'admin_rollback',
    })
    expect(outcome.cancelled).toEqual(ids)
    expect(outcome.inFlight).toEqual([])
    expect(outcome.noop).toEqual([])
    for (const id of ids) {
      const cue = await cueRepo.findCueById(id)
      expect(cue?.status).toBe('cancelled')
    }
    // Each cancelled cue has a Cancelled event emitted with stable
    // sentinel attempt_id (rollback-<schedule>-<cue>).
    for (const id of ids) {
      const event = eventRepo.findByIdempotencyKey(
        `cue-execution-cancelled:rollback-${schedule.id}-${id}`,
      )
      expect(event?.event_type).toBe(CUE_EXECUTION_CANCELLED)
      expect(event?.payload_json.reason).toBe('admin_rollback')
    }
  })
})

describe('ScheduleRollbackHandler — in-flight run-to-completion', () => {
  it('does NOT cancel cues in claimed or executing; reports them as inFlight', async () => {
    const { cueRepo, eventRepo, schedule, handler } = await setup()
    const claimed = await seedCue(cueRepo, schedule.id, 'claimed')
    const executing = await seedCue(cueRepo, schedule.id, 'executing')
    const outcome = await handler.apply({
      scheduleId: schedule.id,
      affectedCueIds: [claimed, executing],
      actor: ACTOR,
    })
    expect(outcome.cancelled).toEqual([])
    expect(outcome.inFlight).toEqual([claimed, executing])
    expect((await cueRepo.findCueById(claimed))?.status).toBe('claimed')
    expect((await cueRepo.findCueById(executing))?.status).toBe('executing')
    // No events emitted for in-flight rows.
    expect(
      eventRepo.findByIdempotencyKey(
        `cue-execution-cancelled:rollback-${schedule.id}-${claimed}`,
      ),
    ).toBeNull()
    expect(
      eventRepo.findByIdempotencyKey(
        `cue-execution-cancelled:rollback-${schedule.id}-${executing}`,
      ),
    ).toBeNull()
  })
})

describe('ScheduleRollbackHandler — terminal states are noop', () => {
  it('does nothing for cues already in consumed / failed / skipped / cancelled / expired', async () => {
    const { cueRepo, schedule, handler } = await setup()
    const ids = await Promise.all([
      seedCue(cueRepo, schedule.id, 'consumed'),
      seedCue(cueRepo, schedule.id, 'failed'),
      seedCue(cueRepo, schedule.id, 'skipped'),
      seedCue(cueRepo, schedule.id, 'cancelled'),
      seedCue(cueRepo, schedule.id, 'expired'),
    ])
    const outcome = await handler.apply({
      scheduleId: schedule.id,
      affectedCueIds: ids,
      actor: ACTOR,
    })
    expect(outcome.cancelled).toEqual([])
    expect(outcome.noop).toEqual(ids)
    expect(outcome.inFlight).toEqual([])
  })
})

describe('ScheduleRollbackHandler — missing cues', () => {
  it('reports missing ids without throwing', async () => {
    const { schedule, handler } = await setup()
    const outcome = await handler.apply({
      scheduleId: schedule.id,
      affectedCueIds: ['cue_does_not_exist'],
      actor: ACTOR,
    })
    expect(outcome.missing).toEqual(['cue_does_not_exist'])
    expect(outcome.cancelled).toEqual([])
  })
})

describe('ScheduleRollbackHandler — idempotency', () => {
  it('replaying the same rollback returns the same Cancelled event id (idempotency_key)', async () => {
    const { cueRepo, eventRepo, schedule, handler } = await setup()
    const cueId = await seedCue(cueRepo, schedule.id, 'scheduled')
    await handler.apply({
      scheduleId: schedule.id,
      affectedCueIds: [cueId],
      actor: ACTOR,
    })
    const firstEvent = eventRepo.findByIdempotencyKey(
      `cue-execution-cancelled:rollback-${schedule.id}-${cueId}`,
    )
    expect(firstEvent).not.toBeNull()

    // Reset to scheduled to allow a second apply (in real life rollback only
    // runs once; we test the event dedup, not the cue dedup).
    await cueRepo.setCueStatus(cueId, 'scheduled')
    await handler.apply({
      scheduleId: schedule.id,
      affectedCueIds: [cueId],
      actor: ACTOR,
    })
    const secondEvent = eventRepo.findByIdempotencyKey(
      `cue-execution-cancelled:rollback-${schedule.id}-${cueId}`,
    )
    expect(secondEvent?.id).toBe(firstEvent?.id)
  })
})
