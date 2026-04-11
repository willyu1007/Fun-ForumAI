import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildAgentTarget } from '../../../shared/agent-target.js'
import { InMemoryAgentRepository, InMemoryAgentConfigRepository } from '../../repos/agent-repository.js'
import { InMemoryAgentRunRepository, InMemoryEventRepository } from '../../repos/event-repository.js'
import { InMemoryAchievementRepository } from '../../repos/achievement-repository.js'
import { InMemoryChronicleRepository } from '../../repos/chronicle-repository.js'
import { InMemoryAgentPublicProjectionRepository } from '../../repos/agent-public-projection-repository.js'
import { InMemoryAgentCommunityMembershipRepository } from '../../repos/agent-community-membership-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { InMemoryPublicStageThreadRepository } from '../../repos/public-stage-thread-repository.js'
import { InMemoryPublicStageTurnRepository } from '../../repos/public-stage-turn-repository.js'
import { InMemoryRoomRepository } from '../../repos/room-repository.js'
import { AgentService } from '../agent-service.js'
import { AchievementChronicleService } from '../achievement-chronicle-service.js'
import { AgentPublicProjectionService } from '../agent-public-projection-service.js'
import { AgentCommunityMembershipService } from '../agent-community-membership-service.js'
import { StatsService } from '../stats-service.js'
import { InMemoryStatsRepository } from '../../repos/stats-repository.js'
import { OwnerLifeOverviewService } from '../owner-life-overview-service.js'
import { buildInitialIdentityConfig } from '../../identity/agent-identity.js'
import { config } from '../../lib/config.js'

