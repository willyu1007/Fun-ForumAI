import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import type {
  CreateMediaEmbeddingSnapshotInput,
  MediaEmbeddingIndexProfileId,
  MediaEmbeddingSnapshot,
  UpdateMediaEmbeddingSnapshotPatch,
} from '../types.js'
import type { MediaEmbeddingSnapshotRepository } from '../media-embedding-snapshot-repository.js'
import type { PrismaDbClient } from './prisma-db-client.js'
import {
  detectPgVectorStorageMode,
  parseSerializedVector,
  vectorSqlLiteral,
} from './pgvector-support.js'

interface SnapshotRow {
  id: string
  retrieval_document_id: string
  index_profile_id: string
  provider: string
  model_name: string
  output_type: string
  vector_dimension: number
  document_content_hash: string
  embedding_hash: string
  embedding_vector_text: string | null
  search_status: string
  is_active: boolean
  activated_at: Date | null
  error_code: string | null
  error_message: string | null
  provider_request_summary: Record<string, unknown> | null
  created_at: Date
}

function toDomain(row: SnapshotRow): MediaEmbeddingSnapshot {
  return {
    id: row.id,
    retrieval_document_id: row.retrieval_document_id,
    index_profile_id: row.index_profile_id as MediaEmbeddingIndexProfileId,
    provider: row.provider,
    model_name: row.model_name,
    output_type: row.output_type as MediaEmbeddingSnapshot['output_type'],
    vector_dimension: row.vector_dimension,
    document_content_hash: row.document_content_hash,
    embedding_hash: row.embedding_hash,
    embedding_vector: parseSerializedVector(row.embedding_vector_text),
    search_status: row.search_status as MediaEmbeddingSnapshot['search_status'],
    is_active: row.is_active,
    activated_at: row.activated_at,
    error_code: row.error_code,
    error_message: row.error_message,
    provider_request_summary: row.provider_request_summary,
    created_at: row.created_at,
  }
}

async function findRows(
  prisma: PrismaDbClient,
  whereSql: Prisma.Sql,
): Promise<SnapshotRow[]> {
  return prisma.$queryRaw<SnapshotRow[]>(Prisma.sql`
    SELECT
      id,
      retrieval_document_id,
      index_profile_id,
      provider,
      model_name,
      output_type,
      vector_dimension,
      document_content_hash,
      embedding_hash,
      embedding_vector::text AS embedding_vector_text,
      search_status,
      is_active,
      activated_at,
      error_code,
      error_message,
      provider_request_summary,
      created_at
    FROM media_embedding_snapshots
    ${whereSql}
  `)
}

export class PgMediaEmbeddingSnapshotRepository implements MediaEmbeddingSnapshotRepository {
  constructor(private readonly prisma: PrismaDbClient) {}

  async create(input: CreateMediaEmbeddingSnapshotInput): Promise<MediaEmbeddingSnapshot> {
    const storageMode = await detectPgVectorStorageMode(this.prisma)
    const rows = await this.prisma.$queryRaw<SnapshotRow[]>(Prisma.sql`
      INSERT INTO media_embedding_snapshots (
        id,
        retrieval_document_id,
        index_profile_id,
        provider,
        model_name,
        output_type,
        vector_dimension,
        document_content_hash,
        embedding_hash,
        embedding_vector,
        search_status,
        is_active,
        activated_at,
        error_code,
        error_message,
        provider_request_summary
      ) VALUES (
        ${input.id ?? randomUUID()},
        ${input.retrieval_document_id},
        ${input.index_profile_id},
        ${input.provider},
        ${input.model_name},
        ${input.output_type},
        ${input.vector_dimension},
        ${input.document_content_hash},
        ${input.embedding_hash},
        ${vectorSqlLiteral(input.embedding_vector, storageMode)},
        ${input.search_status},
        ${input.is_active ?? false},
        ${input.activated_at ?? null},
        ${input.error_code ?? null},
        ${input.error_message ?? null},
        ${input.provider_request_summary ? input.provider_request_summary as unknown as Prisma.JsonObject : null}
      )
      RETURNING
        id,
        retrieval_document_id,
        index_profile_id,
        provider,
        model_name,
        output_type,
        vector_dimension,
        document_content_hash,
        embedding_hash,
        embedding_vector::text AS embedding_vector_text,
        search_status,
        is_active,
        activated_at,
        error_code,
        error_message,
        provider_request_summary,
        created_at
    `)
    return toDomain(rows[0]!)
  }

