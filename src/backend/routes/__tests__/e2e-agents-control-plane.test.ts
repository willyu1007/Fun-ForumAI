import { describe, it, expect } from 'vitest'
import request from 'supertest'
import {
  app,
  config,
  servicePost,
  adminToken,
  userToken,
  user2Token,
  setupFeatureFlagGuard,
  createTestCommunity,
} from './e2e-helpers.js'

setupFeatureFlagGuard()

describe('E2E: Agents Control Plane', () => {
  it('POST /v1/agents creates an agent', async () => {
    const res = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        display_name: 'E2E Bot',
        persona_seed_code: 'warmhearted',
        owner_style_pins: {
          interests: ['音乐', '生活'],
          mood: 'optimistic',
        },
      })
    expect(res.status).toBe(201)
    expect(res.body.data.display_name).toBe('E2E Bot')
    expect(res.body.data.owner_id).toBe('user1')
    expect(res.body.data.persona_seed_code).toBe('warmhearted')
    expect(res.body.data.home_voice_line_id).toBe('qwen-social-v1')
    expect(res.body.data.identity_contract.owner_style_pins.interests).toEqual(['音乐', '生活'])
  })

  it('POST /v1/agents enforces https avatar_url and exposes avatar in profile/feed', async () => {
    const rejected = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        display_name: 'Avatar Unsafe Bot',
        avatar_url: 'http://example.com/avatar.png',
      })
    expect(rejected.status).toBe(400)
    expect(rejected.body.error.code).toBe('VALIDATION_ERROR')

    const avatarUrl = 'https://example.com/avatar-safe.png'
    const created = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        display_name: 'Avatar Safe Bot',
        avatar_url: avatarUrl,
      })
    expect(created.status).toBe(201)
    const agentId = created.body.data.id as string

    const profile = await request(app).get(`/v1/agents/${agentId}/profile`)
    expect(profile.status).toBe(200)
    expect(profile.body.data.avatar_url).toBe(avatarUrl)

    const community = await createTestCommunity({
      name: 'Avatar Visibility Community',
      slug: `avatar-visibility-${Date.now()}`,
    })

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: agentId,
      run_id: 'run-avatar-1',
      community_id: community.id,
      title: 'Avatar visibility post',
      body: 'avatar should appear in feed author',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const feedRes = await request(app).get('/v1/feed')
    expect(feedRes.status).toBe(200)
    const targetPost = (
      feedRes.body.data as Array<{ id: string; author: { avatar_url: string | null } }>
    ).find((item) => item.id === postId)
    expect(targetPost).toBeTruthy()
    expect(targetPost?.author.avatar_url).toBe(avatarUrl)
  })

  it('PATCH /v1/agents/:agentId/profile supports owner/admin and blocks non-owner', async () => {
    const createRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Profile Patch Bot' })
    const agentId = createRes.body.data.id as string

    const ownerPatch = await request(app)
      .patch(`/v1/agents/${agentId}/profile`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        display_name: 'Owner Updated Name',
        avatar_url: 'https://example.com/owner-avatar.png',
      })
    expect(ownerPatch.status).toBe(200)
    expect(ownerPatch.body.data.display_name).toBe('Owner Updated Name')

    const forbiddenPatch = await request(app)
      .patch(`/v1/agents/${agentId}/profile`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        display_name: 'Should Not Work',
      })
    expect(forbiddenPatch.status).toBe(403)

    const adminPatch = await request(app)
      .patch(`/v1/agents/${agentId}/profile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        display_name: 'Admin Updated Name',
        avatar_url: null,
      })
    expect(adminPatch.status).toBe(200)
    expect(adminPatch.body.data.display_name).toBe('Admin Updated Name')
    expect(adminPatch.body.data.avatar_url).toBeNull()
  })

  it('POST /v1/agents persists identity contract and profile can read it back', async () => {
    const createRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        display_name: 'Contract Bot',
        persona_seed_code: 'philosopher',
        owner_style_pins: {
          interests: ['哲学', '科技'],
          formality: 5,
          verbosity: 4,
          habits: ['asks_questions'],
        },
      })

    expect(createRes.status).toBe(201)
    const agentId = createRes.body.data.id as string

    const profileRes = await request(app).get(`/v1/agents/${agentId}/profile`)
    expect(profileRes.status).toBe(200)
    expect(profileRes.body.data.persona_seed_code).toBe('philosopher')
    expect(profileRes.body.data.persona_seed_label).toBe('哲学家型')
    expect(profileRes.body.data.home_voice_line_label).toBe('Qwen Social v1')
    expect(profileRes.body.data.identity_contract.source).toBe('contract_v1')
    expect(profileRes.body.data.identity_contract.owner_style_pins.interests).toEqual([
      '哲学',
      '科技',
    ])
  })

  it('PATCH /v1/agents/:agentId/memberships updates explicit memberships', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalMembershipFlag = featureFlags.membershipsV1
    featureFlags.membershipsV1 = true

    try {
      const communityA = await createTestCommunity({
        name: 'Membership A',
        slug: `membership-a-${Date.now()}`,
      })
      const communityB = await createTestCommunity({
        name: 'Membership B',
        slug: `membership-b-${Date.now()}`,
      })

      const createRes = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: 'Membership Bot' })
      const agentId = createRes.body.data.id as string

      const addRes = await request(app)
        .patch(`/v1/agents/${agentId}/memberships`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ add: [communityA.id, communityB.id], remove: [], role: 'resident' })
      expect(addRes.status).toBe(200)
      expect(addRes.body.data.updated.added.sort()).toEqual([communityA.id, communityB.id].sort())
      expect(addRes.body.data.active_memberships).toHaveLength(2)

      const removeRes = await request(app)
        .patch(`/v1/agents/${agentId}/memberships`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ add: [], remove: [communityA.id] })
      expect(removeRes.status).toBe(200)
      expect(removeRes.body.data.updated.removed).toEqual([communityA.id])
      expect(
        removeRes.body.data.active_memberships.map(
          (item: { community_id: string }) => item.community_id,
        ),
      ).toEqual([communityB.id])

      const forbidden = await request(app)
        .patch(`/v1/agents/${agentId}/memberships`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ add: [communityA.id], remove: [] })
      expect(forbidden.status).toBe(403)

      const invalidCommunity = await request(app)
        .patch(`/v1/agents/${agentId}/memberships`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ add: ['community-not-exists'], remove: [] })
      expect(invalidCommunity.status).toBe(404)
    } finally {
      featureFlags.membershipsV1 = originalMembershipFlag
    }
  })

  it('PATCH /v1/agents/:agentId/memberships cannot recover BANNED membership via add', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalMembershipFlag = featureFlags.membershipsV1
    const originalMembershipStatusFlag = featureFlags.membershipStatusV1
    featureFlags.membershipsV1 = true
    featureFlags.membershipStatusV1 = true

    try {
      const community = await createTestCommunity({
        name: 'Membership Ban',
        slug: `membership-ban-${Date.now()}`,
      })
      const createRes = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: 'Membership Ban Bot' })
      const agentId = createRes.body.data.id as string

      const addRes = await request(app)
        .patch(`/v1/agents/${agentId}/memberships`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ add: [community.id], remove: [] })
      expect(addRes.status).toBe(200)

      const banRes = await request(app)
        .patch(`/v1/agents/${agentId}/memberships/${community.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'BANNED', reason: 'policy' })
      expect(banRes.status).toBe(200)

      const recoverViaAdd = await request(app)
        .patch(`/v1/agents/${agentId}/memberships`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ add: [community.id], remove: [] })
      expect(recoverViaAdd.status).toBe(403)
      expect(recoverViaAdd.body.error.code).toBe('FORBIDDEN')
    } finally {
      featureFlags.membershipsV1 = originalMembershipFlag
      featureFlags.membershipStatusV1 = originalMembershipStatusFlag
    }
  }, 15_000)

  it('follow/unfollow works for authenticated users', async () => {
    const createRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Follow Target' })
    const targetAgentId = createRes.body.data.id

    const followRes = await request(app)
      .post(`/v1/agents/${targetAgentId}/follow`)
      .set('Authorization', `Bearer ${userToken}`)
      .send()
    expect(followRes.status).toBe(201)
    expect(followRes.body.data).toHaveProperty('follow_id')

    const unfollowRes = await request(app)
      .delete(`/v1/agents/${targetAgentId}/follow`)
      .set('Authorization', `Bearer ${userToken}`)
      .send()
    expect(unfollowRes.status).toBe(200)
    expect(unfollowRes.body.data.removed).toBe(true)
  })

  it('agent profile returns accurate is_followed for authenticated viewer', async () => {
    const createRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Profile Follow Target' })
    const targetAgentId = createRes.body.data.id

    const beforeFollow = await request(app)
      .get(`/v1/agents/${targetAgentId}/profile`)
      .set('Authorization', `Bearer ${userToken}`)
    expect(beforeFollow.status).toBe(200)
    expect(beforeFollow.body.data.is_followed).toBe(false)

    await request(app)
      .post(`/v1/agents/${targetAgentId}/follow`)
      .set('Authorization', `Bearer ${userToken}`)
      .send()

    const afterFollow = await request(app)
      .get(`/v1/agents/${targetAgentId}/profile`)
      .set('Authorization', `Bearer ${userToken}`)
    expect(afterFollow.status).toBe(200)
    expect(afterFollow.body.data.is_followed).toBe(true)
  })

  it('POST /v1/agents without auth → 401', async () => {
    const res = await request(app).post('/v1/agents').send({ display_name: 'Bot' })
    expect(res.status).toBe(401)
  })

  it('POST /v1/agents with empty display_name → 400', async () => {
    const res = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: '' })
    expect(res.status).toBe(400)
  })

  it('PATCH /v1/agents/:id/config updates config', async () => {
    const createRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Config Bot' })
    const agentId = createRes.body.data.id

    const patchRes = await request(app)
      .patch(`/v1/agents/${agentId}/config`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ config_json: { temperature: 0.5 } })
    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data.config_json).toMatchObject({
      temperature: 0.5,
      personaSeed: { seedCode: 'scholar' },
      voice: { homeVoiceLineId: 'qwen-social-v1' },
      ownerStylePins: { interests: [] },
    })
  })

  it('GET /v1/agents/:id/runs returns runs', async () => {
    const createRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Runs Bot' })
    const agentId = createRes.body.data.id

    const runsRes = await request(app)
      .get(`/v1/agents/${agentId}/runs`)
      .set('Authorization', `Bearer ${userToken}`)
    expect(runsRes.status).toBe(200)
    expect(runsRes.body.data).toBeInstanceOf(Array)
  })
})
