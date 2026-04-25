import { describe, expect, it } from 'vitest'
import { InMemoryImagePlanRepository } from '../../repos/image-plan-repository.js'
import { InMemoryMediaAssetRepository } from '../../repos/media-asset-repository.js'
import { InMemoryMediaSemanticSnapshotRepository } from '../../repos/media-semantic-snapshot-repository.js'
import { InMemorySceneMediaBindingRepository } from '../../repos/scene-media-binding-repository.js'
import { InMemoryForumSceneMetadataRepository } from '../../repos/forum-scene-metadata-repository.js'
import { InMemoryMediaContextProjectionRepository } from '../../repos/media-context-projection-repository.js'
import { InMemoryMediaGenerationJobRepository } from '../../repos/media-generation-job-repository.js'
import { InMemoryMediaReusePolicyRepository } from '../../repos/media-reuse-policy-repository.js'
import { InMemoryMediaScenePackRepository } from '../../repos/media-scene-pack-repository.js'
import { MediaProjectionService } from '../media-projection-service.js'
import { ImagePlannerService } from '../image-planner-service.js'
import { MediaBindingService, buildOwnerPrivatePoolSceneId } from '../media-binding-service.js'
import { MediaReuseGovernanceService } from '../media-reuse-governance-service.js'
import { MediaScenePackService } from '../media-scene-pack-service.js'
import type { PersistedVisualDirective } from '../../repos/types.js'
import type { StorageAdapter } from '../../services/storage-adapter.js'
import { buildMediaSemanticSummary } from '../../test-utils/media-fixtures.js'

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

