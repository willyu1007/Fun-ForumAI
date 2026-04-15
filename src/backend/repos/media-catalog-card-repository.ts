import type {
  CreateMediaCatalogCardInput,
  MediaCatalogCard,
  UpdateMediaCatalogCardPatch,
} from './types.js'

export interface MediaCatalogCardRepository {
  create(input: CreateMediaCatalogCardInput): Promise<MediaCatalogCard>
  findById(id: string): Promise<MediaCatalogCard | null>
  listByAssetId(assetId: string): Promise<MediaCatalogCard[]>
  findCurrentByAssetId(assetId: string): Promise<MediaCatalogCard | null>
  findCurrentByAssetIds(assetIds: string[]): Promise<MediaCatalogCard[]>
  markNonCurrentByAssetId(assetId: string, exceptCardId?: string): Promise<number>
  update(id: string, patch: UpdateMediaCatalogCardPatch): Promise<MediaCatalogCard | null>
}

let counter = 0
function cuid(): string {
  return `media_catalog_card_${Date.now()}_${String(++counter).padStart(8, '0')}`
}

function compareRecent(a: MediaCatalogCard, b: MediaCatalogCard): number {
  return b.created_at.getTime() - a.created_at.getTime() || b.id.localeCompare(a.id)
}

export class InMemoryMediaCatalogCardRepository implements MediaCatalogCardRepository {
  private readonly store = new Map<string, MediaCatalogCard>()

  async create(input: CreateMediaCatalogCardInput): Promise<MediaCatalogCard> {
    const entity: MediaCatalogCard = {
      id: input.id ?? cuid(),
      asset_id: input.asset_id,
      semantic_snapshot_id: input.semantic_snapshot_id ?? null,
      schema_version: input.schema_version ?? 'media-catalog-card.v1',
      modality: input.modality,
      source_kind: input.source_kind,
      content_hash: input.content_hash,
      build_status: input.build_status,
      payload_json: input.payload_json,
      is_current: input.is_current ?? true,
      created_at: new Date(),
    }
    this.store.set(entity.id, entity)
    return entity
  }

  async findById(id: string): Promise<MediaCatalogCard | null> {
    return this.store.get(id) ?? null
  }

  async listByAssetId(assetId: string): Promise<MediaCatalogCard[]> {
    return Array.from(this.store.values())
      .filter((item) => item.asset_id === assetId)
      .sort(compareRecent)
  }

  async findCurrentByAssetId(assetId: string): Promise<MediaCatalogCard | null> {
    return (await this.listByAssetId(assetId)).find((item) => item.is_current) ?? null
  }

  async findCurrentByAssetIds(assetIds: string[]): Promise<MediaCatalogCard[]> {
    const lookup = new Set(assetIds)
    return Array.from(this.store.values())
      .filter((item) => lookup.has(item.asset_id) && item.is_current)
      .sort(compareRecent)
  }

  async markNonCurrentByAssetId(assetId: string, exceptCardId?: string): Promise<number> {
    let updated = 0
    for (const entity of this.store.values()) {
      if (entity.asset_id !== assetId) continue
      if (exceptCardId && entity.id === exceptCardId) continue
      if (!entity.is_current) continue
      entity.is_current = false
      updated += 1
    }
    return updated
  }

  async update(id: string, patch: UpdateMediaCatalogCardPatch): Promise<MediaCatalogCard | null> {
    const entity = this.store.get(id)
    if (!entity) return null
    if (patch.build_status !== undefined) entity.build_status = patch.build_status
    if (patch.payload_json !== undefined) entity.payload_json = patch.payload_json
    if (patch.content_hash !== undefined) entity.content_hash = patch.content_hash
    if (patch.is_current !== undefined) entity.is_current = patch.is_current
    return entity
  }
}
