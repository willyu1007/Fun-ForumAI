import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LookupAddress } from 'node:dns'
import { InclinationAssetService } from '../inclination-asset-service.js'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryMediaAssetRepository } from '../../repos/media-asset-repository.js'
import { InMemoryMediaSemanticSnapshotRepository } from '../../repos/media-semantic-snapshot-repository.js'
import { InMemorySceneMediaBindingRepository } from '../../repos/scene-media-binding-repository.js'
import { InMemoryMediaContextProjectionRepository } from '../../repos/media-context-projection-repository.js'
import { InMemoryPostMediaRepository } from '../../repos/post-media-repository.js'
import { InMemoryImagePlanRepository } from '../../repos/image-plan-repository.js'
import { InMemoryForumSceneMetadataRepository } from '../../repos/forum-scene-metadata-repository.js'
import { InMemoryMediaReusePolicyRepository } from '../../repos/media-reuse-policy-repository.js'
import { InMemoryMediaGenerationJobRepository } from '../../repos/media-generation-job-repository.js'
import { MediaAssetService } from '../../media/media-asset-service.js'
import { MediaBindingService } from '../../media/media-binding-service.js'
import { MediaProjectionService } from '../../media/media-projection-service.js'
import { MediaReuseGovernanceService } from '../../media/media-reuse-governance-service.js'
import { MediaWriteBridge } from '../../media/media-write-bridge.js'
import type { MediaSemanticService } from '../../media/media-semantic-service.js'
import { buildMediaSemanticSummary } from '../../test-utils/media-fixtures.js'

const { lookupMock } = vi.hoisted(() => ({
  lookupMock: vi.fn(),
}))

vi.mock('node:dns/promises', () => ({
  lookup: lookupMock,
  default: {
    lookup: lookupMock,
  },
}))

function createService() {
  const agentRepo = new InMemoryAgentRepository()
  const mediaAssetRepo = new InMemoryMediaAssetRepository()
  const mediaSemanticSnapshotRepo = new InMemoryMediaSemanticSnapshotRepository()
  const sceneMediaBindingRepo = new InMemorySceneMediaBindingRepository()
  const mediaContextProjectionRepo = new InMemoryMediaContextProjectionRepository()
  const postMediaRepo = new InMemoryPostMediaRepository()
  const imagePlanRepo = new InMemoryImagePlanRepository()
  const forumSceneMetadataRepo = new InMemoryForumSceneMetadataRepository()

  const ownerUserId = 'owner-1'
  const agent = agentRepo.create({
    owner_id: ownerUserId,
    display_name: 'Inclination Agent',
  })

  const storage = {
    backend: 'local' as const,
    putObject: vi.fn(async ({ key, data, contentType }: { key: string; data: Buffer; contentType: string }) => ({
      key,
      url: `/v1/inclination-assets/media/local/${encodeURIComponent(key)}`,
      contentType,
      size: data.byteLength,
    })),
    getObject: vi.fn(async () => null),
    deleteObject: vi.fn(async () => {}),
    publicUrl: vi.fn((key: string) => `/v1/inclination-assets/media/local/${encodeURIComponent(key)}`),
  }

  const mediaSemanticService = {
    extract: vi.fn(async () => ({
      schema_version: 'media_semantic_summary.v1',
      model_provider: 'test',
      model_name: 'test-model',
      model_version: 'test-model',
      extraction_status: 'completed' as const,
      quality_grade: 'rich' as const,
      summary: buildMediaSemanticSummary({
        theme: 'theme',
        scene: 'scene',
        mood: 'mood',
        discussion_points: ['point-1', 'point-2', 'point-3'],
        salient_entities: ['entity-1'],
        public_safe_summary: 'safe summary',
        internal_full_summary: 'full summary',
      }),
    })),
  }

  const mediaBindingService = new MediaBindingService({
    sceneMediaBindingRepo,
  })
  const mediaProjectionService = new MediaProjectionService({
    mediaContextProjectionRepo,
  })
  const mediaReuseGovernanceService = new MediaReuseGovernanceService({
    mediaAssetRepo,
    mediaSemanticSnapshotRepo,
    sceneMediaBindingRepo,
    mediaContextProjectionRepo,
    mediaReusePolicyRepo: new InMemoryMediaReusePolicyRepository(),
    mediaGenerationJobRepo: new InMemoryMediaGenerationJobRepository(),
    imagePlanRepo,
    mediaBindingService,
  })
  const mediaWriteBridge = new MediaWriteBridge({
    mediaAssetRepo,
    mediaSemanticSnapshotRepo,
    sceneMediaBindingRepo,
    mediaContextProjectionRepo,
    postMediaRepo,
    imagePlanRepo,
    forumSceneMetadataRepo,
    storage,
    mediaBindingService,
    mediaProjectionService,
    mediaReuseGovernanceService,
  })
  const mediaAssetService = new MediaAssetService({
    mediaAssetRepo,
    mediaSemanticSnapshotRepo,
    sceneMediaBindingRepo,
    mediaContextProjectionRepo,
    storage,
    mediaSemanticService: mediaSemanticService as unknown as MediaSemanticService,
    mediaBindingService,
    mediaProjectionService,
    mediaWriteBridge,
  })

  const service = new InclinationAssetService({
    agentRepo,
    mediaAssetService,
    mediaReuseGovernanceService,
  })

  return {
    service,
    ownerUserId,
    agent,
    mediaAssetService,
    mediaAssetRepo,
    mediaReuseGovernanceService,
  }
}

