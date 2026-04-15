import type {
  CreateMediaImportJobItemInput,
  MediaImportJobItem,
  UpdateMediaImportJobItemPatch,
} from './types.js'

export interface MediaImportJobItemRepository {
  createMany(input: CreateMediaImportJobItemInput[]): Promise<MediaImportJobItem[]>
  findById(id: string): Promise<MediaImportJobItem | null>
  findByJobIdAndItemId(jobId: string, itemId: string): Promise<MediaImportJobItem | null>
  listByJobId(jobId: string): Promise<MediaImportJobItem[]>
  update(id: string, patch: UpdateMediaImportJobItemPatch): Promise<MediaImportJobItem | null>
}

let counter = 0
function cuid(): string {
  return `media_import_job_item_${Date.now()}_${String(++counter).padStart(8, '0')}`
}

function compareByIndex(a: MediaImportJobItem, b: MediaImportJobItem): number {
  return a.item_index - b.item_index || a.id.localeCompare(b.id)
}

export class InMemoryMediaImportJobItemRepository implements MediaImportJobItemRepository {
  private readonly store = new Map<string, MediaImportJobItem>()

  async createMany(input: CreateMediaImportJobItemInput[]): Promise<MediaImportJobItem[]> {
    const now = new Date()
    const entities = input.map((item) => {
      const entity: MediaImportJobItem = {
        id: item.id ?? cuid(),
        job_id: item.job_id,
        item_id: item.item_id,
        item_index: item.item_index,
        status: item.status,
        input_kind: item.input_kind,
        source_kind: item.source_kind,
        index_scope: item.index_scope,
        owner_user_id: item.owner_user_id ?? null,
        steward_agent_id: item.steward_agent_id ?? null,
        community_id: item.community_id ?? null,
        staging_object_key: item.staging_object_key ?? null,
        origin_url: item.origin_url ?? null,
        source_asset_id: item.source_asset_id ?? null,
        generated_job_id: item.generated_job_id ?? null,
        duplicate_cluster_id: item.duplicate_cluster_id ?? null,
        declared_sha256: item.declared_sha256 ?? null,
        mime_type: item.mime_type ?? null,
        file_size_bytes: item.file_size_bytes ?? null,
        width: item.width ?? null,
        height: item.height ?? null,
        failed_phase: item.failed_phase ?? null,
        error_code: item.error_code ?? null,
        error_message: item.error_message ?? null,
        resolved_asset_id: item.resolved_asset_id ?? null,
        resolved_request_json: item.resolved_request_json,
        result_summary_json: item.result_summary_json ?? null,
        started_at: item.started_at ?? null,
        finished_at: item.finished_at ?? null,
        created_at: now,
        updated_at: now,
      }
      this.store.set(entity.id, entity)
      return entity
    })
    return entities
  }

  async findById(id: string): Promise<MediaImportJobItem | null> {
    return this.store.get(id) ?? null
  }

  async findByJobIdAndItemId(jobId: string, itemId: string): Promise<MediaImportJobItem | null> {
    return Array.from(this.store.values())
      .find((item) => item.job_id === jobId && item.item_id === itemId) ?? null
  }

  async listByJobId(jobId: string): Promise<MediaImportJobItem[]> {
    return Array.from(this.store.values())
      .filter((item) => item.job_id === jobId)
      .sort(compareByIndex)
  }

  async update(id: string, patch: UpdateMediaImportJobItemPatch): Promise<MediaImportJobItem | null> {
    const entity = this.store.get(id)
    if (!entity) return null
    if (patch.status !== undefined) entity.status = patch.status
    if (patch.staging_object_key !== undefined) entity.staging_object_key = patch.staging_object_key
    if (patch.duplicate_cluster_id !== undefined) entity.duplicate_cluster_id = patch.duplicate_cluster_id
    if (patch.failed_phase !== undefined) entity.failed_phase = patch.failed_phase
    if (patch.error_code !== undefined) entity.error_code = patch.error_code
    if (patch.error_message !== undefined) entity.error_message = patch.error_message
    if (patch.resolved_asset_id !== undefined) entity.resolved_asset_id = patch.resolved_asset_id
    if (patch.result_summary_json !== undefined) entity.result_summary_json = patch.result_summary_json
    if (patch.started_at !== undefined) entity.started_at = patch.started_at
    if (patch.finished_at !== undefined) entity.finished_at = patch.finished_at
    entity.updated_at = new Date()
    return entity
  }
}
