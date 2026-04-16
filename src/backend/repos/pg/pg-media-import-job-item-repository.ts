import { Prisma, type MediaImportJobItemRecord as PrismaMediaImportJobItemRecord } from '@prisma/client'
import type {
  CreateMediaImportJobItemInput,
  MediaImportJobItem,
  UpdateMediaImportJobItemPatch,
} from '../types.js'
import type { MediaImportJobItemRepository } from '../media-import-job-item-repository.js'
import type { PrismaDbClient } from './prisma-db-client.js'

export class PgMediaImportJobItemRepository implements MediaImportJobItemRepository {
  constructor(private readonly prisma: PrismaDbClient) {}

  async createMany(input: CreateMediaImportJobItemInput[]): Promise<MediaImportJobItem[]> {
    if (input.length === 0) return []
    await this.prisma.mediaImportJobItemRecord.createMany({
      data: input.map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        jobId: item.job_id,
        itemId: item.item_id,
        itemIndex: item.item_index,
        status: item.status,
        inputKind: item.input_kind,
        sourceKind: item.source_kind,
        indexScope: item.index_scope,
        ownerUserId: item.owner_user_id ?? null,
        stewardAgentId: item.steward_agent_id ?? null,
        communityId: item.community_id ?? null,
        stagingObjectKey: item.staging_object_key ?? null,
        originUrl: item.origin_url ?? null,
        sourceAssetId: item.source_asset_id ?? null,
        generatedJobId: item.generated_job_id ?? null,
        duplicateClusterId: item.duplicate_cluster_id ?? null,
        declaredSha256: item.declared_sha256 ?? null,
        mimeType: item.mime_type ?? null,
        fileSizeBytes: item.file_size_bytes ?? null,
        width: item.width ?? null,
        height: item.height ?? null,
        failedPhase: item.failed_phase ?? null,
        errorCode: item.error_code ?? null,
        errorMessage: item.error_message ?? null,
        resolvedAssetId: item.resolved_asset_id ?? null,
        resolvedRequestJson: item.resolved_request_json as unknown as Prisma.InputJsonValue,
        resultSummaryJson: item.result_summary_json === undefined
          ? Prisma.JsonNull
          : item.result_summary_json as unknown as Prisma.InputJsonValue,
        startedAt: item.started_at ?? null,
        finishedAt: item.finished_at ?? null,
      })),
    })
    const rows = await this.prisma.mediaImportJobItemRecord.findMany({
      where: {
        jobId: input[0]!.job_id,
      },
      orderBy: [{ itemIndex: 'asc' }, { id: 'asc' }],
    })
    return rows.map(toDomain)
  }

  async findById(id: string): Promise<MediaImportJobItem | null> {
    const row = await this.prisma.mediaImportJobItemRecord.findUnique({ where: { id } })
    return row ? toDomain(row) : null
  }

  async findByJobIdAndItemId(jobId: string, itemId: string): Promise<MediaImportJobItem | null> {
    const row = await this.prisma.mediaImportJobItemRecord.findUnique({
      where: {
        jobId_itemId: {
          jobId,
          itemId,
        },
      },
    })
    return row ? toDomain(row) : null
  }

  async listByJobId(jobId: string): Promise<MediaImportJobItem[]> {
    const rows = await this.prisma.mediaImportJobItemRecord.findMany({
      where: { jobId },
      orderBy: [{ itemIndex: 'asc' }, { id: 'asc' }],
    })
    return rows.map(toDomain)
  }

  async update(id: string, patch: UpdateMediaImportJobItemPatch): Promise<MediaImportJobItem | null> {
    const row = await this.prisma.mediaImportJobItemRecord.update({
      where: { id },
      data: {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.staging_object_key !== undefined ? { stagingObjectKey: patch.staging_object_key } : {}),
        ...(patch.duplicate_cluster_id !== undefined ? { duplicateClusterId: patch.duplicate_cluster_id } : {}),
        ...(patch.failed_phase !== undefined ? { failedPhase: patch.failed_phase } : {}),
        ...(patch.error_code !== undefined ? { errorCode: patch.error_code } : {}),
        ...(patch.error_message !== undefined ? { errorMessage: patch.error_message } : {}),
        ...(patch.resolved_asset_id !== undefined ? { resolvedAssetId: patch.resolved_asset_id } : {}),
        ...(patch.result_summary_json !== undefined
          ? { resultSummaryJson: patch.result_summary_json as unknown as Prisma.InputJsonValue }
          : {}),
        ...(patch.started_at !== undefined ? { startedAt: patch.started_at } : {}),
        ...(patch.finished_at !== undefined ? { finishedAt: patch.finished_at } : {}),
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

function toDomain(row: PrismaMediaImportJobItemRecord): MediaImportJobItem {
  return {
    id: row.id,
    job_id: row.jobId,
    item_id: row.itemId,
    item_index: row.itemIndex,
    status: row.status as MediaImportJobItem['status'],
    input_kind: row.inputKind as MediaImportJobItem['input_kind'],
    source_kind: row.sourceKind as MediaImportJobItem['source_kind'],
    index_scope: row.indexScope as MediaImportJobItem['index_scope'],
    owner_user_id: row.ownerUserId,
    steward_agent_id: row.stewardAgentId,
    community_id: row.communityId,
    staging_object_key: row.stagingObjectKey,
    origin_url: row.originUrl,
    source_asset_id: row.sourceAssetId,
    generated_job_id: row.generatedJobId,
    duplicate_cluster_id: row.duplicateClusterId,
    declared_sha256: row.declaredSha256,
    mime_type: row.mimeType,
    file_size_bytes: row.fileSizeBytes,
    width: row.width,
    height: row.height,
    failed_phase: row.failedPhase as MediaImportJobItem['failed_phase'],
    error_code: row.errorCode,
    error_message: row.errorMessage,
    resolved_asset_id: row.resolvedAssetId,
    resolved_request_json: row.resolvedRequestJson as unknown as MediaImportJobItem['resolved_request_json'],
    result_summary_json: (row.resultSummaryJson ?? null) as unknown as MediaImportJobItem['result_summary_json'],
    started_at: row.startedAt,
    finished_at: row.finishedAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}
