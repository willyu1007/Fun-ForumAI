import type {
  CreateSceneMediaBindingInput,
  MediaAsset,
  MediaDisplayPolicy,
  MediaRelationToScene,
  MediaSceneType,
  MediaSemanticSnapshot,
  SceneMediaBinding,
} from '../repos/types.js'
import type { SceneMediaBindingRepository } from '../repos/scene-media-binding-repository.js'

export function buildOwnerPrivatePoolSceneId(agentId: string): string {
  return `owner_private_pool:${agentId}`
}

export interface MediaBindingServiceDeps {
  sceneMediaBindingRepo: SceneMediaBindingRepository
}

export class MediaBindingService {
  constructor(private readonly deps: MediaBindingServiceDeps) {}

  bindToScene(input: {
    asset: MediaAsset
    snapshot: MediaSemanticSnapshot
    sceneType: MediaSceneType
    sceneId: string
    createdById: string
    createdByType: CreateSceneMediaBindingInput['created_by_type']
    bindingRole: CreateSceneMediaBindingInput['binding_role']
    relationToScene: MediaRelationToScene
    displayPolicy: MediaDisplayPolicy
    sourceBinding?: SceneMediaBinding | null
    bindingNoteText?: string | null
  }): Promise<SceneMediaBinding> {
    const payload: CreateSceneMediaBindingInput = {
      scene_type: input.sceneType,
      scene_id: input.sceneId,
      asset_id: input.asset.id,
      semantic_snapshot_id: input.snapshot.id,
      binding_role: input.bindingRole,
      relation_to_scene: input.relationToScene,
      binding_note_text: input.bindingNoteText ?? null,
      display_policy: input.displayPolicy,
      created_by_type: input.createdByType,
      created_by_id: input.createdById,
      ...(input.sourceBinding
        ? {
            source_scene_type: input.sourceBinding.scene_type,
            source_scene_id: input.sourceBinding.scene_id,
          }
        : {}),
    }
    return this.deps.sceneMediaBindingRepo.create(payload)
  }

  createOwnerPoolAnchor(input: {
    asset: MediaAsset
    snapshot: MediaSemanticSnapshot
    ownerNote: string | null
    ownerUserId: string
  }): Promise<SceneMediaBinding> {
    return this.bindToScene({
      asset: input.asset,
      snapshot: input.snapshot,
      sceneType: 'memory_card',
      sceneId: buildOwnerPrivatePoolSceneId(input.asset.steward_agent_id ?? 'unknown'),
      bindingRole: 'memory',
      relationToScene: 'uploaded_by_owner',
      bindingNoteText: input.ownerNote,
      displayPolicy: 'runtime_only_no_display',
      createdByType: 'owner',
      createdById: input.ownerUserId,
    })
  }

  createForumPostBinding(input: {
    asset: MediaAsset
    snapshot: MediaSemanticSnapshot
    postId: string
    sourceBinding?: SceneMediaBinding | null
    createdById?: string
    displayPolicy?: MediaDisplayPolicy
    relationToScene?: MediaRelationToScene
  }): Promise<SceneMediaBinding> {
    return this.bindToScene({
      asset: input.asset,
      snapshot: input.snapshot,
      sceneType: 'forum_post',
      sceneId: input.postId,
      bindingRole: 'primary',
      relationToScene: input.relationToScene ?? 'selected_for_post',
      displayPolicy: input.displayPolicy ?? (
        input.asset.visibility_policy === 'public_derivative_only'
          ? 'derivative_only'
          : 'original_allowed'
      ),
      createdByType: 'system',
      createdById: input.createdById ?? 'scheduled-post-bridge',
      sourceBinding: input.sourceBinding,
    })
  }

  createForumCommentBinding(input: {
    asset: MediaAsset
    snapshot: MediaSemanticSnapshot
    commentId: string
    sourceBinding?: SceneMediaBinding | null
    createdById?: string
    createdByType?: CreateSceneMediaBindingInput['created_by_type']
    displayPolicy?: MediaDisplayPolicy
    relationToScene?: MediaRelationToScene
  }): Promise<SceneMediaBinding> {
    return this.bindToScene({
      asset: input.asset,
      snapshot: input.snapshot,
      sceneType: 'forum_comment',
      sceneId: input.commentId,
      bindingRole: 'inline',
      relationToScene: input.relationToScene ?? 'selected_for_comment',
      displayPolicy: input.displayPolicy ?? 'original_allowed',
      createdByType: input.createdByType ?? 'system',
      createdById: input.createdById ?? 'surface-media-bridge',
      sourceBinding: input.sourceBinding,
    })
  }

