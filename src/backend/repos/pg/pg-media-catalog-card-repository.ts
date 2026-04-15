import { Prisma, type MediaCatalogCardRecord as PrismaMediaCatalogCardRecord } from '@prisma/client'
import type {
  MediaCatalogCard,
} from '../types.js'
import type {
  MediaCatalogCardRepository,
} from '../media-catalog-card-repository.js'
import type {
  CreateMediaCatalogCardInput,
  UpdateMediaCatalogCardPatch,
} from '../types.js'
import type { PrismaDbClient } from './prisma-db-client.js'

export class PgMediaCatalogCardRepository implements MediaCatalogCardRepository {
  constructor(private readonly prisma: PrismaDbClient) {}

  async create(input: CreateMediaCatalogCardInput): Promise<MediaCatalogCard> {
    const row = await this.prisma.mediaCatalogCardRecord.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        assetId: input.asset_id,
        semanticSnapshotId: input.semantic_snapshot_id ?? null,
        schemaVersion: input.schema_version ?? 'media-catalog-card.v1',
        modality: input.modality,
        sourceKind: input.source_kind,
        contentHash: input.content_hash,
        buildStatus: input.build_status,
        payloadJson: input.payload_json as unknown as Prisma.InputJsonValue,
        isCurrent: input.is_current ?? true,
      },
    })
    return toDomain(row)
  }

  async findById(id: string): Promise<MediaCatalogCard | null> {
    const row = await this.prisma.mediaCatalogCardRecord.findUnique({ where: { id } })
    return row ? toDomain(row) : null
  }

  async listByAssetId(assetId: string): Promise<MediaCatalogCard[]> {
    const rows = await this.prisma.mediaCatalogCardRecord.findMany({
      where: { assetId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map(toDomain)
  }

  async findCurrentByAssetId(assetId: string): Promise<MediaCatalogCard | null> {
    const row = await this.prisma.mediaCatalogCardRecord.findFirst({
      where: { assetId, isCurrent: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return row ? toDomain(row) : null
  }

  async findCurrentByAssetIds(assetIds: string[]): Promise<MediaCatalogCard[]> {
    if (assetIds.length === 0) return []
    const rows = await this.prisma.mediaCatalogCardRecord.findMany({
      where: {
        assetId: { in: assetIds },
        isCurrent: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map(toDomain)
  }

  async markNonCurrentByAssetId(assetId: string, exceptCardId?: string): Promise<number> {
    const result = await this.prisma.mediaCatalogCardRecord.updateMany({
      where: {
        assetId,
        isCurrent: true,
        ...(exceptCardId ? { id: { not: exceptCardId } } : {}),
      },
      data: { isCurrent: false },
    })
    return result.count
  }

  async update(id: string, patch: UpdateMediaCatalogCardPatch): Promise<MediaCatalogCard | null> {
    const row = await this.prisma.mediaCatalogCardRecord.update({
      where: { id },
      data: {
        ...(patch.build_status !== undefined ? { buildStatus: patch.build_status } : {}),
        ...(patch.payload_json !== undefined
          ? { payloadJson: patch.payload_json as unknown as Prisma.InputJsonValue }
          : {}),
        ...(patch.content_hash !== undefined ? { contentHash: patch.content_hash } : {}),
        ...(patch.is_current !== undefined ? { isCurrent: patch.is_current } : {}),
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

function toDomain(row: PrismaMediaCatalogCardRecord): MediaCatalogCard {
  return {
    id: row.id,
    asset_id: row.assetId,
    semantic_snapshot_id: row.semanticSnapshotId,
    schema_version: row.schemaVersion,
    modality: row.modality as MediaCatalogCard['modality'],
    source_kind: row.sourceKind as MediaCatalogCard['source_kind'],
    content_hash: row.contentHash,
    build_status: row.buildStatus as MediaCatalogCard['build_status'],
    payload_json: row.payloadJson as unknown as MediaCatalogCard['payload_json'],
    is_current: row.isCurrent,
    created_at: row.createdAt,
  }
}
