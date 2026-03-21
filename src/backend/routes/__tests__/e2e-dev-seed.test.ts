import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { agentService, chatService, communityRepo, humanFollowRepo, roomRepo } from '../../container.js'
import { config } from '../../lib/config.js'
import { createDevToken } from '../../middleware/human-auth.js'
import { app, createTestCommunity } from './e2e-helpers.js'

describe('E2E: Dev seed route', () => {
  it('POST /v1/dev/seed reuses canonical seed agents and repairs archived duplicate-filled rooms', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const previousGuidance = featureFlags.guidanceV1
    const previousGuidanceRecall = featureFlags.guidanceRecallV1
    const previousHumanParticipation = featureFlags.humanParticipationV1
    featureFlags.guidanceV1 = true
    featureFlags.guidanceRecallV1 = true
    featureFlags.humanParticipationV1 = true
    try {
      await createTestCommunity({
        name: '旧版自由讨论',
        slug: 'general',
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
      expect(firstRes.body.data.counts.agents).toBeGreaterThan(0)
      expect(firstRes.body.data.counts.posts).toBe(10)
      expect(firstRes.body.data.counts.comments).toBe(15)
      expect(firstRes.body.data.counts.rooms).toBeGreaterThan(0)
      expect(firstAgentIds).toHaveLength(5)
      expect(firstRoomIds).toHaveLength(3)
      expect(firstRes.body.data.counts.follow_links).toBe(2)
      expect(firstRes.body.data.counts.guidance_inbox_items).toBe(4)
      expect(firstRes.body.data.counts.guidance_bell_items).toBe(4)

      const seededGeneral = communityRepo.findBySlug('general')
      expect(seededGeneral?.name).toBe('自由讨论')
      expect(seededGeneral?.rules_json).toMatchObject({
        stage_spec_v1: expect.objectContaining({ version: 'v1' }),
      })
      expect(humanFollowRepo.isFollowing('dev-user-001', firstAgentIds[4]!)).toBe(true)
      expect(humanFollowRepo.isFollowing('dev-admin-001', firstAgentIds[0]!)).toBe(true)

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
        display_name: '苏格拉底-7B',
        model: 'qwen-plus',
      })
      const duplicateGuest = await agentService.createAgentPersisted({
        owner_id: 'dev-user-001',
        display_name: '洛芙蕾丝',
        model: 'qwen-plus',
      })

      await chatService.dispatchAgentToRoom(firstRoomIds[0], duplicateHost.id, 'dev-user-001')
      await chatService.dispatchAgentToRoom(firstRoomIds[0], duplicateGuest.id, 'dev-user-001')

      const archived = await roomRepo.updateStatus(firstRoomIds[0], 'archived')
      expect(archived?.status).toBe('archived')

      const secondRes = await request(app).post('/v1/dev/seed').send()
      expect(secondRes.status).toBe(200)
      expect(secondRes.body.data.ids.communities).toEqual(firstCommunityIds)
      expect(secondRes.body.data.ids.agents).toEqual(firstAgentIds)
      expect(secondRes.body.data.ids.rooms).toEqual(firstRoomIds)
      expect(secondRes.body.data.counts.rooms).toBeGreaterThan(0)
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
    } finally {
      featureFlags.guidanceV1 = previousGuidance
      featureFlags.guidanceRecallV1 = previousGuidanceRecall
      featureFlags.humanParticipationV1 = previousHumanParticipation
    }
  })
})
