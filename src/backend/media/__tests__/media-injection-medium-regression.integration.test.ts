import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { config } from '../../lib/config.js'
import { InMemoryMediaAssetRepository } from '../../repos/media-asset-repository.js'
import { InMemoryMediaCatalogCardRepository } from '../../repos/media-catalog-card-repository.js'
import { InMemoryMediaDuplicateClusterRepository } from '../../repos/media-duplicate-cluster-repository.js'
import { InMemoryMediaEmbeddingSnapshotRepository } from '../../repos/media-embedding-snapshot-repository.js'
import { InMemoryMediaImportJobItemRepository } from '../../repos/media-import-job-item-repository.js'
import { InMemoryMediaImportJobRepository } from '../../repos/media-import-job-repository.js'
import { InMemoryMediaRetrievalDocumentRepository } from '../../repos/media-retrieval-document-repository.js'
import { InMemoryMediaRetrievalSearchRepository } from '../../repos/media-retrieval-search-repository.js'
import { InMemoryMediaSemanticSnapshotRepository } from '../../repos/media-semantic-snapshot-repository.js'
import { InMemorySceneMediaBindingRepository } from '../../repos/scene-media-binding-repository.js'
import type {
  CreateMediaAssetInput,
  MediaAsset,
  MediaSemanticSnapshot,
  MediaSourceKind,
} from '../../repos/types.js'
import { LocalStorageAdapter } from '../../services/storage-adapter.js'
import { buildMediaSemanticSummary } from '../../test-utils/media-fixtures.js'
import type { MediaEmbeddingGatewayInput } from '../media-embedding-gateway.js'
import { MediaCatalogService } from '../media-catalog-service.js'
import { MediaDuplicateService } from '../media-duplicate-service.js'
import { MediaEmbeddingService } from '../media-embedding-service.js'
import { MediaImportArtifactService } from '../media-import-artifact-service.js'
import { MediaInjectionService } from '../media-injection-service.js'
import { MediaInjectionWorker } from '../media-injection-worker.js'
import { MediaRetrievalService } from '../media-retrieval-service.js'

const BASE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6W7k8AAAAASUVORK5CYII=',
  'base64',
)

const tempDirs: string[] = []
const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
const originalFeatureFlags = {
  mediaInjectionV1: featureFlags.mediaInjectionV1,
  mediaRetrievalV1: featureFlags.mediaRetrievalV1,
  mediaPlannerRetrievalV1: featureFlags.mediaPlannerRetrievalV1,
}

