import { Prisma, type MediaDuplicateClusterRecord as PrismaMediaDuplicateClusterRecord } from '@prisma/client'
import type {
  CreateMediaDuplicateClusterInput,
  MediaDuplicateCluster,
  UpdateMediaDuplicateClusterPatch,
} from '../types.js'
import type { MediaDuplicateClusterRepository } from '../media-duplicate-cluster-repository.js'
import type { PrismaDbClient } from './prisma-db-client.js'

export class PgMediaDuplicateClusterRepository implements MediaDuplicateClusterRepository {
  constructor(private readonly prisma: PrismaDbClient) {}

  async create(input: CreateMediaDuplicateClusterInput): Promise<MediaDuplicateCluster> {
    const row = await this.prisma.mediaDuplicateClusterRecord.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        duplicateKind: input.duplicate_kind,
        canonicalAssetId: input.canonical_asset_id,
        evidenceJson: input.evidence_json as unknown as Prisma.InputJsonValue,
        status: input.status ?? 'active',
      },
    })
    return toDomain(row)
  }

  async findById(id: string): Promise<MediaDuplicateCluster | null> {
    const row = await this.prisma.mediaDuplicateClusterRecord.findUnique({ where: { id } })
    return row ? toDomain(row) : null
  }

  async findByCanonicalAssetId(assetId: string): Promise<MediaDuplicateCluster | null> {
    const row = await this.prisma.mediaDuplicateClusterRecord.findFirst({
      where: { canonicalAssetId: assetId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return row ? toDomain(row) : null
  }

  async findByIds(ids: string[]): Promise<MediaDuplicateCluster[]> {
    if (ids.length === 0) return []
    const rows = await this.prisma.mediaDuplicateClusterRecord.findMany({
      where: { id: { in: ids } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map(toDomain)
  }

  async update(id: string, patch: UpdateMediaDuplicateClusterPatch): Promise<MediaDuplicateCluster | null> {
    const row = await this.prisma.mediaDuplicateClusterRecord.update({
      where: { id },
      data: {
        ...(patch.canonical_asset_id !== undefined ? { canonicalAssetId: patch.canonical_asset_id } : {}),
        ...(patch.evidence_json !== undefined
          ? { evidenceJson: patch.evidence_json as unknown as Prisma.InputJsonValue }
          : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
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

function toDomain(row: PrismaMediaDuplicateClusterRecord): MediaDuplicateCluster {
  return {
    id: row.id,
    duplicate_kind: row.duplicateKind as MediaDuplicateCluster['duplicate_kind'],
    canonical_asset_id: row.canonicalAssetId,
    evidence_json: row.evidenceJson as Record<string, unknown>,
    status: row.status as MediaDuplicateCluster['status'],
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}
