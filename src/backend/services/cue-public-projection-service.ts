/**
 * T-215 B-M2 — `CuePublicProjectionService`.
 *
 * Joins cue repo data with completed-attempt post references to produce
 * the public-facing `CueProjectionFacet`. The facet builder
 * (`buildCueProjectionFacet`) enforces the field whitelist; this service
 * is responsible for the (1) lifecycle filtering and (2) the small
 * post-link lookup for completed cues.
 *
 * Contract:
 *   - `assemble({ communityId, now, lookaheadMs?, completedWindowMs? })`
 *     returns a sanitized `CueProjectionFacet`.
 *   - Empty community → empty facet (no error).
 *   - Cues with `production_path !== 'cue'` are absent: the cue domain
 *     itself only models cue-runtime entries, so the filter is implicit.
 *   - For completed cues we look up the latest *succeeded* attempt and
 *     surface `post_id`. The thread + URL are caller-resolved via the
 *     forum scene metadata join once that surface is wired to the route
 *     layer; for now we omit them to keep the join cost bounded.
 *
 * Performance: the InMemory backend scans the cue store; the Pg backend
 * uses the `(community_id, trigger_at)` index already present on
 * `public_discussion_cues`. The home-tonight render budget (≤20
 * cues, <300ms) is comfortably met by O(20) scans + O(20) attempt
 * lookups.
 */

import {
  buildCueProjectionFacet,
  isUpcomingProjectableStatus,
  type CueProjectionFacet,
  type CompletedFacetSource,
  type LiveFacetSource,
  type UpcomingFacetSource,
} from '../launch/programming-projection-cue-facet.js'
import type {
  CueExecutionAttemptDomain,
  CueRepository,
} from '../repos/cue-repository.js'
import type { ForumSceneMetadataRepository } from '../repos/forum-scene-metadata-repository.js'
import type {
  PublicDiscussionCueDomain,
} from '../programming/cue/types.js'

const DEFAULT_UPCOMING_LOOKAHEAD_MS = 6 * 60 * 60 * 1000 // 6h
const DEFAULT_COMPLETED_WINDOW_MS = 24 * 60 * 60 * 1000 // 24h
const DEFAULT_UPCOMING_LIMIT = 20
const DEFAULT_COMPLETED_LIMIT = 20

export interface CuePublicProjectionServiceDeps {
  cueRepo: Pick<CueRepository, 'listUpcomingCues' | 'listAttemptsForCue'>
  /**
   * T-215 B-M3 — optional ForumSceneMetadata repo. When supplied, the
   * service joins completed cues against `findByPostId(post_id)` to
   * surface `result_thread_id` and `result_url`. Without the dep, the
   * facet still returns `result_post_id` from the attempt and leaves
   * the thread + URL fields `null` (B-M2 baseline behavior).
   */
  forumSceneMetadataRepo?: Pick<ForumSceneMetadataRepository, 'findByPostId'>
  /**
   * T-215 B-M3 — base URL prefix for `result_url` construction.
   * Defaults to relative `/posts/{post_id}` so consumers without a
   * canonical host (admin actuals, dev-mode SSR) still get a clickable
   * link. Production wiring threads the configured public origin.
   */
  postUrlBase?: string
  now?: () => Date
}

export interface AssembleCueProjectionInput {
  /** When omitted, the service walks all communities the upstream query exposes. */
  communityId?: string | null
  /** Override the wall clock for tests / replay. */
  now?: Date
  /** Window for upcoming (default 6 hours forward). */
  lookaheadMs?: number
  /** Window for completed (default 24 hours backward). */
  completedWindowMs?: number
  /** Cap on upcoming items (default 20). */
  upcomingLimit?: number
  /** Cap on completed items (default 20). */
  completedLimit?: number
}

export class CuePublicProjectionService {
  private readonly nowFn: () => Date
  private readonly postUrlBase: string

  constructor(private readonly deps: CuePublicProjectionServiceDeps) {
    this.nowFn = deps.now ?? (() => new Date())
    this.postUrlBase = deps.postUrlBase ?? '/posts/'
  }

