export type MediaSourceKind =
  | 'owner_console_upload'
  | 'url_import'
  | 'private_message_upload'
  | 'generated'
  | 'platform_canonical'
  | 'community_commons'

export type MediaVisibilityPolicy =
  | 'private_only'
  | 'public_original_allowed'
  | 'public_derivative_only'
  | 'blocked'

export type MediaLifecycleStatus =
  | 'active'
  | 'archived'
  | 'blocked'

export type MediaSnapshotKind =
  | 'visual_core'
  | 'legacy_imported_partial'

export type MediaExtractionStatus =
  | 'completed'
  | 'fallback'
  | 'failed'

export type MediaQualityGrade =
  | 'rich'
  | 'legacy_imported_partial'
  | 'fallback'

export interface MediaSemanticSummary {
  theme: string
  scene: string
  mood: string
  discussion_points: string[]
  salient_entities: string[]
  ocr_snippets: string[]
  safety_labels: string[]
  public_safe_summary: string
  internal_full_summary: string
}

export interface MediaAsset {
  id: string
  steward_agent_id: string | null
  owner_user_id: string | null
  source_kind: MediaSourceKind
  source_scene_type: string | null
  source_scene_id: string | null
  visibility_policy: MediaVisibilityPolicy
  lifecycle_status: MediaLifecycleStatus
  storage_key: string | null
  origin_url: string | null
  mime_type: string
  file_size_bytes: number
  width: number | null
  height: number | null
  sha256: string
  phash: string | null
  created_at: Date
  updated_at: Date
}

export interface CreateMediaAssetInput {
  id?: string
  steward_agent_id?: string | null
  owner_user_id?: string | null
  source_kind: MediaSourceKind
  source_scene_type?: string | null
  source_scene_id?: string | null
  visibility_policy: MediaVisibilityPolicy
  lifecycle_status?: MediaLifecycleStatus
  storage_key?: string | null
  origin_url?: string | null
  mime_type: string
  file_size_bytes: number
  width?: number | null
  height?: number | null
  sha256: string
  phash?: string | null
}

export interface MediaSemanticSnapshot {
  id: string
  asset_id: string
  snapshot_kind: MediaSnapshotKind
  schema_version: string
  model_provider: string
  model_name: string
  model_version: string
  summary: MediaSemanticSummary
  extraction_status: MediaExtractionStatus
  quality_grade: MediaQualityGrade
  is_current: boolean
  created_at: Date
}

export interface CreateMediaSemanticSnapshotInput {
  id?: string
  asset_id: string
  snapshot_kind: MediaSnapshotKind
  schema_version: string
  model_provider: string
  model_name: string
  model_version: string
  summary: MediaSemanticSummary
  extraction_status: MediaExtractionStatus
  quality_grade: MediaQualityGrade
  is_current?: boolean
}

export type MediaSceneType =
  | 'forum_post'
  | 'forum_comment'
  | 'chat_room_message'
  | 'private_message'
  | 'memory_card'

export type MediaBindingRole =
  | 'primary'
  | 'inline'
  | 'reference'
  | 'memory'

export type MediaRelationToScene =
  | 'uploaded_by_owner'
  | 'selected_for_post'
  | 'quoted_public'
  | 'generated_for_scene'
  | 'derived_from_private'

export type MediaDisplayPolicy =
  | 'original_allowed'
  | 'derivative_only'
  | 'runtime_only_no_display'

export type MediaCreatedByType =
  | 'owner'
  | 'agent'
  | 'system'

export interface SceneMediaBinding {
  id: string
  scene_type: MediaSceneType
  scene_id: string
  asset_id: string
  semantic_snapshot_id: string
  source_scene_type: string | null
  source_scene_id: string | null
  binding_role: MediaBindingRole
  relation_to_scene: MediaRelationToScene
  binding_note_text: string | null
  display_policy: MediaDisplayPolicy
  created_by_type: MediaCreatedByType
  created_by_id: string
  created_at: Date
}

export interface CreateSceneMediaBindingInput {
  id?: string
  scene_type: MediaSceneType
  scene_id: string
  asset_id: string
  semantic_snapshot_id: string
  source_scene_type?: string | null
  source_scene_id?: string | null
  binding_role: MediaBindingRole
  relation_to_scene: MediaRelationToScene
  binding_note_text?: string | null
  display_policy: MediaDisplayPolicy
  created_by_type: MediaCreatedByType
  created_by_id: string
}

export type MediaProjectionSurface =
  | 'public_display'
  | 'public_runtime'
  | 'private_runtime'
  | 'memory'
  | 'retrieval'

export type MediaProjectionKind =
  | 'display_attachment'
  | 'public_media_context_card'
  | 'private_media_runtime_card'
  | 'private_media_memory_projection'
  | 'retrieval_caption'

export interface MediaContextProjection {
  id: string
  binding_id: string
  projection_surface: MediaProjectionSurface
  projection_kind: MediaProjectionKind
  schema_version: string
  payload_json: Record<string, unknown>
  token_estimate: number | null
  prompt_weight: string | null
  mention_policy: string | null
  preferred_display_variant: string | null
  expires_at: Date | null
  created_at: Date
}

export interface CreateMediaContextProjectionInput {
  id?: string
  binding_id: string
  projection_surface: MediaProjectionSurface
  projection_kind: MediaProjectionKind
  schema_version: string
  payload_json: Record<string, unknown>
  token_estimate?: number | null
  prompt_weight?: string | null
  mention_policy?: string | null
  preferred_display_variant?: string | null
  expires_at?: Date | null
}
