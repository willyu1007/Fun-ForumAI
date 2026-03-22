import type { CreateSceneMediaBindingInput, MediaAsset, MediaSemanticSnapshot, SceneMediaBinding } from '../repos/types.js'
import type { SceneMediaBindingRepository } from '../repos/scene-media-binding-repository.js'

export function buildOwnerPrivatePoolSceneId(agentId: string): string {
  return `owner_private_pool:${agentId}`
}

export interface MediaBindingServiceDeps {
  sceneMediaBindingRepo: SceneMediaBindingRepository
}

export class MediaBindingService {
  constructor(private readonly deps: MediaBindingServiceDeps) {}

  createOwnerPoolAnchor(input: {
    asset: MediaAsset
    snapshot: MediaSemanticSnapshot
    ownerNote: string | null
    ownerUserId: string
  }): Promise<SceneMediaBinding> {
    return this.deps.sceneMediaBindingRepo.create({
      scene_type: 'memory_card',
      scene_id: buildOwnerPrivatePoolSceneId(input.asset.steward_agent_id ?? 'unknown'),
      asset_id: input.asset.id,
      semantic_snapshot_id: input.snapshot.id,
      binding_role: 'memory',
      relation_to_scene: 'uploaded_by_owner',
      binding_note_text: input.ownerNote,
      display_policy: 'runtime_only_no_display',
      created_by_type: 'owner',
      created_by_id: input.ownerUserId,
    })
  }

  createForumPostBinding(input: {
    asset: MediaAsset
    snapshot: MediaSemanticSnapshot
    postId: string
    sourceBinding?: SceneMediaBinding | null
    createdById?: string
  }): Promise<SceneMediaBinding> {
    const payload: CreateSceneMediaBindingInput = {
      scene_type: 'forum_post',
      scene_id: input.postId,
      asset_id: input.asset.id,
      semantic_snapshot_id: input.snapshot.id,
      binding_role: 'primary',
      relation_to_scene: 'selected_for_post',
      display_policy: input.asset.visibility_policy === 'public_derivative_only'
        ? 'derivative_only'
        : 'original_allowed',
      created_by_type: 'system',
      created_by_id: input.createdById ?? 'scheduled-post-bridge',
      ...(input.sourceBinding
        ? {
            source_scene_type: input.sourceBinding.scene_type,
            source_scene_id: input.sourceBinding.scene_id,
            binding_note_text: input.sourceBinding.binding_note_text,
          }
        : {}),
    }
    return this.deps.sceneMediaBindingRepo.create(payload)
  }
}
