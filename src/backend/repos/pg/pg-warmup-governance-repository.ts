import {
  Prisma,
  type ActiveBaseline as PrismaActiveBaseline,
  type GovernanceBatch as PrismaGovernanceBatch,
  type PrismaClient,
  type WarmStartBatch as PrismaWarmStartBatch,
  type WarmupSuite as PrismaWarmupSuite,
  type WarmupSuiteReview as PrismaWarmupSuiteReview,
} from '@prisma/client'
import type {
  ActiveBaseline,
  CreateActiveBaselineInput,
  CreateGovernanceBatchInput,
  CreateWarmStartBatchInput,
  CreateWarmupSuiteInput,
  CreateWarmupSuiteReviewInput,
  GovernanceBatch,
  UpdateActiveBaselineInput,
  UpdateGovernanceBatchInput,
  UpdateWarmStartBatchInput,
  UpdateWarmupSuiteInput,
  WarmStartBatch,
  WarmupGovernanceRepository,
  WarmupSuite,
  WarmupSuiteReview,
} from '../index.js'

function isNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
}

function toPrismaJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

export class PgWarmupGovernanceRepository implements WarmupGovernanceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {}

  async createSuite(input: CreateWarmupSuiteInput): Promise<WarmupSuite> {
    const row = await this.prisma.warmupSuite.create({
      data: {
        state: input.state ?? 'draft',
        suiteLabel: input.suite_label ?? null,
        kickoffBatchId: input.kickoff_batch_id ?? null,
        warmupBatchId: input.warmup_batch_id ?? null,
        createdByUserId: input.created_by_user_id ?? null,
        activatedAt: input.activated_at ?? null,
        archivedAt: input.archived_at ?? null,
      },
    })
    return this.toSuite(row)
  }

  async findSuiteById(id: string): Promise<WarmupSuite | null> {
    const row = await this.prisma.warmupSuite.findUnique({ where: { id } })
    return row ? this.toSuite(row) : null
  }

  async listSuites(): Promise<WarmupSuite[]> {
    const rows = await this.prisma.warmupSuite.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map((row) => this.toSuite(row))
  }

  async updateSuite(id: string, patch: UpdateWarmupSuiteInput): Promise<WarmupSuite | null> {
    try {
      const row = await this.prisma.warmupSuite.update({
        where: { id },
        data: {
          ...(patch.state !== undefined ? { state: patch.state } : {}),
          ...(patch.suite_label !== undefined ? { suiteLabel: patch.suite_label } : {}),
          ...(patch.kickoff_batch_id !== undefined ? { kickoffBatchId: patch.kickoff_batch_id } : {}),
          ...(patch.warmup_batch_id !== undefined ? { warmupBatchId: patch.warmup_batch_id } : {}),
          ...(patch.activated_at !== undefined ? { activatedAt: patch.activated_at } : {}),
          ...(patch.archived_at !== undefined ? { archivedAt: patch.archived_at } : {}),
          updatedAt: new Date(),
        },
      })
      return this.toSuite(row)
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
  }

  async createBatch(input: CreateWarmStartBatchInput): Promise<WarmStartBatch> {
    const row = await this.prisma.warmStartBatch.create({
      data: {
        suiteId: input.suite_id,
        batchKind: input.batch_kind,
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

  async findBatchById(id: string): Promise<WarmStartBatch | null> {
    const row = await this.prisma.warmStartBatch.findUnique({ where: { id } })
    return row ? this.toBatch(row) : null
  }

  async listBatchesBySuite(suiteId: string): Promise<WarmStartBatch[]> {
    const rows = await this.prisma.warmStartBatch.findMany({
      where: { suiteId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map((row) => this.toBatch(row))
  }

  async updateBatch(id: string, patch: UpdateWarmStartBatchInput): Promise<WarmStartBatch | null> {
    try {
      const row = await this.prisma.warmStartBatch.update({
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

  async createReview(input: CreateWarmupSuiteReviewInput): Promise<WarmupSuiteReview> {
    const row = await this.prisma.warmupSuiteReview.create({
      data: {
        suiteId: input.suite_id,
        reviewerUserId: input.reviewer_user_id ?? null,
        decision: input.decision,
        reasonCodesJson: toPrismaJsonValue(input.reason_codes ?? []),
        note: input.note ?? null,
      },
    })
    return this.toReview(row)
  }

  async listReviewsBySuite(suiteId: string): Promise<WarmupSuiteReview[]> {
    const rows = await this.prisma.warmupSuiteReview.findMany({
      where: { suiteId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map((row) => this.toReview(row))
  }

  async findLatestReviewBySuite(suiteId: string): Promise<WarmupSuiteReview | null> {
    const row = await this.prisma.warmupSuiteReview.findFirst({
      where: { suiteId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return row ? this.toReview(row) : null
  }

  async createBaseline(input: CreateActiveBaselineInput): Promise<ActiveBaseline> {
    const row = await this.prisma.activeBaseline.create({
      data: {
        suiteId: input.suite_id,
        kickoffBatchId: input.kickoff_batch_id,
        warmupBatchId: input.warmup_batch_id,
        previousBaselineId: input.previous_baseline_id ?? null,
        isCurrent: input.is_current ?? true,
        activatedByUserId: input.activated_by_user_id ?? null,
        activatedAt: input.activated_at ?? new Date(),
        deactivatedAt: input.deactivated_at ?? null,
      },
    })
    return this.toBaseline(row)
  }

  async listBaselines(): Promise<ActiveBaseline[]> {
    const rows = await this.prisma.activeBaseline.findMany({
      orderBy: [{ activatedAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map((row) => this.toBaseline(row))
  }

  async findBaselineById(id: string): Promise<ActiveBaseline | null> {
    const row = await this.prisma.activeBaseline.findUnique({ where: { id } })
    return row ? this.toBaseline(row) : null
  }

  async findCurrentBaseline(): Promise<ActiveBaseline | null> {
    const row = await this.prisma.activeBaseline.findFirst({
      where: { isCurrent: true },
      orderBy: [{ activatedAt: 'desc' }, { id: 'desc' }],
    })
    return row ? this.toBaseline(row) : null
  }

  async updateBaseline(id: string, patch: UpdateActiveBaselineInput): Promise<ActiveBaseline | null> {
    try {
      const row = await this.prisma.activeBaseline.update({
        where: { id },
        data: {
          ...(patch.is_current !== undefined ? { isCurrent: patch.is_current } : {}),
          ...(patch.previous_baseline_id !== undefined ? { previousBaselineId: patch.previous_baseline_id } : {}),
          ...(patch.activated_by_user_id !== undefined ? { activatedByUserId: patch.activated_by_user_id } : {}),
          ...(patch.activated_at !== undefined ? { activatedAt: patch.activated_at } : {}),
          ...(patch.deactivated_at !== undefined ? { deactivatedAt: patch.deactivated_at } : {}),
        },
      })
      return this.toBaseline(row)
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
  }

  async createGovernanceBatch(input: CreateGovernanceBatchInput): Promise<GovernanceBatch> {
    const row = await this.prisma.governanceBatch.create({
      data: {
        action: input.action,
        requestedByUserId: input.requested_by_user_id ?? null,
        suiteId: input.suite_id ?? null,
        warmStartBatchIdsJson: toPrismaJsonValue(input.warm_start_batch_ids ?? []),
        contentIdsJson: toPrismaJsonValue(input.content_ids ?? []),
        scopeJson: toPrismaJsonValue(input.scope_json ?? {}),
        previewJson: toPrismaJsonValue(input.preview_json ?? {}),
        resultJson: input.result_json === undefined ? Prisma.DbNull : toPrismaJsonValue(input.result_json),
        executedAt: input.executed_at ?? null,
      },
    })
    return this.toGovernanceBatch(row)
  }

  async findGovernanceBatchById(id: string): Promise<GovernanceBatch | null> {
    const row = await this.prisma.governanceBatch.findUnique({ where: { id } })
    return row ? this.toGovernanceBatch(row) : null
  }

  async updateGovernanceBatch(id: string, patch: UpdateGovernanceBatchInput): Promise<GovernanceBatch | null> {
    try {
      const row = await this.prisma.governanceBatch.update({
        where: { id },
        data: {
          ...(patch.preview_json !== undefined ? { previewJson: toPrismaJsonValue(patch.preview_json) } : {}),
          ...(patch.result_json !== undefined
            ? {
                resultJson: patch.result_json === null
                  ? Prisma.DbNull
                  : toPrismaJsonValue(patch.result_json),
              }
            : {}),
          ...(patch.executed_at !== undefined ? { executedAt: patch.executed_at } : {}),
          updatedAt: new Date(),
        },
      })
      return this.toGovernanceBatch(row)
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
  }

  private toSuite(row: PrismaWarmupSuite): WarmupSuite {
    return {
      id: row.id,
      state: row.state,
      suite_label: row.suiteLabel,
      kickoff_batch_id: row.kickoffBatchId,
      warmup_batch_id: row.warmupBatchId,
      created_by_user_id: row.createdByUserId,
      activated_at: row.activatedAt,
      archived_at: row.archivedAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private toBatch(row: PrismaWarmStartBatch): WarmStartBatch {
    return {
      id: row.id,
      suite_id: row.suiteId,
      batch_kind: row.batchKind,
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

  private toReview(row: PrismaWarmupSuiteReview): WarmupSuiteReview {
    return {
      id: row.id,
      suite_id: row.suiteId,
      reviewer_user_id: row.reviewerUserId,
      decision: row.decision,
      reason_codes: ((row.reasonCodesJson as unknown[]) ?? []) as WarmupSuiteReview['reason_codes'],
      note: row.note,
      created_at: row.createdAt,
    }
  }

  private toBaseline(row: PrismaActiveBaseline): ActiveBaseline {
    return {
      id: row.id,
      suite_id: row.suiteId,
      kickoff_batch_id: row.kickoffBatchId,
      warmup_batch_id: row.warmupBatchId,
      previous_baseline_id: row.previousBaselineId,
      is_current: row.isCurrent,
      activated_by_user_id: row.activatedByUserId,
      activated_at: row.activatedAt,
      deactivated_at: row.deactivatedAt,
    }
  }

  private toGovernanceBatch(row: PrismaGovernanceBatch): GovernanceBatch {
    return {
      id: row.id,
      action: row.action,
      requested_by_user_id: row.requestedByUserId,
      suite_id: row.suiteId,
      warm_start_batch_ids: ((row.warmStartBatchIdsJson as unknown[]) ?? []) as string[],
      content_ids: ((row.contentIdsJson as unknown[]) ?? []) as string[],
      scope_json: ((row.scopeJson as Record<string, unknown> | null) ?? {}),
      preview_json: ((row.previewJson as Record<string, unknown> | null) ?? {}),
      result_json: (row.resultJson as Record<string, unknown> | null) ?? null,
      executed_at: row.executedAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
