import type {
  CreateMediaEmbeddingSnapshotInput,
  MediaEmbeddingIndexProfileId,
  MediaEmbeddingSnapshot,
  UpdateMediaEmbeddingSnapshotPatch,
} from './types.js'

export interface MediaEmbeddingSnapshotRepository {
  create(input: CreateMediaEmbeddingSnapshotInput): Promise<MediaEmbeddingSnapshot>
  findById(id: string): Promise<MediaEmbeddingSnapshot | null>
  listByRetrievalDocumentId(documentId: string): Promise<MediaEmbeddingSnapshot[]>
  findActiveByDocumentIdAndProfile(
    documentId: string,
    indexProfileId: MediaEmbeddingIndexProfileId,
  ): Promise<MediaEmbeddingSnapshot | null>
  markNonActiveByDocumentIdAndProfile(
    documentId: string,
    indexProfileId: MediaEmbeddingIndexProfileId,
    exceptSnapshotId?: string,
  ): Promise<number>
  update(id: string, patch: UpdateMediaEmbeddingSnapshotPatch): Promise<MediaEmbeddingSnapshot | null>
}

let counter = 0
function cuid(): string {
  return `media_embedding_snapshot_${Date.now()}_${String(++counter).padStart(8, '0')}`
}

function compareRecent(a: MediaEmbeddingSnapshot, b: MediaEmbeddingSnapshot): number {
  return b.created_at.getTime() - a.created_at.getTime() || b.id.localeCompare(a.id)
}

export class InMemoryMediaEmbeddingSnapshotRepository implements MediaEmbeddingSnapshotRepository {
  private readonly store = new Map<string, MediaEmbeddingSnapshot>()

  async listAll(): Promise<MediaEmbeddingSnapshot[]> {
    return Array.from(this.store.values()).sort(compareRecent)
  }

  async create(input: CreateMediaEmbeddingSnapshotInput): Promise<MediaEmbeddingSnapshot> {
    const entity: MediaEmbeddingSnapshot = {
      id: input.id ?? cuid(),
      retrieval_document_id: input.retrieval_document_id,
      index_profile_id: input.index_profile_id,
      provider: input.provider,
      model_name: input.model_name,
      output_type: input.output_type,
      vector_dimension: input.vector_dimension,
      document_content_hash: input.document_content_hash,
      embedding_hash: input.embedding_hash,
      embedding_vector: input.embedding_vector ?? null,
      search_status: input.search_status,
      is_active: input.is_active ?? false,
      activated_at: input.activated_at ?? null,
      error_code: input.error_code ?? null,
      error_message: input.error_message ?? null,
      provider_request_summary: input.provider_request_summary ?? null,
      created_at: new Date(),
    }
    this.store.set(entity.id, entity)
    return entity
  }

  async findById(id: string): Promise<MediaEmbeddingSnapshot | null> {
    return this.store.get(id) ?? null
  }

  async listByRetrievalDocumentId(documentId: string): Promise<MediaEmbeddingSnapshot[]> {
    return Array.from(this.store.values())
      .filter((item) => item.retrieval_document_id === documentId)
      .sort(compareRecent)
  }

  async findActiveByDocumentIdAndProfile(
    documentId: string,
    indexProfileId: MediaEmbeddingIndexProfileId,
  ): Promise<MediaEmbeddingSnapshot | null> {
    return Array.from(this.store.values())
      .find((item) =>
        item.retrieval_document_id === documentId
        && item.index_profile_id === indexProfileId
        && item.is_active) ?? null
  }

  async markNonActiveByDocumentIdAndProfile(
    documentId: string,
    indexProfileId: MediaEmbeddingIndexProfileId,
    exceptSnapshotId?: string,
  ): Promise<number> {
    let updated = 0
    for (const entity of this.store.values()) {
      if (entity.retrieval_document_id !== documentId) continue
      if (entity.index_profile_id !== indexProfileId) continue
      if (exceptSnapshotId && entity.id === exceptSnapshotId) continue
      if (!entity.is_active) continue
      entity.is_active = false
      updated += 1
    }
    return updated
  }

  async update(id: string, patch: UpdateMediaEmbeddingSnapshotPatch): Promise<MediaEmbeddingSnapshot | null> {
    const entity = this.store.get(id)
    if (!entity) return null
    if (patch.search_status !== undefined) entity.search_status = patch.search_status
    if (patch.is_active !== undefined) entity.is_active = patch.is_active
    if (patch.activated_at !== undefined) entity.activated_at = patch.activated_at
    if (patch.error_code !== undefined) entity.error_code = patch.error_code
    if (patch.error_message !== undefined) entity.error_message = patch.error_message
    if (patch.embedding_hash !== undefined) entity.embedding_hash = patch.embedding_hash
    if (patch.embedding_vector !== undefined) entity.embedding_vector = patch.embedding_vector
    if (patch.provider_request_summary !== undefined) {
      entity.provider_request_summary = patch.provider_request_summary
    }
    return entity
  }
}
