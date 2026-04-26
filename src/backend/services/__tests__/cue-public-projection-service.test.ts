import { describe, expect, it, beforeEach, vi } from 'vitest'
import { CuePublicProjectionService } from '../cue-public-projection-service.js'
import { InMemoryCueRepository } from '../../repos/cue-repository.js'

const NOW = new Date('2026-04-27T20:00:00Z')

async function seedSchedule(repo: InMemoryCueRepository, communityId = 'c1') {
  const sched = await repo.createSchedule({
    scope_type: 'community',
    community_id: communityId,
    date_range_start: new Date(NOW.getTime() - 30 * 86_400_000),
    date_range_end: new Date(NOW.getTime() + 30 * 86_400_000),
    source: 'manual',
    status: 'published',
  })
  return sched.id
}

async function seedCue(
  repo: InMemoryCueRepository,
  input: {
    schedule_id: string
    triggerAt: Date
    status:
      | 'scheduled'
      | 'prewarming'
      | 'due'
      | 'executing'
      | 'consumed'
      | 'cancelled'
      | 'draft'
    community?: string
    lane?: 'prime' | 'standard' | 'background'
  },
) {
  const cue = await repo.createCue({
    schedule_id: input.schedule_id,
    source_type: 'manual',
    community_id: input.community ?? 'c1',
    scope: { mode: 'single', community_id: input.community ?? 'c1' },
    trigger_at: input.triggerAt,
    timezone: 'UTC',
    priority: 50,
    lane: input.lane ?? 'standard',
    dispatch_policy: {
      trigger_at: input.triggerAt.toISOString(),
      timezone: 'UTC',
      dispatch_mode: 'graceful',
      grace_seconds: 30,
      priority: 50,
      lane: input.lane ?? 'standard',
      misfire_policy: 'delay',
      max_attempts: 1,
      retry_backoff_seconds: 60,
    },
    theme_intent: {
      topic_seed: 'INTERNAL_TOPIC_SEED',
      discussion_question: 'INTERNAL_DISCUSSION_QUESTION',
      angle_hint: 'INTERNAL_ANGLE_HINT',
      tone_band: 'sharp',
    },
    scene_constraints: {
      community_scope: { mode: 'single', community_id: input.community ?? 'c1' },
      public_stage_scope: ['forum'],
      privacy_policy: 'public_only',
      private_reference_policy: 'forbidden',
      safety_profile: 'standard',
    },
    role_requirements: { requirements: [{ role: 'anchor', weight: 0.7 }] },
    locked_fields: [],
    risk_level: 'high',
    idempotency_key: `idem-${Math.random()}`,
  })
  if (input.status !== 'draft') {
    await repo.setCueStatus(cue.id, input.status)
  }
  return cue
}

