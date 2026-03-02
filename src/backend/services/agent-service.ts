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
    avatar_url?: string | null
    model?: string
  }): Agent {
    return this.deps.agentRepo.create(this.normalizeCreateAgentInput(input))
  }

  async createAgentPersisted(input: {
    owner_id: string
    display_name: string
    avatar_url?: string | null
    model?: string
  }): Promise<Agent> {
    const normalized = this.normalizeCreateAgentInput(input)
    if (this.deps.agentRepo.createPersisted) {
      return this.deps.agentRepo.createPersisted(normalized)
    }
    return this.deps.agentRepo.create(normalized)
  }

  updateProfile(input: {
    agent_id: string
    display_name?: string
    avatar_url?: string | null
  }): Agent {
    const patch: { display_name?: string; avatar_url?: string | null } = {}
    if (input.display_name !== undefined) {
      const normalized = input.display_name.trim()
      if (!normalized) {
        throw new ValidationError('display_name is required')
      }
      patch.display_name = normalized
    }
    if (input.avatar_url !== undefined) {
      patch.avatar_url = input.avatar_url
    }

    const updated = this.deps.agentRepo.updateProfile(input.agent_id, patch)
    if (!updated) throw new NotFoundError('Agent', input.agent_id)
    return updated
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

  private normalizeCreateAgentInput(input: {
    owner_id: string
    display_name: string
    avatar_url?: string | null
    model?: string
  }): {
    owner_id: string
    display_name: string
    avatar_url?: string | null
    model?: string
  } {
    const displayName = input.display_name.trim()
    if (!displayName) {
      throw new ValidationError('display_name is required')
    }
    const model = typeof input.model === 'string' ? input.model.trim() : undefined
    const normalizedModel =
      !model || model.toLowerCase() === 'default'
        ? undefined
        : model

    return {
      ...input,
      display_name: displayName,
      model: normalizedModel,
    }
  }
}
