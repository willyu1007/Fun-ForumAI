import { afterEach, describe, expect, it, vi } from 'vitest'
import { config } from '../../lib/config.js'
import { InMemoryImagePlanRepository } from '../../repos/image-plan-repository.js'
import { InMemoryMediaAssetRepository } from '../../repos/media-asset-repository.js'
import { InMemoryMediaCatalogCardRepository } from '../../repos/media-catalog-card-repository.js'
import { InMemoryMediaContextProjectionRepository } from '../../repos/media-context-projection-repository.js'
import { InMemoryMediaDuplicateClusterRepository } from '../../repos/media-duplicate-cluster-repository.js'
import { InMemoryMediaEmbeddingSnapshotRepository } from '../../repos/media-embedding-snapshot-repository.js'
import { InMemoryMediaGenerationJobRepository } from '../../repos/media-generation-job-repository.js'
import { InMemoryMediaRetrievalDocumentRepository } from '../../repos/media-retrieval-document-repository.js'
import { InMemoryMediaRetrievalSearchRepository } from '../../repos/media-retrieval-search-repository.js'
import { InMemoryMediaReusePolicyRepository } from '../../repos/media-reuse-policy-repository.js'
import { InMemoryMediaSemanticSnapshotRepository } from '../../repos/media-semantic-snapshot-repository.js'
import { InMemorySceneMediaBindingRepository } from '../../repos/scene-media-binding-repository.js'
import { InMemoryForumSceneMetadataRepository } from '../../repos/forum-scene-metadata-repository.js'
import type { PersistedVisualDirective } from '../../repos/types.js'
import type { StorageAdapter } from '../../services/storage-adapter.js'
import { buildMediaSemanticSummary } from '../../test-utils/media-fixtures.js'
import type { MediaEmbeddingGatewayInput } from '../media-embedding-gateway.js'
import { MediaBindingService } from '../media-binding-service.js'
import { MediaCatalogService } from '../media-catalog-service.js'
import { MediaDuplicateService } from '../media-duplicate-service.js'
import { MediaEmbeddingService } from '../media-embedding-service.js'
import { ImagePlannerService } from '../image-planner-service.js'
import { MediaProjectionService } from '../media-projection-service.js'
import { MediaRetrievalService } from '../media-retrieval-service.js'
import {
  MediaReuseGovernanceService,
  buildPlatformCanonicalPoolSceneId,
} from '../media-reuse-governance-service.js'

const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
const originalFeatureFlags = {
  mediaRetrievalV1: featureFlags.mediaRetrievalV1,
  mediaPlannerRetrievalV1: featureFlags.mediaPlannerRetrievalV1,
}

const VECTOR_TERMS = [
  'lantern',
  'harbor',
  'festival',
  'skyline',
  'archive',
  'city',
  'poster',
  'study',
  'market',
  'garden',
  'night',
  'bridge',
] as const

afterEach(() => {
  Object.assign(featureFlags, originalFeatureFlags)
  vi.restoreAllMocks()
})

function createStorageStub(
  availableKeys: string[] = [],
): Pick<StorageAdapter, 'getObject'> {
  const available = new Set(availableKeys)
  return {
    async getObject(key: string) {
      if (!available.has(key)) return null
      return {
        data: Buffer.from('image-bytes'),
        contentType: 'image/png',
        size: 11,
      }
    },
  }
}

function vectorize(text: string): number[] {
  const normalized = text.toLowerCase()
  return VECTOR_TERMS.map((term) => (normalized.includes(term) ? 1 : 0))
}

function buildDirective(): PersistedVisualDirective {
  return {
    id: 'directive-large-planner',
    schema_version: 'visual-directive.v1',
    scene_ref: {
      request_id: 'selection-large-planner',
      director_surface: 'scheduled_post',
      actor_surface: 'forum_post',
      community_id: 'community-1',
      episode_id: 'episode-large',
      selection_id: 'selection-large-planner',
      episode_plan_id: 'plan-large',
      local_intent_id: 'intent-large',
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
      hook: 'lantern harbor festival skyline',
      objective: 'highlight the lantern harbor festival mood',
      tone_hint: 'warm',
      relation_focus: 'none',
      semantic_query: 'lantern harbor festival skyline',
      required_elements: ['lantern festival', 'harbor skyline'],
      forbidden_elements: [],
      style_hint: null,
      aspect_ratio_hint: '4:5',
    },
    sourcing_policy: {
      allow_sources: ['platform_canonical'],
      prefer_order: ['platform_canonical'],
      allow_private_runtime_projection: false,
      allow_private_inspired_generation: false,
      allow_cross_agent_public: true,
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
    },
    budget: {
      generation_tier: 'none',
      sync_generation_ms_budget: 0,
      async_generation_allowed: false,
      max_generation_attempts: 0,
    },
    audit: {
      director_reason: 'planner-quality-regression',
      hard_constraints: [],
      soft_constraints: [],
    },
    created_at: new Date(),
    updated_at: new Date(),
  }
}

