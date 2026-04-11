import { randomUUID } from 'node:crypto'
import {
  Prisma,
  type PrismaClient,
  type Agent as PrismaAgent,
  type AgentConfig as PrismaAgentConfig,
} from '@prisma/client'
import type {
  Agent,
  AgentConfig,
  CreateAgentInput,
  CreateAgentConfigInput,
  PaginatedResult,
  PaginationOpts,
} from '../types.js'
import type { AgentRepository, AgentConfigRepository } from '../agent-repository.js'

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
  const next_cursor =
    page.length === opts.limit && start + opts.limit < items.length
      ? page[page.length - 1].id
      : null
  return { items: page, next_cursor }
}

const DEFAULT_CACHE_REFRESH_MS = 2_000

function isEffectiveConfig(config: AgentConfig): boolean {
  return config.review_status === 'NOT_REQUIRED' || config.review_status === 'APPROVED'
}

export class PgAgentRepository implements AgentRepository {
  private cache = new Map<string, Agent>()
  private refreshInFlight: Promise<void> | null = null

  constructor(
    private readonly prisma: PrismaClient,
    opts?: { refreshIntervalMs?: number },
  ) {
    const refreshIntervalMs = opts?.refreshIntervalMs ?? DEFAULT_CACHE_REFRESH_MS
    if (refreshIntervalMs > 0) {
      const timer = setInterval(() => {
        void this.refreshCache().catch((err) => {
          console.error('[PgAgentRepo] background refresh error:', err)
        })
      }, refreshIntervalMs)
      timer.unref?.()
    }
  }

  async hydrate(): Promise<void> {
    const rows = await this.prisma.agent.findMany()
    const nextCache = new Map<string, Agent>()
    for (const row of rows) {
      nextCache.set(row.id, this.toDomain(row))
    }
    for (const [id, agent] of this.cache) {
      if (!nextCache.has(id)) {
        nextCache.set(id, agent)
      }
    }
    this.cache = nextCache
  }

  private refreshCache(): Promise<void> {
    if (this.refreshInFlight) return this.refreshInFlight
    this.refreshInFlight = this.hydrate().finally(() => {
      this.refreshInFlight = null
    })
    return this.refreshInFlight
  }

  create(input: CreateAgentInput): Agent {
    const id = randomUUID()
    const now = new Date()
    const agent = this.newAgent(input, id, now)
    this.cache.set(id, agent)
    this.prisma.agent
      .create({
        data: {
          id,
          ownerId: agent.owner_id,
          displayName: agent.display_name,
          avatarUrl: agent.avatar_url,
          personaVersion: agent.persona_version,
          reputationScore: agent.reputation_score,
          status: agent.status,
          deletedAt: agent.deleted_at,
          createdAt: now,
          updatedAt: now,
        },
      })
      .catch((err) => console.error('[PgAgentRepo] create error:', err))
    return agent
  }

  async createPersisted(input: CreateAgentInput): Promise<Agent> {
    if (this.refreshInFlight) {
      await this.refreshInFlight
    }
    const id = randomUUID()
    const now = new Date()
    const agent = this.newAgent(input, id, now)
    await this.prisma.agent.create({
      data: {
        id,
        ownerId: agent.owner_id,
        displayName: agent.display_name,
        avatarUrl: agent.avatar_url,
        personaVersion: agent.persona_version,
        reputationScore: agent.reputation_score,
        status: agent.status,
        deletedAt: agent.deleted_at,
        createdAt: now,
        updatedAt: now,
      },
    })
    this.cache.set(id, agent)
    return agent
  }

  async deletePersisted(id: string): Promise<void> {
    this.cache.delete(id)
    await this.prisma.agent.deleteMany({ where: { id } })
  }

  async softDeletePersisted(id: string, deletedAt: Date): Promise<Agent | null> {
    const cached = this.cache.get(id)
    if (!cached) return null

    const row = await this.prisma.agent.update({
      where: { id },
      data: {
        status: 'DELETED',
        deletedAt,
        updatedAt: deletedAt,
      },
    })

    const updated = this.toDomain(row)
    this.cache.set(id, updated)
    return updated
  }

  async refreshPersisted(): Promise<void> {
    await this.refreshCache()
  }

  findById(id: string): Agent | null {
    return this.cache.get(id) ?? null
  }

  findByDisplayName(displayName: string): Agent | null {
    const lower = displayName.toLowerCase()
    for (const agent of this.cache.values()) {
      if (agent.status === 'DELETED') continue
      if (agent.display_name.toLowerCase() === lower) return agent
    }
    return null
  }

