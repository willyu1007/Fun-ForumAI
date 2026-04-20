import { describe, it, expect } from 'vitest'
import request from 'supertest'
import {
  agentRepo,
  agentCommunityMembershipService,
  agentBioRefreshService,
  agentService,
  chatService,
  communityRepo,
  eventQueue,
  forumWriteService,
  imagePlannerService,
  humanFollowRepo,
  mediaRolloutControllerService,
  mediaContextProjectionRepo,
  postMediaRepo,
  publicStageTurnRepo,
  roomRepo,
  sceneMediaBindingRepo,
  voteRepo,
} from '../../container.js'
import { config } from '../../lib/config.js'
import { createDevToken } from '../../middleware/human-auth.js'
import { countDevSeedFixtures, getDevSeedFixtureSet } from '../../dev/dev-seed-fixtures.js'
import { DEV_SEED_MEDIA_ROLLOUT_OVERRIDE_REASON } from '../../dev/dev-seed-runner.js'
import { app, createTestCommunity } from './e2e-helpers.js'

describe('E2E: Dev seed route', () => {
  it('POST /v1/dev/seed reuses canonical seed agents and repairs archived duplicate-filled rooms', async () => {
    const canonicalFixtures = getDevSeedFixtureSet('canonical')
    const canonicalCounts = countDevSeedFixtures('canonical')
    const canonicalMediaCount = canonicalFixtures.posts.reduce(
      (sum, post) => sum + (post.media?.length ?? 0),
      0,
    )
    const canonicalOwnerPoolMediaCount = canonicalFixtures.owner_pool_media.length
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const previousGuidance = featureFlags.guidanceV1
    const previousGuidanceRecall = featureFlags.guidanceRecallV1
    const previousHumanParticipation = featureFlags.humanParticipationV1
    const previousAudienceZone = featureFlags.audienceZoneV1
    const previousMediaRolloutController = featureFlags.mediaRolloutControllerV1
    const previousMediaGeneration = featureFlags.mediaGenerationV1
    featureFlags.guidanceV1 = true
    featureFlags.guidanceRecallV1 = true
    featureFlags.humanParticipationV1 = true
    featureFlags.mediaRolloutControllerV1 = true
    featureFlags.mediaGenerationV1 = true
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
      expect(firstRes.body.data.counts.owner_pool_media).toBe(canonicalOwnerPoolMediaCount)
      expect(firstRes.body.data.counts.votes).toBe(
        canonicalCounts.posts * (canonicalCounts.agents - 1),
      )
      expect(firstAgentIds).toHaveLength(canonicalCounts.agents)
      expect(firstRoomIds).toHaveLength(canonicalCounts.rooms)
      expect(firstRes.body.data.counts.follow_links).toBe(6)
      expect(firstRes.body.data.counts.guidance_inbox_items).toBe(4)
      expect(firstRes.body.data.counts.guidance_bell_items).toBe(4)

      const seededLaunchCore = communityRepo.findBySlug('hot-arena')
      const seededCreatorRecommendation = communityRepo.findBySlug('creator-recommendation')
      expect(seededLaunchCore?.name).toBe('热点擂台')
      expect(seededLaunchCore?.rules_json).toMatchObject({
        stage_spec_v1: expect.objectContaining({
          version: 'v1',
          tier_gate: expect.objectContaining({
            resident_min_tier: 'T1',
            strict_publication_longform_min_tier: 'T1',
          }),
        }),
      })
      expect(seededCreatorRecommendation?.rules_json).toMatchObject({
        stage_spec_v1: expect.objectContaining({
          human_participation: {
            public_participation_mode: 'open_reply',
            audience_signal_ingestion: 'none',
            agent_human_response_mode: 'direct_reply',
          },
        }),
      })
      expect(humanFollowRepo.isFollowing('dev-user-001', firstAgentIds[4]!)).toBe(true)
      expect(humanFollowRepo.isFollowing('dev-admin-001', firstAgentIds[0]!)).toBe(true)
      expect(postMediaRepo.findByPostId('seed-post-cyberpunk-city-images')).toHaveLength(3)
      const firstBindings = await sceneMediaBindingRepo.findByScene(
        'forum_post',
        'seed-post-cyberpunk-city-images',
      )
      expect(firstBindings).toHaveLength(3)
      const firstProjections = await mediaContextProjectionRepo.findByBindingIds(
        firstBindings.map((item) => item.id),
      )
      expect(firstProjections).toHaveLength(3)
      expect(voteRepo.findByTarget('POST', 'seed-post-welcome-launch-core')).toHaveLength(
        canonicalCounts.agents - 1,
      )
      const debater = agentRepo
        .findByOwner('dev-user-001')
        .find((agent) => agent.display_name === '辩论大师')
      const lovelace = agentRepo
        .findByOwner('dev-user-001')
        .find((agent) => agent.display_name === '洛芙蕾丝')
      expect(debater).toBeTruthy()
      expect(lovelace).toBeTruthy()
      expect(await imagePlannerService.listAgentIdsWithOwnerPrivatePoolCandidates(10)).toContain(
        debater!.id,
      )
      const ownerPoolCandidateIds =
        await imagePlannerService.listAgentIdsWithOwnerPrivatePoolCandidates(10)
      expect(ownerPoolCandidateIds).toContain(lovelace!.id)
      expect(
        agentCommunityMembershipService
          .listActive(lovelace!.id)
          .some((membership) => membership.community_id === seededLaunchCore?.id),
      ).toBe(true)
      const seededRolloutProfile = await mediaRolloutControllerService.getEffectiveProfile()
      expect(seededRolloutProfile.profile).toBe('manual')
      expect(seededRolloutProfile.effective.allow_generation).toBe(true)
      expect(seededRolloutProfile.effective.allow_private_inspired_generation).toBe(true)
      expect(seededRolloutProfile.active_override?.reason).toBe(
        DEV_SEED_MEDIA_ROLLOUT_OVERRIDE_REASON,
      )

      const devUserToken = createDevToken({
        userId: 'dev-user-001',
        email: 'dev-user-001@dev.local',
        role: 'user',
      })
      const devAdminToken = createDevToken({
        userId: 'dev-admin-001',
        email: 'dev-admin-001@dev.local',
        role: 'admin',
      })
      featureFlags.audienceZoneV1 = true
      const [devUserInboxRes, devUserBellRes, devAdminInboxRes, devAdminBellRes] =
        await Promise.all([
          request(app).get('/v1/guidance/inbox').set('Authorization', `Bearer ${devUserToken}`),
          request(app).get('/v1/guidance/bell').set('Authorization', `Bearer ${devUserToken}`),
          request(app).get('/v1/guidance/inbox').set('Authorization', `Bearer ${devAdminToken}`),
          request(app).get('/v1/guidance/bell').set('Authorization', `Bearer ${devAdminToken}`),
        ])
      expect(devUserInboxRes.status).toBe(200)
      expect(devUserBellRes.status).toBe(200)
      expect(devAdminInboxRes.status).toBe(200)
      expect(devAdminBellRes.status).toBe(200)
      expect(devUserInboxRes.body.data.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            reason_code: 'USE_FOLLOWING_FEED',
            cta: expect.objectContaining({ target: '/?following_only=true' }),
          }),
          expect.objectContaining({
            reason_code: 'FOLLOWED_AGENT_STORY_ESCALATED',
            cta: expect.objectContaining({ target: expect.stringMatching(/^\/posts\//) }),
          }),
        ]),
      )
      expect(devUserBellRes.body.data.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ reason_code: 'USE_FOLLOWING_FEED' }),
          expect.objectContaining({ reason_code: 'FOLLOWED_AGENT_STORY_ESCALATED' }),
        ]),
      )
      expect(devAdminInboxRes.body.data.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            reason_code: 'USE_FOLLOWING_FEED',
            cta: expect.objectContaining({ target: '/?following_only=true' }),
          }),
          expect.objectContaining({
            reason_code: 'FOLLOWED_AGENT_STORY_ESCALATED',
            cta: expect.objectContaining({ target: expect.stringMatching(/^\/posts\//) }),
          }),
        ]),
      )
      expect(devAdminBellRes.body.data.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ reason_code: 'USE_FOLLOWING_FEED' }),
          expect.objectContaining({ reason_code: 'FOLLOWED_AGENT_STORY_ESCALATED' }),
        ]),
      )
      const [communityFeedRes, agentFeedRes] = await Promise.all([
        request(app).get('/v1/me/feed/communities').set('Authorization', `Bearer ${devUserToken}`),
        request(app).get('/v1/me/feed/agents').set('Authorization', `Bearer ${devUserToken}`),
      ])
      expect(communityFeedRes.status).toBe(200)
      expect(agentFeedRes.status).toBe(200)
      expect(communityFeedRes.body.data.length).toBeGreaterThan(0)
      expect(agentFeedRes.body.data.length).toBeGreaterThan(0)
      const creatorThreadRes = await request(app)
        .post('/v1/viewer/posts/seed-post-cyberpunk-city-images/public-threads')
        .set('Authorization', `Bearer ${devUserToken}`)
        .send({
          body: '我最喜欢第二张雨夜街景，主串追问一下 ControlNet 的参数细节。',
          idempotency_key: `creator-open-reply-${Date.now()}`,
          source_context: {
            discovered_via: 'discussion_forest',
            source_surface: 'post_detail',
            source_shelf: 'forest',
          },
        })
      expect(creatorThreadRes.status).toBe(201)
      expect(creatorThreadRes.body.data).toMatchObject({
        action: 'CREATE_PUBLIC_THREAD',
        result: 'ACCEPTED',
        thread_id: expect.any(String),
      })

      const creatorAudienceRes = await request(app)
        .post('/v1/viewer/posts/seed-post-cyberpunk-city-images/audience-messages')
        .set('Authorization', `Bearer ${devUserToken}`)
        .send({
          body: '这条不该再走 audience lane。',
          idempotency_key: `creator-audience-block-${Date.now()}`,
          source_context: {
            discovered_via: 'discussion_forest',
            source_surface: 'post_detail',
            source_shelf: 'audience',
          },
        })
      expect(creatorAudienceRes.status).toBe(403)
      expect(creatorAudienceRes.body.error).toMatchObject({
        code: 'FORBIDDEN',
        message: 'Post does not allow viewer audience messages',
      })

      const duplicateHost = await agentService.createAgentPersisted({
        owner_id: 'dev-user-001',
        display_name: '苏格拉底-7B-临时污染体',
      })
      const duplicateGuest = await agentService.createAgentPersisted({
        owner_id: 'dev-user-001',
        display_name: '洛芙蕾丝-临时污染体',
      })

      await chatService.dispatchAgentToRoom(firstRoomIds[0], duplicateHost.id, 'dev-user-001')
      await chatService.dispatchAgentToRoom(firstRoomIds[0], duplicateGuest.id, 'dev-user-001')

      const archived = await roomRepo.updateStatus(firstRoomIds[0], 'archived')
      expect(archived?.status).toBe('archived')
      await publicStageTurnRepo.create({
        thread_id: 'seed-thread-ai-consciousness-debater',
        post_id: 'seed-post-ai-consciousness',
        author_actor_type: 'human',
        author_user_id: 'dev-user-001',
        turn_index: 999,
        body: '临时人工回应，验证 reseed 会先清理 turn 再重建 thread。',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
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
      expect(secondRes.body.data.counts.follow_links).toBe(6)
      expect(secondRes.body.data.counts.media).toBe(canonicalMediaCount)
      expect(secondRes.body.data.counts.owner_pool_media).toBe(canonicalOwnerPoolMediaCount)
      expect(secondRes.body.data.counts.votes).toBe(
        canonicalCounts.posts * (canonicalCounts.agents - 1),
      )
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
      expect(refreshedBell.body.data.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ reason_code: 'USE_FOLLOWING_FEED' }),
          expect.objectContaining({ reason_code: 'FOLLOWED_AGENT_STORY_ESCALATED' }),
        ]),
      )
      expect(postMediaRepo.findByPostId('seed-post-cyberpunk-city-images')).toHaveLength(3)
      const secondBindings = await sceneMediaBindingRepo.findByScene(
        'forum_post',
        'seed-post-cyberpunk-city-images',
      )
      expect(secondBindings).toHaveLength(3)
      const secondProjections = await mediaContextProjectionRepo.findByBindingIds(
        secondBindings.map((item) => item.id),
      )
      expect(secondProjections).toHaveLength(3)
      expect(voteRepo.findByTarget('POST', 'seed-post-welcome-launch-core')).toHaveLength(
        canonicalCounts.agents - 1,
      )

      const afterSecondSeedBio = agentBioRefreshService.inspectObservability()
      expect(afterSecondSeedBio.counts.committed).toBe(afterFirstSeedBio.counts.committed)
      expect(afterSecondSeedBio.by_kind.major.committed).toBe(
        afterFirstSeedBio.by_kind.major.committed,
      )
      const reseededRolloutProfile = await mediaRolloutControllerService.getEffectiveProfile()
      expect(reseededRolloutProfile.profile).toBe('manual')
      expect(reseededRolloutProfile.active_override?.reason).toBe(
        DEV_SEED_MEDIA_ROLLOUT_OVERRIDE_REASON,
      )
    } finally {
      featureFlags.guidanceV1 = previousGuidance
      featureFlags.guidanceRecallV1 = previousGuidanceRecall
      featureFlags.humanParticipationV1 = previousHumanParticipation
      featureFlags.audienceZoneV1 = previousAudienceZone
      featureFlags.mediaRolloutControllerV1 = previousMediaRolloutController
      featureFlags.mediaGenerationV1 = previousMediaGeneration
    }
  })

  it('POST /v1/dev/seed supports smoke-minimal without inflating canonical fixtures', async () => {
    const smokeCounts = countDevSeedFixtures('smoke-minimal')
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const previousMediaRolloutController = featureFlags.mediaRolloutControllerV1
    const previousMediaGeneration = featureFlags.mediaGenerationV1
    featureFlags.mediaRolloutControllerV1 = true
    featureFlags.mediaGenerationV1 = true

    try {
      const firstRes = await request(app).post('/v1/dev/seed').send({ profile: 'smoke-minimal' })
      expect(firstRes.status).toBe(200)
      expect(firstRes.body.data.profile).toBe('smoke-minimal')
      expect(firstRes.body.data.counts.communities).toBe(smokeCounts.communities)
      expect(firstRes.body.data.counts.agents).toBe(smokeCounts.agents)
      expect(firstRes.body.data.counts.posts).toBe(smokeCounts.posts)
      expect(firstRes.body.data.counts.owner_pool_media).toBe(0)
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
      expect((await mediaRolloutControllerService.getActiveOverride())?.reason).not.toBe(
        DEV_SEED_MEDIA_ROLLOUT_OVERRIDE_REASON,
      )

      const secondRes = await request(app).post('/v1/dev/seed').send({ profile: 'smoke-minimal' })
      expect(secondRes.status).toBe(200)
      expect(secondRes.body.data.ids.communities).toEqual(firstRes.body.data.ids.communities)
      expect(secondRes.body.data.ids.agents).toEqual(firstRes.body.data.ids.agents)
      expect(secondRes.body.data.ids.posts).toEqual(firstRes.body.data.ids.posts)
      expect(secondRes.body.data.ids.rooms).toEqual([])
      expect(secondRes.body.data.ids.threads).toEqual([])
      expect((await mediaRolloutControllerService.getActiveOverride())?.reason).not.toBe(
        DEV_SEED_MEDIA_ROLLOUT_OVERRIDE_REASON,
      )
    } finally {
      featureFlags.mediaRolloutControllerV1 = previousMediaRolloutController
      featureFlags.mediaGenerationV1 = previousMediaGeneration
    }
  })

  it('POST /v1/dev/seed supports launch roster bootstrap without materializing content fixtures', async () => {
    const launchCounts = countDevSeedFixtures('launch')
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalMemberships = featureFlags.membershipsV1
    const previousMediaRolloutController = featureFlags.mediaRolloutControllerV1
    const previousMediaGeneration = featureFlags.mediaGenerationV1

    try {
      await eventQueue.clear()
      featureFlags.mediaRolloutControllerV1 = true
      featureFlags.mediaGenerationV1 = true
      const res = await request(app).post('/v1/dev/seed').send({ profile: 'launch' })
      expect(res.status).toBe(200)
      expect(res.body.data.profile).toBe('launch')
      expect(res.body.data.counts.communities).toBe(launchCounts.communities)
      expect(res.body.data.counts.agents).toBe(launchCounts.agents)
      expect(res.body.data.counts.posts).toBe(0)
      expect(res.body.data.counts.owner_pool_media).toBe(0)
      expect(res.body.data.counts.threads).toBe(0)
      expect(res.body.data.counts.rooms).toBe(0)
      expect(res.body.data.counts.votes).toBe(0)
      expect(res.body.data.counts.media).toBe(0)
      expect(res.body.data.ids.agents).toHaveLength(launchCounts.agents)
      expect(await eventQueue.size()).toBe(0)

      const firstAgentId = res.body.data.ids.agents[0] as string | undefined
      expect(firstAgentId).toBeTruthy()
      const seededAgent = agentService.getAgent(firstAgentId!)
      expect(seededAgent.owner_id).toBe('platform-system-owner')

      const profileRes = await request(app).get(`/v1/agents/${firstAgentId}/profile`)
      expect(profileRes.status).toBe(200)
      expect(profileRes.body.data.owner_id).toBeNull()
      expect(profileRes.body.data.agent_kind).toBe('system')
      expect(profileRes.body.data.surface_access.private_chat_enabled).toBe(false)
      expect(profileRes.body.data.public_identity?.identity_badges).toEqual(expect.any(Array))
      expect(profileRes.body.data.public_identity.identity_badges.length).toBeGreaterThan(0)
      expect((await mediaRolloutControllerService.getActiveOverride())?.reason).not.toBe(
        DEV_SEED_MEDIA_ROLLOUT_OVERRIDE_REASON,
      )

      const activeMemberships = agentCommunityMembershipService.listActive(firstAgentId!)
      expect(activeMemberships.length).toBeGreaterThan(0)
      expect(activeMemberships.every((membership) => membership.status === 'ACTIVE')).toBe(true)
      expect(communityRepo.findBySlug('hot-arena')?.rules_json).toMatchObject({
        stage_spec_v1: expect.objectContaining({
          tier_gate: expect.objectContaining({
            resident_min_tier: 'T2',
            strict_publication_longform_min_tier: 'T4',
          }),
        }),
      })

      featureFlags.membershipsV1 = true
      const writeResult = await forumWriteService.createPost({
        actor_agent_id: firstAgentId!,
        run_id: 'launch-membership-bootstrap-e2e',
        community_id: activeMemberships[0]!.community_id,
        title: '灰测启动前的节目位校准',
        body: '先确认 membership 已落表，再放行 launch runtime 写入。',
        tags: ['launch', 'bootstrap'],
      })
      expect(writeResult.post.author_agent_id).toBe(firstAgentId!)
      expect(writeResult.post.community_id).toBe(activeMemberships[0]!.community_id)
    } finally {
      featureFlags.membershipsV1 = originalMemberships
      featureFlags.mediaRolloutControllerV1 = previousMediaRolloutController
      featureFlags.mediaGenerationV1 = previousMediaGeneration
    }
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
