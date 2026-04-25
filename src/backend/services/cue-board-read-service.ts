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

export interface CueBoardPayload {
  schedule: CueBoardSchedulePayload | null
  cues: CueBoardCueItem[]
  /**
   * Reserved for T-213. Currently always null on the wire.
   */
  load_state_per_community: null
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

export class CueBoardReadService {
  constructor(private readonly repo: CueRepository) {}

  async getBoardPayload(input: GetCueBoardInput = {}): Promise<CueBoardPayload> {
    const schedule = await this.resolveSchedule(input.schedule_id)
    const generatedAt = new Date().toISOString()

    if (!schedule) {
      return {
        schedule: null,
        cues: [],
        load_state_per_community: null,
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

    return {
      schedule: this.toSchedulePayload(schedule),
      cues: items,
      load_state_per_community: null,
      generated_at: generatedAt,
    }
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
