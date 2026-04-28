import type { MediaAssetRepository } from '../repos/media-asset-repository.js'
import type { MediaSemanticSnapshotRepository } from '../repos/media-semantic-snapshot-repository.js'
import type { SceneMediaBindingRepository } from '../repos/scene-media-binding-repository.js'
import type { MediaContextProjectionRepository } from '../repos/media-context-projection-repository.js'
import type { PostMediaRepository } from '../repos/post-media-repository.js'
import type { ImagePlanRepository } from '../repos/image-plan-repository.js'
import type { ForumSceneMetadataRepository } from '../repos/forum-scene-metadata-repository.js'
import type { StorageAdapter } from '../services/storage-adapter.js'
import type { MediaAsset, PersistedImagePlan, SceneMediaBinding, VisualSourceKind } from '../repos/types.js'
import { MediaBindingService, buildOwnerPrivatePoolSceneId } from './media-binding-service.js'
import { MediaProjectionService } from './media-projection-service.js'
import type { MediaObservabilityService } from './media-observability-service.js'
import type { MediaReuseGovernanceService } from './media-reuse-governance-service.js'
import type { MediaLineageService } from './media-lineage-service.js'
import {
  buildCommunityCommonsPoolSceneId,
  buildGeneratedPublicPoolSceneId,
  buildPlatformCanonicalPoolSceneId,
  buildPrivateDerivedPublicPoolSceneId,
  buildSelfPublicArchivePoolSceneId,
} from './media-reuse-governance-service.js'
import {
  buildForumPostThreadRootRef,
  buildForumThreadThreadRootRef,
  readForumThreadIdFromThreadRootRef,
} from './media-contract-utils.js'
import { resolveAvailableMediaAssetUrl } from './media-url.js'
import type { GovernanceWriteContextInput } from '../services/forum-write-service/types.js'

export interface MediaWriteBridgeDeps {
  mediaAssetRepo: MediaAssetRepository
  mediaSemanticSnapshotRepo: MediaSemanticSnapshotRepository
  sceneMediaBindingRepo: SceneMediaBindingRepository
  mediaContextProjectionRepo: MediaContextProjectionRepository
  postMediaRepo: PostMediaRepository
  imagePlanRepo: ImagePlanRepository
  forumSceneMetadataRepo: ForumSceneMetadataRepository
  storage: StorageAdapter
  mediaBindingService: MediaBindingService
  mediaProjectionService: MediaProjectionService
  mediaReuseGovernanceService: Pick<MediaReuseGovernanceService, 'canQuoteOriginalAssetForSource'>
  mediaObservabilityService?: Pick<MediaObservabilityService, 'record'> | null
  mediaLineageService?: MediaLineageService | null
}

export class MediaWriteBridge {
  constructor(private readonly deps: MediaWriteBridgeDeps) {}

