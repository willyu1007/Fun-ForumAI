import { createHash, randomUUID } from 'node:crypto'
import { config } from '../lib/config.js'
import type { MediaRetrievalDocument, MediaEmbeddingSnapshot } from '../repos/types.js'
import type { MediaEmbeddingSnapshotRepository } from '../repos/media-embedding-snapshot-repository.js'
import type { MediaEmbeddingGateway } from './media-embedding-gateway.js'
import { isMediaEmbeddingGatewayError } from './media-embedding-gateway.js'

export interface MediaEmbeddingServiceDeps {
  mediaEmbeddingSnapshotRepo: MediaEmbeddingSnapshotRepository
  gateway: MediaEmbeddingGateway
}

export class MediaEmbeddingService {
  constructor(private readonly deps: MediaEmbeddingServiceDeps) {}

  async ensureDocumentEmbedding(input: {
    document: MediaRetrievalDocument
    trace_id: string
  }): Promise<MediaEmbeddingSnapshot | null> {
    const indexProfileId = config.mediaRetrieval.indexProfileId
    const existing = await this.deps.mediaEmbeddingSnapshotRepo.findActiveByDocumentIdAndProfile(
      input.document.id,
      indexProfileId,
    )
    if (
      existing
      && existing.search_status === 'searchable'
      && existing.document_content_hash === input.document.document_hash
      && Array.isArray(existing.embedding_vector)
      && existing.embedding_vector.length > 0
    ) {
      return existing
    }

    if (!config.launch.capabilities.mediaRetrievalV1 || !this.deps.gateway.isConfigured) {
      return this.recordBackfillRequiredSnapshot(input.document, 'gateway_not_configured')
    }

    try {
      const result = await this.deps.gateway.embed({
        text: input.document.document_text,
        text_type: 'document',
        index_profile_id: indexProfileId,
        trace_id: input.trace_id,
      })
      const snapshot = await this.deps.mediaEmbeddingSnapshotRepo.create({
        id: `media_embedding_snapshot_${randomUUID()}`,
        retrieval_document_id: input.document.id,
        index_profile_id: indexProfileId,
        provider: result.provider_id,
        model_name: result.model_name,
        output_type: result.output_type,
        vector_dimension: result.vector_dimension,
        document_content_hash: input.document.document_hash,
        embedding_hash: hashVector(result.vector),
        embedding_vector: result.vector,
        search_status: 'searchable',
        is_active: true,
        activated_at: new Date(),
        provider_request_summary: result.provider_request_summary ?? null,
      })
      await this.deps.mediaEmbeddingSnapshotRepo.markNonActiveByDocumentIdAndProfile(
        input.document.id,
        indexProfileId,
        snapshot.id,
      )
      return snapshot
    } catch (error) {
      const providerSummary = isMediaEmbeddingGatewayError(error)
        ? error.provider_request_summary
        : null
      return this.deps.mediaEmbeddingSnapshotRepo.create({
        id: `media_embedding_snapshot_${randomUUID()}`,
        retrieval_document_id: input.document.id,
        index_profile_id: indexProfileId,
        provider: this.deps.gateway.providerId,
        model_name: this.deps.gateway.modelName,
        output_type: config.mediaRetrieval.outputType,
        vector_dimension: config.mediaRetrieval.vectorDimension,
        document_content_hash: input.document.document_hash,
        embedding_hash: createHash('sha256').update(input.document.document_hash).digest('hex'),
        embedding_vector: null,
        search_status: 'backfill_required',
        is_active: false,
        error_code: isMediaEmbeddingGatewayError(error) ? error.error_code : 'embedding_failed',
        error_message: error instanceof Error ? error.message : 'media_embedding_failed',
        provider_request_summary: providerSummary ?? null,
      })
    }
  }

  async embedQuery(input: {
    query_text: string
    trace_id: string
  }): Promise<number[] | null> {
    if (!config.launch.capabilities.mediaRetrievalV1 || !this.deps.gateway.isConfigured) {
      return null
    }
    const result = await this.deps.gateway.embed({
      text: input.query_text,
      text_type: 'query',
      index_profile_id: config.mediaRetrieval.indexProfileId,
      trace_id: input.trace_id,
      instruct: config.mediaRetrieval.queryInstruct,
    })
    return result.vector
  }

  private async recordBackfillRequiredSnapshot(
    document: MediaRetrievalDocument,
    reason: string,
  ): Promise<MediaEmbeddingSnapshot> {
    return this.deps.mediaEmbeddingSnapshotRepo.create({
      id: `media_embedding_snapshot_${randomUUID()}`,
      retrieval_document_id: document.id,
      index_profile_id: config.mediaRetrieval.indexProfileId,
      provider: this.deps.gateway.providerId,
      model_name: this.deps.gateway.modelName,
      output_type: config.mediaRetrieval.outputType,
      vector_dimension: config.mediaRetrieval.vectorDimension,
      document_content_hash: document.document_hash,
      embedding_hash: createHash('sha256').update(`${document.document_hash}:${reason}`).digest('hex'),
      embedding_vector: null,
      search_status: 'backfill_required',
      is_active: false,
      error_code: reason,
      error_message: reason,
    })
  }
}

function hashVector(vector: number[]): string {
  return createHash('sha256')
    .update(vector.join(','))
    .digest('hex')
}
