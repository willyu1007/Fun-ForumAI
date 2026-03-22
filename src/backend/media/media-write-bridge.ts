import type { MediaAssetRepository } from '../repos/media-asset-repository.js'
import type { MediaSemanticSnapshotRepository } from '../repos/media-semantic-snapshot-repository.js'
import type { SceneMediaBindingRepository } from '../repos/scene-media-binding-repository.js'
import type { MediaContextProjectionRepository } from '../repos/media-context-projection-repository.js'
import type { PostMediaRepository } from '../repos/post-media-repository.js'
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
}
