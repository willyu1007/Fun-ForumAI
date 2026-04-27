import { describe, expect, it, vi } from 'vitest'
import { AdminMediaImportService } from '../admin-media-import-service.js'
import {
  buildPlatformCanonicalPoolSceneId,
} from '../media-reuse-governance-service.js'
import { InMemoryMediaAssetRepository } from '../../repos/media-asset-repository.js'
import { InMemoryMediaSemanticSnapshotRepository } from '../../repos/media-semantic-snapshot-repository.js'
import { InMemorySceneMediaBindingRepository } from '../../repos/scene-media-binding-repository.js'
import { InMemoryMediaReusePolicyRepository } from '../../repos/media-reuse-policy-repository.js'
import { InMemoryMediaRetrievalDocumentRepository } from '../../repos/media-retrieval-document-repository.js'
import { InMemoryMediaEmbeddingSnapshotRepository } from '../../repos/media-embedding-snapshot-repository.js'
import { InMemoryPostMediaRepository } from '../../repos/post-media-repository.js'
import type {
  MediaAsset,
  MediaEmbeddingSnapshot,
  MediaRetrievalDocument,
  MediaReusePolicy,
  SceneMediaBinding,
} from '../../repos/types.js'
import { buildMediaSemanticSummary } from '../../test-utils/media-fixtures.js'

interface Harness {
  service: AdminMediaImportService
  asset: MediaAsset
  binding: SceneMediaBinding
  policy: MediaReusePolicy
  document: MediaRetrievalDocument
  mediaEmbeddingSnapshotRepo: InMemoryMediaEmbeddingSnapshotRepository
}

async function buildHarness(): Promise<Harness> {
  const mediaAssetRepo = new InMemoryMediaAssetRepository()
  const mediaSemanticSnapshotRepo = new InMemoryMediaSemanticSnapshotRepository()
  const sceneMediaBindingRepo = new InMemorySceneMediaBindingRepository()
  const mediaReusePolicyRepo = new InMemoryMediaReusePolicyRepository()
  const mediaRetrievalDocumentRepo = new InMemoryMediaRetrievalDocumentRepository()
  const mediaEmbeddingSnapshotRepo = new InMemoryMediaEmbeddingSnapshotRepository()
  const postMediaRepo = new InMemoryPostMediaRepository()

  const asset = await mediaAssetRepo.create({
    id: 'asset-platform-1',
    owner_user_id: 'admin-1',
    source_kind: 'platform_canonical',
    visibility_policy: 'public_original_allowed',
    lifecycle_status: 'active',
    storage_key: 'platform/asset-platform-1.png',
    mime_type: 'image/png',
    file_size_bytes: 64,
    width: 1,
    height: 1,
    sha256: 'sha-platform-1',
  })
  await mediaSemanticSnapshotRepo.create({
    id: 'snapshot-platform-1',
    asset_id: asset.id,
    snapshot_kind: 'visual_core',
    schema_version: 'media_semantic_summary.v3',
    model_provider: 'test',
    model_name: 'test',
    model_version: 'test',
    summary: buildMediaSemanticSummary({ theme: 'platform-canonical', scene: 'studio' }),
    extraction_status: 'completed',
    quality_grade: 'rich',
    is_current: true,
  })
  const sceneId = buildPlatformCanonicalPoolSceneId()
  const binding = await sceneMediaBindingRepo.create({
    scene_type: 'media_pool',
    scene_id: sceneId,
    asset_id: asset.id,
    semantic_snapshot_id: 'snapshot-platform-1',
    binding_role: 'reference',
    relation_to_scene: 'quoted_public',
    display_policy: 'original_allowed',
    created_by_type: 'system',
    created_by_id: 'admin-1',
  })
  const policy = await mediaReusePolicyRepo.create({
    subject_type: 'asset',
    subject_id: asset.id,
    source_kind: 'platform_canonical',
    community_id: null,
    steward_agent_id: null,
    allowed_reuse_modes: ['derive_new', 'reference_only'],
    cross_agent_quote_allowed: false,
    disclose_origin_policy: 'public_only',
    copyright_state: 'platform_owned',
    status: 'active',
  })
  const document = await mediaRetrievalDocumentRepo.create({
    id: 'doc-platform-1',
    doc_key: 'doc:asset-platform-1:public_global',
    asset_id: asset.id,
    schema_version: 'media-retrieval-doc.v1',
    doc_scope: 'public_safe',
    modality: 'image',
    source_kind: 'platform_canonical',
    document_text: 'platform asset doc',
    document_hash: 'doc-hash-1',
    document_meta_json: {
      source_kind: 'platform_canonical',
      scope_hints: { owner_user_id: null, steward_agent_id: null, community_id: null },
      retrieval_terms: [],
      reason: null,
      public_safe_enabled: true,
      generated_from: 'catalog_card',
    },
  })

  const service = new AdminMediaImportService({
    mediaAssetService: {} as never,
    mediaReuseGovernanceService: {} as never,
    mediaRetrievalService: { ensureAssetIndexed: vi.fn() } as never,
    mediaAssetRepo,
    mediaSemanticSnapshotRepo,
    sceneMediaBindingRepo,
    mediaReusePolicyRepo,
    mediaRetrievalDocumentRepo,
    mediaEmbeddingSnapshotRepo,
    postMediaRepo,
    storage: { publicUrl: (key: string) => `/v1/media/local/${encodeURIComponent(key)}` },
  })

  return { service, asset, binding, policy, document, mediaEmbeddingSnapshotRepo }
}

