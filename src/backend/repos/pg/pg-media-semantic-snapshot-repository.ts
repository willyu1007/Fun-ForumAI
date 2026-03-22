import { Prisma, type MediaSemanticSnapshot as PrismaMediaSemanticSnapshot, type PrismaClient } from '@prisma/client'
import type {
  CreateMediaSemanticSnapshotInput,
  MediaSemanticSnapshot,
} from '../types.js'
import type { MediaSemanticSnapshotRepository } from '../media-semantic-snapshot-repository.js'

export class PgMediaSemanticSnapshotRepository implements MediaSemanticSnapshotRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateMediaSemanticSnapshotInput): Promise<MediaSemanticSnapshot> {
    const row = await this.prisma.mediaSemanticSnapshot.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        assetId: input.asset_id,
        snapshotKind: input.snapshot_kind,
        schemaVersion: input.schema_version,
        modelProvider: input.model_provider,
        modelName: input.model_name,
        modelVersion: input.model_version,
        summaryJson: input.summary as unknown as Prisma.InputJsonValue,
        extractionStatus: input.extraction_status,
        qualityGrade: input.quality_grade,
        isCurrent: input.is_current ?? true,
      },
    })
    return this.toDomain(row)
  }

  async clearCurrentByAssetId(assetId: string): Promise<void> {
    await this.prisma.mediaSemanticSnapshot.updateMany({
      where: { assetId, isCurrent: true },
      data: { isCurrent: false },
    })
  }

  async findCurrentByAssetId(assetId: string): Promise<MediaSemanticSnapshot | null> {
    const row = await this.prisma.mediaSemanticSnapshot.findFirst({
      where: { assetId, isCurrent: true },
      orderBy: [{ createdAt: 'desc' }],
    })
    return row ? this.toDomain(row) : null
  }

  async listByAssetId(assetId: string): Promise<MediaSemanticSnapshot[]> {
    const rows = await this.prisma.mediaSemanticSnapshot.findMany({
      where: { assetId },
      orderBy: [{ createdAt: 'desc' }],
    })
    return rows.map((row) => this.toDomain(row))
  }

  private toDomain(row: PrismaMediaSemanticSnapshot): MediaSemanticSnapshot {
    return {
      id: row.id,
      asset_id: row.assetId,
      snapshot_kind: row.snapshotKind as MediaSemanticSnapshot['snapshot_kind'],
      schema_version: row.schemaVersion,
      model_provider: row.modelProvider,
      model_name: row.modelName,
      model_version: row.modelVersion,
      summary: row.summaryJson as unknown as MediaSemanticSnapshot['summary'],
      extraction_status: row.extractionStatus as MediaSemanticSnapshot['extraction_status'],
      quality_grade: row.qualityGrade as MediaSemanticSnapshot['quality_grade'],
      is_current: row.isCurrent,
      created_at: row.createdAt,
    }
  }
}
