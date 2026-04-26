/**
 * T-214 A-M3 — `AutoCueEditorScheduler`.
 *
 * Periodic loop that ties together the deterministic prefix
 * (`TriggerDetector`) with the LLM-backed editor (`AutoCueEditor`) and
 * lands every accepted output as a `PublicDiscussionCueChange` row with
 * `source='automated'` + `approval_status='pending'`. The admin inbox
 * reads those rows via the routes from A-M3.
 *
 * Loop responsibilities (mirrored from `PublicDiscussionCueWorker`):
 *   - leader election (independent from the cue worker — different lease,
 *     different cadence, different blast radius)
 *   - per-tick: enumerate target communities, scan each through the
 *     detector, drive each new trigger through gate + editor, write a
 *     CueChange row on success
 *   - failure isolation: a per-trigger error logs and continues; never
 *     crashes the tick
 *
 * The scheduler does **not** apply patches to the cue domain. The
 * downstream "approve-row consumer" (separate worker, follow-on) reads
 * `approval_status='approved'` rows and applies them via the existing
 * `CueEditorService` mutation paths. Keeping the scheduler purely a
 * detect-and-write component keeps the audit chain monotonic: every
 * mutation is preceded by an explicit human approval step (MVP zero
 * auto-apply per umbrella decision D-12).
 */

import type { LeaderElector } from '../../runtime/leader-elector.js'
import type { CueRepository } from '../../repos/cue-repository.js'
import type {
  AutoCueEditor,
  AutoCueEditorMediaCandidate,
} from './auto-cue-editor.js'
import type { LoadGate } from './load-gate.js'
import type { TriggerDetector } from './trigger-detector.js'
import type {
  AutoEditorTriggerEventDomain,
} from './types.js'

export interface AutoCueEditorSchedulerDeps {
  triggerDetector: TriggerDetector
  loadGate: LoadGate
  autoCueEditor: AutoCueEditor
  cueRepo: Pick<CueRepository, 'recordChange'>
  /**
   * Returns the list of community ids to scan this tick. Production
   * wiring threads `communityRepo.listActive()`; tests pass a static
   * array. The scheduler does not enumerate communities itself so the
   * blast radius / scan cost stays under the deps' control.
   */
  communityProvider: () => Promise<string[]>
  /**
   * Resolves the filtered media-candidate set the LLM is allowed to
   * reference for a given community. Empty array means "no media may
   * be attached" — validator enforces this whitelist regardless. The
   * production wiring threads `mediaPickerService` (T-216 M3); the
   * scheduler only sees the filtered output.
   */
  mediaCandidateProvider?: (
    communityId: string,
  ) => Promise<ReadonlyArray<AutoCueEditorMediaCandidate>>
  leaderElector?: LeaderElector
  /** Override the wall clock for deterministic tests. */
  now?: () => Date
  /**
   * Hook invoked when a new trigger event yields a successful editor
   * output and a CueChange row is written. Tests use this to assert
   * end-to-end pipeline coverage without polling the repo.
   */
  onPatchProposed?: (input: {
    trigger: AutoEditorTriggerEventDomain
    changeId: string
  }) => void | Promise<void>
}

export interface AutoCueEditorSchedulerConfig {
  /**
   * Tick cadence in ms. Default 60_000 (every 60s). Faster than 30s
   * burns LLM tokens unnecessarily; slower than 5min misses lulls.
   */
  intervalMs?: number
  /**
   * Initial delay before the first tick after `start()`. Default
   * 7_000 ms — gives container init a window to settle.
   */
  startupDelayMs?: number
  /** Process / instance id for logs + lease ownership. */
  workerId?: string
}

const DEFAULT_INTERVAL_MS = 60_000
const DEFAULT_STARTUP_DELAY_MS = 7_000

