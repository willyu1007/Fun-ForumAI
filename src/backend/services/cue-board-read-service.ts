/**
 * T-209 cue-data-and-board — read-only Cue Board service.
 *
 * Builds the admin Cue Board timeline payload:
 *   - resolves the active schedule (or a caller-pinned schedule_id)
 *   - lists upcoming cues with derived summaries (theme, scene, role, media)
 *
 * This is **admin-only** (gated by route auth). Internal theme intent text
 * IS allowed in the response — public projection (T-215) sanitizes a
 * separate public surface per design doc §6.10.
 *
 * No mutation methods here. T-210 introduces the editor write paths.
 */

import type {
  CueRepository,
  PublicDiscussionCueScheduleDomain,
} from '../repos/cue-repository.js'
import type { PostRepository } from '../repos/post-repository.js'
import type {
  CueLane,
  CueRiskLevel,
  CueRoleRequirementVector,
  CueSceneFamily,
  CueSourceType,
  CueThemeIntent,
  PublicDiscussionCueDomain,
  PublicDiscussionCueStatus,
} from '../programming/cue/types.js'
import type { LoadSignalService } from './load-signal-service.js'
import type { LoadState } from '../programming/load/types.js'

// =============================================================================
// Response shapes
// =============================================================================

export interface CueBoardSchedulePayload {
  id: string
  status: PublicDiscussionCueScheduleDomain['status']
  source: PublicDiscussionCueScheduleDomain['source']
  version: number
  scope_type: PublicDiscussionCueScheduleDomain['scope_type']
  community_id: string | null
  timezone: string
  date_range_start: string
  date_range_end: string
  baseline_contract_version: string | null
  summary: string | null
}

export interface CueBoardCueItem {
  id: string
  schedule_id: string
  trigger_at: string
  timezone: string
  lane: CueLane
  priority: number
  status: PublicDiscussionCueStatus
  source_type: CueSourceType
  risk_level: CueRiskLevel
  community_id: string | null
  public_topic_label: string | null
  public_hook: string | null
  theme_intent_summary: string
  scene_family_preview: CueSceneFamily[]
  role_requirement_summary: string
  media_count: number
  locked_fields_count: number
}

/**
 * T-213 M4 — per-community load heatmap entry.
 *
 * Surfaces the cached load state alongside the 30-min forward window
 * occupancy for the Cue Board UI. `predicted_autonomous_count_30m` is a
 * coarse forecast computed from `recent_root_post_count_20m` (autonomous
 * tick rate over the last 20 minutes scaled to 30 minutes); admins read it
 * as a hint to avoid double-track blindspots (invariant I-7), not a
 * guarantee.
 */
export interface CueBoardLoadStateEntry {
  community_id: string
  load_state: LoadState
  scheduled_cue_count_30m: number
  predicted_autonomous_count_30m: number
  computed_at: string
}

export interface CueBoardPayload {
  schedule: CueBoardSchedulePayload | null
  cues: CueBoardCueItem[]
  /**
   * T-213 M4 — populated when a `LoadSignalService` is wired and at least
   * one cue resolves to a community in scope. Empty array when no community
   * scope exists (e.g., empty schedule).
   *
   * Pre-T-213 callers wired without a `loadSignalService` keep getting
   * `null` here for back-compat.
   */
  load_state_per_community: CueBoardLoadStateEntry[] | null
  /** ISO timestamp at which the board payload was assembled. */
  generated_at: string
}

export interface GetCueBoardInput {
  schedule_id?: string
  community_id?: string
  from?: Date
  to?: Date
  limit?: number
}

// =============================================================================
// Service
// =============================================================================

const DEFAULT_BOARD_LIMIT = 100
const FORWARD_WINDOW_MINUTES = 30

export interface CueBoardReadServiceDeps {
  /**
   * T-213 M4 — cached load signal source. Optional so legacy tests / the
   * pre-T-213 stub-only wiring keep returning `null` heatmap. Production
   * container injects the cached `LoadSignalService` (~30s TTL).
   */
  loadSignalService?: LoadSignalService | null
  /**
   * T-213 M4 — root-post counter for the autonomous-vs-cue split on the
   * heatmap. Optional; when omitted the heatmap reports
   * `predicted_autonomous_count_30m: 0` (degraded UI, no double-count risk).
   */
  postRepo?: PostRepository | null
}

export class CueBoardReadService {
  private readonly loadSignalService: LoadSignalService | null
  private readonly postRepo: PostRepository | null

  constructor(
    private readonly repo: CueRepository,
    deps: CueBoardReadServiceDeps = {},
  ) {
    this.loadSignalService = deps.loadSignalService ?? null
    this.postRepo = deps.postRepo ?? null
  }

  async getBoardPayload(input: GetCueBoardInput = {}): Promise<CueBoardPayload> {
    const schedule = await this.resolveSchedule(input.schedule_id)
    const generatedAt = new Date().toISOString()

    if (!schedule) {
      return {
        schedule: null,
        cues: [],
        load_state_per_community: this.loadSignalService ? [] : null,
        generated_at: generatedAt,
      }
    }

    const cues = await this.repo.listUpcomingCues({
      schedule_id: schedule.id,
      community_id: input.community_id,
      from: input.from,
      to: input.to,
      limit: input.limit ?? DEFAULT_BOARD_LIMIT,
    })

    // Resolve media counts per cue.
    const items: CueBoardCueItem[] = []
    for (const cue of cues) {
      const media = await this.repo.listMediaForCue(cue.id)
      items.push(this.toItem(cue, media.length))
    }

    const loadStates = await this.collectLoadStates(items)

    return {
      schedule: this.toSchedulePayload(schedule),
      cues: items,
      load_state_per_community: loadStates,
      generated_at: generatedAt,
    }
  }

