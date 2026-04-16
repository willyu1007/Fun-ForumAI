import { Prisma } from '@prisma/client'
import type {
  MediaRetrievalSearchHit,
  MediaRetrievalSearchInput,
  MediaRetrievalSearchRepository,
} from '../media-retrieval-search-repository.js'
import type { PrismaDbClient } from './prisma-db-client.js'
import {
  detectPgVectorStorageMode,
  parseSerializedVector,
  vectorSqlLiteral,
} from './pgvector-support.js'

function cosineDistance(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 1
  let dot = 0
  let magA = 0
  let magB = 0
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index]! * b[index]!
    magA += a[index]! * a[index]!
    magB += b[index]! * b[index]!
  }
  if (magA <= 0 || magB <= 0) return 1
  return 1 - dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

export class PgMediaRetrievalSearchRepository implements MediaRetrievalSearchRepository {
  constructor(private readonly prisma: PrismaDbClient) {}

  async searchActive(input: MediaRetrievalSearchInput): Promise<MediaRetrievalSearchHit[]> {
    const storageMode = await detectPgVectorStorageMode(this.prisma)
    if (storageMode === 'text') {
      const rows = await this.prisma.$queryRaw<Array<{
        retrieval_document_id: string
        asset_id: string
        duplicate_cluster_id: string | null
        doc_scope: string
        source_kind: string
        embedding_vector_text: string | null
        created_at: Date
      }>>(Prisma.sql`
        SELECT
          doc.id AS retrieval_document_id,
          doc.asset_id,
          doc.duplicate_cluster_id,
          doc.doc_scope,
          doc.source_kind,
          snap.embedding_vector::text AS embedding_vector_text,
          doc.created_at
        FROM media_embedding_snapshots AS snap
        INNER JOIN media_retrieval_documents AS doc
          ON doc.id = snap.retrieval_document_id
        WHERE snap.index_profile_id = ${input.index_profile_id}
          AND snap.is_active = true
          AND snap.search_status = 'searchable'
          AND doc.lifecycle_status = 'active'
          ${input.doc_scopes?.length
            ? Prisma.sql`AND doc.doc_scope IN (${Prisma.join(input.doc_scopes)})`
            : Prisma.empty}
          ${input.source_kinds?.length
            ? Prisma.sql`AND doc.source_kind IN (${Prisma.join(input.source_kinds)})`
            : Prisma.empty}
          ${input.owner_user_id
            ? Prisma.sql`AND doc.owner_user_id = ${input.owner_user_id}`
            : Prisma.empty}
          ${input.steward_agent_id
            ? Prisma.sql`AND doc.steward_agent_id = ${input.steward_agent_id}`
            : Prisma.empty}
          ${input.community_id
            ? Prisma.sql`AND doc.community_id = ${input.community_id}`
            : Prisma.empty}
          ${input.only_canonical
            ? Prisma.sql`AND doc.is_canonical = true`
            : Prisma.empty}
          ${input.exclude_duplicate_cluster_ids?.length
            ? Prisma.sql`AND (doc.duplicate_cluster_id IS NULL OR doc.duplicate_cluster_id NOT IN (${Prisma.join(input.exclude_duplicate_cluster_ids)}))`
            : Prisma.empty}
          ${input.exclude_asset_ids?.length
            ? Prisma.sql`AND doc.asset_id NOT IN (${Prisma.join(input.exclude_asset_ids)})`
            : Prisma.empty}
      `)

      return rows
        .flatMap((row) => {
          const embeddingVector = parseSerializedVector(row.embedding_vector_text)
          if (!embeddingVector || embeddingVector.length === 0) return []
          const distance = cosineDistance(input.query_vector, embeddingVector)
          const score = Math.max(0, 1 - distance)
          return [{
            retrieval_document_id: row.retrieval_document_id,
            asset_id: row.asset_id,
            duplicate_cluster_id: row.duplicate_cluster_id,
            doc_scope: row.doc_scope as MediaRetrievalSearchHit['doc_scope'],
            source_kind: row.source_kind as MediaRetrievalSearchHit['source_kind'],
            distance,
            score,
            created_at: row.created_at,
          }]
        })
        .sort((left, right) => left.distance - right.distance || right.created_at.getTime() - left.created_at.getTime())
        .slice(0, input.limit)
        .map(({ created_at: _createdAt, ...hit }) => hit)
    }

    const rows = await this.prisma.$queryRaw<Array<{
      retrieval_document_id: string
      asset_id: string
      duplicate_cluster_id: string | null
      doc_scope: string
      source_kind: string
      distance: number
      score: number
    }>>(Prisma.sql`
      SELECT
        doc.id AS retrieval_document_id,
        doc.asset_id,
        doc.duplicate_cluster_id,
        doc.doc_scope,
        doc.source_kind,
        (snap.embedding_vector <=> ${vectorSqlLiteral(input.query_vector, storageMode)})::float8 AS distance,
        GREATEST(0, 1 - (snap.embedding_vector <=> ${vectorSqlLiteral(input.query_vector, storageMode)})::float8)::float8 AS score
      FROM media_embedding_snapshots AS snap
      INNER JOIN media_retrieval_documents AS doc
        ON doc.id = snap.retrieval_document_id
      WHERE snap.index_profile_id = ${input.index_profile_id}
        AND snap.is_active = true
        AND snap.search_status = 'searchable'
        AND doc.lifecycle_status = 'active'
        ${input.doc_scopes?.length
          ? Prisma.sql`AND doc.doc_scope IN (${Prisma.join(input.doc_scopes)})`
          : Prisma.empty}
        ${input.source_kinds?.length
          ? Prisma.sql`AND doc.source_kind IN (${Prisma.join(input.source_kinds)})`
          : Prisma.empty}
        ${input.owner_user_id
          ? Prisma.sql`AND doc.owner_user_id = ${input.owner_user_id}`
          : Prisma.empty}
        ${input.steward_agent_id
          ? Prisma.sql`AND doc.steward_agent_id = ${input.steward_agent_id}`
          : Prisma.empty}
        ${input.community_id
          ? Prisma.sql`AND doc.community_id = ${input.community_id}`
          : Prisma.empty}
        ${input.only_canonical
          ? Prisma.sql`AND doc.is_canonical = true`
          : Prisma.empty}
        ${input.exclude_duplicate_cluster_ids?.length
          ? Prisma.sql`AND (doc.duplicate_cluster_id IS NULL OR doc.duplicate_cluster_id NOT IN (${Prisma.join(input.exclude_duplicate_cluster_ids)}))`
          : Prisma.empty}
        ${input.exclude_asset_ids?.length
          ? Prisma.sql`AND doc.asset_id NOT IN (${Prisma.join(input.exclude_asset_ids)})`
          : Prisma.empty}
      ORDER BY snap.embedding_vector <=> ${vectorSqlLiteral(input.query_vector, storageMode)} ASC, doc.created_at DESC
      LIMIT ${input.limit}
    `)
    return rows.map((row) => ({
      retrieval_document_id: row.retrieval_document_id,
      asset_id: row.asset_id,
      duplicate_cluster_id: row.duplicate_cluster_id,
      doc_scope: row.doc_scope as MediaRetrievalSearchHit['doc_scope'],
      source_kind: row.source_kind as MediaRetrievalSearchHit['source_kind'],
      distance: row.distance,
      score: row.score,
    }))
  }
}
