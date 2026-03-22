import { describe, expect, it } from 'vitest'
import { InMemoryImagePlanRepository } from '../../repos/image-plan-repository.js'
import { InMemoryMediaAssetRepository } from '../../repos/media-asset-repository.js'
import { InMemoryMediaSemanticSnapshotRepository } from '../../repos/media-semantic-snapshot-repository.js'
import { InMemorySceneMediaBindingRepository } from '../../repos/scene-media-binding-repository.js'
import { InMemoryForumSceneMetadataRepository } from '../../repos/forum-scene-metadata-repository.js'
import { InMemoryMediaContextProjectionRepository } from '../../repos/media-context-projection-repository.js'
import { InMemoryMediaGenerationJobRepository } from '../../repos/media-generation-job-repository.js'
import { InMemoryMediaReusePolicyRepository } from '../../repos/media-reuse-policy-repository.js'
import { MediaProjectionService } from '../media-projection-service.js'
import { ImagePlannerService } from '../image-planner-service.js'
import { MediaBindingService, buildOwnerPrivatePoolSceneId } from '../media-binding-service.js'
import { MediaReuseGovernanceService } from '../media-reuse-governance-service.js'
import type { PersistedVisualDirective } from '../../repos/types.js'

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
    summary: {
      theme: 'coffee',
      scene: 'tabletop',
      mood: 'warm',
      discussion_points: ['桌面暖光'],
      salient_entities: ['coffee cup'],
      ocr_snippets: [],
      safety_labels: [],
      public_safe_summary: 'A warm tabletop coffee scene.',
      internal_full_summary: 'private-photo-detail',
    },
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
  it('selects owner_private_pool and keeps owner note out of runtime cards', async () => {
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
      summary: {
        theme: 'travel',
        scene: 'city skyline',
        mood: 'bright',
        discussion_points: ['城市氛围'],
        salient_entities: ['city'],
        ocr_snippets: [],
        safety_labels: [],
        public_safe_summary: 'A bright city skyline.',
        internal_full_summary: 'owner-note-secret should stay private',
      },
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

    expect(plan.status).toBe('ready')
    expect(plan.decision).toBe('reuse_public_original')
    expect(plan.display.attachments).toHaveLength(1)
    expect(plan.display.attachments[0]?.display_variant).toBe('original')
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
    })

    const foreignAsset = await mediaAssetRepo.create({
      id: 'asset-foreign',
      steward_agent_id: 'agent-2',
      owner_user_id: 'owner-2',
      source_kind: 'owner_console_upload',
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
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
      summary: {
        theme: 'travel',
        scene: 'bridge',
        mood: 'calm',
        discussion_points: ['延续上一条公开帖子'],
        salient_entities: ['bridge'],
        ocr_snippets: [],
        safety_labels: [],
        public_safe_summary: 'A calm bridge scene.',
        internal_full_summary: 'foreign-asset-private-detail',
      },
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
      comment_id: null,
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
      summary: {
        theme: 'study',
        scene: 'desk',
        mood: 'quiet',
        discussion_points: ['只用于 runtime'],
        salient_entities: ['desk'],
        ocr_snippets: [],
        safety_labels: [],
        public_safe_summary: 'A quiet desk.',
        internal_full_summary: 'runtime-only-private-detail',
      },
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
})
