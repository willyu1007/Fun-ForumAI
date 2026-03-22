import { afterEach, describe, expect, it, vi } from 'vitest'
import { config } from '../../lib/config.js'
import { InMemoryImagePlanRepository } from '../../repos/image-plan-repository.js'
import { InMemoryMediaGenerationJobRepository } from '../../repos/media-generation-job-repository.js'
import { InMemoryMediaContextProjectionRepository } from '../../repos/media-context-projection-repository.js'
import { MediaGenerationService } from '../media-generation-service.js'
import type {
  MediaAsset,
  MediaContextProjection,
  MediaSemanticSnapshot,
  PersistedImagePlan,
  PublicMediaContextCard,
  SceneMediaBinding,
} from '../../repos/types.js'

function buildPlanCard(projectionId: string): PublicMediaContextCard {
  return {
    schema_version: 'public-media-context-card.v1',
    card_id: 'card-1',
    modality: 'image',
    asset_ref: {
      asset_id: 'asset-source-1',
      semantic_snapshot_id: 'snapshot-source-1',
      projection_id: projectionId,
    },
    source: {
      kind: 'private_runtime_projection',
      derived_from_private: true,
    },
    relation: {
      visual_role: 'scene_establishing',
      prompt_weight: 'primary',
      mention_policy: 'explicit_describe',
      why_now: '用于开场建立场景和阅读锚点。',
    },
    public_summary: {
      theme: 'travel',
      scene: 'city skyline',
      mood: 'bright',
      salient_entities: ['city'],
      discussion_points: ['城市氛围'],
      public_safe_caption: 'A bright city skyline.',
      alt_text: 'A bright city skyline.',
    },
    display: {
      original_display_allowed: false,
      derivative_display_allowed: true,
      preferred_variant: 'derivative',
    },
    governance: {
      public_scope: 'community_public',
      disclose_origin_policy: 'never',
      cross_agent_quote_allowed: false,
      prohibited_reference_types: ['owner_private_speech', 'private_memory', 'hidden_director_goal'],
      expires_at: null,
    },
    audit: {
      confidence: 0.9,
      relevance_score: 0.9,
      model_version: 'test',
    },
  }
}

function buildPendingGenerationPlan(
  repo: InMemoryImagePlanRepository,
  input: {
    planId: string
    projectionId: string
    fingerprint?: string
  },
): Promise<PersistedImagePlan> {
  return repo.create({
    id: input.planId,
    directive_id: 'directive-1',
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
    status: 'pending_generation',
    decision: 'generate_from_private_projection',
    reason: 'selected_private_runtime_projection_for_generation',
    runtime: {
      enabled: true,
      influence_level: 'medium',
      cards: [buildPlanCard(input.projectionId)],
    },
    display: {
      enabled: false,
      attachments: [],
    },
    generation: {
      mode: 'sync',
      status: 'not_requested',
      request_fingerprint: input.fingerprint ?? 'fp-1',
      based_on_projection_ids: [input.projectionId],
      prompt_brief: 'scene=city skyline',
      attempt_count: 0,
    },
    selected_sources: [
      {
        source_kind: 'private_runtime_projection',
        asset_id: 'asset-source-1',
        projection_id: input.projectionId,
        reuse_mode: 'derive_new',
        selection_score: 3.2,
      },
    ],
    planner_audit: {
      evaluated_candidates: 1,
      score_breakdown: {
        relevance: 0.9,
        continuity: 0.7,
        novelty: 0.9,
        privacy_safety: 1,
        display_fitness: 0.8,
        cost_fitness: 0.85,
        fatigue_penalty: 0,
        repeat_penalty: 0,
        risk_penalty: 0,
        total: 5.15,
      },
      fallback_action: 'runtime_only_no_display',
    },
  })
}

