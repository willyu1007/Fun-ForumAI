import { Prisma, type AgentAchievement as PrismaAchievement, type PrismaClient } from '@prisma/client'
import type {
  AchievementVisibility,
  AgentAchievement,
  CreateAgentAchievementInput,
  PaginatedResult,
  PaginationOpts,
} from '../types.js'
import type { AchievementRepository } from '../achievement-repository.js'

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
    try {
      const row = await this.prisma.agentAchievement.create({
        data: {
          agentId: input.agent_id,
          code: input.code,
          name: input.name,
          category: input.category,
          tier: input.tier,
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
      const existing = await this.findByCodeTier(input.agent_id, input.code, input.tier)
      if (!existing) throw error
      return { achievement: existing, created: false }
    }
  }

  async findByCodeTier(agentId: string, code: string, tier: 1 | 2 | 3): Promise<AgentAchievement | null> {
    const row = await this.prisma.agentAchievement.findUnique({
      where: {
        agentId_code_tier: {
          agentId,
          code,
          tier,
        },
      },
    })
    return row ? this.toDomain(row) : null
  }

  async findByAgent(
    agentId: string,
    opts: PaginationOpts & { visibility?: AchievementVisibility[] },
  ): Promise<PaginatedResult<AgentAchievement>> {
    const rows = await this.prisma.agentAchievement.findMany({
      where: {
        agentId,
        ...(opts.visibility ? { visibility: { in: opts.visibility } } : {}),
      },
      orderBy: [{ achievedAt: 'desc' }, { id: 'desc' }],
    })

    return paginate(rows.map((row) => this.toDomain(row)), opts)
  }

  private toDomain(row: PrismaAchievement): AgentAchievement {
    return {
      id: row.id,
      agent_id: row.agentId,
      code: row.code,
      name: row.name,
      category: row.category,
      tier: row.tier as 1 | 2 | 3,
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
