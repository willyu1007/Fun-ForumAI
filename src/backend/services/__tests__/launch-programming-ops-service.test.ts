import { describe, expect, it } from 'vitest'
import type { LaunchProgramRole, LaunchSystemRosterEntry } from '../../launch/system-roster.js'
import { getLaunchSystemRoster } from '../../launch/system-roster.js'
import { recommendProgrammingSlotAssignments } from '../launch-programming-ops-service.js'

function makeRosterEntry(input: {
  id: string
  display_name: string
  program_role: LaunchProgramRole
  home_community: string
  resident_memberships?: string[]
  guest_memberships?: string[]
  avoids?: string[]
  t4_capable?: boolean
}): LaunchSystemRosterEntry {
  return {
    id: input.id,
    display_name: input.display_name,
    program_role: input.program_role,
    visibility_role: 'resident',
    home_community: input.home_community,
    secondary_communities: [],
    resident_memberships: input.resident_memberships ?? [input.home_community],
    guest_memberships: input.guest_memberships ?? [],
    pairing_preferences: {
      prefers: [],
      avoids: input.avoids ?? [],
    },
    image_affinity: 'low',
    t4_capable: input.t4_capable ?? false,
    daily_budget: {
      root_posts: 1,
      replies: 3,
      image_posts: 0,
    },
    cross_route_budget: 1,
    identity_scaffold: {
      role_promise: 'test promise',
      viewer_hook_style: 'test hook',
      stance_axis: 'medium',
      humor_axis: 'low',
      empathy_axis: 'medium',
      narrative_axis: 'low',
      forbidden_tones: ['test'],
      signature_topics: ['test'],
      signature_relationships: [],
      private_lane_policy: 'public_only',
    },
  }
}

describe('recommendProgrammingSlotAssignments', () => {
  it('prefers home-community roster for standard launch communities', () => {
    const roster = getLaunchSystemRoster().roster
    const result = recommendProgrammingSlotAssignments({
      community_name: '热点擂台',
      community_slug: 'hot-arena',
      required_roles: ['anchor', 'challenger'],
      optional_roles: [],
      fallback_roles: ['editor'],
      roster,
    })

    expect(result.assigned_agent_ids).toContain('sys_anchor_hot_01')
    expect(result.assigned_agents.some((agent) =>
      agent.agent_id === 'sys_challenger_hot_01' && agent.community_affinity === 'home_community')).toBe(true)
  })

  it('prioritizes t4_capable seats for T4 slots', () => {
    const roster = getLaunchSystemRoster().roster
    const result = recommendProgrammingSlotAssignments({
      community_name: '种草研究所',
      community_slug: 't4-picks',
      required_roles: ['anchor', 't4_blogger'],
      optional_roles: ['editor'],
      fallback_roles: [],
      strict_t4: true,
      roster,
    })

    const requiredAgents = result.assigned_agents.filter((agent) =>
      agent.requested_role === 'anchor' || agent.requested_role === 't4_blogger')

    expect(requiredAgents).toHaveLength(2)
    expect(requiredAgents.every((agent) => agent.t4_capable)).toBe(true)
  })

  it('avoids explicit pairing conflicts even when the blocked seat has stronger local affinity', () => {
    const roster: LaunchSystemRosterEntry[] = [
      makeRosterEntry({
        id: 'anchor-1',
        display_name: 'Anchor 1',
        program_role: 'anchor',
        home_community: '热点擂台',
        avoids: ['challenger-bad'],
      }),
      makeRosterEntry({
        id: 'challenger-bad',
        display_name: 'Challenger Bad',
        program_role: 'challenger',
        home_community: '热点擂台',
      }),
      makeRosterEntry({
        id: 'challenger-good',
        display_name: 'Challenger Good',
        program_role: 'challenger',
        home_community: '价值观辩台',
        guest_memberships: ['热点擂台'],
      }),
    ]

    const result = recommendProgrammingSlotAssignments({
      community_name: '热点擂台',
      community_slug: 'hot-arena',
      required_roles: ['anchor', 'challenger'],
      optional_roles: [],
      fallback_roles: [],
      roster,
    })

    expect(result.assigned_agent_ids).toEqual(['anchor-1', 'challenger-good'])
    expect(result.assigned_agent_ids).not.toContain('challenger-bad')
  })

  it('returns fallback candidates and unfilled roles instead of throwing when supply is insufficient', () => {
    const roster: LaunchSystemRosterEntry[] = [
      makeRosterEntry({
        id: 'anchor-1',
        display_name: 'Anchor 1',
        program_role: 'anchor',
        home_community: '深夜电台',
      }),
      makeRosterEntry({
        id: 'mc-1',
        display_name: 'MC 1',
        program_role: 'mc',
        home_community: '深夜电台',
      }),
    ]

    const result = recommendProgrammingSlotAssignments({
      community_name: '深夜电台',
      community_slug: 'night-radio',
      required_roles: ['anchor', 'editor'],
      optional_roles: [],
      fallback_roles: ['mc'],
      roster,
    })

    expect(result.assigned_agent_ids).toEqual(['anchor-1', 'mc-1'])
    expect(result.assigned_agents[1]).toMatchObject({
      requested_role: 'editor',
      program_role: 'mc',
      community_affinity: 'fallback_role',
    })
    expect(result.fallback_agent_ids).toEqual([])
    expect(result.unfilled_required_roles).toEqual([])
  })
})
