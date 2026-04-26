/**
 * T-213 M2 — `LoadSignalService` cache behavior tests.
 *
 * Validates the read-through cache:
 *   - cache hit within TTL → no compute call
 *   - cache miss / stale → compute + persist
 *   - persist failure does not block returning a fresh snapshot
 *   - source tag distinguishes cached vs fresh
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CachedLoadSignalService } from '../load-signal-service.js'
import { InMemoryLoadSnapshotRepository } from '../../repos/load-snapshot-repository.js'
import {
  AdmissionLoadService,
} from '../../programming/load/admission-load-service.js'
import { InMemoryCueRepository } from '../../repos/cue-repository.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import type { LoadSnapshot } from '../../programming/load/types.js'

const COMMUNITY = 'community-load-signal'

function fixedSnapshot(now: Date): LoadSnapshot {
  return {
    community_id: COMMUNITY,
    window_start: now,
    window_end: new Date(now.getTime() + 30 * 60_000),
    freshness: 'live',
    state: 'green',
    global_state: 'green',
    scheduled_cue_count: 0,
    due_cue_count: 0,
    executing_cue_count: 0,
    recent_root_post_count: 0,
    recent_thread_followup_count: 0,
    active_scene_count: 0,
    hot_thread_pressure: null,
    visible_llm_queue_depth: null,
    media_queue_depth: null,
    provider_queue_pressure: null,
    load_score: 0,
    capacity_remaining: 1,
    computed_at: now,
  }
}

describe('LoadSignalService', () => {
  const FIXED_NOW = new Date('2026-04-26T15:00:00Z')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reads through to AdmissionLoadService on first call and persists with freshness=cached', async () => {
    const cueRepo = new InMemoryCueRepository()
    const postRepo = new InMemoryPostRepository()
    const admissionLoadService = new AdmissionLoadService({ cueRepo, postRepo })
    const loadSnapshotRepo = new InMemoryLoadSnapshotRepository()
    const computeSpy = vi.spyOn(admissionLoadService, 'compute')
    const svc = new CachedLoadSignalService({ admissionLoadService, loadSnapshotRepo })

    const result = await svc.get(COMMUNITY)
    expect(result.status).toBe('green')
    expect(result.source).toBe('load_signal_service:cached')
    expect(computeSpy).toHaveBeenCalledOnce()

    const persisted = await loadSnapshotRepo.findLatestForCommunity({
      communityId: COMMUNITY,
      freshness: 'cached',
    })
    expect(persisted).not.toBeNull()
    expect(persisted?.freshness).toBe('cached')
  })

  it('serves a cached snapshot within the TTL without recomputing', async () => {
    const cueRepo = new InMemoryCueRepository()
    const postRepo = new InMemoryPostRepository()
    const admissionLoadService = new AdmissionLoadService({ cueRepo, postRepo })
    const loadSnapshotRepo = new InMemoryLoadSnapshotRepository()

    // Pre-populate a fresh cached row 5s ago
    await loadSnapshotRepo.insert({
      ...fixedSnapshot(new Date(FIXED_NOW.getTime() - 5_000)),
      freshness: 'cached',
      state: 'yellow',
      global_state: 'yellow',
    })

    const computeSpy = vi.spyOn(admissionLoadService, 'compute')
    const svc = new CachedLoadSignalService({
      admissionLoadService,
      loadSnapshotRepo,
      ttlMs: 30_000,
    })

    const result = await svc.get(COMMUNITY)
    expect(result.status).toBe('yellow')
    expect(computeSpy).not.toHaveBeenCalled()
  })

  it('recomputes when cached row is older than TTL', async () => {
    const cueRepo = new InMemoryCueRepository()
    const postRepo = new InMemoryPostRepository()
    const admissionLoadService = new AdmissionLoadService({ cueRepo, postRepo })
    const loadSnapshotRepo = new InMemoryLoadSnapshotRepository()

    // Stale cached row 60s ago
    await loadSnapshotRepo.insert({
      ...fixedSnapshot(new Date(FIXED_NOW.getTime() - 60_000)),
      freshness: 'cached',
      state: 'red',
      global_state: 'red',
    })

    const computeSpy = vi.spyOn(admissionLoadService, 'compute')
    const svc = new CachedLoadSignalService({
      admissionLoadService,
      loadSnapshotRepo,
      ttlMs: 30_000,
    })

    const result = await svc.get(COMMUNITY)
    expect(result.status).toBe('green') // computed live (no activity)
    expect(computeSpy).toHaveBeenCalledOnce()
  })

  it('still returns a fresh snapshot when persist fails', async () => {
    const cueRepo = new InMemoryCueRepository()
    const postRepo = new InMemoryPostRepository()
    const admissionLoadService = new AdmissionLoadService({ cueRepo, postRepo })
    const failingRepo: InMemoryLoadSnapshotRepository =
      new InMemoryLoadSnapshotRepository()
    vi.spyOn(failingRepo, 'insert').mockRejectedValueOnce(
      new Error('db unavailable'),
    )
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {})
    const svc = new CachedLoadSignalService({
      admissionLoadService,
      loadSnapshotRepo: failingRepo,
    })

    const result = await svc.get(COMMUNITY)
    expect(result.status).toBe('green')
    expect(consoleErr).toHaveBeenCalledOnce()
  })

  it('passes triggerAtIso through to the snapshot for audit', async () => {
    const cueRepo = new InMemoryCueRepository()
    const postRepo = new InMemoryPostRepository()
    const admissionLoadService = new AdmissionLoadService({ cueRepo, postRepo })
    const loadSnapshotRepo = new InMemoryLoadSnapshotRepository()
    const svc = new CachedLoadSignalService({ admissionLoadService, loadSnapshotRepo })

    const triggerAt = '2026-04-26T15:30:00Z'
    const result = await svc.get(COMMUNITY, triggerAt)
    expect(result.trigger_at_iso).toBe(triggerAt)
  })
})
