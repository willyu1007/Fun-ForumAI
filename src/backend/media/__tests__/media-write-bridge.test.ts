import { describe, expect, it } from 'vitest'
import { InMemoryImagePlanRepository } from '../../repos/image-plan-repository.js'
import { InMemoryMediaAssetRepository } from '../../repos/media-asset-repository.js'
import { InMemoryMediaSemanticSnapshotRepository } from '../../repos/media-semantic-snapshot-repository.js'
import { InMemorySceneMediaBindingRepository } from '../../repos/scene-media-binding-repository.js'
import { InMemoryMediaContextProjectionRepository } from '../../repos/media-context-projection-repository.js'
import { InMemoryPostMediaRepository } from '../../repos/post-media-repository.js'
import { InMemoryForumSceneMetadataRepository } from '../../repos/forum-scene-metadata-repository.js'
import type { StorageAdapter } from '../../services/storage-adapter.js'
import { MediaBindingService } from '../media-binding-service.js'
import { MediaProjectionService } from '../media-projection-service.js'
import { MediaWriteBridge } from '../media-write-bridge.js'

function createStorageStub(): StorageAdapter {
  return {
    backend: 'local',
    async putObject() {
      throw new Error('not implemented')
    },
    async getObject() {
      throw new Error('not implemented')
    },
    async deleteObject() {
      throw new Error('not implemented')
    },
    publicUrl(key: string) {
      return `https://cdn.test/${key}`
    },
  }
}

function buildSummary(summary: string) {
  return {
    theme: 'test-theme',
    scene: 'test-scene',
    mood: 'neutral',
    discussion_points: [summary],
    salient_entities: ['entity-1'],
    ocr_snippets: [],
    safety_labels: [],
    public_safe_summary: summary,
    internal_full_summary: summary,
  }
}