describe('CuePublicProjectionService.assemble', () => {
  let repo: InMemoryCueRepository
  let scheduleId: string
  let service: CuePublicProjectionService

  beforeEach(async () => {
    repo = new InMemoryCueRepository()
    scheduleId = await seedSchedule(repo)
    service = new CuePublicProjectionService({ cueRepo: repo, now: () => NOW })
  })

  it('emits upcoming for scheduled cues within the lookahead window', async () => {
    await seedCue(repo, {
      schedule_id: scheduleId,
      triggerAt: new Date(NOW.getTime() + 30 * 60_000), // 30 min ahead
      status: 'scheduled',
    })
    await seedCue(repo, {
      schedule_id: scheduleId,
      triggerAt: new Date(NOW.getTime() + 7 * 60 * 60_000), // 7h ahead — beyond default 6h window
      status: 'scheduled',
    })

    const facet = await service.assemble({ communityId: 'c1' })
    expect(facet.upcoming).toHaveLength(1)
    expect(facet.upcoming[0]?.status).toBe('upcoming')
    expect(facet.live).toHaveLength(0)
    expect(facet.completed).toHaveLength(0)
  })

  it('does not surface theme intent text on upcoming items (sanitization)', async () => {
    await seedCue(repo, {
      schedule_id: scheduleId,
      triggerAt: new Date(NOW.getTime() + 30 * 60_000),
      status: 'scheduled',
    })
    const facet = await service.assemble({ communityId: 'c1' })
    const serialized = JSON.stringify(facet)
    expect(serialized).not.toContain('INTERNAL_TOPIC_SEED')
    expect(serialized).not.toContain('INTERNAL_DISCUSSION_QUESTION')
    expect(serialized).not.toContain('INTERNAL_ANGLE_HINT')
    // High risk_level on the cue must not leak through.
    expect(serialized).not.toContain('"risk_level"')
  })

  it('emits live for executing cues with attempt_id', async () => {
    const cue = await seedCue(repo, {
      schedule_id: scheduleId,
      triggerAt: new Date(NOW.getTime() + 5 * 60_000),
      status: 'executing',
    })
    await repo.createAttempt({
      cue_id: cue.id,
      attempt_no: 1,
      scheduled_trigger_at: new Date(NOW.getTime() + 5 * 60_000),
      idempotency_key: `attempt:${cue.id}:1`,
      status: 'executing',
      lease_owner: 'worker-1',
    })

    const facet = await service.assemble({ communityId: 'c1' })
    expect(facet.live).toHaveLength(1)
    expect(facet.live[0]?.status).toBe('live')
    expect(facet.live[0]?.attempt_id).toBeTruthy()
  })

  it('emits completed for consumed cues with succeeded attempt post_id', async () => {
    const cue = await seedCue(repo, {
      schedule_id: scheduleId,
      triggerAt: new Date(NOW.getTime() - 30 * 60_000),
      status: 'consumed',
    })
    const attempt = await repo.createAttempt({
      cue_id: cue.id,
      attempt_no: 1,
      scheduled_trigger_at: new Date(NOW.getTime() - 30 * 60_000),
      idempotency_key: `attempt:${cue.id}:1`,
      status: 'succeeded',
      lease_owner: 'worker-1',
    })
    await repo.updateAttempt(attempt.id, {
      post_id: 'post-result-1',
      finished_at: new Date(NOW.getTime() - 25 * 60_000),
      lease_owner: null,
      lease_expires_at: null,
    })

    const facet = await service.assemble({ communityId: 'c1' })
    expect(facet.completed).toHaveLength(1)
    expect(facet.completed[0]?.result_post_id).toBe('post-result-1')
    expect(facet.completed[0]?.completed_at).toBeTruthy()
  })

  it('respects upcomingLimit cap', async () => {
    for (let i = 0; i < 25; i += 1) {
      await seedCue(repo, {
        schedule_id: scheduleId,
        triggerAt: new Date(NOW.getTime() + (i + 1) * 60_000),
        status: 'scheduled',
      })
    }
    const facet = await service.assemble({ communityId: 'c1', upcomingLimit: 5 })
    expect(facet.upcoming.length).toBeLessThanOrEqual(5)
  })

  it('drops cues outside the requested community', async () => {
    const c2ScheduleId = await seedSchedule(repo, 'c2')
    await seedCue(repo, {
      schedule_id: scheduleId,
      triggerAt: new Date(NOW.getTime() + 10 * 60_000),
      status: 'scheduled',
      community: 'c1',
    })
    await seedCue(repo, {
      schedule_id: c2ScheduleId,
      triggerAt: new Date(NOW.getTime() + 10 * 60_000),
      status: 'scheduled',
      community: 'c2',
    })
    const facet = await service.assemble({ communityId: 'c1' })
    expect(facet.upcoming).toHaveLength(1)
    expect(facet.upcoming[0]?.community_id).toBe('c1')
  })
})