  async attachAssetToPost(input: {
    asset_id: string
    post_id: string
    created_by_id?: string
    governance_context?: GovernanceWriteContextInput
  }): Promise<{ linked: boolean }> {
    const asset = await this.deps.mediaAssetRepo.findById(input.asset_id)
    if (!asset || asset.lifecycle_status !== 'active' || asset.visibility_policy === 'blocked') {
      return { linked: false }
    }
    if (asset.visibility_policy === 'private_only') {
      return { linked: false }
    }

    const snapshot = await this.deps.mediaSemanticSnapshotRepo.findCurrentByAssetId(asset.id)
    if (!snapshot) {
      return { linked: false }
    }

    const mediaUrl = await resolveAvailableMediaAssetUrl(asset, this.deps.storage)
    if (!mediaUrl) {
      return { linked: false }
    }

    const bindings = await this.deps.sceneMediaBindingRepo.findByAssetId(asset.id)
    const existingPostBinding = bindings.find(
      (binding) => binding.scene_type === 'forum_post' && binding.scene_id === input.post_id,
    ) ?? null
    const ownerPoolBinding = this.findOwnerPoolBinding(bindings, asset.steward_agent_id)
    const directAttachSource = await this.resolveDirectAttachSource(asset, bindings)
    if (!existingPostBinding && !directAttachSource) {
      return { linked: false }
    }

    const postBinding = existingPostBinding ?? await this.deps.mediaBindingService.createForumPostBinding({
      asset,
      snapshot,
      postId: input.post_id,
      sourceBinding: directAttachSource?.binding ?? ownerPoolBinding,
      createdById: input.created_by_id,
    })

    const projections = await this.deps.mediaContextProjectionRepo.findByBindingId(postBinding.id)
    const hasDisplayAttachment = projections.some(
      (projection) =>
        projection.projection_surface === 'public_display'
        && projection.projection_kind === 'display_attachment',
    )
    if (!hasDisplayAttachment) {
      await this.deps.mediaProjectionService.createDisplayAttachmentProjection({
        binding: postBinding,
        asset,
        snapshot,
        mediaUrl,
      })
    }

    const hasPostMedia = this.deps.postMediaRepo.findByAssetId(asset.id)
      .some((item) => item.post_id === input.post_id)
    if (!hasPostMedia) {
      this.deps.postMediaRepo.create({
        post_id: input.post_id,
        asset_id: asset.id,
        media_url: mediaUrl,
        mime_type: asset.mime_type,
        governance_batch_id: input.governance_context?.governance_batch_id ?? null,
        generation_mode: input.governance_context?.generation_mode ?? null,
      })
    }

    return { linked: true }
  }

