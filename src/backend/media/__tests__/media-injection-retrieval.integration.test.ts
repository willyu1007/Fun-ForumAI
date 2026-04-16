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
  MediaAsset,
  MediaInjectionRequest,
  MediaRetrievalDocScope,
  MediaReusePolicy,
  MediaSemanticSnapshot,
  PersistedVisualDirective,
  SceneMediaBinding,
  VisualSourceKind,
} from '../../repos/types.js'
import { LocalStorageAdapter } from '../../services/storage-adapter.js'
import { buildMediaSemanticSummary } from '../../test-utils/media-fixtures.js'
import { buildPlatformCanonicalPoolSceneId } from '../media-reuse-governance-service.js'
import { MediaCatalogService } from '../media-catalog-service.js'
import { MediaDuplicateService } from '../media-duplicate-service.js'
import { MediaEmbeddingService } from '../media-embedding-service.js'
import { MediaImportArtifactService } from '../media-import-artifact-service.js'
import { MediaInjectionService } from '../media-injection-service.js'
import { MediaInjectionWorker } from '../media-injection-worker.js'
import { MediaRetrievalService } from '../media-retrieval-service.js'

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

function createSemanticSnapshot(assetId: string, overrides?: {
  theme?: string
  scene?: string
  mood?: string
  public_safe_summary?: string
  style_tags?: string[]
}): MediaSemanticSnapshot {
  return {
    id: `snapshot-${assetId}`,
    asset_id: assetId,
    snapshot_kind: 'visual_core',
    schema_version: 'visual_core.v1',
    model_provider: 'test',
    model_name: 'test',
    model_version: '1',
    summary: buildMediaSemanticSummary({
      theme: overrides?.theme ?? 'travel',
      scene: overrides?.scene ?? 'city skyline',
      mood: overrides?.mood ?? 'bright',
      style_tags: overrides?.style_tags ?? ['city', 'skyline'],
      discussion_points: ['城市氛围'],
      salient_entities: ['city'],
      public_safe_summary: overrides?.public_safe_summary ?? 'A bright city skyline.',
      internal_full_summary: overrides?.public_safe_summary ?? 'A bright city skyline.',
    }),
    extraction_status: 'completed',
    quality_grade: 'rich',
    is_current: true,
    created_at: new Date(),
  }
}

function createAssetRepoRecord(input: {
  id: string
  sha256: string
  source_kind?: MediaAsset['source_kind']
  visibility_policy?: MediaAsset['visibility_policy']
  owner_user_id?: string | null
  steward_agent_id?: string | null
  duplicate_cluster_id?: string | null
  duplicate_distance?: number | null
}): Parameters<InMemoryMediaAssetRepository['create']>[0] {
  return {
    id: input.id,
    steward_agent_id: input.steward_agent_id ?? 'agent-media',
    owner_user_id: input.owner_user_id ?? null,
    source_kind: input.source_kind ?? 'platform_canonical',
    visibility_policy: input.visibility_policy ?? 'public_original_allowed',
    lifecycle_status: 'active',
    mime_type: 'image/png',
    file_size_bytes: 128,
    width: 1,
    height: 1,
    sha256: input.sha256,
    phash: null,
    duplicate_cluster_id: input.duplicate_cluster_id ?? null,
    duplicate_distance: input.duplicate_distance ?? null,
  }
}

function resolveCopyrightState(
  sourceKind: VisualSourceKind,
): MediaReusePolicy['copyright_state'] {
  if (sourceKind === 'community_commons') return 'community_licensed'
  if (sourceKind === 'generated_public' || sourceKind === 'private_derived_public') {
    return 'generated_owned'
  }
  return 'platform_owned'
}

function createReuseRegistrationResult(input: {
  asset_id: string
  source_kind: VisualSourceKind
  community_id?: string | null
  steward_agent_id?: string | null
}): {
  binding: SceneMediaBinding
  policy: MediaReusePolicy
} {
  const now = new Date()
  return {
    binding: {
      id: `binding-${input.asset_id}`,
      scene_type: 'media_pool',
      scene_id: `pool-${input.source_kind}`,
      thread_root_ref: null,
      asset_id: input.asset_id,
      semantic_snapshot_id: `snapshot-${input.asset_id}`,
      source_scene_type: null,
      source_scene_id: null,
      binding_role: 'reference',
      relation_to_scene: 'quoted_public',
      binding_note_text: null,
      display_policy: 'original_allowed',
      created_by_type: 'system',
      created_by_id: 'test-suite',
      created_at: now,
    },
    policy: {
      id: `policy-${input.asset_id}`,
      subject_type: 'asset',
      subject_id: input.asset_id,
      source_kind: input.source_kind,
      community_id: input.community_id ?? null,
      steward_agent_id: input.steward_agent_id ?? 'agent-media',
      allowed_reuse_modes: ['quote_original'],
      cross_agent_quote_allowed: true,
      disclose_origin_policy: 'public_only',
      copyright_state: resolveCopyrightState(input.source_kind),
      status: 'active',
      revoked_at: null,
      revoked_reason: null,
      created_at: now,
      updated_at: now,
    },
  }
}

