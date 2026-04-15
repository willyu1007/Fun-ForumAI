import type {
  CreateMediaDuplicateClusterInput,
  MediaDuplicateCluster,
  UpdateMediaDuplicateClusterPatch,
} from './types.js'

export interface MediaDuplicateClusterRepository {
  create(input: CreateMediaDuplicateClusterInput): Promise<MediaDuplicateCluster>
  findById(id: string): Promise<MediaDuplicateCluster | null>
  findByCanonicalAssetId(assetId: string): Promise<MediaDuplicateCluster | null>
  findByIds(ids: string[]): Promise<MediaDuplicateCluster[]>
  update(id: string, patch: UpdateMediaDuplicateClusterPatch): Promise<MediaDuplicateCluster | null>
}

let counter = 0
function cuid(): string {
  return `media_duplicate_cluster_${Date.now()}_${String(++counter).padStart(8, '0')}`
}

function compareRecent(a: MediaDuplicateCluster, b: MediaDuplicateCluster): number {
  return b.created_at.getTime() - a.created_at.getTime() || b.id.localeCompare(a.id)
}

export class InMemoryMediaDuplicateClusterRepository implements MediaDuplicateClusterRepository {
  private readonly store = new Map<string, MediaDuplicateCluster>()

  async create(input: CreateMediaDuplicateClusterInput): Promise<MediaDuplicateCluster> {
    const now = new Date()
    const entity: MediaDuplicateCluster = {
      id: input.id ?? cuid(),
      duplicate_kind: input.duplicate_kind,
      canonical_asset_id: input.canonical_asset_id,
      evidence_json: input.evidence_json,
      status: input.status ?? 'active',
      created_at: now,
      updated_at: now,
    }
    this.store.set(entity.id, entity)
    return entity
  }

  async findById(id: string): Promise<MediaDuplicateCluster | null> {
    return this.store.get(id) ?? null
  }

  async findByCanonicalAssetId(assetId: string): Promise<MediaDuplicateCluster | null> {
    return Array.from(this.store.values())
      .find((item) => item.canonical_asset_id === assetId) ?? null
  }

  async findByIds(ids: string[]): Promise<MediaDuplicateCluster[]> {
    const lookup = new Set(ids)
    return Array.from(this.store.values())
      .filter((item) => lookup.has(item.id))
      .sort(compareRecent)
  }

  async update(id: string, patch: UpdateMediaDuplicateClusterPatch): Promise<MediaDuplicateCluster | null> {
    const entity = this.store.get(id)
    if (!entity) return null
    if (patch.canonical_asset_id !== undefined) entity.canonical_asset_id = patch.canonical_asset_id
    if (patch.evidence_json !== undefined) entity.evidence_json = patch.evidence_json
    if (patch.status !== undefined) entity.status = patch.status
    entity.updated_at = new Date()
    return entity
  }
}