describe('OwnerLifeOverviewService', () => {
  const features = config.launch.capabilities as unknown as Record<string, boolean>
  const originalChronicle = features.achievementChronicleV1
  const originalPublicHighlights = features.achievementPublicHighlights

  beforeEach(() => {
    features.achievementChronicleV1 = true
    features.achievementPublicHighlights = true
  })

  afterEach(() => {
    features.achievementChronicleV1 = originalChronicle
    features.achievementPublicHighlights = originalPublicHighlights
  })

  it('builds the owner aggregate, keeps private afterglow abstract, and shares one chronicle contract', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const agentConfigRepo = new InMemoryAgentConfigRepository()
    const agentRunRepo = new InMemoryAgentRunRepository()
    const achievementRepo = new InMemoryAchievementRepository()
    const chronicleRepo = new InMemoryChronicleRepository()
    const projectionRepo = new InMemoryAgentPublicProjectionRepository()
    const membershipRepo = new InMemoryAgentCommunityMembershipRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const publicStageThreadRepo = new InMemoryPublicStageThreadRepository()
    const publicStageTurnRepo = new InMemoryPublicStageTurnRepository()
    const roomRepo = new InMemoryRoomRepository()
    const eventRepo = new InMemoryEventRepository()
    const statsRepo = new InMemoryStatsRepository()

    const agentService = new AgentService({
      agentRepo,
      agentConfigRepo,
      agentRunRepo,
    })
    const chronicleService = new AchievementChronicleService({
      achievementRepo,
      chronicleRepo,
      agentRepo,
    })
    const statsService = new StatsService({
      statsRepo,
      agentRepo,
      agentService,
      xpService: null,
    })
    const projectionService = new AgentPublicProjectionService({
      projectionRepo,
      agentRepo,
      agentService,
      statsService,
      achievementChronicleService: chronicleService,
    })
    const membershipService = new AgentCommunityMembershipService({
      membershipRepo,
      agentRepo,
      communityRepo,
      postRepo: { findPublic: async () => ({ items: [], next_cursor: null }) } as never,
      publicStageThreadRepo,
      publicStageTurnRepo,
      eventRepo,
    })

    const agent = agentRepo.create({
      owner_id: 'owner-1',
      display_name: 'Owner Bot',
    })
    const friend = agentRepo.create({
      owner_id: 'owner-2',
      display_name: 'Friend Bot',
    })

    agentConfigRepo.create({
      agent_id: agent.id,
      config_json: buildInitialIdentityConfig({
        ownerStylePins: { interests: ['音乐', '播客'] },
        selectedAt: new Date('2026-03-10T00:00:00.000Z'),
      }),
      updated_by: agent.owner_id,
    })

    const community = communityRepo.create({
      name: 'Talk Lab',
      slug: 'talk-lab',
      description: 'public stage',
    })
    await membershipRepo.upsertActive({
      agent_id: agent.id,
      community_id: community.id,
    })

    const room = await roomRepo.create({
      name: '夜聊房',
      slug: 'night-room',
      created_by_agent_id: agent.id,
      community_id: community.id,
      description: 'night room',
    })
    await roomRepo.addMember(room.id, agent.id, 'creator', 20_000)
    await roomRepo.addMember(room.id, friend.id, 'dispatched', 20_000)

    await achievementRepo.grant({
      agent_id: agent.id,
      code: 'private_digest_keeper',
      name: 'Private Digest Keeper',
      category: 'private',
      tier: 2,
      scope: 'global',
      scope_key: '__global__',
      visibility: 'OWNER_ONLY',
      achieved_at: new Date('2026-03-12T01:00:00.000Z'),
      evidence: [{ kind: 'private_digest', ref_id: 'session-1' }],
    })

    await chronicleService.recordChronicle({
      agent_id: agent.id,
      visibility: 'OWNER_ONLY',
      type: 'PRIVATE_DIGEST',
      title: '私聊余温留下来',
      summary: '她把一次长对话消化成了更柔和的余温。',
      importance_score: 0.91,
      evidence: [{ kind: 'private_digest', ref_id: 'session-1' }],
      actors: [agent.id],
      occurred_at: new Date('2026-03-12T00:00:00.000Z'),
    })
    await chronicleService.recordChronicle({
      agent_id: agent.id,
      visibility: 'OWNER_ONLY',
      type: 'RELATION_CHANGE',
      title: '和搭子的节奏开始对上',
      summary: '她和另一个常驻角色开始形成固定来回。',
      importance_score: 0.73,
      evidence: [{ kind: 'relation', ref_id: friend.id }],
      actors: [friend.id],
      tags: [`peer:${friend.id}`],
      occurred_at: new Date('2026-03-11T00:00:00.000Z'),
    })
    await chronicleService.recordChronicle({
      agent_id: agent.id,
      visibility: 'PUBLIC',
      type: 'HIGHLIGHT',
      title: '公域里第一次接住梗',
      summary: '她在公开场里第一次把梗接成了气氛。',
      importance_score: 0.82,
      evidence: [{ kind: 'chronicle', ref_id: 'public-1' }],
      tags: [`community:${community.id}`],
      occurred_at: new Date('2026-03-10T00:00:00.000Z'),
    })
    await chronicleService.recordChronicle({
      agent_id: agent.id,
      visibility: 'OWNER_ONLY',
      type: 'MODERATION',
      title: '边界被重新校准',
      summary: '系统对她的公开边界又做了一次轻微校准。',
      importance_score: 0.55,
      evidence: [{ kind: 'governance', ref_id: 'gov-1' }],
      tags: ['system:boundary'],
      occurred_at: new Date('2026-03-09T00:00:00.000Z'),
    })

    const service = new OwnerLifeOverviewService({
      agentService,
      chronicleService,
      projectionService,
      membershipService,
      communityRepo,
      roomRepo,
      runtimeSceneStateManager: {
        findActiveByRoom: async () => ({
          room_id: room.id,
          state_json: {
            cast: { active_agent_ids: [agent.id, friend.id] },
          },
        }),
      } as never,
      statsService,
    })

    service.attachRuntimeDeps({
      memoryService: {
        listMemories: async () => ({
          items: [
            {
              id: 'mem-1',
              agent_id: agent.id,
              source_type: 'PRIVATE_CHAT',
              source_session_id: 'session-1',
              source_ref_type: null,
              source_ref_id: null,
              source_event_id: null,
              summary_text: 'owner said secret phrase',
              topic_tags: ['private'],
              key_facts: ['secret phrase'],
              sentiment: 'warm',
              importance_score: 0.9,
              privacy_floor: 3,
              access_count: 0,
              forgotten: false,
              created_at: new Date('2026-03-12T00:00:00.000Z'),
              last_accessed_at: null,
            },
          ],
          next_cursor: null,
        }),
      } as never,
      relationService: {
        getSummary: async () => ({
          following: { shadow: 0, effective: 1, inactive: 0, blocked: 0 },
          followers: { shadow: 0, effective: 1, inactive: 0, blocked: 0 },
          friends: 1,
        }),
        listRelations: async () => ({
          items: [
            {
              pair_agent_id: friend.id,
            },
          ],
          next_cursor: null,
        }),
      } as never,
    })

    const feed = await service.getChronicleFeed(agent.id, { limit: 10 })
    const ownerOnlyFeed = await service.getChronicleFeed(agent.id, {
      limit: 10,
      source_dimension: 'OWNER',
    })
    const overview = await service.getLifeOverview(agent.id)
    const suggestions = await service.getNurtureSuggestions(agent.id)

    expect(feed.items.map((item) => item.source_dimension)).toEqual(
      expect.arrayContaining(['OWNER', 'SOCIAL', 'WORLD', 'SYSTEM']),
    )
    expect(feed.chapter).toMatchObject({
      chapter_key: 'OWNER:2026-03',
      title: '你与她的私域篇 2026 / 03',
      source_mix: ['OWNER'],
      beat_ids: [expect.stringContaining(':OWNER:2026-03')],
    })
    expect(ownerOnlyFeed.items.every((item) => item.source_dimension === 'OWNER')).toBe(true)
    expect(ownerOnlyFeed.items.some((item) => item.scene_label === 'owner 线')).toBe(false)
    expect(ownerOnlyFeed.items.some((item) => item.summary.includes('系统捕捉到'))).toBe(false)
    expect(feed.items[0]?.seals[0]?.code).toBe('private_digest_keeper')
    expect(feed.chapter_cast).toMatchObject({
      chapter_key: 'OWNER:2026-03',
      chapter_title: '你与她的私域篇 2026 / 03',
      summary_line: expect.any(String),
      recurring: [],
      warming_up: [],
      drifting: [],
      scene_cards: [],
    })
    expect(overview.hero.headline).toContain('Owner Bot')
    expect(overview.recent_story_beats).toHaveLength(3)
    expect(overview.chapter_cast).toMatchObject({
      chapter_key: 'OWNER:2026-03',
      chapter_title: '你与她的私域篇 2026 / 03',
      summary_line: expect.any(String),
      scene_cards: [],
    })
    expect(overview.recent_achievement_seals).toHaveLength(1)
    expect(overview.recent_achievement_seals[0]).toMatchObject({
      id: expect.any(String),
      achievement_id: expect.any(String),
      code: 'private_digest_keeper',
      source_dimension: 'OWNER',
      source_label: '来自你',
      scope_label: '整段人生线',
      story_link: {
        title: '私聊余温留下来',
      },
    })
    expect(overview.nurture_suggestions.map((item) => item.lane)).toEqual([
      'WORLD',
      'SOCIAL',
      'OWNER',
      'TUNING',
    ])
    expect(overview.nurture_suggestions[2]).toMatchObject({
      title: '顺着这股余温再陪她走一段',
      primary_action: {
        label: '再带一点经历给她',
      },
    })
    expect(overview.entry_points.chronicle.href).toBe(buildAgentTarget({
      agentId: agent.id,
      mode: 'manage',
      tab: 'history',
    }))
    expect(overview.meta.degraded).toBe(false)
    expect(overview.owner_projection.latest_session?.session_id).toBe('session-1')
    expect(JSON.stringify(overview)).not.toContain('secret phrase')
    expect(suggestions.items[0]?.primary_action.kind).toBe('nudge_to_community')
    expect(suggestions.items[3]?.priority).toBe('optional')
  })
})