  async applyImagePlanAfterPersist(input: {
    image_plan_id: string
    scene_type: 'forum_post' | 'forum_thread' | 'forum_turn' | 'chat_room_message'
    scene_id: string
    created_by_id?: string
    governance_context?: GovernanceWriteContextInput
  }): Promise<{ linked: boolean }> {
    const plan = await this.deps.imagePlanRepo.findById(input.image_plan_id)
    if (!plan) {
      return { linked: false }
    }
    if (input.governance_context?.media_policy?.allow_display_attachment === false) {
      if (plan.display.attachments.length > 0) {
        const surface = input.scene_type === 'forum_post'
          ? 'root_post'
          : input.scene_type === 'forum_thread'
            ? 'forum_thread'
            : input.scene_type === 'forum_turn'
              ? 'forum_turn'
              : 'chat_room_message'
        await this.deps.mediaObservabilityService?.record({
          event_type: 'display_attach_suppressed',
          surface,
          severity: 'info',
          image_plan_id: input.image_plan_id,
          payload_json: {
            scene_id: input.scene_id,
            reason: 'governance_media_policy',
            attempted_attachment_count: plan.display.attachments.length,
          },
        })
      }
      return { linked: false }
    }

    const selectedSources = plan.selected_sources
      .filter((item) => !item.rejection_reason && item.asset_id)
      .sort((left, right) => right.selection_score - left.selection_score)
    const displayByAssetId = new Map(plan.display.attachments.map((item) => [item.asset_id, item]))
    const linkedAssetIds = new Set<string>()
    let linked = false

    for (const selectedSource of selectedSources) {
      if (!selectedSource.asset_id) continue
      const attachment = displayByAssetId.get(selectedSource.asset_id) ?? null
      if (!attachment) continue
      const asset = await this.deps.mediaAssetRepo.findById(selectedSource.asset_id)
      if (!asset || asset.lifecycle_status !== 'active' || asset.visibility_policy === 'blocked') {
        continue
      }
      if (attachment.display_variant === 'original' && asset.visibility_policy === 'private_only') {
        continue
      }
      const snapshot = await this.deps.mediaSemanticSnapshotRepo.findCurrentByAssetId(asset.id)
      if (!snapshot) continue

      const sourceBinding = await this.resolveSourceBinding(asset.id, selectedSource.source_kind, plan.scene_ref.episode_id)
      const existingBinding = (await this.deps.sceneMediaBindingRepo.findByScene(input.scene_type, input.scene_id))
        .find((item) => item.asset_id === asset.id) ?? null
      const bindingContract = this.resolveAttachmentBindingContract(input.scene_type, attachment.display_variant)
      const binding = existingBinding ?? await this.createSceneBinding({
        scene_type: input.scene_type,
        scene_id: input.scene_id,
        asset,
        snapshot,
        sourceBinding,
        created_by_id: input.created_by_id,
        display_policy: bindingContract.display_policy,
        relation_to_scene: bindingContract.relation_to_scene,
        thread_root_ref: this.resolveThreadRootRef(plan, input),
      })
      await this.deps.mediaLineageService?.recordEdge({
        from_node_type: 'image_plan',
        from_node_id: plan.id,
        to_node_type: 'binding',
        to_node_id: binding.id,
        edge_kind: 'plan_applied_binding',
        scene_type: input.scene_type,
        scene_id: input.scene_id,
        display_variant: attachment.display_variant,
      })

      const mediaUrl = await resolveAvailableMediaAssetUrl(asset, this.deps.storage)
      if (!mediaUrl) continue
      const projections = await this.deps.mediaContextProjectionRepo.findByBindingId(binding.id)
      const hasDisplayAttachment = projections.some(
        (projection) =>
          projection.projection_surface === 'public_display'
          && projection.projection_kind === 'display_attachment',
      )
      if (!hasDisplayAttachment) {
        await this.deps.mediaProjectionService.createDisplayAttachmentProjection({
          binding,
          asset,
          snapshot,
          mediaUrl,
          slot: attachment.slot,
          displayVariant: attachment.display_variant,
          altText: attachment.alt_text,
          publicCaption: attachment.public_caption,
        })
      }

      this.ensurePostMediaLink(
        input.scene_type,
        input.scene_id,
        asset.id,
        mediaUrl,
        asset.mime_type,
        input.governance_context,
      )

      linkedAssetIds.add(asset.id)
      linked = true
    }

    for (const attachment of plan.display.attachments) {
      if (linkedAssetIds.has(attachment.asset_id)) continue
      const asset = await this.deps.mediaAssetRepo.findById(attachment.asset_id)
      if (!asset || asset.lifecycle_status !== 'active' || asset.visibility_policy === 'blocked') continue
      if (attachment.display_variant === 'original' && asset.visibility_policy === 'private_only') continue
      const snapshot = await this.deps.mediaSemanticSnapshotRepo.findCurrentByAssetId(asset.id)
      if (!snapshot) continue
      const sourceBinding = await this.resolveSourceBinding(
        asset.id,
        attachment.display_variant === 'generated_derivative' ? 'generated_public' : 'self_public_archive',
        plan.scene_ref.episode_id,
      )
      const existingBinding = (await this.deps.sceneMediaBindingRepo.findByScene(input.scene_type, input.scene_id))
        .find((item) => item.asset_id === asset.id) ?? null
      const bindingContract = this.resolveAttachmentBindingContract(input.scene_type, attachment.display_variant)
      const binding = existingBinding ?? await this.createSceneBinding({
        scene_type: input.scene_type,
        scene_id: input.scene_id,
        asset,
        snapshot,
        sourceBinding,
        created_by_id: input.created_by_id,
        display_policy: bindingContract.display_policy,
        relation_to_scene: bindingContract.relation_to_scene,
        thread_root_ref: this.resolveThreadRootRef(plan, input),
      })
      await this.deps.mediaLineageService?.recordEdge({
        from_node_type: 'image_plan',
        from_node_id: plan.id,
        to_node_type: 'binding',
        to_node_id: binding.id,
        edge_kind: 'plan_applied_binding',
        scene_type: input.scene_type,
        scene_id: input.scene_id,
        display_variant: attachment.display_variant,
      })
      const mediaUrl = await resolveAvailableMediaAssetUrl(asset, this.deps.storage)
      if (!mediaUrl) continue
      const projections = await this.deps.mediaContextProjectionRepo.findByBindingId(binding.id)
      const hasDisplayAttachment = projections.some(
        (projection) =>
          projection.projection_surface === 'public_display'
          && projection.projection_kind === 'display_attachment',
      )
      if (!hasDisplayAttachment) {
        await this.deps.mediaProjectionService.createDisplayAttachmentProjection({
          binding,
          asset,
          snapshot,
          mediaUrl,
          slot: attachment.slot,
          displayVariant: attachment.display_variant,
          altText: attachment.alt_text,
          publicCaption: attachment.public_caption,
        })
      }
      this.ensurePostMediaLink(
        input.scene_type,
        input.scene_id,
        asset.id,
        mediaUrl,
        asset.mime_type,
        input.governance_context,
      )
      linkedAssetIds.add(asset.id)
      linked = true
    }

    const surface = input.scene_type === 'forum_post'
      ? 'root_post'
      : input.scene_type === 'forum_thread'
        ? 'forum_thread'
        : input.scene_type === 'forum_turn'
          ? 'forum_turn'
        : 'chat_room_message'
    if (linked) {
      await this.deps.mediaObservabilityService?.record({
        event_type: input.scene_type === 'forum_post'
          ? 'root_post_display_linked'
          : 'projection_recompiled',
        surface,
        image_plan_id: input.image_plan_id,
        payload_json: {
          scene_id: input.scene_id,
          linked_asset_ids: Array.from(linkedAssetIds),
          linked_count: linkedAssetIds.size,
        },
      })
    } else if (plan.display.attachments.length > 0) {
      await this.deps.mediaObservabilityService?.record({
        event_type: 'display_attach_failed',
        surface,
        severity: 'warn',
        image_plan_id: input.image_plan_id,
        payload_json: {
          scene_id: input.scene_id,
          attempted_attachment_count: plan.display.attachments.length,
        },
      })
    }

    return { linked }
  }

