import { afterEach, describe, expect, it } from 'vitest'
import { config } from '../../lib/config.js'
import type { LaunchProgramRole, LaunchSystemRosterEntry } from '../../launch/system-roster.js'
import { getLaunchSystemRoster } from '../../launch/system-roster.js'
import {
  LaunchProgrammingOpsService,
  type LaunchProgrammingOpsServiceDeps,
  recommendProgrammingSlotAssignments,
} from '../launch-programming-ops-service.js'

const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
const originalProgrammingOps = featureFlags.programmingOpsV1

afterEach(() => {
  featureFlags.programmingOpsV1 = originalProgrammingOps
})

function makeRosterEntry(input: {
  id: string
  display_name: string
  program_role: LaunchProgramRole
  home_community: string
  resident_memberships?: string[]
  guest_memberships?: string[]
  avoids?: string[]
  format_capabilities?: Array<'note'>
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
    format_capabilities: input.format_capabilities ?? [],
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

function createLaunchProgrammingOpsService(
  overrides: Partial<LaunchProgrammingOpsServiceDeps> = {},
): LaunchProgrammingOpsService {
  const deps: LaunchProgrammingOpsServiceDeps = {
    forumReadService: {
      getFeed: async () => ({
        items: [],
        next_cursor: null,
      }),
    } as LaunchProgrammingOpsServiceDeps['forumReadService'],
    globalHighlightsService: {
      collectToday: async () => ({
        hot_threads: [],
        controversy: [],
        featured_agents: [],
        wildcard_cameos: [],
        meta: {
          range: 'today',
          generated_at: new Date('2026-04-11T00:00:00.000Z').toISOString(),
          source: 'global-highlights-v1',
        },
      }),
    } as unknown as LaunchProgrammingOpsServiceDeps['globalHighlightsService'],
    aftershowService: {
      getLatestByPost: async () => ({
        artifact: null,
        callouts: [],
      }),
    } as unknown as LaunchProgrammingOpsServiceDeps['aftershowService'],
    communityRepo: {
      findAll: () => ({
        items: [],
      }),
    } as unknown as LaunchProgrammingOpsServiceDeps['communityRepo'],
    communityProposalRepo: {
      listProposals: async () => [],
      findRecommendationByProposalId: async () => null,
      listEventsByProposalId: async () => [],
    } as unknown as LaunchProgrammingOpsServiceDeps['communityProposalRepo'],
    roleAssignmentRepo: {
      listActiveByScope: () => [],
    } as LaunchProgrammingOpsServiceDeps['roleAssignmentRepo'],
    ...overrides,
  }

  return new LaunchProgrammingOpsService(deps)
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

  it('prioritizes creator-note-capable seats for creator slots', () => {
    const roster = getLaunchSystemRoster().roster
    const result = recommendProgrammingSlotAssignments({
      community_name: '种草研究所',
      community_slug: 'creator-recommendation',
      required_roles: ['anchor', 'creator'],
      optional_roles: ['editor'],
      fallback_roles: [],
      strict_publication: true,
      roster,
    })

    const requiredAgents = result.assigned_agents.filter((agent) =>
      agent.requested_role === 'anchor' || agent.requested_role === 'creator')

    expect(requiredAgents).toHaveLength(2)
    expect(requiredAgents.every((agent) => agent.format_capabilities.includes('note'))).toBe(true)
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

describe('LaunchProgrammingOpsService public methods', () => {
  it('getHomeItems returns an empty list when programming ops is disabled', async () => {
    featureFlags.programmingOpsV1 = false
    const service = createLaunchProgrammingOpsService()

    await expect(service.getHomeItems()).resolves.toEqual([])
  })

  it('getHomeItems returns public programming slot items when programming ops is enabled', async () => {
    featureFlags.programmingOpsV1 = true
    const service = createLaunchProgrammingOpsService()

    const items = await service.getHomeItems({
      now: new Date('2026-04-11T12:00:00.000Z'),
    })

    expect(items.length).toBeGreaterThan(0)
    expect(items[0]).toMatchObject({
      item_kind: 'programming_slot',
      content_kind: 'programming_slot',
      slot_name: expect.any(String),
      daypart_id: expect.any(String),
      lead_seats: expect.any(Array),
      next_jump_target: expect.stringContaining('/c/'),
    })
  })

  it('getAdminPayload returns an enabled read model through the public service method', async () => {
    featureFlags.programmingOpsV1 = true
    const service = createLaunchProgrammingOpsService()

    const payload = await service.getAdminPayload({
      now: new Date('2026-04-11T12:00:00.000Z'),
    })

    expect(payload.enabled).toBe(true)
    expect(payload.dayparts.length).toBeGreaterThan(0)
    expect(payload.slots.length).toBeGreaterThan(0)
    expect(payload.health).toHaveProperty('warnings')
    expect(payload.governance_references).toHaveProperty('communities')
    expect(payload.rollback_order.length).toBeGreaterThan(0)
    expect(payload.meta.source).toBe('launch-programming-ops-v1')
  })
})
