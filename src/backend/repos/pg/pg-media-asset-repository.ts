import { Prisma, type MediaAsset as PrismaMediaAsset, type PrismaClient } from '@prisma/client'
import type {
  CreateMediaAssetInput,
  MediaAsset,
} from '../types.js'
import type {
  MediaAssetRepository,
  UpdateMediaAssetPatch,
} from '../media-asset-repository.js'

export class PgMediaAssetRepository implements MediaAssetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateMediaAssetInput): Promise<MediaAsset> {
    const row = await this.prisma.mediaAsset.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        stewardAgentId: input.steward_agent_id ?? null,
        ownerUserId: input.owner_user_id ?? null,
        sourceKind: input.source_kind,
        sourceSceneType: input.source_scene_type ?? null,
        sourceSceneId: input.source_scene_id ?? null,
        visibilityPolicy: input.visibility_policy,
        lifecycleStatus: input.lifecycle_status ?? 'active',
        storageKey: input.storage_key ?? null,
        originUrl: input.origin_url ?? null,
        mimeType: input.mime_type,
        fileSizeBytes: input.file_size_bytes,
        width: input.width ?? null,
        height: input.height ?? null,
        sha256: input.sha256,
        phash: input.phash ?? null,
      },
    })
    return this.toDomain(row)
  }

  async findById(id: string): Promise<MediaAsset | null> {
    const row = await this.prisma.mediaAsset.findUnique({ where: { id } })
    return row ? this.toDomain(row) : null
  }

  async findByIds(ids: string[]): Promise<MediaAsset[]> {
    if (ids.length === 0) return []
    const rows = await this.prisma.mediaAsset.findMany({
      where: { id: { in: ids } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map((row) => this.toDomain(row))
  }

  async listRecent(
    opts: {
      limit?: number
      lifecycle_statuses?: Array<MediaAsset['lifecycle_status']>
      before?: {
        created_at: Date
        id: string
      }
    } = {},
  ): Promise<MediaAsset[]> {
    const rows = await this.prisma.mediaAsset.findMany({
      where: {
        ...(opts.lifecycle_statuses?.length
          ? { lifecycleStatus: { in: opts.lifecycle_statuses } }
          : {}),
        ...(opts.before
          ? {
              OR: [
                { createdAt: { lt: opts.before.created_at } },
                {
                  createdAt: opts.before.created_at,
                  id: { lt: opts.before.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(opts.limit ? { take: opts.limit } : {}),
    })
    return rows.map((row) => this.toDomain(row))
  }

  async listStewardAgentIdsWithAssets(
    opts: {
      limit?: number
      lifecycle_statuses?: Array<MediaAsset['lifecycle_status']>
    } = {},
  ): Promise<string[]> {
    const rows = await this.prisma.mediaAsset.findMany({
      where: {
        stewardAgentId: { not: null },
        ...(opts.lifecycle_statuses?.length
          ? { lifecycleStatus: { in: opts.lifecycle_statuses } }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { stewardAgentId: true },
      ...(opts.limit ? { take: Math.max(opts.limit * 4, opts.limit) } : {}),
    })

    const ids: string[] = []
    const seen = new Set<string>()
    for (const row of rows) {
      const stewardAgentId = row.stewardAgentId
      if (!stewardAgentId || seen.has(stewardAgentId)) continue
      seen.add(stewardAgentId)
      ids.push(stewardAgentId)
      if (ids.length >= (opts.limit ?? ids.length + 1)) break
    }
    return ids
  }

  async listByStewardAgentId(
    agentId: string,
    opts: {
      limit?: number
      lifecycle_statuses?: Array<MediaAsset['lifecycle_status']>
    } = {},
  ): Promise<MediaAsset[]> {
    const rows = await this.prisma.mediaAsset.findMany({
      where: {
        stewardAgentId: agentId,
        ...(opts.lifecycle_statuses?.length
          ? { lifecycleStatus: { in: opts.lifecycle_statuses } }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(opts.limit ? { take: opts.limit } : {}),
    })
    return rows.map((row) => this.toDomain(row))
  }

  async update(id: string, patch: UpdateMediaAssetPatch): Promise<MediaAsset | null> {
    try {
      const row = await this.prisma.mediaAsset.update({
        where: { id },
        data: {
          ...(patch.visibility_policy !== undefined ? { visibilityPolicy: patch.visibility_policy } : {}),
          ...(patch.lifecycle_status !== undefined ? { lifecycleStatus: patch.lifecycle_status } : {}),
          ...(patch.sha256 !== undefined ? { sha256: patch.sha256 } : {}),
          ...(patch.phash !== undefined ? { phash: patch.phash } : {}),
          ...(patch.width !== undefined ? { width: patch.width } : {}),
          ...(patch.height !== undefined ? { height: patch.height } : {}),
          ...(patch.storage_key !== undefined ? { storageKey: patch.storage_key } : {}),
          ...(patch.origin_url !== undefined ? { originUrl: patch.origin_url } : {}),
          updatedAt: new Date(),
        },
      })
      return this.toDomain(row)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null
      }
      throw error
    }
  }

  private toDomain(row: PrismaMediaAsset): MediaAsset {
    return {
      id: row.id,
      steward_agent_id: row.stewardAgentId,
      owner_user_id: row.ownerUserId,
      source_kind: row.sourceKind as MediaAsset['source_kind'],
      source_scene_type: row.sourceSceneType,
      source_scene_id: row.sourceSceneId,
      visibility_policy: row.visibilityPolicy as MediaAsset['visibility_policy'],
      lifecycle_status: row.lifecycleStatus as MediaAsset['lifecycle_status'],
      storage_key: row.storageKey,
      origin_url: row.originUrl,
      mime_type: row.mimeType,
      file_size_bytes: row.fileSizeBytes,
      width: row.width,
      height: row.height,
      sha256: row.sha256,
      phash: row.phash,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
