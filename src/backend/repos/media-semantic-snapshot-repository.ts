import type {
  CreateMediaSemanticSnapshotInput,
  MediaSemanticSnapshot,
} from './types.js'

export interface MediaSemanticSnapshotRepository {
  create(input: CreateMediaSemanticSnapshotInput): Promise<MediaSemanticSnapshot>
  clearCurrentByAssetId(assetId: string): Promise<void>
  replaceCurrent(input: CreateMediaSemanticSnapshotInput): Promise<MediaSemanticSnapshot>
  findCurrentByAssetId(assetId: string): Promise<MediaSemanticSnapshot | null>
  listByAssetId(assetId: string): Promise<MediaSemanticSnapshot[]>
}

let counter = 0
function cuid(): string {
  return `media_snapshot_${Date.now()}_${++counter}`
}

export class InMemoryMediaSemanticSnapshotRepository implements MediaSemanticSnapshotRepository {
  private store = new Map<string, MediaSemanticSnapshot>()

  private buildSnapshot(input: CreateMediaSemanticSnapshotInput): MediaSemanticSnapshot {
    return {
      id: input.id ?? cuid(),
      asset_id: input.asset_id,
      snapshot_kind: input.snapshot_kind,
      schema_version: input.schema_version,
      model_provider: input.model_provider,
      model_name: input.model_name,
      model_version: input.model_version,
      summary: input.summary,
      extraction_status: input.extraction_status,
      quality_grade: input.quality_grade,
      is_current: input.is_current ?? true,
      created_at: new Date(),
    }
  }

  async create(input: CreateMediaSemanticSnapshotInput): Promise<MediaSemanticSnapshot> {
    const snapshot = this.buildSnapshot(input)
    this.store.set(snapshot.id, snapshot)
    return snapshot
  }

  async clearCurrentByAssetId(assetId: string): Promise<void> {
    for (const snapshot of this.store.values()) {
      if (snapshot.asset_id !== assetId) continue
      snapshot.is_current = false
    }
  }

  async replaceCurrent(input: CreateMediaSemanticSnapshotInput): Promise<MediaSemanticSnapshot> {
    const snapshot = this.buildSnapshot({
      ...input,
      is_current: true,
    })
    for (const current of this.store.values()) {
      if (current.asset_id !== input.asset_id) continue
      current.is_current = false
    }
    this.store.set(snapshot.id, snapshot)
    return snapshot
  }

  async findCurrentByAssetId(assetId: string): Promise<MediaSemanticSnapshot | null> {
    return Array.from(this.store.values())
      .filter((item) => item.asset_id === assetId && item.is_current)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0] ?? null
  }

  async listByAssetId(assetId: string): Promise<MediaSemanticSnapshot[]> {
    return Array.from(this.store.values())
      .filter((item) => item.asset_id === assetId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }
}
