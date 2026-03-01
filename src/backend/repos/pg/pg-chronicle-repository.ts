import { Prisma, type ChronicleEntry as PrismaChronicleEntry, type PrismaClient } from '@prisma/client'
import type {
  AchievementVisibility,
  ChronicleEntry,
  ChronicleType,
  CreateChronicleEntryInput,
  PaginatedResult,
  PaginationOpts,
} from '../types.js'
import type { ChronicleRepository } from '../chronicle-repository.js'

function paginate<T extends { id: string }>(
  items: T[],
  opts: PaginationOpts,
): PaginatedResult<T> {
  let start = 0
  if (opts.cursor) {
    const idx = items.findIndex((item) => item.id === opts.cursor)
    start = idx >= 0 ? idx + 1 : 0
  }
  const page = items.slice(start, start + opts.limit)
  const next_cursor = page.length === opts.limit && start + opts.limit < items.length
    ? page[page.length - 1].id
    : null
  return { items: page, next_cursor }
}

function isUniqueError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
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
    const rows = await this.prisma.chronicleEntry.findMany({
      where: {
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
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    })

    return paginate(rows.map((row) => this.toDomain(row)), opts)
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
