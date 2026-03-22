import { describe, expect, it } from 'vitest'
import { InMemoryMediaAssetRepository } from '../../repos/media-asset-repository.js'
import { InMemoryMediaSemanticSnapshotRepository } from '../../repos/media-semantic-snapshot-repository.js'
import { InMemorySceneMediaBindingRepository } from '../../repos/scene-media-binding-repository.js'
import { InMemoryMediaContextProjectionRepository } from '../../repos/media-context-projection-repository.js'
import { InMemoryMediaReusePolicyRepository } from '../../repos/media-reuse-policy-repository.js'
import { InMemoryMediaGenerationJobRepository } from '../../repos/media-generation-job-repository.js'
import { InMemoryImagePlanRepository } from '../../repos/image-plan-repository.js'
import { MediaBindingService } from '../media-binding-service.js'
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
      allow_sources: ['self_public_archive'],
      prefer_order: ['self_public_archive'],
      allow_private_runtime_projection: true,
      allow_private_inspired_generation: true,
      allow_cross_agent_public: false,
      allow_generation: true,
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
      generation_tier: 'medium',
      sync_generation_ms_budget: 2200,
      async_generation_allowed: true,
      max_generation_attempts: 2,
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

function createService() {
  const mediaAssetRepo = new InMemoryMediaAssetRepository()
  const mediaSemanticSnapshotRepo = new InMemoryMediaSemanticSnapshotRepository()
  const sceneMediaBindingRepo = new InMemorySceneMediaBindingRepository()
  const mediaContextProjectionRepo = new InMemoryMediaContextProjectionRepository()
  const mediaReusePolicyRepo = new InMemoryMediaReusePolicyRepository()
  const mediaGenerationJobRepo = new InMemoryMediaGenerationJobRepository()
  const imagePlanRepo = new InMemoryImagePlanRepository()
  const mediaBindingService = new MediaBindingService({
    sceneMediaBindingRepo,
  })
  const service = new MediaReuseGovernanceService({
    mediaAssetRepo,
    mediaSemanticSnapshotRepo,
    sceneMediaBindingRepo,
    mediaContextProjectionRepo,
    mediaReusePolicyRepo,
    mediaGenerationJobRepo,
    imagePlanRepo,
    mediaBindingService,
  })

  return {
    service,
    mediaAssetRepo,
    sceneMediaBindingRepo,
    mediaContextProjectionRepo,
    mediaGenerationJobRepo,
    imagePlanRepo,
  }
}

