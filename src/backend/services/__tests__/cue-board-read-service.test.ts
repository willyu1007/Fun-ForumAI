import { describe, it, expect, beforeEach } from 'vitest'
import { CueBoardReadService } from '../cue-board-read-service.js'
import { InMemoryCueRepository } from '../../repos/cue-repository.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { BaselineCueImporter } from '../../programming/cue/baseline-cue-importer.js'

describe('CueBoardReadService', () => {
  let repo: InMemoryCueRepository
  let svc: CueBoardReadService

  beforeEach(() => {
    repo = new InMemoryCueRepository()
    svc = new CueBoardReadService(repo)
  })

  it('returns null schedule + empty cues when nothing exists', async () => {
    const payload = await svc.getBoardPayload()
    expect(payload.schedule).toBeNull()
    expect(payload.cues).toEqual([])
    expect(payload.load_state_per_community).toBeNull()
    expect(typeof payload.generated_at).toBe('string')
  })

  it('resolves the most recent schedule when no active one exists', async () => {
    const schedule = await repo.createSchedule({
      scope_type: 'global',
      date_range_start: new Date('2026-04-25T00:00:00+08:00'),
      date_range_end: new Date('2026-04-26T00:00:00+08:00'),
      source: 'baseline',
    })
    const payload = await svc.getBoardPayload()
    expect(payload.schedule?.id).toBe(schedule.id)
    expect(payload.cues).toEqual([])
  })

  it('prefers an active schedule over a draft', async () => {
    const draft = await repo.createSchedule({
      scope_type: 'global',
      date_range_start: new Date('2026-04-25T00:00:00+08:00'),
      date_range_end: new Date('2026-04-26T00:00:00+08:00'),
      source: 'baseline',
    })
    const active = await repo.createSchedule({
      scope_type: 'global',
      date_range_start: new Date('2026-04-25T00:00:00+08:00'),
      date_range_end: new Date('2026-04-26T00:00:00+08:00'),
      source: 'manual',
      status: 'draft',
    })
    await repo.updateScheduleStatus(active.id, 'active')

    const payload = await svc.getBoardPayload()
    expect(payload.schedule?.id).toBe(active.id)
    expect(payload.schedule?.status).toBe('active')
    expect(draft.id).not.toBe(active.id)
  })

  it('returns the cues of the resolved schedule with derived summaries', async () => {
    // Use the importer so we have realistic cue shapes against the actual YAML.
    const importer = new BaselineCueImporter({ repo })
    const result = await importer.run({
      now: new Date('2026-04-25T12:00:00+08:00'),
    })

    const payload = await svc.getBoardPayload()
    expect(payload.schedule?.id).toBe(result.schedule.id)
    expect(payload.cues.length).toBe(result.cues.length)
    for (const item of payload.cues) {
      expect(item.theme_intent_summary.length).toBeGreaterThan(0)
      expect(item.role_requirement_summary).toMatch(/×/) // contains the weight separator
      expect(item.scene_family_preview.length).toBeLessThanOrEqual(3)
      expect(typeof item.media_count).toBe('number')
      expect(item.locked_fields_count).toBe(0) // baseline draft has no locked fields
    }
  })

  it('honors community_id filter on listUpcomingCues', async () => {
    const schedule = await repo.createSchedule({
      scope_type: 'global',
      date_range_start: new Date('2026-04-25T00:00:00+08:00'),
      date_range_end: new Date('2026-04-26T00:00:00+08:00'),
      source: 'manual',
    })
    await repo.updateScheduleStatus(schedule.id, 'active')

    const baseInput = {
      schedule_id: schedule.id,
      source_type: 'manual' as const,
      scope: { mode: 'single' as const, community_id: 'c1' },
      trigger_at: new Date('2026-04-25T20:30:00+08:00'),
      dispatch_policy: {
        trigger_at: '2026-04-25T20:30:00+08:00',
        timezone: 'Asia/Shanghai',
        dispatch_mode: 'graceful' as const,
        grace_seconds: 60,
        priority: 60,
        lane: 'standard' as const,
        misfire_policy: 'delay' as const,
        max_attempts: 3,
        retry_backoff_seconds: 30,
      },
      theme_intent: { topic_seed: 'hello' },
      scene_constraints: {
        community_scope: { mode: 'single' as const, community_id: 'c1' },
        public_stage_scope: ['forum' as const],
        privacy_policy: 'public_only' as const,
        private_reference_policy: 'forbidden' as const,
        safety_profile: 'standard' as const,
      },
      role_requirements: {
        requirements: [{ role: 'anchor' as const, weight: 0.7 }],
      },
    }

    await repo.createCue({ ...baseInput, community_id: 'c1' })
    await repo.createCue({ ...baseInput, community_id: 'c2' })

    const c1Only = await svc.getBoardPayload({ community_id: 'c1' })
    expect(c1Only.cues).toHaveLength(1)
    expect(c1Only.cues[0]!.community_id).toBe('c1')
  })

  // T-213 M4 — heatmap payload populated when a load signal source is wired.
  it('populates load_state_per_community when loadSignalService is injected', async () => {
    const schedule = await repo.createSchedule({
      scope_type: 'global',
      date_range_start: new Date('2026-04-25T00:00:00+08:00'),
      date_range_end: new Date('2026-04-26T00:00:00+08:00'),
      source: 'manual',
    })
    await repo.updateScheduleStatus(schedule.id, 'active')

    const baseInput = {
      schedule_id: schedule.id,
      source_type: 'manual' as const,
      scope: { mode: 'single' as const, community_id: 'c1' },
      trigger_at: new Date(Date.now() + 5 * 60_000),
      dispatch_policy: {
        trigger_at: new Date(Date.now() + 5 * 60_000).toISOString(),
        timezone: 'Asia/Shanghai',
        dispatch_mode: 'graceful' as const,
        grace_seconds: 60,
        priority: 60,
        lane: 'standard' as const,
        misfire_policy: 'delay' as const,
        max_attempts: 3,
        retry_backoff_seconds: 30,
      },
      theme_intent: { topic_seed: 'hello' },
      scene_constraints: {
        community_scope: { mode: 'single' as const, community_id: 'c1' },
        public_stage_scope: ['forum' as const],
        privacy_policy: 'public_only' as const,
        private_reference_policy: 'forbidden' as const,
        safety_profile: 'standard' as const,
      },
      role_requirements: {
        requirements: [{ role: 'anchor' as const, weight: 0.7 }],
      },
    }
    await repo.createCue({ ...baseInput, community_id: 'c1' })
    await repo.createCue({
      ...baseInput,
      community_id: 'c2',
      scope: { mode: 'single' as const, community_id: 'c2' },
    })

    const loadSvc = {
      get: async (
        communityId: string,
      ) => ({
        status: communityId === 'c1' ? ('yellow' as const) : ('green' as const),
        community_id: communityId,
        trigger_at_iso: null,
        source: 'load_signal_service:cached' as const,
      }),
    }
    const postRepo = new InMemoryPostRepository()
    const heatmapSvc = new CueBoardReadService(repo, {
      loadSignalService: loadSvc,
      postRepo,
    })
    const payload = await heatmapSvc.getBoardPayload()
    expect(payload.load_state_per_community).not.toBeNull()
    expect(payload.load_state_per_community).toHaveLength(2)
    const byId = new Map(
      (payload.load_state_per_community ?? []).map((entry) => [entry.community_id, entry]),
    )
    expect(byId.get('c1')?.load_state).toBe('yellow')
    expect(byId.get('c2')?.load_state).toBe('green')
    expect(byId.get('c1')?.scheduled_cue_count_30m).toBeGreaterThanOrEqual(0)
    expect(byId.get('c1')?.predicted_autonomous_count_30m).toBe(0) // empty post repo
  })

  // T-213 M4 — autonomous-vs-cue split correctness (invariant I-7).
  it('predicted_autonomous_count_30m subtracts cue-path consumed cues from total root posts', async () => {
    const schedule = await repo.createSchedule({
      scope_type: 'global',
      date_range_start: new Date('2026-04-26T00:00:00Z'),
      date_range_end: new Date('2026-04-27T00:00:00Z'),
      source: 'manual',
    })
    await repo.updateScheduleStatus(schedule.id, 'active')

    // Create one cue in `consumed` status with triggerAt in last 20 min — this
    // represents a cue-path post; should NOT be counted as autonomous.
    const recent = new Date(Date.now() - 5 * 60_000)
    const cue = await repo.createCue({
      schedule_id: schedule.id,
      source_type: 'manual',
      community_id: 'c1',
      scope: { mode: 'single' as const, community_id: 'c1' },
      trigger_at: recent,
      status: 'scheduled',
      dispatch_policy: {
        trigger_at: recent.toISOString(),
        timezone: 'UTC',
        dispatch_mode: 'graceful' as const,
        grace_seconds: 60,
        priority: 50,
        lane: 'standard' as const,
        misfire_policy: 'delay' as const,
        max_attempts: 3,
        retry_backoff_seconds: 30,
      },
      theme_intent: { topic_seed: 't' },
      scene_constraints: {
        community_scope: { mode: 'single' as const, community_id: 'c1' },
        public_stage_scope: ['forum' as const],
        privacy_policy: 'public_only' as const,
        private_reference_policy: 'forbidden' as const,
        safety_profile: 'standard' as const,
      },
      role_requirements: { requirements: [{ role: 'anchor' as const, weight: 0.7 }] },
    })
    await repo.setCueStatus(cue.id, 'consumed')

    // Seed 5 root posts in last 20 min (mix of cue-path + autonomous-path).
    const postRepo = new InMemoryPostRepository()
    for (let i = 0; i < 5; i++) {
      const created = await postRepo.create({
        community_id: 'c1',
        author_agent_id: `agent-${i}`,
        title: `post ${i}`,
        body: 'b',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      await postRepo.updateTimestamps(created.id, {
        created_at: new Date(Date.now() - i * 60_000),
      })
    }

    const loadSvc = {
      get: async (communityId: string) => ({
        status: 'green' as const,
        community_id: communityId,
        trigger_at_iso: null,
        source: 'load_signal_service:cached' as const,
      }),
    }
    const heatmapSvc = new CueBoardReadService(repo, {
      loadSignalService: loadSvc,
      postRepo,
    })
    const payload = await heatmapSvc.getBoardPayload()
    const entry = (payload.load_state_per_community ?? []).find(
      (e) => e.community_id === 'c1',
    )
    expect(entry).toBeDefined()
    // 5 total root posts - 1 cue-path consumed = 4 autonomous; ×1.5 forecast = 6.
    expect(entry?.predicted_autonomous_count_30m).toBe(6)
  })

  it('returns load_state_per_community=null when no loadSignalService is wired', async () => {
    const schedule = await repo.createSchedule({
      scope_type: 'global',
      date_range_start: new Date('2026-04-25T00:00:00+08:00'),
      date_range_end: new Date('2026-04-26T00:00:00+08:00'),
      source: 'manual',
    })
    await repo.updateScheduleStatus(schedule.id, 'active')
    const payload = await svc.getBoardPayload()
    expect(payload.load_state_per_community).toBeNull()
  })
})
