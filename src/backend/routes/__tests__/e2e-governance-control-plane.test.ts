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
  createAgentViaApi,
  setupFeatureFlagGuard,
  createTestCommunity,
  withFeatureFlags,
} from './e2e-helpers.js'
import {
  chatService,
  eventRepo,
} from '../../container.js'

setupFeatureFlagGuard()

describe('E2E: Governance Control Plane', () => {
  it('GET /v1/admin/runtime/stats returns runtime authority and identity gate state for admin', async () => {
    const res = await request(app)
      .get('/v1/admin/runtime/stats')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.runtime.routing_mode).toBe('policy_driven')
    expect(res.body.data.runtime.authority_state).toEqual(
      expect.objectContaining({
        routing_mode: 'policy_driven',
        env_pins: expect.any(Array),
        env_pins_present: expect.any(Boolean),
        debug_signal_sources: expect.any(Array),
        debug_signals_present: expect.any(Boolean),
      }),
    )
    expect(res.body.data.runtime.identity_gate).toEqual(
      expect.objectContaining({
        app_env: expect.any(String),
        configured_staging_mode: expect.stringMatching(/^(enforced|admin_bypass)$/),
        effective_mode: expect.stringMatching(/^(enforced|staging_admin_bypass)$/),
        bypass_scope: expect.stringMatching(/^(none|admin_users)$/),
        bypass_active: expect.any(Boolean),
        gated_operations: [
          'private_session_create',
          'private_message_send',
          'proactive_receive',
        ],
      }),
    )
    expect(res.body.data.runtime.baseline_admission).toEqual(
      expect.objectContaining({
        has_active_baseline: expect.any(Boolean),
        kickoff_layer_ready: expect.any(Boolean),
        warmup_layer_ready: expect.any(Boolean),
        key_communities_ready: expect.any(Boolean),
        key_shelves_ready: expect.any(Boolean),
        media_access_ok: expect.any(Boolean),
        last_review_decision_ok: expect.any(Boolean),
        worker_health_ok: expect.any(Boolean),
        llm_credentials_ok: expect.any(Boolean),
        allow_public_growth: expect.any(Boolean),
        reasons: expect.any(Array),
      }),
    )
  })

  it('GET /v1/admin/runtime/features returns feature snapshot for admin', async () => {
    await withFeatureFlags({
      runtimeFeaturesV1: true,
      guidanceRecallV1: true,
    }, async () => {
      const res = await request(app)
        .get('/v1/admin/runtime/features')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(typeof res.body.data.launch_capabilities).toBe('object')
      expect(res.body.data.launch_capabilities).toEqual(
        expect.objectContaining({
          runtimeFeaturesV1: true,
          guidanceRecallV1: true,
        }),
      )
      expect(typeof res.body.data.counters).toBe('object')
      expect(res.body.data.counters).toHaveProperty('allocator.ppr_hits')
      expect(res.body.data.counters).toHaveProperty('director.selected_core')
      expect(res.body.data.counters).toHaveProperty('prompt.trim_applied_calls')
      expect(typeof res.body.data.runtime.build).toBe('object')
      expect(typeof res.body.data.runtime.build.code_fingerprint).toBe('string')
      expect(Array.isArray(res.body.data.runtime.build.fingerprint_basis)).toBe(true)
      expect(res.body.data.runtime.routing_mode).toBe('policy_driven')
      expect(res.body.data.runtime.identity_gate).toEqual(
        expect.objectContaining({
          app_env: expect.any(String),
          configured_staging_mode: expect.stringMatching(/^(enforced|admin_bypass)$/),
          effective_mode: expect.stringMatching(/^(enforced|staging_admin_bypass)$/),
          bypass_scope: expect.stringMatching(/^(none|admin_users)$/),
          bypass_active: expect.any(Boolean),
          gated_operations: [
            'private_session_create',
            'private_message_send',
            'proactive_receive',
          ],
        }),
      )
      expect(res.body.data.runtime.persona_runtime).toEqual(
        expect.objectContaining({
          enabled: expect.any(Boolean),
          scenes: expect.any(Array),
          writeback_enabled: expect.any(Boolean),
        }),
      )
      expect(res.body.data.runtime.forum_orchestration).toEqual(
        expect.objectContaining({
          shadow: expect.any(Boolean),
          selection_cutover: expect.any(Boolean),
          envelope_cutover: expect.any(Boolean),
          fallback_counters: expect.any(Object),
          no_write_counters: expect.any(Object),
          selection_path_counts: expect.any(Object),
          recent_fallback_samples: expect.any(Array),
          recent_no_write_samples: expect.any(Array),
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
      expect(Array.isArray(res.body.data.observability.execution_plan_preview)).toBe(true)
      expect(res.body.data.observability).toHaveProperty('fallback_or_degraded_preview.total')
      expect(res.body.data.observability).toHaveProperty('attribution_summary.by_callsite')
      expect(res.body.data.observability.authority_state).toEqual(
        expect.objectContaining({
          routing_mode: 'policy_driven',
          env_pins: expect.any(Array),
          env_pins_present: expect.any(Boolean),
          debug_signal_sources: expect.any(Array),
          debug_signals_present: expect.any(Boolean),
        }),
      )
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
    })
  })

  it('POST/GET runtime closeout hidden-worker fixture create and inspect a stale private session', async () => {
    const { id: agentId } = await createAgentViaApi({
      displayName: 'Runtime Closeout Fixture Agent',
      token: userToken,
    })

    const createFixtureRes = await request(app)
      .post('/v1/admin/runtime/closeout/hidden-worker/private-session-fixture')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ agent_id: agentId, message_count: 4, stale_minutes: 35 })

    if (!config.db.usePrisma) {
      expect(createFixtureRes.status).toBe(503)
      expect(createFixtureRes.body.error.code).toBe('SERVICE_UNAVAILABLE')
      return
    }

    expect(createFixtureRes.status).toBe(201)
    expect(createFixtureRes.body.data.agent_id).toBe(agentId)
    expect(createFixtureRes.body.data.digest_status).toBe('PENDING')
    expect(createFixtureRes.body.data.message_count).toBe(4)
    expect(createFixtureRes.body.data.trace_ids).toEqual(
      expect.objectContaining({
        extract_trace_id: expect.any(String),
        distill_trace_id: expect.any(String),
        identity_trace_id: expect.any(String),
      }),
    )

    const inspectRes = await request(app)
      .get(`/v1/admin/runtime/closeout/hidden-worker/private-session-fixture/${createFixtureRes.body.data.session_id}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(inspectRes.status).toBe(200)
    expect(inspectRes.body.data.session_id).toBe(createFixtureRes.body.data.session_id)
    expect(inspectRes.body.data.message_count).toBe(4)
    expect(inspectRes.body.data.ledger.extract).toEqual([])
    expect(inspectRes.body.data.ledger.distill).toEqual([])
    expect(inspectRes.body.data.ledger.identity).toEqual([])
  })

  it('runtime closeout hidden-worker fixture backdates dense sessions beyond the timeout threshold', async () => {
    const { id: agentId } = await createAgentViaApi({
      displayName: 'Runtime Closeout Dense Fixture Agent',
      token: user2Token,
    })

    const createFixtureRes = await request(app)
      .post('/v1/admin/runtime/closeout/hidden-worker/private-session-fixture')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ agent_id: agentId, message_count: 10, stale_minutes: 35 })

    if (!config.db.usePrisma) {
      expect(createFixtureRes.status).toBe(503)
      expect(createFixtureRes.body.error.code).toBe('SERVICE_UNAVAILABLE')
      return
    }

    expect(createFixtureRes.status).toBe(201)
    expect(createFixtureRes.body.data.minimum_stale_minutes).toBeGreaterThan(35)
    const timeoutThresholdMs = createFixtureRes.body.data.timeout_threshold_ms as number
    const startedAtMs = Date.parse(createFixtureRes.body.data.started_at as string)
    const lastMessageCreatedAtMs = Date.parse(
      createFixtureRes.body.data.messages.at(-1).created_at as string,
    )

    expect(Date.now() - startedAtMs).toBeGreaterThan(timeoutThresholdMs)
    expect(Date.now() - lastMessageCreatedAtMs).toBeGreaterThanOrEqual(timeoutThresholdMs)
  })

  it('GET /v1/admin/launch/programming-ops returns the launch programming read model for admin', async () => {
    await withFeatureFlags({ programmingOpsV1: true }, async () => {
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
    })
  })

  it('POST /v1/admin/stage/season-rotate requires admin role', async () => {
    const res = await request(app)
      .post('/v1/admin/stage/season-rotate')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ open_count: 3, dry_run: true })
    expect(res.status).toBe(403)
  })

  it('POST /v1/admin/stage/season-rotate supports dry_run for admin', async () => {
    await withFeatureFlags({ stageRotationV1: true }, async () => {
      const res = await request(app)
        .post('/v1/admin/stage/season-rotate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ open_count: 3, dry_run: true })
      expect(res.status).toBe(200)
      expect(res.body.data.open_count).toBe(3)
      expect(res.body.data.dry_run).toBe(true)
      expect(Array.isArray(res.body.data.activated)).toBe(true)
      expect(Array.isArray(res.body.data.replaced)).toBe(true)
    })
  })

  it('POST /v1/admin/stage/season-rotate blocks non-dry-run in production-like deployments', async () => {
    const runtimeConfig = config as unknown as { allowDevTools: boolean }
    const originalAllowDevTools = runtimeConfig.allowDevTools
    const prodAdminToken = jwt.sign(
      { userId: 'admin-prod', email: 'admin-prod@test.com', role: 'admin' },
      config.auth.jwtSecret,
    )
    runtimeConfig.allowDevTools = false

    try {
      await withFeatureFlags({ stageRotationV1: true }, async () => {
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
      })
    } finally {
      runtimeConfig.allowDevTools = originalAllowDevTools
    }
  })

  it('POST /v1/posts/:postId/aftershow/trigger allows only admin or agent owner in manual mode', async () => {
    await withFeatureFlags({ aftershowV1: true }, async () => {
      const { id: ownerAgentId } = await createAgentViaApi({
        displayName: 'Aftershow Owner Agent',
        token: userToken,
      })

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
    })
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
    const { id: agentId } = await createAgentViaApi({
      displayName: 'Governance Action Agent',
      token: userToken,
    })

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
    const { id: agentId } = await createAgentViaApi({
      displayName: 'Chat Audit Agent',
      token: userToken,
    })

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