  /**
   * T-213 M4 — computes one heatmap entry per community in the cue scope.
   * Reads the cached `LoadSignalService` (admission keeps reading the live
   * `AdmissionLoadService`; this path tolerates ~30s staleness). Returns
   * `null` when no `loadSignalService` was injected — preserves legacy
   * behavior for tests and pre-M4 wiring.
   */
  private async collectLoadStates(
    items: CueBoardCueItem[],
  ): Promise<CueBoardLoadStateEntry[] | null> {
    if (!this.loadSignalService) return null
    const communityIds = Array.from(
      new Set(items.map((item) => item.community_id).filter((id): id is string => id != null)),
    )
    if (communityIds.length === 0) return []

    const now = new Date()
    const windowEnd = new Date(now.getTime() + FORWARD_WINDOW_MINUTES * 60_000)

    const entries: CueBoardLoadStateEntry[] = []
    for (const communityId of communityIds) {
      // Live reads are intentional: the cached signal service handles its
      // own TTL window so each call here costs at most one indexed lookup.
      const signal = await this.loadSignalService.get(communityId, null)
      const scheduledCueCount = await this.repo.countCuesForCommunity({
        communityId,
        statuses: ['scheduled', 'due', 'prewarming'],
        triggerAtFrom: now,
        triggerAtBefore: windowEnd,
      })
      // Predicted autonomous occupancy estimate (invariant I-7 anti-blindspot):
      // recent root-post total minus cue-path consumed cues = autonomous-path
      // count over the last 20 minutes; project to 30 minutes by ×1.5. The
      // forecast is a coarse hint, not a contract — admins use it to avoid
      // double-tracking, not to plan against.
      //
      // When `postRepo` isn't injected the heatmap reports zero rather than
      // double-counting cue-path posts as autonomous (the prior bug).
      const since20m = new Date(now.getTime() - 20 * 60_000)
      let predictedAutonomous = 0
      if (this.postRepo) {
        const totalRecentRootPosts =
          await this.postRepo.countRecentRootPostsForCommunity({
            communityId,
            since: since20m,
          })
        const cueConsumedRecent = await this.repo.countCuesForCommunity({
          communityId,
          statuses: ['consumed'],
          triggerAtFrom: since20m,
          triggerAtBefore: now,
        })
        const autonomousRecent = Math.max(0, totalRecentRootPosts - cueConsumedRecent)
        predictedAutonomous = Math.round(autonomousRecent * 1.5)
      }
      entries.push({
        community_id: communityId,
        load_state: signal.status,
        scheduled_cue_count_30m: scheduledCueCount,
        predicted_autonomous_count_30m: predictedAutonomous,
        computed_at: now.toISOString(),
      })
    }
    return entries
  }

  // ---- internals ----

  private async resolveSchedule(
    scheduleId?: string,
  ): Promise<PublicDiscussionCueScheduleDomain | null> {
    if (scheduleId) {
      return this.repo.findScheduleById(scheduleId)
    }
    // Prefer an active global schedule; otherwise show the most recent one
    // (e.g., the freshly imported baseline draft for first-time setup).
    const active = await this.repo.findActiveScheduleForScope({
      scope_type: 'global',
    })
    if (active) return active
    const all = await this.repo.listSchedules({ limit: 1 })
    return all[0] ?? null
  }

  private toSchedulePayload(
    schedule: PublicDiscussionCueScheduleDomain,
  ): CueBoardSchedulePayload {
    return {
      id: schedule.id,
      status: schedule.status,
      source: schedule.source,
      version: schedule.version,
      scope_type: schedule.scope_type,
      community_id: schedule.community_id,
      timezone: schedule.timezone,
      date_range_start: schedule.date_range_start.toISOString(),
      date_range_end: schedule.date_range_end.toISOString(),
      baseline_contract_version: schedule.baseline_contract_version,
      summary: schedule.summary,
    }
  }

  private toItem(
    cue: PublicDiscussionCueDomain,
    mediaCount: number,
  ): CueBoardCueItem {
    return {
      id: cue.id,
      schedule_id: cue.schedule_id,
      trigger_at: cue.trigger_at,
      timezone: cue.timezone,
      lane: cue.lane,
      priority: cue.priority,
      status: cue.status,
      source_type: cue.source_type,
      risk_level: cue.risk_level,
      community_id: cue.community_id ?? null,
      public_topic_label: cue.theme_intent.topic_seed ?? null,
      public_hook: cue.theme_intent.discussion_question ?? null,
      theme_intent_summary: summarizeThemeIntent(cue.theme_intent),
      scene_family_preview: (
        cue.scene_constraints.allowed_scene_families ?? []
      ).slice(0, 3),
      role_requirement_summary: summarizeRoleRequirements(cue.role_requirements),
      media_count: mediaCount,
      locked_fields_count: cue.locked_fields.length,
    }
  }
}

// =============================================================================
// Pure summarizers (also used by tests)
// =============================================================================

export function summarizeThemeIntent(intent: CueThemeIntent): string {
  const parts = [intent.topic_seed]
  if (intent.tone_band) parts.push(`tone:${intent.tone_band}`)
  if (intent.angle_hint) parts.push(intent.angle_hint)
  return parts.join(' · ')
}

export function summarizeRoleRequirements(
  vector: CueRoleRequirementVector,
): string {
  const segs = vector.requirements.map((r) => {
    const flag = r.optional ? '?' : ''
    return `${r.role}×${r.weight.toFixed(1)}${flag}`
  })
  if (vector.relationship_shape) {
    segs.push(`shape:${vector.relationship_shape}`)
  }
  return segs.join(' + ')
}