  async findById(id: string): Promise<MediaEmbeddingSnapshot | null> {
    const rows = await findRows(this.prisma, Prisma.sql`WHERE id = ${id} LIMIT 1`)
    return rows[0] ? toDomain(rows[0]) : null
  }

  async listByRetrievalDocumentId(documentId: string): Promise<MediaEmbeddingSnapshot[]> {
    const rows = await findRows(
      this.prisma,
      Prisma.sql`WHERE retrieval_document_id = ${documentId} ORDER BY created_at DESC, id DESC`,
    )
    return rows.map(toDomain)
  }

  async findActiveByDocumentIdAndProfile(
    documentId: string,
    indexProfileId: MediaEmbeddingIndexProfileId,
  ): Promise<MediaEmbeddingSnapshot | null> {
    const rows = await findRows(
      this.prisma,
      Prisma.sql`
        WHERE retrieval_document_id = ${documentId}
          AND index_profile_id = ${indexProfileId}
          AND is_active = true
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
    )
    return rows[0] ? toDomain(rows[0]) : null
  }

  async markNonActiveByDocumentIdAndProfile(
    documentId: string,
    indexProfileId: MediaEmbeddingIndexProfileId,
    exceptSnapshotId?: string,
  ): Promise<number> {
    const result = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE media_embedding_snapshots
      SET is_active = false
      WHERE retrieval_document_id = ${documentId}
        AND index_profile_id = ${indexProfileId}
        AND is_active = true
        ${exceptSnapshotId ? Prisma.sql`AND id <> ${exceptSnapshotId}` : Prisma.empty}
    `)
    return Number(result)
  }

  async update(id: string, patch: UpdateMediaEmbeddingSnapshotPatch): Promise<MediaEmbeddingSnapshot | null> {
    const storageMode = await detectPgVectorStorageMode(this.prisma)
    const assignments: Prisma.Sql[] = []
    if (patch.search_status !== undefined) assignments.push(Prisma.sql`search_status = ${patch.search_status}`)
    if (patch.is_active !== undefined) assignments.push(Prisma.sql`is_active = ${patch.is_active}`)
    if (patch.activated_at !== undefined) assignments.push(Prisma.sql`activated_at = ${patch.activated_at}`)
    if (patch.error_code !== undefined) assignments.push(Prisma.sql`error_code = ${patch.error_code}`)
    if (patch.error_message !== undefined) assignments.push(Prisma.sql`error_message = ${patch.error_message}`)
    if (patch.embedding_hash !== undefined) assignments.push(Prisma.sql`embedding_hash = ${patch.embedding_hash}`)
    if (patch.embedding_vector !== undefined) assignments.push(Prisma.sql`embedding_vector = ${vectorSqlLiteral(patch.embedding_vector, storageMode)}`)
    if (patch.provider_request_summary !== undefined) {
      assignments.push(Prisma.sql`provider_request_summary = ${patch.provider_request_summary as unknown as Prisma.JsonObject}`)
    }
    if (assignments.length === 0) {
      return this.findById(id)
    }
    const rows = await this.prisma.$queryRaw<SnapshotRow[]>(Prisma.sql`
      UPDATE media_embedding_snapshots
      SET ${Prisma.join(assignments, ', ')}
      WHERE id = ${id}
      RETURNING
        id,
        retrieval_document_id,
        index_profile_id,
        provider,
        model_name,
        output_type,
        vector_dimension,
        document_content_hash,
        embedding_hash,
        embedding_vector::text AS embedding_vector_text,
        search_status,
        is_active,
        activated_at,
        error_code,
        error_message,
        provider_request_summary,
        created_at
    `)
    return rows[0] ? toDomain(rows[0]) : null
  }
}