export class AutoCueEditorScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private startupTimer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private ticking = false

  private readonly intervalMs: number
  private readonly startupDelayMs: number
  private readonly workerId: string

  constructor(
    private readonly deps: AutoCueEditorSchedulerDeps,
    config: AutoCueEditorSchedulerConfig = {},
  ) {
    this.intervalMs = config.intervalMs ?? DEFAULT_INTERVAL_MS
    this.startupDelayMs = config.startupDelayMs ?? DEFAULT_STARTUP_DELAY_MS
    this.workerId =
      config.workerId
      ?? `auto-cue-editor-${process.pid}-${Math.random().toString(36).slice(2, 8)}`
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
      `[AutoCueEditorScheduler] Started (worker=${this.workerId}, interval=${Math.round(this.intervalMs / 1000)}s)`,
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
    console.log('[AutoCueEditorScheduler] Stopped')
  }

  get isRunning(): boolean {
    return this.running
  }

  /**
   * Public so process supervisors / tests can drive the scheduler
   * without waiting for the timer. Returns counts useful for telemetry:
   *   - `triggersDetected`: new trigger rows landed by the detector
   *   - `proposalsWritten`: CueChange rows written this tick (a subset
   *     of triggersDetected — short-circuit / validator failures emit
   *     no row)
   *   - `errors`: per-community / per-trigger failures isolated to
   *     this tick (the loop continues regardless)
   */
  async tick(): Promise<{
    triggersDetected: number
    proposalsWritten: number
    errors: number
  }> {
    if (this.ticking) {
      return { triggersDetected: 0, proposalsWritten: 0, errors: 0 }
    }
    this.ticking = true
    let triggersDetected = 0
    let proposalsWritten = 0
    let errors = 0

    try {
      if (this.deps.leaderElector) {
        const ok = await this.deps.leaderElector.ensureLeadership()
        if (!ok) return { triggersDetected: 0, proposalsWritten: 0, errors: 0 }
      }

      const communityIds = await this.deps.communityProvider()
      for (const communityId of communityIds) {
        try {
          const newTriggers = await this.deps.triggerDetector.scanCommunity(communityId)
          triggersDetected += newTriggers.length
          for (const trigger of newTriggers) {
            try {
              const wrote = await this.processTrigger(trigger, communityId)
              if (wrote) proposalsWritten += 1
            } catch (err) {
              errors += 1
              console.error(
                `[AutoCueEditorScheduler] processTrigger failed for trigger=${trigger.id}: ${(err as Error).message}`,
              )
            }
          }
        } catch (err) {
          errors += 1
          console.error(
            `[AutoCueEditorScheduler] scanCommunity failed for community=${communityId}: ${(err as Error).message}`,
          )
        }
      }
      return { triggersDetected, proposalsWritten, errors }
    } finally {
      this.ticking = false
    }
  }

  /**
   * Drive a single trigger through gate → editor → recordChange.
   * Returns `true` iff a CueChange row was written.
   */
  private async processTrigger(
    trigger: AutoEditorTriggerEventDomain,
    communityId: string,
  ): Promise<boolean> {
    // Gate: load-state envelope.
    const gate = await this.deps.loadGate.evaluate({
      communityId,
      triggerAtIso: trigger.detected_at.toISOString(),
    })
    if (gate.short_circuit) {
      console.log(
        `[AutoCueEditorScheduler] short-circuit (red short_circuit) for trigger=${trigger.id} community=${communityId}`,
      )
      return false
    }

    // Media candidates — empty for MVP unless a provider is wired.
    const mediaCandidates = this.deps.mediaCandidateProvider
      ? await this.deps.mediaCandidateProvider(communityId)
      : []

    const inPrimeWindow = this.isPrimeWindow(trigger.detected_at)

    const result = await this.deps.autoCueEditor.run({
      trigger,
      gate,
      mediaCandidates,
      inPrimeWindow,
    })
    if (!result.ok) {
      console.log(
        `[AutoCueEditorScheduler] editor declined for trigger=${trigger.id} reason=${result.reason} attempts=${result.attempts}`,
      )
      return false
    }

    // Land as a pending CueChange row. The route layer + admin
    // approve flow takes it from here.
    const change = await this.deps.cueRepo.recordChange({
      schedule_id: null,
      cue_id: result.output.target_cue_id ?? null,
      source: 'automated',
      actor_user_id: null,
      actor_system: this.workerId,
      trigger_id: trigger.id,
      trigger_type: trigger.trigger_type,
      change_type: result.output.action,
      patch_json: result.output.patch_json,
      validation_status: 'passed',
      validation_json: {
        attempts: result.attempts,
        confidence: result.output.confidence,
        risk_reason_codes: result.risk.reason_codes,
        load_gate_reason: gate.reason_code,
      },
      risk_level: result.risk.band,
      approval_status: 'pending',
      load_snapshot_json: {
        load_state: gate.load_state,
        load_signal_source: gate.load_signal_source,
        propose_only: gate.propose_only,
        // T-214 A-M3 closer — preserve the trigger's community_id so
        // the apply step (especially `create_cue`) can resolve the
        // active schedule without re-walking the trigger event log.
        community_id: communityId,
      },
      reason: result.output.reason,
    })

    if (this.deps.onPatchProposed) {
      try {
        await this.deps.onPatchProposed({ trigger, changeId: change.id })
      } catch (err) {
        console.error(
          `[AutoCueEditorScheduler] onPatchProposed hook failed: ${(err as Error).message}`,
        )
      }
    }

    return true
  }

  /**
   * MVP prime-window: 18:00–24:00 UTC. Mirrors the detector's default;
   * timezone-aware widening lands in M2 alongside per-community config.
   */
  private isPrimeWindow(detectedAt: Date): boolean {
    const hour = detectedAt.getUTCHours()
    return hour >= 18 && hour < 24
  }
}
