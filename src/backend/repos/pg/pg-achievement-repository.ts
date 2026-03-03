import { Prisma, type AgentAchievement as PrismaAchievement, type PrismaClient } from '@prisma/client'
import type {
  AchievementScope,
  AchievementVisibility,
  AgentAchievement,
  CreateAgentAchievementInput,
  PaginatedResult,
  PaginationOpts,
} from '../types.js'
import type { AchievementRepository } from '../achievement-repository.js'

const GLOBAL_SCOPE: AchievementScope = 'global'
const GLOBAL_SCOPE_KEY = '__global__'

function isUniqueError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

function isMissingCursorError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
}

function toEvidence(value: Prisma.JsonValue): AgentAchievement['evidence'] {
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

export class PgAchievementRepository implements AchievementRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {}

  async grant(input: CreateAgentAchievementInput): Promise<{ achievement: AgentAchievement; created: boolean }> {
    const scope = input.scope || GLOBAL_SCOPE
    const scopeKey = input.scope_key || GLOBAL_SCOPE_KEY
    try {
      const row = await this.prisma.agentAchievement.create({
        data: {
          agentId: input.agent_id,
          code: input.code,
          name: input.name,
          category: input.category,
          tier: input.tier,
          scope,
          scopeKey,
          rarity: input.rarity ?? 0.5,
          visibility: input.visibility,
          achievedAt: input.achieved_at ?? new Date(),
          evidenceJson: input.evidence as unknown as Prisma.InputJsonValue,
          metaJson: (input.meta ?? null) as unknown as Prisma.InputJsonValue,
        },
      })
      return { achievement: this.toDomain(row), created: true }
    } catch (error) {
      if (!isUniqueError(error)) throw error
      const existing = await this.findByCodeTier(input.agent_id, input.code, input.tier, {
        scope,
        scope_key: scopeKey,
      })
      if (!existing) throw error
      return { achievement: existing, created: false }
    }
  }

  async findByCodeTier(
    agentId: string,
    code: string,
    tier: 1 | 2 | 3,
    scope?: { scope: AchievementScope; scope_key: string },
  ): Promise<AgentAchievement | null> {
    const normalizedScope = scope?.scope ?? GLOBAL_SCOPE
    const normalizedScopeKey = scope?.scope_key || GLOBAL_SCOPE_KEY
    const row = await this.prisma.agentAchievement.findUnique({
      where: {
        agentId_code_tier_scope_scopeKey: {
          agentId,
          code,
          tier,
          scope: normalizedScope,
          scopeKey: normalizedScopeKey,
        },
      },
    })
    return row ? this.toDomain(row) : null
  }

  async findByAgent(
    agentId: string,
    opts: PaginationOpts & { visibility?: AchievementVisibility[] },
  ): Promise<PaginatedResult<AgentAchievement>> {
    const baseQuery = {
      where: {
        agentId,
        ...(opts.visibility ? { visibility: { in: opts.visibility } } : {}),
      },
      orderBy: [{ achievedAt: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
    } satisfies Prisma.AgentAchievementFindManyArgs

    let rows: PrismaAchievement[]

    if (opts.cursor) {
      try {
        rows = await this.prisma.agentAchievement.findMany({
          ...baseQuery,
          cursor: { id: opts.cursor },
          skip: 1,
        })
      } catch (error) {
        if (!isMissingCursorError(error)) throw error
        rows = await this.prisma.agentAchievement.findMany(baseQuery)
      }
    } else {
      rows = await this.prisma.agentAchievement.findMany(baseQuery)
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

  private toDomain(row: PrismaAchievement): AgentAchievement {
    return {
      id: row.id,
      agent_id: row.agentId,
      code: row.code,
      name: row.name,
      category: row.category,
      tier: row.tier as 1 | 2 | 3,
      scope: row.scope as AchievementScope,
      scope_key: row.scopeKey,
      rarity: row.rarity,
      visibility: row.visibility,
      achieved_at: row.achievedAt,
      evidence: toEvidence(row.evidenceJson),
      meta: (row.metaJson ?? null) as Record<string, unknown> | null,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