  findByOwner(ownerId: string): Agent[] {
    return Array.from(this.cache.values())
      .filter((a) => a.owner_id === ownerId && a.status !== 'DELETED')
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }

  findActive(opts: PaginationOpts): PaginatedResult<Agent> {
    const items = Array.from(this.cache.values())
      .filter((a) => a.status === 'ACTIVE')
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return paginate(items, opts)
  }

  search(opts: PaginationOpts & { q?: string }): PaginatedResult<Agent> {
    const query = (opts.q ?? '').trim().toLowerCase()
    const items = Array.from(this.cache.values())
      .filter((a) => a.status !== 'DELETED')
      .filter((a) => (query ? a.display_name.toLowerCase().includes(query) : true))
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return paginate(items, opts)
  }

  updateStatus(id: string, status: Agent['status']): Agent | null {
    const agent = this.cache.get(id)
    if (!agent) return null
    agent.status = status
    agent.updated_at = new Date()
    this.prisma.agent
      .update({ where: { id }, data: { status, updatedAt: agent.updated_at } })
      .catch((err) => console.error('[PgAgentRepo] updateStatus error:', err))
    return agent
  }

  updateReputation(id: string, delta: number): Agent | null {
    const agent = this.cache.get(id)
    if (!agent) return null
    agent.reputation_score += delta
    agent.updated_at = new Date()
    this.prisma.agent
      .update({
        where: { id },
        data: {
          reputationScore: agent.reputation_score,
          updatedAt: agent.updated_at,
        },
      })
      .catch((err) =>
        console.error('[PgAgentRepo] updateReputation error:', err),
      )
    return agent
  }

  updateProfile(
    id: string,
    patch: { display_name?: string; avatar_url?: string | null },
  ): Agent | null {
    const agent = this.cache.get(id)
    if (!agent) return null

    if (patch.display_name !== undefined) {
      agent.display_name = patch.display_name
    }
    if (patch.avatar_url !== undefined) {
      agent.avatar_url = patch.avatar_url
    }
    agent.updated_at = new Date()

    const data: Prisma.AgentUpdateInput = {
      updatedAt: agent.updated_at,
    }
    if (patch.display_name !== undefined) {
      data.displayName = patch.display_name
    }
    if (patch.avatar_url !== undefined) {
      data.avatarUrl = patch.avatar_url
    }

    this.prisma.agent
      .update({
        where: { id },
        data,
      })
      .catch((err) => console.error('[PgAgentRepo] updateProfile error:', err))

    return agent
  }

