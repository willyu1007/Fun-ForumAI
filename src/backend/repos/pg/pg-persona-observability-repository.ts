import { Prisma, type PrismaClient } from '@prisma/client'
import {
  createEmptyContextMemoryMetrics,
  type PersonaObservabilityMetricDelta,
  type PersonaObservabilityRepository,
} from '../../runtime/persona-observability.js'

export class PgPersonaObservabilityRepository implements PersonaObservabilityRepository {
  private rowState: 'unknown' | 'ready' = 'unknown'
  private ensureRowPromise: Promise<void> | null = null

  constructor(
    private readonly prisma: PrismaClient,
    private readonly runtimeKey: string,
    private readonly instanceId: string,
  ) {}

  async increment(delta: PersonaObservabilityMetricDelta): Promise<void> {
    await this.ensureCurrentRuntimeRow()

    try {
      await this.prisma.personaObservabilityMetrics.update({
        where: { instanceId: this.instanceId },
        data: createUpdateData(delta),
      })
    } catch (error) {
      if (!isRecordNotFoundError(error)) {
        throw error
      }

      this.rowState = 'unknown'
      await this.ensureCurrentRuntimeRow()
      await this.prisma.personaObservabilityMetrics.update({
        where: { instanceId: this.instanceId },
        data: createUpdateData(delta),
      })
    }
  }

  async snapshot(): Promise<ReturnType<typeof createEmptyContextMemoryMetrics>> {
    const aggregate = await this.prisma.personaObservabilityMetrics.aggregate({
      where: { runtimeKey: this.runtimeKey },
      _sum: {
        publicIngressForumTotal: true,
        publicIngressChatRoomTotal: true,
        typedWriteSuccessTotal: true,
        typedWriteFailureTotal: true,
        identityWriteSuccessTotal: true,
        identityWriteFailureTotal: true,
        retrievalTotal: true,
        retrievalPublicTypedHits: true,
        retrievalPublicLegacyHits: true,
        retrievalLegacyFallbackTotal: true,
        migrationPublicDedupLegacyFallbacks: true,
        migrationPublicCooldownLegacyFallbacks: true,
        migrationPublicDualWriteTotal: true,
        nightlyCompactionRunsTotal: true,
        nightlyCompactionCreatedTotal: true,
        nightlyCompactionDedupHitsTotal: true,
        nightlyCompactionFailureTotal: true,
      },
      _max: {
        updatedAt: true,
      },
    })

    const metrics = createEmptyContextMemoryMetrics()
    metrics.public_ingress.forum_total = aggregate._sum.publicIngressForumTotal ?? 0
    metrics.public_ingress.chat_room_total = aggregate._sum.publicIngressChatRoomTotal ?? 0
    metrics.typed_writes.success_total = aggregate._sum.typedWriteSuccessTotal ?? 0
    metrics.typed_writes.failure_total = aggregate._sum.typedWriteFailureTotal ?? 0
    metrics.identity_writes.success_total = aggregate._sum.identityWriteSuccessTotal ?? 0
    metrics.identity_writes.failure_total = aggregate._sum.identityWriteFailureTotal ?? 0
    metrics.retrieval.total = aggregate._sum.retrievalTotal ?? 0
    metrics.retrieval.public_typed_hits = aggregate._sum.retrievalPublicTypedHits ?? 0
    metrics.retrieval.public_legacy_hits = aggregate._sum.retrievalPublicLegacyHits ?? 0
    metrics.retrieval.legacy_fallback_total = aggregate._sum.retrievalLegacyFallbackTotal ?? 0
    metrics.migration.public_dedup_legacy_fallbacks = aggregate._sum.migrationPublicDedupLegacyFallbacks ?? 0
    metrics.migration.public_cooldown_legacy_fallbacks = aggregate._sum.migrationPublicCooldownLegacyFallbacks ?? 0
    metrics.migration.public_dual_write_total = aggregate._sum.migrationPublicDualWriteTotal ?? 0
    metrics.nightly_compaction.runs_total = aggregate._sum.nightlyCompactionRunsTotal ?? 0
    metrics.nightly_compaction.created_total = aggregate._sum.nightlyCompactionCreatedTotal ?? 0
    metrics.nightly_compaction.dedup_hits_total = aggregate._sum.nightlyCompactionDedupHitsTotal ?? 0
    metrics.nightly_compaction.failure_total = aggregate._sum.nightlyCompactionFailureTotal ?? 0
    metrics.updated_at = aggregate._max.updatedAt?.toISOString() ?? metrics.updated_at
    return metrics
  }

  async reset(): Promise<void> {
    this.rowState = 'unknown'
    await this.prisma.personaObservabilityMetrics.deleteMany({
      where: { runtimeKey: this.runtimeKey },
    })
  }

  private async ensureCurrentRuntimeRow(): Promise<void> {
    if (this.rowState === 'ready') {
      return
    }

    if (!this.ensureRowPromise) {
      this.ensureRowPromise = this.ensureCurrentRuntimeRowInternal()
        .finally(() => {
          this.ensureRowPromise = null
        })
    }

    await this.ensureRowPromise
  }

  private async ensureCurrentRuntimeRowInternal(): Promise<void> {
    const existing = await this.prisma.personaObservabilityMetrics.findUnique({
      where: { instanceId: this.instanceId },
      select: { runtimeKey: true },
    })

    if (!existing) {
      await this.prisma.personaObservabilityMetrics.upsert({
        where: { instanceId: this.instanceId },
        create: createCreateData(this.runtimeKey, this.instanceId, {}),
        update: { runtimeKey: this.runtimeKey },
      })
      this.rowState = 'ready'
      return
    }

    if (existing.runtimeKey !== this.runtimeKey) {
      await this.prisma.personaObservabilityMetrics.update({
        where: { instanceId: this.instanceId },
        data: createResetData(this.runtimeKey),
      })
    }

    this.rowState = 'ready'
  }
}

