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

export class PgAgentRepository implements AgentRepository {
  private cache = new Map<string, Agent>()

  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {
    const rows = await this.prisma.agent.findMany()
    for (const row of rows) {
      this.cache.set(row.id, this.toDomain(row))
    }
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
          model: agent.model,
          personaVersion: agent.persona_version,
          reputationScore: agent.reputation_score,
          status: agent.status,
          createdAt: now,
          updatedAt: now,
        },
      })
      .catch((err) => console.error('[PgAgentRepo] create error:', err))
    return agent
  }

  async createPersisted(input: CreateAgentInput): Promise<Agent> {
    const id = randomUUID()
    const now = new Date()
    const agent = this.newAgent(input, id, now)
    await this.prisma.agent.create({
      data: {
        id,
        ownerId: agent.owner_id,
        displayName: agent.display_name,
        avatarUrl: agent.avatar_url,
        model: agent.model,
        personaVersion: agent.persona_version,
        reputationScore: agent.reputation_score,
        status: agent.status,
        createdAt: now,
        updatedAt: now,
      },
    })
    this.cache.set(id, agent)
    return agent
  }

  findById(id: string): Agent | null {
    return this.cache.get(id) ?? null
  }

  findByOwner(ownerId: string): Agent[] {
    return Array.from(this.cache.values())
      .filter((a) => a.owner_id === ownerId)
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
      model: row.model,
      persona_version: row.personaVersion,
      reputation_score: row.reputationScore,
      status: row.status,
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
      model: input.model ?? 'gpt-4o',
      persona_version: 1,
      reputation_score: 0,
      status: 'ACTIVE',
      created_at: now,
      updated_at: now,
    }
  }
}

export class PgAgentConfigRepository implements AgentConfigRepository {
  private cache = new Map<string, AgentConfig>()
  private agentLatest = new Map<string, string>()

  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {
    const rows = await this.prisma.agentConfig.findMany({
      orderBy: { effectiveAt: 'desc' },
    })
    for (const row of rows) {
      const config = this.toDomain(row)
      this.cache.set(config.id, config)
      if (!this.agentLatest.has(config.agent_id)) {
        this.agentLatest.set(config.agent_id, config.id)
      }
    }
  }

  create(input: CreateAgentConfigInput): AgentConfig {
    const id = randomUUID()
    const now = new Date()
    const config: AgentConfig = {
      id,
      agent_id: input.agent_id,
      config_json: input.config_json,
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

  findLatest(agentId: string): AgentConfig | null {
    const id = this.agentLatest.get(agentId)
    if (!id) return null
    return this.cache.get(id) ?? null
  }

  private toDomain(row: PrismaAgentConfig): AgentConfig {
    return {
      id: row.id,
      agent_id: row.agentId,
      config_json: row.configJson as Record<string, unknown>,
      updated_at: row.updatedAt,
      effective_at: row.effectiveAt,
      updated_by: row.updatedBy,
    }
  }
}