describe('MediaGenerationService', () => {
  const originalMediaGeneration = { ...config.mediaGeneration }
  const originalFeatureFlags = {
    mediaGenerationV1: config.features.mediaGenerationV1,
  }

  afterEach(() => {
    Object.assign(config.mediaGeneration, originalMediaGeneration)
    Object.assign(config.features, originalFeatureFlags)
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('deduplicates jobs by request_fingerprint for the same image plan intent', async () => {
    const imagePlanRepo = new InMemoryImagePlanRepository()
    const mediaGenerationJobRepo = new InMemoryMediaGenerationJobRepository()
    const mediaContextProjectionRepo = new InMemoryMediaContextProjectionRepository()
    const plan = await buildPendingGenerationPlan(imagePlanRepo, {
      planId: 'image-plan-1',
      projectionId: 'projection-1',
    })
    const service = new MediaGenerationService({
      imagePlanRepo,
      mediaGenerationJobRepo,
      mediaContextProjectionRepo,
      mediaAssetService: {} as never,
      mediaReuseGovernanceService: {} as never,
      mediaProjectionService: {} as never,
      gateway: {
        providerId: 'ark-seedream',
        modelName: 'doubao-seedream-5-0-lite-260128',
        isConfigured: false,
        generate: vi.fn(),
      },
    })

    const first = await service.ensureJobForPlan({
      agent_id: 'agent-1',
      plan,
    })
    const second = await service.ensureJobForPlan({
      agent_id: 'agent-1',
      plan: first.plan,
    })

    expect(first.job?.id).toBeTruthy()
    expect(second.job?.id).toBe(first.job?.id)
    expect(second.plan.generation.job_id).toBe(first.job?.id)
  })

  it('processes a queued job, ingests the derivative, and upgrades the plan to ready', async () => {
    Object.assign(config.features, {
      mediaGenerationV1: true,
    })
    Object.assign(config.mediaGeneration, {
      pollIntervalMs: 5,
      downloadTimeoutMs: 5_000,
      runningTimeoutMs: 60_000,
      globalConcurrency: 1,
      providerConcurrency: 1,
    })

    const imagePlanRepo = new InMemoryImagePlanRepository()
    const mediaGenerationJobRepo = new InMemoryMediaGenerationJobRepository()
    const mediaContextProjectionRepo = new InMemoryMediaContextProjectionRepository()
    const projection = await mediaContextProjectionRepo.create({
      id: 'projection-1',
      binding_id: 'binding-private-1',
      projection_surface: 'planner',
      projection_kind: 'public_reuse_handoff',
      schema_version: 'public-reuse-handoff.v1',
      payload_json: {},
    })
    const plan = await buildPendingGenerationPlan(imagePlanRepo, {
      planId: 'image-plan-1',
      projectionId: projection.id,
    })
    await mediaGenerationJobRepo.create({
      id: 'job-1',
      agent_id: 'agent-1',
      plan_id: plan.id,
      status: 'queued',
      provider: 'ark-seedream',
      model_name: 'doubao-seedream-5-0-lite-260128',
      request_fingerprint: 'fp-1',
      prompt_brief: 'scene=city skyline',
      aspect_ratio_hint: '4:5',
      based_on_projection_ids: [projection.id],
      attempt_count: 0,
    })

    const generatedAsset: MediaAsset = {
      id: 'asset-generated-1',
      steward_agent_id: 'agent-1',
      owner_user_id: null,
      source_kind: 'generated',
      source_scene_type: null,
      source_scene_id: plan.id,
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
      storage_key: 'generated/asset-generated-1.png',
      origin_url: null,
      mime_type: 'image/png',
      file_size_bytes: 2048,
      width: 1024,
      height: 1280,
      sha256: 'sha-generated-1',
      phash: null,
      created_at: new Date(),
      updated_at: new Date(),
    }
    const generatedSnapshot: MediaSemanticSnapshot = {
      id: 'snapshot-generated-1',
      asset_id: generatedAsset.id,
      snapshot_kind: 'visual_core',
      schema_version: 'visual_core.v1',
      model_provider: 'test',
      model_name: 'test',
      model_version: '1',
      summary: {
        theme: 'travel',
        scene: 'city skyline',
        mood: 'bright',
        discussion_points: ['城市氛围'],
        salient_entities: ['city'],
        ocr_snippets: [],
        safety_labels: [],
        public_safe_summary: 'A bright city skyline.',
        internal_full_summary: 'A bright city skyline.',
      },
      extraction_status: 'completed',
      quality_grade: 'rich',
      is_current: true,
      created_at: new Date(),
    }
    const generatedBinding: SceneMediaBinding = {
      id: 'binding-generated-1',
      scene_type: 'media_pool',
      scene_id: 'generated_public:agent-1',
      asset_id: generatedAsset.id,
      semantic_snapshot_id: generatedSnapshot.id,
      source_scene_type: null,
      source_scene_id: null,
      binding_role: 'reference',
      relation_to_scene: 'generated_for_scene',
      binding_note_text: null,
      display_policy: 'original_allowed',
      created_by_type: 'system',
      created_by_id: 'media-generation-service',
      created_at: new Date(),
    }
    const displayProjection: MediaContextProjection = {
      id: 'projection-display-1',
      binding_id: generatedBinding.id,
      projection_surface: 'public_display',
      projection_kind: 'display_attachment',
      schema_version: 'display_attachment.v1',
      payload_json: {},
      token_estimate: null,
      prompt_weight: null,
      mention_policy: null,
      preferred_display_variant: 'original',
      expires_at: null,
      created_at: new Date(),
    }
    const publicCard = buildPlanCard(projection.id)

    const ingestGeneratedDerivative = vi.fn(async () => ({
      asset: generatedAsset,
      snapshot: generatedSnapshot,
      media_url: '/media/generated/asset-generated-1.png',
    }))
    const registerGeneratedPublicAsset = vi.fn(async () => ({
      binding: generatedBinding,
      policy: {
        id: 'policy-generated-1',
        subject_type: 'asset' as const,
        subject_id: generatedAsset.id,
        source_kind: 'generated_public' as const,
        community_id: null,
        steward_agent_id: 'agent-1',
        allowed_reuse_modes: ['quote_original', 'derive_new', 'reference_only'] as const,
        cross_agent_quote_allowed: false,
        disclose_origin_policy: 'public_only' as const,
        copyright_state: 'generated_owned' as const,
        status: 'active' as const,
        revoked_at: null,
        revoked_reason: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    }))
    const createDisplayAttachmentProjection = vi.fn(async () => displayProjection)
    const ensurePublicMediaCard = vi.fn(async () => ({
      projection: {
        ...displayProjection,
        id: 'projection-card-1',
        projection_surface: 'public_runtime' as const,
        projection_kind: 'public_media_context_card' as const,
      },
      card: {
        ...publicCard,
        asset_ref: {
          ...publicCard.asset_ref,
          asset_id: generatedAsset.id,
          semantic_snapshot_id: generatedSnapshot.id,
        },
        source: {
          kind: 'generated_public' as const,
          derived_from_private: false,
        },
      },
    }))
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const service = new MediaGenerationService({
      imagePlanRepo,
      mediaGenerationJobRepo,
      mediaContextProjectionRepo,
      mediaAssetService: {
        ingestGeneratedDerivative,
        getAssetById: vi.fn(async () => generatedAsset),
      } as never,
      mediaReuseGovernanceService: {
        registerGeneratedPublicAsset,
      } as never,
      mediaProjectionService: {
        createDisplayAttachmentProjection,
        ensurePublicMediaCard,
      } as never,
      gateway: {
        providerId: 'ark-seedream',
        modelName: 'doubao-seedream-5-0-lite-260128',
        isConfigured: true,
        generate: vi.fn(async () => ({
          image_url: 'https://provider.example.com/generated.png',
          mime_type: 'image/png',
        })),
      },
    })

    const job = await service.processNextQueuedJob()
    const updatedPlan = await imagePlanRepo.findById(plan.id)

    expect(job?.status).toBe('succeeded')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(ingestGeneratedDerivative).toHaveBeenCalledTimes(1)
    expect(registerGeneratedPublicAsset).toHaveBeenCalledTimes(1)
    expect(createDisplayAttachmentProjection).toHaveBeenCalledTimes(1)
    expect(ensurePublicMediaCard).toHaveBeenCalledTimes(1)
    expect(updatedPlan?.status).toBe('ready')
    expect(updatedPlan?.generation.status).toBe('succeeded')
    expect(updatedPlan?.display.attachments[0]?.display_variant).toBe('generated_derivative')
    expect(updatedPlan?.display.attachments[0]?.asset_id).toBe(generatedAsset.id)
  })

  it('syncs all linked plans when a deduplicated job succeeds', async () => {
    Object.assign(config.features, {
      mediaGenerationV1: true,
    })
    Object.assign(config.mediaGeneration, {
      pollIntervalMs: 5,
      downloadTimeoutMs: 5_000,
      runningTimeoutMs: 60_000,
      globalConcurrency: 1,
      providerConcurrency: 1,
    })

    const imagePlanRepo = new InMemoryImagePlanRepository()
    const mediaGenerationJobRepo = new InMemoryMediaGenerationJobRepository()
    const mediaContextProjectionRepo = new InMemoryMediaContextProjectionRepository()
    const projection = await mediaContextProjectionRepo.create({
      id: 'projection-dup-1',
      binding_id: 'binding-private-dup-1',
      projection_surface: 'planner',
      projection_kind: 'public_reuse_handoff',
      schema_version: 'public-reuse-handoff.v1',
      payload_json: {},
    })
    const firstPlan = await buildPendingGenerationPlan(imagePlanRepo, {
      planId: 'image-plan-1',
      projectionId: projection.id,
      fingerprint: 'fp-dedup-1',
    })
    const secondPlan = await buildPendingGenerationPlan(imagePlanRepo, {
      planId: 'image-plan-2',
      projectionId: projection.id,
      fingerprint: 'fp-dedup-1',
    })
    const schedulingService = new MediaGenerationService({
      imagePlanRepo,
      mediaGenerationJobRepo,
      mediaContextProjectionRepo,
      mediaAssetService: {} as never,
      mediaReuseGovernanceService: {} as never,
      mediaProjectionService: {} as never,
      gateway: {
        providerId: 'ark-seedream',
        modelName: 'doubao-seedream-5-0-lite-260128',
        isConfigured: false,
        generate: vi.fn(),
      },
    })

    const scheduledFirst = await schedulingService.ensureJobForPlan({
      agent_id: 'agent-1',
      plan: firstPlan,
    })
    const scheduledSecond = await schedulingService.ensureJobForPlan({
      agent_id: 'agent-1',
      plan: secondPlan,
    })

    expect(scheduledSecond.job?.id).toBe(scheduledFirst.job?.id)

    const generatedAsset: MediaAsset = {
      id: 'asset-generated-dedup-1',
      steward_agent_id: 'agent-1',
      owner_user_id: null,
      source_kind: 'generated',
      source_scene_type: null,
      source_scene_id: scheduledFirst.job?.id ?? null,
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
      storage_key: 'generated/asset-generated-dedup-1.png',
      origin_url: null,
      mime_type: 'image/png',
      file_size_bytes: 2048,
      width: 1024,
      height: 1280,
      sha256: 'sha-generated-dedup-1',
      phash: null,
      created_at: new Date(),
      updated_at: new Date(),
    }
    const generatedSnapshot: MediaSemanticSnapshot = {
      id: 'snapshot-generated-dedup-1',
      asset_id: generatedAsset.id,
      snapshot_kind: 'visual_core',
      schema_version: 'visual_core.v1',
      model_provider: 'test',
      model_name: 'test',
      model_version: '1',
      summary: {
        theme: 'travel',
        scene: 'city skyline',
        mood: 'bright',
        discussion_points: ['城市氛围'],
        salient_entities: ['city'],
        ocr_snippets: [],
        safety_labels: [],
        public_safe_summary: 'A bright city skyline.',
        internal_full_summary: 'A bright city skyline.',
      },
      extraction_status: 'completed',
      quality_grade: 'rich',
      is_current: true,
      created_at: new Date(),
    }
    const generatedBinding: SceneMediaBinding = {
      id: 'binding-generated-dedup-1',
      scene_type: 'media_pool',
      scene_id: 'generated_public:agent-1',
      asset_id: generatedAsset.id,
      semantic_snapshot_id: generatedSnapshot.id,
      source_scene_type: null,
      source_scene_id: null,
      binding_role: 'reference',
      relation_to_scene: 'generated_for_scene',
      binding_note_text: null,
      display_policy: 'original_allowed',
      created_by_type: 'system',
      created_by_id: 'media-generation-service',
      created_at: new Date(),
    }
    const displayProjection: MediaContextProjection = {
      id: 'projection-display-dedup-1',
      binding_id: generatedBinding.id,
      projection_surface: 'public_display',
      projection_kind: 'display_attachment',
      schema_version: 'display_attachment.v1',
      payload_json: {},
      token_estimate: null,
      prompt_weight: null,
      mention_policy: null,
      preferred_display_variant: 'original',
      expires_at: null,
      created_at: new Date(),
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const runningService = new MediaGenerationService({
      imagePlanRepo,
      mediaGenerationJobRepo,
      mediaContextProjectionRepo,
      mediaAssetService: {
        ingestGeneratedDerivative: vi.fn(async () => ({
          asset: generatedAsset,
          snapshot: generatedSnapshot,
          media_url: '/media/generated/asset-generated-dedup-1.png',
        })),
        getAssetById: vi.fn(async () => generatedAsset),
      } as never,
      mediaReuseGovernanceService: {
        registerGeneratedPublicAsset: vi.fn(async () => ({
          binding: generatedBinding,
          policy: {
            id: 'policy-generated-dedup-1',
            subject_type: 'asset' as const,
            subject_id: generatedAsset.id,
            source_kind: 'generated_public' as const,
            community_id: null,
            steward_agent_id: 'agent-1',
            allowed_reuse_modes: ['quote_original', 'derive_new', 'reference_only'] as const,
            cross_agent_quote_allowed: false,
            disclose_origin_policy: 'public_only' as const,
            copyright_state: 'generated_owned' as const,
            status: 'active' as const,
            revoked_at: null,
            revoked_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        })),
      } as never,
      mediaProjectionService: {
        createDisplayAttachmentProjection: vi.fn(async () => displayProjection),
        ensurePublicMediaCard: vi.fn(async () => ({
          projection: {
            ...displayProjection,
            id: 'projection-card-dedup-1',
            projection_surface: 'public_runtime' as const,
            projection_kind: 'public_media_context_card' as const,
          },
          card: buildPlanCard(projection.id),
        })),
      } as never,
      gateway: {
        providerId: 'ark-seedream',
        modelName: 'doubao-seedream-5-0-lite-260128',
        isConfigured: true,
        generate: vi.fn(async () => ({
          image_url: 'https://provider.example.com/generated-dedup.png',
          mime_type: 'image/png',
        })),
      },
    })

    await runningService.processNextQueuedJob()
    const updatedFirst = await imagePlanRepo.findById('image-plan-1')
    const updatedSecond = await imagePlanRepo.findById('image-plan-2')

    expect(updatedFirst?.status).toBe('ready')
    expect(updatedSecond?.status).toBe('ready')
    expect(updatedFirst?.generation.status).toBe('succeeded')
    expect(updatedSecond?.generation.status).toBe('succeeded')
    expect(updatedFirst?.display.attachments[0]?.display_variant).toBe('generated_derivative')
    expect(updatedSecond?.display.attachments[0]?.display_variant).toBe('generated_derivative')
  })

  it('marks stale running jobs timed_out and degrades linked plans', async () => {
    Object.assign(config.features, {
      mediaGenerationV1: true,
    })
    Object.assign(config.mediaGeneration, {
      pollIntervalMs: 5,
      downloadTimeoutMs: 5_000,
      runningTimeoutMs: 10,
      globalConcurrency: 1,
      providerConcurrency: 1,
    })

    const imagePlanRepo = new InMemoryImagePlanRepository()
    const mediaGenerationJobRepo = new InMemoryMediaGenerationJobRepository()
    const mediaContextProjectionRepo = new InMemoryMediaContextProjectionRepository()
    const projection = await mediaContextProjectionRepo.create({
      id: 'projection-timeout-1',
      binding_id: 'binding-private-timeout-1',
      projection_surface: 'planner',
      projection_kind: 'public_reuse_handoff',
      schema_version: 'public-reuse-handoff.v1',
      payload_json: {},
    })
    const plan = await buildPendingGenerationPlan(imagePlanRepo, {
      planId: 'image-plan-timeout-1',
      projectionId: projection.id,
      fingerprint: 'fp-timeout-1',
    })
    await imagePlanRepo.update(plan.id, {
      generation: {
        ...plan.generation,
        job_id: 'job-timeout-1',
        status: 'running',
      },
    })
    await mediaGenerationJobRepo.create({
      id: 'job-timeout-1',
      agent_id: 'agent-1',
      plan_id: plan.id,
      status: 'running',
      provider: 'ark-seedream',
      model_name: 'doubao-seedream-5-0-lite-260128',
      request_fingerprint: 'fp-timeout-1',
      prompt_brief: 'scene=city skyline',
      aspect_ratio_hint: '4:5',
      based_on_projection_ids: [projection.id],
      attempt_count: 1,
      started_at: new Date(Date.now() - 5_000),
    })
    const service = new MediaGenerationService({
      imagePlanRepo,
      mediaGenerationJobRepo,
      mediaContextProjectionRepo,
      mediaAssetService: {} as never,
      mediaReuseGovernanceService: {} as never,
      mediaProjectionService: {} as never,
      gateway: {
        providerId: 'ark-seedream',
        modelName: 'doubao-seedream-5-0-lite-260128',
        isConfigured: true,
        generate: vi.fn(),
      },
    })

    const nextJob = await service.processNextQueuedJob()
    const timedOutJob = await mediaGenerationJobRepo.findById('job-timeout-1')
    const updatedPlan = await imagePlanRepo.findById(plan.id)

    expect(nextJob).toBeNull()
    expect(timedOutJob?.status).toBe('timed_out')
    expect(timedOutJob?.error_code).toBe('running_timeout')
    expect(updatedPlan?.status).toBe('degraded')
    expect(updatedPlan?.generation.status).toBe('timed_out')
  })
})
