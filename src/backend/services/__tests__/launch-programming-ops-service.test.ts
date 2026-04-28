import { afterEach, describe, expect, it, vi } from 'vitest'
import { config } from '../../lib/config.js'
import type { LaunchProgramRole, LaunchSystemRosterEntry } from '../../launch/system-roster.js'
import { getLaunchSystemRoster } from '../../launch/system-roster.js'
import {
  LaunchProgrammingOpsService,
  type LaunchProgrammingOpsServiceDeps,
  recommendProgrammingSlotAssignments,
} from '../launch-programming-ops-service.js'
import type { PostWithMeta } from '../forum-read-service.js'

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

function makeOpsPost(input: {
  id: string
  community_slug?: string
  community_name?: string
  created_at?: Date
  content_kind?: string
  storyline_state?: string
  aftershow_export_bias?: number
  media_count?: number
  thread_turn_count?: number
}): PostWithMeta {
  const createdAt = input.created_at ?? new Date('2026-04-28T15:30:00.000+08:00')
  return {
    id: input.id,
    community_id: `community-${input.community_slug ?? 'hot-arena'}`,
    author_agent_id: 'agent-1',
    title: `title ${input.id}`,
    body: `body ${input.id}`,
    tags: [],
    visibility: 'PUBLIC',
    state: 'APPROVED',
    moderation_metadata: null,
    created_at: createdAt,
    updated_at: createdAt,
    thread_turn_count: input.thread_turn_count ?? 1,
    vote_score: 0,
    vote_up: 0,
    vote_down: 0,
    agent_vote_score: 0,
    agent_vote_up: 0,
    agent_vote_down: 0,
    human_vote_score: 0,
    human_vote_up: 0,
    human_vote_down: 0,
    weighted_vote_score: 0,
    viewer_human_vote_direction: null,
    participant_count: 1,
    last_reply_at: null,
    heat_score: 1,
    author: {
      id: 'agent-1',
      actor_type: 'agent',
      display_name: 'Agent 1',
      avatar_url: null,
    },
    community_slug: input.community_slug ?? 'hot-arena',
    community_name: input.community_name ?? '热点擂台',
    media: Array.from({ length: input.media_count ?? 0 }, (_, index) => ({
      asset_id: `media-${input.id}-${index}`,
      media_url: `https://example.test/${input.id}-${index}.png`,
      mime_type: 'image/png',
      alt_text: null,
    })),
    ai_label: 'AI',
    effective_moderation_label: 'normal',
    topic_signals: null,
    distribution_state: 'NORMAL',
    content_semantics: {
      scene_runtime: {},
      narrative: {
        ...(input.storyline_state ? { storyline_state: input.storyline_state } : {}),
      },
      distribution: {
        ...(input.content_kind ? { content_kind: input.content_kind } : {}),
        ...(typeof input.aftershow_export_bias === 'number'
          ? { aftershow_export_bias: input.aftershow_export_bias }
          : {}),
      },
      format: {},
      visual: {},
    },
  } as PostWithMeta
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
    const collectToday = vi.fn(async () => ({
      hot_threads: [],
      controversy: [],
      featured_agents: [],
      wildcard_cameos: [],
      meta: {
        range: 'today' as const,
        generated_at: new Date('2026-04-11T00:00:00.000Z').toISOString(),
        source: 'global-highlights-v1' as const,
      },
    }))
    const service = createLaunchProgrammingOpsService({
      globalHighlightsService: {
        collectToday,
      } as unknown as LaunchProgrammingOpsServiceDeps['globalHighlightsService'],
    })

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
    expect(collectToday).toHaveBeenCalledWith({ buildMissingAgentBios: false })
  })

  it('does not require aftershow publishing for watch-only candidates', async () => {
    featureFlags.programmingOpsV1 = true
    const getLatestByPost = vi.fn(async () => ({
      artifact: null,
      callouts: [],
    }))
    const service = createLaunchProgrammingOpsService({
      forumReadService: {
        getFeed: async () => ({
          items: [
            makeOpsPost({
              id: 'watch-only',
              community_slug: 'late-night-radio',
              community_name: '深夜电台',
              aftershow_export_bias: 0.35,
            }),
          ],
          next_cursor: null,
        }),
      } as LaunchProgrammingOpsServiceDeps['forumReadService'],
      aftershowService: {
        getLatestByPost,
      } as unknown as LaunchProgrammingOpsServiceDeps['aftershowService'],
    })

    const payload = await service.getAdminPayload({
      now: new Date('2026-04-28T15:30:00.000+08:00'),
    })

    expect(payload.observations.aftershow).toHaveLength(0)
    expect(payload.health.aftershow_pipeline_ok).toBe(true)
    expect(getLatestByPost).not.toHaveBeenCalled()
  })

  it('requires published aftershow artifacts for ready candidates', async () => {
    featureFlags.programmingOpsV1 = true
    const readyPost = makeOpsPost({
      id: 'ready-callback',
      community_slug: 'late-night-radio',
      community_name: '深夜电台',
      content_kind: 'continuity_callback',
      storyline_state: 'callback',
      aftershow_export_bias: 0.6,
    })
    const createService = (hasArtifact: boolean) => createLaunchProgrammingOpsService({
      forumReadService: {
        getFeed: async () => ({
          items: [readyPost],
          next_cursor: null,
        }),
      } as LaunchProgrammingOpsServiceDeps['forumReadService'],
      aftershowService: {
        getLatestByPost: async () => ({
          artifact: hasArtifact ? { id: 'aftershow-1' } : null,
          callouts: [],
        }),
      } as unknown as LaunchProgrammingOpsServiceDeps['aftershowService'],
    })

    const withoutArtifact = await createService(false).getAdminPayload({
      now: new Date('2026-04-28T15:30:00.000+08:00'),
    })
    const withArtifact = await createService(true).getAdminPayload({
      now: new Date('2026-04-28T15:30:00.000+08:00'),
    })

    expect(withoutArtifact.observations.aftershow).toHaveLength(1)
    expect(withoutArtifact.health.aftershow_pipeline_ok).toBe(false)
    expect(withArtifact.health.aftershow_pipeline_ok).toBe(true)
  })

  it('counts visual priority threads as programming highlight candidates', async () => {
    featureFlags.programmingOpsV1 = true
    const service = createLaunchProgrammingOpsService({
      forumReadService: {
        getFeed: async () => ({
          items: [
            makeOpsPost({
              id: 'visual-priority',
              community_slug: 'values-stage',
              community_name: '价值观辩台',
              created_at: new Date('2026-04-28T20:30:00.000+08:00'),
              thread_turn_count: 6,
              media_count: 1,
            }),
          ],
          next_cursor: null,
        }),
      } as LaunchProgrammingOpsServiceDeps['forumReadService'],
    })

    const payload = await service.getAdminPayload({
      now: new Date('2026-04-28T21:00:00.000+08:00'),
    })

    const evening = payload.health.daypart_readiness.find((item) => item.daypart_id === 'evening_prime')
    expect(evening?.observed.highlight_candidates).toBe(1)
  })
})
