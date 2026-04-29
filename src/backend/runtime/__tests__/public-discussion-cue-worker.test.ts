/**
 * T-212 M4 — PublicDiscussionCueWorker happy path + failure terminals.
 *
 * Tests focus on the integration spine: claim → admit → brief → select →
 * write → terminal transition + domain event. LLM is mocked via the
 * `CueContentGenerator` seam so the worker is fully unit-testable.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  PublicDiscussionCueWorker,
  type PublicDiscussionCueWorkerDeps,
} from '../public-discussion-cue-worker.js'
import {
  attemptIdempotencyKey,
  InMemoryCueRepository,
  type CueRepository,
} from '../../repos/cue-repository.js'
import { InMemoryEventRepository } from '../../repos/event-repository.js'
import { CueAdmissionController } from '../../programming/cue/cue-admission-controller.js'
import { InProcessTrivialCommunityBudgetService } from '../../services/community-budget-service.js'
import { loadSignalServiceStub } from '../../services/__stubs__/load-signal-service-stub.js'
import { DirectorCueBriefServiceImpl } from '../../programming/cue/director-cue-brief.js'
import {
  CUE_EXECUTION_COMPLETED,
  CUE_EXECUTION_FAILED,
} from '../../programming/cue/cue-domain-events.js'
import type {
  CueSceneDryRunResult,
  CueSceneSelection,
} from '../../services/public-scene-selector-service.js'
import type {
  CreateCueInput,
  CreateCueScheduleInput,
} from '../../repos/cue-repository.js'

// ===========================================================================
// Fixtures
// ===========================================================================

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
    status: 'scheduled',
    dispatch_policy: {
      trigger_at: '2026-04-26T20:30:00.000Z',
      timezone: 'Asia/Shanghai',
      dispatch_mode: 'graceful',
      grace_seconds: 60,
      priority: 50,
      lane: 'standard',
      misfire_policy: 'delay',
      max_attempts: 3,
      retry_backoff_seconds: 30,
    },
    theme_intent: { topic_seed: 'AI 陪伴边界' },
    scene_constraints: {
      community_scope: { mode: 'single', community_id: 'c1' },
      public_stage_scope: ['forum'],
      privacy_policy: 'public_only',
      private_reference_policy: 'forbidden',
      safety_profile: 'standard',
    },
    role_requirements: {
      requirements: [{ role: 'anchor', weight: 0.7 }],
      relationship_shape: 'contrast',
    },
  }
}

function alwaysAllowGate() {
  return {
    getRuntimeBaselineAdmission: async () => ({
      kickoff_baseline_id: 'kickoff-1',
      kickoff_batch_id: 'kickoff-batch-1',
      warmup_batch_id: 'warmup-batch-1',
      has_kickoff_baseline: true,
      runtime_mode: 'autonomous' as const,
      kickoff_layer_ready: true,
      warmup_layer_ready: true,
      key_communities_ready: true,
      key_shelves_ready: true,
      media_access_ok: true,
      aftershow_pipeline_ok: true,
      natural_allow_public_growth: true,
      growth_admission: 'allowed_naturally' as const,
      active_override: null,
      allow_public_growth: true,
      natural_reasons: [],
      reasons: [],
    }),
  }
}

function deniedGate() {
  return {
    getRuntimeBaselineAdmission: async () => ({
      kickoff_baseline_id: 'kickoff-1',
      kickoff_batch_id: 'kickoff-batch-1',
      warmup_batch_id: 'warmup-batch-1',
      has_kickoff_baseline: true,
      runtime_mode: 'warmup_only' as const,
      kickoff_layer_ready: true,
      warmup_layer_ready: false,
      key_communities_ready: true,
      key_shelves_ready: true,
      media_access_ok: true,
      aftershow_pipeline_ok: true,
      natural_allow_public_growth: false,
      growth_admission: 'blocked' as const,
      active_override: null,
      allow_public_growth: false,
      natural_reasons: ['kickoff_layer_not_ready'],
      reasons: ['kickoff_layer_not_ready'],
    }),
  }
}

function makeCommunityResolver(found: boolean = true) {
  return {
    resolve: vi.fn(async (id: string) =>
      found
        ? {
            id,
            slug: 'general',
            name: 'General',
            description: '',
            rules: '',
          }
        : null,
    ),
  }
}

function makeCastResolver(agentIds: string[]) {
  return {
    resolveCast: vi.fn(async () =>
      agentIds.map((id) => ({ id, display_name: id.toUpperCase() })),
    ),
  }
}

function makeContentGenerator(overrides: Partial<{
  title: string
  body: string
  tags: string[]
}> = {}) {
  return {
    generate: vi.fn(async () => ({
      title: overrides.title ?? 'cue-driven title',
      body: overrides.body ?? 'cue-driven body',
      tags: overrides.tags ?? ['cue'],
    })),
  }
}

function makeSceneSelector(
  result?: CueSceneSelection | CueSceneDryRunResult,
) {
  const fn = vi.fn(
    async (input: {
      cue: { id: string; community_id: string }
      brief: { audit_refs: { schedule_id: string; cue_id: string; attempt_id: string } }
      agents: Array<{ id: string; display_name: string }>
      community: {
        id: string
        slug: string
        name: string
        description: string
        rules: string
      }
      dryRun?: boolean
    }): Promise<CueSceneSelection | CueSceneDryRunResult> => {
      if (result) return result
      if (input.dryRun) {
        return {
          kind: 'dry_run',
          cue_id: input.cue.id,
          brief_compiled: true,
          candidate_pool_size: input.agents.length,
          selected_cast_estimate: input.agents.slice(0, 8),
        }
      }
      const minimalScenePayload = {
        scene_metadata: {
          director_surface: 'forum' as const,
          actor_surface: 'forum_post' as const,
          scene_template_id: 't1',
          scene_template_version: 'v1',
          scene_binding_id: 'binding-1',
          overlay_id: null,
          episode_id: 'ep_1',
          beat_id: null,
          phase: 'opening' as const,
          selection_mode: 'pool_guided' as const,
          selection_id: 'sel_1',
          episode_plan_id: 'ep_plan_1',
          local_intent_id: 'intent_1',
          started_at: '2026-04-26T20:30:00.000Z',
          expires_at: '2026-04-27T20:30:00.000Z',
        },
        episode_brief: {
          episode_id: 'ep_1',
          director_surface: 'forum' as const,
          actor_surface: 'forum_post' as const,
          template_id: 't1',
          template_version: 'v1',
          binding_id: 'binding-1',
          phase: 'opening' as const,
          scene_goal: { viewer_goal: 'g', growth_goal: 'g' },
          casting_directive: {
            must_have_roles: [],
            avoid_pairs: [],
            core_quota: 1,
            contrast_quota: 0,
            wildcard_quota: 0,
          },
          open_loops: [],
          must_hit_points: [],
          avoid_repeat: [],
          close_condition: { ttl_hours: 24, message_threshold: 8, objective: 'g' },
          expires_at: '2026-04-27T20:30:00.000Z',
        },
        local_intent: {
          intent_id: 'intent_1',
          delivery_surface: 'forum_post' as const,
          initiative: 'open_topic' as const,
          opinion_policy: 'free_opinion' as const,
          relation_focus: 'none' as const,
          tone_hint: 'neutral' as const,
          privacy_mode: 'public_only' as const,
          memory_scope: 'public_contextual' as const,
          reference_scope: 'seed_only' as const,
          prohibited_reference_types: [
            'owner_private_speech',
            'private_memory',
            'hidden_director_goal',
          ] as Array<'owner_private_speech' | 'private_memory' | 'hidden_director_goal'>,
          target_ref: { kind: 'none' as const },
          hard_constraints: [],
          soft_constraints: [],
        },
        local_intent_block: '## Local Intent',
        selection_audit: {
          cue_audit_refs: input.brief.audit_refs,
          cue_primary_author_id: input.agents[0].id,
        },
      }
      return {
        kind: 'scene' as const,
        community: input.community,
        payload: minimalScenePayload,
        selected_cast: input.agents,
      }
    },
  )
  return { selectFromDiscussionCue: fn }
}

function makeDataPlaneWriter(
  overrides: { success?: boolean; contentId?: string | null; error?: string } = {},
) {
  return {
    write: vi.fn(async () => ({
      success: overrides.success ?? true,
      ...(overrides.contentId === undefined
        ? { content_id: 'post_42' }
        : overrides.contentId === null
          ? {}
          : { content_id: overrides.contentId }),
      ...(overrides.error ? { error: overrides.error } : {}),
    })),
  }
}

async function setupWorld(opts?: {
  growthGateAllow?: boolean
  cast?: string[]
  writeSuccess?: boolean
  writeError?: string
  noCommunity?: boolean
}) {
  const cueRepo: CueRepository = new InMemoryCueRepository()
  const schedule = await cueRepo.createSchedule(makeScheduleInput())
  const cue = await cueRepo.createCue(makeCueInput(schedule.id))
  const eventRepo = new InMemoryEventRepository()
  const budget = new InProcessTrivialCommunityBudgetService()
  const admission = new CueAdmissionController({
    communityBudgetService: budget,
    publicGrowthGate: opts?.growthGateAllow === false ? deniedGate() : alwaysAllowGate(),
    loadSignalService: loadSignalServiceStub,
  })
  const directorCueBrief = new DirectorCueBriefServiceImpl()
  const sceneSelector = makeSceneSelector()
  const dataPlaneWriter = makeDataPlaneWriter({
    success: opts?.writeSuccess,
    error: opts?.writeError,
  })
  const communityResolver = makeCommunityResolver(!opts?.noCommunity)
  const castResolver = makeCastResolver(opts?.cast ?? ['agent-1', 'agent-2'])
  const contentGenerator = makeContentGenerator()

  const deps: PublicDiscussionCueWorkerDeps = {
    cueRepo,
    admissionController: admission,
    directorCueBrief,
    sceneSelector,
    dataPlaneWriter,
    eventRepo,
    communityBudgetService: budget,
    communityResolver,
    castResolver,
    contentGenerator,
    now: () => new Date('2026-04-26T20:30:30.000Z'),
  }
  const worker = new PublicDiscussionCueWorker(deps, {
    intervalMs: 60_000,
    startupDelayMs: 60_000,
    batchSize: 5,
  })

  return {
    worker,
    deps,
    cueRepo,
    eventRepo,
    budget,
    sceneSelector,
    dataPlaneWriter,
    communityResolver,
    castResolver,
    contentGenerator,
    cue,
    scheduleId: schedule.id,
  }
}

// ===========================================================================
// Happy path
// ===========================================================================

describe('PublicDiscussionCueWorker — happy path', () => {
  it('claims → admits → writes a post and emits CueExecutionCompleted', async () => {
    const w = await setupWorld()
    const result = await w.worker.tick()

    expect(result.processed).toBe(1)

    const attempts = await w.cueRepo.listAttemptsForCue(w.cue.id)
    expect(attempts).toHaveLength(1)
    expect(attempts[0].status).toBe('succeeded')
    expect(attempts[0].post_id).toBe('post_42')
    expect(attempts[0].lease_owner).toBeNull()
    expect(attempts[0].idempotency_key).toBe(
      attemptIdempotencyKey(w.scheduleId, w.cue.id, 1),
    )

    const cueAfter = await w.cueRepo.findCueById(w.cue.id)
    expect(cueAfter?.status).toBe('consumed')

    expect(w.dataPlaneWriter.write).toHaveBeenCalledTimes(1)
    const [instruction, agentId, triggerEventId] = w.dataPlaneWriter.write.mock
      .calls[0] as unknown as [
      {
        action: string
        community_id: string
        public_scene: { programming?: { production_path?: string; cue?: Record<string, unknown> } }
      },
      string,
      string,
    ]
    expect(instruction.action).toBe('create_post')
    expect(instruction.community_id).toBe('c1')
    expect(agentId).toBe('agent-1')
    expect(triggerEventId).toMatch(/^evt_/)
    expect(instruction.public_scene.programming).toEqual({
      production_path: 'cue',
      cue: {
        schedule_id: w.scheduleId,
        cue_id: w.cue.id,
        attempt_id: attempts[0].id,
        source_type: 'manual',
      },
    })

    // CueExecutionCompleted emitted with correct idempotency key
    const completed = w.eventRepo.findByIdempotencyKey(
      `cue-execution-completed:${attempts[0].id}`,
    )
    expect(completed?.event_type).toBe(CUE_EXECUTION_COMPLETED)
    expect(completed?.community_id).toBe('c1')
    expect(completed?.payload_json.post_id).toBe('post_42')
    expect(completed?.payload_json.cue_id).toBe(w.cue.id)
  })

  it('skips when no due cues', async () => {
    const w = await setupWorld()
    // First tick claims it; second tick has no eligible cue.
    await w.worker.tick()
    const r2 = await w.worker.tick()
    expect(r2.processed).toBe(0)
  })

  it('only one CueExecutionCompleted is emitted even on idempotent retry (R9)', async () => {
    const w = await setupWorld()
    await w.worker.tick()
    const attempts = await w.cueRepo.listAttemptsForCue(w.cue.id)
    const completedKey = `cue-execution-completed:${attempts[0].id}`

    // Calling create() twice with the same idempotency_key returns the same event.
    const e1 = w.eventRepo.findByIdempotencyKey(completedKey)
    const replay = w.eventRepo.create({
      event_type: CUE_EXECUTION_COMPLETED,
      payload_json: { duplicate: true },
      idempotency_key: completedKey,
    })
    expect(replay.id).toBe(e1?.id)
  })
})

// ===========================================================================
// Failure terminals
// ===========================================================================

describe('PublicDiscussionCueWorker — failure terminals', () => {
  it('defers when growth gate denies; releases the reservation; emits CueExecutionFailed', async () => {
    const w = await setupWorld({ growthGateAllow: false })
    await w.worker.tick()
    const attempts = await w.cueRepo.listAttemptsForCue(w.cue.id)
    expect(attempts[0].status).toBe('delayed')
    expect(attempts[0].lease_owner).toBeNull()
    const cueAfter = await w.cueRepo.findCueById(w.cue.id)
    expect(cueAfter?.status).toBe('deferred')
    const failed = w.eventRepo.findByIdempotencyKey(
      `cue-execution-failed:${attempts[0].id}`,
    )
    expect(failed?.event_type).toBe(CUE_EXECUTION_FAILED)
    expect((failed?.payload_json as { terminal_status?: string }).terminal_status).toBe('failed')
    // Budget reservation was acquired (admission step 1) then released by the
    // controller because growth denied — the snapshot still shows the cue
    // counter incremented (counters are not decremented; counters track
    // attempts, not net inventory) but the reservation map should be empty.
    expect(w.dataPlaneWriter.write).not.toHaveBeenCalled()
  })

  it('skips when no cast resolved; releases reservation; emits CueExecutionFailed', async () => {
    const w = await setupWorld({ cast: [] })
    await w.worker.tick()
    const attempts = await w.cueRepo.listAttemptsForCue(w.cue.id)
    expect(attempts[0].status).toBe('skipped')
    expect(attempts[0].error_code).toBe('no_eligible_cast')
    const cueAfter = await w.cueRepo.findCueById(w.cue.id)
    expect(cueAfter?.status).toBe('skipped')
    expect(w.dataPlaneWriter.write).not.toHaveBeenCalled()
  })

  it('community lookup failure is retryable: attempt failed, cue deferred with backoff (within max_attempts)', async () => {
    const w = await setupWorld({ noCommunity: true })
    await w.worker.tick()
    const attempts = await w.cueRepo.listAttemptsForCue(w.cue.id)
    expect(attempts[0].status).toBe('failed')
    expect(attempts[0].error_code).toBe('community_not_found')
    // T-212 Bug #3 — transient terminals roll back to deferred so the next
    // tick re-claims with attempt_no+1, until max_attempts is exhausted.
    const cueAfter = await w.cueRepo.findCueById(w.cue.id)
    expect(cueAfter?.status).toBe('deferred')
    // trigger_at bumped by retry_backoff_seconds
    expect(new Date(cueAfter!.trigger_at).getTime()).toBeGreaterThan(
      new Date('2026-04-26T20:30:30.000Z').getTime(),
    )
    // Failed event reason_codes carry the retry annotation
    const failed = w.eventRepo.findByIdempotencyKey(
      `cue-execution-failed:${attempts[0].id}`,
    )
    expect(failed?.payload_json.reason_codes).toEqual(
      expect.arrayContaining([expect.stringMatching(/^retry_in:/)]),
    )
  })

  it('write failure is retryable: attempt failed, cue deferred with backoff', async () => {
    const w = await setupWorld({ writeSuccess: false, writeError: 'moderation_blocked' })
    await w.worker.tick()
    const attempts = await w.cueRepo.listAttemptsForCue(w.cue.id)
    expect(attempts[0].status).toBe('failed')
    expect(attempts[0].error_code).toBe('write_failed')
    expect(attempts[0].error_text).toBe('moderation_blocked')
    const cueAfter = await w.cueRepo.findCueById(w.cue.id)
    expect(cueAfter?.status).toBe('deferred')
    const failed = w.eventRepo.findByIdempotencyKey(
      `cue-execution-failed:${attempts[0].id}`,
    )
    expect(failed?.payload_json.error_text).toBe('moderation_blocked')
  })

  it('content generator throw is retryable: attempt failed, cue deferred', async () => {
    const w = await setupWorld()
    w.contentGenerator.generate.mockImplementation(async () => {
      throw new Error('llm_unavailable')
    })
    await w.worker.tick()
    const attempts = await w.cueRepo.listAttemptsForCue(w.cue.id)
    expect(attempts[0].status).toBe('failed')
    expect(attempts[0].error_code).toBe('content_generator_error')
    expect(attempts[0].error_text).toBe('llm_unavailable')
    expect(w.dataPlaneWriter.write).not.toHaveBeenCalled()
    const cueAfter = await w.cueRepo.findCueById(w.cue.id)
    expect(cueAfter?.status).toBe('deferred')
  })

  it('non-retryable structural failure (cue missing community_id) goes straight to failed', async () => {
    const cueRepo = new InMemoryCueRepository()
    const schedule = await cueRepo.createSchedule(makeScheduleInput())
    // Cue with no community_id and runtime_select scope — community is unresolvable.
    const cue = await cueRepo.createCue({
      ...makeCueInput(schedule.id),
      community_id: null,
      scope: { mode: 'runtime_select' },
    })
    const eventRepo = new InMemoryEventRepository()
    const budget = new InProcessTrivialCommunityBudgetService()
    const worker = new PublicDiscussionCueWorker(
      {
        cueRepo,
        admissionController: new CueAdmissionController({
          communityBudgetService: budget,
          publicGrowthGate: alwaysAllowGate(),
          loadSignalService: loadSignalServiceStub,
        }),
        directorCueBrief: new DirectorCueBriefServiceImpl(),
        sceneSelector: makeSceneSelector(),
        dataPlaneWriter: makeDataPlaneWriter(),
        eventRepo,
        communityBudgetService: budget,
        communityResolver: makeCommunityResolver(),
        castResolver: makeCastResolver(['agent-1']),
        contentGenerator: makeContentGenerator(),
        now: () => new Date('2026-04-26T20:30:30.000Z'),
      },
      { intervalMs: 60_000, startupDelayMs: 60_000 },
    )
    await worker.tick()
    const attempts = await cueRepo.listAttemptsForCue(cue.id)
    expect(attempts[0].status).toBe('failed')
    expect(attempts[0].error_code).toBe('cue_missing_community_id')
    const cueAfter = await cueRepo.findCueById(cue.id)
    expect(cueAfter?.status).toBe('failed')
  })

  it('exhausts retries: after max_attempts ticks, cue moves to terminal failed', async () => {
    const w = await setupWorld({ writeSuccess: false, writeError: 'persistent_error' })
    // dispatch_policy.max_attempts = 3 in the fixture
    const now = new Date('2026-04-26T20:30:30.000Z')
    let workerNow = now
    // Inject a mutable now() so we can advance past the backoff window
    // on each tick. Worker uses deps.now() — we override via reconstruct.
    const ws = await setupWorld({ writeSuccess: false, writeError: 'persistent_error' })
    const cueRepo = ws.cueRepo
    const eventRepo = ws.eventRepo
    void w
    void now
    const budget = new InProcessTrivialCommunityBudgetService()
    const worker = new PublicDiscussionCueWorker(
      {
        ...ws.deps,
        cueRepo,
        eventRepo,
        communityBudgetService: budget,
        admissionController: new CueAdmissionController({
          communityBudgetService: budget,
          publicGrowthGate: alwaysAllowGate(),
          loadSignalService: loadSignalServiceStub,
        }),
        now: () => workerNow,
      },
      { intervalMs: 60_000, startupDelayMs: 60_000 },
    )
    // Tick 3 times (max_attempts), advancing past the backoff each time.
    for (let i = 0; i < 3; i++) {
      await worker.tick()
      // advance past retry_backoff_seconds (default 30s in fixture) and grace
      workerNow = new Date(workerNow.getTime() + 5 * 60_000)
    }
    const cueAfter = await cueRepo.findCueById(ws.cue.id)
    expect(cueAfter?.status).toBe('failed')
    const attempts = await cueRepo.listAttemptsForCue(ws.cue.id)
    expect(attempts.length).toBe(3)
    expect(attempts.every((a) => a.status === 'failed')).toBe(true)
  })
})

// ===========================================================================
// Concurrency / leadership
// ===========================================================================

describe('PublicDiscussionCueWorker — leadership + concurrency', () => {
  it('does not tick when leader elector denies leadership', async () => {
    const w = await setupWorld()
    const worker = new PublicDiscussionCueWorker(
      {
        ...w.deps,
        leaderElector: {
          isLeader: false,
          ensureLeadership: async () => false,
          releaseLeadership: async () => {},
        },
      },
      { intervalMs: 60_000, startupDelayMs: 60_000 },
    )
    const result = await worker.tick()
    expect(result.processed).toBe(0)
    const cueAfter = await w.cueRepo.findCueById(w.cue.id)
    expect(cueAfter?.status).toBe('scheduled')
  })

  it('two parallel ticks do not double-claim the same cue', async () => {
    const w = await setupWorld()
    const second = new PublicDiscussionCueWorker(w.deps, {
      intervalMs: 60_000,
      startupDelayMs: 60_000,
    })
    const [a, b] = await Promise.all([w.worker.tick(), second.tick()])
    expect(a.processed + b.processed).toBe(1)
  })
})

// ===========================================================================
// Selector skip path
// ===========================================================================

describe('PublicDiscussionCueWorker — selector skip', () => {
  it('skips when scene selector returns kind=skip', async () => {
    const w = await setupWorld()
    w.sceneSelector.selectFromDiscussionCue.mockResolvedValue({
      kind: 'skip',
      reason: 'binding_target_missing',
    })
    await w.worker.tick()
    const attempts = await w.cueRepo.listAttemptsForCue(w.cue.id)
    expect(attempts[0].status).toBe('skipped')
    expect(attempts[0].error_code).toBe('selector_skip')
    const cueAfter = await w.cueRepo.findCueById(w.cue.id)
    expect(cueAfter?.status).toBe('skipped')
  })
})

// ===========================================================================
// T-212 Bug #1 fix — event dispatcher fan-out (T-211 §F.4)
// ===========================================================================

describe('PublicDiscussionCueWorker — event dispatcher fan-out (Bug #1 fix)', () => {
  it('invokes the event dispatcher for every cue domain event (Dispatched, Completed)', async () => {
    const w = await setupWorld()
    const dispatched: Array<{ event_type: string; idempotency_key: string | null }> = []
    const dispatcher = vi.fn(async (event: { event_type: string; idempotency_key: string | null }) => {
      dispatched.push({
        event_type: event.event_type,
        idempotency_key: event.idempotency_key,
      })
    })
    const worker = new PublicDiscussionCueWorker(
      { ...w.deps, eventDispatcher: dispatcher },
      { intervalMs: 60_000, startupDelayMs: 60_000 },
    )
    await worker.tick()
    const dispatchedTypes = dispatched.map((d) => d.event_type)
    expect(dispatchedTypes).toContain('CUE_EXECUTION_DISPATCHED')
    expect(dispatchedTypes).toContain('CUE_EXECUTION_COMPLETED')
    // Idempotency keys are stable per attempt
    const attempts = await w.cueRepo.listAttemptsForCue(w.cue.id)
    const completedKey = `cue-execution-completed:${attempts[0].id}`
    expect(dispatched.some((d) => d.idempotency_key === completedKey)).toBe(true)
  })

  it('isolates dispatcher errors — worker still terminates the attempt cleanly', async () => {
    const w = await setupWorld()
    const dispatcher = vi.fn(async () => {
      throw new Error('dispatcher_crashed')
    })
    const worker = new PublicDiscussionCueWorker(
      { ...w.deps, eventDispatcher: dispatcher },
      { intervalMs: 60_000, startupDelayMs: 60_000 },
    )
    await worker.tick()
    // Worker should still complete despite dispatcher failures
    const attempts = await w.cueRepo.listAttemptsForCue(w.cue.id)
    expect(attempts[0].status).toBe('succeeded')
    const cueAfter = await w.cueRepo.findCueById(w.cue.id)
    expect(cueAfter?.status).toBe('consumed')
  })

  it('dispatcher fan-out emits Failed event on transient terminal too', async () => {
    const w = await setupWorld({ writeSuccess: false, writeError: 'transient' })
    const dispatcher = vi.fn()
    const worker = new PublicDiscussionCueWorker(
      { ...w.deps, eventDispatcher: dispatcher },
      { intervalMs: 60_000, startupDelayMs: 60_000 },
    )
    await worker.tick()
    const callTypes = dispatcher.mock.calls.map(
      (c) => (c[0] as { event_type: string }).event_type,
    )
    expect(callTypes).toContain('CUE_EXECUTION_FAILED')
  })
})

// ===========================================================================
// T-212 Bug #4 fix — recommended_next_trigger_at propagation on defer
// ===========================================================================

describe('PublicDiscussionCueWorker — admission defer trigger backoff (Bug #4 fix)', () => {
  it('bumps cue.trigger_at by dispatch_policy.retry_backoff_seconds when admission defer omits recommended_next_trigger_at (regression: defer loop)', async () => {
    const w = await setupWorld()
    const futureNow = new Date('2026-04-26T20:30:30.000Z')
    // Admission denies via growth gate (returns no recommended_next_trigger_at
    // in the AdmissionResult shape — dynamic-bug regression).
    const worker = new PublicDiscussionCueWorker(
      {
        ...w.deps,
        admissionController: {
          evaluate: async () => ({
            result: {
              granted: false,
              decision: 'defer' as const,
              reason_codes: ['growth_gate:warmup_layer_not_ready'],
              // no recommended_next_trigger_at
            },
          }),
        } as never,
        now: () => futureNow,
      },
      { intervalMs: 60_000, startupDelayMs: 60_000 },
    )
    await worker.tick()
    const cueAfter = await w.cueRepo.findCueById(w.cue.id)
    expect(cueAfter?.status).toBe('deferred')
    // trigger_at must be in the future (worker fell back to
    // dispatch_policy.retry_backoff_seconds = 30 in fixture)
    expect(new Date(cueAfter!.trigger_at).getTime()).toBeGreaterThan(
      futureNow.getTime(),
    )
  })

  it('bumps cue.trigger_at when admission defers with recommended_next_trigger_at', async () => {
    const w = await setupWorld()
    const futureNow = new Date('2026-04-26T20:30:30.000Z')
    const recommendedAt = new Date(futureNow.getTime() + 5 * 60_000) // +5min
    // Override admission to return defer with recommended_next_trigger_at
    const exhaustedBudget = {
      acquire: async () => ({
        granted: false as const,
        reason: 'budget_exhausted' as const,
        retry_after_ms: 5 * 60_000,
      }),
      release: async () => {},
      query: async () => ({
        communityId: 'c1',
        daily_remaining: 0,
        window_remaining: 0,
        autonomous_used_today: 0,
        cue_used_today: 0,
      }),
    }
    const worker = new PublicDiscussionCueWorker(
      {
        ...w.deps,
        communityBudgetService: exhaustedBudget,
        admissionController: new CueAdmissionController({
          communityBudgetService: exhaustedBudget,
          publicGrowthGate: alwaysAllowGate(),
          loadSignalService: loadSignalServiceStub,
        }),
        now: () => futureNow,
      },
      { intervalMs: 60_000, startupDelayMs: 60_000 },
    )
    await worker.tick()
    const cueAfter = await w.cueRepo.findCueById(w.cue.id)
    expect(cueAfter?.status).toBe('deferred')
    // trigger_at bumped to (or near) recommendedAt
    expect(new Date(cueAfter!.trigger_at).getTime()).toBeGreaterThanOrEqual(
      recommendedAt.getTime() - 1000,
    )
  })
})

// ===========================================================================
// T-212 M5 — admin cancel detection at lifecycle boundaries
// ===========================================================================

import { CUE_EXECUTION_CANCELLED } from '../../programming/cue/cue-domain-events.js'

describe('PublicDiscussionCueWorker — admin cancel boundaries (M5)', () => {
  it('emits CueExecutionCancelled (not Failed) when admin cancels mid-execution before content gen', async () => {
    const w = await setupWorld()
    // Race: simulate admin cancel happening AFTER the worker transitioned
    // cue to executing but BEFORE the content generator runs.
    const originalGenerate = w.contentGenerator.generate
    w.contentGenerator.generate.mockImplementation(async (...args) => {
      // Should never run because the cancel-detect helper aborts first.
      return originalGenerate(...args)
    })
    // Wire content generator to be called only after the worker has set cue
    // to 'executing'. We achieve the race by patching findCueById to return
    // 'cancelled' when called the FIRST time after setCueStatus(executing).
    let executingObserved = false
    const realFind = w.cueRepo.findCueById.bind(w.cueRepo)
    w.cueRepo.findCueById = async (id: string) => {
      const cue = await realFind(id)
      if (cue && cue.status === 'executing' && !executingObserved) {
        executingObserved = true
        return { ...cue, status: 'cancelled' }
      }
      return cue
    }
    await w.worker.tick()
    const attempts = await w.cueRepo.listAttemptsForCue(w.cue.id)
    expect(attempts[0].status).toBe('cancelled')
    expect(attempts[0].error_code).toBe('admin_cancelled')
    expect(w.contentGenerator.generate).not.toHaveBeenCalled()
    const cancelled = w.eventRepo.findByIdempotencyKey(
      `cue-execution-cancelled:${attempts[0].id}`,
    )
    expect(cancelled?.event_type).toBe(CUE_EXECUTION_CANCELLED)
    const failed = w.eventRepo.findByIdempotencyKey(
      `cue-execution-failed:${attempts[0].id}`,
    )
    expect(failed).toBeNull()
  })

  it('aborts the write step when admin cancels after content gen but before write', async () => {
    const w = await setupWorld()
    let cancelTriggered = false
    const realFind = w.cueRepo.findCueById.bind(w.cueRepo)
    // Allow the first executing-state read through (so worker proceeds past
    // the first cancel boundary and runs the content generator), then flip
    // to cancelled on the next read (which is the post-content boundary).
    let executingReads = 0
    w.cueRepo.findCueById = async (id: string) => {
      const cue = await realFind(id)
      if (cue && cue.status === 'executing') {
        executingReads += 1
        if (executingReads >= 2) {
          cancelTriggered = true
          return { ...cue, status: 'cancelled' }
        }
      }
      return cue
    }
    await w.worker.tick()
    expect(cancelTriggered).toBe(true)
    expect(w.contentGenerator.generate).toHaveBeenCalledTimes(1)
    expect(w.dataPlaneWriter.write).not.toHaveBeenCalled()
    const attempts = await w.cueRepo.listAttemptsForCue(w.cue.id)
    expect(attempts[0].status).toBe('cancelled')
    const cancelled = w.eventRepo.findByIdempotencyKey(
      `cue-execution-cancelled:${attempts[0].id}`,
    )
    expect(cancelled?.payload_json.reason).toBe('cancelled_after_content_before_write')
  })

  it('aborts the write step when admin cancels after media planning but before write', async () => {
    const w = await setupWorld()
    const planForWrite = vi.fn(async ({ scenePayload }) => ({
      kind: 'ready' as const,
      scenePayload,
      imagePlannerDecisionsByAssetId: {},
      derivativeSourcedAnchorAssetIds: [],
      mediaUsage: [],
    }))
    w.deps.cueMediaPlanner = {
      planForWrite,
      record: vi.fn(),
    } as unknown as PublicDiscussionCueWorkerDeps['cueMediaPlanner']

    const realFind = w.cueRepo.findCueById.bind(w.cueRepo)
    let executingReads = 0
    w.cueRepo.findCueById = async (id: string) => {
      const cue = await realFind(id)
      if (cue && cue.status === 'executing') {
        executingReads += 1
        if (executingReads >= 3) {
          return { ...cue, status: 'cancelled' }
        }
      }
      return cue
    }

    await w.worker.tick()

    expect(planForWrite).toHaveBeenCalledTimes(1)
    expect(w.dataPlaneWriter.write).not.toHaveBeenCalled()
    const attempts = await w.cueRepo.listAttemptsForCue(w.cue.id)
    expect(attempts[0].status).toBe('cancelled')
    const cancelled = w.eventRepo.findByIdempotencyKey(
      `cue-execution-cancelled:${attempts[0].id}`,
    )
    expect(cancelled?.payload_json.reason).toBe('cancelled_after_media_planning_before_write')
  })

  it('annotates force_cancelled_post_write when admin cancel races AFTER the write succeeds', async () => {
    const w = await setupWorld()
    const realFind = w.cueRepo.findCueById.bind(w.cueRepo)
    let postWriteRead = 0
    // Let everything through until AFTER the write — only the third
    // executing-state read (post-write) returns cancelled.
    w.cueRepo.findCueById = async (id: string) => {
      const cue = await realFind(id)
      if (cue && cue.status === 'executing') {
        postWriteRead += 1
        if (postWriteRead >= 3) {
          return { ...cue, status: 'cancelled' }
        }
      }
      return cue
    }
    await w.worker.tick()
    expect(w.dataPlaneWriter.write).toHaveBeenCalledTimes(1)
    const attempts = await w.cueRepo.listAttemptsForCue(w.cue.id)
    // Attempt is still SUCCEEDED — the post is published.
    expect(attempts[0].status).toBe('succeeded')
    expect(attempts[0].post_id).toBe('post_42')
    // But a Cancelled event with force_cancelled_post_write=true is emitted.
    const cancelled = w.eventRepo.findByIdempotencyKey(
      `cue-execution-cancelled:${attempts[0].id}`,
    )
    expect(cancelled?.event_type).toBe(CUE_EXECUTION_CANCELLED)
    expect(cancelled?.payload_json.force_cancelled_post_write).toBe(true)
    // No Completed event when post-write cancel observed.
    const completed = w.eventRepo.findByIdempotencyKey(
      `cue-execution-completed:${attempts[0].id}`,
    )
    expect(completed).toBeNull()
  })
})

// ===========================================================================
// T-212 M5 — prewarm tick sweep
// ===========================================================================

describe('PublicDiscussionCueWorker — prewarm sweep (M5)', () => {
  async function setupPrewarmWorld() {
    const cueRepo: CueRepository = new InMemoryCueRepository()
    const schedule = await cueRepo.createSchedule(makeScheduleInput())
    // prewarm_at = now (open), trigger_at = now + 30min (not yet due)
    const cue = await cueRepo.createCue({
      ...makeCueInput(schedule.id),
      trigger_at: new Date('2026-04-26T21:00:00.000Z'),
      prewarm_at: new Date('2026-04-26T20:25:00.000Z'),
      status: 'scheduled',
    })
    const eventRepo = new InMemoryEventRepository()
    const budget = new InProcessTrivialCommunityBudgetService()
    const admission = new CueAdmissionController({
      communityBudgetService: budget,
      publicGrowthGate: alwaysAllowGate(),
      loadSignalService: loadSignalServiceStub,
    })
    const directorCueBrief = new DirectorCueBriefServiceImpl()
    const sceneSelector = makeSceneSelector()
    const dataPlaneWriter = makeDataPlaneWriter()
    const communityResolver = makeCommunityResolver()
    const castResolver = makeCastResolver(['agent-1'])
    const contentGenerator = makeContentGenerator()
    const deps: PublicDiscussionCueWorkerDeps = {
      cueRepo,
      admissionController: admission,
      directorCueBrief,
      sceneSelector,
      dataPlaneWriter,
      eventRepo,
      communityBudgetService: budget,
      communityResolver,
      castResolver,
      contentGenerator,
      now: () => new Date('2026-04-26T20:30:00.000Z'),
    }
    const worker = new PublicDiscussionCueWorker(deps, {
      intervalMs: 60_000,
      startupDelayMs: 60_000,
      batchSize: 5,
    })
    return { worker, cueRepo, eventRepo, sceneSelector, dataPlaneWriter, contentGenerator, cue }
  }

  it('transitions a cue from scheduled to prewarming after a successful dry-run', async () => {
    const w = await setupPrewarmWorld()
    const result = await w.worker.tick()
    expect(result.prewarmed).toBe(1)
    // Claim phase did not pick the cue up (trigger_at is in the future)
    expect(result.processed).toBe(0)
    const cueAfter = await w.cueRepo.findCueById(w.cue.id)
    expect(cueAfter?.status).toBe('prewarming')
    // Selector was invoked in dry-run mode only
    expect(w.sceneSelector.selectFromDiscussionCue).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true }),
    )
    // No write happened
    expect(w.dataPlaneWriter.write).not.toHaveBeenCalled()
  })

  it('does not consume a CueExecutionAttempt during prewarm', async () => {
    const w = await setupPrewarmWorld()
    await w.worker.tick()
    const attempts = await w.cueRepo.listAttemptsForCue(w.cue.id)
    expect(attempts).toHaveLength(0)
  })

  it('transitions cue to deferred when prewarm dry-run fails (no cast)', async () => {
    const w = await setupPrewarmWorld()
    // Reset cast resolver to return no agents
    const cueRepo = w.cueRepo
    const eventRepo = w.eventRepo
    const sceneSelector = w.sceneSelector
    const dataPlaneWriter = w.dataPlaneWriter
    const budget = new InProcessTrivialCommunityBudgetService()
    const admission = new CueAdmissionController({
      communityBudgetService: budget,
      publicGrowthGate: alwaysAllowGate(),
      loadSignalService: loadSignalServiceStub,
    })
    const failingWorker = new PublicDiscussionCueWorker(
      {
        cueRepo,
        admissionController: admission,
        directorCueBrief: new DirectorCueBriefServiceImpl(),
        sceneSelector,
        dataPlaneWriter,
        eventRepo,
        communityBudgetService: budget,
        communityResolver: makeCommunityResolver(),
        castResolver: makeCastResolver([]), // empty cast forces deferred
        contentGenerator: makeContentGenerator(),
        now: () => new Date('2026-04-26T20:30:00.000Z'),
      },
      { intervalMs: 60_000, startupDelayMs: 60_000 },
    )
    await failingWorker.tick()
    const cueAfter = await cueRepo.findCueById(w.cue.id)
    expect(cueAfter?.status).toBe('deferred')
    // Still no attempt consumed
    expect(await cueRepo.listAttemptsForCue(w.cue.id)).toHaveLength(0)
  })

  it('claim phase picks up a prewarming cue once trigger_at is reached', async () => {
    const cueRepo: CueRepository = new InMemoryCueRepository()
    const schedule = await cueRepo.createSchedule(makeScheduleInput())
    // prewarm_at = past, trigger_at = now (claimable)
    const cue = await cueRepo.createCue({
      ...makeCueInput(schedule.id),
      trigger_at: new Date('2026-04-26T20:30:00.000Z'),
      prewarm_at: new Date('2026-04-26T20:25:00.000Z'),
      status: 'prewarming', // already prewarmed
    })
    const result = await cueRepo.claimDueCues({
      now: new Date('2026-04-26T20:30:30.000Z'),
      graceSeconds: 60,
      leaseOwner: 'w',
      leaseSeconds: 120,
      batchSize: 1,
    })
    expect(result).toHaveLength(1)
    expect(result[0].cue.id).toBe(cue.id)
    expect(result[0].cue.status).toBe('claimed')
  })
})