async function createSnapshot(
  repo: InMemoryMediaEmbeddingSnapshotRepository,
  document: MediaRetrievalDocument,
  patch: Partial<Pick<MediaEmbeddingSnapshot, 'search_status' | 'is_active' | 'error_code' | 'error_message'>>,
): Promise<MediaEmbeddingSnapshot> {
  return repo.create({
    retrieval_document_id: document.id,
    index_profile_id: 'text-embedding-v4-1024',
    provider: 'test',
    model_name: 'test',
    output_type: 'dense',
    vector_dimension: 1024,
    document_content_hash: document.document_hash,
    embedding_hash: `hash-${Date.now()}-${Math.random()}`,
    embedding_vector: patch.search_status === 'searchable' ? [0.1] : null,
    search_status: patch.search_status ?? 'pending',
    is_active: patch.is_active ?? false,
    error_code: patch.error_code ?? null,
    error_message: patch.error_message ?? null,
  })
}

describe('AdminMediaImportService.resolveRetrievalStatus (via list)', () => {
  it('returns "ready" when an active searchable embedding exists', async () => {
    const harness = await buildHarness()
    await createSnapshot(harness.mediaEmbeddingSnapshotRepo, harness.document, {
      search_status: 'searchable',
      is_active: true,
    })
    const result = await harness.service.listPlatformAssets({ limit: 50 })
    const item = result.items[0]
    expect(item.retrieval.status).toBe('ready')
    expect(item.retrieval.searchable_embedding_count).toBe(1)
    expect(item.retrieval.last_error_code).toBeNull()
  })

  it('returns "pending" when only backfill_required snapshots exist, exposing the latest reason', async () => {
    const harness = await buildHarness()
    await createSnapshot(harness.mediaEmbeddingSnapshotRepo, harness.document, {
      search_status: 'backfill_required',
      is_active: false,
      error_code: 'gateway_not_configured',
      error_message: 'gateway_not_configured',
    })
    const result = await harness.service.listPlatformAssets({ limit: 50 })
    const item = result.items[0]
    expect(item.retrieval.status).toBe('pending')
    expect(item.retrieval.searchable_embedding_count).toBe(0)
    expect(item.retrieval.last_error_code).toBe('gateway_not_configured')
  })

  it('returns "failed" when the latest snapshot has search_status=failed and exposes its error', async () => {
    const harness = await buildHarness()
    await createSnapshot(harness.mediaEmbeddingSnapshotRepo, harness.document, {
      search_status: 'pending',
      is_active: false,
    })
    await new Promise((resolve) => setTimeout(resolve, 5))
    await createSnapshot(harness.mediaEmbeddingSnapshotRepo, harness.document, {
      search_status: 'failed',
      is_active: false,
      error_code: 'embedding_provider_error',
      error_message: 'connection refused',
    })
    const result = await harness.service.listPlatformAssets({ limit: 50 })
    const item = result.items[0]
    expect(item.retrieval.status).toBe('failed')
    expect(item.retrieval.last_error_code).toBe('embedding_provider_error')
    expect(item.retrieval.last_error_message).toBe('connection refused')
  })

  it('returns "pending" with no documents when none have been indexed', async () => {
    const mediaAssetRepo = new InMemoryMediaAssetRepository()
    const mediaSemanticSnapshotRepo = new InMemoryMediaSemanticSnapshotRepository()
    const sceneMediaBindingRepo = new InMemorySceneMediaBindingRepository()
    const mediaReusePolicyRepo = new InMemoryMediaReusePolicyRepository()
    const mediaRetrievalDocumentRepo = new InMemoryMediaRetrievalDocumentRepository()
    const mediaEmbeddingSnapshotRepo = new InMemoryMediaEmbeddingSnapshotRepository()
    const postMediaRepo = new InMemoryPostMediaRepository()

    const asset = await mediaAssetRepo.create({
      id: 'asset-no-doc-1',
      source_kind: 'platform_canonical',
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
      storage_key: 'platform/asset-no-doc.png',
      mime_type: 'image/png',
      file_size_bytes: 64,
      sha256: 'sha-no-doc',
    })
    await sceneMediaBindingRepo.create({
      scene_type: 'media_pool',
      scene_id: buildPlatformCanonicalPoolSceneId(),
      asset_id: asset.id,
      semantic_snapshot_id: 'no-snapshot',
      binding_role: 'reference',
      relation_to_scene: 'quoted_public',
      display_policy: 'original_allowed',
      created_by_type: 'system',
      created_by_id: 'admin-1',
    })
    await mediaReusePolicyRepo.create({
      subject_type: 'asset',
      subject_id: asset.id,
      source_kind: 'platform_canonical',
      community_id: null,
      steward_agent_id: null,
      allowed_reuse_modes: ['derive_new', 'reference_only'],
      cross_agent_quote_allowed: false,
      disclose_origin_policy: 'public_only',
      copyright_state: 'platform_owned',
      status: 'active',
    })

    const service = new AdminMediaImportService({
      mediaAssetService: {} as never,
      mediaReuseGovernanceService: {} as never,
      mediaRetrievalService: { ensureAssetIndexed: vi.fn() } as never,
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      mediaReusePolicyRepo,
      mediaRetrievalDocumentRepo,
      mediaEmbeddingSnapshotRepo,
      postMediaRepo,
      storage: { publicUrl: (key: string) => `/v1/media/local/${encodeURIComponent(key)}` },
    })

    const result = await service.listPlatformAssets({ limit: 50 })
    const item = result.items[0]
    expect(item.retrieval.status).toBe('pending')
    expect(item.retrieval.document_ids).toEqual([])
    expect(item.retrieval.searchable_embedding_count).toBe(0)
  })
})
