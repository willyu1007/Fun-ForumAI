import { DefaultMemoryPackRenderer, DefaultRetrievalPacker } from '../context-memory/memory-pack.js'
import type {
  AgentMemory,
  AgentPrivacySettingsEntity,
  ContextMemoryScene,
  PaginatedResult,
} from '../repos/types.js'
import { getMemoriesForContext as getMemoriesForContextImpl } from './memory-service/context-retrieval.js'
import { generateDigest as generateDigestImpl } from './memory-service/digest-pipeline.js'
import { decayAndForget as decayAndForgetImpl } from './memory-service/maintenance-runner.js'
import {
  cleanupPrivateMediaMemory as cleanupPrivateMediaMemoryImpl,
  createPrivateMediaMemory as createPrivateMediaMemoryImpl,
} from './memory-service/private-media.js'
import {
  getPrivacySettings as getPrivacySettingsImpl,
  resolveEffectiveDisclosureLevel as resolveEffectiveDisclosureLevelImpl,
  updatePrivacySettings as updatePrivacySettingsImpl,
} from './memory-service/privacy-policy.js'
import {
  createPublicObservationMemory as createPublicObservationMemoryImpl,
  getLatestTypedPublicObservationAt as getLatestTypedPublicObservationAtImpl,
  hasTypedPublicObservationEvent as hasTypedPublicObservationEventImpl,
} from './memory-service/public-observation.js'
import type {
  DigestHook,
  GetMemoriesForContextOptions,
  ListMemoriesOptions,
  MemoryForContext,
  MemoryServiceDeps,
  MemoryServiceState,
  PrivateMediaMemoryInput,
  PublicObservationMemoryInput,
} from './memory-service/types.js'

export type {
  ContextMemoryRuntimeDeps,
  MemoryForContext,
  MemoryServiceDeps,
} from './memory-service/types.js'

export class MemoryService {
  private readonly state: MemoryServiceState
  private digestHooks: DigestHook[]

  constructor(private readonly deps: MemoryServiceDeps) {
    this.digestHooks = deps.onDigestCompleted ? [deps.onDigestCompleted] : []
    this.state = {
      retrievalPacker: new DefaultRetrievalPacker(),
      memoryPackRenderer: new DefaultMemoryPackRenderer(),
      getDigestHooks: () => this.digestHooks,
    }
  }

  setDigestHook(hook: DigestHook): void {
    this.digestHooks = [hook]
  }

  appendDigestHook(hook: DigestHook): void {
    this.digestHooks.push(hook)
  }

  async generateDigest(sessionId: string): Promise<AgentMemory | null> {
    return generateDigestImpl(this.deps, this.state, sessionId)
  }

  async getMemoriesForContext(
    agentId: string,
    opts: GetMemoriesForContextOptions,
  ): Promise<MemoryForContext> {
    return getMemoriesForContextImpl(this.deps, this.state, agentId, opts)
  }

  async listMemories(
    agentId: string,
    opts: ListMemoriesOptions,
  ): Promise<PaginatedResult<AgentMemory>> {
    return this.deps.memoryRepo.listMemories(agentId, opts)
  }

  async createPublicObservationMemory(input: PublicObservationMemoryInput): Promise<AgentMemory> {
    return createPublicObservationMemoryImpl(this.deps, input)
  }

  async createPrivateMediaMemory(input: PrivateMediaMemoryInput): Promise<AgentMemory> {
    return createPrivateMediaMemoryImpl(this.deps, input)
  }

  async cleanupPrivateMediaMemory(input: {
    agent_id: string
    message_id: string
    asset_ids: string[]
  }): Promise<void> {
    return cleanupPrivateMediaMemoryImpl(this.deps, input)
  }

  async getPrivacySettings(agentId: string): Promise<AgentPrivacySettingsEntity> {
    return getPrivacySettingsImpl(this.deps, agentId)
  }

  async updatePrivacySettings(
    agentId: string,
    updatedBy: string,
    changes: {
      disclosure_level?: number
      public_memory_budget?: number
      public_memory_top_k?: number
      public_disclosure_cap?: number | null
    },
  ): Promise<AgentPrivacySettingsEntity> {
    return updatePrivacySettingsImpl(this.deps, agentId, updatedBy, changes)
  }

  resolveEffectiveDisclosureLevel(settings: AgentPrivacySettingsEntity): {
    requested_disclosure_level: number
    effective_disclosure_level: number
    cap_source: 'owner_setting' | 'server_cap'
    public_disclosure_cap: number | null
    server_cap_sources?: Array<{
      source_type: 'baseline'
      scope_type: 'agent'
      scope_id: string | null
      cap_level: number
      source: 'agent_privacy_settings'
    }>
  } {
    return resolveEffectiveDisclosureLevelImpl(settings)
  }

  async decayAndForget(agentId: string): Promise<{ decayed: number; forgotten: number }> {
    return decayAndForgetImpl(this.deps, agentId)
  }

  async hasTypedPublicObservationEvent(
    agentId: string,
    input: { scene: Extract<ContextMemoryScene, 'forum' | 'chat_room'>; sourceEventId: string },
  ): Promise<boolean> {
    return hasTypedPublicObservationEventImpl(this.deps, agentId, input)
  }

  async getLatestTypedPublicObservationAt(
    agentId: string,
    input: { scene: Extract<ContextMemoryScene, 'forum' | 'chat_room'>; sourceRefId: string },
  ): Promise<Date | null> {
    return getLatestTypedPublicObservationAtImpl(this.deps, agentId, input)
  }
}
