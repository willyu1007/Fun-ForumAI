import type { RenderTier } from '../../shared/agent-persona-catalog.js'
import {
  type AgentInferenceProfile,
  type AgentInferenceShadowReview,
  type InferenceProfileSnapshot,
  type InferenceRouteDecision,
  type OwnerPersonalityNarrative,
} from '../runtime/inference-profile-types.js'
import {
  approveShadow,
  blockChallenger,
  collectShadowReview,
  resolveInferenceVisibleRoute,
  setManualVoiceLineLock,
  startShadowReview,
} from './inference-profile-service/commands.js'
import { evaluateInferenceProfile } from './inference-profile-service/evaluation.js'
import type {
  InferenceProfileEvaluationResult,
  InferenceProfileServiceDeps,
  InferenceProfileStatsOverride,
} from './inference-profile-service/types.js'
import type { XpService } from './xp-service.js'

export type { InferenceProfileServiceDeps } from './inference-profile-service/types.js'

export class InferenceProfileService {
  constructor(private readonly deps: InferenceProfileServiceDeps) {}

  setXpService(xpService: XpService | null): void {
    ;(this.deps as { xpService?: XpService | null }).xpService = xpService ?? null
  }

  async getProfile(agentId: string): Promise<AgentInferenceProfile> {
    const compiled = await this.evaluate(agentId, { persist: false })
    return compiled.profile
  }

  async getNarrative(agentId: string): Promise<OwnerPersonalityNarrative> {
    const compiled = await this.evaluate(agentId, { persist: false })
    return compiled.narrative
  }

  async getDebug(agentId: string): Promise<{
    profile: AgentInferenceProfile
    snapshot: InferenceProfileSnapshot
    narrative: OwnerPersonalityNarrative
    shadowReview: AgentInferenceShadowReview | null
  }> {
    return this.evaluate(agentId, { persist: false })
  }

  async previewNarrative(
    agentId: string,
    nextStats: InferenceProfileStatsOverride,
  ): Promise<OwnerPersonalityNarrative> {
    const compiled = await this.evaluate(agentId, {
      persist: false,
      statsOverride: nextStats,
    })
    return compiled.narrative
  }

  async compile(agentId: string): Promise<{
    profile: AgentInferenceProfile
    snapshot: InferenceProfileSnapshot
    narrative: OwnerPersonalityNarrative
    shadowReview: AgentInferenceShadowReview | null
  }> {
    return this.evaluate(agentId, { persist: true })
  }

  private evaluate(
    agentId: string,
    opts: {
      persist: boolean
      statsOverride?: InferenceProfileStatsOverride
    },
  ): Promise<InferenceProfileEvaluationResult> {
    return evaluateInferenceProfile(this.deps, agentId, opts)
  }

  async resolveVisibleRoute(input: {
    agentId: string
    requestedTier: RenderTier
    requestedTierCeiling?: RenderTier
  }): Promise<InferenceRouteDecision> {
    return resolveInferenceVisibleRoute(this.deps, input)
  }

  async approveShadow(agentId: string, updatedBy: string): Promise<AgentInferenceProfile> {
    return approveShadow(this.deps, agentId, updatedBy)
  }

  async startShadowReview(
    agentId: string,
    actorUserId = 'system',
  ): Promise<AgentInferenceShadowReview> {
    return startShadowReview(this.deps, agentId, actorUserId)
  }

  async collectShadowReview(
    agentId: string,
    actorUserId = 'system',
  ): Promise<AgentInferenceShadowReview> {
    return collectShadowReview(this.deps, agentId, actorUserId)
  }

  async setManualVoiceLineLock(
    agentId: string,
    locked: boolean,
    actorUserId = 'system',
  ): Promise<AgentInferenceProfile> {
    return setManualVoiceLineLock(this.deps, agentId, locked, actorUserId)
  }

  async blockChallenger(agentId: string, actorUserId = 'system'): Promise<AgentInferenceProfile> {
    return blockChallenger(this.deps, agentId, actorUserId)
  }
}
