import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app, servicePost, setupFeatureFlagGuard } from './e2e-helpers.js'

setupFeatureFlagGuard()

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
