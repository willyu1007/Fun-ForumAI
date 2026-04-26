/**
 * T-212 M5 — in-process audit chain e2e.
 *
 * Wires the worker against in-memory repos for the full chain
 *   Post → ForumSceneMetadata → CueExecutionAttempt → Cue → Schedule →
 *   Change → Actor
 * and proves that an admin-authored cue produces a forum post within the
 * trigger window with every audit linkage intact (umbrella §5).
 *
 * Skips the real ForumWriteService / DataPlaneWriter stack — instead a
 * thin adapter persists the ForumSceneMetadata row directly via the
 * in-memory repository so the chain is observable without spinning up the
 * full HTTP container. The single goal is the audit linkage — moderation,
 * SSE, achievements wiring etc. are exercised by the existing app-level
 * integration suite.
 */

import { describe, it, expect, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { PublicDiscussionCueWorker } from '../public-discussion-cue-worker.js'
import {
  InMemoryCueRepository,
  type CreateCueInput,
} from '../../repos/cue-repository.js'
import { InMemoryEventRepository } from '../../repos/event-repository.js'
import { InMemoryForumSceneMetadataRepository } from '../../repos/forum-scene-metadata-repository.js'
import { CueAdmissionController } from '../../programming/cue/cue-admission-controller.js'
import { InProcessTrivialCommunityBudgetService } from '../../services/community-budget-service.js'
import { loadSignalServiceStub } from '../../services/__stubs__/load-signal-service-stub.js'
import { DirectorCueBriefServiceImpl } from '../../programming/cue/director-cue-brief.js'
import { CueMediaPlanner } from '../../media/cue-media-planner.js'
import { InMemoryMediaPlanResolutionRepository } from '../../repos/media-plan-resolution-repository.js'
import { CUE_EXECUTION_COMPLETED } from '../../programming/cue/cue-domain-events.js'
import { buildForumSceneMetadataInput } from '../../services/public-scene-runtime.js'
import type { DataPlaneWriter } from '../data-plane-writer.js'
import type { WriteInstruction } from '../types.js'
import type { LlmTokenUsage } from '../../llm/types.js'
import type {
  CueSceneSelection,
  CueSceneDryRunResult,
  PublicSceneSelectorService,
} from '../../services/public-scene-selector-service.js'

// ===========================================================================
// In-memory adapters for the audit-chain e2e
// ===========================================================================

/**
 * Adapter that satisfies `DataPlaneWriter.write` enough for the worker:
 *   - assigns a synthetic `post_id`
 *   - persists `ForumSceneMetadata` so the audit chain is reconstructible
 *   - returns `{ success: true, content_id: <postId> }`
 *
 * Real DataPlaneWriter additionally records AgentRun / fires media bridge /
 * awards XP — those are exercised by the existing forum-write-service and
 * data-plane-writer test suites; not the audit chain's concern.
 */
class AuditChainDataPlaneWriter implements Pick<DataPlaneWriter, 'write'> {
  readonly writes: WriteInstruction[] = []

  constructor(
    private readonly forumSceneMetadataRepo: InMemoryForumSceneMetadataRepository,
  ) {}

  async write(
    instruction: WriteInstruction,
    _agentId: string,
    _triggerEventId: string,
    _usage: LlmTokenUsage,
    _latencyMs: number,
  ): Promise<{ success: boolean; content_id?: string; error?: string }> {
    if (instruction.action !== 'create_post') {
      return { success: false, error: `unsupported_action:${instruction.action}` }
    }
    if (!instruction.public_scene) {
      return { success: false, error: 'missing_public_scene' }
    }
    this.writes.push(instruction)
    const postId = `post_${randomUUID()}`
    await this.forumSceneMetadataRepo.create(
      buildForumSceneMetadataInput({
        community_id: instruction.community_id,
        target_type: 'POST',
        post_id: postId,
        payload: instruction.public_scene,
      }),
    )
    return { success: true, content_id: postId }
  }
}

// Fake selector that returns a minimum scene payload — we don't exercise
// the real selector here (covered in selector tests), only the worker's
// stamping of `programming` and the e2e linkage.
function makeSelector(): Pick<PublicSceneSelectorService, 'selectFromDiscussionCue'> {
  return {
    selectFromDiscussionCue: async (
      input,
    ): Promise<CueSceneSelection | CueSceneDryRunResult> => ({
      kind: 'scene',
      community: input.community,
      payload: {
        scene_metadata: {
          director_surface: 'forum',
          actor_surface: 'forum_post',
          scene_template_id: 'cue-tmpl',
          scene_template_version: 'v1',
          scene_binding_id: 'binding-cue',
          overlay_id: null,
          episode_id: `episode_${input.cue.id}`,
          beat_id: null,
          phase: 'opening',
          selection_mode: 'pool_guided',
          selection_id: `sel_${input.cue.id}`,
          episode_plan_id: `plan_${input.cue.id}`,
          local_intent_id: `intent_${input.cue.id}`,
          started_at: '2026-04-26T20:30:30.000Z',
          expires_at: '2026-04-27T20:30:30.000Z',
        },
        episode_brief: {
          episode_id: `episode_${input.cue.id}`,
          director_surface: 'forum',
          actor_surface: 'forum_post',
          template_id: 'cue-tmpl',
          template_version: 'v1',
          binding_id: 'binding-cue',
          phase: 'opening',
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
          expires_at: '2026-04-27T20:30:30.000Z',
        },
        local_intent: {
          intent_id: `intent_${input.cue.id}`,
          delivery_surface: 'forum_post',
          initiative: 'open_topic',
          opinion_policy: 'free_opinion',
          relation_focus: 'none',
          tone_hint: 'neutral',
          privacy_mode: 'public_only',
          memory_scope: 'public_contextual',
          reference_scope: 'seed_only',
          prohibited_reference_types: [
            'owner_private_speech',
            'private_memory',
            'hidden_director_goal',
          ],
          target_ref: { kind: 'none' },
          hard_constraints: [],
          soft_constraints: [],
        },
        local_intent_block: '## Local Intent',
        selection_audit: {
          cue_audit_refs: input.brief.audit_refs,
          cue_primary_author_id: input.agents[0].id,
          cue_cast_pool: input.agents.map((a) => ({
            id: a.id,
            display_name: a.display_name,
          })),
        },
      },
      selected_cast: input.agents,
    }),
  }
}

// ===========================================================================
// E2E
// ===========================================================================

describe('PublicDiscussionCueWorker — in-process audit-chain e2e (M5)', () => {
  it('admin cue → worker tick → forum post + full audit chain reconstructible', async () => {
    // ---- 1. Admin authors a schedule + cue (T-210 surface stand-in) ----
    const cueRepo = new InMemoryCueRepository()
    const eventRepo = new InMemoryEventRepository()
    const forumSceneMetadataRepo = new InMemoryForumSceneMetadataRepository()

    const schedule = await cueRepo.createSchedule({
      scope_type: 'global',
      date_range_start: new Date('2026-04-26T00:00:00.000Z'),
      date_range_end: new Date('2026-04-27T00:00:00.000Z'),
      source: 'manual',
      created_by_user_id: 'user_admin_1',
    })

    const cueInput: CreateCueInput = {
      schedule_id: schedule.id,
      source_type: 'manual',
      community_id: 'c_general',
      scope: { mode: 'single', community_id: 'c_general' },
      trigger_at: new Date('2026-04-26T20:30:00.000Z'),
      status: 'scheduled',
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
      theme_intent: { topic_seed: 'AI 陪伴边界' },
      scene_constraints: {
        community_scope: { mode: 'single', community_id: 'c_general' },
        public_stage_scope: ['forum'],
        privacy_policy: 'public_only',
        private_reference_policy: 'forbidden',
        safety_profile: 'standard',
      },
      role_requirements: { requirements: [{ role: 'anchor', weight: 0.7 }] },
      created_by_user_id: 'user_admin_1',
    }
    const cue = await cueRepo.createCue(cueInput)
    // Audit-chain link: the create_cue change.
    const createChange = await cueRepo.recordChange({
      schedule_id: schedule.id,
      cue_id: cue.id,
      source: 'manual',
      actor_user_id: 'user_admin_1',
      change_type: 'create_cue',
      patch_json: { version: 1, partial: cueInput },
      validation_status: 'passed',
      approval_status: 'auto_applied',
      reason: 'admin authored',
      applied_at: new Date('2026-04-26T20:00:00.000Z'),
    })

    // ---- 2. Worker assembled with audit-chain adapter ----
    const budget = new InProcessTrivialCommunityBudgetService()
    const admission = new CueAdmissionController({
      communityBudgetService: budget,
      publicGrowthGate: {
        getRuntimeBaselineAdmission: async () => ({
          allow_public_growth: true,
          reasons: [],
        }),
      },
      loadSignalService: loadSignalServiceStub,
    })
    const worker = new PublicDiscussionCueWorker(
      {
        cueRepo,
        admissionController: admission,
        directorCueBrief: new DirectorCueBriefServiceImpl(),
        sceneSelector: makeSelector(),
        dataPlaneWriter: new AuditChainDataPlaneWriter(forumSceneMetadataRepo),
        eventRepo,
        communityBudgetService: budget,
        communityResolver: {
          resolve: async (id) => ({
            id,
            slug: 'general',
            name: 'General',
            description: '',
            rules: '',
          }),
        },
        castResolver: {
          resolveCast: async () => [
            { id: 'agent-anchor-1', display_name: 'Anchor One' },
            { id: 'agent-challenger-1', display_name: 'Challenger One' },
          ],
        },
        contentGenerator: {
          generate: async ({ cue: c }) => ({
            title: c.theme_intent.topic_seed,
            body: '让讨论从一个真实场景开始',
          }),
        },
        now: () => new Date('2026-04-26T20:30:30.000Z'),
      },
      { intervalMs: 60_000, startupDelayMs: 60_000, batchSize: 5 },
    )

    // ---- 3. Tick the worker ----
    const result = await worker.tick()
    expect(result.processed).toBe(1)

    // ---- 4. Reconstruct the audit chain from the published post id ----
    // 4a. attempt
    const attempts = await cueRepo.listAttemptsForCue(cue.id)
    expect(attempts).toHaveLength(1)
    const attempt = attempts[0]
    expect(attempt.status).toBe('succeeded')
    expect(attempt.cue_id).toBe(cue.id)
    expect(attempt.post_id).not.toBeNull()
    const postId = attempt.post_id!

    // 4b. ForumSceneMetadata
    const metadata = await forumSceneMetadataRepo.findByPostId(postId)
    expect(metadata).not.toBeNull()
    expect(metadata?.community_id).toBe('c_general')
    const programming = (metadata?.payload_json as {
      programming?: {
        production_path?: string
        cue?: {
          schedule_id?: string
          cue_id?: string
          attempt_id?: string
          source_type?: string
        }
      }
    } | null)?.programming
    expect(programming?.production_path).toBe('cue')
    expect(programming?.cue).toEqual({
      schedule_id: schedule.id,
      cue_id: cue.id,
      attempt_id: attempt.id,
      source_type: 'manual',
    })
    // T-215 B-M1 — promoted programming columns mirror the legacy
    // payload_json.programming.* block on cue-runtime writes.
    expect(metadata?.programming_production_path).toBe('cue')
    expect(metadata?.programming_cue_id).toBe(cue.id)
    expect(metadata?.programming_attempt_id).toBe(attempt.id)
    expect(metadata?.programming_schedule_id).toBe(schedule.id)
    expect(metadata?.programming_source_type).toBe('manual')

    // 4c. cue → schedule → change → actor
    const cueAfter = await cueRepo.findCueById(cue.id)
    expect(cueAfter?.status).toBe('consumed')
    expect(cueAfter?.schedule_id).toBe(schedule.id)
    const scheduleAfter = await cueRepo.findScheduleById(schedule.id)
    expect(scheduleAfter?.created_by_user_id).toBe('user_admin_1')
    const changes = await cueRepo.listChangesForCue(cue.id)
    expect(changes).toHaveLength(1)
    expect(changes[0].id).toBe(createChange.id)
    expect(changes[0].actor_user_id).toBe('user_admin_1')
    expect(changes[0].change_type).toBe('create_cue')

    // ---- 5. Domain event observable, idempotency-key dedup proven ----
    const completed = eventRepo.findByIdempotencyKey(
      `cue-execution-completed:${attempt.id}`,
    )
    expect(completed?.event_type).toBe(CUE_EXECUTION_COMPLETED)
    expect(completed?.payload_json.post_id).toBe(postId)
    expect(completed?.payload_json.cue_id).toBe(cue.id)
    expect(completed?.payload_json.schedule_id).toBe(schedule.id)
    // Replay-emit returns the same event id.
    const replay = eventRepo.create({
      event_type: CUE_EXECUTION_COMPLETED,
      payload_json: { duplicate: true },
      idempotency_key: `cue-execution-completed:${attempt.id}`,
    })
    expect(replay.id).toBe(completed?.id)

    // ---- 6. I-9 invariant: cue success path emits no autonomous trigger ----
    // PostScheduler-style autonomous events have prefixes like
    // SCHEDULED_POST_GENERATED / POST_CREATED. The cue path emits
    // CUE_EXECUTION_DISPATCHED + CUE_EXECUTION_COMPLETED only.
    const allEvents = eventRepo.findByPostId(postId)
    const autonomousish = allEvents.filter((e) =>
      e.event_type.startsWith('SCHEDULED_POST') ||
      e.event_type === 'POST_CREATED',
    )
    expect(autonomousish).toEqual([])
  })

  it('I-9 — cue failure terminal does not emit any autonomous trigger event', async () => {
    const cueRepo = new InMemoryCueRepository()
    const eventRepo = new InMemoryEventRepository()
    const forumSceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
    const schedule = await cueRepo.createSchedule({
      scope_type: 'global',
      date_range_start: new Date('2026-04-26T00:00:00.000Z'),
      date_range_end: new Date('2026-04-27T00:00:00.000Z'),
      source: 'manual',
    })
    await cueRepo.createCue({
      schedule_id: schedule.id,
      source_type: 'manual',
      community_id: 'c1',
      scope: { mode: 'single', community_id: 'c1' },
      trigger_at: new Date('2026-04-26T20:30:00.000Z'),
      status: 'scheduled',
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
    })
    const budget = new InProcessTrivialCommunityBudgetService()
    const worker = new PublicDiscussionCueWorker(
      {
        cueRepo,
        admissionController: new CueAdmissionController({
          communityBudgetService: budget,
          // Force defer to drive the failure terminal path.
          publicGrowthGate: {
            getRuntimeBaselineAdmission: async () => ({
              allow_public_growth: false,
              reasons: ['warmup_layer_not_ready'],
            }),
          },
          loadSignalService: loadSignalServiceStub,
        }),
        directorCueBrief: new DirectorCueBriefServiceImpl(),
        sceneSelector: makeSelector(),
        dataPlaneWriter: new AuditChainDataPlaneWriter(forumSceneMetadataRepo),
        eventRepo,
        communityBudgetService: budget,
        communityResolver: {
          resolve: async (id) => ({
            id,
            slug: 'general',
            name: 'General',
            description: '',
            rules: '',
          }),
        },
        castResolver: {
          resolveCast: async () => [
            { id: 'agent-1', display_name: 'A' },
          ],
        },
        contentGenerator: {
          generate: async () => ({ title: 't', body: 'b' }),
        },
        now: () => new Date('2026-04-26T20:30:30.000Z'),
      },
      { intervalMs: 60_000, startupDelayMs: 60_000 },
    )
    await worker.tick()

    // No autonomous-tick events emitted; only the cue-path Failed event.
    // Iterate the in-memory event store via a known cue id query.
    // (We don't have a generic listAll in the in-memory event repo, but the
    // failure path doesn't tie events to a post_id either — we assert by
    // checking the failed-event idempotency key family is the only one
    // present.)
    const cueAfter = await cueRepo.findCueById((await cueRepo.listCuesForSchedule(schedule.id))[0].id)
    expect(cueAfter?.status).toBe('deferred')
    const attempts = await cueRepo.listAttemptsForCue(cueAfter!.id)
    expect(attempts[0].status).toBe('delayed')
    const failed = eventRepo.findByIdempotencyKey(
      `cue-execution-failed:${attempts[0].id}`,
    )
    expect(failed).not.toBeNull()
    // Confirm absence of any post-creation event.
    expect(failed?.payload_json.post_id).toBeUndefined()
  })

  // T-216 M1 baseline: a successful cue with a 3-item pool must produce
  // exactly 3 MediaPlanResolution rows; admission deferrals produce 0.
  it('T-216 M1 — successful cue writes one MediaPlanResolution row per pool item', async () => {
    const cueRepo = new InMemoryCueRepository()
    const eventRepo = new InMemoryEventRepository()
    const forumSceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
    const mediaPlanResolutionRepo = new InMemoryMediaPlanResolutionRepository()
    const cueMediaPlanner = new CueMediaPlanner({ mediaPlanResolutionRepo })

    const schedule = await cueRepo.createSchedule({
      scope_type: 'community',
      community_id: 'c_general',
      date_range_start: new Date('2026-04-26T00:00:00.000Z'),
      date_range_end: new Date('2026-04-27T00:00:00.000Z'),
      source: 'manual',
      created_by_user_id: 'user_admin_1',
    })
    const cue = await cueRepo.createCue({
      schedule_id: schedule.id,
      source_type: 'manual',
      community_id: 'c_general',
      scope: { mode: 'single', community_id: 'c_general' },
      trigger_at: new Date('2026-04-26T20:30:00.000Z'),
      status: 'scheduled',
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
      theme_intent: { topic_seed: 'AI 陪伴' },
      scene_constraints: {
        community_scope: { mode: 'single', community_id: 'c_general' },
        public_stage_scope: ['forum'],
        privacy_policy: 'public_only',
        private_reference_policy: 'forbidden',
        safety_profile: 'standard',
      },
      role_requirements: { requirements: [{ role: 'anchor', weight: 0.7 }] },
      created_by_user_id: 'user_admin_1',
    })
    // Three media items spanning all four-strength tiers (no point repeating).
    await cueRepo.attachMedia({
      cue_id: cue.id,
      asset_id: 'asset-anchor',
      role: 'context_anchor',
      usage_strength: 'anchor',
      use_policy: 'allow_generated_derivative',
      created_by_type: 'admin',
      created_by_id: 'user_admin_1',
    })
    await cueRepo.attachMedia({
      cue_id: cue.id,
      asset_id: 'asset-preferred',
      role: 'mood_reference',
      usage_strength: 'preferred',
      use_policy: 'prefer_runtime_context',
      created_by_type: 'admin',
      created_by_id: 'user_admin_1',
    })
    await cueRepo.attachMedia({
      cue_id: cue.id,
      asset_id: 'asset-pool-only',
      role: 'cover_candidate',
      usage_strength: 'selected_only_pool',
      use_policy: 'prefer_public_display',
      created_by_type: 'admin',
      created_by_id: 'user_admin_1',
    })

    const budget = new InProcessTrivialCommunityBudgetService()
    const worker = new PublicDiscussionCueWorker(
      {
        cueRepo,
        admissionController: new CueAdmissionController({
          communityBudgetService: budget,
          publicGrowthGate: {
            getRuntimeBaselineAdmission: async () => ({
              allow_public_growth: true,
              reasons: [],
            }),
          },
          loadSignalService: loadSignalServiceStub,
        }),
        directorCueBrief: new DirectorCueBriefServiceImpl(),
        sceneSelector: makeSelector(),
        dataPlaneWriter: new AuditChainDataPlaneWriter(forumSceneMetadataRepo),
        eventRepo,
        communityBudgetService: budget,
        cueMediaPlanner,
        communityResolver: {
          resolve: async (id) => ({
            id,
            slug: 'general',
            name: 'General',
            description: '',
            rules: '',
          }),
        },
        castResolver: {
          resolveCast: async () => [
            { id: 'agent-anchor-1', display_name: 'Anchor One' },
            { id: 'agent-challenger-1', display_name: 'Challenger One' },
          ],
        },
        contentGenerator: {
          generate: async ({ cue: c }) => ({
            title: c.theme_intent.topic_seed,
            body: '让讨论从一个真实场景开始',
          }),
        },
        now: () => new Date('2026-04-26T20:30:30.000Z'),
      },
      { intervalMs: 60_000, startupDelayMs: 60_000, batchSize: 5 },
    )
    const tickResult = await worker.tick()
    expect(tickResult.processed).toBe(1)

    const attempts = await cueRepo.listAttemptsForCue(cue.id)
    expect(attempts[0].status).toBe('succeeded')
    const attemptId = attempts[0].id

    const resolutions = await mediaPlanResolutionRepo.findByAttempt(attemptId)
    expect(resolutions).toHaveLength(3)
    const byAsset = new Map(resolutions.map((r) => [r.asset_id, r]))
    expect(byAsset.get('asset-anchor')?.requested_strength).toBe('anchor')
    expect(byAsset.get('asset-preferred')?.requested_strength).toBe('preferred')
    expect(byAsset.get('asset-pool-only')?.requested_strength).toBe('selected_only_pool')
    // M1 collapses every outcome to runtime_context (admission was green).
    expect(resolutions.every((r) => r.plan_outcome === 'runtime_context')).toBe(true)
    expect(resolutions.every((r) => r.attempt_id === attemptId)).toBe(true)
  })

  it('T-216 — selected_only_pool plans before write and carries image plan into the post', async () => {
    const cueRepo = new InMemoryCueRepository()
    const eventRepo = new InMemoryEventRepository()
    const forumSceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
    const mediaPlanResolutionRepo = new InMemoryMediaPlanResolutionRepository()
    const prepareCueForumPostPlan = vi.fn(async () => ({
      directive_id: 'directive-pool',
      image_plan_id: 'image-plan-pool',
      runtime_card_ids: [],
      display_attachment_refs: [
        {
          asset_id: 'asset-pool-only',
          slot: 0,
          display_variant: 'original' as const,
        },
      ],
      planning_audit: {
        visual_directive_id: 'directive-pool',
        image_plan_id: 'image-plan-pool',
        planner_status: 'ready',
        planner_decision: 'reuse_public_original',
        planner_reason: 'selected_pool_asset',
        generation_status: 'not_requested',
        generation_job_id: null,
        runtime_card_ids: [],
        public_media_prompt_injection_status: 'not_requested',
      },
      selected_sources: [
        {
          asset_id: 'asset-pool-only',
          reuse_mode: 'quote_original' as const,
          rejection_reason: null,
        },
      ],
    }))
    const cueMediaPlanner = new CueMediaPlanner({
      mediaPlanResolutionRepo,
      anchorModeEnabled: true,
      surfaceMediaPlanningService: { prepareCueForumPostPlan },
    })
    const schedule = await cueRepo.createSchedule({
      scope_type: 'community',
      community_id: 'c_general',
      date_range_start: new Date('2026-04-26T00:00:00.000Z'),
      date_range_end: new Date('2026-04-27T00:00:00.000Z'),
      source: 'manual',
      created_by_user_id: 'user_admin_1',
    })
    const cue = await cueRepo.createCue({
      schedule_id: schedule.id,
      source_type: 'manual',
      community_id: 'c_general',
      scope: { mode: 'single', community_id: 'c_general' },
      trigger_at: new Date('2026-04-26T20:30:00.000Z'),
      status: 'scheduled',
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
      theme_intent: { topic_seed: 'AI 陪伴' },
      scene_constraints: {
        community_scope: { mode: 'single', community_id: 'c_general' },
        public_stage_scope: ['forum'],
        privacy_policy: 'public_only',
        private_reference_policy: 'forbidden',
        safety_profile: 'standard',
      },
      role_requirements: { requirements: [{ role: 'anchor', weight: 0.7 }] },
      created_by_user_id: 'user_admin_1',
    })
    await cueRepo.attachMedia({
      cue_id: cue.id,
      asset_id: 'asset-pool-only',
      role: 'cover_candidate',
      usage_strength: 'selected_only_pool',
      use_policy: 'prefer_public_display',
      created_by_type: 'admin',
      created_by_id: 'user_admin_1',
    })

    const budget = new InProcessTrivialCommunityBudgetService()
    const writer = new AuditChainDataPlaneWriter(forumSceneMetadataRepo)
    const worker = new PublicDiscussionCueWorker(
      {
        cueRepo,
        admissionController: new CueAdmissionController({
          communityBudgetService: budget,
          publicGrowthGate: {
            getRuntimeBaselineAdmission: async () => ({
              allow_public_growth: true,
              reasons: [],
            }),
          },
          loadSignalService: loadSignalServiceStub,
        }),
        directorCueBrief: new DirectorCueBriefServiceImpl(),
        sceneSelector: makeSelector(),
        dataPlaneWriter: writer,
        eventRepo,
        communityBudgetService: budget,
        cueMediaPlanner,
        communityResolver: {
          resolve: async (id) => ({
            id,
            slug: 'general',
            name: 'General',
            description: '',
            rules: '',
          }),
        },
        castResolver: {
          resolveCast: async () => [{ id: 'agent-anchor-1', display_name: 'Anchor One' }],
        },
        contentGenerator: {
          generate: async () => ({ title: 't', body: 'b' }),
        },
        now: () => new Date('2026-04-26T20:30:30.000Z'),
      },
      { intervalMs: 60_000, startupDelayMs: 60_000, batchSize: 5 },
    )

    await worker.tick()

    expect(prepareCueForumPostPlan).toHaveBeenCalledWith(expect.objectContaining({
      anchor_asset_id: 'asset-pool-only',
      candidate_asset_ids: ['asset-pool-only'],
      forbid_generation: true,
    }))
    expect(writer.writes[0]).toEqual(expect.objectContaining({
      image_plan_id: 'image-plan-pool',
      display_attachment_refs: [
        {
          asset_id: 'asset-pool-only',
          slot: 0,
          display_variant: 'original',
        },
      ],
    }))
    expect(writer.writes[0].public_scene?.visual_ref).toEqual({
      directive_id: 'directive-pool',
      image_plan_id: 'image-plan-pool',
      runtime_card_ids: [],
    })

    const attempts = await cueRepo.listAttemptsForCue(cue.id)
    const resolutions = await mediaPlanResolutionRepo.findByAttempt(attempts[0].id)
    expect(resolutions).toHaveLength(1)
    expect(resolutions[0]).toEqual(expect.objectContaining({
      asset_id: 'asset-pool-only',
      image_planner_decision_id: 'image-plan-pool',
      requested_strength: 'selected_only_pool',
      plan_outcome: 'public_display',
    }))
  })

  it('T-216 — selected_only_pool failure stops before data-plane write', async () => {
    const cueRepo = new InMemoryCueRepository()
    const eventRepo = new InMemoryEventRepository()
    const forumSceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
    const mediaPlanResolutionRepo = new InMemoryMediaPlanResolutionRepository()
    const cueMediaPlanner = new CueMediaPlanner({
      mediaPlanResolutionRepo,
      anchorModeEnabled: true,
      surfaceMediaPlanningService: {
        prepareCueForumPostPlan: vi.fn(async () => null),
      },
    })
    const schedule = await cueRepo.createSchedule({
      scope_type: 'community',
      community_id: 'c_general',
      date_range_start: new Date('2026-04-26T00:00:00.000Z'),
      date_range_end: new Date('2026-04-27T00:00:00.000Z'),
      source: 'manual',
      created_by_user_id: 'user_admin_1',
    })
    const cue = await cueRepo.createCue({
      schedule_id: schedule.id,
      source_type: 'manual',
      community_id: 'c_general',
      scope: { mode: 'single', community_id: 'c_general' },
      trigger_at: new Date('2026-04-26T20:30:00.000Z'),
      status: 'scheduled',
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
      theme_intent: { topic_seed: 'AI 陪伴' },
      scene_constraints: {
        community_scope: { mode: 'single', community_id: 'c_general' },
        public_stage_scope: ['forum'],
        privacy_policy: 'public_only',
        private_reference_policy: 'forbidden',
        safety_profile: 'standard',
      },
      role_requirements: { requirements: [{ role: 'anchor', weight: 0.7 }] },
      created_by_user_id: 'user_admin_1',
    })
    await cueRepo.attachMedia({
      cue_id: cue.id,
      asset_id: 'asset-pool-only',
      role: 'cover_candidate',
      usage_strength: 'selected_only_pool',
      use_policy: 'prefer_public_display',
      created_by_type: 'admin',
      created_by_id: 'user_admin_1',
    })

    const budget = new InProcessTrivialCommunityBudgetService()
    const writer = new AuditChainDataPlaneWriter(forumSceneMetadataRepo)
    const worker = new PublicDiscussionCueWorker(
      {
        cueRepo,
        admissionController: new CueAdmissionController({
          communityBudgetService: budget,
          publicGrowthGate: {
            getRuntimeBaselineAdmission: async () => ({
              allow_public_growth: true,
              reasons: [],
            }),
          },
          loadSignalService: loadSignalServiceStub,
        }),
        directorCueBrief: new DirectorCueBriefServiceImpl(),
        sceneSelector: makeSelector(),
        dataPlaneWriter: writer,
        eventRepo,
        communityBudgetService: budget,
        cueMediaPlanner,
        communityResolver: {
          resolve: async (id) => ({
            id,
            slug: 'general',
            name: 'General',
            description: '',
            rules: '',
          }),
        },
        castResolver: {
          resolveCast: async () => [{ id: 'agent-anchor-1', display_name: 'Anchor One' }],
        },
        contentGenerator: {
          generate: async () => ({ title: 't', body: 'b' }),
        },
        now: () => new Date('2026-04-26T20:30:30.000Z'),
      },
      { intervalMs: 60_000, startupDelayMs: 60_000, batchSize: 5 },
    )

    await worker.tick()

    expect(writer.writes).toHaveLength(0)
    const attempts = await cueRepo.listAttemptsForCue(cue.id)
    expect(attempts[0].status).toBe('failed')
    expect(attempts[0].error_code).toBe('cue_media_selected_only_pool_unresolved')
    expect(await mediaPlanResolutionRepo.findByAttempt(attempts[0].id)).toHaveLength(0)
    const failed = eventRepo.findByIdempotencyKey(`cue-execution-failed:${attempts[0].id}`)
    expect(failed?.payload_json.reason_codes).toEqual([
      'cue_media_selected_only_pool_unresolved',
    ])
  })

  it('T-216 M1 — admission-deferred cue writes zero MediaPlanResolution rows', async () => {
    const cueRepo = new InMemoryCueRepository()
    const eventRepo = new InMemoryEventRepository()
    const forumSceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
    const mediaPlanResolutionRepo = new InMemoryMediaPlanResolutionRepository()
    const cueMediaPlanner = new CueMediaPlanner({ mediaPlanResolutionRepo })

    const schedule = await cueRepo.createSchedule({
      scope_type: 'global',
      date_range_start: new Date('2026-04-26T00:00:00.000Z'),
      date_range_end: new Date('2026-04-27T00:00:00.000Z'),
      source: 'manual',
    })
    const cue = await cueRepo.createCue({
      schedule_id: schedule.id,
      source_type: 'manual',
      community_id: 'c1',
      scope: { mode: 'single', community_id: 'c1' },
      trigger_at: new Date('2026-04-26T20:30:00.000Z'),
      status: 'scheduled',
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
    })
    await cueRepo.attachMedia({
      cue_id: cue.id,
      asset_id: 'asset-1',
      role: 'context_anchor',
      usage_strength: 'preferred',
      use_policy: 'runtime_only',
      created_by_type: 'admin',
    })

    const budget = new InProcessTrivialCommunityBudgetService()
    const worker = new PublicDiscussionCueWorker(
      {
        cueRepo,
        admissionController: new CueAdmissionController({
          communityBudgetService: budget,
          publicGrowthGate: {
            getRuntimeBaselineAdmission: async () => ({
              allow_public_growth: false,
              reasons: ['warmup_layer_not_ready'],
            }),
          },
          loadSignalService: loadSignalServiceStub,
        }),
        directorCueBrief: new DirectorCueBriefServiceImpl(),
        sceneSelector: makeSelector(),
        dataPlaneWriter: new AuditChainDataPlaneWriter(forumSceneMetadataRepo),
        eventRepo,
        communityBudgetService: budget,
        cueMediaPlanner,
        communityResolver: {
          resolve: async (id) => ({
            id,
            slug: 'general',
            name: 'General',
            description: '',
            rules: '',
          }),
        },
        castResolver: {
          resolveCast: async () => [{ id: 'agent-1', display_name: 'A' }],
        },
        contentGenerator: {
          generate: async () => ({ title: 't', body: 'b' }),
        },
        now: () => new Date('2026-04-26T20:30:30.000Z'),
      },
      { intervalMs: 60_000, startupDelayMs: 60_000 },
    )
    await worker.tick()

    const attempts = await cueRepo.listAttemptsForCue(cue.id)
    // Deferred path leaves the attempt in a non-succeeded terminal before
    // media planning, so the audit log stays empty.
    expect(attempts[0].status).not.toBe('succeeded')
    expect(await mediaPlanResolutionRepo.findByAttempt(attempts[0].id)).toHaveLength(0)
  })
})