describe('CuePublicProjectionService — T-215 B-M3 enrichment', () => {
  let repo: InMemoryCueRepository
  let scheduleId: string

  beforeEach(async () => {
    repo = new InMemoryCueRepository()
    scheduleId = await seedSchedule(repo)
  })

  it('attaches result_url with the configured post base when post_id is present', async () => {
    const cue = await seedCue(repo, {
      schedule_id: scheduleId,
      triggerAt: new Date(NOW.getTime() - 30 * 60_000),
      status: 'consumed',
    })
    const attempt = await repo.createAttempt({
      cue_id: cue.id,
      attempt_no: 1,
      scheduled_trigger_at: new Date(NOW.getTime() - 30 * 60_000),
      idempotency_key: `attempt:${cue.id}:1`,
      status: 'succeeded',
      lease_owner: 'worker-1',
    })
    await repo.updateAttempt(attempt.id, {
      post_id: 'post-99',
      finished_at: new Date(NOW.getTime() - 25 * 60_000),
      lease_owner: null,
      lease_expires_at: null,
    })

    const service = new CuePublicProjectionService({
      cueRepo: repo,
      now: () => NOW,
      postUrlBase: 'https://example.com/posts/',
    })
    const facet = await service.assemble({ communityId: 'c1' })
    expect(facet.completed).toHaveLength(1)
    expect(facet.completed[0]?.result_post_id).toBe('post-99')
    expect(facet.completed[0]?.result_url).toBe('https://example.com/posts/post-99')
    expect(facet.completed[0]?.result_thread_id).toBeNull()
  })

  it('joins ForumSceneMetadata to surface result_thread_id when dep is wired', async () => {
    const cue = await seedCue(repo, {
      schedule_id: scheduleId,
      triggerAt: new Date(NOW.getTime() - 30 * 60_000),
      status: 'consumed',
    })
    const attempt = await repo.createAttempt({
      cue_id: cue.id,
      attempt_no: 1,
      scheduled_trigger_at: new Date(NOW.getTime() - 30 * 60_000),
      idempotency_key: `attempt:${cue.id}:1`,
      status: 'succeeded',
      lease_owner: 'worker-1',
    })
    await repo.updateAttempt(attempt.id, {
      post_id: 'post-thread-1',
      finished_at: new Date(NOW.getTime() - 25 * 60_000),
      lease_owner: null,
      lease_expires_at: null,
    })

    const sceneMetadataRepo = {
      async findByPostId(postId: string) {
        return postId === 'post-thread-1'
          ? ({
              id: 'fsm-1',
              target_type: 'POST' as const,
              community_id: 'c1',
              post_id: 'post-thread-1',
              thread_id: 'thread-XYZ',
              turn_id: null,
              episode_id: 'episode-1',
              selection_id: 'selection-1',
              episode_plan_id: 'plan-1',
              local_intent_id: 'intent-1',
              director_surface: 'scheduled_post',
              actor_surface: 'forum_post',
              scene_template_id: 'tmpl',
              scene_template_version: 'v1',
              scene_binding_id: null,
              overlay_id: null,
              beat_id: null,
              phase: 'opening' as const,
              selection_mode: 'pool_guided' as const,
              expires_at: null,
              payload_json: {},
              programming_production_path: 'cue' as const,
              programming_cue_id: cue.id,
              programming_attempt_id: attempt.id,
              programming_schedule_id: scheduleId,
              programming_source_type: 'manual',
              created_at: new Date(),
              updated_at: new Date(),
            })
          : null
      },
    }

    const service = new CuePublicProjectionService({
      cueRepo: repo,
      forumSceneMetadataRepo: sceneMetadataRepo,
      now: () => NOW,
    })
    const facet = await service.assemble({ communityId: 'c1' })
    expect(facet.completed[0]?.result_thread_id).toBe('thread-XYZ')
  })

  it('isolates ForumSceneMetadata join failure — facet still emits with thread_id=null', async () => {
    const cue = await seedCue(repo, {
      schedule_id: scheduleId,
      triggerAt: new Date(NOW.getTime() - 30 * 60_000),
      status: 'consumed',
    })
    const attempt = await repo.createAttempt({
      cue_id: cue.id,
      attempt_no: 1,
      scheduled_trigger_at: new Date(NOW.getTime() - 30 * 60_000),
      idempotency_key: `attempt:${cue.id}:1`,
      status: 'succeeded',
      lease_owner: 'worker-1',
    })
    await repo.updateAttempt(attempt.id, {
      post_id: 'post-X',
      finished_at: new Date(NOW.getTime() - 25 * 60_000),
      lease_owner: null,
      lease_expires_at: null,
    })

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sceneMetadataRepo = {
      async findByPostId() {
        throw new Error('join boom')
      },
    }
    const service = new CuePublicProjectionService({
      cueRepo: repo,
      forumSceneMetadataRepo: sceneMetadataRepo,
      now: () => NOW,
      postUrlBase: '/posts/',
    })
    const facet = await service.assemble({ communityId: 'c1' })
    expect(facet.completed[0]?.result_post_id).toBe('post-X')
    expect(facet.completed[0]?.result_url).toBe('/posts/post-X')
    expect(facet.completed[0]?.result_thread_id).toBeNull()
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})
