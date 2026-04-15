import type {
  MediaEmbeddingIndexProfileId,
  MediaEmbeddingSnapshot,
  MediaRetrievalDocScope,
  MediaRetrievalDocument,
  VisualSourceKind,
} from './types.js'

export interface MediaRetrievalSearchInput {
  query_vector: number[]
  index_profile_id: MediaEmbeddingIndexProfileId
  limit: number
  doc_scopes?: MediaRetrievalDocScope[]
  source_kinds?: VisualSourceKind[]
  owner_user_id?: string
  steward_agent_id?: string
  community_id?: string
  exclude_duplicate_cluster_ids?: string[]
  exclude_asset_ids?: string[]
  only_canonical?: boolean
}

export interface MediaRetrievalSearchHit {
  retrieval_document_id: string
  asset_id: string
  duplicate_cluster_id: string | null
  doc_scope: MediaRetrievalDocScope
  source_kind: VisualSourceKind
  distance: number
  score: number
}

export interface MediaRetrievalSearchRepository {
  searchActive(input: MediaRetrievalSearchInput): Promise<MediaRetrievalSearchHit[]>
}

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

function matchesFilters(input: MediaRetrievalSearchInput, document: MediaRetrievalDocument): boolean {
  if (input.doc_scopes?.length && !input.doc_scopes.includes(document.doc_scope)) return false
  if (input.source_kinds?.length && !input.source_kinds.includes(document.source_kind)) return false
  if (input.owner_user_id && document.owner_user_id !== input.owner_user_id) return false
  if (input.steward_agent_id && document.steward_agent_id !== input.steward_agent_id) return false
  if (input.community_id && document.community_id !== input.community_id) return false
  if (input.only_canonical && !document.is_canonical) return false
  if (input.exclude_duplicate_cluster_ids?.includes(document.duplicate_cluster_id ?? '')) return false
  if (input.exclude_asset_ids?.includes(document.asset_id)) return false
  if (document.lifecycle_status !== 'active') return false
  return true
}

export class InMemoryMediaRetrievalSearchRepository implements MediaRetrievalSearchRepository {
  constructor(
    private readonly deps: {
      listDocuments: () => Promise<MediaRetrievalDocument[]>
      listSnapshots: () => Promise<MediaEmbeddingSnapshot[]>
    },
  ) {}

  async searchActive(input: MediaRetrievalSearchInput): Promise<MediaRetrievalSearchHit[]> {
    const [documents, snapshots] = await Promise.all([
      this.deps.listDocuments(),
      this.deps.listSnapshots(),
    ])
    const searchableSnapshots = snapshots.filter((snapshot) =>
      snapshot.index_profile_id === input.index_profile_id
      && snapshot.is_active
      && snapshot.search_status === 'searchable'
      && Array.isArray(snapshot.embedding_vector)
      && snapshot.embedding_vector.length > 0)
    const documentById = new Map(documents.map((item) => [item.id, item]))
    return searchableSnapshots
      .flatMap((snapshot) => {
        const document = documentById.get(snapshot.retrieval_document_id)
        if (!document || !matchesFilters(input, document) || !snapshot.embedding_vector) return []
        const distance = cosineDistance(input.query_vector, snapshot.embedding_vector)
        const score = Math.max(0, 1 - distance)
        return [{
          retrieval_document_id: document.id,
          asset_id: document.asset_id,
          duplicate_cluster_id: document.duplicate_cluster_id,
          doc_scope: document.doc_scope,
          source_kind: document.source_kind,
          distance,
          score,
        } satisfies MediaRetrievalSearchHit]
      })
      .sort((left, right) => left.distance - right.distance || right.score - left.score)
      .slice(0, input.limit)
  }
}
