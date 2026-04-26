/**
 * T-215 B-M2 — `cue` facet on `LaunchProgrammingProjection`.
 *
 * Public surface for cue programming. Per umbrella decision D-7 we do
 * **not** create a new `PublicProgrammingReadModel`; instead the existing
 * `LaunchProgrammingProjection` carries an additive `cue?: CueProjectionFacet`
 * so home-shelf, community pages, and replay UIs read through the same
 * read model that already powers the rest of programming.
 *
 * Sanitization rules (design doc §6.10, frozen here):
 *   - Public consumers NEVER see internal theme intent text
 *     (`topic_seed`, `discussion_question`, `angle_hint`, `tone_band`).
 *   - Public consumers NEVER see `risk_level`, `safety` policy, or any
 *     `selected_cast` / `suppressed_candidates` / `allocator_*` keys.
 *   - Public consumers NEVER see `production_path: 'autonomous'` rows
 *     (those flow through the legacy launch programming surface).
 *   - Editor-curated public text fields (`public_hook`,
 *     `public_topic_label`, `public_title`) are NOT yet a first-class
 *     part of `PublicDiscussionCueDomain` (slated for the cue-editor
 *     T-210 follow-on). Until they exist on the domain, the facet emits
 *     only structural / identity / scheduling fields. This is the
 *     deliberate "deny-by-default" stance: a leak path can only open by
 *     adding a new field and running the sanitization probe again.
 *
 * Items by lifecycle:
 *   - `upcoming` — cue is scheduled and `trigger_at` is in the future
 *   - `live` — cue's attempt is currently `executing` (gated by feature
 *     flag at the read site; see `cue-public-projection-service`)
 *   - `completed` — cue is `consumed` and produced a public post; carries
 *     the `result_*` references so the consumer can deep-link to the
 *     forum thread.
 */

import type {
  PublicDiscussionCueDomain,
  PublicDiscussionCueStatus,
} from '../programming/cue/types.js'

export type CueProjectionStatus = 'upcoming' | 'live' | 'completed'
export type CueProjectionLane = 'prime' | 'standard' | 'background'

export interface CueProjectionUpcomingItem {
  cue_id: string
  schedule_id: string
  community_id: string | null
  trigger_at: string
  /** Coarse lane (prime/standard/background) for visual grouping; not priority. */
  lane: CueProjectionLane
  status: CueProjectionStatus
}

export interface CueProjectionLiveItem extends CueProjectionUpcomingItem {
  status: 'live'
  /** Worker that owns the live attempt (read-only diagnostic; never user-facing). */
  attempt_id: string
}

export interface CueProjectionCompletedItem {
  cue_id: string
  schedule_id: string
  community_id: string | null
  /** Wall-clock when the cue was consumed (for ordering). */
  completed_at: string
  status: 'completed'
  /** Forum primitives the cue produced; `null` when the post failed to land. */
  result_post_id: string | null
  result_thread_id: string | null
  /** Stable URL the public surface can deep-link to. */
  result_url: string | null
}

export interface CueProjectionFacet {
  upcoming: CueProjectionUpcomingItem[]
  live: CueProjectionLiveItem[]
  completed: CueProjectionCompletedItem[]
}

/**
 * Build the cue facet from sanitized inputs. Caller (typically
 * `cue-public-projection-service`) is responsible for passing only cues
 * that pass the production-path filter (`production_path === 'cue'`) and
 * for joining the `result_post_id` / `result_url` sourced from the
 * promoted ForumSceneMetadata columns. This builder enforces the field
 * whitelist at output time so a malformed input never reaches the
 * surface.
 */
export function buildCueProjectionFacet(input: {
  upcoming: ReadonlyArray<UpcomingFacetSource>
  live: ReadonlyArray<LiveFacetSource>
  completed: ReadonlyArray<CompletedFacetSource>
}): CueProjectionFacet {
  return {
    upcoming: input.upcoming.map((source) => sanitizeUpcoming(source)),
    live: input.live.map((source) => sanitizeLive(source)),
    completed: input.completed.map((source) => sanitizeCompleted(source)),
  }
}

export interface UpcomingFacetSource {
  cue: PublicDiscussionCueDomain
  /** Resolved community id (cue.scope.community_id). Null when scope is family. */
  community_id: string | null
}

export interface LiveFacetSource extends UpcomingFacetSource {
  attempt_id: string
}

export interface CompletedFacetSource {
  cue: PublicDiscussionCueDomain
  community_id: string | null
  completed_at: string
  result_post_id: string | null
  result_thread_id: string | null
  result_url: string | null
}

const PUBLIC_UPCOMING_STATUSES: ReadonlySet<PublicDiscussionCueStatus> = new Set([
  'scheduled',
  'prewarming',
  'due',
])

function sanitizeUpcoming(source: UpcomingFacetSource): CueProjectionUpcomingItem {
  return {
    cue_id: source.cue.id,
    schedule_id: source.cue.schedule_id,
    community_id: source.community_id,
    trigger_at: source.cue.trigger_at,
    lane: source.cue.lane,
    status: 'upcoming',
  }
}

function sanitizeLive(source: LiveFacetSource): CueProjectionLiveItem {
  return {
    cue_id: source.cue.id,
    schedule_id: source.cue.schedule_id,
    community_id: source.community_id,
    trigger_at: source.cue.trigger_at,
    lane: source.cue.lane,
    status: 'live',
    attempt_id: source.attempt_id,
  }
}

function sanitizeCompleted(source: CompletedFacetSource): CueProjectionCompletedItem {
  return {
    cue_id: source.cue.id,
    schedule_id: source.cue.schedule_id,
    community_id: source.community_id,
    completed_at: source.completed_at,
    status: 'completed',
    result_post_id: source.result_post_id,
    result_thread_id: source.result_thread_id,
    result_url: source.result_url,
  }
}

/**
 * Caller-side guard: drop cues whose status is not eligible for the
 * upcoming surface. Centralized so admin debug surfaces and the public
 * projection share one definition.
 */
export function isUpcomingProjectableStatus(
  status: PublicDiscussionCueStatus,
): boolean {
  return PUBLIC_UPCOMING_STATUSES.has(status)
}

/**
 * Reasoned set of forbidden keys that a sanitization probe in tests can
 * scan a JSON.stringified facet for. Updates here MUST come with a
 * matching umbrella §3 / design-doc §6.10 review.
 */
export const CUE_PROJECTION_FORBIDDEN_KEYS: readonly string[] = [
  // Theme intent leakage
  'topic_seed',
  'discussion_question',
  'angle_hint',
  'tone_band',
  // Risk + safety
  'risk_level',
  'safety',
  'safety_boundary',
  // Allocator / cast internals
  'selected_cast',
  'suppressed_candidates',
  'allocator_result_json',
  'candidate_agent_ids',
  'preferred_agent_ids',
  'fallback_agent_ids',
  'selected_agent_id',
  // Internal scheduling knobs
  'priority',
  'dispatch_policy',
  'admission_policy',
  'load_policy',
  'locked_fields',
  'idempotency_key',
  // Director / private reasoning
  'must_hit_points',
  'expected_outputs',
  'private_owner_memory',
] as const
