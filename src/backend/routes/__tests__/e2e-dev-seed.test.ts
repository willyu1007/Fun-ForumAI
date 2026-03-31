import { describe, it, expect } from 'vitest'
import request from 'supertest'
import {
  agentBioRefreshService,
  agentService,
  chatService,
  communityRepo,
  humanFollowRepo,
  mediaContextProjectionRepo,
  postMediaRepo,
  roomRepo,
  sceneMediaBindingRepo,
  voteRepo,
} from '../../container.js'
import { config } from '../../lib/config.js'
import { createDevToken } from '../../middleware/human-auth.js'
import { countDevSeedFixtures, getDevSeedFixtureSet } from '../../dev/dev-seed-fixtures.js'
import { app, createTestCommunity } from './e2e-helpers.js'

describe('E2E: Dev seed route', () => {
  it('POST /v1/dev/seed reuses canonical seed agents and repairs archived duplicate-filled rooms', async () => {
    const canonicalFixtures = getDevSeedFixtureSet('canonical')
    const canonicalCounts = countDevSeedFixtures('canonical')
    const canonicalMediaCount = canonicalFixtures.posts.reduce(
      (sum, post) => sum + (post.media?.length ?? 0),
      0,
    )
    const featureFlags = config.features as unknown as Record<string, boolean>
    const previousGuidance = featureFlags.guidanceV1
    const previousGuidanceRecall = featureFlags.guidanceRecallV1
    const previousHumanParticipation = featureFlags.humanParticipationV1
    featureFlags.guidanceV1 = true
    featureFlags.guidanceRecallV1 = true
    featureFlags.humanParticipationV1 = true
    try {
      await createTestCommunity({
        name: '旧版热点擂台',
        slug: 'hot-arena',
        description: '缺少 stage spec 的历史社区',
        rules_json: {},
      })

      const firstRes = await request(app).post('/v1/dev/seed').send()
      expect(firstRes.status).toBe(200)
      const firstCommunityIds = firstRes.body.data.ids.communities as string[]
      const firstAgentIds = firstRes.body.data.ids.agents as string[]
      const firstRoomIds = firstRes.body.data.ids.rooms as string[]
      expect(Array.isArray(firstCommunityIds)).toBe(true)
      expect(firstCommunityIds.length).toBeGreaterThan(0)
      expect(firstRes.body.data.counts.communities).toBe(canonicalCounts.communities)
      expect(firstRes.body.data.counts.agents).toBe(canonicalCounts.agents)
      expect(firstRes.body.data.counts.posts).toBe(canonicalCounts.posts)
      expect(firstRes.body.data.counts.threads).toBe(canonicalCounts.threads)
      expect(firstRes.body.data.counts.rooms).toBe(canonicalCounts.rooms)
      expect(firstRes.body.data.counts.media).toBe(canonicalMediaCount)
      expect(firstRes.body.data.counts.votes).toBe(canonicalCounts.posts * (canonicalCounts.agents - 1))
      expect(firstAgentIds).toHaveLength(canonicalCounts.agents)
      expect(firstRoomIds).toHaveLength(canonicalCounts.rooms)
      expect(firstRes.body.data.counts.follow_links).toBe(2)
      expect(firstRes.body.data.counts.guidance_inbox_items).toBe(4)
      expect(firstRes.body.data.counts.guidance_bell_items).toBe(4)

      const seededLaunchCore = communityRepo.findBySlug('hot-arena')
      expect(seededLaunchCore?.name).toBe('热点擂台')
      expect(seededLaunchCore?.rules_json).toMatchObject({
        stage_spec_v1: expect.objectContaining({ version: 'v1' }),
      })
      expect(humanFollowRepo.isFollowing('dev-user-001', firstAgentIds[4]!)).toBe(true)
      expect(humanFollowRepo.isFollowing('dev-admin-001', firstAgentIds[0]!)).toBe(true)
      expect(postMediaRepo.findByPostId('seed-post-cyberpunk-city-images')).toHaveLength(3)
      const firstBindings = await sceneMediaBindingRepo.findByScene('forum_post', 'seed-post-cyberpunk-city-images')
      expect(firstBindings).toHaveLength(3)
      const firstProjections = await mediaContextProjectionRepo.findByBindingIds(firstBindings.map((item) => item.id))
      expect(firstProjections).toHaveLength(3)
      expect(voteRepo.findByTarget('POST', 'seed-post-welcome-launch-core')).toHaveLength(canonicalCounts.agents - 1)

      const devUserToken = createDevToken({ userId: 'dev-user-001', email: 'dev-user-001@dev.local', role: 'user' })
      const devAdminToken = createDevToken({ userId: 'dev-admin-001', email: 'dev-admin-001@dev.local', role: 'admin' })
      const [devUserInboxRes, devUserBellRes, devAdminInboxRes, devAdminBellRes] = await Promise.all([
        request(app)
          .get('/v1/guidance/inbox')
          .set('Authorization', `Bearer ${devUserToken}`),
        request(app)
          .get('/v1/guidance/bell')
          .set('Authorization', `Bearer ${devUserToken}`),
        request(app)
          .get('/v1/guidance/inbox')
          .set('Authorization', `Bearer ${devAdminToken}`),
        request(app)
          .get('/v1/guidance/bell')
          .set('Authorization', `Bearer ${devAdminToken}`),
      ])
      expect(devUserInboxRes.status).toBe(200)
      expect(devUserBellRes.status).toBe(200)
      expect(devAdminInboxRes.status).toBe(200)
      expect(devAdminBellRes.status).toBe(200)
      expect(devUserInboxRes.body.data.items).toEqual(expect.arrayContaining([
        expect.objectContaining({
          reason_code: 'USE_FOLLOWING_FEED',
          cta: expect.objectContaining({ target: '/?following_only=true' }),
        }),
        expect.objectContaining({
          reason_code: 'FOLLOWED_AGENT_STORY_ESCALATED',
          cta: expect.objectContaining({ target: expect.stringMatching(/^\/posts\//) }),
        }),
      ]))
      expect(devUserBellRes.body.data.items).toEqual(expect.arrayContaining([
        expect.objectContaining({ reason_code: 'USE_FOLLOWING_FEED' }),
        expect.objectContaining({ reason_code: 'FOLLOWED_AGENT_STORY_ESCALATED' }),
      ]))
      expect(devAdminInboxRes.body.data.items).toEqual(expect.arrayContaining([
        expect.objectContaining({
          reason_code: 'USE_FOLLOWING_FEED',
          cta: expect.objectContaining({ target: '/?following_only=true' }),
        }),
        expect.objectContaining({
          reason_code: 'FOLLOWED_AGENT_STORY_ESCALATED',
          cta: expect.objectContaining({ target: expect.stringMatching(/^\/posts\//) }),
        }),
      ]))
      expect(devAdminBellRes.body.data.items).toEqual(expect.arrayContaining([
        expect.objectContaining({ reason_code: 'USE_FOLLOWING_FEED' }),
        expect.objectContaining({ reason_code: 'FOLLOWED_AGENT_STORY_ESCALATED' }),
      ]))

      const duplicateHost = await agentService.createAgentPersisted({
        owner_id: 'dev-user-001',
        display_name: '苏格拉底-7B-临时污染体',
        model: 'qwen-plus',
      })
      const duplicateGuest = await agentService.createAgentPersisted({
        owner_id: 'dev-user-001',
        display_name: '洛芙蕾丝-临时污染体',
        model: 'qwen-plus',
      })

      await chatService.dispatchAgentToRoom(firstRoomIds[0], duplicateHost.id, 'dev-user-001')
      await chatService.dispatchAgentToRoom(firstRoomIds[0], duplicateGuest.id, 'dev-user-001')

      const archived = await roomRepo.updateStatus(firstRoomIds[0], 'archived')
      expect(archived?.status).toBe('archived')
      const afterFirstSeedBio = agentBioRefreshService.inspectObservability()

      const secondRes = await request(app).post('/v1/dev/seed').send()
      expect(secondRes.status).toBe(200)
      expect(secondRes.body.data.ids.communities).toEqual(firstCommunityIds)
      expect(secondRes.body.data.ids.agents).toEqual(firstAgentIds)
      expect(secondRes.body.data.ids.posts).toEqual(firstRes.body.data.ids.posts)
      expect(secondRes.body.data.ids.threads).toEqual(firstRes.body.data.ids.threads)
      expect(secondRes.body.data.ids.rooms).toEqual(firstRoomIds)
      expect(secondRes.body.data.counts.communities).toBe(canonicalCounts.communities)
      expect(secondRes.body.data.counts.posts).toBe(canonicalCounts.posts)
      expect(secondRes.body.data.counts.threads).toBe(canonicalCounts.threads)
      expect(secondRes.body.data.counts.rooms).toBe(canonicalCounts.rooms)
      expect(secondRes.body.data.counts.media).toBe(canonicalMediaCount)
      expect(secondRes.body.data.counts.votes).toBe(canonicalCounts.posts * (canonicalCounts.agents - 1))
      expect(secondRes.body.data.counts.guidance_inbox_items).toBe(4)
      expect(secondRes.body.data.counts.guidance_bell_items).toBe(4)

      const repairedRoom = await chatService.getRoom(firstRoomIds[0])
      expect(repairedRoom.status).toBe('active')
      expect(repairedRoom.members.map((member) => member.member_id).sort()).toEqual(
        [firstAgentIds[0], firstAgentIds[1], firstAgentIds[2]].sort(),
      )

      const refreshedBell = await request(app)
        .get('/v1/guidance/bell')
        .set('Authorization', `Bearer ${devUserToken}`)
      expect(refreshedBell.status).toBe(200)
      expect(refreshedBell.body.data.items).toEqual(expect.arrayContaining([
        expect.objectContaining({ reason_code: 'USE_FOLLOWING_FEED' }),
        expect.objectContaining({ reason_code: 'FOLLOWED_AGENT_STORY_ESCALATED' }),
      ]))
      expect(postMediaRepo.findByPostId('seed-post-cyberpunk-city-images')).toHaveLength(3)
      const secondBindings = await sceneMediaBindingRepo.findByScene('forum_post', 'seed-post-cyberpunk-city-images')
      expect(secondBindings).toHaveLength(3)
      const secondProjections = await mediaContextProjectionRepo.findByBindingIds(secondBindings.map((item) => item.id))
      expect(secondProjections).toHaveLength(3)
      expect(voteRepo.findByTarget('POST', 'seed-post-welcome-launch-core')).toHaveLength(canonicalCounts.agents - 1)

      const afterSecondSeedBio = agentBioRefreshService.inspectObservability()
      expect(afterSecondSeedBio.counts.committed).toBe(afterFirstSeedBio.counts.committed)
      expect(afterSecondSeedBio.by_kind.major.committed).toBe(afterFirstSeedBio.by_kind.major.committed)
    } finally {
      featureFlags.guidanceV1 = previousGuidance
      featureFlags.guidanceRecallV1 = previousGuidanceRecall
      featureFlags.humanParticipationV1 = previousHumanParticipation
    }
  })

  it('POST /v1/dev/seed supports smoke-minimal without inflating canonical fixtures', async () => {
    const smokeCounts = countDevSeedFixtures('smoke-minimal')

    const firstRes = await request(app)
      .post('/v1/dev/seed')
      .send({ profile: 'smoke-minimal' })
    expect(firstRes.status).toBe(200)
    expect(firstRes.body.data.profile).toBe('smoke-minimal')
    expect(firstRes.body.data.counts.communities).toBe(smokeCounts.communities)
    expect(firstRes.body.data.counts.agents).toBe(smokeCounts.agents)
    expect(firstRes.body.data.counts.posts).toBe(smokeCounts.posts)
    expect(firstRes.body.data.counts.threads).toBe(0)
    expect(firstRes.body.data.counts.rooms).toBe(0)
    expect(firstRes.body.data.counts.votes).toBe(0)
    expect(firstRes.body.data.counts.media).toBe(0)
    expect(firstRes.body.data.counts.private_sessions).toBe(0)
    expect(firstRes.body.data.counts.private_messages).toBe(0)
    expect(firstRes.body.data.counts.notifications).toBe(0)
    expect(firstRes.body.data.counts.follow_links).toBe(0)
    expect(firstRes.body.data.counts.guidance_inbox_items).toBe(0)
    expect(firstRes.body.data.counts.guidance_bell_items).toBe(0)
    expect(firstRes.body.data.ids.agents).toHaveLength(1)
    expect(firstRes.body.data.ids.posts).toEqual(['seed-post-welcome-launch-core'])
    expect(await roomRepo.findBySlug('code-tasting')).not.toBeNull()

    const secondRes = await request(app)
      .post('/v1/dev/seed')
      .send({ profile: 'smoke-minimal' })
    expect(secondRes.status).toBe(200)
    expect(secondRes.body.data.ids.communities).toEqual(firstRes.body.data.ids.communities)
    expect(secondRes.body.data.ids.agents).toEqual(firstRes.body.data.ids.agents)
    expect(secondRes.body.data.ids.posts).toEqual(firstRes.body.data.ids.posts)
    expect(secondRes.body.data.ids.rooms).toEqual([])
    expect(secondRes.body.data.ids.threads).toEqual([])
  })

  it('POST /v1/dev/seed supports launch roster bootstrap without materializing content fixtures', async () => {
    const launchCounts = countDevSeedFixtures('launch')

    const res = await request(app)
      .post('/v1/dev/seed')
      .send({ profile: 'launch' })
    expect(res.status).toBe(200)
    expect(res.body.data.profile).toBe('launch')
    expect(res.body.data.counts.communities).toBe(launchCounts.communities)
    expect(res.body.data.counts.agents).toBe(launchCounts.agents)
    expect(res.body.data.counts.posts).toBe(0)
    expect(res.body.data.counts.threads).toBe(0)
    expect(res.body.data.counts.rooms).toBe(0)
    expect(res.body.data.counts.votes).toBe(0)
    expect(res.body.data.counts.media).toBe(0)
    expect(res.body.data.ids.agents).toHaveLength(launchCounts.agents)

    const firstAgentId = res.body.data.ids.agents[0] as string | undefined
    expect(firstAgentId).toBeTruthy()
    const seededAgent = agentService.getAgent(firstAgentId!)
    expect(seededAgent.owner_id).toBe('platform-system-owner')

    const profileRes = await request(app).get(`/v1/agents/${firstAgentId}/profile`)
    expect(profileRes.status).toBe(200)
    expect(profileRes.body.data.owner_id).toBeNull()
    expect(profileRes.body.data.agent_kind).toBe('system')
    expect(profileRes.body.data.surface_access.private_chat_enabled).toBe(false)
    expect(profileRes.body.data.display_badges).toEqual(expect.any(Array))
    expect(profileRes.body.data.display_badges.length).toBeGreaterThan(0)
  })

  it('DELETE /v1/dev/seed requires the local reset script', async () => {
    const res = await request(app).delete('/v1/dev/seed').send()
    expect(res.status).toBe(400)
    expect(res.body.error).toMatchObject({
      code: 'SEED_RESET_SCRIPT_REQUIRED',
    })
    expect(res.body.error.message).toContain('pnpm dev:reset:seed')
  })
})