async function seedCanonicalAsset(input: {
  mediaAssetRepo: InMemoryMediaAssetRepository
  mediaSemanticSnapshotRepo: InMemoryMediaSemanticSnapshotRepository
  sceneMediaBindingRepo: InMemorySceneMediaBindingRepository
  id: string
  storage_key: string
  sha256: string
  phash?: string | null
  theme: string
  scene: string
  caption: string
  tags?: string[]
}) {
  const asset = await input.mediaAssetRepo.create({
    id: input.id,
    steward_agent_id: 'agent-1',
    owner_user_id: 'owner-1',
    source_kind: 'owner_console_upload',
    visibility_policy: 'public_original_allowed',
    lifecycle_status: 'active',
    storage_key: input.storage_key,
    mime_type: 'image/png',
    file_size_bytes: 1024,
    sha256: input.sha256,
    phash: input.phash ?? null,
  })
  const snapshot = await input.mediaSemanticSnapshotRepo.create({
    asset_id: asset.id,
    snapshot_kind: 'visual_core',
    schema_version: 'visual_core.v1',
    model_provider: 'test',
    model_name: 'test',
    model_version: '1',
    summary: buildMediaSemanticSummary({
      theme: input.theme,
      scene: input.scene,
      mood: 'vivid',
      discussion_points: input.tags ?? [input.theme],
      salient_entities: input.tags?.slice(0, 3) ?? ['entity'],
      public_safe_summary: input.caption,
      internal_full_summary: input.caption,
    }),
    extraction_status: 'completed',
    quality_grade: 'rich',
    is_current: true,
  })
  await input.sceneMediaBindingRepo.create({
    scene_type: 'media_pool',
    scene_id: buildPlatformCanonicalPoolSceneId(),
    asset_id: asset.id,
    semantic_snapshot_id: snapshot.id,
    binding_role: 'reference',
    relation_to_scene: 'selected_for_post',
    display_policy: 'original_allowed',
    created_by_type: 'system',
    created_by_id: 'system',
  })
  return { asset, snapshot }
}