  createChatRoomMessageBinding(input: {
    asset: MediaAsset
    snapshot: MediaSemanticSnapshot
    messageId: string
    sourceBinding?: SceneMediaBinding | null
    createdById?: string
    createdByType?: CreateSceneMediaBindingInput['created_by_type']
    displayPolicy?: MediaDisplayPolicy
    relationToScene?: MediaRelationToScene
  }): Promise<SceneMediaBinding> {
    return this.bindToScene({
      asset: input.asset,
      snapshot: input.snapshot,
      sceneType: 'chat_room_message',
      sceneId: input.messageId,
      bindingRole: 'inline',
      relationToScene: input.relationToScene ?? 'attached_to_chat_room_message',
      displayPolicy: input.displayPolicy ?? 'original_allowed',
      createdByType: input.createdByType ?? 'system',
      createdById: input.createdById ?? 'surface-media-bridge',
      sourceBinding: input.sourceBinding,
    })
  }

  createPrivateMessageBinding(input: {
    asset: MediaAsset
    snapshot: MediaSemanticSnapshot
    messageId: string
    createdById: string
    createdByType?: CreateSceneMediaBindingInput['created_by_type']
  }): Promise<SceneMediaBinding> {
    return this.bindToScene({
      asset: input.asset,
      snapshot: input.snapshot,
      sceneType: 'private_message',
      sceneId: input.messageId,
      bindingRole: 'inline',
      relationToScene: 'attached_to_private_message',
      displayPolicy: 'original_allowed',
      createdByType: input.createdByType ?? 'owner',
      createdById: input.createdById,
    })
  }

  createAchievementCardBinding(input: {
    asset: MediaAsset
    snapshot: MediaSemanticSnapshot
    cardId: string
    sourceBinding?: SceneMediaBinding | null
    createdById: string
    createdByType?: CreateSceneMediaBindingInput['created_by_type']
    displayPolicy?: MediaDisplayPolicy
  }): Promise<SceneMediaBinding> {
    return this.bindToScene({
      asset: input.asset,
      snapshot: input.snapshot,
      sceneType: 'achievement_card',
      sceneId: input.cardId,
      bindingRole: 'reference',
      relationToScene: 'referenced_by_achievement',
      displayPolicy: input.displayPolicy ?? 'original_allowed',
      createdByType: input.createdByType ?? 'system',
      createdById: input.createdById,
      sourceBinding: input.sourceBinding,
    })
  }

  createEpisodePropBinding(input: {
    asset: MediaAsset
    snapshot: MediaSemanticSnapshot
    propId: string
    sourceBinding?: SceneMediaBinding | null
    createdById: string
    createdByType?: CreateSceneMediaBindingInput['created_by_type']
    displayPolicy?: MediaDisplayPolicy
  }): Promise<SceneMediaBinding> {
    return this.bindToScene({
      asset: input.asset,
      snapshot: input.snapshot,
      sceneType: 'episode_prop',
      sceneId: input.propId,
      bindingRole: 'reference',
      relationToScene: 'referenced_by_episode_prop',
      displayPolicy: input.displayPolicy ?? 'original_allowed',
      createdByType: input.createdByType ?? 'system',
      createdById: input.createdById,
      sourceBinding: input.sourceBinding,
    })
  }

  createMediaPoolBinding(input: {
    asset: MediaAsset
    snapshot: MediaSemanticSnapshot
    poolId: string
    sourceBinding?: SceneMediaBinding | null
    displayPolicy?: MediaDisplayPolicy
    relationToScene?: MediaRelationToScene
    createdById: string
    createdByType?: CreateSceneMediaBindingInput['created_by_type']
    bindingRole?: CreateSceneMediaBindingInput['binding_role']
  }): Promise<SceneMediaBinding> {
    return this.bindToScene({
      asset: input.asset,
      snapshot: input.snapshot,
      sceneType: 'media_pool',
      sceneId: input.poolId,
      bindingRole: input.bindingRole ?? 'reference',
      relationToScene: input.relationToScene ?? 'quoted_public',
      displayPolicy: input.displayPolicy ?? 'original_allowed',
      createdByType: input.createdByType ?? 'system',
      createdById: input.createdById,
      sourceBinding: input.sourceBinding,
    })
  }
}