describe('MediaWriteBridge', () => {
  it('does not bind raw private source assets onto a public post when the plan is runtime-only', async () => {
    const imagePlanRepo = new InMemoryImagePlanRepository()
    const mediaAssetRepo = new InMemoryMediaAssetRepository()
    const mediaSemanticSnapshotRepo = new InMemoryMediaSemanticSnapshotRepository()
    const sceneMediaBindingRepo = new InMemorySceneMediaBindingRepository()
    const mediaContextProjectionRepo = new InMemoryMediaContextProjectionRepository()
    const postMediaRepo = new InMemoryPostMediaRepository()
    const forumSceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
    const mediaBindingService = new MediaBindingService({ sceneMediaBindingRepo })
    const mediaProjectionService = new MediaProjectionService({ mediaContextProjectionRepo })
    const bridge = new MediaWriteBridge({
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      mediaContextProjectionRepo,
      postMediaRepo,
      imagePlanRepo,
      forumSceneMetadataRepo,
      storage: createStorageStub(),
      mediaBindingService,
      mediaProjectionService,
    })

    const privateAsset = await mediaAssetRepo.create({
      id: 'asset-private-runtime-only',
      steward_agent_id: 'agent-1',
      owner_user_id: 'owner-1',
      source_kind: 'private_message_upload',
      source_scene_type: 'private_message',
      source_scene_id: 'message-1',
      visibility_policy: 'private_only',
      lifecycle_status: 'active',
      storage_key: 'private/runtime-only.png',
      mime_type: 'image/png',
      file_size_bytes: 512,
      sha256: 'sha-runtime-only',
    })
    const privateSnapshot = await mediaSemanticSnapshotRepo.create({
      asset_id: privateAsset.id,
      snapshot_kind: 'visual_core',
      schema_version: 'visual_core.v1',
      model_provider: 'test',
      model_name: 'test',
      model_version: '1',
      summary: buildSummary('private runtime-only source'),
      extraction_status: 'completed',
      quality_grade: 'rich',
      is_current: true,
    })
    await sceneMediaBindingRepo.create({
      scene_type: 'private_message',
      scene_id: 'message-1',
      asset_id: privateAsset.id,
      semantic_snapshot_id: privateSnapshot.id,
      binding_role: 'inline',
      relation_to_scene: 'attached_to_private_message',
      display_policy: 'original_allowed',
      created_by_type: 'owner',
      created_by_id: 'owner-1',
    })

    const plan = await imagePlanRepo.create({
      id: 'plan-runtime-only',
      directive_id: 'directive-1',
      scene_ref: {
        request_id: 'request-1',
        director_surface: 'scheduled_post',
        actor_surface: 'forum_post',
        community_id: 'community-1',
        episode_id: 'episode-1',
        selection_id: 'selection-1',
        episode_plan_id: 'episode-plan-1',
        local_intent_id: 'intent-1',
        phase: 'opening',
        selection_mode: 'pool_guided',
      },
      status: 'degraded',
      decision: 'reuse_private_projection_runtime_only',
      reason: 'runtime only',
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
        mode: 'none',
        status: 'not_requested',
      },
      selected_sources: [
        {
          source_kind: 'private_runtime_projection',
          asset_id: privateAsset.id,
          selection_score: 3.4,
          reuse_mode: 'reference_only',
          rejection_reason: null,
        },
      ],
      planner_audit: {
        evaluated_candidates: 1,
        score_breakdown: {
          relevance: 0.8,
          continuity: 0.7,
          novelty: 0.9,
          privacy_safety: 1,
          display_fitness: 0.4,
          cost_fitness: 1,
          fatigue_penalty: 0,
          repeat_penalty: 0,
          risk_penalty: 0,
          total: 3.8,
        },
        fallback_action: 'runtime_only_no_display',
      },
    })

    const result = await bridge.applyImagePlanAfterPersist({
      image_plan_id: plan.id,
      scene_type: 'forum_post',
      scene_id: 'post-runtime-only',
      created_by_id: 'agent-1',
    })

    expect(result.linked).toBe(false)
    expect(await sceneMediaBindingRepo.findByScene('forum_post', 'post-runtime-only')).toEqual([])
    expect(postMediaRepo.findByPostId('post-runtime-only')).toEqual([])
  })

  it('only binds generated derivatives to the public post when generation was based on a private source', async () => {
    const imagePlanRepo = new InMemoryImagePlanRepository()
    const mediaAssetRepo = new InMemoryMediaAssetRepository()
    const mediaSemanticSnapshotRepo = new InMemoryMediaSemanticSnapshotRepository()
    const sceneMediaBindingRepo = new InMemorySceneMediaBindingRepository()
    const mediaContextProjectionRepo = new InMemoryMediaContextProjectionRepository()
    const postMediaRepo = new InMemoryPostMediaRepository()
    const forumSceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
    const mediaBindingService = new MediaBindingService({ sceneMediaBindingRepo })
    const mediaProjectionService = new MediaProjectionService({ mediaContextProjectionRepo })
    const bridge = new MediaWriteBridge({
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      mediaContextProjectionRepo,
      postMediaRepo,
      imagePlanRepo,
      forumSceneMetadataRepo,
      storage: createStorageStub(),
      mediaBindingService,
      mediaProjectionService,
    })

    const privateAsset = await mediaAssetRepo.create({
      id: 'asset-private-source',
      steward_agent_id: 'agent-1',
      owner_user_id: 'owner-1',
      source_kind: 'private_message_upload',
      source_scene_type: 'private_message',
      source_scene_id: 'message-2',
      visibility_policy: 'private_only',
      lifecycle_status: 'active',
      storage_key: 'private/source.png',
      mime_type: 'image/png',
      file_size_bytes: 512,
      sha256: 'sha-private-source',
    })
    const privateSnapshot = await mediaSemanticSnapshotRepo.create({
      asset_id: privateAsset.id,
      snapshot_kind: 'visual_core',
      schema_version: 'visual_core.v1',
      model_provider: 'test',
      model_name: 'test',
      model_version: '1',
      summary: buildSummary('private source'),
      extraction_status: 'completed',
      quality_grade: 'rich',
      is_current: true,
    })
    await sceneMediaBindingRepo.create({
      scene_type: 'private_message',
      scene_id: 'message-2',
      asset_id: privateAsset.id,
      semantic_snapshot_id: privateSnapshot.id,
      binding_role: 'inline',
      relation_to_scene: 'attached_to_private_message',
      display_policy: 'original_allowed',
      created_by_type: 'owner',
      created_by_id: 'owner-1',
    })

    const generatedAsset = await mediaAssetRepo.create({
      id: 'asset-generated-1',
      steward_agent_id: 'agent-1',
      owner_user_id: null,
      source_kind: 'generated',
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
      storage_key: 'generated/generated-1.png',
      mime_type: 'image/png',
      file_size_bytes: 1024,
      sha256: 'sha-generated-1',
    })
    const generatedSnapshot = await mediaSemanticSnapshotRepo.create({
      asset_id: generatedAsset.id,
      snapshot_kind: 'visual_core',
      schema_version: 'visual_core.v1',
      model_provider: 'test',
      model_name: 'test',
      model_version: '1',
      summary: buildSummary('generated derivative'),
      extraction_status: 'completed',
      quality_grade: 'rich',
      is_current: true,
    })

    const plan = await imagePlanRepo.create({
      id: 'plan-generated-private',
      directive_id: 'directive-2',
      scene_ref: {
        request_id: 'request-2',
        director_surface: 'scheduled_post',
        actor_surface: 'forum_post',
        community_id: 'community-1',
        episode_id: 'episode-1',
        selection_id: 'selection-2',
        episode_plan_id: 'episode-plan-2',
        local_intent_id: 'intent-2',
        phase: 'opening',
        selection_mode: 'pool_guided',
      },
      status: 'ready',
      decision: 'generate_from_private_projection',
      reason: 'generation succeeded',
      runtime: {
        enabled: true,
        influence_level: 'medium',
        cards: [],
      },
      display: {
        enabled: true,
        attachments: [
          {
            slot: 0,
            binding_role: 'primary',
            asset_id: generatedAsset.id,
            mime_type: generatedAsset.mime_type,
            display_variant: 'generated_derivative',
            derived_from_asset_id: privateAsset.id,
            aspect_ratio_hint: '4:5',
            public_caption: generatedSnapshot.summary.public_safe_summary,
            alt_text: generatedSnapshot.summary.public_safe_summary,
            attach_after_persist: true,
          },
        ],
      },
      generation: {
        mode: 'sync',
        status: 'succeeded',
        job_id: 'job-1',
        provider: 'ark-seedream',
        model_ref: 'doubao-seedream-5-0-lite-260128',
        output_asset_id: generatedAsset.id,
        attempt_count: 1,
      },
      selected_sources: [
        {
          source_kind: 'private_runtime_projection',
          asset_id: privateAsset.id,
          selection_score: 3.6,
          reuse_mode: 'derive_new',
          rejection_reason: null,
        },
      ],
      planner_audit: {
        evaluated_candidates: 1,
        score_breakdown: {
          relevance: 0.85,
          continuity: 0.7,
          novelty: 0.95,
          privacy_safety: 1,
          display_fitness: 0.8,
          cost_fitness: 0.8,
          fatigue_penalty: 0,
          repeat_penalty: 0,
          risk_penalty: 0,
          total: 4.1,
        },
        fallback_action: null,
      },
    })

    const result = await bridge.applyImagePlanAfterPersist({
      image_plan_id: plan.id,
      scene_type: 'forum_post',
      scene_id: 'post-generated-private',
      created_by_id: 'agent-1',
    })

    expect(result.linked).toBe(true)
    const postBindings = await sceneMediaBindingRepo.findByScene('forum_post', 'post-generated-private')
    expect(postBindings).toHaveLength(1)
    expect(postBindings[0]?.asset_id).toBe(generatedAsset.id)
    expect(postBindings[0]?.display_policy).toBe('derivative_only')
    expect(postMediaRepo.findByPostId('post-generated-private').map((item) => item.asset_id)).toEqual([generatedAsset.id])
    expect(postBindings.some((binding) => binding.asset_id === privateAsset.id)).toBe(false)
  })

  it('keeps generated derivative bindings marked as derivative_only even when the generated asset is already a selected source', async () => {
    const imagePlanRepo = new InMemoryImagePlanRepository()
    const mediaAssetRepo = new InMemoryMediaAssetRepository()
    const mediaSemanticSnapshotRepo = new InMemoryMediaSemanticSnapshotRepository()
    const sceneMediaBindingRepo = new InMemorySceneMediaBindingRepository()
    const mediaContextProjectionRepo = new InMemoryMediaContextProjectionRepository()
    const postMediaRepo = new InMemoryPostMediaRepository()
    const forumSceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
    const mediaBindingService = new MediaBindingService({ sceneMediaBindingRepo })
    const mediaProjectionService = new MediaProjectionService({ mediaContextProjectionRepo })
    const bridge = new MediaWriteBridge({
      mediaAssetRepo,
      mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo,
      mediaContextProjectionRepo,
      postMediaRepo,
      imagePlanRepo,
      forumSceneMetadataRepo,
      storage: createStorageStub(),
      mediaBindingService,
      mediaProjectionService,
    })

    const generatedAsset = await mediaAssetRepo.create({
      id: 'asset-generated-selected',
      steward_agent_id: 'agent-1',
      owner_user_id: null,
      source_kind: 'generated',
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
      storage_key: 'generated/selected.png',
      mime_type: 'image/png',
      file_size_bytes: 1024,
      sha256: 'sha-generated-selected',
    })
    const generatedSnapshot = await mediaSemanticSnapshotRepo.create({
      asset_id: generatedAsset.id,
      snapshot_kind: 'visual_core',
      schema_version: 'visual_core.v1',
      model_provider: 'test',
      model_name: 'test',
      model_version: '1',
      summary: buildSummary('selected generated derivative'),
      extraction_status: 'completed',
      quality_grade: 'rich',
      is_current: true,
    })

    const plan = await imagePlanRepo.create({
      id: 'plan-generated-selected',
      directive_id: 'directive-3',
      scene_ref: {
        request_id: 'request-3',
        director_surface: 'chat_room',
        actor_surface: 'chat_room',
        community_id: 'community-1',
        episode_id: 'episode-3',
        selection_id: 'selection-3',
        episode_plan_id: 'episode-plan-3',
        local_intent_id: 'intent-3',
        phase: 'opening',
        selection_mode: 'pool_guided',
      },
      status: 'ready',
      decision: 'reuse_generated_derivative',
      reason: 'generated source already selected',
      runtime: {
        enabled: true,
        influence_level: 'medium',
        cards: [],
      },
      display: {
        enabled: true,
        attachments: [
          {
            slot: 0,
            binding_role: 'supporting',
            asset_id: generatedAsset.id,
            mime_type: generatedAsset.mime_type,
            display_variant: 'generated_derivative',
            derived_from_asset_id: null,
            aspect_ratio_hint: '4:5',
            public_caption: generatedSnapshot.summary.public_safe_summary,
            alt_text: generatedSnapshot.summary.public_safe_summary,
            attach_after_persist: true,
          },
        ],
      },
      generation: {
        mode: 'sync',
        status: 'succeeded',
        job_id: 'job-3',
        provider: 'ark-seedream',
        model_ref: 'doubao-seedream-5-0-lite-260128',
        output_asset_id: generatedAsset.id,
        attempt_count: 1,
      },
      selected_sources: [
        {
          source_kind: 'generated_public',
          asset_id: generatedAsset.id,
          selection_score: 4.2,
          reuse_mode: 'display_direct',
          rejection_reason: null,
        },
      ],
      planner_audit: {
        evaluated_candidates: 1,
        score_breakdown: {
          relevance: 0.9,
          continuity: 0.8,
          novelty: 0.9,
          privacy_safety: 1,
          display_fitness: 0.85,
          cost_fitness: 0.9,
          fatigue_penalty: 0,
          repeat_penalty: 0,
          risk_penalty: 0,
          total: 4.35,
        },
        fallback_action: null,
      },
    })

    const result = await bridge.applyImagePlanAfterPersist({
      image_plan_id: plan.id,
      scene_type: 'forum_comment',
      scene_id: 'comment-generated-selected',
      created_by_id: 'agent-1',
    })

    expect(result.linked).toBe(true)
    const bindings = await sceneMediaBindingRepo.findByScene('forum_comment', 'comment-generated-selected')
    expect(bindings).toHaveLength(1)
    expect(bindings[0]?.asset_id).toBe(generatedAsset.id)
    expect(bindings[0]?.display_policy).toBe('derivative_only')
    expect(bindings[0]?.relation_to_scene).toBe('generated_for_scene')
  })
})
