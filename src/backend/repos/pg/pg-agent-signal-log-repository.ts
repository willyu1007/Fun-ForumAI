import { Prisma, type AgentSignalLog as PrismaAgentSignalLog, type PrismaClient } from '@prisma/client'
import type {
  AgentSignalLog,
  AchievementScope,
  CreateAgentSignalLogInput,
} from '../types.js'
import type {
  AgentSignalLogRepository,
  AgentSignalMetrics,
} from '../agent-signal-log-repository.js'
import {
  fromSignalContextColumns,
  toSignalContextColumns,
} from './achievement-signal-context.js'

const GLOBAL_SCOPE: AchievementScope = 'global'
const GLOBAL_SCOPE_KEY = '__global__'

function isUniqueError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

export class PgAgentSignalLogRepository implements AgentSignalLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {}

  async create(input: CreateAgentSignalLogInput): Promise<AgentSignalLog> {
    if (input.dedup_key) {
      const existing = await this.findByDedupKey(input.agent_id, input.dedup_key)
      if (existing) return existing
    }
    const signalContext = toSignalContextColumns(input.signal_context)
    try {
      const row = await this.prisma.agentSignalLog.create({
        data: {
          agentId: input.agent_id,
          signalKind: input.signal_kind,
          importanceScore: input.importance_score,
          visibility: input.visibility,
          scope: input.scope ?? GLOBAL_SCOPE,
          scopeKey: input.scope_key ?? GLOBAL_SCOPE_KEY,
          occurredAt: input.occurred_at ?? new Date(),
          evidenceJson: input.evidence as unknown as Prisma.InputJsonValue,
          ...signalContext,
          dedupKey: input.dedup_key ?? null,
        },
      })
      return this.toDomain(row)
    } catch (error) {
      if (!input.dedup_key || !isUniqueError(error)) throw error
      const existing = await this.findByDedupKey(input.agent_id, input.dedup_key)
      if (existing) return existing
      throw error
    }
  }

  async findByDedupKey(agentId: string, dedupKey: string): Promise<AgentSignalLog | null> {
    const row = await this.prisma.agentSignalLog.findFirst({
      where: {
        agentId,
        dedupKey,
      },
    })
    return row ? this.toDomain(row) : null
  }

  async getMetrics(
    agentId: string,
    opts: { signalKinds: string[]; since?: Date; scope?: AchievementScope; scope_key?: string },
  ): Promise<AgentSignalMetrics> {
    const signalKinds = opts.signalKinds.filter((kind) => kind.trim().length > 0)
    const sinceSql = opts.since
      ? Prisma.sql`AND "occurred_at" >= ${opts.since}`
      : Prisma.empty
    const scopeSql = opts.scope
      ? Prisma.sql`AND "scope" = ${opts.scope}`
      : Prisma.empty
    const scopeKeySql = opts.scope_key
      ? Prisma.sql`AND "scope_key" = ${opts.scope_key}`
      : Prisma.empty

    const baseRows = await this.prisma.$queryRaw<
      Array<{ public_entries: bigint | number | string; activity_days: bigint | number | string; total_entries: bigint | number | string }>
    >(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE "visibility" = 'PUBLIC') AS public_entries,
        COUNT(DISTINCT DATE_TRUNC('day', "occurred_at")) AS activity_days,
        COUNT(*) AS total_entries
      FROM "agent_signal_logs"
      WHERE "agent_id" = ${agentId}
      ${sinceSql}
      ${scopeSql}
      ${scopeKeySql}
    `)

    const kindRows = signalKinds.length > 0
      ? await this.prisma.$queryRaw<Array<{ signal_kind: string; count: bigint | number | string }>>(Prisma.sql`
          SELECT "signal_kind", COUNT(*) AS count
          FROM "agent_signal_logs"
          WHERE "agent_id" = ${agentId}
          ${sinceSql}
          ${scopeSql}
          ${scopeKeySql}
            AND "signal_kind" IN (${Prisma.join(signalKinds)})
          GROUP BY "signal_kind"
        `)
      : []

    const distinctKindRows = await this.prisma.$queryRaw<Array<{ cross_scene: bigint | number | string }>>(Prisma.sql`
      SELECT COUNT(DISTINCT "signal_kind") AS cross_scene
      FROM "agent_signal_logs"
      WHERE "agent_id" = ${agentId}
      ${sinceSql}
      ${scopeSql}
      ${scopeKeySql}
    `)

    const counts: Record<string, number> = {}
    for (const kind of signalKinds) {
      counts[kind] = 0
    }
    for (const row of kindRows) {
      counts[row.signal_kind] = toNumber(row.count)
    }

    const base = baseRows[0] ?? { public_entries: 0, activity_days: 0, total_entries: 0 }
    const cross = distinctKindRows[0] ?? { cross_scene: 0 }

    return {
      signal_counts: counts,
      public_entries: toNumber(base.public_entries),
      activity_days: toNumber(base.activity_days),
      cross_scene: toNumber(cross.cross_scene),
      signal_entries: toNumber(base.total_entries),
    }
  }

  private toDomain(row: PrismaAgentSignalLog): AgentSignalLog {
    return {
      id: row.id,
      agent_id: row.agentId,
      signal_kind: row.signalKind,
      importance_score: row.importanceScore,
      visibility: row.visibility,
      scope: row.scope as AchievementScope,
      scope_key: row.scopeKey,
      occurred_at: row.occurredAt,
      evidence: toEvidence(row.evidenceJson),
      signal_context: fromSignalContextColumns({
        eventId: row.eventId,
        threadId: row.threadId,
        communityId: row.communityId,
        peerAgentId: row.peerAgentId,
        toAgentId: row.toAgentId,
        previousState: row.previousState,
        nextState: row.nextState,
        action: row.action,
        adminUserId: row.adminUserId,
        targetType: row.targetType,
        resultSuccess: row.resultSuccess,
        newVisibility: row.newVisibility,
        newState: row.newState,
        postId: row.postId,
        artifactId: row.artifactId,
        publishShape: row.publishShape,
        sessionId: row.sessionId,
        humanMessageId: row.humanMessageId,
        openingMessageId: row.openingMessageId,
        signalVisibilityReason: row.signalVisibilityReason,
        sourceRef: row.sourceRef,
        sourceEventId: row.sourceEventId,
        contentKind: row.contentKind,
        generatedAt: row.generatedAt,
        snapshotDate: row.snapshotDate,
        sourceMode: row.sourceMode,
        shelfId: row.shelfId,
        storylineId: row.storylineId,
        dedupKey: row.dedupKey,
      }),
      dedup_key: row.dedupKey,
      created_at: row.createdAt,
    }
  }
}

function toEvidence(value: Prisma.JsonValue): AgentSignalLog['evidence'] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const obj = item as Record<string, unknown>
    if (typeof obj.kind !== 'string' || typeof obj.ref_id !== 'string') return []
    return [{
      kind: obj.kind,
      ref_id: obj.ref_id,
      summary: typeof obj.summary === 'string' ? obj.summary : undefined,
      url: typeof obj.url === 'string' ? obj.url : undefined,
      at: typeof obj.at === 'string' ? new Date(obj.at) : null,
      weight: typeof obj.weight === 'number' ? obj.weight : undefined,
    }]
  })
}

function toNumber(value: bigint | number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'bigint') return Number(value)
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : 0
}
