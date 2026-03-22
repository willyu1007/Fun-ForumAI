import type { MediaAssetRepository } from '../repos/media-asset-repository.js'
import type { MediaSemanticSnapshotRepository } from '../repos/media-semantic-snapshot-repository.js'
import type { SceneMediaBindingRepository } from '../repos/scene-media-binding-repository.js'
import type { MediaContextProjectionRepository } from '../repos/media-context-projection-repository.js'
import type { PostMediaRepository } from '../repos/post-media-repository.js'
import type { ImagePlanRepository } from '../repos/image-plan-repository.js'
import type { ForumSceneMetadataRepository } from '../repos/forum-scene-metadata-repository.js'
import type { StorageAdapter } from '../services/storage-adapter.js'
import type { SceneMediaBinding } from '../repos/types.js'
import { MediaBindingService, buildOwnerPrivatePoolSceneId } from './media-binding-service.js'
import { MediaProjectionService } from './media-projection-service.js'
import { resolveMediaAssetUrl } from './media-url.js'

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
}

export class MediaWriteBridge {
  constructor(private readonly deps: MediaWriteBridgeDeps) {}

  async attachAssetToPost(input: {
    asset_id: string
    post_id: string
    created_by_id?: string
  }): Promise<{ linked: boolean }> {
    const asset = await this.deps.mediaAssetRepo.findById(input.asset_id)
    if (!asset || asset.lifecycle_status !== 'active' || asset.visibility_policy === 'blocked') {
      return { linked: false }
    }

    const snapshot = await this.deps.mediaSemanticSnapshotRepo.findCurrentByAssetId(asset.id)
    if (!snapshot) {
      return { linked: false }
    }

    const mediaUrl = resolveMediaAssetUrl(asset, this.deps.storage)
    if (!mediaUrl) {
      return { linked: false }
    }

    const bindings = await this.deps.sceneMediaBindingRepo.findByAssetId(asset.id)
    const existingPostBinding = bindings.find(
      (binding) => binding.scene_type === 'forum_post' && binding.scene_id === input.post_id,
    ) ?? null
    const ownerPoolBinding = this.findOwnerPoolBinding(bindings, asset.steward_agent_id)

    const postBinding = existingPostBinding ?? await this.deps.mediaBindingService.createForumPostBinding({
      asset,
      snapshot,
      postId: input.post_id,
      sourceBinding: ownerPoolBinding,
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
      })
    }

    if (asset.visibility_policy === 'private_only') {
      await this.deps.mediaAssetRepo.update(asset.id, {
        visibility_policy: 'public_original_allowed',
      })
    }

    return { linked: true }
  }

  async applyImagePlanAfterPersist(input: {
    image_plan_id: string
    scene_type: 'forum_post' | 'forum_comment' | 'chat_room_message'
    scene_id: string
    created_by_id?: string
  }): Promise<{ linked: boolean }> {
    const plan = await this.deps.imagePlanRepo.findById(input.image_plan_id)
    if (!plan) {
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
      })

      const mediaUrl = resolveMediaAssetUrl(asset, this.deps.storage)
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

      this.ensurePostMediaLink(input.scene_type, input.scene_id, asset.id, mediaUrl, asset.mime_type)

      if (asset.visibility_policy === 'private_only' && attachment.display_variant === 'original') {
        await this.deps.mediaAssetRepo.update(asset.id, {
          visibility_policy: 'public_original_allowed',
        })
      }

      linkedAssetIds.add(asset.id)
      linked = true
    }

    for (const attachment of plan.display.attachments) {
      if (linkedAssetIds.has(attachment.asset_id)) continue
      const asset = await this.deps.mediaAssetRepo.findById(attachment.asset_id)
      if (!asset || asset.lifecycle_status !== 'active' || asset.visibility_policy === 'blocked') continue
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
      })
      const mediaUrl = resolveMediaAssetUrl(asset, this.deps.storage)
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
      this.ensurePostMediaLink(input.scene_type, input.scene_id, asset.id, mediaUrl, asset.mime_type)
      linkedAssetIds.add(asset.id)
      linked = true
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

  private async createSceneBinding(input: {
    scene_type: 'forum_post' | 'forum_comment' | 'chat_room_message'
    scene_id: string
    asset: Parameters<MediaBindingService['createForumPostBinding']>[0]['asset']
    snapshot: Parameters<MediaBindingService['createForumPostBinding']>[0]['snapshot']
    sourceBinding?: SceneMediaBinding | null
    created_by_id?: string
    display_policy: Parameters<MediaBindingService['createForumPostBinding']>[0]['displayPolicy']
    relation_to_scene: Parameters<MediaBindingService['createForumPostBinding']>[0]['relationToScene']
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
      })
    }
    if (input.scene_type === 'forum_comment') {
      return this.deps.mediaBindingService.createForumCommentBinding({
        asset: input.asset,
        snapshot: input.snapshot,
        commentId: input.scene_id,
        sourceBinding: input.sourceBinding,
        createdById: input.created_by_id,
        displayPolicy: input.display_policy,
        relationToScene: input.relation_to_scene,
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
    })
  }

  private ensurePostMediaLink(
    sceneType: 'forum_post' | 'forum_comment' | 'chat_room_message',
    sceneId: string,
    assetId: string,
    mediaUrl: string,
    mimeType: string,
  ): void {
    if (sceneType !== 'forum_post') return
    const hasPostMedia = this.deps.postMediaRepo.findByAssetId(assetId)
      .some((item) => item.post_id === sceneId)
    if (hasPostMedia) return
    this.deps.postMediaRepo.create({
      post_id: sceneId,
      asset_id: assetId,
      media_url: mediaUrl,
      mime_type: mimeType,
    })
  }

  private resolveAttachmentBindingContract(
    sceneType: 'forum_post' | 'forum_comment' | 'chat_room_message',
    displayVariant: 'original' | 'generated_derivative',
  ): {
    display_policy: 'original_allowed' | 'derivative_only'
    relation_to_scene: 'selected_for_post' | 'selected_for_comment' | 'attached_to_chat_room_message' | 'generated_for_scene'
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
    if (sceneType === 'forum_comment') {
      return {
        display_policy: 'original_allowed',
        relation_to_scene: 'selected_for_comment',
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
