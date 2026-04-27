import { afterEach, describe, expect, it, vi } from 'vitest'
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
import { mediaAssetService } from '../../container.js'

setupFeatureFlagGuard()

afterEach(() => {
  vi.restoreAllMocks()
})
function stubRemoteIngest(): void {
  vi.spyOn(mediaAssetService, 'ingestManagedRemoteAsset').mockImplementation(
    async (input) => mediaAssetService.ingestManagedAsset({
      owner_user_id: input.owner_user_id ?? null,
      steward_agent_id: input.steward_agent_id ?? null,
      source_kind: input.source_kind,
      origin_url: input.source_url,
      mime_type: 'image/png',
      bytes: VALID_PNG_BUFFER,
      visibility_policy: input.visibility_policy,
      lifecycle_status: input.lifecycle_status,
    }),
  )
}

function uniqueSlug(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

describe('Admin media import routes (T-302)', () => {
  describe('auth gates', () => {
    it('rejects unauthenticated upload', async () => {
      const res = await request(app)
        .post('/v1/admin/media/platform-canonical/imports/upload')
        .attach('file', VALID_PNG_BUFFER, { filename: 'test.png', contentType: 'image/png' })
      expect(res.status).toBe(401)
    })

    it('rejects non-admin user on URL import', async () => {
      const res = await request(app)
        .post('/v1/admin/media/platform-canonical/imports/url')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ source_url: 'https://example.com/image.png' })
      expect(res.status).toBe(403)
    })

    it('rejects non-admin user on list', async () => {
      const res = await request(app)
        .get('/v1/admin/media/platform-canonical/assets')
        .set('Authorization', `Bearer ${userToken}`)
      expect(res.status).toBe(403)
    })
  })

  describe('platform canonical upload', () => {
    it('imports an asset, registers platform_canonical:global, and returns the unified DTO', async () => {
      const res = await request(app)
        .post('/v1/admin/media/platform-canonical/imports/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', VALID_PNG_BUFFER, { filename: 'platform.png', contentType: 'image/png' })

      expect(res.status).toBe(201)
      expect(res.body.data.asset.asset_id).toBeTruthy()
      expect(res.body.data.asset.source_kind).toBe('platform_canonical')
      expect(res.body.data.asset.media_url).toMatch(/^\/v1\/media\/local\//)
      expect(res.body.data.pool_binding.scene_type).toBe('media_pool')
      expect(res.body.data.pool_binding.scene_id).toBe(buildPlatformCanonicalPoolSceneId())
      expect(res.body.data.reuse_policy.allowed_reuse_modes).not.toContain('quote_original')
      expect(res.body.data.reuse_policy.cross_agent_quote_allowed).toBe(false)
      expect(res.body.data.retrieval.status).toMatch(/^(ready|pending|failed)$/)
      expect(typeof res.body.data.usage_summary.total_binding_count).toBe('number')
    })

    it('rejects upload without a file', async () => {
      const res = await request(app)
        .post('/v1/admin/media/platform-canonical/imports/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('allow_quote_original', 'false')
      expect(res.status).toBe(400)
    })

    it('rejects upload with unsupported MIME', async () => {
      const res = await request(app)
        .post('/v1/admin/media/platform-canonical/imports/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('not an image'), {
          filename: 'doc.pdf',
          contentType: 'application/pdf',
        })
      expect(res.status).toBe(400)
    })

    it('rejects upload exceeding 10MB', async () => {
      const oversized = Buffer.alloc(11 * 1024 * 1024)
      VALID_PNG_BUFFER.copy(oversized)
      const res = await request(app)
        .post('/v1/admin/media/platform-canonical/imports/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', oversized, { filename: 'big.png', contentType: 'image/png' })
      expect(res.status).toBe(400)
    })

    it('honors explicit allow_quote_original=true and includes quote_original mode', async () => {
      const res = await request(app)
        .post('/v1/admin/media/platform-canonical/imports/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('allow_quote_original', 'true')
        .attach('file', VALID_PNG_BUFFER, { filename: 'platform-on.png', contentType: 'image/png' })
      expect(res.status).toBe(201)
      expect(res.body.data.reuse_policy.allowed_reuse_modes).toContain('quote_original')
      expect(res.body.data.reuse_policy.cross_agent_quote_allowed).toBe(true)
    })
  })

  describe('platform canonical URL import', () => {
    it('imports via HTTPS URL using stubbed remote ingest', async () => {
      stubRemoteIngest()
      const res = await request(app)
        .post('/v1/admin/media/platform-canonical/imports/url')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ source_url: 'https://cdn.example.com/platform.png' })
      expect(res.status).toBe(201)
      expect(res.body.data.pool_binding.scene_id).toBe(buildPlatformCanonicalPoolSceneId())
      expect(res.body.data.reuse_policy.allowed_reuse_modes).not.toContain('quote_original')
    })

    it('rejects URL import with non-HTTPS scheme at validation', async () => {
      const res = await request(app)
        .post('/v1/admin/media/platform-canonical/imports/url')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ source_url: 'http://example.com/x.png' })
      expect(res.status).toBe(400)
    })

    it('rejects URL import that targets a private-network host', async () => {
      const res = await request(app)
        .post('/v1/admin/media/platform-canonical/imports/url')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ source_url: 'https://127.0.0.1/internal.png' })
      expect(res.status).toBe(400)
    })
  })

  describe('platform canonical list', () => {
    it('returns DB-backed pool assets and lightweight usage summary', async () => {
      const importRes = await request(app)
        .post('/v1/admin/media/platform-canonical/imports/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', VALID_PNG_BUFFER, { filename: 'list-source.png', contentType: 'image/png' })
      expect(importRes.status).toBe(201)
      const importedAssetId = importRes.body.data.asset.asset_id as string

      const listRes = await request(app)
        .get('/v1/admin/media/platform-canonical/assets')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ limit: 10 })
      expect(listRes.status).toBe(200)
      expect(listRes.body.data.pool.scene_type).toBe('media_pool')
      expect(listRes.body.data.pool.scene_id).toBe(buildPlatformCanonicalPoolSceneId())
      expect(listRes.body.data.pool.community_id).toBeNull()
      expect(Array.isArray(listRes.body.data.items)).toBe(true)
      const found = listRes.body.data.items.find(
        (item: { asset: { asset_id: string } }) => item.asset.asset_id === importedAssetId,
      )
      expect(found).toBeDefined()
      expect(found.usage_summary).toEqual(
        expect.objectContaining({
          total_binding_count: expect.any(Number),
          public_display_count: expect.any(Number),
          scene_type_counts: expect.any(Object),
        }),
      )
      expect(found.retrieval.status).toMatch(/^(ready|pending|failed)$/)
    })
  })

  describe('community commons surface', () => {
    it('imports an asset into community_commons:<communityId> via upload', async () => {
      const community = await createTestCommunity({
        name: 'T-302 Upload Community',
        slug: uniqueSlug('t302-upload'),
      })
      const res = await request(app)
        .post(`/v1/admin/communities/${community.id}/media/commons/imports/upload`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', VALID_PNG_BUFFER, { filename: 'community.png', contentType: 'image/png' })
      expect(res.status).toBe(201)
      expect(res.body.data.pool_binding.scene_id).toBe(buildCommunityCommonsPoolSceneId(community.id))
      expect(res.body.data.reuse_policy.allowed_reuse_modes).not.toContain('quote_original')
    })

    it('imports an asset into community_commons:<communityId> via stubbed URL import', async () => {
      stubRemoteIngest()
      const community = await createTestCommunity({
        name: 'T-302 URL Community',
        slug: uniqueSlug('t302-url'),
      })
      const res = await request(app)
        .post(`/v1/admin/communities/${community.id}/media/commons/imports/url`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          source_url: 'https://cdn.example.com/community.png',
          allow_quote_original: true,
        })
      expect(res.status).toBe(201)
      expect(res.body.data.pool_binding.scene_id).toBe(buildCommunityCommonsPoolSceneId(community.id))
      expect(res.body.data.reuse_policy.allowed_reuse_modes).toContain('quote_original')
    })

    it('lists assets scoped to one community pool', async () => {
      const community = await createTestCommunity({
        name: 'T-302 List Community',
        slug: uniqueSlug('t302-list'),
      })
      const importRes = await request(app)
        .post(`/v1/admin/communities/${community.id}/media/commons/imports/upload`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', VALID_PNG_BUFFER, { filename: 'community-list.png', contentType: 'image/png' })
      expect(importRes.status).toBe(201)
      const assetId = importRes.body.data.asset.asset_id as string

      const listRes = await request(app)
        .get(`/v1/admin/communities/${community.id}/media/commons/assets`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(listRes.status).toBe(200)
      expect(listRes.body.data.pool.scene_id).toBe(buildCommunityCommonsPoolSceneId(community.id))
      expect(listRes.body.data.pool.community_id).toBe(community.id)
      expect(listRes.body.data.items.some((item: { asset: { asset_id: string } }) => item.asset.asset_id === assetId)).toBe(true)
    })
  })
})
