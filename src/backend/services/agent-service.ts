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
import {
  buildInitialIdentityConfig,
  sanitizeIdentityConfig,
  type OwnerStylePins,
} from '../identity/agent-identity.js'
import type { AgentConfigReview } from '../repos/types.js'

export interface AgentServiceDeps {
  agentRepo: AgentRepository
  agentConfigRepo: AgentConfigRepository
  agentRunRepo: AgentRunRepository
  onConfigUpdated?: (input: {
    agent_id: string
    before_config: Record<string, unknown>
    after_config: Record<string, unknown>
    updated_by: string
  }) => Promise<void> | void
}

export class AgentService {
  constructor(private readonly deps: AgentServiceDeps) {}

  setConfigUpdatedHook(
    hook: (input: {
      agent_id: string
      before_config: Record<string, unknown>
      after_config: Record<string, unknown>
      updated_by: string
    }) => Promise<void> | void,
  ): void {
    this.deps.onConfigUpdated = hook
  }

  createAgent(input: {
    owner_id: string
    display_name: string
    avatar_url?: string | null
    model?: string
    persona_seed_code?: string
    owner_style_pins?: OwnerStylePins
  }): Agent {
    const normalized = this.normalizeCreateAgentInput(input)
    return this.deps.agentRepo.create({
      owner_id: normalized.owner_id,
      display_name: normalized.display_name,
      avatar_url: normalized.avatar_url,
      model: normalized.model,
    })
  }

  async createAgentPersisted(input: {
    owner_id: string
    display_name: string
    avatar_url?: string | null
    model?: string
    persona_seed_code?: string
    owner_style_pins?: OwnerStylePins
  }): Promise<Agent> {
    const normalized = this.normalizeCreateAgentInput(input)
    const repoInput = {
      owner_id: normalized.owner_id,
      display_name: normalized.display_name,
      avatar_url: normalized.avatar_url,
      model: normalized.model,
    }

    const agent = this.deps.agentRepo.createPersisted
      ? await this.deps.agentRepo.createPersisted(repoInput)
      : this.deps.agentRepo.create(repoInput)

    const configInput = {
      agent_id: agent.id,
      config_json: buildInitialIdentityConfig({
        personaSeedCode: normalized.persona_seed_code,
        ownerStylePins: normalized.owner_style_pins,
        model: normalized.model,
        selectedAt: agent.created_at,
      }),
      updated_by: normalized.owner_id,
    }

    try {
      if (this.deps.agentConfigRepo.createPersisted) {
        await this.deps.agentConfigRepo.createPersisted(configInput)
      } else {
        this.deps.agentConfigRepo.create(configInput)
      }
    } catch (error) {
      if (this.deps.agentRepo.deletePersisted) {
        try {
          await this.deps.agentRepo.deletePersisted(agent.id)
        } catch (rollbackError) {
          console.error('[AgentService] failed to rollback agent after config create error', rollbackError)
        }
      }
      throw error
    }

    return agent
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

  async updateConfig(
    agentId: string,
    configJson: Record<string, unknown>,
    adminUserId: string,
    review?: Partial<AgentConfigReview>,
  ): Promise<AgentConfig> {
    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) throw new NotFoundError('Agent', agentId)

    const baseRevision = this.deps.agentConfigRepo.findLatestRevision?.(agentId)
      ?? this.deps.agentConfigRepo.findLatest(agentId)
    const effectiveConfig = this.deps.agentConfigRepo.findLatest(agentId)?.config_json ?? {}
    const mergedConfig = mergeConfigJson(baseRevision?.config_json ?? {}, configJson)
    const createInput = {
      agent_id: agentId,
      config_json: sanitizeIdentityConfig(mergedConfig),
      risk_level: review?.risk_level,
      review_status: review?.review_status,
      review_case_id: review?.review_case_id,
      lint_warnings: review?.lint_warnings,
      updated_by: adminUserId,
    }

    const saved = this.deps.agentConfigRepo.createPersisted
      ? await this.deps.agentConfigRepo.createPersisted(createInput)
      : this.deps.agentConfigRepo.create(createInput)

    if (
      this.deps.onConfigUpdated
      && (saved.review_status === 'NOT_REQUIRED' || saved.review_status === 'APPROVED')
    ) {
      Promise.resolve(this.deps.onConfigUpdated({
        agent_id: agentId,
        before_config: effectiveConfig,
        after_config: saved.config_json,
        updated_by: adminUserId,
      })).catch((error) => {
        console.error('[AgentService] config update hook failed:', error)
      })
    }

    return saved
  }

  getLatestConfig(agentId: string): AgentConfig | null {
    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) throw new NotFoundError('Agent', agentId)
    return this.deps.agentConfigRepo.findLatest(agentId)
  }

  getLatestConfigRevision(agentId: string): AgentConfig | null {
    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) throw new NotFoundError('Agent', agentId)
    return this.deps.agentConfigRepo.findLatestRevision?.(agentId)
      ?? this.deps.agentConfigRepo.findLatest(agentId)
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
    persona_seed_code?: string
    owner_style_pins?: OwnerStylePins
  }): {
    owner_id: string
    display_name: string
    avatar_url?: string | null
    model?: string
    persona_seed_code?: string
    owner_style_pins?: OwnerStylePins
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

function mergeConfigJson(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    const existing = merged[key]
    if (isPlainRecord(existing) && isPlainRecord(value)) {
      merged[key] = mergeConfigJson(existing, value)
      continue
    }
    merged[key] = value
  }
  return merged
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