  async assemble(input: AssembleCueProjectionInput = {}): Promise<CueProjectionFacet> {
    const now = input.now ?? this.nowFn()
    const lookaheadMs = input.lookaheadMs ?? DEFAULT_UPCOMING_LOOKAHEAD_MS
    const completedWindowMs = input.completedWindowMs ?? DEFAULT_COMPLETED_WINDOW_MS
    const upcomingLimit = input.upcomingLimit ?? DEFAULT_UPCOMING_LIMIT
    const completedLimit = input.completedLimit ?? DEFAULT_COMPLETED_LIMIT

    // --- upcoming + live (forward window) ---
    const forwardCues = await this.deps.cueRepo.listUpcomingCues({
      ...(input.communityId ? { community_id: input.communityId } : {}),
      from: now,
      to: new Date(now.getTime() + lookaheadMs),
      limit: upcomingLimit * 2, // headroom: status filter may drop some
    })
    const upcoming: UpcomingFacetSource[] = []
    const live: LiveFacetSource[] = []
    for (const cue of forwardCues) {
      if (isUpcomingProjectableStatus(cue.status)) {
        if (upcoming.length >= upcomingLimit) continue
        upcoming.push({ cue, community_id: resolveCommunityId(cue) })
      } else if (cue.status === 'executing') {
        const attempt = await this.findLatestRunningAttempt(cue.id)
        live.push({
          cue,
          community_id: resolveCommunityId(cue),
          attempt_id: attempt?.id ?? `live:${cue.id}`,
        })
      }
    }

    // --- completed (backward window) ---
    const backwardCues = await this.deps.cueRepo.listUpcomingCues({
      ...(input.communityId ? { community_id: input.communityId } : {}),
      from: new Date(now.getTime() - completedWindowMs),
      to: now,
      limit: completedLimit * 2,
    })
    const completed: CompletedFacetSource[] = []
    for (const cue of backwardCues) {
      if (cue.status !== 'consumed') continue
      if (completed.length >= completedLimit) break
      const attempt = await this.findLatestSucceededAttempt(cue.id)
      const postId = attempt?.post_id ?? null
      let threadId: string | null = null
      let url: string | null = null
      if (postId) {
        url = `${this.postUrlBase}${postId}`
        // T-215 B-M3 — join with ForumSceneMetadata for the canonical
        // thread id when the dep is wired. Failures are logged + the
        // completed item still lands with result_url.
        if (this.deps.forumSceneMetadataRepo) {
          try {
            const meta = await this.deps.forumSceneMetadataRepo.findByPostId(postId)
            threadId = meta?.thread_id ?? null
          } catch (err) {
            console.error(
              `[CuePublicProjectionService] forumSceneMetadata join failed for post=${postId}: ${(err as Error).message}`,
            )
          }
        }
      }
      completed.push({
        cue,
        community_id: resolveCommunityId(cue),
        completed_at: attempt?.finished_at?.toISOString() ?? cue.updated_at,
        result_post_id: postId,
        result_thread_id: threadId,
        result_url: url,
      })
    }

    return buildCueProjectionFacet({ upcoming, live, completed })
  }

  private async findLatestSucceededAttempt(
    cueId: string,
  ): Promise<CueExecutionAttemptDomain | null> {
    const attempts = await this.deps.cueRepo.listAttemptsForCue(cueId)
    const succeeded = attempts.filter((a) => a.status === 'succeeded')
    succeeded.sort((a, b) => {
      const aT = a.finished_at?.getTime() ?? 0
      const bT = b.finished_at?.getTime() ?? 0
      return bT - aT
    })
    return succeeded[0] ?? null
  }

  private async findLatestRunningAttempt(
    cueId: string,
  ): Promise<CueExecutionAttemptDomain | null> {
    const attempts = await this.deps.cueRepo.listAttemptsForCue(cueId)
    const running = attempts.filter(
      (a) =>
        a.status === 'executing'
        || a.status === 'leased'
        || a.status === 'allocating'
        || a.status === 'compiling',
    )
    running.sort((a, b) => {
      const aT = a.actual_claimed_at?.getTime() ?? 0
      const bT = b.actual_claimed_at?.getTime() ?? 0
      return bT - aT
    })
    return running[0] ?? null
  }
}

function resolveCommunityId(cue: PublicDiscussionCueDomain): string | null {
  return cue.community_id ?? cue.scope?.community_id ?? null
}
