import type {
  CreateMediaRetrievalDocumentInput,
  MediaRetrievalDocument,
  MediaRetrievalDocScope,
  UpdateMediaRetrievalDocumentPatch,
} from './types.js'

export interface MediaRetrievalDocumentRepository {
  create(input: CreateMediaRetrievalDocumentInput): Promise<MediaRetrievalDocument>
  findById(id: string): Promise<MediaRetrievalDocument | null>
  findByDocKey(docKey: string): Promise<MediaRetrievalDocument | null>
  findByAssetIdAndScope(assetId: string, docScope: MediaRetrievalDocScope): Promise<MediaRetrievalDocument | null>
  findByIds(ids: string[]): Promise<MediaRetrievalDocument[]>
  listByAssetId(assetId: string): Promise<MediaRetrievalDocument[]>
  listByDuplicateClusterId(clusterId: string): Promise<MediaRetrievalDocument[]>
  findCanonicalByClusterIdAndScope(
    clusterId: string,
    docScope: MediaRetrievalDocScope,
  ): Promise<MediaRetrievalDocument | null>
  update(id: string, patch: UpdateMediaRetrievalDocumentPatch): Promise<MediaRetrievalDocument | null>
}

let counter = 0
function cuid(): string {
  return `media_retrieval_doc_${Date.now()}_${String(++counter).padStart(8, '0')}`
}

function compareRecent(a: MediaRetrievalDocument, b: MediaRetrievalDocument): number {
  return b.created_at.getTime() - a.created_at.getTime() || b.id.localeCompare(a.id)
}

export class InMemoryMediaRetrievalDocumentRepository implements MediaRetrievalDocumentRepository {
  private readonly store = new Map<string, MediaRetrievalDocument>()

  async listAll(): Promise<MediaRetrievalDocument[]> {
    return Array.from(this.store.values()).sort(compareRecent)
  }

  async create(input: CreateMediaRetrievalDocumentInput): Promise<MediaRetrievalDocument> {
    const now = new Date()
    const entity: MediaRetrievalDocument = {
      id: input.id ?? cuid(),
      doc_key: input.doc_key,
      asset_id: input.asset_id,
      catalog_card_id: input.catalog_card_id ?? null,
      duplicate_cluster_id: input.duplicate_cluster_id ?? null,
      schema_version: input.schema_version ?? 'media-retrieval-doc.v1',
      doc_scope: input.doc_scope,
      modality: input.modality,
      track_kind: input.track_kind ?? null,
      segment_start_ms: input.segment_start_ms ?? null,
      segment_end_ms: input.segment_end_ms ?? null,
      source_kind: input.source_kind,
      owner_user_id: input.owner_user_id ?? null,
      steward_agent_id: input.steward_agent_id ?? null,
      community_id: input.community_id ?? null,
      is_canonical: input.is_canonical ?? true,
      lifecycle_status: input.lifecycle_status ?? 'active',
      document_text: input.document_text,
      document_hash: input.document_hash,
      document_meta_json: input.document_meta_json,
      created_at: now,
      updated_at: now,
    }
    this.store.set(entity.id, entity)
    return entity
  }

  async findById(id: string): Promise<MediaRetrievalDocument | null> {
    return this.store.get(id) ?? null
  }

  async findByDocKey(docKey: string): Promise<MediaRetrievalDocument | null> {
    return Array.from(this.store.values()).find((item) => item.doc_key === docKey) ?? null
  }

  async findByAssetIdAndScope(assetId: string, docScope: MediaRetrievalDocScope): Promise<MediaRetrievalDocument | null> {
    return Array.from(this.store.values())
      .find((item) => item.asset_id === assetId && item.doc_scope === docScope) ?? null
  }

  async findByIds(ids: string[]): Promise<MediaRetrievalDocument[]> {
    const lookup = new Set(ids)
    return Array.from(this.store.values())
      .filter((item) => lookup.has(item.id))
      .sort(compareRecent)
  }

  async listByAssetId(assetId: string): Promise<MediaRetrievalDocument[]> {
    return Array.from(this.store.values())
      .filter((item) => item.asset_id === assetId)
      .sort(compareRecent)
  }

  async listByDuplicateClusterId(clusterId: string): Promise<MediaRetrievalDocument[]> {
    return Array.from(this.store.values())
      .filter((item) => item.duplicate_cluster_id === clusterId)
      .sort(compareRecent)
  }

  async findCanonicalByClusterIdAndScope(
    clusterId: string,
    docScope: MediaRetrievalDocScope,
  ): Promise<MediaRetrievalDocument | null> {
    return Array.from(this.store.values())
      .find((item) => item.duplicate_cluster_id === clusterId && item.doc_scope === docScope && item.is_canonical) ?? null
  }

  async update(id: string, patch: UpdateMediaRetrievalDocumentPatch): Promise<MediaRetrievalDocument | null> {
    const entity = this.store.get(id)
    if (!entity) return null
    if (patch.catalog_card_id !== undefined) entity.catalog_card_id = patch.catalog_card_id
    if (patch.duplicate_cluster_id !== undefined) entity.duplicate_cluster_id = patch.duplicate_cluster_id
    if (patch.is_canonical !== undefined) entity.is_canonical = patch.is_canonical
    if (patch.lifecycle_status !== undefined) entity.lifecycle_status = patch.lifecycle_status
    if (patch.document_text !== undefined) entity.document_text = patch.document_text
    if (patch.document_hash !== undefined) entity.document_hash = patch.document_hash
    if (patch.document_meta_json !== undefined) entity.document_meta_json = patch.document_meta_json
    entity.updated_at = new Date()
    return entity
  }
}
