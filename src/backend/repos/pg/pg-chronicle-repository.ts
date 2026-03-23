import { Prisma, type ChronicleEntry as PrismaChronicleEntry, type PrismaClient } from '@prisma/client'
import type {
  AchievementScope,
  AchievementVisibility,
  ChronicleEntry,
  ChronicleType,
  CreateChronicleEntryInput,
  PaginatedResult,
  PaginationOpts,
} from '../types.js'
import type { ChronicleRepository, ChronicleSignalMetrics } from '../chronicle-repository.js'

function isUniqueError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

function isMissingCursorError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
}

function toEvidence(value: Prisma.JsonValue): ChronicleEntry['evidence'] {
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

function toStringArray(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

export class PgChronicleRepository implements ChronicleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {}

  async create(input: CreateChronicleEntryInput): Promise<ChronicleEntry> {
    if (input.dedup_key) {
      const existing = await this.findByDedupKey(input.agent_id, input.dedup_key)
      if (existing) return existing
    }
    try {
      const row = await this.prisma.chronicleEntry.create({
        data: {
          agentId: input.agent_id,
          visibility: input.visibility,
          type: input.type,
          occurredAt: input.occurred_at ?? new Date(),
          title: input.title,
          summary: input.summary,
          importanceScore: input.importance_score,
          evidenceJson: input.evidence as unknown as Prisma.InputJsonValue,
          actorsJson: (input.actors ?? []) as unknown as Prisma.InputJsonValue,
          location: input.location ?? null,
          tagsJson: (input.tags ?? []) as unknown as Prisma.InputJsonValue,
          metaJson: (input.meta ?? null) as unknown as Prisma.InputJsonValue,
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

  async findByDedupKey(agentId: string, dedupKey: string): Promise<ChronicleEntry | null> {
    const row = await this.prisma.chronicleEntry.findFirst({
      where: { agentId, dedupKey },
    })
    return row ? this.toDomain(row) : null
  }

  async findByAgent(
    agentId: string,
    opts: PaginationOpts & {
      visibility?: AchievementVisibility[]
      types?: ChronicleType[]
      from?: Date
      to?: Date
    },
  ): Promise<PaginatedResult<ChronicleEntry>> {
    const where = {
      agentId,
      ...(opts.visibility ? { visibility: { in: opts.visibility } } : {}),
      ...(opts.types ? { type: { in: opts.types } } : {}),
      ...(opts.from || opts.to
        ? {
            occurredAt: {
              ...(opts.from ? { gte: opts.from } : {}),
              ...(opts.to ? { lte: opts.to } : {}),
            },
          }
        : {}),
    } satisfies Prisma.ChronicleEntryWhereInput

    const baseQuery = {
      where,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
    } satisfies Prisma.ChronicleEntryFindManyArgs

    let rows: PrismaChronicleEntry[]

    if (opts.cursor) {
      try {
        rows = await this.prisma.chronicleEntry.findMany({
          ...baseQuery,
          cursor: { id: opts.cursor },
          skip: 1,
        })
      } catch (error) {
        if (!isMissingCursorError(error)) throw error
        rows = await this.prisma.chronicleEntry.findMany(baseQuery)
      }
    } else {
      rows = await this.prisma.chronicleEntry.findMany(baseQuery)
    }

    const hasMore = rows.length > opts.limit
    const pageRows = hasMore ? rows.slice(0, opts.limit) : rows
    const next_cursor = hasMore && pageRows.length > 0
      ? pageRows[pageRows.length - 1].id
      : null

    return {
      items: pageRows.map((row) => this.toDomain(row)),
      next_cursor,
    }
  }

  async countFoldedByAgent(
    agentId: string,
    opts: { perDayCap: number; visibility?: AchievementVisibility[]; types?: ChronicleType[] },
  ): Promise<number> {
    const perDayCap = Math.max(1, Math.trunc(opts.perDayCap))
    const conditions: Prisma.Sql[] = [
      Prisma.sql`"agent_id" = ${agentId}`,
    ]

    if (opts.visibility && opts.visibility.length > 0) {
      conditions.push(Prisma.sql`"visibility" IN (${Prisma.join(opts.visibility)})`)
    }
    if (opts.types && opts.types.length > 0) {
      conditions.push(Prisma.sql`"type" IN (${Prisma.join(opts.types)})`)
    }

    const whereSql = conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty

    const rows = await this.prisma.$queryRaw<Array<{ folded: bigint | number | string | null }>>(Prisma.sql`
      SELECT COALESCE(SUM(GREATEST(day_count - ${perDayCap}, 0)), 0) AS folded
      FROM (
        SELECT COUNT(*)::int AS day_count
        FROM "chronicle_entries"
        ${whereSql}
        GROUP BY DATE_TRUNC('day', "occurred_at")
      ) AS daily
    `)

    const raw = rows[0]?.folded ?? 0
    if (typeof raw === 'number') return raw
    if (typeof raw === 'bigint') return Number(raw)
    if (typeof raw === 'string') return Number.parseInt(raw, 10) || 0
    return 0
  }

  async countByAgent(
    agentId: string,
    opts?: { visibility?: AchievementVisibility[]; types?: ChronicleType[]; since?: Date },
  ): Promise<number> {
    return this.prisma.chronicleEntry.count({
      where: {
        agentId,
        ...(opts?.visibility ? { visibility: { in: opts.visibility } } : {}),
        ...(opts?.types ? { type: { in: opts.types } } : {}),
        ...(opts?.since ? { occurredAt: { gte: opts.since } } : {}),
      },
    })
  }

  async getSignalMetrics(
    agentId: string,
    opts: { signalKinds: string[]; since?: Date; scope?: AchievementScope; scope_key?: string },
  ): Promise<ChronicleSignalMetrics> {
    const signalKinds = opts.signalKinds.filter((kind) => kind.trim().length > 0)
    const signalTags = signalKinds.map((kind) => `signal:${kind}`)
    const sinceSql = opts.since
      ? Prisma.sql`AND "occurred_at" >= ${opts.since}`
      : Prisma.empty
    const scopeSql = opts.scope
      ? Prisma.sql`AND COALESCE("meta_json"->>'scope', 'global') = ${opts.scope}`
      : Prisma.empty
    const scopeKeySql = opts.scope_key
      ? Prisma.sql`AND COALESCE("meta_json"->>'scope_key', '__global__') = ${opts.scope_key}`
      : Prisma.empty

    const baseRows = await this.prisma.$queryRaw<
      Array<{
        public_entries: bigint | number | string
        activity_days: bigint | number | string
        narrative_entries: bigint | number | string
        narrative_public_entries: bigint | number | string
        narrative_activity_days: bigint | number | string
      }>
    >(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE "visibility" = 'PUBLIC') AS public_entries,
        COUNT(DISTINCT DATE_TRUNC('day', "occurred_at")) AS activity_days,
        COUNT(*) FILTER (
          WHERE NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(COALESCE("tags_json", '[]'::jsonb)) AS t(tag)
            WHERE t.tag LIKE 'signal:%'
          )
        ) AS narrative_entries,
        COUNT(*) FILTER (
          WHERE "visibility" = 'PUBLIC'
            AND NOT EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(COALESCE("tags_json", '[]'::jsonb)) AS t(tag)
              WHERE t.tag LIKE 'signal:%'
            )
        ) AS narrative_public_entries,
        COUNT(DISTINCT DATE_TRUNC('day', "occurred_at")) FILTER (
          WHERE NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(COALESCE("tags_json", '[]'::jsonb)) AS t(tag)
            WHERE t.tag LIKE 'signal:%'
          )
        ) AS narrative_activity_days
      FROM "chronicle_entries"
      WHERE "agent_id" = ${agentId}
      ${sinceSql}
      ${scopeSql}
      ${scopeKeySql}
    `)

    const crossSceneRows = await this.prisma.$queryRaw<Array<{ cross_scene: bigint | number | string }>>(Prisma.sql`
      SELECT COUNT(DISTINCT signal_kind) AS cross_scene
      FROM (
        SELECT SUBSTRING(tag FROM 8) AS signal_kind
        FROM "chronicle_entries"
        CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE("tags_json", '[]'::jsonb)) AS t(tag)
        WHERE "agent_id" = ${agentId}
        ${sinceSql}
        ${scopeSql}
        ${scopeKeySql}
          AND t.tag LIKE 'signal:%'
      ) AS s
    `)

    const signalRows = signalTags.length > 0
      ? await this.prisma.$queryRaw<Array<{ tag: string; count: bigint | number | string }>>(Prisma.sql`
          SELECT t.tag AS tag, COUNT(*) AS count
          FROM "chronicle_entries"
          CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE("tags_json", '[]'::jsonb)) AS t(tag)
          WHERE "agent_id" = ${agentId}
          ${sinceSql}
          ${scopeSql}
          ${scopeKeySql}
            AND t.tag IN (${Prisma.join(signalTags)})
          GROUP BY t.tag
        `)
      : []

    const signalCounts: Record<string, number> = {}
    for (const kind of signalKinds) {
      signalCounts[kind] = 0
    }
    for (const row of signalRows) {
      const kind = row.tag.startsWith('signal:') ? row.tag.slice('signal:'.length) : row.tag
      signalCounts[kind] = toNumber(row.count)
    }

    const base = baseRows[0] ?? {
      public_entries: 0,
      activity_days: 0,
      narrative_entries: 0,
      narrative_public_entries: 0,
      narrative_activity_days: 0,
    }
    const cross = crossSceneRows[0] ?? { cross_scene: 0 }

    return {
      signal_counts: signalCounts,
      public_entries: toNumber(base.public_entries),
      activity_days: toNumber(base.activity_days),
      cross_scene: toNumber(cross.cross_scene),
      chronicle_entries: toNumber(base.narrative_entries),
      narrative_public_entries: toNumber(base.narrative_public_entries),
      narrative_activity_days: toNumber(base.narrative_activity_days),
      narrative_entries: toNumber(base.narrative_entries),
    }
  }

  private toDomain(row: PrismaChronicleEntry): ChronicleEntry {
    return {
      id: row.id,
      agent_id: row.agentId,
      visibility: row.visibility,
      type: row.type,
      occurred_at: row.occurredAt,
      title: row.title,
      summary: row.summary,
      importance_score: row.importanceScore,
      evidence: toEvidence(row.evidenceJson),
      actors: toStringArray(row.actorsJson),
      location: row.location,
      tags: toStringArray(row.tagsJson),
      meta: (row.metaJson ?? null) as Record<string, unknown> | null,
      dedup_key: row.dedupKey,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}

function toNumber(value: bigint | number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'bigint') return Number(value)
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : 0
}
