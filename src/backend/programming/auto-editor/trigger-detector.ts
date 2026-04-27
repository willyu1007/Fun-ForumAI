/**
 * T-214 A-M1 — `TriggerDetector`.
 *
 * Periodic scanner that inspects forum / load state and emits
 * `AutoEditorTriggerEvent` rows when a configured trigger condition
 * fires. M1 ships:
 *   - `COMMUNITY_LULL` — community has no public root post in the past
 *     `lull_window_minutes` (default 60) and the wall clock falls inside
 *     the configured prime hours.
 *   - `GLOBAL_RUNTIME_IDLE` — `LoadSignalSnapshot.status === 'green'` for
 *     the community AND no upcoming cue is scheduled in the next
 *     `idle_lookahead_minutes`. Approximates the global-idle condition
 *     on a per-community basis until the cross-community signal lands in
 *     M2.
 *
 * M2 will add `EVENING_DISCUSSION_GAP`, `SUPPLY_FLOOR_GAP`,
 * `FATIGUE_HIGH`, `MEDIA_OPPORTUNITY` (per overview §29). The
 * deterministic dedup key keeps the same row from re-emitting within a
 * window across ticks.
 *
 * The detector NEVER calls the LLM and NEVER writes a CueChange. Its
 * only side effect is `AutoEditorTriggerEventRepository.recordIfAbsent`.
 * Downstream `AutoCueEditorScheduler` (M3) reads the new rows and drives
 * the LLM pipeline.
 */

import type { PostRepository } from '../../repos/post-repository.js'
import type { LoadSignalService } from '../../services/load-signal-service.js'
import type { AutoEditorTriggerEventRepository } from '../../repos/auto-editor-trigger-event-repository.js'
import type {
  AutoEditorTriggerEventDomain,
  AutoEditorTriggerType,
} from './types.js'

export interface TriggerDetectorConfig {
  /**
   * Window for COMMUNITY_LULL detection in minutes. If the community has
   * zero root posts in this window, the trigger fires (subject to prime
   * hours + dedup).
   */
  lullWindowMinutes?: number
  /**
   * Prime hours (inclusive start, exclusive end) in the community's
   * local clock. The detector uses UTC by default; M2 widens this to a
   * per-community timezone read.
   */
  primeHourStartUtc?: number
  primeHourEndUtcExclusive?: number
  /**
   * Lookahead window for GLOBAL_RUNTIME_IDLE in minutes. Trigger fires
   * when no cue is scheduled in the next `idleLookaheadMinutes` and the
   * community load is green.
   */
  idleLookaheadMinutes?: number
}

export interface TriggerDetectorDeps {
  postRepo: Pick<PostRepository, 'countRecentRootPostsForCommunity'>
  loadSignalService: LoadSignalService
  triggerRepo: AutoEditorTriggerEventRepository
  /**
   * Optional cue inspector — when supplied the detector cross-references
   * upcoming cues for `GLOBAL_RUNTIME_IDLE`. Without it, the idle
   * trigger only fires on green load (no schedule check).
   */
  upcomingCueProbe?: {
    hasScheduledCueWithin(
      communityId: string,
      windowMs: number,
      now: Date,
    ): Promise<boolean>
  }
  now?: () => Date
}

const DEFAULT_LULL_WINDOW_MIN = 60
const DEFAULT_PRIME_START = 18 // 18:00 UTC
const DEFAULT_PRIME_END_EXCLUSIVE = 24 // until 24:00 UTC
const DEFAULT_IDLE_LOOKAHEAD_MIN = 90

export class TriggerDetector {
  private readonly nowFn: () => Date
  private readonly lullWindowMin: number
  private readonly primeStart: number
  private readonly primeEnd: number
  private readonly idleLookaheadMin: number

