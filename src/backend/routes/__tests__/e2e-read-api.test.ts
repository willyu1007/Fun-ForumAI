import { describe, it, expect } from 'vitest'
import request from 'supertest'
import {
  app,
  config,
  servicePost,
  userToken,
  adminToken,
  setupFeatureFlagGuard,
  createTestCommunity,
} from './e2e-helpers.js'
import { roleAssignmentService, eventRepo, searchCountsCache, searchDocRepo } from '../../container.js'
import { buildAgentTarget } from '../../../shared/agent-target.js'

setupFeatureFlagGuard()

function buildUniqueSearchToken(): string {
  return `zz${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

describe('E2E: Read API (public)', () => {
  it('GET /v1/search returns discovery scaffolding for a blank query', async () => {
    const res = await request(app).get('/v1/search')

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      query: '',
      normalized_query: '',
      current_tab: 'posts',
      counts: {
        posts: 0,
        communities: 0,
        agents: 0,
        threads: 0,
      },
      items: [],
      cursor: null,
      discovery: {
        suggested_queries: expect.any(Array),
        featured_posts: expect.any(Array),
        featured_communities: expect.any(Array),
        featured_agents: expect.any(Array),
      },
    })
  })

  it('GET /v1/search falls back to posts for invalid tab values', async () => {
    const res = await request(app).get('/v1/search?q=test&tab=all')

    expect(res.status).toBe(200)
    expect(res.body.data.current_tab).toBe('posts')
    expect(res.body.data.query).toBe('test')
  })

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

      const commentRes = await servicePost(`/v1/posts/${postId}/threads`, {
        actor_agent_id: commenterRes.body.data.id,
        run_id: 'run-highlights-2',
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

  it('GET /v1/posts/:postId/threads?limit=abc returns 400 validation error', async () => {
    const community = await createTestCommunity({
      name: 'Comment Validation Community',
      slug: `comment-validation-${Date.now()}`,
    })
    const agentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Comment Validation Agent' })
    expect(agentRes.status).toBe(201)

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: agentRes.body.data.id,
      run_id: `run-comment-limit-${Date.now()}`,
      community_id: community.id,
      title: 'Comment validation target',
      body: 'Target body',
    })
    expect(postRes.status).toBe(201)

    const res = await request(app).get(`/v1/posts/${postRes.body.data.id}/threads?limit=abc`)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('GET /v1/posts/:postId/threads and GET /v1/threads/:threadId return thread-first public stage payloads', async () => {
    const community = await createTestCommunity({
      name: 'Thread Read Community',
      slug: `thread-read-${Date.now()}`,
    })
    const rootAuthorRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Thread Root Author' })
    expect(rootAuthorRes.status).toBe(201)
    const turnAuthorRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Thread Turn Author' })
    expect(turnAuthorRes.status).toBe(201)

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: rootAuthorRes.body.data.id,
      run_id: `run-thread-read-post-${Date.now()}`,
      community_id: community.id,
      title: 'Thread read target',
      body: 'Post body for thread read.',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const threadRes = await servicePost(`/v1/posts/${postId}/threads`, {
      actor_agent_id: rootAuthorRes.body.data.id,
      run_id: `run-thread-read-root-${Date.now()}`,
      body: 'Opening stage stance.',
    })
    expect(threadRes.status).toBe(201)
    const threadId = threadRes.body.data.id as string

    const turnRes = await servicePost(`/v1/threads/${threadId}/turns`, {
      actor_agent_id: turnAuthorRes.body.data.id,
      run_id: `run-thread-read-turn-${Date.now()}`,
      body: 'First stage turn.',
    })
    expect(turnRes.status).toBe(201)
    const turnId = turnRes.body.data.id as string

    const listRes = await request(app).get(`/v1/posts/${postId}/threads`)
    expect(listRes.status).toBe(200)
    expect(listRes.body.data).toHaveLength(1)
    expect(listRes.body.data[0]).toMatchObject({
      id: threadId,
      post_id: postId,
      thread_state: 'OPEN',
      turn_count: 1,
    })
    expect(listRes.body.data[0].turns[0]).toMatchObject({
      id: turnId,
      thread_id: threadId,
      turn_index: 1,
    })

    const detailRes = await request(app).get(`/v1/threads/${threadId}`)
    expect(detailRes.status).toBe(200)
    expect(detailRes.body.data).toMatchObject({
      id: threadId,
      post_id: postId,
      turn_count: 1,
    })
    expect(detailRes.body.data.turns[0]).toMatchObject({
      id: turnId,
      thread_id: threadId,
      body: 'First stage turn.',
    })
  })

  it('GET /v1/posts/:postId/threads exposes all route handoff variants with CTA payloads', async () => {
    const community = await createTestCommunity({
      name: 'Route Handoff Community',
      slug: `route-handoff-${Date.now()}`,
    })
    const authorRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Route Thread Author' })
    expect(authorRes.status).toBe(201)

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: authorRes.body.data.id,
      run_id: `run-route-post-${Date.now()}`,
      community_id: community.id,
      title: 'Route target post',
      body: 'Post body for route handoff coverage.',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const routes = [
      {
        route_type: 'SPINOFF',
        reason_code: 'TOPIC_DRIFT_CONFIRMED',
        handoff_label: '话题已经偏离主轴，建议转为衍生线。',
      },
      {
        route_type: 'AFTERSHOW',
        reason_code: 'THREAD_REPLY_BUDGET_EXHAUSTED',
        handoff_label: '主舞台交锋已满，转入 Aftershow 收束。',
      },
      {
        route_type: 'PRIVATE',
        reason_code: 'PRIVATE_HANDOFF_REQUIRED',
        handoff_label: '这条线更适合私聊继续。',
      },
      {
        route_type: 'AUDIENCE',
        reason_code: 'AUDIENCE_PROMPT_REQUESTED',
        handoff_label: '把补充意见交给观众席。',
      },
    ] as const

    for (const route of routes) {
      const threadRes = await servicePost(`/v1/posts/${postId}/threads`, {
        actor_agent_id: authorRes.body.data.id,
        run_id: `run-route-${route.route_type}-${Date.now()}`,
        body: `Route seed ${route.route_type}`,
        route_handoff: route,
      })
      expect(threadRes.status).toBe(201)
    }

    const threadsRes = await request(app).get(`/v1/posts/${postId}/threads`)
    expect(threadsRes.status).toBe(200)
    expect(threadsRes.body.data).toHaveLength(4)

    const routeMap = new Map(
      threadsRes.body.data.map((thread: { active_route: { route_type: string; cta: Record<string, unknown> | null } }) => [
        thread.active_route.route_type,
        thread.active_route,
      ]),
    )
    expect([...routeMap.keys()].sort()).toEqual(['AFTERSHOW', 'AUDIENCE', 'PRIVATE', 'SPINOFF'])
    expect(routeMap.get('AFTERSHOW')).toMatchObject({
      route_state: 'READY',
      cta: expect.objectContaining({
        label: expect.any(String),
        target: expect.stringContaining('/posts/'),
      }),
    })
    expect(routeMap.get('AUDIENCE')).toMatchObject({
      cta: expect.objectContaining({
        target: expect.stringContaining('#audience-message-input'),
      }),
    })
    expect(routeMap.get('PRIVATE')).toMatchObject({
      cta: expect.objectContaining({
        target: buildAgentTarget({
          agentId: authorRes.body.data.id as string,
          mode: 'readonly',
          tab: 'chat',
        }),
      }),
    })
    expect(routeMap.get('SPINOFF')).toMatchObject({
      cta: expect.objectContaining({
        target: expect.stringContaining('route=spinoff'),
      }),
    })
  })

  it('GET /v1/search returns exact counts and typed results across public objects', async () => {
    await searchDocRepo.clearAllDocs()
    searchCountsCache.clear()
    const searchToken = buildUniqueSearchToken()
    const community = await createTestCommunity({
      name: `Community ${searchToken}`,
      slug: `community-${searchToken}`,
      description: searchToken,
    })
    const agentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: `Agent ${searchToken}` })
    expect(agentRes.status).toBe(201)
    const agentId = agentRes.body.data.id as string

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: agentId,
      run_id: `run-search-${Date.now()}`,
      community_id: community.id,
      title: `Post ${searchToken}`,
      body: `Body ${searchToken}`,
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const threadRes = await servicePost(`/v1/posts/${postId}/threads`, {
      actor_agent_id: agentId,
      run_id: `run-search-comment-${Date.now()}`,
      body: `Comment ${searchToken}`,
    })
    expect(threadRes.status).toBe(201)
    const threadId = threadRes.body.data.id as string

    const turnRes = await servicePost(`/v1/threads/${threadId}/turns`, {
      actor_agent_id: agentId,
      run_id: `run-search-turn-${Date.now()}`,
      body: `Turn ${searchToken}`,
    })
    expect(turnRes.status).toBe(201)
    const turnId = turnRes.body.data.id as string

    const postsRes = await request(app)
      .get('/v1/search')
      .query({ q: `  ${searchToken}  ` })
    expect(postsRes.status).toBe(200)
    expect(postsRes.body.data.normalized_query).toBe(searchToken)
    expect(postsRes.body.data.counts).toEqual({
      posts: 1,
      communities: 1,
      agents: 1,
      threads: 1,
    })
    expect(postsRes.body.data.items).toHaveLength(1)
    expect(postsRes.body.data.items[0]).toMatchObject({
      type: 'post',
      id: postId,
      href: `/posts/${postId}`,
    })

    const communitiesRes = await request(app)
      .get('/v1/search')
      .query({ q: searchToken, tab: 'communities' })
    expect(communitiesRes.status).toBe(200)
    expect(communitiesRes.body.data.items[0]).toMatchObject({
      type: 'community',
      id: community.id,
      href: `/c/${community.slug}`,
    })

    const agentsRes = await request(app).get('/v1/search').query({ q: searchToken, tab: 'agents' })
    expect(agentsRes.status).toBe(200)
    expect(agentsRes.body.data.items[0]).toMatchObject({
      type: 'agent',
      id: agentId,
      href: buildAgentTarget({
        agentId,
        mode: 'readonly',
      }),
    })

    const threadsRes = await request(app)
      .get('/v1/search')
      .query({ q: searchToken, tab: 'threads' })
    expect(threadsRes.status).toBe(200)
    expect(threadsRes.body.data.items[0]).toMatchObject({
      type: 'thread',
      id: threadId,
      href: `/posts/${postId}?threadId=${threadId}&turnId=${turnId}`,
      post_id: postId,
      matched_turn_id: turnId,
    })
  })

  it('GET /v1/search invalidates cached counts after agent discoverability changes', async () => {
    await searchDocRepo.clearAllDocs()
    searchCountsCache.clear()
    const searchToken = buildUniqueSearchToken()

    const agentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: `Cache ${searchToken}` })
    expect(agentRes.status).toBe(201)
    const agentId = agentRes.body.data.id as string

    const beforeLimit = await request(app)
      .get('/v1/search')
      .query({ q: searchToken, tab: 'agents' })
    expect(beforeLimit.status).toBe(200)
    expect(beforeLimit.body.data.counts.agents).toBe(1)
    expect(beforeLimit.body.data.items).toHaveLength(1)
    expect(beforeLimit.body.data.items[0].id).toBe(agentId)

    const limitRes = await request(app)
      .post('/v1/admin/moderation/actions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'limit_agent',
        target_type: 'agent',
        target_id: agentId,
        reason: 'cache invalidation coverage',
      })
    expect(limitRes.status).toBe(200)

    const afterLimit = await request(app)
      .get('/v1/search')
      .query({ q: searchToken, tab: 'agents' })
    expect(afterLimit.status).toBe(200)
    expect(afterLimit.body.data.counts.agents).toBe(0)
    expect(afterLimit.body.data.items).toEqual([])
  })

  it('GET /v1/search paginates post results with an opaque cursor', async () => {
    await searchDocRepo.clearAllDocs()
    const searchToken = buildUniqueSearchToken()
    const community = await createTestCommunity({
      name: `Cursor ${searchToken}`,
      slug: `cursor-${searchToken}`,
    })
    const agentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: `Cursor Agent ${searchToken}` })
    expect(agentRes.status).toBe(201)
    const agentId = agentRes.body.data.id as string

    const firstPostRes = await servicePost('/v1/posts', {
      actor_agent_id: agentId,
      run_id: `run-cursor-a-${Date.now()}`,
      community_id: community.id,
      title: `Cursor title ${searchToken}`,
      body: `Cursor body ${searchToken}`,
    })
    expect(firstPostRes.status).toBe(201)

    const secondPostRes = await servicePost('/v1/posts', {
      actor_agent_id: agentId,
      run_id: `run-cursor-b-${Date.now()}`,
      community_id: community.id,
      title: `Cursor title ${searchToken}`,
      body: `Cursor body ${searchToken}`,
    })
    expect(secondPostRes.status).toBe(201)

    const firstPage = await request(app)
      .get('/v1/search')
      .query({ q: searchToken, tab: 'posts', limit: 1 })
    expect(firstPage.status).toBe(200)
    expect(firstPage.body.data.counts.posts).toBe(2)
    expect(firstPage.body.data.items).toHaveLength(1)
    expect(typeof firstPage.body.data.cursor).toBe('string')
    expect(firstPage.body.data.cursor).not.toBe(firstPage.body.data.items[0].id)

    const secondPage = await request(app)
      .get('/v1/search')
      .query({ q: searchToken, tab: 'posts', limit: 1, cursor: firstPage.body.data.cursor })
    expect(secondPage.status).toBe(200)
    expect(secondPage.body.data.items).toHaveLength(1)
    expect(secondPage.body.data.items[0].id).not.toBe(firstPage.body.data.items[0].id)
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

  it('POST /v1/reports and GET /v1/reports create and list complaint tickets for the current user', async () => {
    const community = await createTestCommunity({
      name: 'Report Target Community',
      slug: `report-target-${Date.now()}`,
    })
    const agentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Report Target Agent' })
    expect(agentRes.status).toBe(201)

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: agentRes.body.data.id,
      run_id: 'run-report-target-1',
      community_id: community.id,
      title: 'Reportable post',
      body: 'needs review',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const createRes = await request(app)
      .post('/v1/reports')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        target_type: 'post',
        target_id: postId,
        reason_code: 'viewer_report',
        detail_text: 'needs review',
      })

    expect(createRes.status).toBe(201)
    expect(createRes.body.data.complaint.status).toBe('LINKED')
    expect(createRes.body.data.complaint.complaint_type).toBe('CONTENT_REPORT')
    expect(createRes.body.data.case.case_type).toBe('COMPLAINT')

    const listRes = await request(app)
      .get('/v1/reports')
      .set('Authorization', `Bearer ${userToken}`)

    expect(listRes.status).toBe(200)
    expect(Array.isArray(listRes.body.data)).toBe(true)
    expect(
      listRes.body.data.some(
        (item: { target_id: string; complaint_type: string }) =>
          item.target_id === postId && item.complaint_type === 'CONTENT_REPORT',
      ),
    ).toBe(true)
  })

  it('POST /v1/appeals and GET /v1/appeals create and list appeal requests for the current user', async () => {
    const community = await createTestCommunity({
      name: 'Appeal Target Community',
      slug: `appeal-target-${Date.now()}`,
    })
    const agentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Appeal Target Agent' })
    expect(agentRes.status).toBe(201)

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: agentRes.body.data.id,
      run_id: 'run-appeal-target-1',
      community_id: community.id,
      title: 'Appealable post',
      body: 'owner appeal target',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const createRes = await request(app)
      .post('/v1/appeals')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        target_type: 'post',
        target_id: postId,
        requester_type: 'OWNER',
        appeal_type: 'CONTENT_APPEAL',
        reason: 'owner_appeal',
      })

    expect(createRes.status).toBe(201)
    expect(createRes.body.data.appeal.status).toBe('LINKED')
    expect(createRes.body.data.appeal.requester_type).toBe('OWNER')
    expect(createRes.body.data.appeal.appeal_type).toBe('CONTENT_APPEAL')
    expect(createRes.body.data.case.case_type).toBe('APPEAL')

    const listRes = await request(app)
      .get('/v1/appeals')
      .set('Authorization', `Bearer ${userToken}`)

    expect(listRes.status).toBe(200)
    expect(Array.isArray(listRes.body.data)).toBe(true)
    expect(
      listRes.body.data.some(
        (item: { target_id: string; requester_type: string; appeal_type: string }) =>
          item.target_id === postId &&
          item.requester_type === 'OWNER' &&
          item.appeal_type === 'CONTENT_APPEAL',
      ),
    ).toBe(true)
  })

  it('POST /v1/reports rejects unsupported target types and missing targets', async () => {
    const invalidType = await request(app)
      .post('/v1/reports')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        target_type: 'unsupported',
        target_id: 'x-1',
        reason_code: 'viewer_report',
      })
    expect(invalidType.status).toBe(400)
    expect(invalidType.body.error.code).toBe('VALIDATION_ERROR')

    const missingTarget = await request(app)
      .post('/v1/reports')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        target_type: 'post',
        target_id: 'missing-post',
        reason_code: 'viewer_report',
      })
    expect(missingTarget.status).toBe(404)
    expect(missingTarget.body.error.code).toBe('NOT_FOUND')
  })

  it('GET /v1/search?tab=agents supports public agent search', async () => {
    await request(app).post('/v1/agents').set('Authorization', `Bearer ${userToken}`).send({
      display_name: 'Searchable Agent',
      persona_seed_code: 'comedian',
    })

    const res = await request(app).get('/v1/search').query({ q: 'searchable', tab: 'agents' })
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data.items)).toBe(true)
    const target = (res.body.data.items as Array<Record<string, unknown>>).find(
      (item) => item.display_name === 'Searchable Agent',
    )
    expect(target).toBeTruthy()
    expect(target?.persona_seed_label).toBeTruthy()
    expect(target?.home_voice_line_label).toBeTruthy()
    expect(target?.href).toBe(buildAgentTarget({
      agentId: target?.id as string,
      mode: 'readonly',
    }))
  })

  it('GET /v1/agents is no longer a public listing or search endpoint', async () => {
    const res = await request(app).get('/v1/agents?q=searchable')
    expect(res.status).toBe(404)
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

  it('GET /v1/posts/:postId/aftershow returns aftershow summary and callouts', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalAudienceZone = featureFlags.audienceZoneV1
    const originalAftershow = featureFlags.aftershowV1
    const originalAftershowPipeline = featureFlags.aftershowEventPipelineV1
    featureFlags.audienceZoneV1 = true
    featureFlags.aftershowV1 = true
    featureFlags.aftershowEventPipelineV1 = true

    try {
      const community = await createTestCommunity({
        name: 'Aftershow Read Community',
        slug: `aftershow-read-${Date.now()}`,
      })

      const createAgentRes = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: 'Aftershow Agent' })
      expect(createAgentRes.status).toBe(201)
      const agentId = createAgentRes.body.data.id as string

      const postRes = await servicePost('/v1/posts', {
        actor_agent_id: agentId,
        run_id: `run-aftershow-${Date.now()}`,
        community_id: community.id,
        title: 'Aftershow target post',
        body: 'aftershow body',
      })
      expect(postRes.status).toBe(201)
      const postId = postRes.body.data.id as string

      const messageRes = await request(app)
        .post(`/v1/posts/${postId}/audience-messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ body: '请在 aftershow 里回应这个观点。' })
      expect(messageRes.status).toBe(201)

      const triggerRes = await request(app)
        .post(`/v1/posts/${postId}/aftershow/trigger`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ mode: 'MANUAL', force: true })
      expect(triggerRes.status).toBe(201)

      const readRes = await request(app).get(`/v1/posts/${postId}/aftershow`)
      expect(readRes.status).toBe(200)
      expect(readRes.body.data.post_id).toBe(postId)
      expect(readRes.body.data.aftershow_summary).toBeTruthy()
      expect(Array.isArray(readRes.body.data.aftershow_callouts)).toBe(true)
      if (readRes.body.data.aftershow_callouts.length > 0) {
        expect(readRes.body.data.aftershow_callouts[0].deep_link).toContain(
          `/posts/${postId}?aftershow_id=`,
        )
      }
    } finally {
      featureFlags.audienceZoneV1 = originalAudienceZone
      featureFlags.aftershowV1 = originalAftershow
      featureFlags.aftershowEventPipelineV1 = originalAftershowPipeline
    }
  })

  it('GET /v1/posts/:postId/aftershow keeps published artifact when the latest trigger is aborted', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalAudienceZone = featureFlags.audienceZoneV1
    const originalAftershow = featureFlags.aftershowV1
    const originalAftershowPipeline = featureFlags.aftershowEventPipelineV1
    featureFlags.audienceZoneV1 = true
    featureFlags.aftershowV1 = true
    featureFlags.aftershowEventPipelineV1 = true

    try {
      const community = await createTestCommunity({
        name: 'Aftershow Read Fallback Community',
        slug: `aftershow-fallback-${Date.now()}`,
      })

      const createAgentRes = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: 'Aftershow Fallback Agent' })
      expect(createAgentRes.status).toBe(201)
      const agentId = createAgentRes.body.data.id as string

      const postRes = await servicePost('/v1/posts', {
        actor_agent_id: agentId,
        run_id: `run-aftershow-fallback-${Date.now()}`,
        community_id: community.id,
        title: 'Aftershow fallback target post',
        body: 'aftershow fallback body',
      })
      expect(postRes.status).toBe(201)
      const postId = postRes.body.data.id as string

      const messageRes = await request(app)
        .post(`/v1/posts/${postId}/audience-messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ body: '请在 aftershow 里回应这个观点。' })
      expect(messageRes.status).toBe(201)

      const firstTrigger = await request(app)
        .post(`/v1/posts/${postId}/aftershow/trigger`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ mode: 'MANUAL', force: true })
      expect(firstTrigger.status).toBe(201)
      expect(firstTrigger.body.data.artifact?.status).toBe('PUBLISHED')
      const firstArtifactId = firstTrigger.body.data.artifact?.id as string

      const secondTrigger = await request(app)
        .post(`/v1/posts/${postId}/aftershow/trigger`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ mode: 'MANUAL', force: true })
      expect(secondTrigger.status).toBe(201)
      expect(secondTrigger.body.data.artifact?.status).toBe('ABORTED')
      expect(secondTrigger.body.data.reason).toBe('publish_rate_limited')

      const readRes = await request(app).get(`/v1/posts/${postId}/aftershow`)
      expect(readRes.status).toBe(200)
      expect(readRes.body.data.aftershow_summary).toBeTruthy()
      expect(readRes.body.data.aftershow_summary.status).toBe('PUBLISHED')
      expect(readRes.body.data.aftershow_summary.id).toBe(firstArtifactId)
      expect(Array.isArray(readRes.body.data.aftershow_callouts)).toBe(true)
      expect(readRes.body.data.aftershow_callouts.length).toBeGreaterThan(0)
    } finally {
      featureFlags.audienceZoneV1 = originalAudienceZone
      featureFlags.aftershowV1 = originalAftershow
      featureFlags.aftershowEventPipelineV1 = originalAftershowPipeline
    }
  })

  it('GET /v1/posts/:postId/aside-seats returns role assignments for post scope', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalRoleAssignment = featureFlags.roleAssignmentV1
    const originalMemberships = featureFlags.membershipsV1
    featureFlags.roleAssignmentV1 = true
    featureFlags.membershipsV1 = true

    try {
      const community = await createTestCommunity({
        name: 'Aside Seats Read Community',
        slug: `aside-seats-read-${Date.now()}`,
      })

      const createAgentRes = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: 'Seat Agent' })
      expect(createAgentRes.status).toBe(201)
      const agentId = createAgentRes.body.data.id as string

      const membershipRes = await request(app)
        .patch(`/v1/agents/${agentId}/memberships`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ add: [community.id], remove: [] })
      expect(membershipRes.status).toBe(200)

      const postRes = await servicePost('/v1/posts', {
        actor_agent_id: agentId,
        run_id: `run-seat-${Date.now()}`,
        community_id: community.id,
        title: 'Aside seats target',
        body: 'aside seats body',
      })
      expect(postRes.status).toBe(201)
      const postId = postRes.body.data.id as string

      const roleRes = await request(app)
        .post(`/v1/communities/${community.id}/role-assignments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          scope: 'POST',
          scope_id: postId,
          role: 'core',
          agent_id: agentId,
        })
      expect(roleRes.status).toBe(201)

      const seatsRes = await request(app).get(`/v1/posts/${postId}/aside-seats`)
      expect(seatsRes.status).toBe(200)
      expect(seatsRes.body.data.post_id).toBe(postId)
      expect(Array.isArray(seatsRes.body.data.seats)).toBe(true)
      expect(seatsRes.body.data.seats.length).toBeGreaterThan(0)
    } finally {
      featureFlags.roleAssignmentV1 = originalRoleAssignment
      featureFlags.membershipsV1 = originalMemberships
    }
  })

  it('expired role assignment disappears from aside seats after expiration processing and writes ROLE_EXPIRED event', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalRoleAssignment = featureFlags.roleAssignmentV1
    const originalMemberships = featureFlags.membershipsV1
    featureFlags.roleAssignmentV1 = true
    featureFlags.membershipsV1 = true

    try {
      const community = await createTestCommunity({
        name: 'Aside Seats Expiry Community',
        slug: `aside-seats-expiry-${Date.now()}`,
      })

      const createAgentRes = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: 'Seat Expiry Agent' })
      expect(createAgentRes.status).toBe(201)
      const agentId = createAgentRes.body.data.id as string

      const membershipRes = await request(app)
        .patch(`/v1/agents/${agentId}/memberships`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ add: [community.id], remove: [] })
      expect(membershipRes.status).toBe(200)

      const postRes = await servicePost('/v1/posts', {
        actor_agent_id: agentId,
        run_id: `run-seat-expiry-${Date.now()}`,
        community_id: community.id,
        title: 'Aside seats expiry target',
        body: 'aside seats expiry body',
      })
      expect(postRes.status).toBe(201)
      const postId = postRes.body.data.id as string

      const expiresAt = new Date(Date.now() + 2000).toISOString()
      const roleRes = await request(app)
        .post(`/v1/communities/${community.id}/role-assignments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          scope: 'POST',
          scope_id: postId,
          role: 'core',
          agent_id: agentId,
          expires_at: expiresAt,
        })
      expect(roleRes.status).toBe(201)
      const assignmentId = roleRes.body.data.id as string

      const beforeExpireRes = await request(app).get(`/v1/posts/${postId}/aside-seats`)
      expect(beforeExpireRes.status).toBe(200)
      expect(
        beforeExpireRes.body.data.seats.some((item: { id: string }) => item.id === assignmentId),
      ).toBe(true)

      const expirationNow = new Date(Date.now() + 10_000)
      const processed = await roleAssignmentService.processDueExpirations({
        now: expirationNow,
        limit: 20,
      })
      expect(processed.processed).toBeGreaterThanOrEqual(1)

      const afterExpireRes = await request(app).get(`/v1/posts/${postId}/aside-seats`)
      expect(afterExpireRes.status).toBe(200)
      expect(
        afterExpireRes.body.data.seats.some((item: { id: string }) => item.id === assignmentId),
      ).toBe(false)

      const assignmentProbeRes = await request(app)
        .patch(`/v1/communities/${community.id}/role-assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'probe current status after expiry' })
      expect(assignmentProbeRes.status).toBe(200)
      expect(assignmentProbeRes.body.data.status).toBe('EXPIRED')

      const eventMapHost = eventRepo as unknown as {
        store?: Map<
          string,
          { event_type: string; correlation_id: string | null; actor_id: string | null }
        >
        cache?: Map<
          string,
          { event_type: string; correlation_id: string | null; actor_id: string | null }
        >
      }
      const eventMap = eventMapHost.store ?? eventMapHost.cache ?? new Map()
      const expiredEvent = Array.from(eventMap.values()).find(
        (evt) => evt.event_type === 'ROLE_EXPIRED' && evt.correlation_id === assignmentId,
      )
      expect(expiredEvent).toBeTruthy()
      expect(expiredEvent?.actor_id).toBe('role-expiry-scheduler')
    } finally {
      featureFlags.roleAssignmentV1 = originalRoleAssignment
      featureFlags.membershipsV1 = originalMemberships
    }
  })
})
