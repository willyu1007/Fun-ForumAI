import type {
  AgentAchievement,
  AchievementScope,
  AchievementVisibility,
  CreateAgentAchievementInput,
  PaginatedResult,
  PaginationOpts,
} from './types.js'

const GLOBAL_SCOPE: AchievementScope = 'global'
const GLOBAL_SCOPE_KEY = '__global__'

export interface AchievementScopeFilter {
  scope: AchievementScope
  scope_key: string
}

export interface AchievementRepository {
  grant(input: CreateAgentAchievementInput): Promise<{ achievement: AgentAchievement; created: boolean }>
  findByCodeTier(
    agentId: string,
    code: string,
    tier: 1 | 2 | 3,
    scope?: AchievementScopeFilter,
  ): Promise<AgentAchievement | null>
  findByAgent(
    agentId: string,
    opts: PaginationOpts & { visibility?: AchievementVisibility[] },
  ): Promise<PaginatedResult<AgentAchievement>>
}

let counter = 0
function cuid(): string {
  return `ach_${Date.now()}_${++counter}`
}

function paginate<T extends { id: string }>(
  items: T[],
  opts: PaginationOpts,
): PaginatedResult<T> {
  let start = 0
  if (opts.cursor) {
    const idx = items.findIndex((i) => i.id === opts.cursor)
    start = idx >= 0 ? idx + 1 : 0
  }
  const page = items.slice(start, start + opts.limit)
  const next_cursor = page.length === opts.limit && start + opts.limit < items.length
    ? page[page.length - 1].id
    : null
  return { items: page, next_cursor }
}

export class InMemoryAchievementRepository implements AchievementRepository {
  private readonly store = new Map<string, AgentAchievement>()
  private readonly uniqueIndex = new Map<string, string>()

  private normalizeScope(scope?: AchievementScopeFilter): AchievementScopeFilter {
    return {
      scope: scope?.scope ?? GLOBAL_SCOPE,
      scope_key: scope?.scope_key || GLOBAL_SCOPE_KEY,
    }
  }

  async grant(input: CreateAgentAchievementInput): Promise<{ achievement: AgentAchievement; created: boolean }> {
    const normalizedScope = this.normalizeScope({
      scope: input.scope,
      scope_key: input.scope_key,
    })
    const key = `${input.agent_id}:${input.code}:${input.tier}:${normalizedScope.scope}:${normalizedScope.scope_key}`
    const existingId = this.uniqueIndex.get(key)
    if (existingId) {
      const achievement = this.store.get(existingId)
      if (achievement) {
        return { achievement, created: false }
      }
    }

    const now = new Date()
    const achievement: AgentAchievement = {
      id: cuid(),
      agent_id: input.agent_id,
      code: input.code,
      name: input.name,
      category: input.category,
      tier: input.tier,
      scope: normalizedScope.scope,
      scope_key: normalizedScope.scope_key,
      rarity: input.rarity ?? 0.5,
      visibility: input.visibility,
      achieved_at: input.achieved_at ?? now,
      evidence: input.evidence,
      meta: input.meta ?? null,
      created_at: now,
      updated_at: now,
    }

    this.store.set(achievement.id, achievement)
    this.uniqueIndex.set(key, achievement.id)

    return { achievement, created: true }
  }

  async findByCodeTier(
    agentId: string,
    code: string,
    tier: 1 | 2 | 3,
    scope?: AchievementScopeFilter,
  ): Promise<AgentAchievement | null> {
    const normalizedScope = this.normalizeScope(scope)
    const id = this.uniqueIndex.get(`${agentId}:${code}:${tier}:${normalizedScope.scope}:${normalizedScope.scope_key}`)
    if (!id) return null
    return this.store.get(id) ?? null
  }

  async findByAgent(
    agentId: string,
    opts: PaginationOpts & { visibility?: AchievementVisibility[] },
  ): Promise<PaginatedResult<AgentAchievement>> {
    const visibilitySet = opts.visibility ? new Set(opts.visibility) : null
    const items = Array.from(this.store.values())
      .filter((item) => item.agent_id === agentId)
      .filter((item) => (visibilitySet ? visibilitySet.has(item.visibility) : true))
      .sort((a, b) => b.achieved_at.getTime() - a.achieved_at.getTime() || b.id.localeCompare(a.id))
    return paginate(items, opts)
  }
}