describe('InclinationAssetService', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
    lookupMock.mockReset()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('blocks redirect that targets private network host', async () => {
    const { service, ownerUserId, agent } = createService()
    lookupMock.mockResolvedValue([
      { address: '93.184.216.34', family: 4 } as LookupAddress,
    ])

    globalThis.fetch = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: 'https://127.0.0.1/internal.png' },
    })) as unknown as typeof fetch

    await expect(service.createFromUrl({
      agent_id: agent.id,
      owner_user_id: ownerUserId,
      source_url: 'https://safe.example/image.png',
    })).rejects.toThrow('host is not allowed')
  })

  it('creates asset from upload into private pool with valid PNG', async () => {
    const { service, ownerUserId, agent } = createService()
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const padding = Buffer.alloc(100)
    const bytes = Buffer.concat([pngSignature, padding])

    const result = await service.createFromUpload({
      agent_id: agent.id,
      owner_user_id: ownerUserId,
      mime_type: 'image/png',
      bytes,
      owner_note: 'test upload',
    })

    const current = await service.getCurrent(agent.id, ownerUserId)
    expect(result.asset_id).toBeTruthy()
    expect(result.lifecycle_status).toBe('active')
    expect(result.visibility_policy).toBe('private_only')
    expect(result.mime_type).toBe('image/png')
    expect(result.owner_note).toBe('test upload')
    expect(current.pool.active_count).toBe(1)
    expect(current.pool.latest_asset?.asset_id).toBe(result.asset_id)
  })

  it('rejects upload with unsupported MIME type', async () => {
    const { service, ownerUserId, agent } = createService()
    const bytes = Buffer.from('fake data')

    await expect(service.createFromUpload({
      agent_id: agent.id,
      owner_user_id: ownerUserId,
      mime_type: 'application/pdf',
      bytes,
    })).rejects.toThrow('unsupported media type')
  })

  it('rejects upload with wrong magic bytes for declared MIME', async () => {
    const { service, ownerUserId, agent } = createService()
    const fakeBytes = Buffer.from('this is not a png file at all, just text')

    await expect(service.createFromUpload({
      agent_id: agent.id,
      owner_user_id: ownerUserId,
      mime_type: 'image/png',
      bytes: fakeBytes,
    })).rejects.toThrow('corrupted image file')
  })

  it('rejects upload exceeding 10MB size limit', async () => {
    const { service, ownerUserId, agent } = createService()
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const oversized = Buffer.alloc(11 * 1024 * 1024)
    pngSignature.copy(oversized)

    await expect(service.createFromUpload({
      agent_id: agent.id,
      owner_user_id: ownerUserId,
      mime_type: 'image/png',
      bytes: oversized,
    })).rejects.toThrow('media exceeds 10MB limit')
  })

  it('rejects upload from non-owner user', async () => {
    const { service, agent } = createService()
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const bytes = Buffer.concat([pngSignature, Buffer.alloc(100)])

    await expect(service.createFromUpload({
      agent_id: agent.id,
      owner_user_id: 'not-the-owner',
      mime_type: 'image/png',
      bytes,
    })).rejects.toThrow('Not your agent')
  })

  it('rejects oversized remote file using total size from content-range', async () => {
    const { service, ownerUserId, agent } = createService()
    lookupMock.mockResolvedValue([
      { address: '93.184.216.34', family: 4 } as LookupAddress,
    ])

    const fetchMock = vi.fn()
    fetchMock.mockRejectedValueOnce(new Error('HEAD not supported'))
    fetchMock.mockResolvedValueOnce(new Response(Buffer.from([0x00]), {
      status: 206,
      headers: {
        'content-type': 'image/png',
        'content-length': '1',
        'content-range': 'bytes 0-0/20971520',
      },
    }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await expect(service.createFromUrl({
      agent_id: agent.id,
      owner_user_id: ownerUserId,
      source_url: 'https://safe.example/image.png',
    })).rejects.toThrow('media exceeds 10MB limit')
  })

  it('keeps correct owner-pool counts beyond the previous 100-item truncation', async () => {
    const { service, ownerUserId, agent } = createService()
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const bytes = Buffer.concat([pngSignature, Buffer.alloc(128)])

    for (let i = 0; i < 120; i += 1) {
      await service.createFromUpload({
        agent_id: agent.id,
        owner_user_id: ownerUserId,
        mime_type: 'image/png',
        bytes,
        owner_note: `asset-${i}`,
      })
    }

    const current = await service.getCurrent(agent.id, ownerUserId)
    expect(current.pool.active_count).toBe(120)
    expect(current.pool.latest_asset).toBeTruthy()
  })

  it('finds the latest eligible owner-pool asset even when it is older than the newest 50 items', async () => {
    const { service, ownerUserId, agent, mediaAssetService } = createService()
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const bytes = Buffer.concat([pngSignature, Buffer.alloc(128)])
    const createdIds: string[] = []

    for (let i = 0; i < 60; i += 1) {
      const created = await service.createFromUpload({
        agent_id: agent.id,
        owner_user_id: ownerUserId,
        mime_type: 'image/png',
        bytes,
        owner_note: `asset-${i}`,
      })
      createdIds.push(created.asset_id)
    }

    const oldestCandidateId = createdIds[0]!
    await service.promoteAsset({
      agent_id: agent.id,
      owner_user_id: ownerUserId,
      asset_id: oldestCandidateId,
    })
    for (const assetId of createdIds.slice(1).reverse()) {
      await service.promoteAsset({
        agent_id: agent.id,
        owner_user_id: ownerUserId,
        asset_id: assetId,
      })
      await mediaAssetService.attachAssetToForumPost({
        asset_id: assetId,
        post_id: `post-${assetId}`,
      })
    }

    const candidate = await service.getPendingForAgent(agent.id)
    expect(candidate?.id).toBe(oldestCandidateId)
  })

  it('reports latest public attachment using attachment time instead of asset creation time', async () => {
    const { service, ownerUserId, agent, mediaAssetService, mediaAssetRepo } = createService()
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const bytes = Buffer.concat([pngSignature, Buffer.alloc(128)])

    const created = await service.createFromUpload({
      agent_id: agent.id,
      owner_user_id: ownerUserId,
      mime_type: 'image/png',
      bytes,
      owner_note: 'public-attachment-check',
    })
    const asset = await mediaAssetRepo.findById(created.asset_id)
    expect(asset).toBeTruthy()
    if (!asset) return
    asset.created_at = new Date('2026-01-01T00:00:00.000Z')
    await service.promoteAsset({
      agent_id: agent.id,
      owner_user_id: ownerUserId,
      asset_id: asset.id,
    })

    await new Promise((resolve) => setTimeout(resolve, 20))
    await mediaAssetService.attachAssetToForumPost({
      asset_id: created.asset_id,
      post_id: 'post-public-1',
    })

    const current = await service.getCurrent(agent.id, ownerUserId)
    expect(current.latest_public_attachment).toBeTruthy()
    expect(new Date(current.latest_public_attachment!.created_at).getTime()).toBeGreaterThan(asset.created_at.getTime())
    expect(current.latest_public_attachment!.latest_post_id).toBe('post-public-1')
  })

  it('does not attach blocked assets to public posts', async () => {
    const { service, ownerUserId, agent, mediaAssetService, mediaAssetRepo } = createService()
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const bytes = Buffer.concat([pngSignature, Buffer.alloc(128)])

    const created = await service.createFromUpload({
      agent_id: agent.id,
      owner_user_id: ownerUserId,
      mime_type: 'image/png',
      bytes,
    })
    await mediaAssetRepo.update(created.asset_id, {
      visibility_policy: 'blocked',
      lifecycle_status: 'active',
    })

    const result = await mediaAssetService.attachAssetToForumPost({
      asset_id: created.asset_id,
      post_id: 'blocked-post',
    })

    expect(result.linked).toBe(false)
  })

  it('supports owner promote and demote round trips without leaving the asset publicly attachable', async () => {
    const { service, ownerUserId, agent, mediaAssetService } = createService()
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const bytes = Buffer.concat([pngSignature, Buffer.alloc(128)])

    const created = await service.createFromUpload({
      agent_id: agent.id,
      owner_user_id: ownerUserId,
      mime_type: 'image/png',
      bytes,
      owner_note: 'round-trip',
    })

    const promoted = await service.promoteAsset({
      agent_id: agent.id,
      owner_user_id: ownerUserId,
      asset_id: created.asset_id,
    })
    expect(promoted.visibility_policy).toBe('public_original_allowed')

    const demoted = await service.demoteAsset({
      agent_id: agent.id,
      owner_user_id: ownerUserId,
      asset_id: created.asset_id,
    })
    expect(demoted.visibility_policy).toBe('private_only')

    const attachResult = await mediaAssetService.attachAssetToForumPost({
      asset_id: created.asset_id,
      post_id: 'post-after-demote',
    })
    expect(attachResult.linked).toBe(false)
  })
})
