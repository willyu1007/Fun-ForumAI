import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app, servicePost, adminToken, userToken, setupFeatureFlagGuard } from './e2e-helpers.js'

setupFeatureFlagGuard()

describe('E2E: Full flow (create → read → vote → moderate)', () => {
  it('creates a post, reads it in feed, votes, and moderates', async () => {
    const createRes = await servicePost('/v1/posts', {
      actor_agent_id: 'agent-flow-1',
      run_id: 'run-flow-1',
      community_id: 'community-flow',
      title: 'Full Flow Post',
      body: 'Testing the complete CRUD flow.',
    })
    expect(createRes.status).toBe(201)
    const postId = createRes.body.data.id

    const getRes = await request(app).get(`/v1/posts/${postId}`)
    expect(getRes.status).toBe(200)
    expect(getRes.body.data.title).toBe('Full Flow Post')
    expect(getRes.body.data.thread_turn_count).toBe(0)
    expect(getRes.body.data.vote_score).toBe(0)

    const threadRes = await servicePost(`/v1/posts/${postId}/threads`, {
      actor_agent_id: 'agent-flow-2',
      run_id: 'run-flow-2',
      body: 'Interesting perspective!',
    })
    expect(threadRes.status).toBe(201)

    const voteRes = await servicePost('/v1/votes', {
      actor_agent_id: 'agent-flow-3',
      run_id: 'run-flow-3',
      target_type: 'POST',
      target_id: postId,
      direction: 'UP',
    })
    expect(voteRes.status).toBe(201)

    const getRes2 = await request(app).get(`/v1/posts/${postId}`)
    expect(getRes2.body.data.thread_turn_count).toBe(1)
    expect(getRes2.body.data.vote_score).toBe(1)

    const threadsRes = await request(app).get(`/v1/posts/${postId}/threads`)
    expect(threadsRes.status).toBe(200)
    expect(threadsRes.body.data).toHaveLength(1)
    expect(threadsRes.body.data[0].body).toBe('Interesting perspective!')

    const foldRes = await request(app)
      .post('/v1/admin/moderation/actions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'fold', target_type: 'post', target_id: postId })
    expect(foldRes.status).toBe(200)
    expect(foldRes.body.data.new_visibility).toBe('GRAY')

    const getRes3 = await request(app).get(`/v1/posts/${postId}`)
    expect(getRes3.body.data.visibility).toBe('GRAY')
  })

  it('applies following_only filter for feed', async () => {
    const a1 = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Followed Author' })
    const a2 = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Unfollowed Author' })

    const followedAgentId = a1.body.data.id
    const unfollowedAgentId = a2.body.data.id

    await request(app)
      .post(`/v1/agents/${followedAgentId}/follow`)
      .set('Authorization', `Bearer ${userToken}`)
      .send()

    await servicePost('/v1/posts', {
      actor_agent_id: followedAgentId,
      run_id: 'run-follow-1',
      community_id: 'community-follow',
      title: 'Followed post',
      body: 'should be visible in following_only feed',
    })

    await servicePost('/v1/posts', {
      actor_agent_id: unfollowedAgentId,
      run_id: 'run-follow-2',
      community_id: 'community-follow',
      title: 'Unfollowed post',
      body: 'should be filtered out in following_only feed',
    })

    const filtered = await request(app)
      .get('/v1/feed?following_only=true')
      .set('Authorization', `Bearer ${userToken}`)
    expect(filtered.status).toBe(200)
    expect(filtered.body.data.every((p: { author_agent_id: string }) => p.author_agent_id === followedAgentId)).toBe(true)
  })
})
