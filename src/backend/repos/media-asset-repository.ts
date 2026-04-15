import type {
  CreateMediaAssetInput,
  MediaAsset,
  MediaLifecycleStatus,
  MediaVisibilityPolicy,
} from './types.js'

export interface UpdateMediaAssetPatch {
  visibility_policy?: MediaVisibilityPolicy
  lifecycle_status?: MediaLifecycleStatus
  sha256?: string
  phash?: string | null
  width?: number | null
  height?: number | null
  storage_key?: string | null
  origin_url?: string | null
  duplicate_cluster_id?: string | null
  duplicate_distance?: number | null
}

export interface MediaAssetRepository {
  create(input: CreateMediaAssetInput): Promise<MediaAsset>
  findById(id: string): Promise<MediaAsset | null>
  findByIds(ids: string[]): Promise<MediaAsset[]>
  listBySha256(sha256: string): Promise<MediaAsset[]>
  listByPhash(phash: string): Promise<MediaAsset[]>
  listByDuplicateClusterId(clusterId: string): Promise<MediaAsset[]>
  listRecent(opts?: {
    limit?: number
    lifecycle_statuses?: MediaLifecycleStatus[]
    before?: {
      created_at: Date
      id: string
    }
  }): Promise<MediaAsset[]>
  listStewardAgentIdsWithAssets(opts?: {
    limit?: number
    lifecycle_statuses?: MediaLifecycleStatus[]
  }): Promise<string[]>
  listByStewardAgentId(agentId: string, opts?: {
    limit?: number
    lifecycle_statuses?: MediaLifecycleStatus[]
  }): Promise<MediaAsset[]>
  update(id: string, patch: UpdateMediaAssetPatch): Promise<MediaAsset | null>
}

let counter = 0
function cuid(): string {
  return `media_asset_${Date.now()}_${String(++counter).padStart(8, '0')}`
}

function compareRecent(a: MediaAsset, b: MediaAsset): number {
  return b.created_at.getTime() - a.created_at.getTime() || b.id.localeCompare(a.id)
}

export class InMemoryMediaAssetRepository implements MediaAssetRepository {
  private store = new Map<string, MediaAsset>()

  async create(input: CreateMediaAssetInput): Promise<MediaAsset> {
    const now = new Date()
    const asset: MediaAsset = {
      id: input.id ?? cuid(),
      steward_agent_id: input.steward_agent_id ?? null,
      owner_user_id: input.owner_user_id ?? null,
      source_kind: input.source_kind,
      source_scene_type: input.source_scene_type ?? null,
      source_scene_id: input.source_scene_id ?? null,
      visibility_policy: input.visibility_policy,
      lifecycle_status: input.lifecycle_status ?? 'active',
      storage_key: input.storage_key ?? null,
      origin_url: input.origin_url ?? null,
      mime_type: input.mime_type,
      file_size_bytes: input.file_size_bytes,
      width: input.width ?? null,
      height: input.height ?? null,
      sha256: input.sha256,
      phash: input.phash ?? null,
      duplicate_cluster_id: input.duplicate_cluster_id ?? null,
      duplicate_distance: input.duplicate_distance ?? null,
      created_at: now,
      updated_at: now,
    }
    this.store.set(asset.id, asset)
    return asset
  }

  async findById(id: string): Promise<MediaAsset | null> {
    return this.store.get(id) ?? null
  }

  async findByIds(ids: string[]): Promise<MediaAsset[]> {
    const lookup = new Set(ids)
    return Array.from(this.store.values())
      .filter((item) => lookup.has(item.id))
      .sort(compareRecent)
  }

  async listBySha256(sha256: string): Promise<MediaAsset[]> {
    return Array.from(this.store.values())
      .filter((item) => item.sha256 === sha256)
      .sort(compareRecent)
  }

  async listByPhash(phash: string): Promise<MediaAsset[]> {
    return Array.from(this.store.values())
      .filter((item) => item.phash === phash)
      .sort(compareRecent)
  }

  async listByDuplicateClusterId(clusterId: string): Promise<MediaAsset[]> {
    return Array.from(this.store.values())
      .filter((item) => item.duplicate_cluster_id === clusterId)
      .sort(compareRecent)
  }

  async listRecent(
    opts: {
      limit?: number
      lifecycle_statuses?: MediaLifecycleStatus[]
      before?: {
        created_at: Date
        id: string
      }
    } = {},
  ): Promise<MediaAsset[]> {
    const allowed = opts.lifecycle_statuses ? new Set(opts.lifecycle_statuses) : null
    const items = Array.from(this.store.values())
      .filter((item) => (allowed ? allowed.has(item.lifecycle_status) : true))
      .filter((item) => {
        if (!opts.before) return true
        const itemTime = item.created_at.getTime()
        const beforeTime = opts.before.created_at.getTime()
        return itemTime < beforeTime || (itemTime === beforeTime && item.id < opts.before.id)
      })
      .sort(compareRecent)
    return items.slice(0, opts.limit ?? items.length)
  }

  async listStewardAgentIdsWithAssets(
    opts: {
      limit?: number
      lifecycle_statuses?: MediaLifecycleStatus[]
    } = {},
  ): Promise<string[]> {
    const allowed = opts.lifecycle_statuses ? new Set(opts.lifecycle_statuses) : null
    const ordered = Array.from(this.store.values())
      .filter((item) => item.steward_agent_id)
      .filter((item) => (allowed ? allowed.has(item.lifecycle_status) : true))
      .sort(compareRecent)
    const ids: string[] = []
    const seen = new Set<string>()
    for (const item of ordered) {
      const stewardAgentId = item.steward_agent_id
      if (!stewardAgentId || seen.has(stewardAgentId)) continue
      seen.add(stewardAgentId)
      ids.push(stewardAgentId)
      if (ids.length >= (opts.limit ?? ids.length + 1)) break
    }
    return ids
  }

  async listByStewardAgentId(
    agentId: string,
    opts: {
      limit?: number
      lifecycle_statuses?: MediaLifecycleStatus[]
    } = {},
  ): Promise<MediaAsset[]> {
    const allowed = opts.lifecycle_statuses ? new Set(opts.lifecycle_statuses) : null
    const items = Array.from(this.store.values())
      .filter((item) => item.steward_agent_id === agentId)
      .filter((item) => (allowed ? allowed.has(item.lifecycle_status) : true))
      .sort(compareRecent)
    return items.slice(0, opts.limit ?? items.length)
  }

  async update(id: string, patch: UpdateMediaAssetPatch): Promise<MediaAsset | null> {
    const current = this.store.get(id)
    if (!current) return null
    if (patch.visibility_policy !== undefined) current.visibility_policy = patch.visibility_policy
    if (patch.lifecycle_status !== undefined) current.lifecycle_status = patch.lifecycle_status
    if (patch.sha256 !== undefined) current.sha256 = patch.sha256
    if (patch.phash !== undefined) current.phash = patch.phash
    if (patch.width !== undefined) current.width = patch.width
    if (patch.height !== undefined) current.height = patch.height
    if (patch.storage_key !== undefined) current.storage_key = patch.storage_key
    if (patch.origin_url !== undefined) current.origin_url = patch.origin_url
    if (patch.duplicate_cluster_id !== undefined) current.duplicate_cluster_id = patch.duplicate_cluster_id
    if (patch.duplicate_distance !== undefined) current.duplicate_distance = patch.duplicate_distance
    current.updated_at = new Date()
    return current
  }
}
