// T-302 admin media import — shared DTO contract.
// Mirrors `AdminMediaImport*` schemas in docs/context/api/openapi.yaml.

export type AdminMediaImportRetrievalStatusValue = 'ready' | 'pending' | 'failed'

export interface AdminMediaImportAssetDto {
  asset_id: string
  source_kind: string
  media_url: string
  mime_type: string
  file_size_bytes: number
  width: number | null
  height: number | null
  visibility_policy: string
  lifecycle_status: string
  created_at: string
}

export interface AdminMediaImportSemanticSnapshotDto {
  snapshot_id: string
  theme: string
  scene: string
  mood: string
  public_safe_summary: string
  tags: string[]
}

export interface AdminMediaImportPoolBindingDto {
  binding_id: string
  scene_type: string
  scene_id: string
  display_policy: string
  created_at: string
}

export interface AdminMediaImportReusePolicyDto {
  policy_id: string
  allowed_reuse_modes: string[]
  cross_agent_quote_allowed: boolean
  copyright_state: string
  status: string
}

export interface AdminMediaImportRetrievalStatusDto {
  status: AdminMediaImportRetrievalStatusValue
  document_ids: string[]
  doc_scopes: string[]
  searchable_embedding_count: number
  last_error_code: string | null
  last_error_message: string | null
}

export interface AdminMediaImportUsageSummaryDto {
  total_binding_count: number
  public_display_count: number
  latest_usage_at: string | null
  scene_type_counts: Record<string, number>
}

export interface AdminMediaImportItemDto {
  asset: AdminMediaImportAssetDto
  semantic_snapshot: AdminMediaImportSemanticSnapshotDto | null
  pool_binding: AdminMediaImportPoolBindingDto
  reuse_policy: AdminMediaImportReusePolicyDto
  retrieval: AdminMediaImportRetrievalStatusDto
  usage_summary: AdminMediaImportUsageSummaryDto
}

export interface AdminMediaImportPoolSummaryDto {
  scene_type: 'media_pool'
  scene_id: string
  community_id: string | null
}

export interface AdminMediaImportListPayloadDto {
  pool: AdminMediaImportPoolSummaryDto
  items: AdminMediaImportItemDto[]
  next_cursor: string | null
}

export interface AdminMediaImportUrlRequestBody {
  source_url: string
  allow_quote_original?: boolean
}
