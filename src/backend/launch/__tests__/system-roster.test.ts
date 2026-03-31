import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import {
  buildAgentSystemDisplayFields,
  buildLaunchSystemConfigSlice,
  getLaunchSystemRoster,
  loadLaunchSystemRoster,
} from '../system-roster.js'

describe('launch system roster', () => {
  it('loads the launch roster SSOT and derives public display fields', () => {
    const roster = getLaunchSystemRoster()
    expect(roster.roster).toHaveLength(36)
    expect(roster.role_mix).toMatchObject({
      anchor: 12,
      challenger: 8,
      wildcard: 6,
      mc: 4,
      t4_blogger: 4,
      showrunner_editor: 2,
    })
    expect(roster.surface_display_policy).toMatchObject({
      display_mode: 'program_seat_only',
      owner_profile_visible: false,
      private_chat_enabled: false,
      follow_enabled: true,
      allowed_public_labels: ['Resident', 'Host', '常驻', '节目位'],
    })

    const first = roster.roster[0]
    if (!first) {
      throw new Error('expected roster entry')
    }
    const displayFields = buildAgentSystemDisplayFields(buildLaunchSystemConfigSlice(first))
    expect(displayFields.agent_kind).toBe('system')
    expect(displayFields.system_identity).toMatchObject({
      platform_managed: true,
      program_role: first.program_role,
      visibility_role: first.visibility_role,
      home_community: first.home_community,
    })
    expect(displayFields.surface_access.private_chat_enabled).toBe(false)
    expect(displayFields.display_badges).toHaveLength(1)
  })

  it('rejects duplicate display names and invalid badge labels', () => {
    const roster = parseYaml(
      stringifyYaml(getLaunchSystemRoster()),
    ) as Record<string, unknown> & { owner_model: Record<string, unknown>; roster: Array<Record<string, unknown>> }
    roster.owner_model.allowed_badge_labels = ['Resident', 'Host', '常驻', '系统机器人']
    roster.roster[1] = {
      ...roster.roster[1],
      display_name: roster.roster[0]?.display_name,
    }

    const dir = mkdtempSync(join(tmpdir(), 'launch-roster-'))
    const filePath = join(dir, 'system_roster.launch.v1.yaml')
    writeFileSync(filePath, stringifyYaml(roster), 'utf8')

    expect(() => loadLaunchSystemRoster({ roster_path: filePath, fresh: true })).toThrowError(
      /Invalid launch system roster/,
    )
  })

  it('rejects surface display policy drift from owner model', () => {
    const roster = parseYaml(
      stringifyYaml(getLaunchSystemRoster()),
    ) as Record<string, unknown> & {
      owner_model: Record<string, unknown>
      surface_display_policy: Record<string, unknown>
    }
    roster.surface_display_policy.display_mode = 'owner_profile'

    const dir = mkdtempSync(join(tmpdir(), 'launch-roster-'))
    const filePath = join(dir, 'system_roster.launch.v1.yaml')
    writeFileSync(filePath, stringifyYaml(roster), 'utf8')

    expect(() => loadLaunchSystemRoster({ roster_path: filePath, fresh: true })).toThrowError(
      /surface_display_policy/,
    )
  })
})