afterEach(async () => {
  Object.assign(featureFlags, originalFeatureFlags)
  vi.restoreAllMocks()
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

type SignalProfile = {
  theme: string
  scene: string
  mood: string
  public_safe_summary: string
  style_tags: string[]
  discussion_points: string[]
  salient_entities: string[]
}

const VECTOR_TERMS = [
  'skyline',
  'community',
  'festival',
  'private',
  'journal',
  'generated',
  'seeded',
  'remote',
  'boardwalk',
  'reference',
] as const

function createSemanticSnapshot(assetId: string, profile: SignalProfile): MediaSemanticSnapshot {
  return {
    id: `snapshot-${assetId}`,
    asset_id: assetId,
    snapshot_kind: 'visual_core',
    schema_version: 'visual_core.v1',
    model_provider: 'test',
    model_name: 'test',
    model_version: '1',
    summary: buildMediaSemanticSummary({
      theme: profile.theme,
      scene: profile.scene,
      mood: profile.mood,
      style_tags: profile.style_tags,
      discussion_points: profile.discussion_points,
      salient_entities: profile.salient_entities,
      public_safe_summary: profile.public_safe_summary,
      internal_full_summary: profile.public_safe_summary,
    }),
    extraction_status: 'completed',
    quality_grade: 'rich',
    is_current: true,
    created_at: new Date(),
  }
}

function createAssetInput(input: {
  id: string
  sha256: string
  source_kind: MediaSourceKind
  steward_agent_id?: string | null
  owner_user_id?: string | null
  visibility_policy?: MediaAsset['visibility_policy']
  origin_url?: string | null
}): CreateMediaAssetInput {
  return {
    id: input.id,
    steward_agent_id: input.steward_agent_id ?? 'agent-public',
    owner_user_id: input.owner_user_id ?? null,
    source_kind: input.source_kind,
    visibility_policy: input.visibility_policy ?? 'public_original_allowed',
    lifecycle_status: 'active',
    mime_type: 'image/png',
    file_size_bytes: 128,
    width: 1,
    height: 1,
    sha256: input.sha256,
    origin_url: input.origin_url ?? null,
    phash: null,
  }
}

function vectorize(text: string): number[] {
  const normalized = text.toLowerCase()
  return VECTOR_TERMS.map((term) => (normalized.includes(term) ? 1 : 0))
}

function inferSignalProfile(signal: string): SignalProfile {
  if (signal.includes('community-festival')) {
    return {
      theme: 'community festival',
      scene: 'community festival mural poster',
      mood: 'festive',
      public_safe_summary: 'A community festival mural poster in a lively street setting.',
      style_tags: ['community', 'festival'],
      discussion_points: ['community festival'],
      salient_entities: ['festival mural'],
    }
  }
  if (signal.includes('owner-journal')) {
    return {
      theme: 'private journal',
      scene: 'private journal mood board in a studio corner',
      mood: 'intimate',
      public_safe_summary: 'A private studio mood board with journal textures.',
      style_tags: ['private', 'journal'],
      discussion_points: ['private journal'],
      salient_entities: ['journal board'],
    }
  }
  if (signal.includes('generated-gallery')) {
    return {
      theme: 'generated gallery',
      scene: 'generated gallery spotlight still',
      mood: 'polished',
      public_safe_summary: 'A generated gallery spotlight composition.',
      style_tags: ['generated', 'gallery'],
      discussion_points: ['generated spotlight'],
      salient_entities: ['gallery spotlight'],
    }
  }
  if (signal.includes('seeded-reference')) {
    return {
      theme: 'seeded reference',
      scene: 'seeded reference skyline card',
      mood: 'neutral',
      public_safe_summary: 'A seeded skyline reference card.',
      style_tags: ['seeded', 'reference'],
      discussion_points: ['seeded reference'],
      salient_entities: ['reference card'],
    }
  }
  if (signal.includes('remote-boardwalk')) {
    return {
      theme: 'remote boardwalk',
      scene: 'remote boardwalk with evening lights',
      mood: 'calm',
      public_safe_summary: 'A remote boardwalk scene with evening lights.',
      style_tags: ['remote', 'boardwalk'],
      discussion_points: ['remote boardwalk'],
      salient_entities: ['boardwalk'],
    }
  }
  return {
    theme: 'skyline study',
    scene: 'harbor skyline at sunset',
    mood: 'bright',
    public_safe_summary: 'A bright harbor skyline at sunset.',
    style_tags: ['skyline', 'sunset'],
    discussion_points: ['skyline'],
    salient_entities: ['harbor skyline'],
  }
}

function inferSignalFromBytes(bytes: Buffer): string {
  const text = bytes.toString('utf8')
  if (text.includes('community-festival')) return 'community-festival'
  if (text.includes('owner-journal')) return 'owner-journal'
  if (text.includes('generated-gallery')) return 'generated-gallery'
  if (text.includes('seeded-reference')) return 'seeded-reference'
  if (text.includes('remote-boardwalk')) return 'remote-boardwalk'
  return 'platform-skyline'
}

function buildBytes(label: string): Buffer {
  return Buffer.concat([BASE_PNG, Buffer.from(`::${label}::`, 'utf8')])
}

describe('media injection medium-sample regression', () => {
  it('handles a mixed-source medium sample batch with stable scope semantics and retrieval hits', async () => {
    Object.assign(featureFlags, {
      mediaInjectionV1: true,
      mediaRetrievalV1: true,
      mediaPlannerRetrievalV1: true,
    })

    const root = await mkdtemp(join(tmpdir(), 'media-medium-regression-'))
    tempDirs.push(root)

    const mediaAssetRepo = new InMemoryMediaAssetRepository()
    const mediaSemanticSnapshotRepo = new InMemoryMediaSemanticSnapshotRepository()
    const mediaCatalogCardRepo = new InMemoryMediaCatalogCardRepository()
    const mediaRetrievalDocumentRepo = new InMemoryMediaRetrievalDocumentRepository()
    const mediaEmbeddingSnapshotRepo = new InMemoryMediaEmbeddingSnapshotRepository()
    const mediaDuplicateClusterRepo = new InMemoryMediaDuplicateClusterRepository()
    const mediaImportJobRepo = new InMemoryMediaImportJobRepository()
    const mediaImportJobItemRepo = new InMemoryMediaImportJobItemRepository()
    const sceneMediaBindingRepo = new InMemorySceneMediaBindingRepository()
    const mediaDuplicateService = new MediaDuplicateService({
      mediaAssetRepo,
      mediaDuplicateClusterRepo,
    })
    const artifactService = new MediaImportArtifactService({
      storage: new LocalStorageAdapter({ baseDir: join(root, 'storage') }),
    })

    const embeddingGateway = {
      providerId: 'test-embedding',
      modelName: 'text-embedding-v4',
      isConfigured: true,
      embed: vi.fn(async (input: MediaEmbeddingGatewayInput) => ({
        vector: vectorize(input.text),
        provider_id: 'test-embedding',
        model_name: 'text-embedding-v4',
        output_type: 'dense' as const,
        vector_dimension: VECTOR_TERMS.length,
        provider_request_summary: {
          text_type: input.text_type,
          trace_id: input.trace_id,
        },
      })),
    }

    const mediaCatalogService = new MediaCatalogService({
      mediaCatalogCardRepo,
      mediaSemanticSnapshotRepo,
    })
    const mediaEmbeddingService = new MediaEmbeddingService({
      mediaEmbeddingSnapshotRepo,
      gateway: embeddingGateway,
    })
    const mediaRetrievalSearchRepo = new InMemoryMediaRetrievalSearchRepository({
      listDocuments: async () => mediaRetrievalDocumentRepo.listAll(),
      listSnapshots: async () => mediaEmbeddingSnapshotRepo.listAll(),
    })
    const mediaRetrievalService = new MediaRetrievalService({
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      mediaRetrievalDocumentRepo,
      mediaRetrievalSearchRepo,
      mediaCatalogService,
      mediaEmbeddingService,
      mediaDuplicateService,
    })

    let assetCounter = 0
    async function createManagedAsset(input: {
      signal: string
      source_kind: MediaSourceKind
      steward_agent_id: string | null
      owner_user_id?: string | null
      visibility_policy: MediaAsset['visibility_policy']
      origin_url?: string | null
      sha256?: string
    }) {
      const id = `asset-medium-${String(++assetCounter).padStart(3, '0')}`
      const sha256 = input.sha256
        ?? createHash('sha256').update(input.signal).digest('hex')
      const asset = await mediaAssetRepo.create(createAssetInput({
        id,
        sha256,
        source_kind: input.source_kind,
        steward_agent_id: input.steward_agent_id,
        owner_user_id: input.owner_user_id ?? null,
        visibility_policy: input.visibility_policy,
        origin_url: input.origin_url ?? null,
      }))
      const snapshot = createSemanticSnapshot(asset.id, inferSignalProfile(input.signal))
      await mediaSemanticSnapshotRepo.create(snapshot)
      return { asset, snapshot }
    }

    const seededExisting = await createManagedAsset({
      signal: 'seeded-reference',
      source_kind: 'platform_canonical',
      steward_agent_id: 'agent-public',
      visibility_policy: 'public_original_allowed',
      sha256: createHash('sha256').update('seeded-existing').digest('hex'),
    })
    const generatedExisting = await createManagedAsset({
      signal: 'generated-gallery',
      source_kind: 'generated',
      steward_agent_id: 'agent-public',
      visibility_policy: 'public_original_allowed',
      sha256: createHash('sha256').update('generated-existing').digest('hex'),
    })

    const mediaInjectionService = new MediaInjectionService({
      mediaImportJobRepo,
      mediaImportJobItemRepo,
      mediaImportArtifactService: artifactService,
      mediaDuplicateService,
      mediaAssetRepo,
      mediaGenerationJobRepo: {
        findById: vi.fn(async (id: string) => (
          id === 'generated-job-1'
            ? ({ id, output_asset_id: generatedExisting.asset.id })
            : null
        )),
      },
    })

    const worker = new MediaInjectionWorker({
      mediaImportJobRepo,
      mediaImportJobItemRepo,
      mediaAssetRepo,
      agentRepo: {
        findById: vi.fn((id: string) => (
          id === 'agent-public' || id === 'agent-private'
            ? ({ id } as { id: string })
            : null
        )),
      },
      mediaGenerationJobRepo: {
        findById: vi.fn(async (id: string) => (
          id === 'generated-job-1'
            ? ({ id, output_asset_id: generatedExisting.asset.id })
            : null
        )),
      },
      mediaSemanticSnapshotRepo,
      mediaAssetService: {
        ingestOwnerUpload: vi.fn(async (input) => createManagedAsset({
          signal: inferSignalFromBytes(Buffer.from(input.bytes)),
          source_kind: 'owner_console_upload',
          steward_agent_id: input.agent_id,
          owner_user_id: input.owner_user_id,
          visibility_policy: 'private_only',
          sha256: createHash('sha256').update(Buffer.from(input.bytes)).digest('hex'),
        })),
        ingestOwnerUrl: vi.fn(async (input) => createManagedAsset({
          signal: input.source_url,
          source_kind: 'url_import',
          steward_agent_id: input.agent_id,
          owner_user_id: input.owner_user_id,
          visibility_policy: 'private_only',
          origin_url: input.source_url,
          sha256: createHash('sha256').update(input.source_url).digest('hex'),
        })),
        ingestManagedAsset: vi.fn(async (input) => createManagedAsset({
          signal: inferSignalFromBytes(Buffer.from(input.bytes)),
          source_kind: input.source_kind,
          steward_agent_id: input.steward_agent_id,
          owner_user_id: input.owner_user_id,
          visibility_policy: input.visibility_policy,
          sha256: createHash('sha256').update(Buffer.from(input.bytes)).digest('hex'),
        })),
        ingestManagedRemoteAsset: vi.fn(async (input) => createManagedAsset({
          signal: input.source_url,
          source_kind: input.source_kind,
          steward_agent_id: input.steward_agent_id,
          owner_user_id: input.owner_user_id,
          visibility_policy: input.visibility_policy,
          origin_url: input.source_url,
          sha256: createHash('sha256').update(input.source_url).digest('hex'),
        })),
      },
      mediaReuseGovernanceService: {
        registerCommunityCommonsAsset: vi.fn(async () => null),
        registerPlatformCanonicalAsset: vi.fn(async () => null),
        registerGeneratedPublicAsset: vi.fn(async () => null),
        registerPrivateDerivedPublicAsset: vi.fn(async () => null),
        registerSelfPublicArchiveAsset: vi.fn(async () => null),
      },
      mediaRetrievalService,
      mediaDuplicateService,
      mediaImportArtifactService: artifactService,
    })

    const files = {
      platform: buildBytes('platform-skyline'),
      community: buildBytes('community-festival'),
      owner: buildBytes('owner-journal'),
      invalid: buildBytes('invalid-steward'),
    }
    await Promise.all([
      writeFile(join(root, 'platform.png'), files.platform),
      writeFile(join(root, 'community.png'), files.community),
      writeFile(join(root, 'owner.png'), files.owner),
      writeFile(join(root, 'invalid.png'), files.invalid),
    ])

    const manifestPath = join(root, 'medium-regression.yaml')
    const manifestText = `
manifest_meta:
  contract_version: 1
  manifest_kind: media_import
  manifest_id: medium-regression
  generated_by_tool: vitest
  generated_at: 2026-04-15T12:00:00Z
defaults:
  entrypoint: cli_manifest
  indexing:
    primary_scope: public_safe
    public_safe_enabled: true
    embedding_policy_id: text-embedding-v4-1024
  dedupe:
    policy_id: exact_and_near
  reuse:
    mode_id: default
  catalog:
    policy_id: standard
items:
  - item_id: platform-main
    input_kind: local_file
    source_kind: platform_canonical
    path: ./platform.png
    target_scope:
      steward_agent_id: agent-public
  - item_id: platform-duplicate
    input_kind: local_file
    source_kind: platform_canonical
    path: ./platform.png
    target_scope:
      steward_agent_id: agent-public
  - item_id: community-festival
    input_kind: local_file
    source_kind: community_commons
    path: ./community.png
    target_scope:
      steward_agent_id: agent-public
      community_id: community-42
    indexing:
      primary_scope: community_scoped
      public_safe_enabled: true
  - item_id: owner-journal
    input_kind: local_file
    source_kind: owner_private_pool
    path: ./owner.png
    target_scope:
      owner_user_id: user-owner
      steward_agent_id: agent-private
    indexing:
      primary_scope: private_internal
      public_safe_enabled: false
    annotations:
      owner_note: founder journal board
  - item_id: seeded-existing
    input_kind: existing_asset_ref
    source_kind: platform_canonical
    asset_id: ${seededExisting.asset.id}
    target_scope:
      steward_agent_id: agent-public
  - item_id: generated-reuse
    input_kind: generated_artifact_ref
    source_kind: generated_public
    generated_job_id: generated-job-1
    target_scope:
      steward_agent_id: agent-public
  - item_id: remote-boardwalk
    input_kind: remote_url
    source_kind: platform_canonical
    url: https://example.com/remote-boardwalk.png
    target_scope:
      steward_agent_id: agent-public
  - item_id: invalid-steward
    input_kind: local_file
    source_kind: platform_canonical
    path: ./invalid.png
    target_scope:
      steward_agent_id: missing-agent
`
    await writeFile(manifestPath, manifestText, 'utf8')

    const job = await mediaInjectionService.stageApply({
      manifest_path: manifestPath,
      raw_manifest_text: manifestText,
      format: 'yaml',
      requested_by_type: 'system',
      requested_by_id: 'test-suite',
      apply_request_id: 'medium-regression-apply',
    })
    const dryRun = await mediaInjectionService.dryRun({
      manifest_path: manifestPath,
      raw_manifest_text: manifestText,
      format: 'yaml',
    })
    const finalJob = await worker.processJob(job.id)
    const items = await mediaImportJobItemRepo.listByJobId(job.id)
    const itemById = new Map(items.map((item) => [item.item_id, item]))

    expect(finalJob?.status).toBe('partial_succeeded')
    expect(finalJob?.created_items).toBe(4)
    expect(finalJob?.reused_items).toBe(3)
    expect(finalJob?.failed_items).toBe(1)

    expect(itemById.get('platform-main')?.status).toBe('created')
    expect(itemById.get('platform-duplicate')?.status).toBe('reused')
    expect(itemById.get('community-festival')?.status).toBe('created')
    expect(itemById.get('owner-journal')?.status).toBe('created')
    expect(itemById.get('seeded-existing')?.status).toBe('reused')
    expect(itemById.get('generated-reuse')?.status).toBe('reused')
    expect(itemById.get('remote-boardwalk')?.status).toBe('created')
    expect(itemById.get('invalid-steward')?.status).toBe('failed')
    expect(itemById.get('invalid-steward')?.error_message).toContain('steward agent missing-agent does not exist')
    expect(dryRun.item_plan.find((item) => item.item_id === 'seeded-existing')).toEqual({
      item_id: 'seeded-existing',
      action: 'reuse',
      reusable_asset_id: seededExisting.asset.id,
    })
    expect(dryRun.item_plan.find((item) => item.item_id === 'platform-duplicate')).toEqual({
      item_id: 'platform-duplicate',
      action: 'reuse',
      reusable_asset_id: null,
    })
    expect(dryRun.item_plan.find((item) => item.item_id === 'generated-reuse')).toEqual({
      item_id: 'generated-reuse',
      action: 'reuse',
      reusable_asset_id: generatedExisting.asset.id,
    })

    const platformAssetId = itemById.get('platform-main')?.resolved_asset_id
    expect(platformAssetId).toBeTruthy()
    expect(itemById.get('platform-duplicate')?.resolved_asset_id).toBe(platformAssetId)

    const communityAssetId = itemById.get('community-festival')?.resolved_asset_id
    const ownerAssetId = itemById.get('owner-journal')?.resolved_asset_id
    const remoteAssetId = itemById.get('remote-boardwalk')?.resolved_asset_id
    expect(communityAssetId).toBeTruthy()
    expect(ownerAssetId).toBeTruthy()
    expect(remoteAssetId).toBeTruthy()

    const platformDocs = await mediaRetrievalDocumentRepo.listByAssetId(platformAssetId!)
    const communityDocs = await mediaRetrievalDocumentRepo.listByAssetId(communityAssetId!)
    const ownerDocs = await mediaRetrievalDocumentRepo.listByAssetId(ownerAssetId!)
    const seededDocs = await mediaRetrievalDocumentRepo.listByAssetId(seededExisting.asset.id)
    const generatedDocs = await mediaRetrievalDocumentRepo.listByAssetId(generatedExisting.asset.id)
    const remoteDocs = await mediaRetrievalDocumentRepo.listByAssetId(remoteAssetId!)

    expect(platformDocs.map((doc) => doc.doc_scope)).toEqual(['public_safe'])
    expect(communityDocs.map((doc) => doc.doc_scope).sort()).toEqual(['community_scoped', 'public_safe'])
    expect(ownerDocs.map((doc) => doc.doc_scope)).toEqual(['private_internal'])
    expect(ownerDocs[0]?.document_text).toContain('owner_note: founder journal board')
    expect(seededDocs.map((doc) => doc.doc_scope)).toEqual(['public_safe'])
    expect(generatedDocs.map((doc) => doc.doc_scope)).toEqual(['public_safe'])
    expect(remoteDocs.map((doc) => doc.doc_scope)).toEqual(['public_safe'])

    const platformQueryVector = await mediaEmbeddingService.embedQuery({
      query_text: 'bright skyline harbor sunset',
      trace_id: 'query:platform',
    })
    const communityQueryVector = await mediaEmbeddingService.embedQuery({
      query_text: 'community festival mural poster',
      trace_id: 'query:community',
    })
    const privateQueryVector = await mediaEmbeddingService.embedQuery({
      query_text: 'founder private journal board',
      trace_id: 'query:private',
    })
    expect(platformQueryVector).toBeTruthy()
    expect(communityQueryVector).toBeTruthy()
    expect(privateQueryVector).toBeTruthy()

    const publicHits = await mediaRetrievalSearchRepo.searchActive({
      query_vector: platformQueryVector!,
      index_profile_id: 'text-embedding-v4-1024',
      limit: 5,
      doc_scopes: ['public_safe'],
      source_kinds: ['platform_canonical'],
      only_canonical: true,
    })
    const communityHits = await mediaRetrievalSearchRepo.searchActive({
      query_vector: communityQueryVector!,
      index_profile_id: 'text-embedding-v4-1024',
      limit: 5,
      doc_scopes: ['community_scoped'],
      source_kinds: ['community_commons'],
      community_id: 'community-42',
      only_canonical: true,
    })
    const privateHits = await mediaRetrievalSearchRepo.searchActive({
      query_vector: privateQueryVector!,
      index_profile_id: 'text-embedding-v4-1024',
      limit: 5,
      doc_scopes: ['private_internal'],
      source_kinds: ['owner_private_pool'],
      steward_agent_id: 'agent-private',
      only_canonical: true,
    })
    const publicPrivateQueryHits = await mediaRetrievalSearchRepo.searchActive({
      query_vector: privateQueryVector!,
      index_profile_id: 'text-embedding-v4-1024',
      limit: 10,
      doc_scopes: ['public_safe'],
      only_canonical: true,
    })

    expect(publicHits[0]?.asset_id).toBe(platformAssetId)
    expect(communityHits[0]?.asset_id).toBe(communityAssetId)
    expect(privateHits[0]?.asset_id).toBe(ownerAssetId)
    expect(publicPrivateQueryHits.some((hit) => hit.asset_id === ownerAssetId)).toBe(false)

    const snapshots = await mediaEmbeddingSnapshotRepo.listAll()
    const searchableSnapshotIds = snapshots
      .filter((snapshot) => snapshot.search_status === 'searchable' && snapshot.is_active)
      .map((snapshot) => snapshot.retrieval_document_id)
    expect(searchableSnapshotIds).toEqual(expect.arrayContaining([
      platformDocs[0]!.id,
      ownerDocs[0]!.id,
      generatedDocs[0]!.id,
    ]))
    expect(embeddingGateway.embed).toHaveBeenCalled()
  })
})
