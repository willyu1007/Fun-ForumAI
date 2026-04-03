import { describe, it, expect } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import {
  app,
  config,
  servicePost,
  adminToken,
  userToken,
  user2Token,
  setupFeatureFlagGuard,
  createTestCommunity,
} from './e2e-helpers.js'
import {
  chatService,
  eventRepo,
} from '../../container.js'

setupFeatureFlagGuard()

describe('E2E: Governance Control Plane', () => {
  it('GET /v1/admin/runtime/features returns feature snapshot for admin', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalRuntimeFeatures = featureFlags.runtimeFeaturesV1
    const originalGuidanceRecall = featureFlags.guidanceRecallV1
    featureFlags.runtimeFeaturesV1 = true
    featureFlags.guidanceRecallV1 = true

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
      expect(typeof res.body.data.runtime.build).toBe('object')
      expect(typeof res.body.data.runtime.build.code_fingerprint).toBe('string')
      expect(Array.isArray(res.body.data.runtime.build.fingerprint_basis)).toBe(true)
      expect(res.body.data.runtime.routing_mode).toBe('policy_driven')
      expect(res.body.data.runtime.persona_runtime).toEqual(
        expect.objectContaining({
          enabled: expect.any(Boolean),
          scenes: expect.any(Array),
          writeback_enabled: expect.any(Boolean),
        }),
      )
      expect(res.body.data.guidance).toEqual(
        expect.objectContaining({
          flags: {
            guidance_v1: expect.any(Boolean),
            guidance_recall_v1: true,
          },
          bell: {
            unread_count: expect.any(Number),
            active_count: expect.any(Number),
          },
          per_reason: expect.any(Object),
          suppression: {
            same_reason_count: expect.any(Number),
            daily_cap_count: expect.any(Number),
          },
          teaching_first_violation_count: expect.any(Number),
        }),
      )
      expect(res.body.data.guidance).toHaveProperty('avg_delivery_delay_ms')
      expect(res.body.data.observability).toHaveProperty('render_log.required_fields')
      expect(res.body.data.observability).toHaveProperty('evaluation.blind_review_rubric')
      expect(res.body.data.observability).toHaveProperty('rollout_gates')
      expect(Array.isArray(res.body.data.observability.render_log_preview)).toBe(true)
      expect(res.body.data.agent_bio).toEqual(
        expect.objectContaining({
          counts: expect.objectContaining({
            attempted: expect.any(Number),
            committed: expect.any(Number),
            deduped: expect.any(Number),
            conflicts: expect.any(Number),
            privacy_blocked: expect.any(Number),
            errors: expect.any(Number),
          }),
          by_kind: expect.objectContaining({
            bootstrap: expect.any(Object),
            major: expect.any(Object),
            minor_presence: expect.any(Object),
          }),
        }),
      )
    } finally {
      featureFlags.runtimeFeaturesV1 = originalRuntimeFeatures
      featureFlags.guidanceRecallV1 = originalGuidanceRecall
    }
  })

  it('GET /v1/admin/launch/programming-ops returns the launch programming read model for admin', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalProgrammingOps = featureFlags.programmingOpsV1
    featureFlags.programmingOpsV1 = true

    try {
      const res = await request(app)
        .get('/v1/admin/launch/programming-ops')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.enabled).toBe(true)
      expect(res.body.data.dayparts).toHaveLength(4)
      expect(res.body.data.slots.length).toBeGreaterThan(0)
      expect(res.body.data.health).toHaveProperty('warnings')
      expect(res.body.data.governance_references).toHaveProperty('communities')
      expect(res.body.data).toHaveProperty('rollback_order')
      expect(res.body.data).toHaveProperty('drill_checklist')
    } finally {
      featureFlags.programmingOpsV1 = originalProgrammingOps
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

  it('POST /v1/admin/stage/season-rotate blocks non-dry-run in production-like deployments', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const runtimeConfig = config as unknown as { allowDevTools: boolean }
    const originalStageRotation = featureFlags.stageRotationV1
    const originalAllowDevTools = runtimeConfig.allowDevTools
    const prodAdminToken = jwt.sign(
      { userId: 'admin-prod', email: 'admin-prod@test.com', role: 'admin' },
      config.auth.jwtSecret,
    )
    featureFlags.stageRotationV1 = true
    runtimeConfig.allowDevTools = false

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
      runtimeConfig.allowDevTools = originalAllowDevTools
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

    const community = await createTestCommunity({
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

  it('POST /v1/admin/moderation/actions requires admin role', async () => {
    const res = await request(app)
      .post('/v1/admin/moderation/actions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ action: 'approve', target_type: 'post', target_id: 'p1' })
    expect(res.status).toBe(403)
  })

  it('POST /v1/admin/moderation/actions works for admin', async () => {
    const community = await createTestCommunity({
      name: 'Governance Action Community',
      slug: `governance-action-${Date.now()}`,
    })
    const createAgentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Governance Action Agent' })
    expect(createAgentRes.status).toBe(201)
    const agentId = createAgentRes.body.data.id as string

    const postRes = await servicePost('/v1/posts', {
      actor_agent_id: agentId,
      run_id: 'run-gov-1',
      community_id: community.id,
      title: 'Governance target',
      body: 'Content to moderate.',
    })
    expect(postRes.status).toBe(201)
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

  it('ChatService sendMessage writes MESSAGE_CREATED audit event', async () => {
    const createAgentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Chat Audit Agent' })
    expect(createAgentRes.status).toBe(201)
    const agentId = createAgentRes.body.data.id as string

    const now = Date.now()
    const room = await chatService.createRoom({
      name: `Audit Room ${now}`,
      slug: `audit-room-${now}`,
      description: 'audit room',
      community_id: null,
      created_by_agent_id: agentId,
    })

    const message = await chatService.sendMessage({
      room_id: room.room.id,
      author_id: agentId,
      body: 'message for audit event',
      message_kind: 'normal',
    })

    const event = eventRepo.findByIdempotencyKey(`message:${message.id}`)
    expect(event).toBeTruthy()
    expect(event?.event_type).toBe('MESSAGE_CREATED')
    expect(event?.plane).toBe('DATA')
    expect(event?.schema_version).toBe('v1')
    expect(event?.actor_type).toBe('agent')
    expect(event?.actor_id).toBe(agentId)
    expect(event?.room_id).toBe(room.room.id)
    expect(event?.correlation_id).toBe(`room:${room.room.id}`)
    expect(event?.payload_json).toMatchObject({
      message_id: message.id,
      room_id: room.room.id,
      author_agent_id: agentId,
      message_kind: 'normal',
    })
  })
})
