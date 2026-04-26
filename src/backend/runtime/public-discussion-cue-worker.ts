/**
 * T-212 M4 — PublicDiscussionCueWorker.
 *
 * Independent lightweight loop (default 10s) per T-212 overview Risks. Lives
 * outside `RuntimeLoop` so PostScheduler isolation (invariant I-2) holds in
 * both directions: PostScheduler doesn't read cue tables, and the cue path
 * doesn't piggy-back on the autonomous tick.
 *
 * Tick sequence:
 *   1. `LeaderElector.ensureLeadership` — same precedent as
 *      `home-programming-snapshot-scheduler.ts`. Combined with
 *      `claimDueCues`'s SKIP LOCKED guarantee (M2 / R5), single-instance
 *      replay safety AND multi-instance correctness both hold.
 *   2. `CueRepository.claimDueCues` — atomic batch claim that creates the
 *      `CueExecutionAttempt` row (status='leased').
 *   3. Per cue: admission → brief → cast → write → terminal transition +
 *      domain event (CueExecutionCompleted / Failed / Cancelled).
 *
 * Cancel + rollback semantics live in M5; this milestone covers the happy
 * path and basic failure terminals so the integration spine is exercisable
 * end-to-end.
 */

import type { DataPlaneWriter } from './data-plane-writer.js'
import type { CreatePostWriteInstruction } from './types.js'
import type { LeaderElector } from './leader-elector.js'
import type {
  CueRepository,
  ClaimedCue,
  PublicDiscussionCueMediaDomain,
} from '../repos/cue-repository.js'
import type { EventRepository } from '../repos/event-repository.js'
import type { DomainEvent } from '../repos/types.js'
import type { CommunityBudgetReservation } from '../services/community-budget-service.js'
import type {
  CueAdmissionController,
} from '../programming/cue/cue-admission-controller.js'
import type { CommunityBudgetService } from '../services/community-budget-service.js'
import type {
  DirectorCueBrief,
  DirectorCueBriefService,
} from '../programming/cue/director-cue-brief.js'
import type {
  CueSceneSelection,
  CueSceneDryRunResult,
  PublicSceneSelectorService,
} from '../services/public-scene-selector-service.js'
import type {
  PublicSceneWritePayload,
  ScenePayloadProgramming,
} from '../services/public-scene-runtime.js'
import type { PublicDiscussionCueDomain } from '../programming/cue/types.js'
import type { CueMediaPlanForWrite } from '../media/cue-media-planner.js'
import {
  buildCueExecutionCancelledEvent,
  buildCueExecutionCompletedEvent,
  buildCueExecutionFailedEvent,
} from '../programming/cue/cue-domain-events.js'
import type { CueExecutionAttemptDomain } from '../repos/cue-repository.js'

// =============================================================================
// External seam types
// =============================================================================

/**
 * Lookup the community details a cue points at. The worker calls this once
 * per claim so the selector can target the right surface. M4 keeps the
 * shape minimal — bootstrap will adapt `forum-read-service.findCommunityById`.
 */
export interface CueCommunityResolver {
  resolve(
    communityId: string,
  ): Promise<{
    id: string
    slug: string
    name: string
    description: string
    rules: string
  } | null>
}

/**
 * Pick the cast for a cue. M4 ships a deterministic stub via the bootstrap;
 * the seam is here so future iterations can wire the allocator without
 * touching the worker.
 */
export interface CueCastResolver {
  resolveCast(
    cue: PublicDiscussionCueDomain,
  ): Promise<Array<{ id: string; display_name: string }>>
}

/**
 * Generate the post body + title for a cue scene. M4 ships a simple
 * brief-derived stub; the LLM-backed implementation is a follow-up wiring
 * (the worker stays oblivious to LLM details).
 */
export interface CueContentGenerator {
  generate(input: {
    cue: PublicDiscussionCueDomain
    brief: DirectorCueBrief
    scenePayload: PublicSceneWritePayload
    primaryAuthor: { id: string; display_name: string }
  }): Promise<{
    title: string
    body: string
    tags?: string[]
    /** For audit linkage to LLM usage if a real generator is wired in. */
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    latency_ms?: number
  }>
}

// =============================================================================
// Worker config + deps
// =============================================================================

export interface PublicDiscussionCueWorkerConfig {
  /** Tick interval in ms; default 10s. */
  intervalMs?: number
  /** First tick delay after start; default 5s. */
  startupDelayMs?: number
  /** Cues with `triggerAt <= now + grace` are eligible. Default 60s. */
  graceSeconds?: number
  /** DB lease horizon per claimed cue. Default 120s. */
  leaseSeconds?: number
  /** Max cues claimed per tick. Default 4. */
  batchSize?: number
  /** Identifier of this worker instance for audit / lease ownership. */
  workerId?: string
}