function createCreateData(
  runtimeKey: string,
  instanceId: string,
  delta: PersonaObservabilityMetricDelta,
): Prisma.PersonaObservabilityMetricsCreateInput {
  return {
    instanceId,
    runtimeKey,
    publicIngressForumTotal: delta.publicIngressForumTotal ?? 0,
    publicIngressChatRoomTotal: delta.publicIngressChatRoomTotal ?? 0,
    typedWriteSuccessTotal: delta.typedWriteSuccessTotal ?? 0,
    typedWriteFailureTotal: delta.typedWriteFailureTotal ?? 0,
    identityWriteSuccessTotal: delta.identityWriteSuccessTotal ?? 0,
    identityWriteFailureTotal: delta.identityWriteFailureTotal ?? 0,
    retrievalTotal: delta.retrievalTotal ?? 0,
    retrievalPublicTypedHits: delta.retrievalPublicTypedHits ?? 0,
    retrievalPublicLegacyHits: delta.retrievalPublicLegacyHits ?? 0,
    retrievalLegacyFallbackTotal: delta.retrievalLegacyFallbackTotal ?? 0,
    migrationPublicDedupLegacyFallbacks: delta.migrationPublicDedupLegacyFallbacks ?? 0,
    migrationPublicCooldownLegacyFallbacks: delta.migrationPublicCooldownLegacyFallbacks ?? 0,
    migrationPublicDualWriteTotal: delta.migrationPublicDualWriteTotal ?? 0,
    nightlyCompactionRunsTotal: delta.nightlyCompactionRunsTotal ?? 0,
    nightlyCompactionCreatedTotal: delta.nightlyCompactionCreatedTotal ?? 0,
    nightlyCompactionDedupHitsTotal: delta.nightlyCompactionDedupHitsTotal ?? 0,
    nightlyCompactionFailureTotal: delta.nightlyCompactionFailureTotal ?? 0,
  }
}

function createUpdateData(delta: PersonaObservabilityMetricDelta): Prisma.PersonaObservabilityMetricsUpdateInput {
  const update: Prisma.PersonaObservabilityMetricsUpdateInput = {}

  applyIncrement(update, 'publicIngressForumTotal', delta.publicIngressForumTotal)
  applyIncrement(update, 'publicIngressChatRoomTotal', delta.publicIngressChatRoomTotal)
  applyIncrement(update, 'typedWriteSuccessTotal', delta.typedWriteSuccessTotal)
  applyIncrement(update, 'typedWriteFailureTotal', delta.typedWriteFailureTotal)
  applyIncrement(update, 'identityWriteSuccessTotal', delta.identityWriteSuccessTotal)
  applyIncrement(update, 'identityWriteFailureTotal', delta.identityWriteFailureTotal)
  applyIncrement(update, 'retrievalTotal', delta.retrievalTotal)
  applyIncrement(update, 'retrievalPublicTypedHits', delta.retrievalPublicTypedHits)
  applyIncrement(update, 'retrievalPublicLegacyHits', delta.retrievalPublicLegacyHits)
  applyIncrement(update, 'retrievalLegacyFallbackTotal', delta.retrievalLegacyFallbackTotal)
  applyIncrement(update, 'migrationPublicDedupLegacyFallbacks', delta.migrationPublicDedupLegacyFallbacks)
  applyIncrement(update, 'migrationPublicCooldownLegacyFallbacks', delta.migrationPublicCooldownLegacyFallbacks)
  applyIncrement(update, 'migrationPublicDualWriteTotal', delta.migrationPublicDualWriteTotal)
  applyIncrement(update, 'nightlyCompactionRunsTotal', delta.nightlyCompactionRunsTotal)
  applyIncrement(update, 'nightlyCompactionCreatedTotal', delta.nightlyCompactionCreatedTotal)
  applyIncrement(update, 'nightlyCompactionDedupHitsTotal', delta.nightlyCompactionDedupHitsTotal)
  applyIncrement(update, 'nightlyCompactionFailureTotal', delta.nightlyCompactionFailureTotal)

  return update
}

function createResetData(runtimeKey: string): Prisma.PersonaObservabilityMetricsUpdateInput {
  return {
    runtimeKey,
    publicIngressForumTotal: 0,
    publicIngressChatRoomTotal: 0,
    typedWriteSuccessTotal: 0,
    typedWriteFailureTotal: 0,
    identityWriteSuccessTotal: 0,
    identityWriteFailureTotal: 0,
    retrievalTotal: 0,
    retrievalPublicTypedHits: 0,
    retrievalPublicLegacyHits: 0,
    retrievalLegacyFallbackTotal: 0,
    migrationPublicDedupLegacyFallbacks: 0,
    migrationPublicCooldownLegacyFallbacks: 0,
    migrationPublicDualWriteTotal: 0,
    nightlyCompactionRunsTotal: 0,
    nightlyCompactionCreatedTotal: 0,
    nightlyCompactionDedupHitsTotal: 0,
    nightlyCompactionFailureTotal: 0,
  }
}

function isRecordNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
}

function applyIncrement(
  update: Prisma.PersonaObservabilityMetricsUpdateInput,
  field: keyof Prisma.PersonaObservabilityMetricsUpdateInput,
  value: number | undefined,
): void {
  if (!value) return
  update[field] = { increment: value } as never
}
