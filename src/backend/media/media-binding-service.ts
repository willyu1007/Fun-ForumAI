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
import {
  buildForumPostThreadRootRef,
  buildForumThreadThreadRootRef,
  buildForumTurnThreadRootRef,
} from './media-contract-utils.js'

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
    threadRootRef?: string | null
    sourceBinding?: SceneMediaBinding | null
    bindingNoteText?: string | null
  }): Promise<SceneMediaBinding> {
    const payload: CreateSceneMediaBindingInput = {
      scene_type: input.sceneType,
      scene_id: input.sceneId,
      thread_root_ref: input.threadRootRef ?? null,
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
    threadRootRef?: string | null
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
      threadRootRef: input.threadRootRef ?? buildForumPostThreadRootRef(input.postId),
      createdByType: 'system',
      createdById: input.createdById ?? 'scheduled-post-bridge',
      sourceBinding: input.sourceBinding,
    })
  }

  createForumThreadBinding(input: {
    asset: MediaAsset
    snapshot: MediaSemanticSnapshot
    threadId: string
    sourceBinding?: SceneMediaBinding | null
    createdById?: string
    createdByType?: CreateSceneMediaBindingInput['created_by_type']
    displayPolicy?: MediaDisplayPolicy
    relationToScene?: MediaRelationToScene
    threadRootRef?: string | null
  }): Promise<SceneMediaBinding> {
    return this.bindToScene({
      asset: input.asset,
      snapshot: input.snapshot,
      sceneType: 'forum_thread',
      sceneId: input.threadId,
      bindingRole: 'inline',
      relationToScene: input.relationToScene ?? 'selected_for_thread',
      displayPolicy: input.displayPolicy ?? 'original_allowed',
      threadRootRef: input.threadRootRef ?? buildForumThreadThreadRootRef(input.threadId),
      createdByType: input.createdByType ?? 'system',
      createdById: input.createdById ?? 'surface-media-bridge',
      sourceBinding: input.sourceBinding,
    })
  }

  createForumTurnBinding(input: {
    asset: MediaAsset
    snapshot: MediaSemanticSnapshot
    turnId: string
    threadId: string
    sourceBinding?: SceneMediaBinding | null
    createdById?: string
    createdByType?: CreateSceneMediaBindingInput['created_by_type']
    displayPolicy?: MediaDisplayPolicy
    relationToScene?: MediaRelationToScene
    threadRootRef?: string | null
  }): Promise<SceneMediaBinding> {
    return this.bindToScene({
      asset: input.asset,
      snapshot: input.snapshot,
      sceneType: 'forum_turn',
      sceneId: input.turnId,
      bindingRole: 'inline',
      relationToScene: input.relationToScene ?? 'selected_for_turn',
      displayPolicy: input.displayPolicy ?? 'original_allowed',
      threadRootRef: input.threadRootRef ?? buildForumTurnThreadRootRef(input.threadId),
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
    threadRootRef?: string | null
  }): Promise<SceneMediaBinding> {
    return this.bindToScene({
      asset: input.asset,
      snapshot: input.snapshot,
      sceneType: 'chat_room_message',
      sceneId: input.messageId,
      bindingRole: 'inline',
      relationToScene: input.relationToScene ?? 'attached_to_chat_room_message',
      displayPolicy: input.displayPolicy ?? 'original_allowed',
      threadRootRef: input.threadRootRef ?? null,
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
    threadRootRef?: string | null
  }): Promise<SceneMediaBinding> {
    return this.bindToScene({
      asset: input.asset,
      snapshot: input.snapshot,
      sceneType: 'private_message',
      sceneId: input.messageId,
      bindingRole: 'inline',
      relationToScene: 'attached_to_private_message',
      displayPolicy: 'original_allowed',
      threadRootRef: input.threadRootRef ?? null,
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
    threadRootRef?: string | null
  }): Promise<SceneMediaBinding> {
    return this.bindToScene({
      asset: input.asset,
      snapshot: input.snapshot,
      sceneType: 'achievement_card',
      sceneId: input.cardId,
      bindingRole: 'reference',
      relationToScene: 'referenced_by_achievement',
      displayPolicy: input.displayPolicy ?? 'original_allowed',
      threadRootRef: input.threadRootRef ?? null,
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
    threadRootRef?: string | null
  }): Promise<SceneMediaBinding> {
    return this.bindToScene({
      asset: input.asset,
      snapshot: input.snapshot,
      sceneType: 'episode_prop',
      sceneId: input.propId,
      bindingRole: 'reference',
      relationToScene: 'referenced_by_episode_prop',
      displayPolicy: input.displayPolicy ?? 'original_allowed',
      threadRootRef: input.threadRootRef ?? null,
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
    threadRootRef?: string | null
  }): Promise<SceneMediaBinding> {
    return this.bindToScene({
      asset: input.asset,
      snapshot: input.snapshot,
      sceneType: 'media_pool',
      sceneId: input.poolId,
      bindingRole: input.bindingRole ?? 'reference',
      relationToScene: input.relationToScene ?? 'quoted_public',
      displayPolicy: input.displayPolicy ?? 'original_allowed',
      threadRootRef: input.threadRootRef ?? null,
      createdByType: input.createdByType ?? 'system',
      createdById: input.createdById,
      sourceBinding: input.sourceBinding,
    })
  }
}