/**
 * Hook invoked once per persisted cue domain event so it fans out through
 * the existing `forum-event-dispatcher` (search projection / achievements /
 * SSE / stats / etc.). T-211 §F.4 mandates that the new cue event types are
 * additive on the dispatcher; bypassing it would silently drop downstream
 * consumers.
 */
export type CueEventDispatchHook = (event: DomainEvent) => Promise<void> | void

export interface PublicDiscussionCueWorkerDeps {
  cueRepo: CueRepository
  admissionController: CueAdmissionController
  directorCueBrief: DirectorCueBriefService
  sceneSelector: Pick<PublicSceneSelectorService, 'selectFromDiscussionCue'>
  dataPlaneWriter: Pick<DataPlaneWriter, 'write'>
  eventRepo: EventRepository
  communityBudgetService: Pick<CommunityBudgetService, 'release'>
  communityResolver: CueCommunityResolver
  castResolver: CueCastResolver
  contentGenerator: CueContentGenerator
  /**
   * Optional but production-required: invoked after every cue domain event
   * is persisted so consumers downstream of `forum-event-dispatcher`
   * observe `CueExecutionCompleted/Failed/Cancelled/Dispatched`. Tests may
   * leave this unset to assert only the persistence side.
   */
  eventDispatcher?: CueEventDispatchHook
  /**
   * T-216 — optional planner. In anchor mode it resolves cue media before
   * the data-plane write, then records the pre-write decision after a
   * successful write. Tests that don't care about media audit leave this
   * unset to keep fixture surface area minimal.
   */
  cueMediaPlanner?: import('../media/cue-media-planner.js').CueMediaPlanner
  leaderElector?: LeaderElector
  /** Override the wall clock for deterministic tests. */
  now?: () => Date
}

// =============================================================================
// Default config
// =============================================================================

const DEFAULT_INTERVAL_MS = 10_000
const DEFAULT_STARTUP_DELAY_MS = 5_000
const DEFAULT_GRACE_SECONDS = 60
const DEFAULT_LEASE_SECONDS = 120
const DEFAULT_BATCH_SIZE = 4

// =============================================================================
// Worker
// =============================================================================

export class PublicDiscussionCueWorker {
  private timer: ReturnType<typeof setInterval> | null = null
  private startupTimer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private ticking = false

  private readonly intervalMs: number
  private readonly startupDelayMs: number
  private readonly graceSeconds: number
  private readonly leaseSeconds: number
  private readonly batchSize: number
  private readonly workerId: string