function buildReuseGovernanceServiceStub() {
  return {
    registerCommunityCommonsAsset: vi.fn(async (input: {
      community_id: string
      asset_id: string
      actor_user_id: string
      allow_quote_original?: boolean
    }) => createReuseRegistrationResult({
      asset_id: input.asset_id,
      source_kind: 'community_commons',
      community_id: input.community_id,
    })),
    registerPlatformCanonicalAsset: vi.fn(async (input: {
      asset_id: string
      actor_user_id: string
    }) => createReuseRegistrationResult({
      asset_id: input.asset_id,
      source_kind: 'platform_canonical',
    })),
    registerGeneratedPublicAsset: vi.fn(async (input: {
      asset_id: string
      agent_id: string
      actor_user_id: string
    }) => createReuseRegistrationResult({
      asset_id: input.asset_id,
      source_kind: 'generated_public',
      steward_agent_id: input.agent_id,
    })),
    registerPrivateDerivedPublicAsset: vi.fn(async (input: {
      asset_id: string
      agent_id: string
      actor_user_id: string
    }) => createReuseRegistrationResult({
      asset_id: input.asset_id,
      source_kind: 'private_derived_public',
      steward_agent_id: input.agent_id,
    })),
    registerSelfPublicArchiveAsset: vi.fn(async (input: {
      asset_id: string
      agent_id: string
      actor_user_id: string
    }) => createReuseRegistrationResult({
      asset_id: input.asset_id,
      source_kind: 'self_public_archive',
      steward_agent_id: input.agent_id,
    })),
  }
}

function createEnsuredRetrievalRecord(input: {
  asset_id: string
  source_kind: VisualSourceKind
  doc_scope?: MediaRetrievalDocScope
}): Awaited<ReturnType<MediaRetrievalService['ensureAssetIndexed']>>[number] {
  const now = new Date()
  const docId = `retrieval-doc-${input.asset_id}`
  return {
    document: {
      id: docId,
      doc_key: `doc-key-${input.asset_id}`,
      asset_id: input.asset_id,
      catalog_card_id: `card-${input.asset_id}`,
      duplicate_cluster_id: null,
      schema_version: 'media-retrieval-document.v1',
      doc_scope: input.doc_scope ?? 'public_safe',
      modality: 'image',
      track_kind: null,
      segment_start_ms: null,
      segment_end_ms: null,
      source_kind: input.source_kind,
      owner_user_id: null,
      steward_agent_id: 'agent-media',
      community_id: null,
      is_canonical: true,
      lifecycle_status: 'active',
      document_text: 'retrieval text',
      document_hash: `doc-hash-${input.asset_id}`,
      document_meta_json: {
        source_kind: input.source_kind,
        scope_hints: {
          owner_user_id: null,
          steward_agent_id: 'agent-media',
          community_id: null,
        },
        retrieval_terms: ['city skyline'],
        reason: null,
        public_safe_enabled: true,
        generated_from: 'catalog_card',
      },
      created_at: now,
      updated_at: now,
    },
    embedding_snapshot: {
      id: `embedding-${input.asset_id}`,
      retrieval_document_id: docId,
      index_profile_id: 'text-embedding-v4-1024',
      provider: 'test',
      model_name: 'test-embedding',
      output_type: 'dense',
      vector_dimension: 4,
      document_content_hash: `doc-hash-${input.asset_id}`,
      embedding_hash: `embedding-hash-${input.asset_id}`,
      embedding_vector: [0.1, 0.2, 0.3, 0.4],
      search_status: 'searchable',
      is_active: true,
      activated_at: now,
      error_code: null,
      error_message: null,
      provider_request_summary: null,
      created_at: now,
    },
  }
}

function buildDirective(sourceKind: VisualSourceKind): PersistedVisualDirective {
  return {
    id: 'directive-1',
    schema_version: 'visual-directive.v1',
    scene_ref: {
      request_id: 'selection-1',
      director_surface: 'scheduled_post',
      actor_surface: 'forum_post',
      community_id: 'community-1',
      episode_id: 'episode-1',
      selection_id: 'selection-1',
      episode_plan_id: 'plan-1',
      local_intent_id: 'intent-1',
      phase: 'opening',
      selection_mode: 'pool_guided',
    },
    goal: {
      need_image: 'preferred',
      visual_role: 'scene_establishing',
      human_goal: 'worldbuilding',
      runtime_influence: 'medium',
      display_priority: 'primary',
    },
    narrative_context: {
      hook: '城市开场',
      objective: '建立场景',
      tone_hint: 'neutral',
      relation_focus: 'none',
      semantic_query: 'bright city skyline sunset',
      required_elements: ['city skyline'],
      forbidden_elements: [],
      style_hint: null,
      aspect_ratio_hint: '4:5',
    },
    sourcing_policy: {
      allow_sources: [sourceKind],
      prefer_order: [sourceKind],
      allow_private_runtime_projection: false,
      allow_private_inspired_generation: false,
      allow_cross_agent_public: false,
      allow_generation: false,
      max_display_assets: 1,
    },
    guardrails: {
      privacy_mode: 'public_only',
      memory_scope: 'public_contextual',
      reference_scope: 'seed_only',
      display_policy: 'original_allowed',
      mention_policy: 'explicit_describe',
      text_in_image: 'avoid',
      safe_mode: false,
    },
    budget: {
      generation_tier: 'none',
      sync_generation_ms_budget: 0,
      async_generation_allowed: false,
      max_generation_attempts: 0,
    },
    audit: {
      director_reason: 'phase=opening',
      hard_constraints: [],
      soft_constraints: [],
    },
    created_at: new Date(),
    updated_at: new Date(),
  }
}

