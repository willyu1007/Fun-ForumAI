import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import {
  app,
  config,
  adminToken,
  userToken,
  user2Token,
  setupFeatureFlagGuard,
} from './e2e-helpers.js'
import { incubationService } from '../../container.js'

setupFeatureFlagGuard()

describe('E2E: Incubation Control Plane', () => {
  it('POST /v1/incubation/jobs/:jobId/grant rejects reviewer_user_id field', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
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
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
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
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalIncubation = featureFlags.incubationV1
    featureFlags.incubationV1 = true

    const grantSpy = vi.spyOn(incubationService, 'grantJob').mockResolvedValue({
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
      created_at: new Date(),
      updated_at: new Date(),
    })
    const reviewSpy = vi.spyOn(incubationService, 'reviewJob').mockResolvedValue({
      job: {
        id: 'job-1',
        post_id: 'post-1',
        community_id: 'community-1',
        proposer_agent_id: 'agent-1',
        status: 'PENDING',
        phase: 'AWAIT_GRANT',
        strict_publication: true,
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
        job_source: null,
        stage_spec_fallback: false,
        review_verdict: null,
        review_reason: null,
        reviewed_by_user_id: null,
        reviewed_at: null,
        published_post_id: null,
        published_at: null,
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
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalIncubation = featureFlags.incubationV1
    featureFlags.incubationV1 = true

    const ownerAgentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Incubation Owner Agent' })
    expect(ownerAgentRes.status).toBe(201)
    const proposerAgentId = ownerAgentRes.body.data.id as string

    const getJobSpy = vi.spyOn(incubationService, 'getJob').mockResolvedValue({
      job: {
        id: 'job-view-1',
        post_id: null,
        community_id: 'community-1',
        proposer_agent_id: proposerAgentId,
        status: 'PENDING',
        phase: 'AWAIT_GRANT',
        strict_publication: true,
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
        job_source: null,
        stage_spec_fallback: false,
        review_verdict: null,
        review_reason: null,
        reviewed_by_user_id: null,
        reviewed_at: null,
        published_post_id: null,
        published_at: null,
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
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalIncubation = featureFlags.incubationV1
    featureFlags.incubationV1 = true

    const ownerAgentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Incubation Owner Agent 2' })
    expect(ownerAgentRes.status).toBe(201)
    const proposerAgentId = ownerAgentRes.body.data.id as string

    const getJobSpy = vi.spyOn(incubationService, 'getJob').mockResolvedValue({
      job: {
        id: 'job-view-2',
        post_id: null,
        community_id: 'community-1',
        proposer_agent_id: proposerAgentId,
        status: 'PENDING',
        phase: 'AWAIT_GRANT',
        strict_publication: true,
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
        job_source: null,
        stage_spec_fallback: false,
        review_verdict: null,
        review_reason: null,
        reviewed_by_user_id: null,
        reviewed_at: null,
        published_post_id: null,
        published_at: null,
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
})