describe('MediaReuseGovernanceService', () => {
  it('allows same-agent owner_private_pool originals when the binding is public-compatible', async () => {
    const { service, mediaAssetRepo, sceneMediaBindingRepo } = createService()
    const asset = await mediaAssetRepo.create({
      id: 'asset-owner-1',
      steward_agent_id: 'agent-1',
      owner_user_id: 'owner-1',
      source_kind: 'owner_console_upload',
      visibility_policy: 'private_only',
      lifecycle_status: 'active',
      mime_type: 'image/png',
      file_size_bytes: 1024,
      sha256: 'sha-owner-1',
    })
    const binding = await sceneMediaBindingRepo.create({
      scene_type: 'memory_card',
      scene_id: 'owner_private_pool:agent-1',
      asset_id: asset.id,
      semantic_snapshot_id: 'snapshot-owner-1',
      binding_role: 'memory',
      relation_to_scene: 'uploaded_by_owner',
      display_policy: 'original_allowed',
      created_by_type: 'owner',
      created_by_id: 'owner-1',
    })

    const result = await service.evaluateCandidate({
      agent_id: 'agent-1',
      directive: buildDirective(),
      source_kind: 'owner_private_pool',
      asset,
      binding,
      community_id: 'community-1',
    })

    expect(result.rejection_reason).toBeNull()
    expect(result.allowed_reuse_modes).toContain('quote_original')
  })

  it('keeps source-specific policies isolated for the same asset subject', async () => {
    const { service, mediaAssetRepo } = createService()
    const asset = await mediaAssetRepo.create({
      id: 'asset-shared-policy-1',
      steward_agent_id: 'agent-1',
      owner_user_id: 'owner-1',
      source_kind: 'owner_console_upload',
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
      mime_type: 'image/png',
      file_size_bytes: 1024,
      sha256: 'sha-shared-policy-1',
    })

    const archivePolicy = await service.ensureAssetPolicy({
      source_kind: 'self_public_archive',
      asset,
      community_id: 'community-1',
    })
    const commonsPolicy = await service.ensureAssetPolicy({
      source_kind: 'community_commons',
      asset,
      community_id: 'community-1',
      allow_quote_original: false,
    })

    expect(archivePolicy.id).not.toBe(commonsPolicy.id)
    expect(archivePolicy.source_kind).toBe('self_public_archive')
    expect(commonsPolicy.source_kind).toBe('community_commons')
    expect(archivePolicy.allowed_reuse_modes).toContain('quote_original')
    expect(commonsPolicy.allowed_reuse_modes).toEqual(['derive_new', 'reference_only'])
  })

  it('blocks quote_original for private_runtime_projection handoffs', async () => {
    const { service, mediaContextProjectionRepo } = createService()
    const projection = await mediaContextProjectionRepo.create({
      id: 'projection-private-1',
      binding_id: 'binding-private-1',
      projection_surface: 'planner',
      projection_kind: 'public_reuse_handoff',
      schema_version: 'public-reuse-handoff.v1',
      payload_json: {},
    })

    const result = await service.evaluateCandidate({
      agent_id: 'agent-1',
      directive: buildDirective(),
      source_kind: 'private_runtime_projection',
      projection,
      community_id: 'community-1',
    })

    expect(result.allowed_reuse_modes).toEqual(['derive_new', 'reference_only'])
  })

  it('blocks default quote_original for community commons and foreign same-episode public assets', async () => {
    const { service, mediaAssetRepo, sceneMediaBindingRepo } = createService()
    const commonsAsset = await mediaAssetRepo.create({
      id: 'asset-commons-1',
      steward_agent_id: 'agent-1',
      owner_user_id: 'owner-1',
      source_kind: 'owner_console_upload',
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
      mime_type: 'image/png',
      file_size_bytes: 1024,
      sha256: 'sha-commons-1',
    })
    const commonsBinding = await sceneMediaBindingRepo.create({
      scene_type: 'media_pool',
      scene_id: 'community_commons:community-1',
      asset_id: commonsAsset.id,
      semantic_snapshot_id: 'snapshot-commons-1',
      binding_role: 'reference',
      relation_to_scene: 'quoted_public',
      display_policy: 'original_allowed',
      created_by_type: 'system',
      created_by_id: 'admin-1',
    })
    const foreignAsset = await mediaAssetRepo.create({
      id: 'asset-foreign-1',
      steward_agent_id: 'agent-2',
      owner_user_id: 'owner-2',
      source_kind: 'owner_console_upload',
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
      mime_type: 'image/png',
      file_size_bytes: 1024,
      sha256: 'sha-foreign-1',
    })
    const foreignBinding = await sceneMediaBindingRepo.create({
      scene_type: 'forum_post',
      scene_id: 'post-foreign-1',
      asset_id: foreignAsset.id,
      semantic_snapshot_id: 'snapshot-foreign-1',
      binding_role: 'primary',
      relation_to_scene: 'selected_for_post',
      display_policy: 'original_allowed',
      created_by_type: 'system',
      created_by_id: 'agent-2',
    })

    const commonsResult = await service.evaluateCandidate({
      agent_id: 'agent-1',
      directive: buildDirective(),
      source_kind: 'community_commons',
      asset: commonsAsset,
      binding: commonsBinding,
      community_id: 'community-1',
    })
    const foreignResult = await service.evaluateCandidate({
      agent_id: 'agent-1',
      directive: buildDirective(),
      source_kind: 'same_episode_public',
      asset: foreignAsset,
      binding: foreignBinding,
      community_id: 'community-1',
    })

    expect(commonsResult.allowed_reuse_modes).toEqual(['derive_new', 'reference_only'])
    expect(foreignResult.allowed_reuse_modes).not.toContain('quote_original')
  })

  it('never allows quote_original for url_import assets', async () => {
    const { service, mediaAssetRepo, sceneMediaBindingRepo } = createService()
    const asset = await mediaAssetRepo.create({
      id: 'asset-url-1',
      steward_agent_id: 'agent-1',
      owner_user_id: 'owner-1',
      source_kind: 'url_import',
      origin_url: 'https://example.com/source.png',
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
      mime_type: 'image/png',
      file_size_bytes: 1024,
      sha256: 'sha-url-1',
    })
    const binding = await sceneMediaBindingRepo.create({
      scene_type: 'forum_post',
      scene_id: 'post-url-1',
      asset_id: asset.id,
      semantic_snapshot_id: 'snapshot-url-1',
      binding_role: 'primary',
      relation_to_scene: 'selected_for_post',
      display_policy: 'original_allowed',
      created_by_type: 'system',
      created_by_id: 'agent-1',
    })

    const result = await service.evaluateCandidate({
      agent_id: 'agent-1',
      directive: buildDirective(),
      source_kind: 'self_public_archive',
      asset,
      binding,
      community_id: 'community-1',
    })

    expect(result.allowed_reuse_modes).toEqual(['derive_new', 'reference_only'])
  })

  it('keeps revoked asset policies revoked for future planning', async () => {
    const { service, mediaAssetRepo, sceneMediaBindingRepo } = createService()
    const asset = await mediaAssetRepo.create({
      id: 'asset-revoked-1',
      steward_agent_id: 'agent-1',
      owner_user_id: 'owner-1',
      source_kind: 'owner_console_upload',
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
      mime_type: 'image/png',
      file_size_bytes: 1024,
      sha256: 'sha-revoked-1',
    })
    const binding = await sceneMediaBindingRepo.create({
      scene_type: 'forum_post',
      scene_id: 'post-revoked-1',
      asset_id: asset.id,
      semantic_snapshot_id: 'snapshot-revoked-1',
      binding_role: 'primary',
      relation_to_scene: 'selected_for_post',
      display_policy: 'original_allowed',
      created_by_type: 'system',
      created_by_id: 'agent-1',
    })
    const policy = await service.ensureAssetPolicy({
      source_kind: 'self_public_archive',
      asset,
      community_id: 'community-1',
    })

    await service.revokePolicy({
      policy_id: policy.id,
      reason: 'copyright hold',
    })

    const result = await service.evaluateCandidate({
      agent_id: 'agent-1',
      directive: buildDirective(),
      source_kind: 'self_public_archive',
      asset,
      binding,
      community_id: 'community-1',
    })

    expect(result.allowed_reuse_modes).toEqual([])
    expect(result.rejection_reason).toBe('policy_revoked')
  })

  it('revokes planner projections and cancels queued generation jobs immediately', async () => {
    const {
      service,
      mediaContextProjectionRepo,
      mediaGenerationJobRepo,
      imagePlanRepo,
    } = createService()
    const projection = await mediaContextProjectionRepo.create({
      id: 'projection-revoke-1',
      binding_id: 'binding-private-1',
      projection_surface: 'planner',
      projection_kind: 'public_reuse_handoff',
      schema_version: 'public-reuse-handoff.v1',
      payload_json: {},
    })
    const policy = await service.ensureProjectionPolicy({
      source_kind: 'private_runtime_projection',
      projection,
      steward_agent_id: 'agent-1',
      community_id: 'community-1',
    })
    await mediaGenerationJobRepo.create({
      id: 'job-revoke-1',
      agent_id: 'agent-1',
      plan_id: 'plan-1',
      status: 'queued',
      provider: 'ark-seedream',
      model_name: 'doubao-seedream-5-0-lite-260128',
      request_fingerprint: 'fp-revoke-1',
      prompt_brief: 'derive this safely',
      based_on_projection_ids: [projection.id],
      attempt_count: 0,
    })
    await imagePlanRepo.create({
      id: 'plan-1',
      directive_id: 'directive-1',
      scene_ref: buildDirective().scene_ref,
      status: 'pending_generation',
      decision: 'generate_from_private_projection',
      reason: 'selected_private_runtime_projection_for_generation',
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
        status: 'queued',
        job_id: 'job-revoke-1',
        request_fingerprint: 'fp-revoke-1',
        based_on_projection_ids: [projection.id],
        prompt_brief: 'derive this safely',
        attempt_count: 0,
      },
      selected_sources: [],
      planner_audit: {
        evaluated_candidates: 1,
        score_breakdown: {
          relevance: 0,
          continuity: 0,
          novelty: 0,
          privacy_safety: 0,
          display_fitness: 0,
          cost_fitness: 0,
          fatigue_penalty: 0,
          repeat_penalty: 0,
          risk_penalty: 0,
          total: 0,
        },
        fallback_action: 'runtime_only_no_display',
      },
    })

    const revoked = await service.revokePolicy({
      policy_id: policy.id,
      reason: 'manual revoke',
    })

    const expiredProjection = await mediaContextProjectionRepo.findById(projection.id)
    const cancelledJob = await mediaGenerationJobRepo.findById('job-revoke-1')
    const cancelledPlan = await imagePlanRepo.findById('plan-1')

    expect(revoked.cancelled_jobs).toBe(1)
    expect(revoked.expired_projection_ids).toContain(projection.id)
    expect(expiredProjection?.expires_at).not.toBeNull()
    expect(cancelledJob?.status).toBe('cancelled')
    expect(cancelledJob?.error_code).toBe('policy_revoked')
    expect(cancelledPlan?.status).toBe('degraded')
    expect(cancelledPlan?.generation.status).toBe('cancelled')
  })

  it('preserves published forum display projections when revoking an asset policy', async () => {
    const {
      service,
      mediaAssetRepo,
      sceneMediaBindingRepo,
      mediaContextProjectionRepo,
    } = createService()
    const asset = await mediaAssetRepo.create({
      id: 'asset-projection-scope-1',
      steward_agent_id: 'agent-1',
      owner_user_id: 'owner-1',
      source_kind: 'owner_console_upload',
      visibility_policy: 'public_original_allowed',
      lifecycle_status: 'active',
      mime_type: 'image/png',
      file_size_bytes: 1024,
      sha256: 'sha-projection-scope-1',
    })
    const forumBinding = await sceneMediaBindingRepo.create({
      scene_type: 'forum_post',
      scene_id: 'post-keep-display-1',
      asset_id: asset.id,
      semantic_snapshot_id: 'snapshot-projection-scope-1',
      binding_role: 'primary',
      relation_to_scene: 'selected_for_post',
      display_policy: 'original_allowed',
      created_by_type: 'system',
      created_by_id: 'agent-1',
    })
    const poolBinding = await sceneMediaBindingRepo.create({
      scene_type: 'media_pool',
      scene_id: 'platform_canonical:global',
      asset_id: asset.id,
      semantic_snapshot_id: 'snapshot-projection-scope-1',
      binding_role: 'reference',
      relation_to_scene: 'quoted_public',
      display_policy: 'original_allowed',
      created_by_type: 'system',
      created_by_id: 'admin-1',
    })
    const forumDisplayProjection = await mediaContextProjectionRepo.create({
      id: 'projection-forum-display-1',
      binding_id: forumBinding.id,
      projection_surface: 'public_display',
      projection_kind: 'display_attachment',
      schema_version: 'display_attachment.v1',
      payload_json: {},
    })
    const poolProjection = await mediaContextProjectionRepo.create({
      id: 'projection-pool-card-1',
      binding_id: poolBinding.id,
      projection_surface: 'public_runtime',
      projection_kind: 'public_media_context_card',
      schema_version: 'public-media-context-card.v1',
      payload_json: {},
    })
    const policy = await service.ensureAssetPolicy({
      source_kind: 'platform_canonical',
      asset,
    })

    const revoked = await service.revokePolicy({
      policy_id: policy.id,
      reason: 'canonical rollback',
    })

    const preservedForumProjection = await mediaContextProjectionRepo.findById(forumDisplayProjection.id)
    const expiredPoolProjection = await mediaContextProjectionRepo.findById(poolProjection.id)

    expect(revoked.expired_projection_ids).toContain(poolProjection.id)
    expect(revoked.expired_projection_ids).not.toContain(forumDisplayProjection.id)
    expect(preservedForumProjection?.expires_at).toBeNull()
    expect(expiredPoolProjection?.expires_at).not.toBeNull()
  })

  it('rejects registering raw private-message assets into public pools', async () => {
    const { service, mediaAssetRepo, sceneMediaBindingRepo } = createService()
    const asset = await mediaAssetRepo.create({
      id: 'asset-private-message-1',
      steward_agent_id: 'agent-1',
      owner_user_id: 'owner-1',
      source_kind: 'private_message_upload',
      visibility_policy: 'private_only',
      lifecycle_status: 'active',
      mime_type: 'image/png',
      file_size_bytes: 1024,
      sha256: 'sha-private-message-1',
    })
    await sceneMediaBindingRepo.create({
      scene_type: 'private_message',
      scene_id: 'message-1',
      asset_id: asset.id,
      semantic_snapshot_id: 'snapshot-private-message-1',
      binding_role: 'primary',
      relation_to_scene: 'attached_to_private_message',
      display_policy: 'runtime_only_no_display',
      created_by_type: 'owner',
      created_by_id: 'owner-1',
    })

    await expect(service.registerPlatformCanonicalAsset({
      asset_id: asset.id,
      actor_user_id: 'admin-1',
    })).rejects.toThrow('private_message_upload assets cannot be registered into public pools')
  })
})
