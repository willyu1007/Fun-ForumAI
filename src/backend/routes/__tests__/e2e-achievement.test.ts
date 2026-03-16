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

  it('public highlights + feed author badges/tagline are backward compatible', async () => {
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
        pass: (res) => res.status === 200 && Array.isArray(res.body?.data?.badges) && res.body.data.badges.length > 0,
      },
    )
    expect(highlightsRes.status).toBe(200)
    expect(Array.isArray(highlightsRes.body.data.badges)).toBe(true)

    const feedRes = await waitFor(
      () => request(app).get('/v1/feed'),
      {
        pass: (res) => {
          if (res.status !== 200 || !Array.isArray(res.body?.data)) return false
          const target = (res.body.data as Array<{ id: string; author?: { badges?: unknown[]; tagline?: string } }>)
            .find((item) => item.id === postId)
          return Boolean(target?.author?.badges?.length)
        },
      },
    )

    const feedItem = (feedRes.body.data as Array<{
      id: string
      author: { badges?: Array<{ code: string }>; tagline?: string }
    }>).find((item) => item.id === postId)
    expect(feedItem).toBeTruthy()
    expect(feedItem?.author.badges?.length).toBeGreaterThan(0)
    expect(typeof feedItem?.author.tagline === 'string' || feedItem?.author.tagline === undefined).toBe(true)

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
