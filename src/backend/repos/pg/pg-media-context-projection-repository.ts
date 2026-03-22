import { Prisma, type MediaContextProjection as PrismaMediaContextProjection, type PrismaClient } from '@prisma/client'
import type {
  CreateMediaContextProjectionInput,
  MediaContextProjection,
} from '../types.js'
import type {
  MediaContextProjectionRepository,
  UpdateMediaContextProjectionPatch,
} from '../media-context-projection-repository.js'

export class PgMediaContextProjectionRepository implements MediaContextProjectionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateMediaContextProjectionInput): Promise<MediaContextProjection> {
    const row = await this.prisma.mediaContextProjection.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        bindingId: input.binding_id,
        projectionSurface: input.projection_surface,
        projectionKind: input.projection_kind,
        schemaVersion: input.schema_version,
        payloadJson: input.payload_json as unknown as Prisma.InputJsonValue,
        tokenEstimate: input.token_estimate ?? null,
        promptWeight: input.prompt_weight ?? null,
        mentionPolicy: input.mention_policy ?? null,
        preferredDisplayVariant: input.preferred_display_variant ?? null,
        expiresAt: input.expires_at ?? null,
      },
    })
    return this.toDomain(row)
  }

  async deleteByBindingIds(bindingIds: string[]): Promise<number> {
    if (bindingIds.length === 0) return 0
    const result = await this.prisma.mediaContextProjection.deleteMany({
      where: { bindingId: { in: bindingIds } },
    })
    return result.count
  }

  async findById(id: string): Promise<MediaContextProjection | null> {
    const row = await this.prisma.mediaContextProjection.findUnique({ where: { id } })
    return row ? this.toDomain(row) : null
  }

  async findByIds(ids: string[]): Promise<MediaContextProjection[]> {
    if (ids.length === 0) return []
    const rows = await this.prisma.mediaContextProjection.findMany({
      where: { id: { in: ids } },
      orderBy: [{ createdAt: 'desc' }],
    })
    return rows.map((row) => this.toDomain(row))
  }

  async findByBindingId(bindingId: string): Promise<MediaContextProjection[]> {
    const rows = await this.prisma.mediaContextProjection.findMany({
      where: { bindingId },
      orderBy: [{ createdAt: 'desc' }],
    })
    return rows.map((row) => this.toDomain(row))
  }

  async findByBindingIds(bindingIds: string[]): Promise<MediaContextProjection[]> {
    if (bindingIds.length === 0) return []
    const rows = await this.prisma.mediaContextProjection.findMany({
      where: { bindingId: { in: bindingIds } },
      orderBy: [{ createdAt: 'desc' }],
    })
    return rows.map((row) => this.toDomain(row))
  }

  async update(id: string, patch: UpdateMediaContextProjectionPatch): Promise<MediaContextProjection | null> {
    const row = await this.prisma.mediaContextProjection.update({
      where: { id },
      data: {
        ...(patch.expires_at !== undefined ? { expiresAt: patch.expires_at } : {}),
        ...(patch.payload_json !== undefined
          ? { payloadJson: patch.payload_json as unknown as Prisma.InputJsonValue }
          : {}),
        ...(patch.preferred_display_variant !== undefined
          ? { preferredDisplayVariant: patch.preferred_display_variant }
          : {}),
      },
    }).catch((err) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return null
      }
      throw err
    })
    return row ? this.toDomain(row) : null
  }

  async expireByIds(ids: string[], expiresAt: Date): Promise<number> {
    if (ids.length === 0) return 0
    const result = await this.prisma.mediaContextProjection.updateMany({
      where: { id: { in: ids } },
      data: { expiresAt },
    })
    return result.count
  }

  private toDomain(row: PrismaMediaContextProjection): MediaContextProjection {
    return {
      id: row.id,
      binding_id: row.bindingId,
      projection_surface: row.projectionSurface as MediaContextProjection['projection_surface'],
      projection_kind: row.projectionKind as MediaContextProjection['projection_kind'],
      schema_version: row.schemaVersion,
      payload_json: row.payloadJson as Record<string, unknown>,
      token_estimate: row.tokenEstimate,
      prompt_weight: row.promptWeight,
      mention_policy: row.mentionPolicy,
      preferred_display_variant: row.preferredDisplayVariant,
      expires_at: row.expiresAt,
      created_at: row.createdAt,
    }
  }
}