function buildRequest(input: {
  item_id: string
  input_kind: MediaInjectionRequest['input_kind']
  source_kind: VisualSourceKind
  steward_agent_id?: string | null
  owner_user_id?: string | null
  community_id?: string | null
  existing_asset_id?: string
}): MediaInjectionRequest {
  return {
    item_id: input.item_id,
    input_kind: input.input_kind,
    source_kind: input.source_kind,
    target_scope: {
      owner_user_id: input.owner_user_id ?? null,
      steward_agent_id: input.steward_agent_id ?? 'agent-media',
      community_id: input.community_id ?? null,
    },
    indexing: {
      primary_scope: input.source_kind === 'community_commons' ? 'community_scoped' : 'public_safe',
      public_safe_enabled: input.source_kind !== 'owner_private_pool',
      embedding_policy_id: 'text-embedding-v4-1024',
    },
    dedupe: {
      policy_id: 'exact_and_near',
    },
    reuse: {
      mode_id: 'default',
    },
    catalog: {
      policy_id: input.source_kind === 'generated_public' ? 'generated_text_derived' : 'standard',
    },
    annotations: {
      tags: [],
      internal_note: null,
      owner_note: null,
    },
    ...(input.input_kind === 'existing_asset_ref'
      ? { existing_asset_ref: { asset_id: input.existing_asset_id! } }
      : input.input_kind === 'generated_artifact_ref'
        ? { generated_artifact_ref: { generated_job_id: 'generated-job-1' } }
        : input.input_kind === 'remote_url'
          ? { remote_url: { url: 'https://example.com/asset.png', expected_sha256: null } }
          : { local_file: { path: './asset.png', declared_mime_type: 'image/png', declared_sha256: null } }),
  }
}