  private toDomain(row: PrismaAgent): Agent {
    return {
      id: row.id,
      owner_id: row.ownerId,
      display_name: row.displayName,
      avatar_url: row.avatarUrl,
      persona_version: row.personaVersion,
      reputation_score: row.reputationScore,
      status: row.status,
      deleted_at: row.deletedAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private newAgent(input: CreateAgentInput, id: string, now: Date): Agent {
    return {
      id,
      owner_id: input.owner_id,
      display_name: input.display_name,
      avatar_url: input.avatar_url ?? null,
      persona_version: 1,
      reputation_score: 0,
      status: 'ACTIVE',
      deleted_at: null,
      created_at: now,
      updated_at: now,
    }
  }
}

export class PgAgentConfigRepository implements AgentConfigRepository {
  private cache = new Map<string, AgentConfig>()
  private agentLatest = new Map<string, string>()
  private refreshInFlight: Promise<void> | null = null

  constructor(
    private readonly prisma: PrismaClient,
    opts?: { refreshIntervalMs?: number },
  ) {
    const refreshIntervalMs = opts?.refreshIntervalMs ?? DEFAULT_CACHE_REFRESH_MS
    if (refreshIntervalMs > 0) {
      const timer = setInterval(() => {
        void this.refreshCache().catch((err) => {
          console.error('[PgAgentConfigRepo] background refresh error:', err)
        })
      }, refreshIntervalMs)
      timer.unref?.()
    }
  }

  async hydrate(): Promise<void> {
    const rows = await this.prisma.agentConfig.findMany({
      orderBy: { effectiveAt: 'desc' },
    })
    const nextCache = new Map<string, AgentConfig>()
    const nextLatest = new Map<string, string>()
    for (const row of rows) {
      const config = this.toDomain(row)
      nextCache.set(config.id, config)
      if (!nextLatest.has(config.agent_id)) {
        nextLatest.set(config.agent_id, config.id)
      }
    }
    for (const [id, config] of this.cache) {
      if (!nextCache.has(id)) {
        nextCache.set(id, config)
      }
      if (!nextLatest.has(config.agent_id)) {
        nextLatest.set(config.agent_id, id)
      }
    }
    this.cache = nextCache
    this.agentLatest = nextLatest
  }

  private refreshCache(): Promise<void> {
    if (this.refreshInFlight) return this.refreshInFlight
    this.refreshInFlight = this.hydrate().finally(() => {
      this.refreshInFlight = null
    })
    return this.refreshInFlight
  }

  create(input: CreateAgentConfigInput): AgentConfig {
    const id = randomUUID()
    const now = new Date()
    const config: AgentConfig = {
      id,
      agent_id: input.agent_id,
      config_json: input.config_json,
      risk_level: input.risk_level ?? 'LOW',
      review_status: input.review_status ?? 'NOT_REQUIRED',
      review_case_id: input.review_case_id ?? null,
      lint_warnings: input.lint_warnings ?? [],
      updated_at: now,
      effective_at: now,
      updated_by: input.updated_by,
    }
    this.cache.set(id, config)
    this.agentLatest.set(input.agent_id, id)
    this.prisma.agentConfig
      .create({
        data: {
          id,
          agentId: config.agent_id,
          configJson: config.config_json as Prisma.InputJsonValue,
          riskLevel: config.risk_level,
          reviewStatus: config.review_status,
          reviewCaseId: config.review_case_id,
          lintWarningsJson: config.lint_warnings as Prisma.InputJsonValue,
          updatedAt: now,
          effectiveAt: now,
          updatedBy: config.updated_by,
        },
      })
      .catch((err) =>
        console.error('[PgAgentConfigRepo] create error:', err),
      )
    return config
  }

  async createPersisted(input: CreateAgentConfigInput): Promise<AgentConfig> {
    if (this.refreshInFlight) {
      await this.refreshInFlight
    }
    const id = randomUUID()
    const now = new Date()
    const config: AgentConfig = {
      id,
      agent_id: input.agent_id,
      config_json: input.config_json,
      risk_level: input.risk_level ?? 'LOW',
      review_status: input.review_status ?? 'NOT_REQUIRED',
      review_case_id: input.review_case_id ?? null,
      lint_warnings: input.lint_warnings ?? [],
      updated_at: now,
      effective_at: now,
      updated_by: input.updated_by,
    }
    await this.prisma.agentConfig.create({
      data: {
        id,
        agentId: config.agent_id,
        configJson: config.config_json as Prisma.InputJsonValue,
        riskLevel: config.risk_level,
        reviewStatus: config.review_status,
        reviewCaseId: config.review_case_id,
        lintWarningsJson: config.lint_warnings as Prisma.InputJsonValue,
        updatedAt: now,
        effectiveAt: now,
        updatedBy: config.updated_by,
      },
    })
    this.cache.set(id, config)
    this.agentLatest.set(input.agent_id, id)
    return config
  }

  async refreshPersisted(): Promise<void> {
    await this.refreshCache()
  }

  findLatest(agentId: string): AgentConfig | null {
    const configs = Array.from(this.cache.values())
      .filter((item) => item.agent_id === agentId)
      .sort((a, b) =>
        b.effective_at.getTime() - a.effective_at.getTime()
        || b.id.localeCompare(a.id))
    return configs.find(isEffectiveConfig) ?? configs[0] ?? null
  }

  findLatestRevision(agentId: string): AgentConfig | null {
    const configs = Array.from(this.cache.values())
      .filter((item) => item.agent_id === agentId)
      .sort((a, b) =>
        b.updated_at.getTime() - a.updated_at.getTime()
        || b.id.localeCompare(a.id))
    return configs[0] ?? null
  }

  private toDomain(row: PrismaAgentConfig): AgentConfig {
    return {
      id: row.id,
      agent_id: row.agentId,
      config_json: row.configJson as Record<string, unknown>,
      risk_level: row.riskLevel,
      review_status: row.reviewStatus,
      review_case_id: row.reviewCaseId,
      lint_warnings: Array.isArray(row.lintWarningsJson)
        ? row.lintWarningsJson.filter((item): item is string => typeof item === 'string')
        : [],
      updated_at: row.updatedAt,
      effective_at: row.effectiveAt,
      updated_by: row.updatedBy,
    }
  }
}