  private findOwnerPoolBinding(
    bindings: SceneMediaBinding[],
    agentId: string | null,
  ): SceneMediaBinding | null {
    if (!agentId) return null
    const ownerSceneId = buildOwnerPrivatePoolSceneId(agentId)
    return bindings.find(
      (binding) => binding.scene_type === 'memory_card' && binding.scene_id === ownerSceneId,
    ) ?? null
  }

  private async resolveDirectAttachSource(
    asset: MediaAsset,
    bindings: SceneMediaBinding[],
  ): Promise<{
    source_kind: VisualSourceKind
    binding: SceneMediaBinding
  } | null> {
    const source = this.findDirectAttachSourceBinding(asset, bindings)
    if (!source) return null
    const allowance = await this.deps.mediaReuseGovernanceService.canQuoteOriginalAssetForSource({
      asset,
      source_kind: source.source_kind,
      agent_id: asset.steward_agent_id ?? 'unknown-agent',
      binding_display_policy: source.binding.display_policy,
    })
    if (!allowance.allowed) {
      return null
    }
    return source
  }

  private findDirectAttachSourceBinding(
    asset: MediaAsset,
    bindings: SceneMediaBinding[],
  ): {
    source_kind: VisualSourceKind
    binding: SceneMediaBinding
  } | null {
    const mediaPoolBindings = bindings.filter((binding) => binding.scene_type === 'media_pool')
    const stewardAgentId = asset.steward_agent_id
    const candidates: Array<{
      source_kind: VisualSourceKind
      scene_id: string
    }> = [
      ...(stewardAgentId
        ? [
            {
              source_kind: 'self_public_archive' as const,
              scene_id: buildSelfPublicArchivePoolSceneId(stewardAgentId),
            },
            {
              source_kind: 'generated_public' as const,
              scene_id: buildGeneratedPublicPoolSceneId(stewardAgentId),
            },
            {
              source_kind: 'private_derived_public' as const,
              scene_id: buildPrivateDerivedPublicPoolSceneId(stewardAgentId),
            },
          ]
        : []),
      {
        source_kind: 'platform_canonical' as const,
        scene_id: buildPlatformCanonicalPoolSceneId(),
      },
    ]

    for (const candidate of candidates) {
      const binding = mediaPoolBindings.find((item) => item.scene_id === candidate.scene_id) ?? null
      if (binding) {
        return {
          source_kind: candidate.source_kind,
          binding,
        }
      }
    }

    const communityBinding = mediaPoolBindings.find((binding) => binding.scene_id.startsWith('community_commons:')) ?? null
    if (communityBinding) {
      const communityId = communityBinding.scene_id.slice('community_commons:'.length)
      return communityId
        ? {
            source_kind: 'community_commons',
            binding: {
              ...communityBinding,
              scene_id: buildCommunityCommonsPoolSceneId(communityId),
            },
          }
        : null
    }

    return null
  }