describe('media injection + retrieval integration', () => {
  it('purges expired staging and result artifacts after their retention windows', async () => {
    const root = await mkdtemp(join(tmpdir(), 'media-artifact-cleanup-'))
    tempDirs.push(root)

    const storage = new LocalStorageAdapter({ baseDir: join(root, 'storage') })
    const artifactService = new MediaImportArtifactService({ storage })
    const mediaImportJobRepo = new InMemoryMediaImportJobRepository()
    const mediaImportJobItemRepo = new InMemoryMediaImportJobItemRepository()
    const mediaAssetRepo = new InMemoryMediaAssetRepository()
    const mediaSemanticSnapshotRepo = new InMemoryMediaSemanticSnapshotRepository()

    const stagingManifestKey = await artifactService.stageRawManifest({
      request_fingerprint: 'cleanup-request',
      text: 'manifest: 1',
      format: 'yaml',
    })
    const normalizedManifestKey = await artifactService.stageNormalizedManifest({
      request_fingerprint: 'cleanup-request',
      text: '{"manifest":1}',
    })
    const stagingObjectKey = await artifactService.stageLocalFile({
      request_fingerprint: 'cleanup-request',
      item_id: 'cleanup-item',
      path: join(root, 'artifact.png'),
      bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      content_type: 'image/png',
    })
    const resultManifestKey = await artifactService.writeResultManifest('cleanup-job', { status: 'succeeded' })
    const failureLogKey = await artifactService.writeFailureLog('cleanup-job', { failures: [] })

    const oldFinishedAt = new Date(
      Date.now() - Math.max(
        config.mediaInjection.successInputRetentionMs,
        config.mediaInjection.resultArtifactRetentionMs,
      ) - 5_000,
    )
    const job = await mediaImportJobRepo.create({
      id: 'cleanup-job',
      status: 'succeeded',
      phase: 'finalize',
      entrypoint: 'cli_manifest',
      requested_by_type: 'system',
      requested_by_id: 'test-suite',
      manifest_version: 1,
      intent_fingerprint: 'cleanup-intent',
      request_fingerprint: 'cleanup-request',
      staging_manifest_key: stagingManifestKey,
      normalized_manifest_key: normalizedManifestKey,
      result_manifest_key: resultManifestKey,
      failure_log_key: failureLogKey,
      scope_summary_json: {
        source_kinds: ['platform_canonical'],
        doc_scopes: ['public_safe'],
        owner_user_id: null,
        steward_agent_id: null,
        community_id: null,
        public_safe_enabled: true,
      },
      finished_at: oldFinishedAt,
    })
    await mediaImportJobRepo.update(job.id, { finished_at: oldFinishedAt })
    await mediaImportJobItemRepo.createMany([{
      job_id: job.id,
      item_id: 'cleanup-item',
      item_index: 0,
      status: 'created',
      input_kind: 'local_file',
      source_kind: 'platform_canonical',
      index_scope: 'public_safe',
      staging_object_key: stagingObjectKey,
      resolved_request_json: buildRequest({
        item_id: 'cleanup-item',
        input_kind: 'local_file',
        source_kind: 'platform_canonical',
      }),
      finished_at: oldFinishedAt,
    }])

    const worker = new MediaInjectionWorker({
      mediaImportJobRepo,
      mediaImportJobItemRepo,
      mediaAssetRepo,
      mediaGenerationJobRepo: { findById: async () => null },
      mediaSemanticSnapshotRepo,
      mediaAssetService: {
        ingestOwnerUpload: vi.fn(),
        ingestOwnerUrl: vi.fn(),
        ingestManagedAsset: vi.fn(),
        ingestManagedRemoteAsset: vi.fn(),
      },
      mediaReuseGovernanceService: {
        registerCommunityCommonsAsset: vi.fn(),
        registerPlatformCanonicalAsset: vi.fn(),
        registerGeneratedPublicAsset: vi.fn(),
        registerPrivateDerivedPublicAsset: vi.fn(),
        registerSelfPublicArchiveAsset: vi.fn(),
      },
      mediaRetrievalService: {
        ensureAssetIndexed: vi.fn(),
      },
      mediaDuplicateService: new MediaDuplicateService({
        mediaAssetRepo,
        mediaDuplicateClusterRepo: new InMemoryMediaDuplicateClusterRepository(),
      }),
      mediaImportArtifactService: artifactService,
    })

    const purge = await worker.purgeExpiredArtifacts()
    expect(purge.input_job_ids).toContain(job.id)
    expect(purge.result_job_ids).toContain(job.id)

    const updatedJob = await mediaImportJobRepo.findById(job.id)
    const updatedItem = await mediaImportJobItemRepo.findByJobIdAndItemId(job.id, 'cleanup-item')
    expect(updatedJob?.staging_manifest_key).toBeNull()
    expect(updatedJob?.normalized_manifest_key).toBeNull()
    expect(updatedJob?.result_manifest_key).toBeNull()
    expect(updatedJob?.failure_log_key).toBeNull()
    expect(updatedItem?.staging_object_key).toBeNull()
    await expect(artifactService.readText(stagingManifestKey)).resolves.toBeNull()
    await expect(artifactService.readText(normalizedManifestKey)).resolves.toBeNull()
    await expect(artifactService.readBuffer(stagingObjectKey)).resolves.toBeNull()
    await expect(artifactService.readText(resultManifestKey)).resolves.toBeNull()
    await expect(artifactService.readText(failureLogKey)).resolves.toBeNull()
  })

  it('requeues timed-out running jobs and retries them on the next worker pass', async () => {
    featureFlags.mediaInjectionV1 = true
    const root = await mkdtemp(join(tmpdir(), 'media-worker-timeout-'))
    tempDirs.push(root)

    const artifactService = new MediaImportArtifactService({
      storage: new LocalStorageAdapter({ baseDir: join(root, 'storage') }),
    })
    const mediaImportJobRepo = new InMemoryMediaImportJobRepository()
    const mediaImportJobItemRepo = new InMemoryMediaImportJobItemRepository()
    const mediaAssetRepo = new InMemoryMediaAssetRepository()
    const mediaSemanticSnapshotRepo = new InMemoryMediaSemanticSnapshotRepository()

    const asset = await mediaAssetRepo.create(createAssetRepoRecord({
      id: 'asset-existing-1',
      sha256: 'sha-existing-1',
    }))
    const snapshot = createSemanticSnapshot(asset.id)
    await mediaSemanticSnapshotRepo.create(snapshot)

    const staleHeartbeat = new Date(Date.now() - config.mediaInjection.runningTimeoutMs - 5_000)
    const job = await mediaImportJobRepo.create({
      status: 'running',
      phase: 'materialize_assets',
      entrypoint: 'cli_manifest',
      requested_by_type: 'system',
      requested_by_id: 'test-suite',
      manifest_version: 1,
      intent_fingerprint: 'intent-timeout',
      request_fingerprint: 'request-timeout',
      staging_manifest_key: 'staging/request-timeout/raw-manifest.yaml',
      normalized_manifest_key: 'staging/request-timeout/normalized-manifest.json',
      scope_summary_json: {
        source_kinds: ['platform_canonical'],
        doc_scopes: ['public_safe'],
        owner_user_id: null,
        steward_agent_id: 'agent-media',
        community_id: null,
        public_safe_enabled: true,
      },
      total_items: 1,
      attempt_count: 1,
      started_at: staleHeartbeat,
      last_heartbeat_at: staleHeartbeat,
    })
    await mediaImportJobItemRepo.createMany([{
      job_id: job.id,
      item_id: 'item-existing-1',
      item_index: 0,
      status: 'processing',
      input_kind: 'existing_asset_ref',
      source_kind: 'platform_canonical',
      index_scope: 'public_safe',
      owner_user_id: null,
      steward_agent_id: 'agent-media',
      community_id: null,
      source_asset_id: asset.id,
      resolved_request_json: buildRequest({
        item_id: 'item-existing-1',
        input_kind: 'existing_asset_ref',
        source_kind: 'platform_canonical',
        existing_asset_id: asset.id,
      }),
    }])

    const ensureAssetIndexed = vi.fn(async () => [])
    const worker = new MediaInjectionWorker({
      mediaImportJobRepo,
      mediaImportJobItemRepo,
      mediaAssetRepo,
      mediaGenerationJobRepo: {
        findById: vi.fn(async () => null),
      },
      mediaSemanticSnapshotRepo,
      mediaAssetService: {
        ingestOwnerUpload: vi.fn(),
        ingestOwnerUrl: vi.fn(),
        ingestManagedAsset: vi.fn(),
        ingestManagedRemoteAsset: vi.fn(),
      },
      mediaReuseGovernanceService: buildReuseGovernanceServiceStub(),
      mediaRetrievalService: {
        ensureAssetIndexed,
      },
      mediaImportArtifactService: artifactService,
    })

    const finalJob = await worker.processNextReadyJob()
    expect(finalJob?.status).toBe('succeeded')
    expect(finalJob?.attempt_count).toBe(2)

    const [finalItem] = await mediaImportJobItemRepo.listByJobId(job.id)
    expect(finalItem?.status).toBe('reused')
    expect(finalItem?.resolved_asset_id).toBe(asset.id)
    expect(ensureAssetIndexed).toHaveBeenCalledWith(expect.objectContaining({
      asset: expect.objectContaining({ id: asset.id }),
      snapshot: expect.objectContaining({ id: snapshot.id }),
    }))
  })

  it('reuses an exact duplicate asset instead of rematerializing a second copy', async () => {
    featureFlags.mediaInjectionV1 = true
    const root = await mkdtemp(join(tmpdir(), 'media-duplicate-reuse-'))
    tempDirs.push(root)

    const imageBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6W7k8AAAAASUVORK5CYII=',
      'base64',
    )
    const sha256 = createHash('sha256').update(imageBytes).digest('hex')
    const assetPath = join(root, 'asset.png')
    await writeFile(assetPath, imageBytes)
    const manifestPath = join(root, 'manifest.yaml')
    const manifestText = `
manifest_meta:
  contract_version: 1
  manifest_kind: media_import
  manifest_id: manifest-duplicate
  generated_by_tool: test
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
  - item_id: duplicate-asset
    input_kind: local_file
    source_kind: platform_canonical
    path: ./asset.png
    target_scope:
      steward_agent_id: agent-media
`
    await writeFile(manifestPath, manifestText, 'utf8')

    const mediaAssetRepo = new InMemoryMediaAssetRepository()
    const mediaSemanticSnapshotRepo = new InMemoryMediaSemanticSnapshotRepository()
    const mediaDuplicateClusterRepo = new InMemoryMediaDuplicateClusterRepository()
    const mediaImportJobRepo = new InMemoryMediaImportJobRepository()
    const mediaImportJobItemRepo = new InMemoryMediaImportJobItemRepository()
    const duplicateService = new MediaDuplicateService({
      mediaAssetRepo,
      mediaDuplicateClusterRepo,
    })
    const artifactService = new MediaImportArtifactService({
      storage: new LocalStorageAdapter({ baseDir: join(root, 'storage') }),
    })

    const existingAsset = await mediaAssetRepo.create(createAssetRepoRecord({
      id: 'asset-reuse-source',
      sha256,
    }))
    await mediaSemanticSnapshotRepo.create(createSemanticSnapshot(existingAsset.id))

    const injectionService = new MediaInjectionService({
      mediaImportJobRepo,
      mediaImportJobItemRepo,
      mediaImportArtifactService: artifactService,
      mediaDuplicateService: duplicateService,
    })
    const ingestManagedAsset = vi.fn(async () => {
      throw new Error('ingestManagedAsset should not be called for exact duplicate reuse')
    })
    const worker = new MediaInjectionWorker({
      mediaImportJobRepo,
      mediaImportJobItemRepo,
      mediaAssetRepo,
      mediaGenerationJobRepo: {
        findById: vi.fn(async () => null),
      },
      mediaSemanticSnapshotRepo,
      mediaAssetService: {
        ingestOwnerUpload: vi.fn(),
        ingestOwnerUrl: vi.fn(),
        ingestManagedAsset,
        ingestManagedRemoteAsset: vi.fn(),
      },
      mediaReuseGovernanceService: buildReuseGovernanceServiceStub(),
      mediaRetrievalService: {
        ensureAssetIndexed: vi.fn(async () => []),
      },
      mediaDuplicateService: duplicateService,
      mediaImportArtifactService: artifactService,
    })

    const job = await injectionService.stageApply({
      manifest_path: manifestPath,
      raw_manifest_text: manifestText,
      format: 'yaml',
      requested_by_type: 'system',
      requested_by_id: 'test-suite',
      apply_request_id: 'duplicate-reuse-apply',
    })
    const dryRun = await injectionService.dryRun({
      manifest_path: manifestPath,
      raw_manifest_text: manifestText,
      format: 'yaml',
    })

    expect(dryRun.item_plan).toEqual([{
      item_id: 'duplicate-asset',
      action: 'reuse',
      reusable_asset_id: existingAsset.id,
    }])

    const finalJob = await worker.processJob(job.id)
    expect(finalJob?.status).toBe('succeeded')

    const [item] = await mediaImportJobItemRepo.listByJobId(job.id)
    expect(item?.status).toBe('reused')
    expect(item?.resolved_asset_id).toBe(existingAsset.id)
    expect(ingestManagedAsset).not.toHaveBeenCalled()
  })

  it('fails fast with a validation error when the steward agent does not exist', async () => {
    featureFlags.mediaInjectionV1 = true
    const root = await mkdtemp(join(tmpdir(), 'media-missing-steward-'))
    tempDirs.push(root)

    const imageBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6W7k8AAAAASUVORK5CYII=',
      'base64',
    )
    const assetPath = join(root, 'asset.png')
    await writeFile(assetPath, imageBytes)
    const manifestPath = join(root, 'manifest.yaml')
    const manifestText = `
manifest_meta:
  contract_version: 1
  manifest_kind: media_import
  manifest_id: manifest-missing-steward
  generated_by_tool: test
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
  - item_id: missing-steward-asset
    input_kind: local_file
    source_kind: platform_canonical
    path: ./asset.png
    target_scope:
      steward_agent_id: missing-agent
`
    await writeFile(manifestPath, manifestText, 'utf8')

    const mediaAssetRepo = new InMemoryMediaAssetRepository()
    const mediaSemanticSnapshotRepo = new InMemoryMediaSemanticSnapshotRepository()
    const mediaImportJobRepo = new InMemoryMediaImportJobRepository()
    const mediaImportJobItemRepo = new InMemoryMediaImportJobItemRepository()
    const artifactService = new MediaImportArtifactService({
      storage: new LocalStorageAdapter({ baseDir: join(root, 'storage') }),
    })
    const injectionService = new MediaInjectionService({
      mediaImportJobRepo,
      mediaImportJobItemRepo,
      mediaImportArtifactService: artifactService,
    })
    const ingestManagedAsset = vi.fn(async () => {
      throw new Error('ingestManagedAsset should not be called when steward validation fails')
    })
    const worker = new MediaInjectionWorker({
      mediaImportJobRepo,
      mediaImportJobItemRepo,
      mediaAssetRepo,
      agentRepo: {
        findById: vi.fn(() => null),
      },
      mediaGenerationJobRepo: {
        findById: vi.fn(async () => null),
      },
      mediaSemanticSnapshotRepo,
      mediaAssetService: {
        ingestOwnerUpload: vi.fn(),
        ingestOwnerUrl: vi.fn(),
        ingestManagedAsset,
        ingestManagedRemoteAsset: vi.fn(),
      },
      mediaReuseGovernanceService: buildReuseGovernanceServiceStub(),
      mediaRetrievalService: {
        ensureAssetIndexed: vi.fn(async () => []),
      },
      mediaImportArtifactService: artifactService,
    })

    const job = await injectionService.stageApply({
      manifest_path: manifestPath,
      raw_manifest_text: manifestText,
      format: 'yaml',
      requested_by_type: 'system',
      requested_by_id: 'test-suite',
    })
    const finalJob = await worker.processJob(job.id)
    const [item] = await mediaImportJobItemRepo.listByJobId(job.id)

    expect(finalJob?.status).toBe('failed')
    expect(item?.status).toBe('failed')
    expect(item?.error_message).toContain('steward agent missing-agent does not exist')
    expect(ingestManagedAsset).not.toHaveBeenCalled()
  })

  it('fails the import job when retrieval embedding is not searchable', async () => {
    Object.assign(featureFlags, {
      mediaInjectionV1: true,
      mediaRetrievalV1: true,
    })
    const root = await mkdtemp(join(tmpdir(), 'media-embedding-fail-'))
    tempDirs.push(root)
    const mediaAssetRepo = new InMemoryMediaAssetRepository()
    const mediaSemanticSnapshotRepo = new InMemoryMediaSemanticSnapshotRepository()
    const mediaImportJobRepo = new InMemoryMediaImportJobRepository()
    const mediaImportJobItemRepo = new InMemoryMediaImportJobItemRepository()

    const asset = await mediaAssetRepo.create(createAssetRepoRecord({
      id: 'asset-existing-embedding-fail',
      sha256: 'sha-existing-embedding-fail',
    }))
    const snapshot = createSemanticSnapshot(asset.id)
    await mediaSemanticSnapshotRepo.create(snapshot)

    const job = await mediaImportJobRepo.create({
      status: 'queued',
      phase: 'validate_manifest',
      entrypoint: 'cli_manifest',
      requested_by_type: 'system',
      requested_by_id: 'test-suite',
      manifest_version: 1,
      intent_fingerprint: 'intent-embedding-fail',
      request_fingerprint: 'request-embedding-fail',
      staging_manifest_key: 'staging/request-embedding-fail/raw-manifest.yaml',
      normalized_manifest_key: 'staging/request-embedding-fail/normalized-manifest.json',
      scope_summary_json: {
        source_kinds: ['platform_canonical'],
        doc_scopes: ['public_safe'],
        owner_user_id: null,
        steward_agent_id: 'agent-media',
        community_id: null,
        public_safe_enabled: true,
      },
      total_items: 1,
    })
    await mediaImportJobItemRepo.createMany([{
      job_id: job.id,
      item_id: 'embedding-fail-item',
      item_index: 0,
      status: 'pending',
      input_kind: 'existing_asset_ref',
      source_kind: 'platform_canonical',
      index_scope: 'public_safe',
      owner_user_id: null,
      steward_agent_id: 'agent-media',
      community_id: null,
      source_asset_id: asset.id,
      resolved_request_json: buildRequest({
        item_id: 'embedding-fail-item',
        input_kind: 'existing_asset_ref',
        source_kind: 'platform_canonical',
        existing_asset_id: asset.id,
      }),
    }])

    const worker = new MediaInjectionWorker({
      mediaImportJobRepo,
      mediaImportJobItemRepo,
      mediaAssetRepo,
      mediaGenerationJobRepo: {
        findById: vi.fn(async () => null),
      },
      mediaSemanticSnapshotRepo,
      mediaAssetService: {
        ingestOwnerUpload: vi.fn(),
        ingestOwnerUrl: vi.fn(),
        ingestManagedAsset: vi.fn(),
        ingestManagedRemoteAsset: vi.fn(),
      },
      mediaReuseGovernanceService: buildReuseGovernanceServiceStub(),
      mediaRetrievalService: {
        ensureAssetIndexed: vi.fn(async () => {
          const record = createEnsuredRetrievalRecord({
            asset_id: asset.id,
            source_kind: 'platform_canonical',
          })
          return [{
            ...record,
            embedding_snapshot: {
              ...record.embedding_snapshot!,
              provider: 'dashscope-text-embedding',
              model_name: 'text-embedding-v4',
              vector_dimension: 1024,
              embedding_vector: null,
              search_status: 'backfill_required' as const,
              is_active: false,
              activated_at: null,
              error_code: 'http_error',
              error_message: 'invalid key',
            },
          }]
        }),
      },
      mediaImportArtifactService: new MediaImportArtifactService({
        storage: new LocalStorageAdapter({ baseDir: join(root, 'storage') }),
      }),
    })

    const finalJob = await worker.processJob(job.id)
    const [item] = await mediaImportJobItemRepo.listByJobId(job.id)

    expect(finalJob?.status).toBe('failed')
    expect(item?.status).toBe('failed')
    expect(item?.error_message).toContain('media retrieval embedding is not searchable')
    expect(item?.error_message).toContain('http_error')
  })

  it('returns only the canonical planner candidate from semantic retrieval hits', async () => {
    Object.assign(featureFlags, {
      mediaRetrievalV1: true,
      mediaPlannerRetrievalV1: true,
    })

    const mediaAssetRepo = new InMemoryMediaAssetRepository()
    const mediaSemanticSnapshotRepo = new InMemoryMediaSemanticSnapshotRepository()
    const sceneMediaBindingRepo = new InMemorySceneMediaBindingRepository()
    const mediaCatalogCardRepo = new InMemoryMediaCatalogCardRepository()
    const mediaRetrievalDocumentRepo = new InMemoryMediaRetrievalDocumentRepository()
    const mediaEmbeddingSnapshotRepo = new InMemoryMediaEmbeddingSnapshotRepository()
    const mediaDuplicateClusterRepo = new InMemoryMediaDuplicateClusterRepository()

    const canonicalAsset = await mediaAssetRepo.create(createAssetRepoRecord({
      id: 'asset-canonical-1',
      sha256: 'sha-canonical-1',
    }))
    const duplicateAsset = await mediaAssetRepo.create(createAssetRepoRecord({
      id: 'asset-duplicate-1',
      sha256: 'sha-duplicate-1',
    }))
    const canonicalSnapshot = createSemanticSnapshot(canonicalAsset.id, {
      scene: 'city skyline sunset',
      public_safe_summary: 'A bright city skyline at sunset.',
      style_tags: ['city', 'sunset'],
    })
    const duplicateSnapshot = createSemanticSnapshot(duplicateAsset.id, {
      scene: 'city skyline duplicate',
      public_safe_summary: 'A duplicated skyline reference.',
      style_tags: ['city', 'duplicate'],
    })
    await mediaSemanticSnapshotRepo.create(canonicalSnapshot)
    await mediaSemanticSnapshotRepo.create(duplicateSnapshot)

    const cluster = await mediaDuplicateClusterRepo.create({
      id: 'cluster-1',
      duplicate_kind: 'near',
      canonical_asset_id: canonicalAsset.id,
      evidence_json: {
        member_asset_ids: [canonicalAsset.id, duplicateAsset.id],
      },
      status: 'active',
    })
    await mediaAssetRepo.update(canonicalAsset.id, {
      duplicate_cluster_id: cluster.id,
      duplicate_distance: 0,
    })
    await mediaAssetRepo.update(duplicateAsset.id, {
      duplicate_cluster_id: cluster.id,
      duplicate_distance: 1,
    })

    await sceneMediaBindingRepo.create({
      asset_id: canonicalAsset.id,
      semantic_snapshot_id: canonicalSnapshot.id,
      scene_type: 'media_pool',
      scene_id: buildPlatformCanonicalPoolSceneId(),
      binding_role: 'primary',
      relation_to_scene: 'selected_for_post',
      display_policy: 'original_allowed',
      created_by_type: 'system',
      created_by_id: 'test-suite',
    })
    await sceneMediaBindingRepo.create({
      asset_id: duplicateAsset.id,
      semantic_snapshot_id: duplicateSnapshot.id,
      scene_type: 'media_pool',
      scene_id: buildPlatformCanonicalPoolSceneId(),
      binding_role: 'reference',
      relation_to_scene: 'selected_for_post',
      display_policy: 'original_allowed',
      created_by_type: 'system',
      created_by_id: 'test-suite',
    })

    const mediaCatalogService = new MediaCatalogService({
      mediaCatalogCardRepo,
      mediaSemanticSnapshotRepo,
    })
    const gateway = {
      providerId: 'test-embedding',
      modelName: 'text-embedding-v4',
      isConfigured: true,
      embed: vi.fn(async ({ text, text_type }: { text: string; text_type: 'document' | 'query' }) => {
        if (text_type === 'query') {
          return {
            vector: [1, 0, 0, 0],
            provider_id: 'test-embedding',
            model_name: 'text-embedding-v4',
            output_type: 'dense' as const,
            vector_dimension: 4,
            provider_request_summary: {},
          }
        }
        const isDuplicate = text.includes('duplicate')
        return {
          vector: isDuplicate ? [0.7, 0.3, 0, 0] : [1, 0, 0, 0],
          provider_id: 'test-embedding',
          model_name: 'text-embedding-v4',
          output_type: 'dense' as const,
          vector_dimension: 4,
          provider_request_summary: {},
        }
      }),
    }
    const mediaEmbeddingService = new MediaEmbeddingService({
      mediaEmbeddingSnapshotRepo,
      gateway,
    })
    const mediaRetrievalSearchRepo = new InMemoryMediaRetrievalSearchRepository({
      listDocuments: async () => mediaRetrievalDocumentRepo.listAll(),
      listSnapshots: async () => mediaEmbeddingSnapshotRepo.listAll(),
    })
    const mediaDuplicateService = new MediaDuplicateService({
      mediaAssetRepo,
      mediaDuplicateClusterRepo,
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

    await mediaRetrievalService.ensureAssetIndexed({
      asset: canonicalAsset,
      snapshot: canonicalSnapshot,
      source_kind: 'platform_canonical',
      target_scope: {
        owner_user_id: null,
        steward_agent_id: 'agent-media',
        community_id: null,
      },
      requested_scopes: ['public_safe'],
      duplicate_cluster_id: cluster.id,
      is_canonical: true,
    })
    await mediaRetrievalService.ensureAssetIndexed({
      asset: duplicateAsset,
      snapshot: duplicateSnapshot,
      source_kind: 'platform_canonical',
      target_scope: {
        owner_user_id: null,
        steward_agent_id: 'agent-media',
        community_id: null,
      },
      requested_scopes: ['public_safe'],
      duplicate_cluster_id: cluster.id,
      is_canonical: false,
    })

    const candidates = await mediaRetrievalService.searchPlannerCandidates({
      agent_id: 'agent-media',
      directive: buildDirective('platform_canonical'),
      limit: 4,
    })

    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.asset.id).toBe(canonicalAsset.id)
    expect(candidates[0]?.binding?.scene_id).toBe(buildPlatformCanonicalPoolSceneId())
    expect(gateway.embed).toHaveBeenCalled()
  })
})
