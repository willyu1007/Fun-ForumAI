import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app, config, servicePost, adminToken, userToken, user2Token, setupFeatureFlagGuard } from './e2e-helpers.js'
import { communityRepo, incubationService } from '../../container.js'

setupFeatureFlagGuard()

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

  it('PATCH /v1/agents/:agentId/memberships cannot recover BANNED membership via add', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalMembershipFlag = featureFlags.membershipsV1
    const originalMembershipStatusFlag = featureFlags.membershipStatusV1
    featureFlags.membershipsV1 = true
    featureFlags.membershipStatusV1 = true

    try {
      const community = communityRepo.create({ name: 'Membership Ban', slug: `membership-ban-${Date.now()}` })
      const createRes = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: 'Membership Ban Bot' })
      const agentId = createRes.body.data.id as string

      const addRes = await request(app)
        .patch(`/v1/agents/${agentId}/memberships`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ add: [community.id], remove: [] })
      expect(addRes.status).toBe(200)

      const banRes = await request(app)
        .patch(`/v1/agents/${agentId}/memberships/${community.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'BANNED', reason: 'policy' })
      expect(banRes.status).toBe(200)

      const recoverViaAdd = await request(app)
        .patch(`/v1/agents/${agentId}/memberships`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ add: [community.id], remove: [] })
      expect(recoverViaAdd.status).toBe(403)
      expect(recoverViaAdd.body.error.code).toBe('FORBIDDEN')
    } finally {
      featureFlags.membershipsV1 = originalMembershipFlag
      featureFlags.membershipStatusV1 = originalMembershipStatusFlag
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

  it('POST /v1/admin/stage/season-rotate requires admin role', async () => {
    const res = await request(app)
      .post('/v1/admin/stage/season-rotate')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ open_count: 3, dry_run: true })
    expect(res.status).toBe(403)
  })

  it('POST /v1/admin/stage/season-rotate supports dry_run for admin', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalStageRotation = featureFlags.stageRotationV1
    featureFlags.stageRotationV1 = true

    try {
      const res = await request(app)
        .post('/v1/admin/stage/season-rotate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ open_count: 3, dry_run: true })
      expect(res.status).toBe(200)
      expect(res.body.data.open_count).toBe(3)
      expect(res.body.data.dry_run).toBe(true)
      expect(Array.isArray(res.body.data.activated)).toBe(true)
      expect(Array.isArray(res.body.data.replaced)).toBe(true)
    } finally {
      featureFlags.stageRotationV1 = originalStageRotation
    }
  })

  it('POST /v1/admin/stage/season-rotate blocks non-dry-run in production node env', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const runtimeConfig = config as unknown as { nodeEnv: string }
    const originalStageRotation = featureFlags.stageRotationV1
    const originalNodeEnv = runtimeConfig.nodeEnv
    const prodAdminToken = jwt.sign(
      { userId: 'admin-prod', email: 'admin-prod@test.com', role: 'admin' },
      config.auth.jwtSecret,
    )
    featureFlags.stageRotationV1 = true
    runtimeConfig.nodeEnv = 'production'

    try {
      const blocked = await request(app)
        .post('/v1/admin/stage/season-rotate')
        .set('Authorization', `Bearer ${prodAdminToken}`)
        .send({ open_count: 3, dry_run: false })
      expect(blocked.status).toBe(403)
      expect(blocked.body.error.code).toBe('FORBIDDEN')

      const dryRun = await request(app)
        .post('/v1/admin/stage/season-rotate')
        .set('Authorization', `Bearer ${prodAdminToken}`)
        .send({ open_count: 3, dry_run: true })
      expect(dryRun.status).toBe(200)
      expect(dryRun.body.data.dry_run).toBe(true)
    } finally {
      featureFlags.stageRotationV1 = originalStageRotation
      runtimeConfig.nodeEnv = originalNodeEnv
    }
  })

  it('POST /v1/incubation/jobs/:jobId/grant rejects reviewer_user_id field', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalIncubation = featureFlags.incubationV1
    featureFlags.incubationV1 = true

    try {
      const res = await request(app)
        .post('/v1/incubation/jobs/job-unknown/grant')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reviewer_user_id: 'spoofed-user',
          reason: 'grant reason',
          ttl_hours: 24,
        })
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    } finally {
      featureFlags.incubationV1 = originalIncubation
    }
  })

  it('POST /v1/incubation/jobs/:jobId/review-verdict rejects reviewer_user_id field', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalIncubation = featureFlags.incubationV1
    featureFlags.incubationV1 = true

    try {
      const res = await request(app)
        .post('/v1/incubation/jobs/job-unknown/review-verdict')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reviewer_user_id: 'spoofed-user',
          verdict: 'approve',
          reason: 'review reason',
        })
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    } finally {
      featureFlags.incubationV1 = originalIncubation
    }
  })

  it('incubation grant/review routes pass authenticated actor to service', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalIncubation = featureFlags.incubationV1
    featureFlags.incubationV1 = true

    const grantSpy = vi
      .spyOn(incubationService, 'grantJob')
      .mockResolvedValue({
        id: 'grant-1',
        job_id: 'job-1',
        reviewer_agent_id: null,
        reviewer_user_id: 'admin1',
        status: 'ACTIVE',
        reason: 'grant reason',
        ttl_hours: 24,
        scope: 'ABSTRACT_ONLY',
        anonymity_level: 'strong',
        quote_policy: 'PARAPHRASE_ONLY',
        no_go_topics: [],
        policy: null,
        granted_at: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        revoked_at: null,
        meta: null,
        created_at: new Date(),
        updated_at: new Date(),
      })
    const reviewSpy = vi
      .spyOn(incubationService, 'reviewJob')
      .mockResolvedValue({
        job: {
          id: 'job-1',
          post_id: 'post-1',
          community_id: 'community-1',
          proposer_agent_id: 'agent-1',
          status: 'PENDING',
          phase: 'AWAIT_GRANT',
          strict_t4: true,
          grant_required: true,
          premod_required: true,
          redaction_level: 'strong',
          source_count: 0,
          idempotency_key: null,
          source_session_id: null,
          source_memory_id: null,
          research: null,
          draft: null,
          review: null,
          requested_at: new Date(),
          expires_at: null,
          meta: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        next_action: 'grant_required',
      })

    try {
      const grantRes = await request(app)
        .post('/v1/incubation/jobs/job-1/grant')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'grant reason',
          ttl_hours: 24,
        })
      expect(grantRes.status).toBe(201)
      expect(grantSpy).toHaveBeenCalledWith({
        job_id: 'job-1',
        actor_user_id: 'admin1',
        reason: 'grant reason',
        ttl_hours: 24,
        scope: undefined,
        anonymity_level: undefined,
        quote_policy: undefined,
        no_go_topics: undefined,
      })

      const reviewRes = await request(app)
        .post('/v1/incubation/jobs/job-1/review-verdict')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          verdict: 'approve',
          reason: 'review reason',
        })
      expect(reviewRes.status).toBe(201)
      expect(reviewSpy).toHaveBeenCalledWith({
        job_id: 'job-1',
        actor_user_id: 'admin1',
        verdict: 'approve',
        reason: 'review reason',
      })
    } finally {
      featureFlags.incubationV1 = originalIncubation
      grantSpy.mockRestore()
      reviewSpy.mockRestore()
    }
  })

  it('GET /v1/incubation/jobs/:jobId blocks unrelated users', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalIncubation = featureFlags.incubationV1
    featureFlags.incubationV1 = true

    const ownerAgentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Incubation Owner Agent' })
    expect(ownerAgentRes.status).toBe(201)
    const proposerAgentId = ownerAgentRes.body.data.id as string

    const getJobSpy = vi
      .spyOn(incubationService, 'getJob')
      .mockResolvedValue({
        job: {
          id: 'job-view-1',
          post_id: null,
          community_id: 'community-1',
          proposer_agent_id: proposerAgentId,
          status: 'PENDING',
          phase: 'AWAIT_GRANT',
          strict_t4: true,
          grant_required: true,
          premod_required: true,
          redaction_level: 'strong',
          source_count: 0,
          idempotency_key: null,
          source_session_id: null,
          source_memory_id: null,
          research: null,
          draft: null,
          review: null,
          requested_at: new Date(),
          expires_at: null,
          meta: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        grants: [],
        source_bundles: [],
        events: [],
      })

    try {
      const res = await request(app)
        .get('/v1/incubation/jobs/job-view-1')
        .set('Authorization', `Bearer ${user2Token}`)
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('FORBIDDEN')
    } finally {
      featureFlags.incubationV1 = originalIncubation
      getJobSpy.mockRestore()
    }
  })

  it('GET /v1/incubation/jobs/:jobId allows assigned reviewer', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalIncubation = featureFlags.incubationV1
    featureFlags.incubationV1 = true

    const ownerAgentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Incubation Owner Agent 2' })
    expect(ownerAgentRes.status).toBe(201)
    const proposerAgentId = ownerAgentRes.body.data.id as string

    const getJobSpy = vi
      .spyOn(incubationService, 'getJob')
      .mockResolvedValue({
        job: {
          id: 'job-view-2',
          post_id: null,
          community_id: 'community-1',
          proposer_agent_id: proposerAgentId,
          status: 'PENDING',
          phase: 'AWAIT_GRANT',
          strict_t4: true,
          grant_required: true,
          premod_required: true,
          redaction_level: 'strong',
          source_count: 0,
          idempotency_key: null,
          source_session_id: null,
          source_memory_id: null,
          research: null,
          draft: null,
          review: null,
          requested_at: new Date(),
          expires_at: null,
          meta: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        grants: [
          {
            id: 'grant-reviewer-1',
            job_id: 'job-view-2',
            reviewer_agent_id: null,
            reviewer_user_id: 'user2',
            status: 'ACTIVE',
            reason: 'review access',
            ttl_hours: 24,
            scope: 'ABSTRACT_ONLY',
            anonymity_level: 'strong',
            quote_policy: 'PARAPHRASE_ONLY',
            no_go_topics: [],
            policy: null,
            granted_at: new Date(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
            revoked_at: null,
            meta: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        source_bundles: [],
        events: [],
      })

    try {
      const res = await request(app)
        .get('/v1/incubation/jobs/job-view-2')
        .set('Authorization', `Bearer ${user2Token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.job.id).toBe('job-view-2')
    } finally {
      featureFlags.incubationV1 = originalIncubation
      getJobSpy.mockRestore()
    }
  })

  it('POST /v1/posts/:postId/aftershow/trigger allows only admin or agent owner in manual mode', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalAftershow = featureFlags.aftershowV1
    featureFlags.aftershowV1 = true

    const ownerAgentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Aftershow Owner Agent' })
    expect(ownerAgentRes.status).toBe(201)
    const ownerAgentId = ownerAgentRes.body.data.id as string

    const community = communityRepo.create({
      name: 'Aftershow Permission Community',
      slug: `aftershow-perm-${Date.now()}`,
    })

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: ownerAgentId,
      run_id: 'run-aftershow-owner-1',
      community_id: community.id,
      title: 'Aftershow permission test',
      body: 'permission check body',
    })
    expect(postRes.status).toBe(201)
    const postId = postRes.body.data.id as string

    try {
      const forbiddenRes = await request(app)
        .post(`/v1/posts/${postId}/aftershow/trigger`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ mode: 'MANUAL', force: true })
      expect(forbiddenRes.status).toBe(403)

      const ownerRes = await request(app)
        .post(`/v1/posts/${postId}/aftershow/trigger`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ mode: 'MANUAL', force: true })
      expect(ownerRes.status).toBe(201)
      expect(ownerRes.body.data).toHaveProperty('summary_ref')
      expect(ownerRes.body.data).toHaveProperty('audience_message_count')
      expect(ownerRes.body.data).toHaveProperty('threshold_detail')
    } finally {
      featureFlags.aftershowV1 = originalAftershow
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
