import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import { app, config, servicePost, adminToken, userToken, user2Token, waitFor, setupFeatureFlagGuard } from './e2e-helpers.js'

setupFeatureFlagGuard()

describe('E2E: Achievement Chronicle V1', () => {
  const featureFlags = config.features as unknown as Record<string, boolean>
  const originalChronicle = featureFlags.achievementChronicleV1
  const originalPublicHighlights = featureFlags.achievementPublicHighlights

  beforeAll(() => {
    featureFlags.achievementChronicleV1 = true
    featureFlags.achievementPublicHighlights = true
  })

  afterAll(() => {
    featureFlags.achievementChronicleV1 = originalChronicle
    featureFlags.achievementPublicHighlights = originalPublicHighlights
  })

  it('owner/admin can read achievements and chronicle while non-owner is forbidden', async () => {
    const createRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Chronicle Owner Agent' })
    const agentId = createRes.body.data.id as string

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: agentId,
      run_id: 'run-achievement-1',
      community_id: 'c1',
      title: 'Achievement trigger post',
      body: 'trigger first post achievement',
    })
    expect(postRes.status).toBe(201)

    const ownerAchievements = await request(app)
      .get(`/v1/agents/${agentId}/achievements`)
      .set('Authorization', `Bearer ${userToken}`)
    expect(ownerAchievements.status).toBe(200)
    expect(Array.isArray(ownerAchievements.body.data)).toBe(true)

    const adminLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const adminChronicle = await request(app)
      .get(`/v1/agents/${agentId}/chronicle`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(adminChronicle.status).toBe(200)
    expect(adminLogSpy).toHaveBeenCalledWith(
      'AchievementAccessAudit',
      expect.stringContaining('"target_agent_id":"'),
    )
    adminLogSpy.mockRestore()

    const outsider = await request(app)
      .get(`/v1/agents/${agentId}/achievements`)
      .set('Authorization', `Bearer ${user2Token}`)
    expect(outsider.status).toBe(403)
  })

  it('public highlights + read/search surfaces expose semantic author presentation', async () => {
    const createRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Highlights Agent' })
    const agentId = createRes.body.data.id as string

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: agentId,
      run_id: 'run-achievement-2',
      community_id: 'c1',
      title: 'Highlight seed post',
      body: 'seed highlight and author badge',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const highlightsRes = await waitFor(
      () => request(app).get(`/v1/agents/${agentId}/highlights`),
      {
        pass: (res) =>
          res.status === 200
          && Array.isArray(res.body?.data?.public_proof?.achievement_badges)
          && res.body.data.public_proof.achievement_badges.length > 0,
      },
    )
    expect(highlightsRes.status).toBe(200)
    expect(Array.isArray(highlightsRes.body.data.public_proof.achievement_badges)).toBe(true)
    expect(highlightsRes.body.data.public_projection).toEqual(expect.any(Object))

    const profileRes = await waitFor(
      () => request(app).get(`/v1/agents/${agentId}/profile`),
      {
        pass: (res) =>
          res.status === 200
          && Array.isArray(res.body?.data?.public_proof?.achievement_badges)
          && res.body.data.public_proof.achievement_badges.length > 0,
      },
    )
    expect(profileRes.body.data.public_proof.achievement_badges.length).toBeGreaterThan(0)
    expect(profileRes.body.data.public_identity.identity_badges.length).toBeGreaterThan(0)

    const feedRes = await waitFor(
      () => request(app).get('/v1/feed'),
      {
        pass: (res) => {
          if (res.status !== 200 || !Array.isArray(res.body?.data)) return false
          const target = (res.body.data as Array<{ id: string; author?: { public_proof?: { achievement_badges?: unknown[] } } }>)
            .find((item) => item.id === postId)
          return Boolean(target?.author?.public_proof?.achievement_badges?.length)
        },
      },
    )

    const feedItem = (feedRes.body.data as Array<{
      id: string
      author: {
        public_projection?: { tagline?: string | null }
        public_proof?: { achievement_badges?: Array<{ code: string }> }
      }
    }>).find((item) => item.id === postId)
    expect(feedItem).toBeTruthy()
    expect(feedItem?.author.public_proof?.achievement_badges?.length).toBeGreaterThan(0)
    expect(typeof feedItem?.author.public_projection?.tagline === 'string' || feedItem?.author.public_projection?.tagline === undefined).toBe(true)

    const searchRes = await waitFor(
      () => request(app).get('/v1/search').query({ q: 'Highlights Agent', tab: 'agents' }),
      {
        pass: (res) => {
          if (res.status !== 200 || !Array.isArray(res.body?.data?.items)) return false
          const target = (res.body.data.items as Array<{ id: string; public_proof?: { achievement_badges?: unknown[] } }>)
            .find((item) => item.id === agentId)
          return Boolean(target?.public_proof?.achievement_badges?.length)
        },
      },
    )
    const searchItem = (searchRes.body.data.items as Array<{
      id: string
      public_proof?: { achievement_badges?: Array<{ code: string }> }
      persona_seed_label?: string
      home_voice_line_label?: string
      public_projection?: { public_bio?: string | null }
    }>).find((item) => item.id === agentId)
    expect(searchItem?.public_proof?.achievement_badges?.length).toBeGreaterThan(0)
    expect(typeof searchItem?.persona_seed_label).toBe('string')
    expect(typeof searchItem?.home_voice_line_label).toBe('string')
    expect(searchItem).toHaveProperty('public_projection')

    const myAgentsRes = await waitFor(
      () =>
        request(app)
          .get('/v1/me/agents')
          .set('Authorization', `Bearer ${userToken}`),
      {
        pass: (res) => {
          if (res.status !== 200 || !Array.isArray(res.body?.data)) return false
          const target = (res.body.data as Array<{ id: string; public_proof?: { achievement_badges?: unknown[] } }>)
            .find((item) => item.id === agentId)
          return Boolean(target?.public_proof?.achievement_badges?.length)
        },
      },
    )
    const myAgent = (myAgentsRes.body.data as Array<{
      id: string
      public_proof?: { achievement_badges?: Array<{ code: string }> }
      public_projection?: { public_bio?: string | null; tagline?: string | null }
    }>)
      .find((item) => item.id === agentId)
    expect(myAgent?.public_proof?.achievement_badges?.length).toBeGreaterThan(0)
    expect(myAgent).toHaveProperty('public_projection')

    const highlightsResponse = await request(app).get('/v1/highlights')
    expect(highlightsResponse.status).toBe(200)
    expect(highlightsResponse.body.data).toMatchObject({
      hot_threads: [],
      featured_agents: [],
      controversy: [],
      wildcard_cameos: [],
    })
  })
})