describe('image planner retrieval quality regression', () => {
  it('promotes the semantically tagged canonical target across a large candidate pool when retrieval is enabled', async () => {
    Object.assign(featureFlags, {
      mediaRetrievalV1: true,
      mediaPlannerRetrievalV1: true,
    })

    const imagePlanRepo = new InMemoryImagePlanRepository()
    const mediaAssetRepo = new InMemoryMediaAssetRepository()
    const mediaSemanticSnapshotRepo = new InMemoryMediaSemanticSnapshotRepository()
    const sceneMediaBindingRepo = new InMemorySceneMediaBindingRepository()
    const forumSceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
    const mediaContextProjectionRepo = new InMemoryMediaContextProjectionRepository()
    const mediaCatalogCardRepo = new InMemoryMediaCatalogCardRepository()
    const mediaRetrievalDocumentRepo = new InMemoryMediaRetrievalDocumentRepository()
    const mediaEmbeddingSnapshotRepo = new InMemoryMediaEmbeddingSnapshotRepository()
    const mediaDuplicateClusterRepo = new InMemoryMediaDuplicateClusterRepository()
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
      mediaBindingService: new MediaBindingService({
        sceneMediaBindingRepo,
      }),
    })
    const mediaCatalogService = new MediaCatalogService({
      mediaCatalogCardRepo,
      mediaSemanticSnapshotRepo,
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
    const mediaEmbeddingService = new MediaEmbeddingService({
      mediaEmbeddingSnapshotRepo,
      gateway: embeddingGateway,
    })
    const mediaDuplicateService = new MediaDuplicateService({
      mediaAssetRepo,
      mediaDuplicateClusterRepo,
    })
    const mediaRetrievalSearchRepo = new InMemoryMediaRetrievalSearchRepository({
      listDocuments: () => mediaRetrievalDocumentRepo.listAll(),
      listSnapshots: () => mediaEmbeddingSnapshotRepo.listAll(),
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

    const availableKeys: string[] = []
    for (let index = 0; index < 18; index += 1) {
      const distractor = await seedCanonicalAsset({
        mediaAssetRepo,
        mediaSemanticSnapshotRepo,
        sceneMediaBindingRepo,
        id: `asset-distractor-${index}`,
        storage_key: `platform/distractor-${index}.png`,
        sha256: `sha-distractor-${index}`,
        theme: index % 2 === 0 ? 'garden study' : 'market study',
        scene: index % 2 === 0 ? 'garden sketchbook at dusk' : 'market poster with paper layers',
        caption: index % 2 === 0
          ? 'A quiet garden sketchbook study.'
          : 'A layered market poster study.',
        tags: index % 2 === 0 ? ['garden', 'study'] : ['market', 'poster'],
      })
      availableKeys.push(distractor.asset.storage_key!)
    }

    const legacyStrong = await seedCanonicalAsset({
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      id: 'asset-legacy-strong',
      storage_key: 'platform/legacy-strong.png',
      sha256: 'sha-legacy-strong',
      theme: 'city skyline study',
      scene: 'harbor skyline with evening lanterns',
      caption: 'A harbor skyline with evening lantern reflections.',
      tags: ['city', 'skyline', 'harbor'],
    })
    availableKeys.push(legacyStrong.asset.storage_key!)

    const targetCanonicalSeed = await seedCanonicalAsset({
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      id: 'asset-target-canonical',
      storage_key: 'platform/target-canonical.png',
      sha256: 'sha-target-canonical',
      phash: 'phash-target-cluster',
      theme: 'poster collage',
      scene: 'abstract paper layers',
      caption: 'A layered poster collage with paper textures.',
      tags: ['poster', 'archive'],
    })
    availableKeys.push(targetCanonicalSeed.asset.storage_key!)
    const targetDuplicateSeed = await seedCanonicalAsset({
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      id: 'asset-target-duplicate',
      storage_key: 'platform/target-duplicate.png',
      sha256: 'sha-target-duplicate',
      phash: 'phash-target-cluster',
      theme: 'poster collage',
      scene: 'abstract paper layers',
      caption: 'A layered poster collage variant.',
      tags: ['poster', 'archive'],
    })
    availableKeys.push(targetDuplicateSeed.asset.storage_key!)

    await mediaDuplicateService.reconcileAssetClusters(targetDuplicateSeed.asset)
    const targetCanonical = await mediaAssetRepo.findById(targetCanonicalSeed.asset.id)
    const targetDuplicate = await mediaAssetRepo.findById(targetDuplicateSeed.asset.id)
    expect(targetCanonical?.duplicate_cluster_id).toBeTruthy()
    expect(targetCanonical?.duplicate_distance).toBe(0)
    expect(targetDuplicate?.duplicate_distance).toBe(1)

    for (const assetId of [
      targetCanonicalSeed.asset.id,
      targetDuplicateSeed.asset.id,
      legacyStrong.asset.id,
      ...Array.from({ length: 18 }, (_, index) => `asset-distractor-${index}`),
    ]) {
      const asset = await mediaAssetRepo.findById(assetId)
      const snapshot = asset ? await mediaSemanticSnapshotRepo.findCurrentByAssetId(asset.id) : null
      if (!asset || !snapshot) {
        throw new Error(`missing seeded asset or snapshot for ${assetId}`)
      }
      await mediaRetrievalService.ensureAssetIndexed({
        asset,
        snapshot,
        source_kind: 'platform_canonical',
        target_scope: {
          owner_user_id: asset.owner_user_id,
          steward_agent_id: asset.steward_agent_id,
          community_id: null,
        },
        annotations: asset.id === 'asset-target-canonical' || asset.id === 'asset-target-duplicate'
          ? {
              tags: ['lantern', 'harbor', 'festival', 'skyline'],
            }
          : asset.id === 'asset-legacy-strong'
            ? {
                tags: ['harbor', 'skyline'],
              }
            : undefined,
      })
    }

    const directive = buildDirective()
    const plannerWithoutRetrieval = new ImagePlannerService({
      imagePlanRepo,
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      mediaContextProjectionRepo,
      forumSceneMetadataRepo,
      mediaProjectionService,
      mediaReuseGovernanceService,
      storage: createStorageStub(availableKeys),
    })

    Object.assign(featureFlags, {
      mediaRetrievalV1: false,
      mediaPlannerRetrievalV1: false,
    })
    const legacyPlan = await plannerWithoutRetrieval.planScheduledPost({
      agent_id: 'agent-1',
      directive: {
        ...directive,
        id: 'directive-legacy-only',
      },
    })
    const legacySelected = legacyPlan.selected_sources.find((item) => !item.rejection_reason)
    expect(legacyPlan.status).toBe('ready')
    expect(legacySelected?.asset_id).toBe('asset-legacy-strong')

    Object.assign(featureFlags, {
      mediaRetrievalV1: true,
      mediaPlannerRetrievalV1: true,
    })
    const plannerWithRetrieval = new ImagePlannerService({
      imagePlanRepo,
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      mediaContextProjectionRepo,
      forumSceneMetadataRepo,
      mediaProjectionService,
      mediaReuseGovernanceService,
      mediaRetrievalService,
      storage: createStorageStub(availableKeys),
    })

    const retrievalPlan = await plannerWithRetrieval.planScheduledPost({
      agent_id: 'agent-1',
      directive: {
        ...directive,
        id: 'directive-with-retrieval',
      },
    })

    const selected = retrievalPlan.selected_sources.find((item) => !item.rejection_reason)
    expect(retrievalPlan.status).toBe('ready')
    expect(selected?.asset_id).toBe('asset-target-canonical')
    expect(selected?.score_breakdown?.semantic_retrieval_bonus).toBeGreaterThan(0)
    expect(selected?.selection_score).toBeGreaterThan(legacySelected?.selection_score ?? 0)
    expect(retrievalPlan.display.attachments[0]?.asset_id).toBe('asset-target-canonical')
    expect(retrievalPlan.selected_sources.find((item) => item.asset_id === 'asset-target-duplicate')?.rejection_reason)
      .toBeTruthy()
  })

  it('falls back to legacy planning when semantic retrieval throws across a large candidate pool', async () => {
    Object.assign(featureFlags, {
      mediaRetrievalV1: true,
      mediaPlannerRetrievalV1: true,
    })

    const imagePlanRepo = new InMemoryImagePlanRepository()
    const mediaAssetRepo = new InMemoryMediaAssetRepository()
    const mediaSemanticSnapshotRepo = new InMemoryMediaSemanticSnapshotRepository()
    const sceneMediaBindingRepo = new InMemorySceneMediaBindingRepository()
    const forumSceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
    const mediaContextProjectionRepo = new InMemoryMediaContextProjectionRepository()
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
      mediaBindingService: new MediaBindingService({
        sceneMediaBindingRepo,
      }),
    })

    const availableKeys: string[] = []
    for (let index = 0; index < 20; index += 1) {
      const seeded = await seedCanonicalAsset({
        mediaAssetRepo,
        mediaSemanticSnapshotRepo,
        sceneMediaBindingRepo,
        id: `asset-fallback-${index}`,
        storage_key: `platform/fallback-${index}.png`,
        sha256: `sha-fallback-${index}`,
        theme: index === 0 ? 'city skyline study' : 'garden study',
        scene: index === 0 ? 'harbor skyline with evening lanterns' : 'garden sketchbook at dusk',
        caption: index === 0
          ? 'A harbor skyline with evening lantern reflections.'
          : 'A quiet garden sketchbook study.',
        tags: index === 0 ? ['city', 'skyline', 'harbor'] : ['garden', 'study'],
      })
      availableKeys.push(seeded.asset.storage_key!)
    }

    const planner = new ImagePlannerService({
      imagePlanRepo,
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      mediaContextProjectionRepo,
      forumSceneMetadataRepo,
      mediaProjectionService,
      mediaReuseGovernanceService,
      mediaRetrievalService: {
        searchPlannerCandidates: async () => {
          throw new Error('synthetic retrieval outage')
        },
      },
      storage: createStorageStub(availableKeys),
    })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const plan = await planner.planScheduledPost({
      agent_id: 'agent-1',
      directive: {
        ...buildDirective(),
        id: 'directive-fallback-retrieval-throw',
      },
    })

    const selected = plan.selected_sources.find((item) => !item.rejection_reason)
    expect(plan.status).toBe('ready')
    expect(selected?.asset_id).toBe('asset-fallback-0')
    expect(warnSpy).toHaveBeenCalledWith(
      '[ImagePlannerService] semantic retrieval fallback to legacy candidates:',
      expect.any(Error),
    )
  })
})
