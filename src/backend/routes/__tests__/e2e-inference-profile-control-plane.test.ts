import { describe, it, expect } from 'vitest'
import request from 'supertest'
import {
  app,
  adminToken,
  userToken,
  setupFeatureFlagGuard,
  waitFor,
} from './e2e-helpers.js'
import {
  inferenceProfileService,
  usageLedgerRepo,
  xpService,
} from '../../container.js'

setupFeatureFlagGuard()

describe('E2E: Inference Profile Control Plane', () => {
  it('PATCH /v1/agents/:agentId/inference-profile can collect shadow review evidence for admin', async () => {
    const createRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        display_name: 'Shadow Review Bot',
        persona_seed_code: 'philosopher',
      })
    expect(createRes.status).toBe(201)
    const agentId = createRes.body.data.id as string

    const testDeps = (
      inferenceProfileService as unknown as {
        deps: {
          statsRepo: {
            getOrCreateStats(agentId: string): Promise<{
              version: number
              unspent_points: number
              granted_points_total: number
            }>
            saveStats(input: {
              agent_id: string
              expected_version: number
              unspent_points: number
              granted_points_total: number
              sociability: number
              curiosity: number
              assertiveness: number
              empathy: number
              brashness: number
              cynicism: number
              stubbornness: number
              volatility: number
              memory: number
              learning: number
            }): Promise<unknown>
          }
          personaStateRepo: {
            saveState(input: {
              agent_id: string
              current_vector_json: Record<string, unknown>
              anchor_vector_json: Record<string, unknown>
              maturity: string
              confidence: number
              drift_score: number
              last_render_decision_json: Record<string, unknown> | null
            }): Promise<unknown>
          }
        }
      }
    ).deps

    const currentStats = await testDeps.statsRepo.getOrCreateStats(agentId)
    await testDeps.statsRepo.saveStats({
      agent_id: agentId,
      expected_version: currentStats.version,
      unspent_points: currentStats.unspent_points,
      granted_points_total: currentStats.granted_points_total,
      sociability: 0,
      curiosity: 20,
      assertiveness: 0,
      empathy: 0,
      brashness: 0,
      cynicism: 0,
      stubbornness: 0,
      volatility: 0,
      memory: 100,
      learning: 100,
    })

    await testDeps.personaStateRepo.saveState({
      agent_id: agentId,
      current_vector_json: {
        warmth: 10,
        sharpness: 20,
        expressiveness: 10,
        theatricality: 5,
        rigor: 95,
        spontaneity: 15,
        curiosity: 95,
        assertiveness: 10,
        sensitivity: 40,
        stability: 50,
      },
      anchor_vector_json: {
        warmth: 45,
        sharpness: 40,
        expressiveness: 35,
        theatricality: 20,
        rigor: 80,
        spontaneity: 25,
        curiosity: 85,
        assertiveness: 30,
        sensitivity: 55,
        stability: 85,
      },
      maturity: 'forming',
      confidence: 0.72,
      drift_score: 12,
      last_render_decision_json: null,
    })

    await xpService?.awardXP(agentId, 'bootstrap_grant', 500, {
      dedup_key: `shadow-review-bootstrap:${agentId}`,
    })

    const shadowDebug = await waitFor(
      async () => {
        await inferenceProfileService.resolveVisibleRoute({
          agentId,
          requestedTier: 'base',
        })
        return inferenceProfileService.getDebug(agentId)
      },
      {
        timeoutMs: 1500,
        intervalMs: 40,
        pass: (value) => value.profile.migrationState === 'shadow',
      },
    )

    expect(shadowDebug.profile.challengerVoiceLineId).toBe('kimi-deep-v1')

    const startRes = await request(app)
      .patch(`/v1/agents/${agentId}/inference-profile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'start_shadow_review',
      })

    expect(startRes.status).toBe(200)
    expect(startRes.body.meta.shadow_review.status).toBe('running')

    const debugProfileAfterStart = await request(app)
      .get(`/v1/agents/${agentId}/profile`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(debugProfileAfterStart.status).toBe(200)
    expect(debugProfileAfterStart.body.data.inference_profile_debug.shadowReview.status).toBe(
      'running',
    )
    expect(
      debugProfileAfterStart.body.data.inference_profile_debug.shadowReview
        .challengerVoiceLineId,
    ).toBe('kimi-deep-v1')

    for (let index = 0; index < 3; index += 1) {
      await usageLedgerRepo.insert({
        trace_id: `shadow-review-${Date.now()}-${index}`,
        agent_id: agentId,
        intent: 'proactive_opening',
        visibility: 'visible',
        scene: 'proactive_dm',
        prompt_ref: { id: 'agent-proactive-dm-opening', version: 1 },
        render_decision: {
          voiceLineId: 'qwen-social-v1',
          tier: 'base',
          profileId: 'qwen-social-proactive-opening-base',
          providerId: 'dashscope-openai',
          modelId: 'qwen-plus-character',
          region: 'cn-beijing',
          endpointId: 'dashscope-cn-beijing',
          fallbackLevel: 'none',
          reasons: ['initial_profile_resolution'],
          promptTemplateId: 'agent-proactive-dm-opening',
          promptVersion: 1,
        },
        usage: { prompt_tokens: 18, completion_tokens: 9, total_tokens: 27 },
        success: true,
        provider_id: 'dashscope-openai',
        model_id: 'qwen-plus-character',
        profile_id: 'qwen-social-proactive-opening-base',
        billing_class: 'visible_standard',
        estimated_cost_cny: 0.01,
        reserved_cost_cny: 0.01,
        actual_cost_cny: 0.0008,
        latency_ms: 15,
        created_at: new Date().toISOString(),
      })
    }

    const res = await request(app)
      .patch(`/v1/agents/${agentId}/inference-profile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'collect_shadow_review',
      })

    expect(res.status).toBe(200)
    expect(res.body.meta.shadow_review.status).toBe('collected')
    expect(res.body.meta.shadow_review.summary.recommendation).toBe('approve')

    const debugProfileAfterCollect = await request(app)
      .get(`/v1/agents/${agentId}/profile`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(debugProfileAfterCollect.status).toBe(200)
    expect(debugProfileAfterCollect.body.data.inference_profile_debug.shadowReview.status).toBe(
      'collected',
    )
    expect(
      debugProfileAfterCollect.body.data.inference_profile_debug.shadowReview.summary
        .recommendation,
    ).toBe('approve')

    const approveRes = await request(app)
      .patch(`/v1/agents/${agentId}/inference-profile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'approve_shadow',
      })

    expect(approveRes.status).toBe(200)
    expect(approveRes.body.data.migrationState).toBe('stable')

    const profileRes = await request(app).get(`/v1/agents/${agentId}/profile`)
    expect(profileRes.status).toBe(200)
    expect(profileRes.body.data.home_voice_line_id).toBe('kimi-deep-v1')
  })

  it('PATCH /v1/agents/:agentId/inference-profile returns 400 for invalid transition', async () => {
    const createRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Shadow Invalid Transition Bot' })
    const agentId = createRes.body.data.id as string

    const res = await request(app)
      .patch(`/v1/agents/${agentId}/inference-profile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'approve_shadow',
      })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})
