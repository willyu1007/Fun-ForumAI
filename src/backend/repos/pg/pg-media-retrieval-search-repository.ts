import { Prisma } from '@prisma/client'
import type {
  MediaRetrievalSearchHit,
  MediaRetrievalSearchInput,
  MediaRetrievalSearchRepository,
} from '../media-retrieval-search-repository.js'
import type { PrismaDbClient } from './prisma-db-client.js'

function vectorLiteral(vector: number[]): Prisma.Sql {
  const serialized = `[${vector.map((value) => Number(value).toString()).join(',')}]`
  return Prisma.sql`${Prisma.raw(`'${serialized}'::vector`)}`
}

export class PgMediaRetrievalSearchRepository implements MediaRetrievalSearchRepository {
  constructor(private readonly prisma: PrismaDbClient) {}

  async searchActive(input: MediaRetrievalSearchInput): Promise<MediaRetrievalSearchHit[]> {
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
        (snap.embedding_vector <=> ${vectorLiteral(input.query_vector)})::float8 AS distance,
        GREATEST(0, 1 - (snap.embedding_vector <=> ${vectorLiteral(input.query_vector)})::float8)::float8 AS score
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
      ORDER BY snap.embedding_vector <=> ${vectorLiteral(input.query_vector)} ASC, doc.created_at DESC
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
