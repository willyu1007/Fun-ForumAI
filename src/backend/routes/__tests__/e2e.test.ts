import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../app.js'
import { createServiceToken } from '../../middleware/service-auth.js'
import { createDevToken } from '../../middleware/human-auth.js'

function servicePost(path: string, body: Record<string, unknown>) {
  const bodyStr = JSON.stringify(body)
  const token = createServiceToken('agent-runtime', bodyStr)
  return request(app).post(path).set('X-Service-Token', token).send(body)
}

const adminToken = createDevToken({ userId: 'admin1', email: 'admin@test.com', role: 'admin' })
const userToken = createDevToken({ userId: 'user1', email: 'user@test.com', role: 'user' })

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
    expect(res.body.data).toEqual([])
  })

  it('GET /v1/feed?limit=abc returns 400 validation error', async () => {
    const res = await request(app).get('/v1/feed?limit=abc')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('E2E: Data Plane (service auth + write)', () => {
  it('POST /v1/posts creates a post with moderation', async () => {
    const body = {
      actor_agent_id: 'agent-e2e-1',
      run_id: 'run-e2e-1',
      community_id: 'c1',
      title: 'Hello from E2E',
      body: 'This is a test post for end-to-end verification.',
      tags: ['test'],
    }
    const res = await servicePost('/v1/posts', body)
    expect(res.status).toBe(201)
    expect(res.body.data).toHaveProperty('id')
    expect(res.body.data.title).toBe('Hello from E2E')
    expect(res.body.meta.moderation).toHaveProperty('verdict')
    expect(res.body.meta).toHaveProperty('event_id')
    expect(res.body.meta).toHaveProperty('agent_run_id')
  })

  it('POST /v1/posts validates required fields', async () => {
    const body = {
      actor_agent_id: 'agent-1',
      run_id: 'run-1',
    }
    const res = await servicePost('/v1/posts', body)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('POST /v1/posts without service token → 401', async () => {
    const res = await request(app).post('/v1/posts').send({
      actor_agent_id: 'a1', run_id: 'r1',
      community_id: 'c1', title: 'T', body: 'B',
    })
    expect(res.status).toBe(401)
  })

  it('POST /v1/comments creates a comment on an existing post', async () => {
    const postBody = {
      actor_agent_id: 'agent-e2e-2',
      run_id: 'run-e2e-2',
      community_id: 'c1',
      title: 'Post for comment test',
      body: 'Need a post to comment on.',
    }
    const postRes = await servicePost('/v1/posts', postBody)
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id

    const commentBody = {
      actor_agent_id: 'agent-e2e-3',
      run_id: 'run-e2e-3',
      post_id: postId,
      body: 'Nice post!',
    }
    const commentRes = await servicePost('/v1/comments', commentBody)
    expect(commentRes.status).toBe(201)
    expect(commentRes.body.data.post_id).toBe(postId)
    expect(commentRes.body.meta.moderation).toHaveProperty('verdict')
  })

  it('POST /v1/comments on nonexistent post → 404', async () => {
    const body = {
      actor_agent_id: 'agent-1',
      run_id: 'run-1',
      post_id: 'nonexistent-post',
      body: 'Hello',
    }
    const res = await servicePost('/v1/comments', body)
    expect(res.status).toBe(404)
  })

  it('POST /v1/votes creates a vote on an existing post', async () => {
    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: 'agent-e2e-4',
      run_id: 'run-e2e-4',
      community_id: 'c1',
      title: 'Vote target post',
      body: 'Body for vote test.',
    })
    const postId = postRes.body.data.id

    const voteBody = {
      actor_agent_id: 'agent-e2e-5',
      run_id: 'run-e2e-5',
      target_type: 'POST' as const,
      target_id: postId,
      direction: 'UP' as const,
    }
    const voteRes = await servicePost('/v1/votes', voteBody)
    expect(voteRes.status).toBe(201)
    expect(voteRes.body.data.direction).toBe('UP')
    expect(voteRes.body.meta).toHaveProperty('event_id')
  })

  it('POST /v1/votes on nonexistent target → 404', async () => {
    const body = {
      actor_agent_id: 'a1',
      run_id: 'r1',
      target_type: 'POST',
      target_id: 'nonexistent-post',
      direction: 'UP',
    }
    const res = await servicePost('/v1/votes', body)
    expect(res.status).toBe(404)
  })
})

describe('E2E: Control Plane (human auth)', () => {
  it('POST /v1/agents creates an agent', async () => {
    const res = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'E2E Bot' })
    expect(res.status).toBe(201)
    expect(res.body.data.display_name).toBe('E2E Bot')
    expect(res.body.data.owner_id).toBe('user1')
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
    expect(patchRes.body.data.config_json).toEqual({ temperature: 0.5 })
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

  it('POST /v1/admin/moderation/actions requires admin role', async () => {
    const res = await request(app)
      .post('/v1/admin/moderation/actions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ action: 'approve', target_type: 'post', target_id: 'p1' })
    expect(res.status).toBe(403)
  })

  it('POST /v1/admin/moderation/actions works for admin', async () => {
    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: 'agent-gov-1',
      run_id: 'run-gov-1',
      community_id: 'c1',
      title: 'Governance target',
      body: 'Content to moderate.',
    })
    const postId = postRes.body.data.id

    const res = await request(app)
      .post('/v1/admin/moderation/actions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'fold',
        target_type: 'post',
        target_id: postId,
        reason: 'Testing governance',
      })
    expect(res.status).toBe(200)
    expect(res.body.data.success).toBe(true)
    expect(res.body.data.new_visibility).toBe('GRAY')
  })
})

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
    expect(getRes.body.data.comment_count).toBe(0)
    expect(getRes.body.data.vote_score).toBe(0)

    const commentRes = await servicePost('/v1/comments', {
      actor_agent_id: 'agent-flow-2',
      run_id: 'run-flow-2',
      post_id: postId,
      body: 'Interesting perspective!',
    })
    expect(commentRes.status).toBe(201)

    const voteRes = await servicePost('/v1/votes', {
      actor_agent_id: 'agent-flow-3',
      run_id: 'run-flow-3',
      target_type: 'POST',
      target_id: postId,
      direction: 'UP',
    })
    expect(voteRes.status).toBe(201)

    const getRes2 = await request(app).get(`/v1/posts/${postId}`)
    expect(getRes2.body.data.comment_count).toBe(1)
    expect(getRes2.body.data.vote_score).toBe(1)

    const commentsRes = await request(app).get(`/v1/posts/${postId}/comments`)
    expect(commentsRes.status).toBe(200)
    expect(commentsRes.body.data).toHaveLength(1)
    expect(commentsRes.body.data[0].body).toBe('Interesting perspective!')

    const foldRes = await request(app)
      .post('/v1/admin/moderation/actions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'fold', target_type: 'post', target_id: postId })
    expect(foldRes.status).toBe(200)
    expect(foldRes.body.data.new_visibility).toBe('GRAY')

    const getRes3 = await request(app).get(`/v1/posts/${postId}`)
    expect(getRes3.body.data.visibility).toBe('GRAY')
  })
})
