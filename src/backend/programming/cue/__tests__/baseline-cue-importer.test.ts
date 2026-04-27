import { describe, it, expect, beforeEach } from 'vitest'
import { BaselineCueImporter } from '../baseline-cue-importer.js'
import { InMemoryCueRepository } from '../../../repos/cue-repository.js'
import { getLaunchProgrammingSchedule } from '../../../launch/programming-schedule.js'
import {
  CueRoleRequirementVectorSchema,
  CueSceneConstraintsSchema,
  CueThemeIntentSchema,
} from '../types.js'

describe('BaselineCueImporter — against actual YAML', () => {
  let repo: InMemoryCueRepository

  beforeEach(() => {
    repo = new InMemoryCueRepository()
  })

  it('imports the launch_programming_schedule.v1.yaml into a draft schedule + draft cues', async () => {
    const importer = new BaselineCueImporter({ repo })
    const result = await importer.run({
      now: new Date('2026-04-25T12:00:00+08:00'),
    })

    expect(result.is_new).toBe(true)
    expect(result.schedule.status).toBe('draft')
    expect(result.schedule.source).toBe('baseline')
    expect(result.schedule.scope_type).toBe('global')
    expect(result.schedule.timezone).toBe('Asia/Shanghai')
    expect(result.schedule.baseline_contract_version).toBe('v1')

    // The YAML ships with 8 slot templates today.
    const runtime = getLaunchProgrammingSchedule()
    expect(result.cues).toHaveLength(runtime.slot_templates.length)

    for (const cue of result.cues) {
      expect(cue.status).toBe('draft')
      expect(cue.source_type).toBe('baseline')
      expect(cue.created_by_system).toBe('baseline-cue-importer')
      // Each cue has a derived idempotency key tied to the schedule.
      expect(cue.idempotency_key.startsWith(`cue:${result.schedule.id}:`)).toBe(true)
    }
  })

  it('produces cues that pass the Zod domain validators', async () => {
    const importer = new BaselineCueImporter({ repo })
    const result = await importer.run({
      now: new Date('2026-04-25T12:00:00+08:00'),
    })

    for (const cue of result.cues) {
      expect(() => CueThemeIntentSchema.parse(cue.theme_intent)).not.toThrow()
      expect(() =>
        CueSceneConstraintsSchema.parse(cue.scene_constraints),
      ).not.toThrow()
      expect(() =>
        CueRoleRequirementVectorSchema.parse(cue.role_requirements),
      ).not.toThrow()
    }
  })

  it('lanes evening_prime cues as "prime"; late_night_callback as "background"', async () => {
    const importer = new BaselineCueImporter({ repo })
    const result = await importer.run({
      now: new Date('2026-04-25T12:00:00+08:00'),
    })
    const runtime = getLaunchProgrammingSchedule()

    const eveningSlots = runtime.slot_templates.filter(
      (s) => s.daypart === 'evening_prime',
    )
    if (eveningSlots.length > 0) {
      const eveningCues = result.cues.filter((c) =>
        eveningSlots.some((s) => c.idempotency_key.endsWith(`:${s.slot_name}:0`)),
      )
      expect(eveningCues.length).toBeGreaterThan(0)
      for (const c of eveningCues) {
        expect(c.lane).toBe('prime')
        expect(c.priority).toBe(80)
      }
    }

    const lateSlots = runtime.slot_templates.filter(
      (s) => s.daypart === 'late_night_callback',
    )
    if (lateSlots.length > 0) {
      const lateCues = result.cues.filter((c) =>
        lateSlots.some((s) => c.idempotency_key.endsWith(`:${s.slot_name}:0`)),
      )
      for (const c of lateCues) {
        expect(c.lane).toBe('background')
      }
    }
  })

  it('spreads multiple slots within the same daypart by 15-min increments', async () => {
    const now = new Date('2026-04-25T12:00:00+08:00')
    const importer = new BaselineCueImporter({ repo })
    const result = await importer.run({ now })
    const runtime = getLaunchProgrammingSchedule()

    // For any daypart with > 1 slot, verify the trigger_at deltas are 15 min.
    const slotsByDaypart = new Map<string, typeof runtime.slot_templates>()
    for (const s of runtime.slot_templates) {
      const list = slotsByDaypart.get(s.daypart) ?? []
      list.push(s)
      slotsByDaypart.set(s.daypart, list)
    }
    for (const [, slots] of slotsByDaypart) {
      if (slots.length < 2) continue
      const triggers = slots.map((slot) => {
        const cue = result.cues.find((c) =>
          c.idempotency_key.endsWith(`:${slot.slot_name}:0`),
        )
        return cue ? new Date(cue.trigger_at).getTime() : 0
      })
      for (let i = 1; i < triggers.length; i++) {
        const delta = triggers[i]! - triggers[i - 1]!
        expect(delta).toBe(15 * 60 * 1000)
      }
    }
  })

  it('is idempotent on repeated invocations (same baseline_contract_version)', async () => {
    const importer = new BaselineCueImporter({ repo })
    const first = await importer.run({
      now: new Date('2026-04-25T12:00:00+08:00'),
    })
    const second = await importer.run({
      now: new Date('2026-04-25T20:00:00+08:00'),
    })

    expect(first.is_new).toBe(true)
    expect(second.is_new).toBe(false)
    expect(second.schedule.id).toBe(first.schedule.id)
    expect(second.cues).toHaveLength(first.cues.length)
    // No additional schedules / cues were created on the second run:
    const allSchedules = await repo.listSchedules()
    expect(allSchedules).toHaveLength(1)
  })
})

describe('BaselineCueImporter — synthetic schedule loader', () => {
  it('handles a daypart with zero slot templates without crashing', async () => {
    const repo = new InMemoryCueRepository()
    const importer = new BaselineCueImporter({
      repo,
      loadSchedule: () => ({
        version: 1,
        draft_status: 'reviewed_working',
        notes: [],
        launch_window: {
          release_phase: 'beta_launch',
          schedule_timezone: 'Asia/Shanghai',
          cadence: 'daily',
        },
        dependency_contracts: {
          roster_source: 'T-133',
          community_rules_source: 'T-134',
          home_surface_source: 'T-135',
          creator_note_source: 'T-136',
          visual_rollout_source: 'T-140',
          governance_source: 'T-141',
        },
        dayparts: [],
        slot_templates: [],
        ops_surfaces: {
          programming_layer: {},
          governance_reference_layer: {},
        },
        health_thresholds: {
          required_daily_outcomes: {
            mainline_roots_min: 0,
            highlight_candidates_min: 0,
            continuity_callbacks_min: 0,
          },
          warnings: [],
        },
        rollback_order: [],
        drill_checklist: [],
      }),
    })
    const result = await importer.run({ now: new Date('2026-04-25T12:00:00+08:00') })
    expect(result.is_new).toBe(true)
    expect(result.cues).toHaveLength(0)
  })
})