  private async createSceneBinding(input: {
    scene_type: 'forum_post' | 'forum_thread' | 'forum_turn' | 'chat_room_message'
    scene_id: string
    asset: Parameters<MediaBindingService['createForumPostBinding']>[0]['asset']
    snapshot: Parameters<MediaBindingService['createForumPostBinding']>[0]['snapshot']
    sourceBinding?: SceneMediaBinding | null
    created_by_id?: string
    display_policy: Parameters<MediaBindingService['createForumPostBinding']>[0]['displayPolicy']
    relation_to_scene: Parameters<MediaBindingService['createForumPostBinding']>[0]['relationToScene']
    thread_root_ref: string | null
  }): Promise<SceneMediaBinding> {
    if (input.scene_type === 'forum_post') {
      return this.deps.mediaBindingService.createForumPostBinding({
        asset: input.asset,
        snapshot: input.snapshot,
        postId: input.scene_id,
        sourceBinding: input.sourceBinding,
        createdById: input.created_by_id,
        displayPolicy: input.display_policy,
        relationToScene: input.relation_to_scene,
        threadRootRef: input.thread_root_ref,
      })
    }
    if (input.scene_type === 'forum_thread') {
      return this.deps.mediaBindingService.createForumThreadBinding({
        asset: input.asset,
        snapshot: input.snapshot,
        threadId: input.scene_id,
        sourceBinding: input.sourceBinding,
        createdById: input.created_by_id,
        displayPolicy: input.display_policy,
        relationToScene: input.relation_to_scene,
        threadRootRef: input.thread_root_ref,
      })
    }
    if (input.scene_type === 'forum_turn') {
      const threadId = readForumThreadIdFromThreadRootRef(input.thread_root_ref) ?? input.scene_id
      return this.deps.mediaBindingService.createForumTurnBinding({
        asset: input.asset,
        snapshot: input.snapshot,
        turnId: input.scene_id,
        threadId,
        sourceBinding: input.sourceBinding,
        createdById: input.created_by_id,
        displayPolicy: input.display_policy,
        relationToScene: input.relation_to_scene,
        threadRootRef: input.thread_root_ref,
      })
    }
    return this.deps.mediaBindingService.createChatRoomMessageBinding({
      asset: input.asset,
      snapshot: input.snapshot,
      messageId: input.scene_id,
      sourceBinding: input.sourceBinding,
      createdById: input.created_by_id,
      displayPolicy: input.display_policy,
      relationToScene: input.relation_to_scene,
      threadRootRef: input.thread_root_ref,
    })
  }

  private resolveThreadRootRef(
    plan: PersistedImagePlan,
    input: {
      scene_type: 'forum_post' | 'forum_thread' | 'forum_turn' | 'chat_room_message'
      scene_id: string
    },
  ): string | null {
    if (input.scene_type === 'forum_post') {
      return buildForumPostThreadRootRef(input.scene_id)
    }
    if (input.scene_type === 'forum_thread') {
      return buildForumThreadThreadRootRef(input.scene_id)
    }
    if (plan.scene_ref.thread_root_ref?.trim()) {
      return plan.scene_ref.thread_root_ref
    }
    if (input.scene_type === 'forum_turn' && typeof plan.scene_ref.thread_id === 'string' && plan.scene_ref.thread_id.trim()) {
      return buildForumThreadThreadRootRef(plan.scene_ref.thread_id)
    }
    if (input.scene_type === 'chat_room_message') {
      return `room_message:${input.scene_id}`
    }
    return null
  }

