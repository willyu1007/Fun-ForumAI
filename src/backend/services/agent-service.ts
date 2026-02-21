import type {
  AgentRepository,
  AgentConfigRepository,
  AgentRunRepository,
  Agent,
  AgentConfig,
  AgentRun,
  PaginatedResult,
} from '../repos/index.js'
import { NotFoundError, ValidationError } from '../lib/errors.js'

export interface AgentServiceDeps {
  agentRepo: AgentRepository
  agentConfigRepo: AgentConfigRepository
  agentRunRepo: AgentRunRepository
}

export class AgentService {
  constructor(private readonly deps: AgentServiceDeps) {}

  createAgent(input: {
    owner_id: string
    display_name: string
    avatar_url?: string
    model?: string
  }): Agent {
    if (!input.display_name.trim()) {
      throw new ValidationError('display_name is required')
    }
    return this.deps.agentRepo.create(input)
  }

  getAgent(agentId: string): Agent {
    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) throw new NotFoundError('Agent', agentId)
    return agent
  }

  getAgentProfile(agentId: string): Agent {
    return this.getAgent(agentId)
  }

  listActiveAgents(opts: {
    cursor?: string
    limit?: number
  }): PaginatedResult<Agent> {
    const limit = Math.min(opts.limit ?? 20, 100)
    return this.deps.agentRepo.findActive({ cursor: opts.cursor, limit })
  }

  updateConfig(
    agentId: string,
    configJson: Record<string, unknown>,
    adminUserId: string,
  ): AgentConfig {
    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) throw new NotFoundError('Agent', agentId)

    return this.deps.agentConfigRepo.create({
      agent_id: agentId,
      config_json: configJson,
      updated_by: adminUserId,
    })
  }

  getLatestConfig(agentId: string): AgentConfig | null {
    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) throw new NotFoundError('Agent', agentId)
    return this.deps.agentConfigRepo.findLatest(agentId)
  }

  getAgentRuns(
    agentId: string,
    opts: { cursor?: string; limit?: number },
  ): PaginatedResult<AgentRun> {
    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) throw new NotFoundError('Agent', agentId)
    const limit = Math.min(opts.limit ?? 20, 100)
    return this.deps.agentRunRepo.findByAgent(agentId, { cursor: opts.cursor, limit })
  }

  updateAgentStatus(agentId: string, status: Agent['status']): Agent {
    const updated = this.deps.agentRepo.updateStatus(agentId, status)
    if (!updated) throw new NotFoundError('Agent', agentId)
    return updated
  }
}
