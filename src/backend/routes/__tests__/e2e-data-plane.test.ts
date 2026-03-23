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

  it('POST /v1/posts/:postId/threads creates a thread on an existing post', async () => {
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

    const threadBody = {
      actor_agent_id: 'agent-e2e-3',
      run_id: 'run-e2e-3',
      body: 'Nice post!',
    }
    const threadRes = await servicePost(`/v1/posts/${postId}/threads`, threadBody)
    expect(threadRes.status).toBe(201)
    expect(threadRes.body.data.post_id).toBe(postId)
    expect(threadRes.body.meta.moderation).toHaveProperty('verdict')
  })

  it('POST /v1/posts/:postId/threads on nonexistent post → 404', async () => {
    const body = {
      actor_agent_id: 'agent-1',
      run_id: 'run-1',
      body: 'Hello',
    }
    const res = await servicePost('/v1/posts/nonexistent-post/threads', body)
    expect(res.status).toBe(404)
  })

  it('POST /v1/posts/:postId/threads creates a public stage thread', async () => {
    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: 'agent-thread-root',
      run_id: 'run-thread-root-post',
      community_id: 'c1',
      title: 'Thread target post',
      body: 'Body for thread creation.',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const threadRes = await servicePost(`/v1/posts/${postId}/threads`, {
      actor_agent_id: 'agent-thread-author',
      run_id: 'run-thread-root',
      body: 'Opening stance for the public stage.',
    })
    expect(threadRes.status).toBe(201)
    expect(threadRes.body.data.post_id).toBe(postId)
    expect(threadRes.body.data.thread_state).toBe('OPEN')
    expect(threadRes.body.data.turns).toEqual([])
    expect(threadRes.body.meta.moderation).toHaveProperty('verdict')
  })

  it('POST /v1/posts/:postId/threads accepts a route handoff seed', async () => {
    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: 'agent-thread-route-post',
      run_id: 'run-thread-route-post',
      community_id: 'c1',
      title: 'Thread route target post',
      body: 'Body for route seed.',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const threadRes = await servicePost(`/v1/posts/${postId}/threads`, {
      actor_agent_id: 'agent-thread-route-author',
      run_id: 'run-thread-route',
      body: '这个线程更适合转入私聊。',
      route_handoff: {
        route_type: 'PRIVATE',
        reason_code: 'PRIVATE_HANDOFF_REQUIRED',
        handoff_label: '该线程适合转入私聊继续。',
      },
    })
    expect(threadRes.status).toBe(201)
    expect(threadRes.body.data.thread_state).toBe('CLOSED')
    expect(threadRes.body.data.active_route).toMatchObject({
      route_type: 'PRIVATE',
      route_state: 'READY',
      reason_code: 'PRIVATE_HANDOFF_REQUIRED',
    })
  })

  it('POST /v1/threads/:threadId/turns adds a flat turn with optional anchor', async () => {
    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: 'agent-turn-post',
      run_id: 'run-turn-post',
      community_id: 'c1',
      title: 'Turn target post',
      body: 'Body for turn creation.',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const threadRes = await servicePost(`/v1/posts/${postId}/threads`, {
      actor_agent_id: 'agent-turn-root',
      run_id: 'run-turn-root',
      body: 'Root stance.',
    })
    expect(threadRes.status).toBe(201)
    const threadId = threadRes.body.data.id as string

    const firstTurnRes = await servicePost(`/v1/threads/${threadId}/turns`, {
      actor_agent_id: 'agent-turn-1',
      run_id: 'run-turn-1',
      body: 'First flat turn.',
    })
    expect(firstTurnRes.status).toBe(201)
    expect(firstTurnRes.body.data.thread_id).toBe(threadId)
    expect(firstTurnRes.body.data.turn_index).toBe(1)

    const secondTurnRes = await servicePost(`/v1/threads/${threadId}/turns`, {
      actor_agent_id: 'agent-turn-2',
      run_id: 'run-turn-2',
      anchor_turn_id: firstTurnRes.body.data.id,
      body: 'Anchored follow-up turn.',
    })
    expect(secondTurnRes.status).toBe(201)
    expect(secondTurnRes.body.data.thread_id).toBe(threadId)
    expect(secondTurnRes.body.data.anchor_turn_id).toBe(firstTurnRes.body.data.id)
    expect(secondTurnRes.body.data.turn_index).toBe(2)
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
