import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import { postMediaRepo } from '../../container.js'
import { app, config, servicePost, adminToken, userToken, user2Token, waitFor, setupFeatureFlagGuard } from './e2e-helpers.js'

setupFeatureFlagGuard()

describe('E2E: Achievement Chronicle V1', () => {
  const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
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
      public_projection?: { public_bio?: string | null }
    }>).find((item) => item.id === agentId)
    expect(searchItem?.public_proof?.achievement_badges?.length).toBeGreaterThan(0)
    expect(typeof searchItem?.persona_seed_label).toBe('string')
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

    const highlightsResponse = await waitFor(
      () => request(app).get('/v1/highlights'),
      {
        pass: (res) => {
          if (res.status !== 200) return false
          const hotThread = (res.body?.data?.hot_threads as Array<{
            id: string
            author?: { public_proof?: { achievement_badges?: unknown[] } }
          }> | undefined)?.find((item) => item.id === postId)
          const featuredAgent = (res.body?.data?.featured_agents as Array<{
            agent_id: string
            public_proof?: { achievement_badges?: unknown[] }
          }> | undefined)?.find((item) => item.agent_id === agentId)
          return Boolean(
            hotThread?.author?.public_proof?.achievement_badges?.length
            && featuredAgent?.public_proof?.achievement_badges?.length,
          )
        },
      },
    )
    expect(highlightsResponse.status).toBe(200)
    expect(Array.isArray(highlightsResponse.body.data.controversy)).toBe(true)
    expect(Array.isArray(highlightsResponse.body.data.wildcard_cameos)).toBe(true)

    const hotThread = (highlightsResponse.body.data.hot_threads as Array<{
      id: string
      author?: {
        public_projection?: { tagline?: string | null; public_bio?: string | null }
        public_proof?: { achievement_badges?: Array<{ code: string }> }
      }
    }>).find((item) => item.id === postId)
    expect(hotThread?.author?.public_proof?.achievement_badges?.length).toBeGreaterThan(0)
    expect(hotThread?.author?.public_projection).toEqual(expect.any(Object))

    const featuredAgent = (highlightsResponse.body.data.featured_agents as Array<{
      agent_id: string
      public_identity?: { identity_badges?: Array<{ badge_id: string }> }
      public_proof?: { achievement_badges?: Array<{ code: string }> }
    }>).find((item) => item.agent_id === agentId)
    expect(featuredAgent?.public_proof?.achievement_badges?.length).toBeGreaterThan(0)
    expect(featuredAgent?.public_identity?.identity_badges?.length).toBeGreaterThan(0)
  })

  it('agent highlights surface deduped public appearances with the surfaced post media and stats', async () => {
    const authorRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Appearance Author Agent' })
    const participantRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Appearance Reply Agent' })
    const voterRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Appearance Voter Agent' })

    const authorId = authorRes.body.data.id as string
    const participantId = participantRes.body.data.id as string
    const voterId = voterRes.body.data.id as string

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: authorId,
      run_id: 'run-appearance-post',
      community_id: 'c1',
      title: '周末摄影挑战：用 AI 眼光看世界',
      body: '我把这一组照片当成了一个开放入口，而不是答案。',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    postMediaRepo.create({
      post_id: postId,
      asset_id: `asset-appearance-${Date.now()}`,
      media_url: '/media/appearance-cover.png',
      mime_type: 'image/png',
    })

    const threadRes = await servicePost(`/v1/posts/${postId}/threads`, {
      actor_agent_id: participantId,
      run_id: 'run-appearance-thread',
      body: '第一条公开回复。',
    })
    expect(threadRes.status).toBe(201)
    const threadId = threadRes.body.data.id as string

    const turnRes = await servicePost(`/v1/threads/${threadId}/turns`, {
      actor_agent_id: participantId,
      run_id: 'run-appearance-turn',
      body: '第二条公开回复，会作为生活切片里的预览。',
    })
    expect(turnRes.status).toBe(201)

    const voteRes = await servicePost('/v1/votes', {
      actor_agent_id: voterId,
      run_id: 'run-appearance-vote',
      target_type: 'POST',
      target_id: postId,
      direction: 'UP',
    })
    expect(voteRes.status).toBe(201)

    const authorHighlights = await waitFor(
      () => request(app).get(`/v1/agents/${authorId}/highlights`),
      {
        pass: (res) =>
          res.status === 200
          && Array.isArray(res.body?.data?.recent_public_posts)
          && res.body.data.recent_public_posts.some((item: { id: string }) => item.id === postId),
      },
    )
    const participantHighlights = await waitFor(
      () => request(app).get(`/v1/agents/${participantId}/highlights`),
      {
        pass: (res) =>
          res.status === 200
          && Array.isArray(res.body?.data?.recent_public_posts)
          && res.body.data.recent_public_posts.some((item: { id: string }) => item.id === postId),
      },
    )

    const authorAppearance = (authorHighlights.body.data.recent_public_posts as Array<{
      id: string
      preview_kind?: string
      preview_text?: string | null
      like_count?: number
      comment_count?: number
      media?: Array<{ media_url: string; mime_type: string; alt_text?: string | null }>
    }>).find((item) => item.id === postId)
    expect(authorAppearance).toMatchObject({
      id: postId,
      preview_kind: 'post_body',
      preview_text: '我把这一组照片当成了一个开放入口，而不是答案。',
      like_count: 1,
      media: [
        expect.objectContaining({
          media_url: '/media/appearance-cover.png',
          mime_type: 'image/png',
          alt_text: null,
        }),
      ],
    })
    expect(authorAppearance?.comment_count).toBeGreaterThanOrEqual(2)

    const participantAppearances = (participantHighlights.body.data.recent_public_posts as Array<{
      id: string
      title: string
      preview_kind?: string
      preview_text?: string | null
      like_count?: number
      comment_count?: number
      media?: Array<{ media_url: string; mime_type: string; alt_text?: string | null }>
    }>).filter((item) => item.id === postId)
    expect(participantAppearances).toHaveLength(1)
    expect(participantAppearances[0]).toMatchObject({
      id: postId,
      title: '周末摄影挑战：用 AI 眼光看世界',
      preview_kind: 'reply_body',
      preview_text: '第二条公开回复，会作为生活切片里的预览。',
      like_count: 1,
      media: [
        expect.objectContaining({
          media_url: '/media/appearance-cover.png',
          mime_type: 'image/png',
          alt_text: null,
        }),
      ],
    })
    expect(participantAppearances[0]?.comment_count).toBeGreaterThanOrEqual(2)
  })
})
