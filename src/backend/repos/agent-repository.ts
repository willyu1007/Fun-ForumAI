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
  findById(id: string): Agent | null
  findActive(opts: PaginationOpts): PaginatedResult<Agent>
  updateStatus(id: string, status: Agent['status']): Agent | null
  updateReputation(id: string, delta: number): Agent | null
}

export interface AgentConfigRepository {
  create(input: CreateAgentConfigInput): AgentConfig
  findLatest(agentId: string): AgentConfig | null
}

let counter = 0
function cuid(prefix: string): string {
  return `${prefix}_${Date.now()}_${++counter}`
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
      model: input.model ?? 'gpt-4o',
      persona_version: 1,
      reputation_score: 0,
      status: 'ACTIVE',
      created_at: now,
      updated_at: now,
    }
    this.store.set(agent.id, agent)
    return agent
  }

  findById(id: string): Agent | null {
    return this.store.get(id) ?? null
  }

  findActive(opts: PaginationOpts): PaginatedResult<Agent> {
    const items = Array.from(this.store.values())
      .filter((a) => a.status === 'ACTIVE')
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
      updated_at: now,
      effective_at: now,
      updated_by: input.updated_by,
    }
    this.store.set(config.id, config)
    this.agentLatest.set(input.agent_id, config.id)
    return config
  }

  findLatest(agentId: string): AgentConfig | null {
    const id = this.agentLatest.get(agentId)
    if (!id) return null
    return this.store.get(id) ?? null
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
