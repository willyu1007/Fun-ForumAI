/**
 * T-209 cue-data-and-board — `BaselineCueImporter`.
 *
 * Reads `config/launch/launch_programming_schedule.v1.yaml` via the existing
 * parser at `src/backend/launch/programming-schedule.ts` and emits a
 * **draft** `PublicDiscussionCueSchedule` plus one **draft** cue per slot
 * template. The existing `LaunchProgrammingOpsService` is **not modified**;
 * this is a shadow path so admins can author live cue schedules from the
 * existing baseline contract.
 *
 * Idempotency: re-running with the same `baseline_contract_version` returns
 * the existing draft schedule without creating duplicates.
 *
 * Semantic loss (intentional, documented):
 *   - YAML observability fields (supply_floor, metrics_focus, ops_surfaces)
 *     stay in the YAML; cue tables capture only what cue authors edit.
 *   - YAML role names (anchor, creator, editor, mc, showrunner, wildcard,
 *     challenger) are mapped to cue-role enum (anchor, challenger, bridge,
 *     observer, comic_relief, skeptic, empath, wildcard); unmappable roles
 *     fall through to `wildcard` to preserve weight allocation.
 *   - YAML scene_types (TALK_SHOW, ROAST, STORY_LAB, ...) are mapped to cue
 *     scene_families; unmappable scene_types fall through to `slice_of_life`.
 */

import {
  getLaunchProgrammingSchedule,
  type LaunchProgrammingDaypartId,
  type LaunchProgrammingScheduleRuntime,
  type LaunchProgrammingSlotTemplateRuntime,
} from '../../launch/programming-schedule.js'
import type { LaunchProgramRole } from '../../launch/system-roster.js'
import { buildIdempotencyKey } from '../contract/index.js'
import type {
  CueRepository,
  PublicDiscussionCueScheduleDomain,
} from '../../repos/cue-repository.js'
import type {
  CueLane,
  CueRole,
  CueRoleRequirement,
  CueRoleRequirementVector,
  CueSceneConstraints,
  CueSceneFamily,
  CueThemeIntent,
  PublicDiscussionCueDomain,
} from './types.js'
import type { DispatchPolicy } from '../contract/index.js'

// =============================================================================
// Mappings
// =============================================================================

const DAYPART_LANE: Record<LaunchProgrammingDaypartId, CueLane> = {
  morning_warmup: 'standard',
  afternoon_handoff: 'standard',
  evening_prime: 'prime',
  late_night_callback: 'background',
}

const DAYPART_PRIORITY: Record<LaunchProgrammingDaypartId, number> = {
  morning_warmup: 50,
  afternoon_handoff: 60,
  evening_prime: 80,
  late_night_callback: 40,
}

/**
 * First-hour anchor for each daypart in the launch window's timezone.
 * Multiple slots in the same daypart are spread out by 15-minute increments.
 */
const DAYPART_ANCHOR_HHMM: Record<LaunchProgrammingDaypartId, [number, number]> = {
  morning_warmup: [9, 0],
  afternoon_handoff: [14, 0],
  evening_prime: [20, 0],
  late_night_callback: [23, 0],
}

const ROLE_MAP: Record<LaunchProgramRole | string, CueRole> = {
  anchor: 'anchor',
  challenger: 'challenger',
  bridge: 'bridge',
  observer: 'observer',
  wildcard: 'wildcard',
  // Launch-side roles without a 1:1 cue role — best-effort projection:
  creator: 'wildcard',
  editor: 'bridge',
  mc: 'bridge',
  showrunner: 'bridge',
  empath: 'empath',
  skeptic: 'skeptic',
  comic_relief: 'comic_relief',
}

const SCENE_TYPE_MAP: Record<string, CueSceneFamily> = {
  TALK_SHOW: 'debate',
  DEBATE: 'debate',
  ROAST: 'debate',
  ROUND_TABLE: 'round_table',
  SLICE_OF_LIFE: 'slice_of_life',
  STORY_LAB: 'story_followup',
  STORY_FOLLOWUP: 'story_followup',
  HOT_TOPIC_MATCH: 'hot_topic_match',
  CALLBACK: 'continuity_callback',
  CONTINUITY_CALLBACK: 'continuity_callback',
  RADIO: 'radio_night',
  RADIO_NIGHT: 'radio_night',
  CREATOR_NOTE_CONTEXT: 'creator_note_context',
}

function mapRole(raw: string): CueRole {
  return ROLE_MAP[raw] ?? 'wildcard'
}

function mapSceneType(raw: string): CueSceneFamily {
  return SCENE_TYPE_MAP[raw.toUpperCase()] ?? 'slice_of_life'
}

function dedupe<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

// =============================================================================
// Importer
// =============================================================================

export interface BaselineCueImporterDeps {
  repo: CueRepository
  /**
   * Optional override of the YAML loader; in tests this lets us inject a
   * synthetic runtime without touching the file system.
   */
  loadSchedule?: () => LaunchProgrammingScheduleRuntime
}

export interface BaselineImportResult {
  schedule: PublicDiscussionCueScheduleDomain
  cues: PublicDiscussionCueDomain[]
  /** True when this run created the schedule; false when it already existed. */
  is_new: boolean
}

export class BaselineCueImporter {
  constructor(private readonly deps: BaselineCueImporterDeps) {}

