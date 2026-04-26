/**
 * T-213 M1 — `AdmissionLoadService` unit tests.
 *
 * Exercises the live snapshot path against `InMemoryCueRepository` +
 * `InMemoryPostRepository`. Validates:
 *   - parallel counter wiring (correct status sets, correct windows)
 *   - state derivation (green / yellow / red transitions, multi-warn → red)
 *   - injected queue-depth signals propagate through to the snapshot
 *   - global_state defaults to community state when no override provided
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AdmissionLoadService,
  DEFAULT_LOAD_THRESHOLDS,
} from '../admission-load-service.js'
import {
  InMemoryCueRepository,
  type CueRepository,
} from '../../../repos/cue-repository.js'
import {
  InMemoryPostRepository,
  type PostRepository,
} from '../../../repos/post-repository.js'

const COMMUNITY = 'community-load-test'
const OTHER_COMMUNITY = 'community-other'

async function seedCue(
  repo: CueRepository,
  scheduleId: string,
  partial: {
    status: 'scheduled' | 'due' | 'executing' | 'consumed' | 'prewarming'
    triggerAt: Date
    communityId?: string
  },
): Promise<string> {
  const created = await repo.createCue({
    schedule_id: scheduleId,
    scope: { mode: 'single', community_id: partial.communityId ?? COMMUNITY },
    community_id: partial.communityId ?? COMMUNITY,
    source_type: 'manual',
    trigger_at: partial.triggerAt,
    timezone: 'Asia/Shanghai',
    priority: 50,
    lane: 'standard',
    dispatch_policy: {
      mode: 'fixed',
      lane: 'standard',
      priority: 50,
      misfire_policy: 'skip',
      max_attempts: 3,
      retry_backoff_seconds: 30,
    },
    risk_level: 'standard',
  })
  // createCue defaults to `status='draft'`; promote to the requested status
  // unconditionally so the test's intent is reflected in the row.
  await repo.setCueStatus(created.id, partial.status)
  return created.id
}

async function seedAttempt(
  repo: CueRepository,
  cueId: string,
  status:
    | 'leased'
    | 'admitted'
    | 'allocating'
    | 'compiling'
    | 'executing'
    | 'succeeded',
  attemptNo: number,
): Promise<void> {
  const now = new Date()
  await repo.createAttempt({
    cue_id: cueId,
    attempt_no: attemptNo,
    scheduled_trigger_at: now,
    lease_owner: 'test-worker',
    lease_expires_at: new Date(now.getTime() + 60_000),
    status: status === 'leased' ? undefined : status,
  })
}

async function seedPost(
  repo: PostRepository,
  communityId: string,
  createdAt: Date,
): Promise<void> {
  const created = await repo.create({
    community_id: communityId,
    author_agent_id: `agent-${Math.random().toString(36).slice(2, 8)}`,
    title: null,
    body: 'load test post',
    visibility: 'PUBLIC',
    state: 'APPROVED',
  })
  await repo.updateTimestamps(created.id, { created_at: createdAt })
}

describe('AdmissionLoadService', () => {
  const FIXED_NOW = new Date('2026-04-26T12:00:00Z')
  let cueRepo: CueRepository
  let postRepo: PostRepository
  let scheduleId: string

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
    cueRepo = new InMemoryCueRepository()
    postRepo = new InMemoryPostRepository()
    const schedule = await cueRepo.createSchedule({
      scope_type: 'community',
      community_id: COMMUNITY,
      date_range_start: new Date('2026-04-26T00:00:00Z'),
      date_range_end: new Date('2026-04-27T00:00:00Z'),
      source: 'manual',
    })
    scheduleId = schedule.id
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns green snapshot when there is no activity', async () => {
    const svc = new AdmissionLoadService({ cueRepo, postRepo })
    const snap = await svc.compute(COMMUNITY)
    expect(snap.state).toBe('green')
    expect(snap.global_state).toBe('green')
    expect(snap.scheduled_cue_count).toBe(0)
    expect(snap.due_cue_count).toBe(0)
    expect(snap.executing_cue_count).toBe(0)
    expect(snap.recent_root_post_count).toBe(0)
    expect(snap.freshness).toBe('live')
    expect(snap.community_id).toBe(COMMUNITY)
    expect(snap.window_start).toEqual(FIXED_NOW)
    expect(snap.window_end).toEqual(
      new Date(FIXED_NOW.getTime() + 30 * 60_000),
    )
  })

  it('counts only the target community (no cross-community leakage)', async () => {
    const otherSchedule = await cueRepo.createSchedule({
      scope_type: 'community',
      community_id: OTHER_COMMUNITY,
      date_range_start: new Date('2026-04-26T00:00:00Z'),
      date_range_end: new Date('2026-04-27T00:00:00Z'),
      source: 'manual',
    })
    await seedCue(cueRepo, scheduleId, {
      status: 'scheduled',
      triggerAt: new Date(FIXED_NOW.getTime() + 5 * 60_000),
    })
    await seedCue(cueRepo, otherSchedule.id, {
      status: 'scheduled',
      triggerAt: new Date(FIXED_NOW.getTime() + 5 * 60_000),
      communityId: OTHER_COMMUNITY,
    })
    const svc = new AdmissionLoadService({ cueRepo, postRepo })
    const snap = await svc.compute(COMMUNITY)
    expect(snap.scheduled_cue_count).toBe(1)
  })

  it('only counts scheduled cues whose trigger_at falls in the next 30 minutes', async () => {
    await seedCue(cueRepo, scheduleId, {
      status: 'scheduled',
      triggerAt: new Date(FIXED_NOW.getTime() + 10 * 60_000),
    })
    // Out of window — 60 minutes ahead
    await seedCue(cueRepo, scheduleId, {
      status: 'scheduled',
      triggerAt: new Date(FIXED_NOW.getTime() + 60 * 60_000),
    })
    const svc = new AdmissionLoadService({ cueRepo, postRepo })
    const snap = await svc.compute(COMMUNITY)
    expect(snap.scheduled_cue_count).toBe(1)
  })

  it('counts attempts in executing/claimed status against executing_cue_count', async () => {
    const cueA = await seedCue(cueRepo, scheduleId, {
      status: 'executing',
      triggerAt: new Date(FIXED_NOW.getTime() - 5 * 60_000),
    })
    await seedAttempt(cueRepo, cueA, 'executing', 1)
    const cueB = await seedCue(cueRepo, scheduleId, {
      status: 'consumed',
      triggerAt: new Date(FIXED_NOW.getTime() - 10 * 60_000),
    })
    await seedAttempt(cueRepo, cueB, 'succeeded', 1)
    const svc = new AdmissionLoadService({ cueRepo, postRepo })
    const snap = await svc.compute(COMMUNITY)
    expect(snap.executing_cue_count).toBe(1)
  })

  it('only counts root posts in the last 20 minutes', async () => {
    await seedPost(postRepo, COMMUNITY, new Date(FIXED_NOW.getTime() - 5 * 60_000))
    await seedPost(postRepo, COMMUNITY, new Date(FIXED_NOW.getTime() - 25 * 60_000))
    await seedPost(postRepo, OTHER_COMMUNITY, new Date(FIXED_NOW.getTime() - 1 * 60_000))
    const svc = new AdmissionLoadService({ cueRepo, postRepo })
    const snap = await svc.compute(COMMUNITY)
    expect(snap.recent_root_post_count).toBe(1)
  })

  it('escalates to yellow when one signal crosses warn', async () => {
    // recent_root_post_count_20m warn = 6
    for (let i = 0; i < 6; i++) {
      await seedPost(postRepo, COMMUNITY, new Date(FIXED_NOW.getTime() - i * 60_000))
    }
    const svc = new AdmissionLoadService({ cueRepo, postRepo })
    const snap = await svc.compute(COMMUNITY)
    expect(snap.state).toBe('yellow')
    expect(snap.recent_root_post_count).toBe(6)
  })

  it('escalates to red when two signals cross warn (defense in depth)', async () => {
    // recent_root_post_count warn (6) AND scheduled_cue_count warn (8)
    for (let i = 0; i < 6; i++) {
      await seedPost(postRepo, COMMUNITY, new Date(FIXED_NOW.getTime() - i * 60_000))
    }
    for (let i = 0; i < 8; i++) {
      await seedCue(cueRepo, scheduleId, {
        status: 'scheduled',
        triggerAt: new Date(FIXED_NOW.getTime() + (i + 1) * 60_000),
      })
    }
    const svc = new AdmissionLoadService({ cueRepo, postRepo })
    const snap = await svc.compute(COMMUNITY)
    expect(snap.state).toBe('red')
  })

  it('escalates to red when any signal crosses critical (single signal sufficient)', async () => {
    // recent_root_post_count critical = 12
    for (let i = 0; i < 12; i++) {
      await seedPost(postRepo, COMMUNITY, new Date(FIXED_NOW.getTime() - i * 60_000))
    }
    const svc = new AdmissionLoadService({ cueRepo, postRepo })
    const snap = await svc.compute(COMMUNITY)
    expect(snap.state).toBe('red')
  })

  it('honors injected queue-depth signals (LLM critical → red)', async () => {
    const svc = new AdmissionLoadService({
      cueRepo,
      postRepo,
      queueDepthReader: {
        visibleLlmQueueDepth: () =>
          DEFAULT_LOAD_THRESHOLDS.visibleLlmQueueDepth.critical,
      },
    })
    const snap = await svc.compute(COMMUNITY)
    expect(snap.state).toBe('red')
    expect(snap.visible_llm_queue_depth).toBe(
      DEFAULT_LOAD_THRESHOLDS.visibleLlmQueueDepth.critical,
    )
  })

  it('global_state mirrors community state when no override', async () => {
    const svc = new AdmissionLoadService({ cueRepo, postRepo })
    const snap = await svc.compute(COMMUNITY)
    expect(snap.global_state).toBe(snap.state)
  })

  it('global_state honors the injected provider', async () => {
    const svc = new AdmissionLoadService({
      cueRepo,
      postRepo,
      queueDepthReader: { globalState: () => 'red' },
    })
    const snap = await svc.compute(COMMUNITY)
    expect(snap.state).toBe('green')
    expect(snap.global_state).toBe('red')
  })

  it('load_score reflects the worst cue-side signal ratio', async () => {
    // Push recent_root_post_count to half its warn threshold (6/2 = 3)
    for (let i = 0; i < 3; i++) {
      await seedPost(postRepo, COMMUNITY, new Date(FIXED_NOW.getTime() - i * 60_000))
    }
    const svc = new AdmissionLoadService({ cueRepo, postRepo })
    const snap = await svc.compute(COMMUNITY)
    expect(snap.load_score).toBeCloseTo(0.5, 2)
    expect(snap.capacity_remaining).toBeCloseTo(0.5, 2)
  })
})
