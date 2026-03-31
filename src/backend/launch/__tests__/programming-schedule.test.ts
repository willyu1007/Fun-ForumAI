import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { resolveLaunchContractPath } from '../contract-paths.js'
import { getLaunchProgrammingSchedule } from '../programming-schedule.js'

const sourcePath = resolveLaunchContractPath({
  bundle_slug: 'launch-programming-ops-and-rollout',
  file_name: 'launch_programming_schedule.v1.yaml',
})

function withProgrammingScheduleDraft(
  mutate: (draft: Record<string, unknown>) => void,
): string {
  const source = parseYaml(readFileSync(sourcePath, 'utf8')) as Record<string, unknown>
  mutate(source)
  const dir = mkdtempSync(join(tmpdir(), 'launch-programming-schedule-'))
  const filePath = join(dir, 'launch_programming_schedule.v1.yaml')
  writeFileSync(filePath, stringifyYaml(source), 'utf8')
  return filePath
}

describe('launch programming schedule', () => {
  it('loads the canonical launch schedule and normalizes dayparts / communities', () => {
    const runtime = getLaunchProgrammingSchedule()

    expect(runtime.dayparts.map((item) => item.id)).toEqual([
      'morning_warmup',
      'afternoon_handoff',
      'evening_prime',
      'late_night_callback',
    ])
    expect(runtime.slot_templates.find((slot) => slot.slot_name === 'main_conflict_slot')).toMatchObject({
      community: '热点擂台',
      community_slug: 'hot-arena',
      expected_outputs: {
        surface_kind: 'home_root_card',
      },
    })
  })

  it('rejects unsupported slot roles', () => {
    const filePath = withProgrammingScheduleDraft((draft) => {
      const slots = draft.slot_templates as Array<Record<string, unknown>>
      slots[0] = {
        ...slots[0],
        required_roles: ['anchor', 'director'],
      }
    })

    expect(() => getLaunchProgrammingSchedule(filePath)).toThrowError(/unsupported role/)
  })

  it('rejects slot communities that drift outside the 12 launch lanes', () => {
    const filePath = withProgrammingScheduleDraft((draft) => {
      const slots = draft.slot_templates as Array<Record<string, unknown>>
      slots[1] = {
        ...slots[1],
        community: '不存在的社区',
      }
    })

    expect(() => getLaunchProgrammingSchedule(filePath)).toThrowError(/12 launch communities/)
  })

  it('rejects invalid surface kinds in expected outputs', () => {
    const filePath = withProgrammingScheduleDraft((draft) => {
      const slots = draft.slot_templates as Array<Record<string, unknown>>
      slots[2] = {
        ...slots[2],
        expected_outputs: {
          ...(slots[2]?.expected_outputs as Record<string, unknown>),
          surface_kind: 'hero_marquee',
        },
      }
    })

    expect(() => getLaunchProgrammingSchedule(filePath)).toThrowError(/surface_kind/)
  })
})
