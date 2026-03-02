import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import { app } from '../../app.js'
import { createServiceToken } from '../../middleware/service-auth.js'
import { createDevToken } from '../../middleware/human-auth.js'
import { config } from '../../lib/config.js'
import { llmClient, communityRepo } from '../../container.js'

const VALID_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5NQAAAAASUVORK5CYII=',
  'base64',
)

function servicePost(path: string, body: Record<string, unknown>) {
  const bodyStr = JSON.stringify(body)
  const token = createServiceToken('agent-runtime', bodyStr)
  return request(app).post(path).set('X-Service-Token', token).send(body)
}

const adminToken = createDevToken({ userId: 'admin1', email: 'admin@test.com', role: 'admin' })
const userToken = createDevToken({ userId: 'user1', email: 'user@test.com', role: 'user' })
const user2Token = createDevToken({ userId: 'user2', email: 'user2@test.com', role: 'user' })

async function waitFor<T>(
  loader: () => Promise<T>,
  opts: { timeoutMs?: number; intervalMs?: number; pass: (value: T) => boolean },
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 1500
  const intervalMs = opts.intervalMs ?? 60
  const startedAt = Date.now()
  let last: T | null = null

  while (Date.now() - startedAt < timeoutMs) {
    const next = await loader()
    last = next
    if (opts.pass(next)) return next
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  if (last === null) {
    throw new Error('waitFor exhausted without any attempts')
  }
  return last
}

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
      const postRes = await servicePost('/v1/posts', {
        actor_agent_id: 'agent-highlights-1',
        run_id: 'run-highlights-1',
        community_id: 'c-hot',
        title: 'Hot highlight post',
        body: 'hot body',
      })
      expect(postRes.status).toBe(201)
      const postId = postRes.body.data.id as string

      await servicePost('/v1/comments', {
        actor_agent_id: 'agent-highlights-2',
        run_id: 'run-highlights-2',
        post_id: postId,
        body: 'interesting thread',
      })

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
    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: 'agent-human-vote-1',
      run_id: 'run-human-vote-1',
      community_id: 'c1',
      title: 'Human vote target',
      body: 'Target body',
    })
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

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: agentId,
      run_id: 'run-avatar-1',
      community_id: 'c1',
      title: 'Avatar visibility post',
      body: 'avatar should appear in feed author',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    const feedRes = await request(app).get('/v1/feed')
    expect(feedRes.status).toBe(200)
    const targetPost = (feedRes.body.data as Array<{ id: string; author: { avatar_url: string | null } }>)
      .find((item) => item.id === postId)
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

  it('PATCH /v1/agents/:agentId/memberships updates explicit memberships', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalMembershipFlag = featureFlags.membershipsV1
    featureFlags.membershipsV1 = true

    try {
      const communityA = communityRepo.create({ name: 'Membership A', slug: `membership-a-${Date.now()}` })
      const communityB = communityRepo.create({ name: 'Membership B', slug: `membership-b-${Date.now()}` })

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
      expect(addRes.body.data.updated.added.sort()).toEqual([communityA.id, communityB.id])
      expect(addRes.body.data.active_memberships).toHaveLength(2)

      const removeRes = await request(app)
        .patch(`/v1/agents/${agentId}/memberships`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ add: [], remove: [communityA.id] })
      expect(removeRes.status).toBe(200)
      expect(removeRes.body.data.updated.removed).toEqual([communityA.id])
      expect(removeRes.body.data.active_memberships.map((item: { community_id: string }) => item.community_id)).toEqual([communityB.id])

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

  it('GET /v1/admin/runtime/features returns feature snapshot for admin', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalRuntimeFeatures = featureFlags.runtimeFeaturesV1
    featureFlags.runtimeFeaturesV1 = true

    try {
      const res = await request(app)
        .get('/v1/admin/runtime/features')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(typeof res.body.data.flags).toBe('object')
      expect(typeof res.body.data.counters).toBe('object')
      expect(res.body.data.counters).toHaveProperty('allocator.ppr_hits')
      expect(res.body.data.counters).toHaveProperty('director.selected_core')
      expect(res.body.data.counters).toHaveProperty('prompt.trim_applied_calls')
    } finally {
      featureFlags.runtimeFeaturesV1 = originalRuntimeFeatures
    }
  })

  it('follow/unfollow and followed list work for authenticated users', async () => {
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

    const listRes = await request(app)
      .get('/v1/me/followed-agents')
      .set('Authorization', `Bearer ${userToken}`)
    expect(listRes.status).toBe(200)
    expect(listRes.body.data.some((a: { id: string }) => a.id === targetAgentId)).toBe(true)

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

    const legacyHighlights = await request(app).get('/v1/highlights')
    expect(legacyHighlights.status).toBe(200)
    expect(legacyHighlights.body.data).toMatchObject({
      hot_threads: [],
      featured_agents: [],
      controversy: [],
      wildcard_cameos: [],
    })
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

describe('E2E: Multimodal inclination + owner-only growth controls', () => {
  const featureFlags = config.features as unknown as Record<string, boolean>
  const originalMultimodal = featureFlags.multimodalAgentInclinationV1

  beforeAll(() => {
    featureFlags.multimodalAgentInclinationV1 = true
  })

  afterAll(() => {
    featureFlags.multimodalAgentInclinationV1 = originalMultimodal
  })

  it('upload/current/delete and local media read work for owner', async () => {
    const createAgentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Multimodal Owner Agent' })
    const agentId = createAgentRes.body.data.id

    const uploadRes = await request(app)
      .post(`/v1/agents/${agentId}/inclination-asset/upload`)
      .set('Authorization', `Bearer ${userToken}`)
      .field('owner_note', '偏轻松吐槽')
      .attach('file', VALID_PNG_BUFFER, {
        filename: 'meme.png',
        contentType: 'image/png',
      })
    expect(uploadRes.status).toBe(201)
    expect(uploadRes.body.data.status).toBe('PENDING')
    expect(typeof uploadRes.body.data.media_url).toBe('string')

    const mediaRes = await request(app).get(uploadRes.body.data.media_url)
    expect(mediaRes.status).toBe(200)
    expect(String(mediaRes.headers['content-type'])).toContain('image/png')

    const currentRes = await request(app)
      .get(`/v1/agents/${agentId}/inclination-asset/current`)
      .set('Authorization', `Bearer ${userToken}`)
    expect(currentRes.status).toBe(200)
    expect(currentRes.body.data.pending).toBeTruthy()

    const deleteRes = await request(app)
      .delete(`/v1/agents/${agentId}/inclination-asset/current`)
      .set('Authorization', `Bearer ${userToken}`)
    expect(deleteRes.status).toBe(200)
    expect(deleteRes.body.data.removed).toBe(true)
  })

  it('rejects non-https URL assets', async () => {
    const createAgentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Multimodal URL Agent' })
    const agentId = createAgentRes.body.data.id

    const res = await request(app)
      .post(`/v1/agents/${agentId}/inclination-asset/url`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ source_url: 'http://example.com/unsafe.png' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects corrupted upload files', async () => {
    const createAgentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Corrupted Upload Agent' })
    const agentId = createAgentRes.body.data.id

    const uploadRes = await request(app)
      .post(`/v1/agents/${agentId}/inclination-asset/upload`)
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: 'broken.png',
        contentType: 'image/png',
      })
    expect(uploadRes.status).toBe(400)
    expect(uploadRes.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('blocks non-owner for inclination endpoints and style/instructions/prompt-overrides', async () => {
    const createAgentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Owner-locked Agent' })
    const agentId = createAgentRes.body.data.id

    const inclinationRes = await request(app)
      .get(`/v1/agents/${agentId}/inclination-asset/current`)
      .set('Authorization', `Bearer ${user2Token}`)
    expect(inclinationRes.status).toBe(403)

    const styleRes = await request(app)
      .get(`/v1/agents/${agentId}/style`)
      .set('Authorization', `Bearer ${user2Token}`)
    expect(styleRes.status).toBe(403)

    const instructionsRes = await request(app)
      .get(`/v1/agents/${agentId}/instructions`)
      .set('Authorization', `Bearer ${user2Token}`)
    expect(instructionsRes.status).toBe(403)

    const promptOverridesRes = await request(app)
      .get(`/v1/agents/${agentId}/prompt-overrides`)
      .set('Authorization', `Bearer ${user2Token}`)
    expect(promptOverridesRes.status).toBe(403)
  })

  it('consumes pending inclination asset on next scheduled post and writes post media', async () => {
    const originalChat = llmClient.chat.bind(llmClient)
    const originalIsConfigured = Object.getOwnPropertyDescriptor(llmClient, 'isConfigured')

    Object.defineProperty(llmClient, 'isConfigured', {
      value: true,
      configurable: true,
    })

    llmClient.chat = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        community_id_or_slug: 'general',
        title: '多模态调度测试帖',
        body: '这是一条用于验证 pending 资源消费链路的测试正文。',
      }),
      model: 'test-model',
      usage: {
        prompt_tokens: 12,
        completion_tokens: 24,
        total_tokens: 36,
      },
    })

    try {
      const seedRes = await request(app).post('/v1/dev/seed').send()
      expect(seedRes.status).toBe(200)

      const createAgentRes = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: 'Multimodal Scheduler Agent' })
      const agentId = createAgentRes.body.data.id

      const uploadRes = await request(app)
        .post(`/v1/agents/${agentId}/inclination-asset/upload`)
        .set('Authorization', `Bearer ${userToken}`)
        .field('owner_note', '优先讨论表情包背后的情绪')
        .attach('file', VALID_PNG_BUFFER, {
          filename: 'inclination.png',
          contentType: 'image/png',
        })
      expect(uploadRes.status).toBe(201)
      const assetId = uploadRes.body.data.asset_id as string

      const runtimePostRes = await request(app).post('/v1/dev/runtime/post').send()
      expect(runtimePostRes.status).toBe(200)
      expect(runtimePostRes.body.data.triggered).toBe(true)
      expect(runtimePostRes.body.data.agent_id).toBe(agentId)
      const postId = runtimePostRes.body.data.post_id as string
      expect(typeof postId).toBe('string')

      const postRes = await request(app).get(`/v1/posts/${postId}`)
      expect(postRes.status).toBe(200)
      expect(Array.isArray(postRes.body.data.media)).toBe(true)
      expect(postRes.body.data.media.length).toBeGreaterThan(0)
      expect(postRes.body.data.media[0].asset_id).toBe(assetId)

      const currentRes = await request(app)
        .get(`/v1/agents/${agentId}/inclination-asset/current`)
        .set('Authorization', `Bearer ${userToken}`)
      expect(currentRes.status).toBe(200)
      expect(currentRes.body.data.pending).toBeNull()
      expect(currentRes.body.data.last_consumed.status).toBe('CONSUMED')
      expect(currentRes.body.data.last_consumed.asset_id).toBe(assetId)
    } finally {
      llmClient.chat = originalChat
      if (originalIsConfigured) {
        Object.defineProperty(llmClient, 'isConfigured', originalIsConfigured)
      } else {
        delete (llmClient as unknown as Record<string, unknown>).isConfigured
      }
    }
  })
})
