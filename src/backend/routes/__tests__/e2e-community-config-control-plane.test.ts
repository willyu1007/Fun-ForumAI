import { describe, it, expect } from 'vitest'
import request from 'supertest'
import {
  app,
  config,
  servicePost,
  adminToken,
  userToken,
  setupFeatureFlagGuard,
  waitFor,
  createTestCommunity,
} from './e2e-helpers.js'
import { communityConfigScheduler } from '../../container.js'
import { DEFAULT_STAGE_SPEC_V1 } from '../../stage/index.js'

setupFeatureFlagGuard()

describe('E2E: Community Config Control Plane', () => {
  it('Control Plane config flow supports proposal -> validate -> approve -> apply -> history -> rollback', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const originalAftershow = featureFlags.aftershowV1
    const originalAudienceZone = featureFlags.audienceZoneV1
    featureFlags.aftershowV1 = true
    featureFlags.audienceZoneV1 = true

    try {
      const community = await createTestCommunity({
        name: 'Config Flow Community',
        slug: `config-flow-${Date.now()}`,
        rules_json: {
          stage_spec_v1: DEFAULT_STAGE_SPEC_V1,
        },
      })

      const proposalRes = await request(app)
        .post(`/v1/communities/${community.id}/config/proposals`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          patch: {
            stage_spec_v1: {
              aftershow: {
                mode: 'THRESHOLD',
                threshold: {
                  audience_comments: 1,
                  human_vote_score: 0,
                },
              },
            },
          },
          summary: 'Enable stronger aftershow threshold',
        })
      expect(proposalRes.status).toBe(201)
      const proposalId = proposalRes.body.data.id as string
      expect(proposalRes.body.data.patch_json).toEqual({
        stage_spec_v1: {
          aftershow: {
            mode: 'THRESHOLD',
            threshold: {
              audience_comments: 1,
              human_vote_score: 0,
            },
          },
        },
      })
      expect(proposalRes.body.data.risk_level).toBe('HIGH')

      const validateRes = await request(app)
        .post(`/v1/communities/${community.id}/config/proposals/${proposalId}/validate`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
      expect(validateRes.status).toBe(200)
      expect(Array.isArray(validateRes.body.data.validation_errors)).toBe(true)

      const blockedApply = await request(app)
        .post(`/v1/communities/${community.id}/config/apply`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ proposal_id: proposalId })
      expect(blockedApply.status).toBe(403)

      const approveRes = await request(app)
        .post(`/v1/communities/${community.id}/config/proposals/${proposalId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
      expect(approveRes.status).toBe(200)

      const applyRes = await request(app)
        .post(`/v1/communities/${community.id}/config/apply`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ proposal_id: proposalId })
      expect(applyRes.status).toBe(200)
      const versionId = applyRes.body.data.version.id as string

      const configRes = await request(app)
        .get(`/v1/communities/${community.id}/config`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(configRes.status).toBe(200)
      expect(configRes.body.data.rules_json.stage_spec_v1.aftershow).toMatchObject({
        mode: 'THRESHOLD',
        threshold: {
          audience_comments: 1,
          human_vote_score: 0,
        },
      })
      expect(configRes.body.data.rules_json).not.toHaveProperty('aftershow')

      const historyRes = await request(app)
        .get(`/v1/communities/${community.id}/config/history`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(historyRes.status).toBe(200)
      expect(Array.isArray(historyRes.body.data.versions)).toBe(true)
      expect(Array.isArray(historyRes.body.data.patches)).toBe(true)
      const appliedPatch = (
        historyRes.body.data.patches as Array<{
          id: string
          patch_json: Record<string, unknown>
        }>
      ).find((item) => item.id === proposalId)
      expect(appliedPatch?.patch_json).toEqual({
        stage_spec_v1: {
          aftershow: {
            mode: 'THRESHOLD',
            threshold: {
              audience_comments: 1,
              human_vote_score: 0,
            },
          },
        },
      })

      const createAgentRes = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: 'Config Flow Aftershow Agent' })
      expect(createAgentRes.status).toBe(201)
      const agentId = createAgentRes.body.data.id as string

      const postRes = await servicePost('/v1/posts', {
        actor_agent_id: agentId,
        run_id: `run-config-aftershow-${Date.now()}`,
        community_id: community.id,
        title: 'Config flow runtime target',
        body: 'aftershow runtime should observe normalized control-plane config',
      })
      expect(postRes.status).toBe(201)
      const postId = postRes.body.data.id as string

      const blockedAutoTriggerRes = await request(app)
        .post(`/v1/posts/${postId}/aftershow/trigger`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ mode: 'AUTO', force: false })
      expect(blockedAutoTriggerRes.status).toBe(201)
      expect(blockedAutoTriggerRes.body.data.run.status).toBe('SKIPPED')
      expect(blockedAutoTriggerRes.body.data.reason).toBe('threshold_not_met')
      expect(blockedAutoTriggerRes.body.data.audience_message_count).toBe(0)

      const audienceRes = await request(app)
        .post(`/v1/posts/${postId}/audience-messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ body: 'One audience message should now satisfy the aftershow threshold.' })
      expect(audienceRes.status).toBe(201)

      const autoTriggerRes = await request(app)
        .post(`/v1/posts/${postId}/aftershow/trigger`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ mode: 'AUTO', force: false })
      expect(autoTriggerRes.status).toBe(201)
      expect(autoTriggerRes.body.data.run.status).toBe('CREATED')
      expect(autoTriggerRes.body.data.reason).toBe('triggered')
      expect(autoTriggerRes.body.data.audience_message_count).toBe(1)

      const rollbackRes = await request(app)
        .post(`/v1/communities/${community.id}/config/rollback`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          version_id: versionId,
          reason: 'rollback rehearsal',
        })
      expect(rollbackRes.status).toBe(201)
      expect(rollbackRes.body.data.rollback_from_version_id).toBe(versionId)

      const removedProposalRoute = await request(app)
        .post(`/v1/communities/${community.id}/config-proposals`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          patch: {
            moderation: {
              premod_required: true,
            },
          },
        })
      expect(removedProposalRoute.status).toBe(404)
    } finally {
      featureFlags.aftershowV1 = originalAftershow
      featureFlags.audienceZoneV1 = originalAudienceZone
    }
  })

  it('Control Plane config rejects allocator configs where thread_max_agents exceeds community_max_agents', async () => {
    const community = await createTestCommunity({
      name: 'Allocator Guard Community',
      slug: `allocator-guard-${Date.now()}`,
      rules_json: {
        stage_spec_v1: DEFAULT_STAGE_SPEC_V1,
      },
    })

    const proposalRes = await request(app)
      .post(`/v1/communities/${community.id}/config/proposals`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        patch: {
          stage_spec_v1: {
            allocator: {
              community_max_agents: 1,
              thread_max_agents: 10,
            },
          },
        },
      })
    expect(proposalRes.status).toBe(201)

    const proposalId = proposalRes.body.data.id as string
    const validateRes = await request(app)
      .post(`/v1/communities/${community.id}/config/proposals/${proposalId}/validate`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({})

    expect(validateRes.status).toBe(200)
    expect(validateRes.body.data.patch.status).toBe('REJECTED')
    expect(validateRes.body.data.validation_errors).toContain(
      'stage_spec_v1.allocator.thread_max_agents must be <= stage_spec_v1.allocator.community_max_agents',
    )
  })

  it('Control Plane config keeps audience raw-read changes behind admin approval and admin apply', async () => {
    const community = await createTestCommunity({
      name: 'Audience Raw Read Guard Community',
      slug: `audience-raw-read-${Date.now()}`,
      rules_json: {
        stage_spec_v1: DEFAULT_STAGE_SPEC_V1,
      },
    })

    const proposalRes = await request(app)
      .post(`/v1/communities/${community.id}/config/proposals`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        patch: {
          stage_spec_v1: {
            human_participation: {
              agent_reads_audience_zone: true,
            },
          },
        },
        risk_level: 'LOW',
      })
    expect(proposalRes.status).toBe(201)
    expect(proposalRes.body.data.risk_level).toBe('HIGH')
    const proposalId = proposalRes.body.data.id as string

    const validateRes = await request(app)
      .post(`/v1/communities/${community.id}/config/proposals/${proposalId}/validate`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({})
    expect(validateRes.status).toBe(200)
    expect(validateRes.body.data.patch.status).toBe('VALIDATED')
    expect(validateRes.body.data.patch.risk_level).toBe('HIGH')

    const blockedBeforeApprove = await request(app)
      .post(`/v1/communities/${community.id}/config/apply`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ proposal_id: proposalId })
    expect(blockedBeforeApprove.status).toBe(403)

    const approveRes = await request(app)
      .post(`/v1/communities/${community.id}/config/proposals/${proposalId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect(approveRes.status).toBe(200)

    const blockedUserApply = await request(app)
      .post(`/v1/communities/${community.id}/config/apply`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ proposal_id: proposalId })
    expect(blockedUserApply.status).toBe(403)

    const adminApply = await request(app)
      .post(`/v1/communities/${community.id}/config/apply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ proposal_id: proposalId })
    expect(adminApply.status).toBe(200)

    const configRes = await request(app)
      .get(`/v1/communities/${community.id}/config`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(configRes.status).toBe(200)
    expect(
      configRes.body.data.rules_json.stage_spec_v1.human_participation.agent_reads_audience_zone,
    ).toBe(true)
  })

  it('Control Plane config apply rejects non-admin callers even for validated low-risk patch', async () => {
    const community = await createTestCommunity({
      name: 'Config Low Risk Apply Permission Guard',
      slug: `config-low-risk-apply-${Date.now()}`,
      rules_json: {
        stage_spec_v1: DEFAULT_STAGE_SPEC_V1,
      },
    })

    const proposalRes = await request(app)
      .post(`/v1/communities/${community.id}/config/proposals`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        patch: {
          custom_runtime_toggle: {
            enabled: true,
          },
        },
      })
    expect(proposalRes.status).toBe(201)
    expect(proposalRes.body.data.risk_level).toBe('LOW')
    const proposalId = proposalRes.body.data.id as string

    const validateRes = await request(app)
      .post(`/v1/communities/${community.id}/config/proposals/${proposalId}/validate`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({})
    expect(validateRes.status).toBe(200)
    expect(validateRes.body.data.patch.status).toBe('VALIDATED')

    const blockedUserApply = await request(app)
      .post(`/v1/communities/${community.id}/config/apply`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ proposal_id: proposalId })
    expect(blockedUserApply.status).toBe(403)

    const adminApply = await request(app)
      .post(`/v1/communities/${community.id}/config/apply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ proposal_id: proposalId })
    expect(adminApply.status).toBe(200)
    expect(adminApply.body.data.patch.status).toBe('APPLIED')
    expect(adminApply.body.data.version).toBeTruthy()
  })

  it('Control Plane config rejects cross-community proposal operations', async () => {
    const communityA = await createTestCommunity({
      name: 'Config Ownership Community A',
      slug: `config-ownership-a-${Date.now()}`,
    })
    const communityB = await createTestCommunity({
      name: 'Config Ownership Community B',
      slug: `config-ownership-b-${Date.now()}`,
    })

    const proposalRes = await request(app)
      .post(`/v1/communities/${communityA.id}/config/proposals`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        patch: {
          stage_spec_v1: {
            moderation: {
              premod_required: true,
            },
          },
        },
      })
    expect(proposalRes.status).toBe(201)
    const proposalId = proposalRes.body.data.id as string

    const validateOnWrongCommunity = await request(app)
      .post(`/v1/communities/${communityB.id}/config/proposals/${proposalId}/validate`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({})
    expect(validateOnWrongCommunity.status).toBe(404)

    const approveOnWrongCommunity = await request(app)
      .post(`/v1/communities/${communityB.id}/config/proposals/${proposalId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect(approveOnWrongCommunity.status).toBe(404)

    const applyOnWrongCommunity = await request(app)
      .post(`/v1/communities/${communityB.id}/config/apply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ proposal_id: proposalId })
    expect(applyOnWrongCommunity.status).toBe(404)
  })

  it('Control Plane config enforces proposal status transitions', async () => {
    const community = await createTestCommunity({
      name: 'Config Status Guard Community',
      slug: `config-status-guard-${Date.now()}`,
      rules_json: {
        stage_spec_v1: DEFAULT_STAGE_SPEC_V1,
      },
    })

    const proposalRes = await request(app)
      .post(`/v1/communities/${community.id}/config/proposals`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        patch: {
          stage_spec_v1: {
            moderation: {
              premod_required: true,
            },
          },
        },
      })
    expect(proposalRes.status).toBe(201)
    const proposalId = proposalRes.body.data.id as string

    const approveWithoutValidate = await request(app)
      .post(`/v1/communities/${community.id}/config/proposals/${proposalId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect(approveWithoutValidate.status).toBe(400)

    const validateRes = await request(app)
      .post(`/v1/communities/${community.id}/config/proposals/${proposalId}/validate`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({})
    expect(validateRes.status).toBe(200)
    expect(validateRes.body.data.patch.status).toBe('VALIDATED')

    const rejectRes = await request(app)
      .post(`/v1/communities/${community.id}/config/proposals/${proposalId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'manual reject after validate' })
    expect(rejectRes.status).toBe(200)
    expect(rejectRes.body.data.status).toBe('REJECTED')

    const validateAfterReject = await request(app)
      .post(`/v1/communities/${community.id}/config/proposals/${proposalId}/validate`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({})
    expect(validateAfterReject.status).toBe(400)

    const approveAfterReject = await request(app)
      .post(`/v1/communities/${community.id}/config/proposals/${proposalId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect(approveAfterReject.status).toBe(400)
  })

  it('Control Plane config apply supports SCHEDULED auto-activation by scheduler', async () => {
    communityConfigScheduler?.stop()
    communityConfigScheduler?.start()

    const community = await createTestCommunity({
      name: 'Config Schedule Community',
      slug: `config-schedule-${Date.now()}`,
      rules_json: {
        stage_spec_v1: DEFAULT_STAGE_SPEC_V1,
      },
    })

    const proposalRes = await request(app)
      .post(`/v1/communities/${community.id}/config/proposals`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        patch: {
          stage_spec_v1: {
            moderation: {
              thresholds: {
                low_max_score: 0.25,
                medium_max_score: 0.6,
                auto_reject_score: 0.9,
              },
            },
          },
        },
        summary: 'Schedule a high-risk config apply',
      })
    expect(proposalRes.status).toBe(201)
    const proposalId = proposalRes.body.data.id as string

    const validateRes = await request(app)
      .post(`/v1/communities/${community.id}/config/proposals/${proposalId}/validate`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({})
    expect(validateRes.status).toBe(200)
    expect(['VALIDATED', 'REJECTED']).toContain(validateRes.body.data.patch.status)

    const approveRes = await request(app)
      .post(`/v1/communities/${community.id}/config/proposals/${proposalId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect(approveRes.status).toBe(200)

    const effectiveAt = new Date(Date.now() + 1500).toISOString()
    const scheduleRes = await request(app)
      .post(`/v1/communities/${community.id}/config/apply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        proposal_id: proposalId,
        effective_at: effectiveAt,
      })
    expect(scheduleRes.status).toBe(200)
    expect(scheduleRes.body.data.patch.status).toBe('SCHEDULED')
    expect(scheduleRes.body.data.version).toBeNull()

    const history = await waitFor(
      async () =>
        request(app)
          .get(`/v1/communities/${community.id}/config/history`)
          .set('Authorization', `Bearer ${adminToken}`),
      {
        timeoutMs: 12_000,
        intervalMs: 300,
        pass: (res) => {
          const patches = res.body?.data?.patches as
            | Array<{ id: string; status: string }>
            | undefined
          const target = patches?.find((item) => item.id === proposalId)
          return target?.status === 'APPLIED'
        },
      },
    )

    const appliedPatch = (
      history.body.data.patches as Array<{ id: string; status: string }>
    ).find((item) => item.id === proposalId)
    expect(appliedPatch?.status).toBe('APPLIED')

    const activeVersion = (
      history.body.data.versions as Array<{ status: string; source_patch_id: string | null }>
    ).find((item) => item.status === 'ACTIVE' && item.source_patch_id === proposalId)
    expect(activeVersion).toBeTruthy()
  }, 20_000)
})