  constructor(
    private readonly deps: PublicDiscussionCueWorkerDeps,
    config: PublicDiscussionCueWorkerConfig = {},
  ) {
    this.intervalMs = config.intervalMs ?? DEFAULT_INTERVAL_MS
    this.startupDelayMs = config.startupDelayMs ?? DEFAULT_STARTUP_DELAY_MS
    this.graceSeconds = config.graceSeconds ?? DEFAULT_GRACE_SECONDS
    this.leaseSeconds = config.leaseSeconds ?? DEFAULT_LEASE_SECONDS
    this.batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE
    this.workerId =
      config.workerId ??
      `cue-worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.timer = setInterval(() => {
      void this.tick()
    }, this.intervalMs)
    this.startupTimer = setTimeout(() => {
      this.startupTimer = null
      void this.tick()
    }, this.startupDelayMs)
    console.log(
      `[PublicDiscussionCueWorker] Started (worker=${this.workerId}, interval=${Math.round(this.intervalMs / 1000)}s, batch=${this.batchSize}, lease=${this.leaseSeconds}s)`,
    )
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.startupTimer) {
      clearTimeout(this.startupTimer)
      this.startupTimer = null
    }
    if (this.deps.leaderElector) {
      void this.deps.leaderElector.releaseLeadership()
    }
    console.log('[PublicDiscussionCueWorker] Stopped')
  }

  get isRunning(): boolean {
    return this.running
  }

  /**
   * Public so process supervisors / tests can drive the worker without
   * waiting for the timer. Returns the number of cues processed (success +
   * failure + skip — every claim consumes one slot) and the number of
   * cues that ran the prewarm dry-run sweep this tick.
   */
  async tick(): Promise<{ processed: number; prewarmed: number }> {
    if (this.ticking) return { processed: 0, prewarmed: 0 }
    this.ticking = true
    try {
      if (this.deps.leaderElector) {
        const ok = await this.deps.leaderElector.ensureLeadership()
        if (!ok) return { processed: 0, prewarmed: 0 }
      }

      const now = this.now()

      // T-212 M5 — prewarm dry-run sweep precedes the claim phase. Cues
      // whose `prewarm_at` window opened are taken through dry-run checks
      // (load read, media revalidation, brief compile, selector dry-run).
      // Failure flips the cue to `deferred` without consuming an attempt;
      // success transitions to `prewarming` (the claim filter accepts that
      // status when triggerAt is reached, so the prewarmed cue is the next
      // one picked up).
      const prewarmed = await this.runPrewarmSweep(now)

      const claims = await this.deps.cueRepo.claimDueCues({
        now,
        graceSeconds: this.graceSeconds,
        leaseOwner: this.workerId,
        leaseSeconds: this.leaseSeconds,
        batchSize: this.batchSize,
      })
      if (prewarmed > 0 || claims.length > 0) {
        console.log(
          `[PublicDiscussionCueWorker] tick prewarmed=${prewarmed} claims=${claims.length}`,
        )
      }

      for (const claim of claims) {
        try {
          await this.processClaim(claim)
        } catch (err) {
          // Final safety net — should not be reachable because processClaim
          // catches its own errors. If we hit this, log loudly and move on.
          console.error(
            `[PublicDiscussionCueWorker] processClaim threw for cue=${claim.cue.id} attempt=${claim.attempt.id}: ${(err as Error).message}`,
          )
        }
      }
      return { processed: claims.length, prewarmed }
    } catch (err) {
      console.error('[PublicDiscussionCueWorker] tick error:', err)
      return { processed: 0, prewarmed: 0 }
    } finally {
      this.ticking = false
    }
  }

  /**
   * T-212 M5 — prewarm dry-run sweep.
   *
   * Each prewarmable cue is taken through the same admission gate the
   * actual execution will use (without holding a reservation across the
   * window — soft-hold maintenance across ticks is deferred to T-213) plus
   * brief compile + selector dry-run + media revalidation. Failure flips
   * the cue to `deferred` and emits no event (no attempt is consumed).
   * Success leaves the cue in `prewarming` so the next claim window picks
   * it up with the dry-run state already cached in audit history.
   */
  private async runPrewarmSweep(now: Date): Promise<number> {
    const candidates = await this.deps.cueRepo.findPrewarmableCues({
      now,
      batchSize: this.batchSize,
    })
    let prewarmed = 0
    for (const cue of candidates) {
      try {
        // Mark prewarming first so concurrent ticks don't re-pick the cue.
        const moved = await this.deps.cueRepo.setCueStatus(cue.id, 'prewarming')
        if (!moved) continue

        // Best-effort dry-run admission — release any reservation immediately.
        const admission = await this.deps.admissionController.evaluate({ cue, now })
        if (admission.reservation) {
          await this.releaseReservation(admission.reservation)
        }
        if (!admission.result.granted) {
          await this.deps.cueRepo.setCueStatus(cue.id, 'deferred')
          continue
        }

        const media = await this.loadMediaForCue(cue.id)
        const brief = await this.deps.directorCueBrief.compile({
          cue,
          dryRun: true,
          media,
        })

        const communityId = resolveCueCommunityId(cue)
        const community = communityId
          ? await this.deps.communityResolver.resolve(communityId)
          : null
        if (!community) {
          await this.deps.cueRepo.setCueStatus(cue.id, 'deferred')
          continue
        }
        const cast = await this.deps.castResolver.resolveCast(cue)
        if (cast.length === 0) {
          await this.deps.cueRepo.setCueStatus(cue.id, 'deferred')
          continue
        }
        const dryResult = await this.deps.sceneSelector.selectFromDiscussionCue({
          cue: { id: cue.id, community_id: communityId! },
          brief: { audit_refs: brief.programming.audit_refs },
          community,
          agents: cast,
          dryRun: true,
        })
        if (dryResult.kind !== 'dry_run') {
          await this.deps.cueRepo.setCueStatus(cue.id, 'deferred')
          continue
        }
        prewarmed += 1
      } catch (err) {
        console.warn(
          `[PublicDiscussionCueWorker] prewarm dry-run failed for cue=${cue.id}: ${(err as Error).message}`,
        )
        await this.deps.cueRepo.setCueStatus(cue.id, 'deferred').catch(() => {})
      }
    }
    return prewarmed
  }

  // ===========================================================================
  // Per-claim processing
  // ===========================================================================

  private async processClaim(claim: ClaimedCue): Promise<void> {
    const { cue, attempt } = claim
    const start = this.now()

    // ---- Resolve the community ----
    const communityId = resolveCueCommunityId(cue)
    if (!communityId) {
      // Structural defect — no retry budget can fix a missing community_id.
      await this.failClaim(claim, {
        terminalCueStatus: 'failed',
        terminalAttemptStatus: 'failed',
        reasonCodes: ['cue_missing_community_id'],
        errorCode: 'cue_missing_community_id',
        errorText: 'cue has no resolvable community',
        retryable: false,
      })
      return
    }
    const community = await this.deps.communityResolver.resolve(communityId)
    if (!community) {
      await this.failClaim(claim, {
        terminalCueStatus: 'failed',
        terminalAttemptStatus: 'failed',
        reasonCodes: [`community_not_found:${communityId}`],
        errorCode: 'community_not_found',
        errorText: `community ${communityId} not found`,
      })
      return
    }

    // ---- Admission ----
    const admission = await this.deps.admissionController.evaluate({ cue, now: start })
    if (!admission.result.granted) {
      const isDefer = admission.result.decision === 'defer'
      await this.deferOrSkipClaim(claim, {
        cueStatus: isDefer ? 'deferred' : 'skipped',
        attemptStatus: isDefer ? 'delayed' : 'skipped',
        reasonCodes: admission.result.reason_codes,
        // T-212 Bug #4 fix — propagate the admission controller's hint so
        // the cue isn't re-claimed on the next 10s tick when the gating
        // condition is known to need a longer cooldown (e.g. budget defer).
        recommendedNextTriggerAt: admission.result.recommended_next_trigger_at,
      })
      return
    }
    const reservation = admission.reservation

    // ---- Cast ----
    const cast = await this.deps.castResolver.resolveCast(cue)
    if (cast.length === 0) {
      await this.releaseReservation(reservation)
      await this.failClaim(claim, {
        terminalCueStatus: 'skipped',
        terminalAttemptStatus: 'skipped',
        reasonCodes: ['no_eligible_cast'],
        errorCode: 'no_eligible_cast',
        errorText: 'no agents available for cue cast',
      })
      return
    }

    // ---- Director brief ----
    const media = await this.loadMediaForCue(cue.id)
    const brief = await this.deps.directorCueBrief.compile({
      cue,
      attemptId: attempt.id,
      media,
      // change_ids audit linkage is left unset for the MVP cue path; a
      // post-T-212 follow-up wires `cueRepo.listChangesForCue(cue.id)`
      // through the brief so the audit chain captures every CuePatch
      // applied to this cue without having to re-walk the change table at
      // read time.
    })

    // ---- Scene selection ----
    const selection = await this.deps.sceneSelector.selectFromDiscussionCue({
      cue: { id: cue.id, community_id: communityId },
      brief: { audit_refs: brief.programming.audit_refs },
      community,
      agents: cast,
    })
    if (isDryRunResult(selection) || selection.kind === 'skip') {
      await this.releaseReservation(reservation)
      const reason =
        selection.kind === 'skip' ? selection.reason : 'unexpected_dry_run'
      await this.failClaim(claim, {
        terminalCueStatus: 'skipped',
        terminalAttemptStatus: 'skipped',
        reasonCodes: [`selector_${reason}`],
        errorCode: 'selector_skip',
        errorText: `selector returned ${selection.kind}: ${reason}`,
      })
      return
    }

    // ---- Mark attempt as executing + record audit JSON ----
    const primary = cast[0]
    await this.deps.cueRepo.updateAttempt(attempt.id, {
      status: 'executing',
      started_at: start,
      admission_result_json: admission.result,
      director_brief_json: brief,
      selected_cast_json: cast.map((agent) => ({
        agent_id: agent.id,
        display_name: agent.display_name,
      })),
    })
    // Cue stays at 'claimed' through executing; we transition to 'executing'
    // so observability dashboards can distinguish leased-but-not-yet-running
    // from actively-executing.
    await this.deps.cueRepo.setCueStatus(cue.id, 'executing')

    // T-212 M5 — admin cancel detection at every external-call boundary.
    // The cue editor's cancelCue / forceSkipCue paths flip cue.status to
    // 'cancelled' / 'skipped' independently of the worker; we re-read before
    // each external call so the worker aborts gracefully. The post-write
    // boundary annotates `force_cancelled_post_write` because the post is
    // already published at that point.
    if (await this.observeAdminCancel(cue.id)) {
      await this.handleAdminCancel(claim, reservation, {
        forcePostWrite: false,
        reason: 'cancelled_before_content',
      })
      return
    }

    // ---- Stamp programming attribution onto the scene payload (I-1) ----
    const programming: ScenePayloadProgramming = {
      production_path: 'cue',
      cue: {
        schedule_id: cue.schedule_id,
        cue_id: cue.id,
        attempt_id: attempt.id,
        source_type: cue.source_type,
        ...(brief.programming.audit_refs.change_ids
          ? { change_ids: [...brief.programming.audit_refs.change_ids] }
          : {}),
      },
    }
    const scenePayload: PublicSceneWritePayload = {
      ...selection.payload,
      programming,
    }

    // ---- Generate content ----
    let content
    try {
      content = await this.deps.contentGenerator.generate({
        cue,
        brief,
        scenePayload,
        primaryAuthor: primary,
      })
    } catch (err) {
      await this.releaseReservation(reservation)
      await this.failClaim(claim, {
        terminalCueStatus: 'failed',
        terminalAttemptStatus: 'failed',
        reasonCodes: ['content_generator_error'],
        errorCode: 'content_generator_error',
        errorText: (err as Error).message,
      })
      return
    }

    // T-212 M5 — second cancel boundary, after the (potentially expensive)
    // content generation completes but before the data plane write. If admin
    // cancelled while the LLM was running, the in-flight call has finished
    // (we cannot safely interrupt it) but we abort the write step.
    if (await this.observeAdminCancel(cue.id)) {
      await this.handleAdminCancel(claim, reservation, {
        forcePostWrite: false,
        reason: 'cancelled_after_content_before_write',
      })
      return
    }

    // ---- Pre-write media planning ----
    let mediaPlanForWrite: Extract<CueMediaPlanForWrite, { kind: 'ready' }> | null = null
    let effectiveScenePayload = scenePayload
    if (this.deps.cueMediaPlanner) {
      const mediaPlan = await this.deps.cueMediaPlanner.planForWrite({
        attemptId: attempt.id,
        brief,
        media,
        scenePayload,
        communityId,
        agentId: primary.id,
        degradedMedia: admission.result.degraded_media === true,
      })
      if (mediaPlan.kind === 'failed') {
        await this.releaseReservation(reservation)
        await this.failClaim(claim, {
          terminalCueStatus: 'failed',
          terminalAttemptStatus: 'failed',
          reasonCodes: [mediaPlan.reasonCode],
          errorCode: mediaPlan.reasonCode,
          errorText: mediaPlan.errorText,
          retryable: mediaPlan.retryable,
        })
        return
      }
      mediaPlanForWrite = mediaPlan
      effectiveScenePayload = mediaPlan.scenePayload
    }

    // T-216 planning can call the media stack. Re-check admin cancel before
    // we emit the dispatch event and publish the post.
    if (this.deps.cueMediaPlanner && await this.observeAdminCancel(cue.id)) {
      await this.handleAdminCancel(claim, reservation, {
        forcePostWrite: false,
        reason: 'cancelled_after_media_planning_before_write',
      })
      return
    }

    // ---- Trigger event for the agent run linkage ----
    const triggerEvent = await this.emitCueEvent({
      event_type: 'CUE_EXECUTION_DISPATCHED',
      plane: 'CONTROL',
      schema_version: 'v1',
      community_id: communityId,
      actor_type: 'system',
      actor_id: this.workerId,
      correlation_id: `cue:${cue.id}:attempt:${attempt.id}`,
      payload_json: {
        attempt_id: attempt.id,
        cue_id: cue.id,
        schedule_id: cue.schedule_id,
        primary_author_id: primary.id,
        cast_size: cast.length,
      },
    })

    // ---- Write the post ----
    const instruction: CreatePostWriteInstruction = {
      action: 'create_post',
      community_id: communityId,
      title: content.title,
      body: content.body,
      tags: content.tags,
      public_scene: effectiveScenePayload,
      audit_metadata: {
        cue_attempt_id: attempt.id,
        cue_id: cue.id,
        schedule_id: cue.schedule_id,
        ...(mediaPlanForWrite?.imagePlanId
          ? {
              visual_directive_id: effectiveScenePayload.visual_ref?.directive_id,
              image_plan_id: mediaPlanForWrite.imagePlanId,
              planner_status: effectiveScenePayload.planning_audit?.planner_status,
              planner_decision: effectiveScenePayload.planning_audit?.planner_decision,
            }
          : {}),
      },
      ...(mediaPlanForWrite?.imagePlanId
        ? {
            image_plan_id: mediaPlanForWrite.imagePlanId,
            display_attachment_refs: mediaPlanForWrite.displayAttachmentRefs ?? [],
          }
        : {}),
    }

    const writeStart = this.now()
    let writeResult
    try {
      writeResult = await this.deps.dataPlaneWriter.write(
        instruction,
        primary.id,
        triggerEvent.id,
        content.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        content.latency_ms ?? 0,
      )
    } catch (err) {
      await this.releaseReservation(reservation)
      await this.failClaim(claim, {
        terminalCueStatus: 'failed',
        terminalAttemptStatus: 'failed',
        reasonCodes: ['write_threw'],
        errorCode: 'write_threw',
        errorText: (err as Error).message,
      })
      return
    }
    const writeLatencyMs = this.now().getTime() - writeStart.getTime()

    if (!writeResult.success || !writeResult.content_id) {
      await this.releaseReservation(reservation)
      await this.failClaim(claim, {
        terminalCueStatus: 'failed',
        terminalAttemptStatus: 'failed',
        reasonCodes: ['write_failed'],
        errorCode: 'write_failed',
        errorText: writeResult.error ?? 'write_failed',
      })
      return
    }

    // ---- Success terminal ----
    const finishedAt = this.now()
    const totalLatencyMs = finishedAt.getTime() - start.getTime()

    // T-212 M5 — third cancel boundary: post-write. The post is already
    // published; we cannot retract it. The attempt still terminates as
    // `succeeded` (the post exists and is attributable) but we emit
    // `CueExecutionCancelled` with `force_cancelled_post_write: true` so
    // downstream observability can surface the late-cancel race separately
    // from clean completion.
    const cancelledAfterWrite = await this.observeAdminCancel(cue.id)
    await this.deps.cueRepo.updateAttempt(attempt.id, {
      status: 'succeeded',
      post_id: writeResult.content_id,
      total_latency_ms: totalLatencyMs,
      finished_at: finishedAt,
      lease_owner: null,
      lease_expires_at: null,
    })
    if (cancelledAfterWrite) {
      // Cue.status was already flipped to cancelled/skipped by the editor;
      // we record the post-write annotation on the change audit by emitting
      // a Cancelled event but leave cue.status as the editor set it.
      await this.releaseReservation(reservation)
      const cancelledEvent = buildCueExecutionCancelledEvent({
        attempt_id: attempt.id,
        cue_id: cue.id,
        schedule_id: cue.schedule_id,
        community_id: communityId,
        occurred_at: finishedAt,
        lease_owner: this.workerId,
        change_ids: brief.programming.audit_refs.change_ids,
        cancelled_by: { actor_type: 'system', actor_id: this.workerId },
        reason: 'cancelled_after_content_after_write',
        force_cancelled_post_write: true,
      })
      await this.emitCueEvent(cancelledEvent)
      return
    }
    await this.deps.cueRepo.setCueStatus(cue.id, 'consumed')
    await this.releaseReservation(reservation)
    void writeLatencyMs

    // T-216 — persist the pre-write media decision after the post succeeds.
    // Best-effort: failure here MUST NOT roll back the consumed cue or
    // block the completed event. The post is already published; the audit
    // row gap is the worst case and is logged for ops triage.
    if (this.deps.cueMediaPlanner) {
      try {
        await this.deps.cueMediaPlanner.record({
          attemptId: attempt.id,
          brief,
          degradedMedia: admission.result.degraded_media === true,
          imagePlannerDecisionsByAssetId:
            mediaPlanForWrite?.imagePlannerDecisionsByAssetId,
          derivativeSourcedAnchorAssetIds:
            mediaPlanForWrite?.derivativeSourcedAnchorAssetIds,
          activePlanEnforced: Boolean(mediaPlanForWrite?.imagePlanId),
        })
      } catch (err) {
        console.error(
          `[PublicDiscussionCueWorker] cueMediaPlanner.record failed for attempt ${attempt.id}: ${(err as Error).message}`,
        )
      }
    }

    const completedEvent = buildCueExecutionCompletedEvent({
      attempt_id: attempt.id,
      cue_id: cue.id,
      schedule_id: cue.schedule_id,
      community_id: communityId,
      occurred_at: finishedAt,
      lease_owner: this.workerId,
      change_ids: brief.programming.audit_refs.change_ids,
      post_id: writeResult.content_id,
      selected_cast: cast.map((agent) => ({ agent_id: agent.id })),
      media_usage: mediaPlanForWrite?.mediaUsage,
    })
    await this.emitCueEvent(completedEvent)
  }

  /**
   * Persist the event AND fan it out through the dispatcher hook so
   * existing consumers (search projection / achievements / SSE / stats)
   * observe the cue lifecycle. Hook errors are isolated — a downstream
   * crash MUST NOT roll back the persisted attempt state.
   */
  private async emitCueEvent(input: Parameters<EventRepository['create']>[0]): Promise<DomainEvent> {
    const event = this.deps.eventRepo.create(input)
    if (this.deps.eventDispatcher) {
      try {
        await this.deps.eventDispatcher(event)
      } catch (err) {
        console.error(
          `[PublicDiscussionCueWorker] event dispatcher failed for ${event.event_type} (${event.id}): ${(err as Error).message}`,
        )
      }
    }
    return event
  }

  /**
   * Re-read the cue and check whether the editor has flipped it to a
   * terminal status indicating admin abort. Returns true iff cue is in
   * `'cancelled'` or `'skipped'` (`cancelCue` / `forceSkipCue` paths).
   */
  private async observeAdminCancel(cueId: string): Promise<boolean> {
    const fresh = await this.deps.cueRepo.findCueById(cueId)
    if (!fresh) return false
    return fresh.status === 'cancelled' || fresh.status === 'skipped'
  }

  /**
   * Mid-execution cancel: attempt → cancelled, release reservation, emit
   * `CueExecutionCancelled` (no Failed event). Cue.status was already set
   * by the editor; the worker only mirrors the terminal on the attempt row.
   */
  private async handleAdminCancel(
    claim: ClaimedCue,
    reservation: CommunityBudgetReservation | undefined,
    input: { forcePostWrite: boolean; reason: string },
  ): Promise<void> {
    const finishedAt = this.now()
    await this.deps.cueRepo.updateAttempt(claim.attempt.id, {
      status: 'cancelled',
      error_code: 'admin_cancelled',
      error_text: input.reason,
      finished_at: finishedAt,
      lease_owner: null,
      lease_expires_at: null,
    })
    await this.releaseReservation(reservation)
    const cancelledEvent = buildCueExecutionCancelledEvent({
      attempt_id: claim.attempt.id,
      cue_id: claim.cue.id,
      schedule_id: claim.cue.schedule_id,
      community_id: resolveCueCommunityId(claim.cue),
      occurred_at: finishedAt,
      lease_owner: this.workerId,
      cancelled_by: { actor_type: 'human', actor_id: null },
      reason: input.reason,
      force_cancelled_post_write: input.forcePostWrite,
    })
    await this.emitCueEvent(cancelledEvent)
  }

  // ===========================================================================
  // Failure / defer helpers
  // ===========================================================================

  private async deferOrSkipClaim(
    claim: ClaimedCue,
    input: {
      cueStatus: 'deferred' | 'skipped'
      attemptStatus: 'delayed' | 'skipped'
      reasonCodes: string[]
      /**
       * Optional ISO-8601 timestamp from `AdmissionResult.recommended_next_trigger_at`.
       * When supplied + future, `cue.trigger_at` is bumped so the next claim
       * window doesn't re-fire immediately. Without this, deferred cues
       * with stale trigger_at re-claim every tick (busy-loop).
       */
      recommendedNextTriggerAt?: string
    },
  ): Promise<void> {
    const finishedAt = this.now()
    await this.deps.cueRepo.updateAttempt(claim.attempt.id, {
      status: input.attemptStatus,
      error_code: input.reasonCodes[0] ?? 'admission_denied',
      error_text: input.reasonCodes.join(','),
      finished_at: finishedAt,
      lease_owner: null,
      lease_expires_at: null,
    })
    await this.deps.cueRepo.setCueStatus(claim.cue.id, input.cueStatus)
    // T-212 Bug #4 fix: bump trigger_at on defer so the worker doesn't
    // re-claim on the very next tick (would otherwise burn budget
    // reservations + emit duplicate defer events in a loop). Prefer the
    // admission controller's `recommended_next_trigger_at` (knows when the
    // gating condition will plausibly clear); fall back to the cue's
    // `dispatch_policy.retry_backoff_seconds` so even unannotated defers
    // get a sane backoff rather than a tight loop (T-212 dynamic-bug fix).
    if (input.cueStatus === 'deferred') {
      let nextTriggerMs: number | null = null
      if (input.recommendedNextTriggerAt) {
        const parsed = Date.parse(input.recommendedNextTriggerAt)
        if (Number.isFinite(parsed) && parsed > finishedAt.getTime()) {
          nextTriggerMs = parsed
        }
      }
      if (nextTriggerMs == null) {
        const backoffSeconds = Math.max(
          1,
          claim.cue.dispatch_policy.retry_backoff_seconds,
        )
        nextTriggerMs = finishedAt.getTime() + backoffSeconds * 1000
      }
      await this.deps.cueRepo.updateCue(claim.cue.id, {
        trigger_at: new Date(nextTriggerMs),
      })
    }

    // Defer is a recoverable terminal — the cue can be re-claimed at the
    // next trigger window. Skip is a one-shot give-up. Either way we emit
    // a Failed event so downstream consumers see the terminal.
    const failedEvent = buildCueExecutionFailedEvent({
      attempt_id: claim.attempt.id,
      cue_id: claim.cue.id,
      schedule_id: claim.cue.schedule_id,
      community_id: resolveCueCommunityId(claim.cue),
      occurred_at: finishedAt,
      lease_owner: this.workerId,
      terminal_status: input.attemptStatus === 'skipped' ? 'skipped' : 'failed',
      reason_codes: input.reasonCodes,
    })
    await this.emitCueEvent(failedEvent)
  }

  private async failClaim(
    claim: ClaimedCue,
    input: {
      terminalCueStatus: 'failed' | 'skipped'
      terminalAttemptStatus: Extract<
        CueExecutionAttemptDomain['status'],
        'failed' | 'skipped' | 'misfired'
      >
      reasonCodes: string[]
      errorCode?: string
      errorText?: string
      /**
       * When `true` (the default for transient terminals like
       * `write_failed`/`content_generator_error`/`community_not_found`), the
       * worker honors `dispatch_policy.max_attempts`: if `attempt_no` is
       * still under the budget, the cue rolls back to `deferred` with a
       * backoff, leaving room for the next tick to retry. Set `false` for
       * non-recoverable terminals (e.g. cue is structurally infeasible).
       */
      retryable?: boolean
    },
  ): Promise<void> {
    const finishedAt = this.now()

    // T-212 Bug #3 fix — honor dispatch_policy.max_attempts. Transient
    // failures within the budget retry on the next tick after a backoff;
    // exhausted ones go terminal.
    const retryable = input.retryable ?? input.terminalAttemptStatus === 'failed'
    const maxAttempts = claim.cue.dispatch_policy.max_attempts
    const backoffSeconds = claim.cue.dispatch_policy.retry_backoff_seconds
    const shouldRetry =
      retryable &&
      input.terminalCueStatus === 'failed' &&
      claim.attempt.attempt_no < maxAttempts

    if (shouldRetry) {
      const nextTrigger = new Date(
        finishedAt.getTime() + Math.max(0, backoffSeconds) * 1000,
      )
      await this.deps.cueRepo.updateAttempt(claim.attempt.id, {
        status: 'failed',
        error_code: input.errorCode ?? null,
        error_text: input.errorText ?? null,
        finished_at: finishedAt,
        lease_owner: null,
        lease_expires_at: null,
      })
      // Cue goes back to `deferred`; the next claim picks it up after the
      // backoff. attempt_no will increment via `claimDueCues`'s
      // max(attempt_no)+1 logic.
      await this.deps.cueRepo.setCueStatus(claim.cue.id, 'deferred')
      await this.deps.cueRepo.updateCue(claim.cue.id, { trigger_at: nextTrigger })
      const failedEvent = buildCueExecutionFailedEvent({
        attempt_id: claim.attempt.id,
        cue_id: claim.cue.id,
        schedule_id: claim.cue.schedule_id,
        community_id: resolveCueCommunityId(claim.cue),
        occurred_at: finishedAt,
        lease_owner: this.workerId,
        terminal_status: 'failed',
        reason_codes: [
          ...input.reasonCodes,
          `retry_in:${backoffSeconds}s`,
          `attempt:${claim.attempt.attempt_no}/${maxAttempts}`,
        ],
        error_code: input.errorCode ?? null,
        error_text: input.errorText ?? null,
      })
      await this.emitCueEvent(failedEvent)
      return
    }

    await this.deps.cueRepo.updateAttempt(claim.attempt.id, {
      status: input.terminalAttemptStatus,
      error_code: input.errorCode ?? null,
      error_text: input.errorText ?? null,
      finished_at: finishedAt,
      lease_owner: null,
      lease_expires_at: null,
    })
    await this.deps.cueRepo.setCueStatus(claim.cue.id, input.terminalCueStatus)
    const failedEvent = buildCueExecutionFailedEvent({
      attempt_id: claim.attempt.id,
      cue_id: claim.cue.id,
      schedule_id: claim.cue.schedule_id,
      community_id: resolveCueCommunityId(claim.cue),
      occurred_at: finishedAt,
      lease_owner: this.workerId,
      terminal_status: input.terminalAttemptStatus,
      reason_codes: input.reasonCodes,
      error_code: input.errorCode ?? null,
      error_text: input.errorText ?? null,
    })
    await this.emitCueEvent(failedEvent)
  }

  private async releaseReservation(
    reservation: CommunityBudgetReservation | undefined,
  ): Promise<void> {
    if (!reservation) return
    try {
      await this.deps.communityBudgetService.release(reservation.reservationId)
    } catch (err) {
      console.error(
        `[PublicDiscussionCueWorker] release(${reservation.reservationId}) failed: ${(err as Error).message}`,
      )
    }
  }

  private async loadMediaForCue(
    cueId: string,
  ): Promise<PublicDiscussionCueMediaDomain[]> {
    try {
      return await this.deps.cueRepo.listMediaForCue(cueId)
    } catch (err) {
      console.warn(
        `[PublicDiscussionCueWorker] listMediaForCue(${cueId}) failed: ${(err as Error).message}`,
      )
      return []
    }
  }

  private now(): Date {
    return this.deps.now ? this.deps.now() : new Date()
  }
}

// =============================================================================
// Helpers
// =============================================================================

function resolveCueCommunityId(cue: PublicDiscussionCueDomain): string | null {
  if (cue.community_id) return cue.community_id
  if (cue.scope.mode === 'single' && cue.scope.community_id) {
    return cue.scope.community_id
  }
  return null
}

function isDryRunResult(
  result: CueSceneSelection | CueSceneDryRunResult,
): result is CueSceneDryRunResult {
  return result.kind === 'dry_run'
}
