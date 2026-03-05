import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app, config, servicePost, userToken, setupFeatureFlagGuard, createTestCommunity } from './e2e-helpers.js'

setupFeatureFlagGuard()

describe('E2E: Read API (public)', () => {
  it('GET /v1/feed returns empty feed', async () => {
    const res = await request(app).get('/v1/feed')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
    expect(res.body.meta).toHaveProperty('cursor')
  })

  it('GET /v1/communities returns empty list', async () => {
    const res = await request(app).get('/v1/communities')
    expect(res.status).toBe(200)
    expect(res.body.data).toBeInstanceOf(Array)
  })

  it('GET /v1/posts/:id returns 404 for unknown post', async () => {
    const res = await request(app).get('/v1/posts/unknown-id')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('GET /v1/agents/:id/profile returns 404 for unknown agent', async () => {
    const res = await request(app).get('/v1/agents/unknown-id/profile')
    expect(res.status).toBe(404)
  })

  it('GET /v1/highlights returns empty', async () => {
    const res = await request(app).get('/v1/highlights')
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      hot_threads: [],
      featured_agents: [],
      controversy: [],
      wildcard_cameos: [],
    })
  })

  it('GET /v1/highlights returns grouped payload when feature is enabled', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalHighlights = featureFlags.globalHighlightsV1
    featureFlags.globalHighlightsV1 = true

    try {
      const community = await createTestCommunity({
        name: 'Highlights Community',
        slug: `highlights-${Date.now()}`,
      })
      const authorRes = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: 'Highlights Author' })
      expect(authorRes.status).toBe(201)
      const commenterRes = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: 'Highlights Commenter' })
      expect(commenterRes.status).toBe(201)

      const postRes = await servicePost('/v1/posts', {
        actor_agent_id: authorRes.body.data.id,
        run_id: 'run-highlights-1',
        community_id: community.id,
        title: 'Hot highlight post',
        body: 'hot body',
      })
      expect(postRes.status).toBe(201)
      const postId = postRes.body.data.id as string

      const commentRes = await servicePost('/v1/comments', {
        actor_agent_id: commenterRes.body.data.id,
        run_id: 'run-highlights-2',
        post_id: postId,
        body: 'interesting thread',
      })
      expect(commentRes.status).toBe(201)

      const highlights = await request(app).get('/v1/highlights')
      expect(highlights.status).toBe(200)
      expect(Array.isArray(highlights.body.data.hot_threads)).toBe(true)
      expect(highlights.body.data.hot_threads.length).toBeGreaterThan(0)
      expect(Array.isArray(highlights.body.data.featured_agents)).toBe(true)
      expect(Array.isArray(highlights.body.data.controversy)).toBe(true)
      expect(Array.isArray(highlights.body.data.wildcard_cameos)).toBe(true)
    } finally {
      featureFlags.globalHighlightsV1 = originalHighlights
    }
  })

  it('GET /v1/feed?limit=abc returns 400 validation error', async () => {
    const res = await request(app).get('/v1/feed?limit=abc')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('POST /v1/votes/human rejects MESSAGE target_type', async () => {
    const res = await request(app)
      .post('/v1/votes/human')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ target_type: 'MESSAGE', target_id: 'm1', direction: 'UP' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('POST /v1/votes/human upserts the same user vote on a post', async () => {
    const community = await createTestCommunity({
      name: 'Human Vote Community',
      slug: `human-vote-${Date.now()}`,
    })
    const agentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Human Vote Agent' })
    expect(agentRes.status).toBe(201)

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: agentRes.body.data.id,
      run_id: 'run-human-vote-1',
      community_id: community.id,
      title: 'Human vote target',
      body: 'Target body',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id

    const upRes = await request(app)
      .post('/v1/votes/human')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ target_type: 'POST', target_id: postId, direction: 'UP' })
    expect(upRes.status).toBe(201)
    expect(upRes.body.data.summary.human_up).toBe(1)
    expect(upRes.body.data.summary.human_down).toBe(0)

    const downRes = await request(app)
      .post('/v1/votes/human')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ target_type: 'POST', target_id: postId, direction: 'DOWN' })
    expect(downRes.status).toBe(201)
    expect(downRes.body.data.summary.human_up).toBe(0)
    expect(downRes.body.data.summary.human_down).toBe(1)
  })

  it('GET /v1/agents supports public search', async () => {
    await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Searchable Agent' })

    const res = await request(app).get('/v1/agents?q=searchable')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.some((a: { display_name: string }) => a.display_name === 'Searchable Agent')).toBe(true)
  })

  it('GET /v1/feed?following_only=true requires auth', async () => {
    const res = await request(app).get('/v1/feed?following_only=true')
    expect(res.status).toBe(401)
  })

  it('POST /v1/posts/:postId/audience-messages validates body length and accepts valid message', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalAudienceZone = featureFlags.audienceZoneV1
    featureFlags.audienceZoneV1 = true

    try {
      const community = await createTestCommunity({
        name: 'Audience Message Community',
        slug: `audience-message-${Date.now()}`,
      })
      const agentRes = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: 'Audience Message Agent' })
      expect(agentRes.status).toBe(201)

      const postRes = await servicePost('/v1/posts', {
        actor_agent_id: agentRes.body.data.id,
        run_id: 'run-audience-1',
        community_id: community.id,
        title: 'Audience target',
        body: 'audience thread body',
      })
      expect(postRes.status).toBe(201)
      const postId = postRes.body.data.id as string

      const validRes = await request(app)
        .post(`/v1/posts/${postId}/audience-messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ body: 'Great show, keep it going.' })
      expect(validRes.status).toBe(201)

      const blankRes = await request(app)
        .post(`/v1/posts/${postId}/audience-messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ body: '   ' })
      expect(blankRes.status).toBe(400)
      expect(blankRes.body.error.code).toBe('VALIDATION_ERROR')

      const tooLongBody = 'a'.repeat(20_001)
      const longRes = await request(app)
        .post(`/v1/posts/${postId}/audience-messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ body: tooLongBody })
      expect(longRes.status).toBe(400)
      expect(longRes.body.error.code).toBe('VALIDATION_ERROR')
    } finally {
      featureFlags.audienceZoneV1 = originalAudienceZone
    }
  })
})
