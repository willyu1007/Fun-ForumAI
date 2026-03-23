import { Prisma, type MediaRolloutControllerOverride as PrismaMediaRolloutControllerOverride, type PrismaClient } from '@prisma/client'
import type {
  CreateMediaRolloutControllerOverrideInput,
  MediaRolloutControllerOverride,
} from '../types.js'
import type {
  MediaRolloutControllerOverrideRepository,
  ReleaseMediaRolloutControllerOverrideInput,
  ReplaceActiveMediaRolloutControllerOverrideInput,
} from '../media-rollout-controller-override-repository.js'

export class PgMediaRolloutControllerOverrideRepository
implements MediaRolloutControllerOverrideRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    input: CreateMediaRolloutControllerOverrideInput,
  ): Promise<MediaRolloutControllerOverride> {
    const row = await this.prisma.mediaRolloutControllerOverride.create({
      data: this.toCreateData(input),
    })
    return this.toDomain(row)
  }

  async findById(id: string): Promise<MediaRolloutControllerOverride | null> {
    const row = await this.prisma.mediaRolloutControllerOverride.findUnique({ where: { id } })
    return row ? this.toDomain(row) : null
  }

  async findActive(): Promise<MediaRolloutControllerOverride | null> {
    const row = await this.prisma.mediaRolloutControllerOverride.findFirst({
      where: { status: 'active' },
      orderBy: [{ createdAt: 'desc' }],
    })
    return row ? this.toDomain(row) : null
  }

  async replaceActive(
    input: ReplaceActiveMediaRolloutControllerOverrideInput,
  ): Promise<MediaRolloutControllerOverride> {
    return this.prisma.$transaction(async (tx) => {
      const active = await tx.mediaRolloutControllerOverride.findFirst({
        where: { status: 'active' },
        orderBy: [{ createdAt: 'desc' }],
      })
      if (active) {
        await tx.mediaRolloutControllerOverride.update({
          where: { id: active.id },
          data: {
            status: 'released',
            releasedByUserId: input.release.released_by_user_id,
            releasedReason: input.release.released_reason ?? null,
            releasedAt: input.release.released_at ?? new Date(),
          },
        })
      }

      const created = await tx.mediaRolloutControllerOverride.create({
        data: this.toCreateData(input.next_override),
      })
      return this.toDomain(created)
    })
  }

  async release(
    id: string,
    input: ReleaseMediaRolloutControllerOverrideInput,
  ): Promise<MediaRolloutControllerOverride | null> {
    const row = await this.prisma.mediaRolloutControllerOverride.update({
      where: { id },
      data: {
        status: 'released',
        releasedByUserId: input.released_by_user_id,
        releasedReason: input.released_reason ?? null,
        releasedAt: input.released_at ?? new Date(),
      },
    }).catch((error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null
      }
      throw error
    })
    return row ? this.toDomain(row) : null
  }

  private toCreateData(
    input: CreateMediaRolloutControllerOverrideInput,
  ): Prisma.MediaRolloutControllerOverrideUncheckedCreateInput {
    return {
      ...(input.id ? { id: input.id } : {}),
      status: input.status ?? 'active',
      mode: input.mode,
      targetMinRate: input.target_min_rate ?? null,
      targetMaxRate: input.target_max_rate ?? null,
      thresholdDelta: input.threshold_delta ?? null,
      allowGeneration: input.allow_generation ?? null,
      generationTier: input.generation_tier ?? null,
      syncGenerationMsBudget: input.sync_generation_ms_budget ?? null,
      allowPrivateRuntimeProjection: input.allow_private_runtime_projection ?? null,
      allowPrivateInspiredGeneration: input.allow_private_inspired_generation ?? null,
      forceSafeMode: input.force_safe_mode ?? false,
      semanticV3Enforced: input.semantic_v3_enforced ?? true,
      strictAuditEnforced: input.strict_audit_enforced ?? true,
      lineageRequired: input.lineage_required ?? true,
      rootPostAttachmentOnly: input.root_post_attachment_only ?? true,
      reason: input.reason ?? null,
      createdByUserId: input.created_by_user_id,
      releasedByUserId: input.released_by_user_id ?? null,
      releasedReason: input.released_reason ?? null,
      releasedAt: input.released_at ?? null,
    }
  }

  private toDomain(row: PrismaMediaRolloutControllerOverride): MediaRolloutControllerOverride {
    return {
      id: row.id,
      status: row.status as MediaRolloutControllerOverride['status'],
      mode: row.mode as MediaRolloutControllerOverride['mode'],
      target_min_rate: row.targetMinRate,
      target_max_rate: row.targetMaxRate,
      threshold_delta: row.thresholdDelta,
      allow_generation: row.allowGeneration,
      generation_tier: row.generationTier as MediaRolloutControllerOverride['generation_tier'],
      sync_generation_ms_budget: row.syncGenerationMsBudget,
      allow_private_runtime_projection: row.allowPrivateRuntimeProjection,
      allow_private_inspired_generation: row.allowPrivateInspiredGeneration,
      force_safe_mode: row.forceSafeMode,
      semantic_v3_enforced: row.semanticV3Enforced,
      strict_audit_enforced: row.strictAuditEnforced,
      lineage_required: row.lineageRequired,
      root_post_attachment_only: row.rootPostAttachmentOnly,
      reason: row.reason,
      created_by_user_id: row.createdByUserId,
      released_by_user_id: row.releasedByUserId,
      released_reason: row.releasedReason,
      released_at: row.releasedAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
