import { describe, expect, it } from 'vitest'
import request from 'supertest'
import {
  adminToken,
  app,
  setupFeatureFlagGuard,
  userToken,
} from './e2e-helpers.js'

setupFeatureFlagGuard()

describe('E2E: Community Proposal Control Plane', () => {
  it('supports submit -> list -> incubate -> lifecycle visibility -> event history', async () => {
    const submitRes = await request(app)
      .post('/v1/community-proposals')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: '灰测关系线',
        slug_candidate: `gray-relations-${Date.now()}`,
        description: '用灰度方式验证关系节目线。',
        premise_text: '先用白名单验证关系型节目入口是否成立。',
        target_audience: '首发测试观众',
        scene_types: ['ROUND_TABLE', 'TALK_SHOW'],
        proposed_community_family: 'creator_relationship',
        publication_review_profile_id: 'creator_strict_publication',
        launch_wave: 'incubation_wave_1',
        human_participation: {
          public_participation_mode: 'open_reply',
          audience_signal_ingestion: 'direct_read',
          agent_human_response_mode: 'direct_reply',
        },
      })
    expect(submitRes.status).toBe(201)
    const proposalId = submitRes.body.data.proposal.id as string
    expect(submitRes.body.data.proposal).toMatchObject({
      proposed_community_family: 'creator_relationship',
      publication_review_profile_id: 'creator_strict_publication',
      launch_wave: 'incubation_wave_1',
      public_participation_mode: 'open_reply',
      audience_signal_ingestion: 'direct_read',
      agent_human_response_mode: 'direct_reply',
    })

    const listRes = await request(app)
      .get('/v1/community-proposals')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(listRes.status).toBe(200)
    expect(listRes.body.data.some((item: { proposal: { id: string } }) => item.proposal.id === proposalId)).toBe(true)

    const incubateRes = await request(app)
      .post(`/v1/community-proposals/${proposalId}/actions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'incubate',
        incubation_visibility_mode: 'WHITELIST_ONLY',
      })
    expect(incubateRes.status).toBe(200)
    const incubatedCommunityId = incubateRes.body.data.community.id as string

    const publicCommunitiesRes = await request(app).get('/v1/communities?limit=50')
    expect(publicCommunitiesRes.status).toBe(200)
    expect(
      publicCommunitiesRes.body.data.some((item: { id: string }) => item.id === incubatedCommunityId),
    ).toBe(false)

    const adminCommunitiesRes = await request(app)
      .get('/v1/communities?limit=50')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(adminCommunitiesRes.status).toBe(200)
    expect(
      adminCommunitiesRes.body.data.some((item: { id: string }) => item.id === incubatedCommunityId),
    ).toBe(true)

    const eventsRes = await request(app)
      .get(`/v1/community-proposals/${proposalId}/events`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(eventsRes.status).toBe(200)
    expect(eventsRes.body.data.map((item: { event_type: string }) => item.event_type)).toEqual(
      expect.arrayContaining(['PROPOSAL_SUBMITTED', 'RECOMMENDATION_REFRESHED', 'ACTION_APPLIED']),
    )
  })
})
