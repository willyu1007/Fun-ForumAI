import { describe, expect, it } from 'vitest'
import request from 'supertest'
import {
  VALID_PNG_BUFFER,
  adminToken,
  app,
  createAgentViaApi,
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
  it('manages scene packs and prompt previews for admins', async () => {
    const forbiddenRes = await request(app)
      .get('/v1/admin/media/scene-packs')
      .set('Authorization', `Bearer ${userToken}`)
    expect(forbiddenRes.status).toBe(403)

    const listRes = await request(app)
      .get('/v1/admin/media/scene-packs')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(listRes.status).toBe(200)
    expect(listRes.body.data).toHaveLength(25)
    expect(listRes.body.data.every((pack: { active_version_record: unknown }) => pack.active_version_record)).toBe(true)

    const routeRes = await request(app)
      .post('/v1/admin/media/scene-packs/route-preview')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        text: 'travel itinerary scrapbook with map fragments, tickets, and day plan',
      })
    expect(routeRes.status).toBe(200)
    expect(routeRes.body.data.candidates[0].scene_id).toBe('itinerary_scrapbook_collage')

    const draftRes = await request(app)
      .post('/v1/admin/media/scene-packs/desktop_workflow_photo/versions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        prompt_system:
          'Photograph a realistic desktop workflow with documents, tools, visible work-in-progress evidence, and restrained lighting.',
      })
    expect(draftRes.status).toBe(201)
    expect(draftRes.body.data.status).toBe('draft')

    const activateRes = await request(app)
      .post(`/v1/admin/media/scene-packs/desktop_workflow_photo/versions/${draftRes.body.data.version}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect(activateRes.status).toBe(200)
    expect(activateRes.body.data.active_version).toBe(draftRes.body.data.version)
    expect(activateRes.body.data.versions.filter((version: { status: string }) => version.status === 'active')).toHaveLength(1)

    const compileRes = await request(app)
      .post('/v1/admin/media/scene-packs/compile-preview')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        scene_id: 'desktop_workflow_photo',
        text: 'debugging workflow on a desk with notebook and reference papers',
      })
    expect(compileRes.status).toBe(200)
    expect(compileRes.body.data.compiled_prompt.template_id).toBe('scene-pack-prompt-compiler')
    expect(compileRes.body.data.compiled_prompt.scene_pack_ref.scene_id).toBe('desktop_workflow_photo')
  })

  it('registers canonical and commons assets, patches policies, and revokes them', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    featureFlags.multimodalAgentMediaV1 = true

    const community = await createTestCommunity({
      name: 'Admin Media Community',
      slug: `admin-media-${Date.now()}`,
    })
    const { id: agentId } = await createAgentViaApi({
      displayName: 'Admin Media Agent',
      token: userToken,
    })

    const uploadRes = await request(app)
      .post(`/v1/agents/${agentId}/media/upload`)
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
    expect(canonicalRes.body.data.policy.allowed_reuse_modes).toEqual(['derive_new', 'reference_only'])
    expect(canonicalRes.body.data.policy.cross_agent_quote_allowed).toBe(false)

    const missingCommonsRes = await request(app)
      .post(`/v1/admin/communities/missing-community-${Date.now()}/media/commons/assets`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ asset_id: assetId })
    expect(missingCommonsRes.status).toBe(404)
    expect(missingCommonsRes.body.error.code).toBe('NOT_FOUND')

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

  it('exposes media observability, rollout control, and lifecycle operations', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    featureFlags.mediaObservabilityV1 = true
    featureFlags.mediaRolloutControllerV1 = true
    featureFlags.mediaLifecycleV1 = true

    const initialControllerRes = await request(app)
      .get('/v1/admin/media/rollout-controller')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(initialControllerRes.status).toBe(200)
    expect(initialControllerRes.body.data.effective_profile.mode).toBe('AUTO')

    const patchRes = await request(app)
      .patch('/v1/admin/media/rollout-controller')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        mode: 'MANUAL',
        threshold_delta: 0.15,
        allow_generation: false,
        generation_tier: 'none',
        sync_generation_ms_budget: 0,
        allow_private_runtime_projection: false,
        allow_private_inspired_generation: false,
        force_safe_mode: true,
        reason: 'admin test override',
      })
    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data.mode).toBe('MANUAL')

    const controllerRes = await request(app)
      .get('/v1/admin/media/rollout-controller')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(controllerRes.status).toBe(200)
    expect(controllerRes.body.data.active_override.id).toBeTruthy()
    expect(controllerRes.body.data.effective_profile.profile).toBe('manual')

    const observabilityRes = await request(app)
      .get('/v1/admin/media/observability')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(observabilityRes.status).toBe(200)
    expect(observabilityRes.body.data.metrics.root_post.attempted_7d).toBeTypeOf('number')
    expect(Array.isArray(observabilityRes.body.data.gates)).toBe(true)
    expect(observabilityRes.body.data.lifecycle_candidates).toEqual(expect.objectContaining({
      orphan_assets: expect.any(Number),
      expired_projections: expect.any(Number),
      snapshot_backfill_assets: expect.any(Number),
    }))

    const lifecycleRes = await request(app)
      .post('/v1/admin/media/lifecycle/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect(lifecycleRes.status).toBe(200)
    expect(lifecycleRes.body.data).toEqual(expect.objectContaining({
      archived_assets: expect.any(Number),
      deleted_projections: expect.any(Number),
      snapshot_backfill_attempted: expect.any(Number),
    }))

    const releaseRes = await request(app)
      .post(`/v1/admin/media/rollout-controller/${controllerRes.body.data.active_override.id}/release`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'admin test release' })
    expect(releaseRes.status).toBe(200)
    expect(releaseRes.body.data.status).toBe('released')
  })
})