  /**
   * Idempotent. Returns the existing draft baseline schedule if one already
   * matches the YAML's `baseline_contract_version`; otherwise creates a new
   * draft schedule plus one draft cue per slot template.
   */
  async run(opts?: { now?: Date }): Promise<BaselineImportResult> {
    const runtime = (this.deps.loadSchedule ?? getLaunchProgrammingSchedule)()
    const baselineVersion = `v${runtime.version}`
    const timezone = runtime.launch_window.schedule_timezone || 'Asia/Shanghai'

    // Idempotency check: re-use an existing baseline schedule with same version.
    const existing = await this.findExistingBaselineSchedule(baselineVersion)
    if (existing) {
      const cues = await this.deps.repo.listCuesForSchedule(existing.id)
      return { schedule: existing, cues, is_new: false }
    }

    const now = opts?.now ?? new Date()
    const dateRangeStart = startOfDay(now)
    const dateRangeEnd = endOfDay(now)

    const schedule = await this.deps.repo.createSchedule({
      scope_type: 'global',
      timezone,
      date_range_start: dateRangeStart,
      date_range_end: dateRangeEnd,
      baseline_contract_version: baselineVersion,
      status: 'draft',
      source: 'baseline',
      version: 1,
      summary: `Imported from launch_programming_schedule.v1.yaml ${baselineVersion}`,
      created_by_system: 'baseline-cue-importer',
    })

    // Group slots by daypart so we can spread their trigger_at within the daypart.
    const slotsByDaypart = new Map<
      LaunchProgrammingDaypartId,
      LaunchProgrammingSlotTemplateRuntime[]
    >()
    for (const slot of runtime.slot_templates) {
      const list = slotsByDaypart.get(slot.daypart) ?? []
      list.push(slot)
      slotsByDaypart.set(slot.daypart, list)
    }

    const cues: PublicDiscussionCueDomain[] = []
    // Serial create loop — ordering matters for the read-only Cue Board and
    // makes idempotency-key derivation deterministic.
    for (const [daypart, slots] of slotsByDaypart) {
      const [hh, mm] = DAYPART_ANCHOR_HHMM[daypart]
      const baseTriggerMs = atHourOfDay(now, hh, mm).getTime()
      for (let idx = 0; idx < slots.length; idx++) {
        const slot = slots[idx]!
        const triggerAt = new Date(baseTriggerMs + idx * 15 * 60 * 1000)
        const cue = await this.deps.repo.createCue({
          schedule_id: schedule.id,
          source_type: 'baseline',
          status: 'draft',
          community_id: slot.community_slug,
          scope: { mode: 'single', community_id: slot.community_slug },
          trigger_at: triggerAt,
          timezone,
          priority: DAYPART_PRIORITY[daypart],
          lane: DAYPART_LANE[daypart],
          dispatch_policy: defaultDispatchPolicy(triggerAt, timezone, daypart),
          theme_intent: deriveThemeIntent(slot, runtime, daypart),
          scene_constraints: deriveSceneConstraints(slot),
          role_requirements: deriveRoleRequirements(slot),
          locked_fields: [],
          risk_level: 'standard',
          idempotency_key: buildIdempotencyKey(
            'cue',
            schedule.id,
            slot.slot_name,
            0,
          ),
          created_by_system: 'baseline-cue-importer',
        })
        cues.push(cue)
      }
    }

    return { schedule, cues, is_new: true }
  }

  private async findExistingBaselineSchedule(
    baselineVersion: string,
  ): Promise<PublicDiscussionCueScheduleDomain | null> {
    const all = await this.deps.repo.listSchedules()
    return (
      all.find(
        (s) =>
          s.source === 'baseline' &&
          s.baseline_contract_version === baselineVersion,
      ) ?? null
    )
  }
}

// =============================================================================
// Helpers
// =============================================================================

function startOfDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

function endOfDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(23, 59, 59, 999)
  return out
}

function atHourOfDay(base: Date, hh: number, mm: number): Date {
  const out = new Date(base)
  out.setHours(hh, mm, 0, 0)
  return out
}

function defaultDispatchPolicy(
  triggerAt: Date,
  timezone: string,
  daypart: LaunchProgrammingDaypartId,
): DispatchPolicy {
  return {
    trigger_at: triggerAt.toISOString(),
    timezone,
    dispatch_mode: 'graceful',
    grace_seconds: 120,
    priority: DAYPART_PRIORITY[daypart],
    lane: DAYPART_LANE[daypart],
    misfire_policy: 'delay',
    max_attempts: 2,
    retry_backoff_seconds: 60,
  }
}

function deriveThemeIntent(
  slot: LaunchProgrammingSlotTemplateRuntime,
  runtime: LaunchProgrammingScheduleRuntime,
  daypart: LaunchProgrammingDaypartId,
): CueThemeIntent {
  const dpRuntime = runtime.dayparts.find((dp) => dp.id === daypart)
  return {
    topic_seed: slot.slot_name,
    angle_hint: dpRuntime?.objective,
    discussion_question: undefined,
    tone_band: undefined,
  }
}

function deriveSceneConstraints(
  slot: LaunchProgrammingSlotTemplateRuntime,
): CueSceneConstraints {
  const families = dedupe(slot.scene_types.map(mapSceneType))
  return {
    community_scope: { mode: 'single', community_id: slot.community_slug },
    public_stage_scope: ['forum'],
    allowed_scene_families: families.length > 0 ? families : undefined,
    preferred_scene_family: families[0],
    privacy_policy: 'public_only',
    private_reference_policy: 'forbidden',
    safety_profile: 'standard',
  }
}

function deriveRoleRequirements(
  slot: LaunchProgrammingSlotTemplateRuntime,
): CueRoleRequirementVector {
  const requirements: CueRoleRequirement[] = []
  for (const r of slot.required_roles) {
    requirements.push({ role: mapRole(r), weight: 0.8 })
  }
  for (const r of slot.optional_roles) {
    requirements.push({ role: mapRole(r), weight: 0.5, optional: true })
  }
  // Ensure at least one requirement (cue schema requires non-empty list).
  if (requirements.length === 0) {
    requirements.push({ role: 'anchor', weight: 0.6 })
  }
  return { requirements }
}