  constructor(
    private readonly deps: TriggerDetectorDeps,
    config: TriggerDetectorConfig = {},
  ) {
    this.nowFn = deps.now ?? (() => new Date())
    this.lullWindowMin = config.lullWindowMinutes ?? DEFAULT_LULL_WINDOW_MIN
    this.primeStart = config.primeHourStartUtc ?? DEFAULT_PRIME_START
    this.primeEnd = config.primeHourEndUtcExclusive ?? DEFAULT_PRIME_END_EXCLUSIVE
    this.idleLookaheadMin = config.idleLookaheadMinutes ?? DEFAULT_IDLE_LOOKAHEAD_MIN
  }

  /**
   * Scan a single community for all enabled M1 triggers. Returns the
   * list of newly emitted rows (excludes dedup-suppressed candidates).
   */
  async scanCommunity(communityId: string): Promise<AutoEditorTriggerEventDomain[]> {
    const now = this.nowFn()
    const emitted: AutoEditorTriggerEventDomain[] = []

    const lull = await this.detectCommunityLull(communityId, now)
    if (lull) emitted.push(lull)

    const idle = await this.detectGlobalRuntimeIdle(communityId, now)
    if (idle) emitted.push(idle)

    return emitted
  }

  private async detectCommunityLull(
    communityId: string,
    now: Date,
  ): Promise<AutoEditorTriggerEventDomain | null> {
    if (!this.isPrimeHourUtc(now)) return null
    const since = new Date(now.getTime() - this.lullWindowMin * 60_000)
    const recentCount = await this.deps.postRepo.countRecentRootPostsForCommunity({
      communityId,
      since,
    })
    if (recentCount > 0) return null
    return this.deps.triggerRepo.recordIfAbsent({
      community_id: communityId,
      trigger_type: 'COMMUNITY_LULL',
      severity: 'standard',
      source: 'scan',
      evidence: {
        window_minutes: this.lullWindowMin,
        since_iso: since.toISOString(),
        observed_root_post_count: recentCount,
        prime_window_utc: { start: this.primeStart, end_exclusive: this.primeEnd },
      },
      dedup_key: this.dedupKey('COMMUNITY_LULL', communityId, this.windowId(now)),
      detected_at: now,
    })
  }

  private async detectGlobalRuntimeIdle(
    communityId: string,
    now: Date,
  ): Promise<AutoEditorTriggerEventDomain | null> {
    const snapshot = await this.deps.loadSignalService.get(communityId, null)
    if (snapshot.status !== 'green') return null
    if (this.deps.upcomingCueProbe) {
      const hasUpcoming = await this.deps.upcomingCueProbe.hasScheduledCueWithin(
        communityId,
        this.idleLookaheadMin * 60_000,
        now,
      )
      if (hasUpcoming) return null
    }
    return this.deps.triggerRepo.recordIfAbsent({
      community_id: communityId,
      trigger_type: 'GLOBAL_RUNTIME_IDLE',
      severity: 'low',
      source: 'scan',
      evidence: {
        load_state: snapshot.status,
        load_signal_source: snapshot.source,
        idle_lookahead_minutes: this.idleLookaheadMin,
      },
      dedup_key: this.dedupKey('GLOBAL_RUNTIME_IDLE', communityId, this.windowId(now)),
      detected_at: now,
    })
  }

  /**
   * Window id is the floored quarter-hour bucket so the same trigger
   * type within the same 15-minute slice dedupes to a single row.
   * Detector ticks faster than 15 minutes (cadence ~60s), so this
   * window is the correct dedup horizon for COMMUNITY_LULL — each
   * 15-min bucket emits at most one row even if the lull persists.
   */
  private windowId(now: Date): string {
    const ms = Math.floor(now.getTime() / (15 * 60_000))
    return `q${ms}`
  }

  private dedupKey(
    type: AutoEditorTriggerType,
    communityId: string,
    windowId: string,
  ): string {
    return `${type}:${communityId}:${windowId}`
  }

  private isPrimeHourUtc(now: Date): boolean {
    const hour = now.getUTCHours()
    return hour >= this.primeStart && hour < this.primeEnd
  }
}
