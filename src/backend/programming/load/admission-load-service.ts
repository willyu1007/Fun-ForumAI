/**
 * T-213 M1 — `AdmissionLoadService` (live, hot-path).
 *
 * Computes a `LoadSnapshot` on demand for the cue admission controller.
 * Admission never reads cached snapshots (per T-213 acceptance criterion);
 * the cached `LoadSignalService` (M2) reads the cached row from
 * `community_runtime_load_snapshots` and falls back to `compute()` on a
 * cache miss.
 *
 * Performance target: p95 < 30 ms. The snapshot is built from up to 4
 * parallel `Promise.all` count queries against the cue, attempt, and post
 * tables (the LLM/media queue depth signals are read from injectable
 * observability primitives — defaulting to `null` until later milestones
 * wire them up).
 *
 * Threshold semantics:
 *   - GREEN  → all signals strictly below their `warn` threshold
 *   - YELLOW → at least one signal at-or-above `warn`, none at `critical`
 *   - RED    → at least one signal at-or-above `critical`, OR multiple
 *              signals at-or-above `warn` (defense in depth)
 *
 * Threshold defaults are deliberately conservative; T-213 M4 / production
 * tuning may shift them via the constructor's `thresholds` option.
 */

import type {
  CountAttemptsForCommunityInput,
  CountCuesForCommunityInput,
  CueRepository,
} from '../../repos/cue-repository.js'
import { IN_FLIGHT_ATTEMPT_STATUSES } from '../../repos/cue-repository.js'
import type { PostRepository } from '../../repos/post-repository.js'
import type { LoadSnapshot, LoadState } from './types.js'

// =============================================================================
// Threshold config
// =============================================================================

export interface LoadThresholds {
  /** Cues currently in `executing` for the community. */
  executingCueCount: { warn: number; critical: number }
  /** Cues `scheduled` whose `trigger_at` falls within the next 30 minutes. */
  scheduledCueCount30m: { warn: number; critical: number }
  /** Root posts created in the last 20 minutes. */
  recentRootPostCount20m: { warn: number; critical: number }
  /** Visible LLM queue depth (gateway-side); null counters skip this signal. */
  visibleLlmQueueDepth: { warn: number; critical: number }
  /** Media generation queue depth; null counters skip this signal. */
  mediaQueueDepth: { warn: number; critical: number }
}

export const DEFAULT_LOAD_THRESHOLDS: LoadThresholds = {
  // Per T-211 §G: per-community per-window cap is 4 root posts / hour.
  // Executing 3+ at once is already approaching that cap.
  executingCueCount: { warn: 3, critical: 6 },
  // 30-minute cue queue. 8 = ~1 cue every 4 min — sustained pace.
  scheduledCueCount30m: { warn: 8, critical: 16 },
  // Per T-211 §G daily cap derivation: ~24 root posts / day / community.
  // 6 in the last 20 minutes = ~3x sustained pace.
  recentRootPostCount20m: { warn: 6, critical: 12 },
  visibleLlmQueueDepth: { warn: 50, critical: 200 },
  mediaQueueDepth: { warn: 20, critical: 80 },
}

// =============================================================================
// Queue-depth providers (optional injection for observability)
// =============================================================================

export interface QueueDepthReader {
  visibleLlmQueueDepth?: () => number | null | Promise<number | null>
  mediaQueueDepth?: () => number | null | Promise<number | null>
  hotThreadPressure?: () => number | null | Promise<number | null>
  providerQueuePressure?: () => number | null | Promise<number | null>
  /** Active scenes counter; if absent, snapshot reports 0. */
  activeSceneCount?: () => number | Promise<number>
  /** Recent thread-followup counter; if absent, snapshot reports 0. */
  recentThreadFollowupCount?: (input: {
    communityId: string
    since: Date
  }) => number | Promise<number>
  /** Global state estimator; if absent, snapshot mirrors community state. */
  globalState?: () => LoadState | Promise<LoadState>
}

export interface AdmissionLoadServiceDeps {
  cueRepo: CueRepository
  postRepo: PostRepository
  /** Defaults to `() => new Date()`. */
  now?: () => Date
  /** Defaults to `DEFAULT_LOAD_THRESHOLDS`. */
  thresholds?: LoadThresholds
  /** Defaults to all-`null` queue-depth signals (snapshot has no LLM/media data). */
  queueDepthReader?: QueueDepthReader
}

// =============================================================================
// Service
// =============================================================================

const SCHEDULED_WINDOW_MS = 30 * 60 * 1000
const RECENT_POST_WINDOW_MS = 20 * 60 * 1000

const SCHEDULED_STATUSES = ['scheduled', 'due', 'prewarming'] as const
const EXECUTING_STATUSES = IN_FLIGHT_ATTEMPT_STATUSES

export class AdmissionLoadService {
  private readonly thresholds: LoadThresholds
  private readonly queueDepthReader: QueueDepthReader
  private readonly nowFn: () => Date

  constructor(private readonly deps: AdmissionLoadServiceDeps) {
    this.thresholds = deps.thresholds ?? DEFAULT_LOAD_THRESHOLDS
    this.queueDepthReader = deps.queueDepthReader ?? {}
    this.nowFn = deps.now ?? (() => new Date())
  }

