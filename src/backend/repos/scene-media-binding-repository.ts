import type {
  CreateSceneMediaBindingInput,
  MediaSceneType,
  SceneMediaBinding,
} from './types.js'

export interface SceneMediaBindingRepository {
  create(input: CreateSceneMediaBindingInput): Promise<SceneMediaBinding>
  deleteByIds(ids: string[]): Promise<number>
  findByAssetId(assetId: string): Promise<SceneMediaBinding[]>
  findByAssetIds(assetIds: string[]): Promise<SceneMediaBinding[]>
  findByThreadRootRef(
    threadRootRef: string,
    options?: {
      limit?: number
    },
  ): Promise<SceneMediaBinding[]>
  findLatestByAssetAndSceneType(assetId: string, sceneType: MediaSceneType): Promise<SceneMediaBinding | null>
  findByScene(sceneType: MediaSceneType, sceneId: string): Promise<SceneMediaBinding[]>
  findByScenes(sceneType: MediaSceneType, sceneIds: string[]): Promise<SceneMediaBinding[]>
  updateSemanticSnapshotId(id: string, semanticSnapshotId: string): Promise<SceneMediaBinding | null>
}

let counter = 0
function cuid(): string {
  return `media_binding_${Date.now()}_${++counter}`
}

export class InMemorySceneMediaBindingRepository implements SceneMediaBindingRepository {
  private store = new Map<string, SceneMediaBinding>()

  async create(input: CreateSceneMediaBindingInput): Promise<SceneMediaBinding> {
    const binding: SceneMediaBinding = {
      id: input.id ?? cuid(),
      scene_type: input.scene_type,
      scene_id: input.scene_id,
      thread_root_ref: input.thread_root_ref ?? null,
      asset_id: input.asset_id,
      semantic_snapshot_id: input.semantic_snapshot_id,
      source_scene_type: input.source_scene_type ?? null,
      source_scene_id: input.source_scene_id ?? null,
      binding_role: input.binding_role,
      relation_to_scene: input.relation_to_scene,
      binding_note_text: input.binding_note_text ?? null,
      display_policy: input.display_policy,
      created_by_type: input.created_by_type,
      created_by_id: input.created_by_id,
      created_at: new Date(),
    }
    this.store.set(binding.id, binding)
    return binding
  }

  async deleteByIds(ids: string[]): Promise<number> {
    const deleteIds = new Set(ids)
    if (deleteIds.size === 0) return 0
    let deleted = 0
    for (const id of deleteIds) {
      if (this.store.delete(id)) {
        deleted += 1
      }
    }
    return deleted
  }

  async findByAssetId(assetId: string): Promise<SceneMediaBinding[]> {
    return Array.from(this.store.values())
      .filter((item) => item.asset_id === assetId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }

  async findByAssetIds(assetIds: string[]): Promise<SceneMediaBinding[]> {
    const lookup = new Set(assetIds)
    return Array.from(this.store.values())
      .filter((item) => lookup.has(item.asset_id))
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }

  async findByThreadRootRef(
    threadRootRef: string,
    options?: {
      limit?: number
    },
  ): Promise<SceneMediaBinding[]> {
    const sorted = Array.from(this.store.values())
      .filter((item) => item.thread_root_ref === threadRootRef)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return typeof options?.limit === 'number' && options.limit > 0
      ? sorted.slice(0, options.limit)
      : sorted
  }

  async findLatestByAssetAndSceneType(
    assetId: string,
    sceneType: MediaSceneType,
  ): Promise<SceneMediaBinding | null> {
    return Array.from(this.store.values())
      .filter((item) => item.asset_id === assetId && item.scene_type === sceneType)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0] ?? null
  }

  async findByScene(sceneType: MediaSceneType, sceneId: string): Promise<SceneMediaBinding[]> {
    return Array.from(this.store.values())
      .filter((item) => item.scene_type === sceneType && item.scene_id === sceneId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }

  async findByScenes(sceneType: MediaSceneType, sceneIds: string[]): Promise<SceneMediaBinding[]> {
    if (sceneIds.length === 0) return []
    const lookup = new Set(sceneIds)
    return Array.from(this.store.values())
      .filter((item) => item.scene_type === sceneType && lookup.has(item.scene_id))
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }

  async updateSemanticSnapshotId(
    id: string,
    semanticSnapshotId: string,
  ): Promise<SceneMediaBinding | null> {
    const binding = this.store.get(id)
    if (!binding) return null
    binding.semantic_snapshot_id = semanticSnapshotId
    return binding
  }
}
