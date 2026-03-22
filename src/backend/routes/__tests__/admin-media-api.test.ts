import { describe, expect, it } from 'vitest'
import request from 'supertest'
import {
  VALID_PNG_BUFFER,
  adminToken,
  app,
  createTestCommunity,
  setupFeatureFlagGuard,
  userToken,
} from './e2e-helpers.js'
import {
  buildCommunityCommonsPoolSceneId,
  buildPlatformCanonicalPoolSceneId,
} from '../../media/media-reuse-governance-service.js'
import { config } from '../../lib/config.js'

setupFeatureFlagGuard()

describe('Admin media API', () => {
  it('registers canonical and commons assets, patches policies, and revokes them', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    featureFlags.multimodalAgentInclinationV1 = true

    const community = await createTestCommunity({
      name: 'Admin Media Community',
      slug: `admin-media-${Date.now()}`,
    })
    const createAgentRes = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ display_name: 'Admin Media Agent' })
    expect(createAgentRes.status).toBe(201)
    const agentId = createAgentRes.body.data.id as string

    const uploadRes = await request(app)
      .post(`/v1/agents/${agentId}/inclination-asset/upload`)
      .set('Authorization', `Bearer ${userToken}`)
      .field('owner_note', '开放给后续公共治理复用')
      .attach('file', VALID_PNG_BUFFER, {
        filename: 'canonical-source.png',
        contentType: 'image/png',
      })
    expect(uploadRes.status).toBe(201)
    const assetId = uploadRes.body.data.asset_id as string

    const canonicalRes = await request(app)
      .post('/v1/admin/media/platform-canonical/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ asset_id: assetId })
    expect(canonicalRes.status).toBe(201)
    expect(canonicalRes.body.data.binding.scene_type).toBe('media_pool')
    expect(canonicalRes.body.data.binding.scene_id).toBe(buildPlatformCanonicalPoolSceneId())
    expect(canonicalRes.body.data.policy.source_kind).toBe('platform_canonical')

    const commonsRes = await request(app)
      .post(`/v1/admin/communities/${community.id}/media/commons/assets`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        asset_id: assetId,
        allow_quote_original: false,
      })
    expect(commonsRes.status).toBe(201)
    expect(commonsRes.body.data.binding.scene_id).toBe(buildCommunityCommonsPoolSceneId(community.id))
    expect(commonsRes.body.data.policy.allowed_reuse_modes).toEqual(['derive_new', 'reference_only'])

    const patchRes = await request(app)
      .patch(`/v1/admin/media/reuse-policies/${canonicalRes.body.data.policy.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        allowed_reuse_modes: ['derive_new', 'reference_only'],
        cross_agent_quote_allowed: false,
        status: 'blocked',
      })
    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data.allowed_reuse_modes).toEqual(['derive_new', 'reference_only'])
    expect(patchRes.body.data.cross_agent_quote_allowed).toBe(false)
    expect(patchRes.body.data.status).toBe('blocked')

    const revokeRes = await request(app)
      .post(`/v1/admin/media/reuse-policies/${commonsRes.body.data.policy.id}/revoke`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'manual revoke for governance review' })
    expect(revokeRes.status).toBe(200)
    expect(revokeRes.body.data.policy.status).toBe('revoked')
    expect(revokeRes.body.data.policy.revoked_reason).toBe('manual revoke for governance review')
  })
})
