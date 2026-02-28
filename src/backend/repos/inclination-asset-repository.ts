import type {
  AgentInclinationAsset,
  CreateAgentInclinationAssetInput,
  InclinationAssetStatus,
} from './types.js'

export interface UpdateInclinationAssetPatch {
  status?: InclinationAssetStatus
  consumed_post_id?: string | null
  consumed_at?: Date | null
  media_url?: string
  storage_key?: string | null
}

export interface InclinationAssetRepository {
  create(input: CreateAgentInclinationAssetInput): AgentInclinationAsset
  findById(id: string): AgentInclinationAsset | null
  findPendingByAgent(agentId: string): AgentInclinationAsset | null
  findLastConsumedByAgent(agentId: string): AgentInclinationAsset | null
  listPendingAgentIds(limit?: number): string[]
  update(id: string, patch: UpdateInclinationAssetPatch): AgentInclinationAsset | null
  replacePending(agentId: string, replacedById?: string): number
}

let counter = 0
function cuid(): string {
  return `incl_asset_${Date.now()}_${++counter}`
}

export class InMemoryInclinationAssetRepository implements InclinationAssetRepository {
  private store = new Map<string, AgentInclinationAsset>()

  create(input: CreateAgentInclinationAssetInput): AgentInclinationAsset {
    const now = new Date()
    const asset: AgentInclinationAsset = {
      id: input.id ?? cuid(),
      agent_id: input.agent_id,
      owner_user_id: input.owner_user_id,
      source_type: input.source_type,
      origin_url: input.origin_url ?? null,
      storage_key: input.storage_key ?? null,
      media_url: input.media_url,
      mime_type: input.mime_type,
      file_size_bytes: input.file_size_bytes,
      owner_note: input.owner_note ?? null,
      vision_summary: input.vision_summary,
      status: input.status ?? 'PENDING',
      consumed_post_id: null,
      consumed_at: null,
      created_at: now,
    }
    this.store.set(asset.id, asset)
    return asset
  }

  findById(id: string): AgentInclinationAsset | null {
    return this.store.get(id) ?? null
  }

  findPendingByAgent(agentId: string): AgentInclinationAsset | null {
    const pending = Array.from(this.store.values())
      .filter((item) => item.agent_id === agentId && item.status === 'PENDING')
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return pending[0] ?? null
  }

  findLastConsumedByAgent(agentId: string): AgentInclinationAsset | null {
    const consumed = Array.from(this.store.values())
      .filter((item) => item.agent_id === agentId && item.status === 'CONSUMED')
      .sort((a, b) => {
        const aTs = (a.consumed_at ?? a.created_at).getTime()
        const bTs = (b.consumed_at ?? b.created_at).getTime()
        return bTs - aTs
      })
    return consumed[0] ?? null
  }

  listPendingAgentIds(limit = 100): string[] {
    const unique: string[] = []
    const seen = new Set<string>()
    const pending = Array.from(this.store.values())
      .filter((item) => item.status === 'PENDING')
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())

    for (const item of pending) {
      if (seen.has(item.agent_id)) continue
      seen.add(item.agent_id)
      unique.push(item.agent_id)
      if (unique.length >= limit) break
    }
    return unique
  }

  update(id: string, patch: UpdateInclinationAssetPatch): AgentInclinationAsset | null {
    const asset = this.store.get(id)
    if (!asset) return null
    if (patch.status !== undefined) asset.status = patch.status
    if (patch.consumed_post_id !== undefined) asset.consumed_post_id = patch.consumed_post_id
    if (patch.consumed_at !== undefined) asset.consumed_at = patch.consumed_at
    if (patch.media_url !== undefined) asset.media_url = patch.media_url
    if (patch.storage_key !== undefined) asset.storage_key = patch.storage_key
    return asset
  }

  replacePending(agentId: string, replacedById?: string): number {
    let count = 0
    for (const asset of this.store.values()) {
      if (asset.agent_id !== agentId) continue
      if (asset.status !== 'PENDING') continue
      if (replacedById && asset.id === replacedById) continue
      asset.status = 'REPLACED'
      count += 1
    }
    return count
  }
}
