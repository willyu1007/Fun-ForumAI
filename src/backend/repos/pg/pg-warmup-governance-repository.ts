import {
  Prisma,
  type PrismaClient,
  type GovernanceBatch as PrismaGovernanceBatch,
  type KickoffBaseline as PrismaKickoffBaseline,
} from '@prisma/client'
import type {
  CreateGovernanceBatchInput,
  CreateKickoffBaselineInput,
  UpdateGovernanceBatchInput,
  UpdateKickoffBaselineInput,
  GovernanceBatch,
  WarmupGovernanceRepository,
  KickoffBaseline,
} from '../index.js'
import {
  fromStorageBatchKind,
  toStorageBatchKind,
  type StorageBatchKind,
} from '../types/warmup-governance.js'

function isNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
}

export class PgWarmupGovernanceRepository implements WarmupGovernanceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {}

  async createBaseline(input: CreateKickoffBaselineInput): Promise<KickoffBaseline> {
    const row = await this.prisma.kickoffBaseline.create({
      data: {
        state: input.state ?? 'draft',
        baselineLabel: input.baseline_label ?? null,
        kickoffBatchId: input.kickoff_batch_id ?? null,
        warmupBatchId: input.warmup_batch_id ?? null,
        createdByUserId: input.created_by_user_id ?? null,
        runtimeMode: input.runtime_mode ?? 'blocked',
        runtimeForceOverrideReason: input.runtime_force_override_reason ?? null,
        runtimeForceOverrideSetBy: input.runtime_force_override_set_by ?? null,
        runtimeForceOverrideSetAt: input.runtime_force_override_set_at ?? null,
        runtimeForceOverrideExpiresAt: input.runtime_force_override_expires_at ?? null,
        activatedAt: input.activated_at ?? null,
        archivedAt: input.archived_at ?? null,
      },
    })
    return this.toBaseline(row)
  }

  async findBaselineById(id: string): Promise<KickoffBaseline | null> {
    const row = await this.prisma.kickoffBaseline.findUnique({ where: { id } })
    return row ? this.toBaseline(row) : null
  }

  async listBaselines(): Promise<KickoffBaseline[]> {
    const rows = await this.prisma.kickoffBaseline.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map((row) => this.toBaseline(row))
  }

  async updateBaseline(id: string, patch: UpdateKickoffBaselineInput): Promise<KickoffBaseline | null> {
    try {
      const row = await this.prisma.kickoffBaseline.update({
        where: { id },
        data: {
          ...(patch.state !== undefined ? { state: patch.state } : {}),
          ...(patch.baseline_label !== undefined ? { baselineLabel: patch.baseline_label } : {}),
          ...(patch.kickoff_batch_id !== undefined
            ? { kickoffBatchId: patch.kickoff_batch_id }
            : {}),
          ...(patch.warmup_batch_id !== undefined ? { warmupBatchId: patch.warmup_batch_id } : {}),
          ...(patch.runtime_mode !== undefined ? { runtimeMode: patch.runtime_mode } : {}),
          ...(patch.runtime_force_override_reason !== undefined
            ? { runtimeForceOverrideReason: patch.runtime_force_override_reason }
            : {}),
          ...(patch.runtime_force_override_set_by !== undefined
            ? { runtimeForceOverrideSetBy: patch.runtime_force_override_set_by }
            : {}),
          ...(patch.runtime_force_override_set_at !== undefined
            ? { runtimeForceOverrideSetAt: patch.runtime_force_override_set_at }
            : {}),
          ...(patch.runtime_force_override_expires_at !== undefined
            ? { runtimeForceOverrideExpiresAt: patch.runtime_force_override_expires_at }
            : {}),
          ...(patch.activated_at !== undefined ? { activatedAt: patch.activated_at } : {}),
          ...(patch.archived_at !== undefined ? { archivedAt: patch.archived_at } : {}),
          updatedAt: new Date(),
        },
      })
      return this.toBaseline(row)
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
  }

  async createBatch(input: CreateGovernanceBatchInput): Promise<GovernanceBatch> {
    const row = await this.prisma.governanceBatch.create({
      data: {
        baselineId: input.baseline_id,
        batchKind: toStorageBatchKind(input.batch_kind),
        state: input.state ?? 'draft',
        sourceBatchId: input.source_batch_id ?? null,
        revisionKey: input.revision_key ?? null,
        packageHash: input.package_hash ?? null,
        notes: input.notes ?? null,
        activatedAt: input.activated_at ?? null,
        archivedAt: input.archived_at ?? null,
      },
    })
    return this.toBatch(row)
  }

  async findBatchById(id: string): Promise<GovernanceBatch | null> {
    const row = await this.prisma.governanceBatch.findUnique({ where: { id } })
    return row ? this.toBatch(row) : null
  }

  async listBatchesByBaseline(baselineId: string): Promise<GovernanceBatch[]> {
    const rows = await this.prisma.governanceBatch.findMany({
      where: { baselineId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map((row) => this.toBatch(row))
  }

  async updateBatch(id: string, patch: UpdateGovernanceBatchInput): Promise<GovernanceBatch | null> {
    try {
      const row = await this.prisma.governanceBatch.update({
        where: { id },
        data: {
          ...(patch.state !== undefined ? { state: patch.state } : {}),
          ...(patch.source_batch_id !== undefined ? { sourceBatchId: patch.source_batch_id } : {}),
          ...(patch.revision_key !== undefined ? { revisionKey: patch.revision_key } : {}),
          ...(patch.package_hash !== undefined ? { packageHash: patch.package_hash } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
          ...(patch.activated_at !== undefined ? { activatedAt: patch.activated_at } : {}),
          ...(patch.archived_at !== undefined ? { archivedAt: patch.archived_at } : {}),
          updatedAt: new Date(),
        },
      })
      return this.toBatch(row)
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
  }

  async compareAndSwapBatchRevision(input: {
    id: string
    expected_revision_key: string | null
    next_revision_key: string
  }): Promise<GovernanceBatch | null> {
    const result = await this.prisma.governanceBatch.updateMany({
      where: {
        id: input.id,
        revisionKey: input.expected_revision_key,
      },
      data: {
        revisionKey: input.next_revision_key,
        updatedAt: new Date(),
      },
    })
    if (result.count !== 1) {
      return null
    }
    const row = await this.prisma.governanceBatch.findUnique({ where: { id: input.id } })
    return row ? this.toBatch(row) : null
  }

  private toBaseline(row: PrismaKickoffBaseline): KickoffBaseline {
    return {
      id: row.id,
      state: row.state,
      baseline_label: row.baselineLabel,
      kickoff_batch_id: row.kickoffBatchId,
      warmup_batch_id: row.warmupBatchId,
      created_by_user_id: row.createdByUserId,
      runtime_mode: row.runtimeMode,
      runtime_force_override_reason: row.runtimeForceOverrideReason,
      runtime_force_override_set_by: row.runtimeForceOverrideSetBy,
      runtime_force_override_set_at: row.runtimeForceOverrideSetAt,
      runtime_force_override_expires_at: row.runtimeForceOverrideExpiresAt,
      activated_at: row.activatedAt,
      archived_at: row.archivedAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private toBatch(row: PrismaGovernanceBatch): GovernanceBatch {
    return {
      id: row.id,
      baseline_id: row.baselineId,
      batch_kind: fromStorageBatchKind(row.batchKind as StorageBatchKind),
      state: row.state,
      source_batch_id: row.sourceBatchId,
      revision_key: row.revisionKey,
      package_hash: row.packageHash,
      notes: row.notes,
      activated_at: row.activatedAt,
      archived_at: row.archivedAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
