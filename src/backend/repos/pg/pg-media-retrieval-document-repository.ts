import { Prisma, type MediaRetrievalDocumentRecord as PrismaMediaRetrievalDocumentRecord } from '@prisma/client'
import type {
  CreateMediaRetrievalDocumentInput,
  MediaRetrievalDocScope,
  MediaRetrievalDocument,
  UpdateMediaRetrievalDocumentPatch,
} from '../types.js'
import type { MediaRetrievalDocumentRepository } from '../media-retrieval-document-repository.js'
import type { PrismaDbClient } from './prisma-db-client.js'

export class PgMediaRetrievalDocumentRepository implements MediaRetrievalDocumentRepository {
  constructor(private readonly prisma: PrismaDbClient) {}

  async create(input: CreateMediaRetrievalDocumentInput): Promise<MediaRetrievalDocument> {
    const row = await this.prisma.mediaRetrievalDocumentRecord.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        docKey: input.doc_key,
        assetId: input.asset_id,
        catalogCardId: input.catalog_card_id ?? null,
        duplicateClusterId: input.duplicate_cluster_id ?? null,
        schemaVersion: input.schema_version ?? 'media-retrieval-doc.v1',
        docScope: input.doc_scope,
        modality: input.modality,
        trackKind: input.track_kind ?? null,
        segmentStartMs: input.segment_start_ms ?? null,
        segmentEndMs: input.segment_end_ms ?? null,
        sourceKind: input.source_kind,
        ownerUserId: input.owner_user_id ?? null,
        stewardAgentId: input.steward_agent_id ?? null,
        communityId: input.community_id ?? null,
        isCanonical: input.is_canonical ?? true,
        lifecycleStatus: input.lifecycle_status ?? 'active',
        documentText: input.document_text,
        documentHash: input.document_hash,
        documentMetaJson: input.document_meta_json as unknown as Prisma.InputJsonValue,
      },
    })
    return toDomain(row)
  }

  async findById(id: string): Promise<MediaRetrievalDocument | null> {
    const row = await this.prisma.mediaRetrievalDocumentRecord.findUnique({ where: { id } })
    return row ? toDomain(row) : null
  }

  async findByDocKey(docKey: string): Promise<MediaRetrievalDocument | null> {
    const row = await this.prisma.mediaRetrievalDocumentRecord.findUnique({ where: { docKey } })
    return row ? toDomain(row) : null
  }

  async findByAssetIdAndScope(assetId: string, docScope: MediaRetrievalDocScope): Promise<MediaRetrievalDocument | null> {
    const row = await this.prisma.mediaRetrievalDocumentRecord.findFirst({
      where: { assetId, docScope },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return row ? toDomain(row) : null
  }

  async findByIds(ids: string[]): Promise<MediaRetrievalDocument[]> {
    if (ids.length === 0) return []
    const rows = await this.prisma.mediaRetrievalDocumentRecord.findMany({
      where: { id: { in: ids } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map(toDomain)
  }

  async listByAssetId(assetId: string): Promise<MediaRetrievalDocument[]> {
    const rows = await this.prisma.mediaRetrievalDocumentRecord.findMany({
      where: { assetId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map(toDomain)
  }

  async listByDuplicateClusterId(clusterId: string): Promise<MediaRetrievalDocument[]> {
    const rows = await this.prisma.mediaRetrievalDocumentRecord.findMany({
      where: { duplicateClusterId: clusterId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map(toDomain)
  }

  async findCanonicalByClusterIdAndScope(
    clusterId: string,
    docScope: MediaRetrievalDocScope,
  ): Promise<MediaRetrievalDocument | null> {
    const row = await this.prisma.mediaRetrievalDocumentRecord.findFirst({
      where: {
        duplicateClusterId: clusterId,
        docScope,
        isCanonical: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return row ? toDomain(row) : null
  }

  async update(id: string, patch: UpdateMediaRetrievalDocumentPatch): Promise<MediaRetrievalDocument | null> {
    const row = await this.prisma.mediaRetrievalDocumentRecord.update({
      where: { id },
      data: {
        ...(patch.catalog_card_id !== undefined ? { catalogCardId: patch.catalog_card_id } : {}),
        ...(patch.duplicate_cluster_id !== undefined ? { duplicateClusterId: patch.duplicate_cluster_id } : {}),
        ...(patch.is_canonical !== undefined ? { isCanonical: patch.is_canonical } : {}),
        ...(patch.lifecycle_status !== undefined ? { lifecycleStatus: patch.lifecycle_status } : {}),
        ...(patch.document_text !== undefined ? { documentText: patch.document_text } : {}),
        ...(patch.document_hash !== undefined ? { documentHash: patch.document_hash } : {}),
        ...(patch.document_meta_json !== undefined
          ? { documentMetaJson: patch.document_meta_json as unknown as Prisma.InputJsonValue }
          : {}),
      },
    }).catch((error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null
      }
      throw error
    })
    return row ? toDomain(row) : null
  }
}

function toDomain(row: PrismaMediaRetrievalDocumentRecord): MediaRetrievalDocument {
  return {
    id: row.id,
    doc_key: row.docKey,
    asset_id: row.assetId,
    catalog_card_id: row.catalogCardId,
    duplicate_cluster_id: row.duplicateClusterId,
    schema_version: row.schemaVersion,
    doc_scope: row.docScope as MediaRetrievalDocument['doc_scope'],
    modality: row.modality as MediaRetrievalDocument['modality'],
    track_kind: row.trackKind,
    segment_start_ms: row.segmentStartMs,
    segment_end_ms: row.segmentEndMs,
    source_kind: row.sourceKind as MediaRetrievalDocument['source_kind'],
    owner_user_id: row.ownerUserId,
    steward_agent_id: row.stewardAgentId,
    community_id: row.communityId,
    is_canonical: row.isCanonical,
    lifecycle_status: row.lifecycleStatus as MediaRetrievalDocument['lifecycle_status'],
    document_text: row.documentText,
    document_hash: row.documentHash,
    document_meta_json: row.documentMetaJson as unknown as MediaRetrievalDocument['document_meta_json'],
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}