  private ensurePostMediaLink(
    sceneType: 'forum_post' | 'forum_thread' | 'forum_turn' | 'chat_room_message',
    sceneId: string,
    assetId: string,
    mediaUrl: string,
    mimeType: string,
    governanceContext?: GovernanceWriteContextInput,
  ): void {
    if (sceneType !== 'forum_post') return
    const hasPostMedia = this.deps.postMediaRepo.findByAssetId(assetId)
      .some((item) => item.post_id === sceneId)
    if (hasPostMedia) return
    const link = this.deps.postMediaRepo.create({
      post_id: sceneId,
      asset_id: assetId,
      media_url: mediaUrl,
      mime_type: mimeType,
      governance_batch_id: governanceContext?.governance_batch_id ?? null,
      generation_mode: governanceContext?.generation_mode ?? null,
    })
    void this.deps.mediaLineageService?.recordEdge({
      from_node_type: 'asset',
      from_node_id: assetId,
      to_node_type: 'post_media_attachment',
      to_node_id: link.id,
      edge_kind: 'asset_attached_to_post_media',
      post_id: sceneId,
      mime_type: mimeType,
    })
  }

  private resolveAttachmentBindingContract(
    sceneType: 'forum_post' | 'forum_thread' | 'forum_turn' | 'chat_room_message',
    displayVariant: 'original' | 'generated_derivative',
  ): {
    display_policy: 'original_allowed' | 'derivative_only'
    relation_to_scene:
      | 'selected_for_post'
      | 'selected_for_thread'
      | 'selected_for_turn'
      | 'attached_to_chat_room_message'
      | 'generated_for_scene'
  } {
    if (displayVariant === 'generated_derivative') {
      return {
        display_policy: 'derivative_only',
        relation_to_scene: 'generated_for_scene',
      }
    }
    if (sceneType === 'forum_post') {
      return {
        display_policy: 'original_allowed',
        relation_to_scene: 'selected_for_post',
      }
    }
    if (sceneType === 'forum_thread') {
      return {
        display_policy: 'original_allowed',
        relation_to_scene: 'selected_for_thread',
      }
    }
    if (sceneType === 'forum_turn') {
      return {
        display_policy: 'original_allowed',
        relation_to_scene: 'selected_for_turn',
      }
    }
    return {
      display_policy: 'original_allowed',
      relation_to_scene: 'attached_to_chat_room_message',
    }
  }

  private async resolveSourceBinding(
    assetId: string,
    sourceKind: string,
    episodeId?: string | null,
  ): Promise<SceneMediaBinding | null> {
    const bindings = await this.deps.sceneMediaBindingRepo.findByAssetId(assetId)
    if (bindings.length === 0) return null

    if (sourceKind === 'owner_private_pool') {
      const asset = await this.deps.mediaAssetRepo.findById(assetId)
      if (!asset?.steward_agent_id) return null
      const ownerSceneId = buildOwnerPrivatePoolSceneId(asset.steward_agent_id)
      return bindings.find(
        (binding) => binding.scene_type === 'memory_card' && binding.scene_id === ownerSceneId,
      ) ?? null
    }

    if (sourceKind === 'same_episode_public' && episodeId) {
      const episodeMetadata = await this.deps.forumSceneMetadataRepo.listByEpisodeId(episodeId)
      const postIds = new Set(
        episodeMetadata
          .filter((item) => item.target_type === 'POST' && item.post_id)
          .map((item) => item.post_id as string),
      )
      return bindings.find((binding) => binding.scene_type === 'forum_post' && postIds.has(binding.scene_id)) ?? null
    }

    return bindings.find((binding) => binding.scene_type === 'forum_post') ?? bindings[0] ?? null
  }
}