function buildDirective(): PersistedVisualDirective {
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
      hook: '推进讨论',
      objective: '增加连贯性',
      tone_hint: 'neutral',
      relation_focus: 'none',
      semantic_query: '推进讨论',
      required_elements: ['推进讨论'],
      forbidden_elements: [],
      style_hint: null,
      aspect_ratio_hint: '4:5',
    },
    sourcing_policy: {
      allow_sources: ['self_public_archive', 'same_episode_public', 'same_thread_public', 'owner_private_pool'],
      prefer_order: ['self_public_archive', 'same_episode_public', 'same_thread_public', 'owner_private_pool'],
      allow_private_runtime_projection: true,
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

async function seedPrivateRuntimeProjectionCandidate(input: {
  mediaAssetRepo: InMemoryMediaAssetRepository
  mediaSemanticSnapshotRepo: InMemoryMediaSemanticSnapshotRepository
  sceneMediaBindingRepo: InMemorySceneMediaBindingRepository
  mediaProjectionService: MediaProjectionService
}) {
  const asset = await input.mediaAssetRepo.create({
    id: 'asset-private-runtime',
    steward_agent_id: 'agent-1',
    owner_user_id: 'owner-1',
    source_kind: 'private_message_upload',
    source_scene_type: 'private_message',
    source_scene_id: 'message-private-1',
    visibility_policy: 'private_only',
    lifecycle_status: 'active',
    mime_type: 'image/png',
    file_size_bytes: 1024,
    sha256: 'sha-private-runtime',
  })
  const snapshot = await input.mediaSemanticSnapshotRepo.create({
    asset_id: asset.id,
    snapshot_kind: 'visual_core',
    schema_version: 'visual_core.v1',
    model_provider: 'test',
    model_name: 'test',
    model_version: '1',
    summary: buildMediaSemanticSummary({
      theme: 'coffee',
      scene: 'tabletop',
      mood: 'warm',
      discussion_points: ['桌面暖光'],
      salient_entities: ['coffee cup'],
      public_safe_summary: 'A warm tabletop coffee scene.',
      internal_full_summary: 'private-photo-detail',
    }),
    extraction_status: 'completed',
    quality_grade: 'rich',
    is_current: true,
  })
  const binding = await input.sceneMediaBindingRepo.create({
    scene_type: 'private_message',
    scene_id: 'message-private-1',
    asset_id: asset.id,
    semantic_snapshot_id: snapshot.id,
    binding_role: 'inline',
    relation_to_scene: 'attached_to_private_message',
    display_policy: 'original_allowed',
    created_by_type: 'owner',
    created_by_id: 'owner-1',
  })
  await input.mediaProjectionService.createPublicReuseHandoffProjection({
    binding,
    asset,
    snapshot,
    source_kind: 'private_message_upload',
    why_relevant_hint: '最近私聊里分享过这张图。',
    allowed_reuse_modes: ['derive_new', 'reference_only'],
    disclose_origin_policy: 'never',
  })
}

describe('ImagePlannerService', () => {
  it('adds scene pack prompt metadata to scratch generation plans', async () => {
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
    const service = new ImagePlannerService({
      imagePlanRepo,
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      mediaContextProjectionRepo,
      forumSceneMetadataRepo,
      mediaProjectionService,
      mediaReuseGovernanceService,
      mediaScenePackService: new MediaScenePackService({
        repo: new InMemoryMediaScenePackRepository(),
      }),
    })
    const directive = buildDirective()
    directive.goal.need_image = 'required'
    directive.narrative_context.hook = 'desktop workflow with notebook and reference papers'
    directive.narrative_context.objective = 'show a grounded debugging workflow'
    directive.narrative_context.semantic_query = 'desktop workflow tools notebook references'
    directive.narrative_context.required_elements = ['desktop workflow', 'notebook', 'reference papers']
    directive.sourcing_policy.allow_sources = []
    directive.sourcing_policy.prefer_order = []
    directive.sourcing_policy.allow_generation = true
    directive.budget.generation_tier = 'medium'
    directive.budget.async_generation_allowed = true
    directive.budget.max_generation_attempts = 1

    const plan = await service.planScheduledPost({
      agent_id: 'agent-1',
      directive,
    })

    expect(plan.decision).toBe('generate_from_scratch')
    expect(plan.generation.compiled_prompt?.template_id).toBe('scene-pack-prompt-compiler')
    expect(plan.generation.compiled_prompt?.scene_pack_ref).toEqual(expect.objectContaining({
      scene_id: 'desktop_workflow_photo',
      version: 1,
    }))
    expect(plan.generation.prompt_brief).toContain('scene_pack: desktop_workflow_photo@1')
  })

  it('downgrades owner_private_pool usage to runtime-only and keeps owner note out of runtime cards', async () => {
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
    const service = new ImagePlannerService({
      imagePlanRepo,
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      mediaContextProjectionRepo,
      forumSceneMetadataRepo,
      mediaProjectionService,
      mediaReuseGovernanceService,
      storage: createStorageStub(['thread-public/asset.png']),
    })

    const asset = await mediaAssetRepo.create({
      id: 'asset-1',
      steward_agent_id: 'agent-1',
      owner_user_id: 'owner-1',
      source_kind: 'owner_console_upload',
      visibility_policy: 'private_only',
      lifecycle_status: 'active',
      mime_type: 'image/png',
      file_size_bytes: 1024,
      sha256: 'sha-1',
    })
    const snapshot = await mediaSemanticSnapshotRepo.create({
      asset_id: asset.id,
      snapshot_kind: 'visual_core',
      schema_version: 'visual_core.v1',
      model_provider: 'test',
      model_name: 'test',
      model_version: '1',
      summary: buildMediaSemanticSummary({
        theme: 'travel',
        scene: 'city skyline',
        mood: 'bright',
        discussion_points: ['城市氛围'],
        salient_entities: ['city'],
        public_safe_summary: 'A bright city skyline.',
        internal_full_summary: 'owner-note-secret should stay private',
      }),
      extraction_status: 'completed',
      quality_grade: 'rich',
      is_current: true,
    })
    await sceneMediaBindingRepo.create({
      scene_type: 'memory_card',
      scene_id: buildOwnerPrivatePoolSceneId('agent-1'),
      asset_id: asset.id,
      semantic_snapshot_id: snapshot.id,
      binding_role: 'memory',
      relation_to_scene: 'uploaded_by_owner',
      binding_note_text: 'owner-note-secret',
      display_policy: 'runtime_only_no_display',
      created_by_type: 'owner',
      created_by_id: 'owner-1',
    })

    const plan = await service.planScheduledPost({
      agent_id: 'agent-1',
      directive: buildDirective(),
    })

    expect(plan.status).toBe('degraded')
    expect(plan.display.attachments).toHaveLength(0)
    expect(plan.runtime.cards).toHaveLength(1)
    expect(plan.runtime.cards[0]?.source.kind).toBe('owner_private_pool')
    expect(JSON.stringify(plan.runtime.cards[0])).not.toContain('owner-note-secret')
  })

  it('ignores same_episode_public assets from other agents when cross-agent reuse is disabled', async () => {
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
    const service = new ImagePlannerService({
      imagePlanRepo,
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      mediaContextProjectionRepo,
      forumSceneMetadataRepo,
      mediaProjectionService,
      mediaReuseGovernanceService,
      storage: createStorageStub(['thread-public/asset.png']),
    })

    const foreignAsset = await mediaAssetRepo.create({
      id: 'asset-foreign',
      steward_agent_id: 'agent-2',
      owner_user_id: 'owner-2',
      source_kind: 'owner_console_upload',
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
      storage_key: 'thread-public/asset.png',
      mime_type: 'image/png',
      file_size_bytes: 2048,
      sha256: 'sha-foreign',
    })
    const foreignSnapshot = await mediaSemanticSnapshotRepo.create({
      asset_id: foreignAsset.id,
      snapshot_kind: 'visual_core',
      schema_version: 'visual_core.v1',
      model_provider: 'test',
      model_name: 'test',
      model_version: '1',
      summary: buildMediaSemanticSummary({
        theme: 'travel',
        scene: 'bridge',
        mood: 'calm',
        discussion_points: ['延续上一条公开帖子'],
        salient_entities: ['bridge'],
        public_safe_summary: 'A calm bridge scene.',
        internal_full_summary: 'foreign-asset-private-detail',
      }),
      extraction_status: 'completed',
      quality_grade: 'rich',
      is_current: true,
    })
    await sceneMediaBindingRepo.create({
      scene_type: 'forum_post',
      scene_id: 'post-foreign-1',
      asset_id: foreignAsset.id,
      semantic_snapshot_id: foreignSnapshot.id,
      binding_role: 'primary',
      relation_to_scene: 'selected_for_post',
      display_policy: 'original_allowed',
      created_by_type: 'system',
      created_by_id: 'agent-2',
    })
    await forumSceneMetadataRepo.create({
      target_type: 'POST',
      community_id: 'community-1',
      post_id: 'post-foreign-1',
      episode_id: 'episode-1',
      selection_id: 'selection-foreign',
      episode_plan_id: 'plan-1',
      local_intent_id: 'intent-foreign',
      director_surface: 'scheduled_post',
      actor_surface: 'forum_post',
      scene_template_id: 'stage-theme-01',
      scene_template_version: 'v2',
      scene_binding_id: null,
      overlay_id: null,
      beat_id: null,
      phase: 'opening',
      selection_mode: 'pool_guided',
      expires_at: null,
      payload_json: {},
    })

    const plan = await service.planScheduledPost({
      agent_id: 'agent-1',
      directive: buildDirective(),
    })

    expect(plan.status).toBe('degraded')
    expect(plan.decision).toBe('none')
    expect(plan.selected_sources).toHaveLength(0)
  })

  it('does not treat runtime-only forum_post bindings as self_public_archive candidates', async () => {
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
    const service = new ImagePlannerService({
      imagePlanRepo,
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      mediaContextProjectionRepo,
      forumSceneMetadataRepo,
      mediaProjectionService,
      mediaReuseGovernanceService,
    })

    const asset = await mediaAssetRepo.create({
      id: 'asset-runtime-only',
      steward_agent_id: 'agent-1',
      owner_user_id: 'owner-1',
      source_kind: 'owner_console_upload',
      visibility_policy: 'private_only',
      lifecycle_status: 'active',
      mime_type: 'image/png',
      file_size_bytes: 1024,
      sha256: 'sha-runtime-only',
    })
    const snapshot = await mediaSemanticSnapshotRepo.create({
      asset_id: asset.id,
      snapshot_kind: 'visual_core',
      schema_version: 'visual_core.v1',
      model_provider: 'test',
      model_name: 'test',
      model_version: '1',
      summary: buildMediaSemanticSummary({
        theme: 'study',
        scene: 'desk',
        mood: 'quiet',
        discussion_points: ['只用于 runtime'],
        salient_entities: ['desk'],
        public_safe_summary: 'A quiet desk.',
        internal_full_summary: 'runtime-only-private-detail',
      }),
      extraction_status: 'completed',
      quality_grade: 'rich',
      is_current: true,
    })
    await sceneMediaBindingRepo.create({
      scene_type: 'forum_post',
      scene_id: 'post-runtime-only-1',
      asset_id: asset.id,
      semantic_snapshot_id: snapshot.id,
      binding_role: 'primary',
      relation_to_scene: 'derived_from_private',
      display_policy: 'runtime_only_no_display',
      created_by_type: 'system',
      created_by_id: 'agent-1',
    })

    const plan = await service.planScheduledPost({
      agent_id: 'agent-1',
      directive: buildDirective(),
    })

    expect(plan.status).toBe('degraded')
    expect(plan.decision).toBe('none')
    expect(plan.selected_sources).toHaveLength(0)
  })

  it('reuses same_thread_public assets across agents when thread_root_ref matches', async () => {
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
    const service = new ImagePlannerService({
      imagePlanRepo,
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      mediaContextProjectionRepo,
      forumSceneMetadataRepo,
      mediaProjectionService,
      mediaReuseGovernanceService,
    })

    const asset = await mediaAssetRepo.create({
      id: 'asset-thread-public-1',
      steward_agent_id: 'agent-2',
      owner_user_id: 'owner-2',
      source_kind: 'owner_console_upload',
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
      storage_key: 'thread-public/asset.png',
      mime_type: 'image/png',
      file_size_bytes: 2048,
      sha256: 'sha-thread-public-1',
    })
    const snapshot = await mediaSemanticSnapshotRepo.create({
      asset_id: asset.id,
      snapshot_kind: 'visual_core',
      schema_version: 'visual_core.v1',
      model_provider: 'test',
      model_name: 'test',
      model_version: '1',
      summary: buildMediaSemanticSummary({
        theme: 'travel',
        scene: 'river walk',
        mood: 'calm',
        discussion_points: ['延续同一 thread 的视觉线索'],
        salient_entities: ['river'],
        public_safe_summary: 'A calm river walk scene.',
        internal_full_summary: 'A calm river walk scene.',
      }),
      extraction_status: 'completed',
      quality_grade: 'rich',
      is_current: true,
    })
    await sceneMediaBindingRepo.create({
      scene_type: 'forum_thread',
      scene_id: 'thread-1',
      thread_root_ref: 'forum_thread:thread-1',
      asset_id: asset.id,
      semantic_snapshot_id: snapshot.id,
      binding_role: 'inline',
      relation_to_scene: 'quoted_public',
      display_policy: 'original_allowed',
      created_by_type: 'agent',
      created_by_id: 'agent-2',
    })

    const directive = buildDirective()
    directive.scene_ref.thread_root_ref = 'forum_thread:thread-1'
    directive.sourcing_policy.allow_sources = ['same_thread_public']
    directive.sourcing_policy.prefer_order = ['same_thread_public']

    const plan = await service.planScheduledPost({
      agent_id: 'agent-1',
      directive,
    })

    expect(plan.status).toBe('ready')
    expect(plan.display.attachments).toHaveLength(1)
    expect(plan.selected_sources[0]?.source_kind).toBe('same_thread_public')
  })

  it('prioritizes agents with active owner-pool assets even when the originals stay private-only', async () => {
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
    const service = new ImagePlannerService({
      imagePlanRepo,
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      mediaContextProjectionRepo,
      forumSceneMetadataRepo,
      mediaProjectionService,
      mediaReuseGovernanceService,
    })

    const publicAsset = await mediaAssetRepo.create({
      id: 'asset-owner-pool-public',
      steward_agent_id: 'agent-public',
      owner_user_id: 'owner-public',
      source_kind: 'owner_console_upload',
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
      mime_type: 'image/png',
      file_size_bytes: 1024,
      sha256: 'sha-owner-pool-public',
    })
    const privateAsset = await mediaAssetRepo.create({
      id: 'asset-owner-pool-private',
      steward_agent_id: 'agent-private',
      owner_user_id: 'owner-private',
      source_kind: 'owner_console_upload',
      visibility_policy: 'private_only',
      lifecycle_status: 'active',
      mime_type: 'image/png',
      file_size_bytes: 1024,
      sha256: 'sha-owner-pool-private',
    })
    await sceneMediaBindingRepo.create({
      scene_type: 'memory_card',
      scene_id: buildOwnerPrivatePoolSceneId('agent-public'),
      asset_id: publicAsset.id,
      semantic_snapshot_id: 'snapshot-owner-pool-public',
      binding_role: 'memory',
      relation_to_scene: 'uploaded_by_owner',
      display_policy: 'runtime_only_no_display',
      created_by_type: 'owner',
      created_by_id: 'owner-public',
    })
    await sceneMediaBindingRepo.create({
      scene_type: 'memory_card',
      scene_id: buildOwnerPrivatePoolSceneId('agent-private'),
      asset_id: privateAsset.id,
      semantic_snapshot_id: 'snapshot-owner-pool-private',
      binding_role: 'memory',
      relation_to_scene: 'uploaded_by_owner',
      display_policy: 'runtime_only_no_display',
      created_by_type: 'owner',
      created_by_id: 'owner-private',
    })

    const prioritized = await service.listAgentIdsWithOwnerPrivatePoolCandidates(10)

    expect(prioritized).toHaveLength(2)
    expect(prioritized).toEqual(expect.arrayContaining(['agent-public', 'agent-private']))
  })

  it('creates scratch generation plans when no candidate qualifies and generation is enabled', async () => {
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
    const service = new ImagePlannerService({
      imagePlanRepo,
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      mediaContextProjectionRepo,
      forumSceneMetadataRepo,
      mediaProjectionService,
      mediaReuseGovernanceService,
    })

    const directive = buildDirective()
    directive.goal.need_image = 'required'
    directive.sourcing_policy.allow_sources = []
    directive.sourcing_policy.prefer_order = []
    directive.sourcing_policy.allow_generation = true
    directive.budget.generation_tier = 'medium'
    directive.budget.max_generation_attempts = 2
    directive.budget.sync_generation_ms_budget = 2200
    directive.budget.async_generation_allowed = true

    const plan = await service.planScheduledPost({
      agent_id: 'agent-1',
      directive,
    })

    expect(plan.status).toBe('pending_generation')
    expect(plan.decision).toBe('generate_from_scratch')
    expect(plan.generation.input_mode).toBe('scratch')
    expect(plan.generation.based_on_projection_ids).toEqual([])
    expect(plan.generation.aspect_ratio_hint).toBe('4:5')
  })

  it('does not select missing stored originals for ready-display reuse', async () => {
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
    const service = new ImagePlannerService({
      imagePlanRepo,
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      mediaContextProjectionRepo,
      forumSceneMetadataRepo,
      mediaProjectionService,
      mediaReuseGovernanceService,
      storage: createStorageStub([]),
    })

    const directive = buildDirective()
    directive.sourcing_policy.allow_sources = ['same_thread_public']
    directive.sourcing_policy.prefer_order = ['same_thread_public']

    const missingAsset = await mediaAssetRepo.create({
      id: 'asset-missing',
      steward_agent_id: 'agent-2',
      owner_user_id: 'owner-2',
      source_kind: 'owner_console_upload',
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
      storage_key: 'missing/asset.png',
      mime_type: 'image/png',
      file_size_bytes: 1024,
      sha256: 'sha-missing',
    })
    const snapshot = await mediaSemanticSnapshotRepo.create({
      asset_id: missingAsset.id,
      snapshot_kind: 'visual_core',
      schema_version: 'visual_core.v1',
      model_provider: 'test',
      model_name: 'test',
      model_version: '1',
      summary: buildMediaSemanticSummary({
        theme: 'thread',
        scene: 'continuity',
        mood: 'neutral',
        discussion_points: ['same-thread'],
        salient_entities: ['entity'],
        public_safe_summary: 'Missing same-thread image',
        internal_full_summary: 'Missing same-thread image',
      }),
      extraction_status: 'completed',
      quality_grade: 'rich',
      is_current: true,
    })
    await sceneMediaBindingRepo.create({
      scene_type: 'forum_post',
      scene_id: 'post-thread-source',
      asset_id: missingAsset.id,
      semantic_snapshot_id: snapshot.id,
      binding_role: 'primary',
      relation_to_scene: 'selected_for_post',
      display_policy: 'original_allowed',
      created_by_type: 'system',
      created_by_id: 'system',
      thread_root_ref: 'thread:root-1',
    })

    const plan = await service.planScheduledPost({
      agent_id: 'agent-1',
      directive: {
        ...directive,
        scene_ref: {
          ...directive.scene_ref,
          thread_root_ref: 'thread:root-1',
        },
      },
    })

    expect(plan.status).toBe('degraded')
    expect(plan.display.attachments).toHaveLength(0)
  })

  it('falls back to runtime-only when async generation is disabled and no sync budget is available', async () => {
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
    const service = new ImagePlannerService({
      imagePlanRepo,
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      mediaContextProjectionRepo,
      forumSceneMetadataRepo,
      mediaProjectionService,
      mediaReuseGovernanceService,
    })

    await seedPrivateRuntimeProjectionCandidate({
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      mediaProjectionService,
    })

    const directive = buildDirective()
    directive.sourcing_policy.allow_sources = ['private_runtime_projection']
    directive.sourcing_policy.prefer_order = ['private_runtime_projection']
    directive.sourcing_policy.allow_generation = true
    directive.sourcing_policy.allow_private_runtime_projection = true
    directive.sourcing_policy.allow_private_inspired_generation = true
    directive.budget.generation_tier = 'medium'
    directive.budget.max_generation_attempts = 2
    directive.budget.sync_generation_ms_budget = 0
    directive.budget.async_generation_allowed = false

    const plan = await service.planScheduledPost({
      agent_id: 'agent-1',
      directive,
    })

    expect(plan.status).toBe('degraded')
    expect(plan.decision).toBe('reuse_private_projection_runtime_only')
    expect(plan.generation.mode).toBe('none')
    expect(plan.display.attachments).toEqual([])
  })

  it('falls back to runtime-only when private inspired generation is disabled', async () => {
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
    const service = new ImagePlannerService({
      imagePlanRepo,
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      mediaContextProjectionRepo,
      forumSceneMetadataRepo,
      mediaProjectionService,
      mediaReuseGovernanceService,
    })

    await seedPrivateRuntimeProjectionCandidate({
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      mediaProjectionService,
    })

    const directive = buildDirective()
    directive.sourcing_policy.allow_sources = ['private_runtime_projection']
    directive.sourcing_policy.prefer_order = ['private_runtime_projection']
    directive.sourcing_policy.allow_generation = true
    directive.sourcing_policy.allow_private_runtime_projection = true
    directive.sourcing_policy.allow_private_inspired_generation = false
    directive.budget.generation_tier = 'medium'
    directive.budget.max_generation_attempts = 2
    directive.budget.sync_generation_ms_budget = 2200
    directive.budget.async_generation_allowed = true

    const plan = await service.planScheduledPost({
      agent_id: 'agent-1',
      directive,
    })

    expect(plan.status).toBe('degraded')
    expect(plan.decision).toBe('reuse_private_projection_runtime_only')
    expect(plan.generation.mode).toBe('none')
    expect(plan.display.attachments).toEqual([])
  })

  it('suppresses repeated generation from the same source asset', async () => {
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
    const service = new ImagePlannerService({
      imagePlanRepo,
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      mediaContextProjectionRepo,
      forumSceneMetadataRepo,
      mediaProjectionService,
      mediaReuseGovernanceService,
    })

    const asset = await mediaAssetRepo.create({
      id: 'asset-repeat-source',
      steward_agent_id: 'agent-1',
      owner_user_id: 'owner-1',
      source_kind: 'owner_console_upload',
      visibility_policy: 'private_only',
      lifecycle_status: 'active',
      mime_type: 'image/png',
      file_size_bytes: 1024,
      sha256: 'sha-repeat-source',
    })
    const snapshot = await mediaSemanticSnapshotRepo.create({
      asset_id: asset.id,
      snapshot_kind: 'visual_core',
      schema_version: 'visual_core.v1',
      model_provider: 'test',
      model_name: 'test',
      model_version: '1',
      summary: buildMediaSemanticSummary({
        theme: 'night city',
        scene: 'neon alley',
        mood: 'moody',
        discussion_points: ['雨夜霓虹'],
        salient_entities: ['alley'],
        public_safe_summary: 'A moody neon alley at night.',
        internal_full_summary: 'Prior generation already used this source asset.',
      }),
      extraction_status: 'completed',
      quality_grade: 'rich',
      is_current: true,
    })
    await sceneMediaBindingRepo.create({
      scene_type: 'memory_card',
      scene_id: buildOwnerPrivatePoolSceneId('agent-1'),
      asset_id: asset.id,
      semantic_snapshot_id: snapshot.id,
      binding_role: 'memory',
      relation_to_scene: 'uploaded_by_owner',
      display_policy: 'runtime_only_no_display',
      created_by_type: 'owner',
      created_by_id: 'owner-1',
    })
    await imagePlanRepo.create({
      directive_id: 'directive-prior-generation',
      scene_ref: {
        ...buildDirective().scene_ref,
        request_id: 'selection-prior-generation',
        selection_id: 'selection-prior-generation',
        local_intent_id: 'intent-prior-generation',
      },
      status: 'pending_generation',
      decision: 'generate_from_private_projection',
      reason: 'selected_owner_private_pool_for_generation',
      runtime: {
        enabled: true,
        influence_level: 'medium',
        cards: [],
      },
      display: {
        enabled: false,
        attachments: [],
      },
      generation: {
        mode: 'async',
        input_mode: 'reference',
        status: 'queued',
        request_fingerprint: 'fp-prior-generation',
        aspect_ratio_hint: '4:5',
        based_on_projection_ids: ['projection-prior-generation'],
        prompt_brief: 'prior generation',
        attempt_count: 1,
      },
      selected_sources: [
        {
          source_kind: 'owner_private_pool',
          asset_id: asset.id,
          binding_id: 'binding-prior-generation',
          projection_id: 'projection-prior-generation',
          selection_reason: 'selected_owner_private_pool',
          reuse_mode: 'derive_new',
          selection_score: 3.9,
          rejection_reason: null,
        },
      ],
      planner_audit: {
        evaluated_candidates: 1,
        score_breakdown: {
          relevance: 0.7,
          continuity: 0.65,
          novelty: 0.95,
          privacy_safety: 0.8,
          display_fitness: 0.8,
          cost_fitness: 0.85,
          fatigue_penalty: 0,
          repeat_penalty: 0,
          risk_penalty: 0,
          total: 4.75,
        },
        fallback_action: 'runtime_only_no_display',
      },
    })

    const directive = buildDirective()
    directive.id = 'directive-repeat-check'
    directive.sourcing_policy.allow_sources = ['owner_private_pool']
    directive.sourcing_policy.prefer_order = ['owner_private_pool']
    directive.sourcing_policy.allow_generation = true
    directive.sourcing_policy.allow_private_inspired_generation = true
    directive.budget.generation_tier = 'medium'
    directive.budget.max_generation_attempts = 2
    directive.budget.sync_generation_ms_budget = 2200
    directive.budget.async_generation_allowed = true

    const plan = await service.planScheduledPost({
      agent_id: 'agent-1',
      directive,
    })

    expect(plan.status).toBe('degraded')
    expect(plan.decision).toBe('reuse_public_projection')
    expect(plan.generation.mode).toBe('none')
    expect(plan.display.attachments).toHaveLength(0)
    expect(plan.runtime.cards).toHaveLength(1)
  })

  it('still allows quoting the same asset after a prior derived-generation use', async () => {
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
    const service = new ImagePlannerService({
      imagePlanRepo,
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      mediaContextProjectionRepo,
      forumSceneMetadataRepo,
      mediaProjectionService,
      mediaReuseGovernanceService,
      storage: createStorageStub(['archive/quote-ok.png']),
    })

    const asset = await mediaAssetRepo.create({
      id: 'asset-quote-ok',
      steward_agent_id: 'agent-1',
      owner_user_id: 'owner-1',
      source_kind: 'owner_console_upload',
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
      storage_key: 'archive/quote-ok.png',
      mime_type: 'image/png',
      file_size_bytes: 1024,
      sha256: 'sha-quote-ok',
    })
    const snapshot = await mediaSemanticSnapshotRepo.create({
      asset_id: asset.id,
      snapshot_kind: 'visual_core',
      schema_version: 'visual_core.v1',
      model_provider: 'test',
      model_name: 'test',
      model_version: '1',
      summary: buildMediaSemanticSummary({
        theme: 'library',
        scene: 'window seat',
        mood: 'quiet',
        discussion_points: ['旧图引用'],
        salient_entities: ['books'],
        public_safe_summary: 'A quiet library window seat.',
        internal_full_summary: 'Quote path should stay available.',
      }),
      extraction_status: 'completed',
      quality_grade: 'rich',
      is_current: true,
    })
    await sceneMediaBindingRepo.create({
      scene_type: 'media_pool',
      scene_id: 'self_public_archive:agent-1',
      asset_id: asset.id,
      semantic_snapshot_id: snapshot.id,
      binding_role: 'reference',
      relation_to_scene: 'quoted_public',
      display_policy: 'original_allowed',
      created_by_type: 'system',
      created_by_id: 'agent-1',
    })
    await imagePlanRepo.create({
      directive_id: 'directive-prior-derived-public',
      scene_ref: {
        ...buildDirective().scene_ref,
        request_id: 'selection-prior-derived-public',
        selection_id: 'selection-prior-derived-public',
        local_intent_id: 'intent-prior-derived-public',
      },
      status: 'ready',
      decision: 'generate_from_public_reference',
      reason: 'selected_self_public_archive_for_generation',
      runtime: {
        enabled: true,
        influence_level: 'medium',
        cards: [],
      },
      display: {
        enabled: false,
        attachments: [],
      },
      generation: {
        mode: 'sync',
        input_mode: 'reference',
        status: 'succeeded',
        request_fingerprint: 'fp-prior-derived-public',
        aspect_ratio_hint: '4:5',
        based_on_projection_ids: ['projection-prior-derived-public'],
        prompt_brief: 'prior derived public',
        attempt_count: 1,
        output_asset_id: 'asset-output-prior-derived-public',
      },
      selected_sources: [
        {
          source_kind: 'self_public_archive',
          asset_id: asset.id,
          binding_id: 'binding-prior-derived-public',
          projection_id: 'projection-prior-derived-public',
          selection_reason: 'selected_self_public_archive',
          reuse_mode: 'derive_new',
          selection_score: 4.1,
          rejection_reason: null,
        },
      ],
      planner_audit: {
        evaluated_candidates: 1,
        score_breakdown: {
          relevance: 0.7,
          continuity: 0.8,
          novelty: 0.65,
          privacy_safety: 0.95,
          display_fitness: 0.8,
          cost_fitness: 0.85,
          fatigue_penalty: 0,
          repeat_penalty: 0.18,
          risk_penalty: 0,
          total: 4.57,
        },
        fallback_action: null,
      },
    })

    const directive = buildDirective()
    directive.id = 'directive-quote-ok'
    directive.sourcing_policy.allow_sources = ['self_public_archive']
    directive.sourcing_policy.prefer_order = ['self_public_archive']
    directive.sourcing_policy.allow_generation = true
    directive.budget.generation_tier = 'medium'
    directive.budget.max_generation_attempts = 2
    directive.budget.sync_generation_ms_budget = 2200
    directive.budget.async_generation_allowed = true

    const plan = await service.planScheduledPost({
      agent_id: 'agent-1',
      directive,
    })

    expect(plan.status).toBe('ready')
    expect(plan.decision).toBe('reuse_public_original')
    expect(plan.display.attachments).toHaveLength(1)
    expect(plan.generation.mode).toBe('none')
  })

  it('falls back to scratch generation when repeat-suppressed derive candidates leave no reusable path', async () => {
    const imagePlanRepo = new InMemoryImagePlanRepository()
    const mediaAssetRepo = new InMemoryMediaAssetRepository()
    const mediaSemanticSnapshotRepo = new InMemoryMediaSemanticSnapshotRepository()
    const sceneMediaBindingRepo = new InMemorySceneMediaBindingRepository()
    const forumSceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
    const mediaContextProjectionRepo = new InMemoryMediaContextProjectionRepository()
    const mediaProjectionService = new MediaProjectionService({
      mediaContextProjectionRepo,
    })
    const service = new ImagePlannerService({
      imagePlanRepo,
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      mediaContextProjectionRepo,
      forumSceneMetadataRepo,
      mediaProjectionService,
      mediaReuseGovernanceService: {
        evaluateCandidate: async () => ({
          policy: {
            id: 'policy-derive-only',
            subject_type: 'asset',
            subject_id: 'asset-repeat-scratch',
            source_kind: 'owner_private_pool',
            community_id: null,
            steward_agent_id: 'agent-1',
            allowed_reuse_modes: ['derive_new'],
            cross_agent_quote_allowed: false,
            disclose_origin_policy: 'never',
            copyright_state: 'internal_owned',
            status: 'active',
            revoked_at: null,
            revoked_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
          allowed_reuse_modes: ['derive_new'],
          policy_reason: 'asset_policy_active',
          rejection_reason: null,
        }),
      } as unknown as MediaReuseGovernanceService,
    })

    const asset = await mediaAssetRepo.create({
      id: 'asset-repeat-scratch',
      steward_agent_id: 'agent-1',
      owner_user_id: 'owner-1',
      source_kind: 'owner_console_upload',
      visibility_policy: 'private_only',
      lifecycle_status: 'active',
      mime_type: 'image/png',
      file_size_bytes: 1024,
      sha256: 'sha-repeat-scratch',
    })
    const snapshot = await mediaSemanticSnapshotRepo.create({
      asset_id: asset.id,
      snapshot_kind: 'visual_core',
      schema_version: 'visual_core.v1',
      model_provider: 'test',
      model_name: 'test',
      model_version: '1',
      summary: buildMediaSemanticSummary({
        theme: 'desert',
        scene: 'dune ridge',
        mood: 'windy',
        discussion_points: ['沙丘风线'],
        salient_entities: ['dune'],
        public_safe_summary: 'A windy dune ridge.',
        internal_full_summary: 'Repeat-suppressed source should trigger scratch.',
      }),
      extraction_status: 'completed',
      quality_grade: 'rich',
      is_current: true,
    })
    await sceneMediaBindingRepo.create({
      scene_type: 'memory_card',
      scene_id: buildOwnerPrivatePoolSceneId('agent-1'),
      asset_id: asset.id,
      semantic_snapshot_id: snapshot.id,
      binding_role: 'memory',
      relation_to_scene: 'uploaded_by_owner',
      display_policy: 'runtime_only_no_display',
      created_by_type: 'owner',
      created_by_id: 'owner-1',
    })
    await imagePlanRepo.create({
      directive_id: 'directive-prior-repeat-scratch',
      scene_ref: {
        ...buildDirective().scene_ref,
        request_id: 'selection-prior-repeat-scratch',
        selection_id: 'selection-prior-repeat-scratch',
        local_intent_id: 'intent-prior-repeat-scratch',
      },
      status: 'pending_generation',
      decision: 'generate_from_private_projection',
      reason: 'selected_owner_private_pool_for_generation',
      runtime: {
        enabled: true,
        influence_level: 'medium',
        cards: [],
      },
      display: {
        enabled: false,
        attachments: [],
      },
      generation: {
        mode: 'async',
        input_mode: 'reference',
        status: 'queued',
        request_fingerprint: 'fp-prior-repeat-scratch',
        aspect_ratio_hint: '4:5',
        based_on_projection_ids: ['projection-prior-repeat-scratch'],
        prompt_brief: 'prior repeat scratch',
        attempt_count: 1,
      },
      selected_sources: [
        {
          source_kind: 'owner_private_pool',
          asset_id: asset.id,
          binding_id: 'binding-prior-repeat-scratch',
          projection_id: 'projection-prior-repeat-scratch',
          selection_reason: 'selected_owner_private_pool',
          reuse_mode: 'derive_new',
          selection_score: 3.6,
          rejection_reason: null,
        },
      ],
      planner_audit: {
        evaluated_candidates: 1,
        score_breakdown: {
          relevance: 0.7,
          continuity: 0.65,
          novelty: 0.95,
          privacy_safety: 0.8,
          display_fitness: 0.8,
          cost_fitness: 0.65,
          fatigue_penalty: 0,
          repeat_penalty: 0,
          risk_penalty: 0,
          total: 4.55,
        },
        fallback_action: 'runtime_only_no_display',
      },
    })

    const directive = buildDirective()
    directive.id = 'directive-repeat-scratch'
    directive.sourcing_policy.allow_sources = ['owner_private_pool']
    directive.sourcing_policy.prefer_order = ['owner_private_pool']
    directive.sourcing_policy.allow_generation = true
    directive.sourcing_policy.allow_private_inspired_generation = true
    directive.budget.generation_tier = 'medium'
    directive.budget.max_generation_attempts = 2
    directive.budget.sync_generation_ms_budget = 2200
    directive.budget.async_generation_allowed = true

    const plan = await service.planScheduledPost({
      agent_id: 'agent-1',
      directive,
    })

    expect(plan.status).toBe('pending_generation')
    expect(plan.decision).toBe('generate_from_scratch')
    expect(plan.generation.input_mode).toBe('scratch')
    expect(plan.generation.based_on_projection_ids).toEqual([])
  })
})
