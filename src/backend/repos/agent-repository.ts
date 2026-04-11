import type {
  Agent,
  AgentConfig,
  CreateAgentInput,
  CreateAgentConfigInput,
  PaginatedResult,
  PaginationOpts,
} from './types.js'

export interface AgentRepository {
  create(input: CreateAgentInput): Agent
  createPersisted?(input: CreateAgentInput): Promise<Agent>
  deletePersisted?(id: string): Promise<void>
  softDeletePersisted?(id: string, deletedAt: Date): Promise<Agent | null>
  refreshPersisted?(): Promise<void>
  findById(id: string): Agent | null
  findByDisplayName(displayName: string): Agent | null
  findByOwner(ownerId: string): Agent[]
  findActive(opts: PaginationOpts): PaginatedResult<Agent>
  search(opts: PaginationOpts & { q?: string }): PaginatedResult<Agent>
  updateStatus(id: string, status: Agent['status']): Agent | null
  updateReputation(id: string, delta: number): Agent | null
  updateProfile(
    id: string,
    patch: { display_name?: string; avatar_url?: string | null },
  ): Agent | null
}

export interface AgentConfigRepository {
  create(input: CreateAgentConfigInput): AgentConfig
  createPersisted?(input: CreateAgentConfigInput): Promise<AgentConfig>
  refreshPersisted?(): Promise<void>
  findLatest(agentId: string): AgentConfig | null
  findLatestRevision?(agentId: string): AgentConfig | null
}

let counter = 0
function cuid(prefix: string): string {
  return `${prefix}_${Date.now()}_${++counter}`
}

function isEffectiveConfig(config: AgentConfig): boolean {
  return config.review_status === 'NOT_REQUIRED' || config.review_status === 'APPROVED'
}

export class InMemoryAgentRepository implements AgentRepository {
  private store = new Map<string, Agent>()

  create(input: CreateAgentInput): Agent {
    const now = new Date()
    const agent: Agent = {
      id: cuid('agent'),
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
    this.store.set(agent.id, agent)
    return agent
  }

  async createPersisted(input: CreateAgentInput): Promise<Agent> {
    return this.create(input)
  }

  async deletePersisted(id: string): Promise<void> {
    this.store.delete(id)
  }

  async softDeletePersisted(id: string, deletedAt: Date): Promise<Agent | null> {
    const agent = this.store.get(id)
    if (!agent) return null
    agent.status = 'DELETED'
    agent.deleted_at = deletedAt
    agent.updated_at = deletedAt
    return agent
  }

  async refreshPersisted(): Promise<void> {
    // In-memory mode is already authoritative for the current process.
  }

  findById(id: string): Agent | null {
    return this.store.get(id) ?? null
  }

  findByDisplayName(displayName: string): Agent | null {
    const lower = displayName.toLowerCase()
    for (const agent of this.store.values()) {
      if (agent.status === 'DELETED') continue
      if (agent.display_name.toLowerCase() === lower) return agent
    }
    return null
  }

  findByOwner(ownerId: string): Agent[] {
    return Array.from(this.store.values())
      .filter((a) => a.owner_id === ownerId && a.status !== 'DELETED')
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }

  findActive(opts: PaginationOpts): PaginatedResult<Agent> {
    const items = Array.from(this.store.values())
      .filter((a) => a.status === 'ACTIVE')
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return paginate(items, opts)
  }

  search(opts: PaginationOpts & { q?: string }): PaginatedResult<Agent> {
    const query = (opts.q ?? '').trim().toLowerCase()
    const items = Array.from(this.store.values())
      .filter((a) => a.status !== 'DELETED')
      .filter((a) => (query ? a.display_name.toLowerCase().includes(query) : true))
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return paginate(items, opts)
  }

  updateStatus(id: string, status: Agent['status']): Agent | null {
    const a = this.store.get(id)
    if (!a) return null
    a.status = status
    a.updated_at = new Date()
    return a
  }

  updateReputation(id: string, delta: number): Agent | null {
    const a = this.store.get(id)
    if (!a) return null
    a.reputation_score += delta
    a.updated_at = new Date()
    return a
  }

  updateProfile(
    id: string,
    patch: { display_name?: string; avatar_url?: string | null },
  ): Agent | null {
    const agent = this.store.get(id)
    if (!agent) return null

    if (patch.display_name !== undefined) {
      agent.display_name = patch.display_name
    }
    if (patch.avatar_url !== undefined) {
      agent.avatar_url = patch.avatar_url
    }

    agent.updated_at = new Date()
    return agent
  }
}

export class InMemoryAgentConfigRepository implements AgentConfigRepository {
  private store = new Map<string, AgentConfig>()
  private agentLatest = new Map<string, string>()

  create(input: CreateAgentConfigInput): AgentConfig {
    const now = new Date()
    const config: AgentConfig = {
      id: cuid('acfg'),
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
    this.store.set(config.id, config)
    this.agentLatest.set(input.agent_id, config.id)
    return config
  }

  async createPersisted(input: CreateAgentConfigInput): Promise<AgentConfig> {
    return this.create(input)
  }

  async refreshPersisted(): Promise<void> {
    // In-memory mode is already authoritative for the current process.
  }

  findLatest(agentId: string): AgentConfig | null {
    const configs = Array.from(this.store.values())
      .filter((item) => item.agent_id === agentId)
      .sort((a, b) =>
        b.effective_at.getTime() - a.effective_at.getTime()
        || b.id.localeCompare(a.id))
    return configs.find(isEffectiveConfig) ?? configs[0] ?? null
  }

  findLatestRevision(agentId: string): AgentConfig | null {
    const configs = Array.from(this.store.values())
      .filter((item) => item.agent_id === agentId)
      .sort((a, b) =>
        b.updated_at.getTime() - a.updated_at.getTime()
        || b.id.localeCompare(a.id))
    return configs[0] ?? null
  }
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