  async compute(communityId: string, now?: Date): Promise<LoadSnapshot> {
    const computeStartedAt = now ?? this.nowFn()
    const windowEnd = new Date(
      computeStartedAt.getTime() + SCHEDULED_WINDOW_MS,
    )
    const recentSince = new Date(
      computeStartedAt.getTime() - RECENT_POST_WINDOW_MS,
    )

    const scheduledQuery: CountCuesForCommunityInput = {
      communityId,
      statuses: SCHEDULED_STATUSES,
      triggerAtFrom: computeStartedAt,
      triggerAtBefore: windowEnd,
    }
    const dueQuery: CountCuesForCommunityInput = {
      communityId,
      statuses: ['due'],
      triggerAtBefore: windowEnd,
    }
    const executingQuery: CountAttemptsForCommunityInput = {
      communityId,
      statuses: EXECUTING_STATUSES,
    }

    const [
      scheduledCueCount,
      dueCueCount,
      executingCueCount,
      recentRootPostCount,
      visibleLlmQueueDepth,
      mediaQueueDepth,
      hotThreadPressure,
      providerQueuePressure,
      activeSceneCount,
      recentThreadFollowupCount,
      globalState,
    ] = await Promise.all([
      this.deps.cueRepo.countCuesForCommunity(scheduledQuery),
      this.deps.cueRepo.countCuesForCommunity(dueQuery),
      this.deps.cueRepo.countAttemptsForCommunity(executingQuery),
      this.deps.postRepo.countRecentRootPostsForCommunity({
        communityId,
        since: recentSince,
      }),
      this.queueDepthReader.visibleLlmQueueDepth?.() ?? null,
      this.queueDepthReader.mediaQueueDepth?.() ?? null,
      this.queueDepthReader.hotThreadPressure?.() ?? null,
      this.queueDepthReader.providerQueuePressure?.() ?? null,
      this.queueDepthReader.activeSceneCount?.() ?? 0,
      this.queueDepthReader.recentThreadFollowupCount?.({
        communityId,
        since: recentSince,
      }) ?? 0,
      this.queueDepthReader.globalState?.() ?? null,
    ])

    const state = this.deriveLoadState({
      executingCueCount,
      scheduledCueCount30m: scheduledCueCount + dueCueCount,
      recentRootPostCount20m: recentRootPostCount,
      visibleLlmQueueDepth,
      mediaQueueDepth,
    })

    const loadScore = this.scoreLoad({
      executingCueCount,
      scheduledCueCount30m: scheduledCueCount + dueCueCount,
      recentRootPostCount20m: recentRootPostCount,
    })

    return {
      community_id: communityId,
      window_start: computeStartedAt,
      window_end: windowEnd,
      freshness: 'live',
      state,
      global_state: globalState ?? state,
      scheduled_cue_count: scheduledCueCount,
      due_cue_count: dueCueCount,
      executing_cue_count: executingCueCount,
      recent_root_post_count: recentRootPostCount,
      recent_thread_followup_count: recentThreadFollowupCount,
      active_scene_count: activeSceneCount,
      hot_thread_pressure: hotThreadPressure,
      visible_llm_queue_depth: visibleLlmQueueDepth,
      media_queue_depth: mediaQueueDepth,
      provider_queue_pressure: providerQueuePressure,
      load_score: loadScore,
      capacity_remaining: Math.max(0, 1 - loadScore),
      computed_at: computeStartedAt,
    }
  }

  /**
   * Pure helper exported for tests (and for the cached `LoadSignalService` to
   * reuse without re-running the queries).
   */
  deriveLoadState(input: {
    executingCueCount: number
    scheduledCueCount30m: number
    recentRootPostCount20m: number
    visibleLlmQueueDepth: number | null
    mediaQueueDepth: number | null
  }): LoadState {
    type Tier = 'green' | 'warn' | 'critical'
    const tier = (
      value: number | null,
      band: { warn: number; critical: number },
    ): Tier => {
      if (value == null) return 'green'
      if (value >= band.critical) return 'critical'
      if (value >= band.warn) return 'warn'
      return 'green'
    }

    const tiers: Tier[] = [
      tier(input.executingCueCount, this.thresholds.executingCueCount),
      tier(
        input.scheduledCueCount30m,
        this.thresholds.scheduledCueCount30m,
      ),
      tier(
        input.recentRootPostCount20m,
        this.thresholds.recentRootPostCount20m,
      ),
      tier(input.visibleLlmQueueDepth, this.thresholds.visibleLlmQueueDepth),
      tier(input.mediaQueueDepth, this.thresholds.mediaQueueDepth),
    ]

    const criticals = tiers.filter((t) => t === 'critical').length
    if (criticals > 0) return 'red'
    const warns = tiers.filter((t) => t === 'warn').length
    if (warns >= 2) return 'red'
    if (warns >= 1) return 'yellow'
    return 'green'
  }

  /**
   * Lightweight 0-1 capacity score. Not a contract (admission flows off the
   * `state` field), but useful as a board / heatmap visual. Uses the warn
   * threshold of each cue-side signal to scale; queue-depth signals are
   * intentionally excluded so a single noisy queue doesn't dominate the
   * community board.
   */
  private scoreLoad(input: {
    executingCueCount: number
    scheduledCueCount30m: number
    recentRootPostCount20m: number
  }): number {
    const ratios = [
      input.executingCueCount /
        Math.max(1, this.thresholds.executingCueCount.warn),
      input.scheduledCueCount30m /
        Math.max(1, this.thresholds.scheduledCueCount30m.warn),
      input.recentRootPostCount20m /
        Math.max(1, this.thresholds.recentRootPostCount20m.warn),
    ]
    const max = Math.max(...ratios)
    return Math.min(1, Math.max(0, max))
  }
}
