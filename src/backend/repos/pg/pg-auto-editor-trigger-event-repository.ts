/**
 * T-214 A-M2 — Postgres `AutoEditorTriggerEventRepository`.
 *
 * `recordIfAbsent` uses Prisma's unique-key violation as the idempotency
 * gate (the unique index on `dedup_key`). On collision we return `null`
 * so the detector can count suppressed emissions.
 */

import {
  Prisma,
  type PrismaClient,
  type AutoEditorTriggerEvent as PrismaAutoEditorTriggerEvent,
  type AutoEditorTriggerType as PrismaAutoEditorTriggerType,
  type AutoEditorTriggerSeverity as PrismaAutoEditorTriggerSeverity,
  type AutoEditorTriggerSource as PrismaAutoEditorTriggerSource,
} from '@prisma/client'
import type { AutoEditorTriggerEventRepository } from '../auto-editor-trigger-event-repository.js'
import type {
  AutoEditorTriggerEventDomain,
  AutoEditorTriggerSeverity,
  AutoEditorTriggerSource,
  AutoEditorTriggerType,
  RecordAutoEditorTriggerEventInput,
} from '../../programming/auto-editor/types.js'

const TYPE_TO_DB: Record<AutoEditorTriggerType, PrismaAutoEditorTriggerType> = {
  COMMUNITY_LULL: 'COMMUNITY_LULL',
  SUPPLY_FLOOR_GAP: 'SUPPLY_FLOOR_GAP',
  EVENING_DISCUSSION_GAP: 'EVENING_DISCUSSION_GAP',
  FATIGUE_HIGH: 'FATIGUE_HIGH',
  MEDIA_OPPORTUNITY: 'MEDIA_OPPORTUNITY',
  GLOBAL_RUNTIME_IDLE: 'GLOBAL_RUNTIME_IDLE',
}
const TYPE_FROM_DB: Record<PrismaAutoEditorTriggerType, AutoEditorTriggerType> = {
  COMMUNITY_LULL: 'COMMUNITY_LULL',
  SUPPLY_FLOOR_GAP: 'SUPPLY_FLOOR_GAP',
  EVENING_DISCUSSION_GAP: 'EVENING_DISCUSSION_GAP',
  FATIGUE_HIGH: 'FATIGUE_HIGH',
  MEDIA_OPPORTUNITY: 'MEDIA_OPPORTUNITY',
  GLOBAL_RUNTIME_IDLE: 'GLOBAL_RUNTIME_IDLE',
}

const SEVERITY_TO_DB: Record<AutoEditorTriggerSeverity, PrismaAutoEditorTriggerSeverity> = {
  low: 'LOW',
  standard: 'STANDARD',
  high: 'HIGH',
}
const SEVERITY_FROM_DB: Record<PrismaAutoEditorTriggerSeverity, AutoEditorTriggerSeverity> = {
  LOW: 'low',
  STANDARD: 'standard',
  HIGH: 'high',
}

const SOURCE_TO_DB: Record<AutoEditorTriggerSource, PrismaAutoEditorTriggerSource> = {
  scan: 'SCAN',
  event: 'EVENT',
}
const SOURCE_FROM_DB: Record<PrismaAutoEditorTriggerSource, AutoEditorTriggerSource> = {
  SCAN: 'scan',
  EVENT: 'event',
}

export class PgAutoEditorTriggerEventRepository
  implements AutoEditorTriggerEventRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async recordIfAbsent(
    input: RecordAutoEditorTriggerEventInput,
  ): Promise<AutoEditorTriggerEventDomain | null> {
    try {
      const row = await this.prisma.autoEditorTriggerEvent.create({
        data: {
          communityId: input.community_id ?? null,
          triggerType: TYPE_TO_DB[input.trigger_type],
          severity: SEVERITY_TO_DB[input.severity],
          source: SOURCE_TO_DB[input.source],
          evidenceJson: input.evidence as Prisma.InputJsonValue,
          dedupKey: input.dedup_key,
          detectedAt: input.detected_at ?? new Date(),
        },
      })
      return this.toDomain(row)
    } catch (err) {
      // P2002 = unique constraint violation on dedup_key — treat as
      // dedup hit, not as an error.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError
        && err.code === 'P2002'
      ) {
        return null
      }
      throw err
    }
  }

  async findByDedupKey(
    dedupKey: string,
  ): Promise<AutoEditorTriggerEventDomain | null> {
    const row = await this.prisma.autoEditorTriggerEvent.findUnique({
      where: { dedupKey },
    })
    return row ? this.toDomain(row) : null
  }

  async listRecentByCommunity(input: {
    communityId: string | null
    since: Date
    limit?: number
  }): Promise<AutoEditorTriggerEventDomain[]> {
    const rows = await this.prisma.autoEditorTriggerEvent.findMany({
      where: {
        communityId: input.communityId,
        detectedAt: { gte: input.since },
      },
      orderBy: [{ detectedAt: 'desc' }, { id: 'desc' }],
      take: input.limit ?? 100,
    })
    return rows.map((row) => this.toDomain(row))
  }

  private toDomain(
    row: PrismaAutoEditorTriggerEvent,
  ): AutoEditorTriggerEventDomain {
    return {
      id: row.id,
      community_id: row.communityId,
      trigger_type: TYPE_FROM_DB[row.triggerType],
      severity: SEVERITY_FROM_DB[row.severity],
      source: SOURCE_FROM_DB[row.source],
      evidence: row.evidenceJson as Record<string, unknown>,
      dedup_key: row.dedupKey,
      detected_at: row.detectedAt,
      created_at: row.createdAt,
    }
  }
}
