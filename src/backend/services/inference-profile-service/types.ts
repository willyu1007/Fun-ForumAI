import type { RenderTier } from '../../../shared/agent-persona-catalog.js'
import type { UsageLedgerRepository } from '../../llm/usage-ledger.js'
import type { PersonaStateRepository } from '../../repos/persona-state-repository.js'
import type { StatsRepository } from '../../repos/stats-repository.js'
import type {
  AgentInferenceProfile,
  AgentInferenceShadowReview,
  InferenceProfileSnapshot,
  OwnerPersonalityNarrative,
} from '../../runtime/inference-profile-types.js'
import type { AgentService } from '../agent-service.js'
import type { PersonaStateService } from '../persona-state-service.js'
import type { ReviewService } from '../review-service.js'
import type { StatsService } from '../stats-service.js'
import type { XpService } from '../xp-service.js'

export interface InferenceProfileServiceDeps {
  agentService: AgentService
  statsService: StatsService
  statsRepo: StatsRepository
  personaStateService: PersonaStateService
  personaStateRepo: PersonaStateRepository
  usageLedgerRepo?: UsageLedgerRepository | null
  reviewService?: ReviewService | null
  xpService?: XpService | null
}

export interface InferenceProfileStatsOverride {
  sociability: number
  curiosity: number
  assertiveness: number
  empathy: number
  brashness: number
  cynicism: number
  stubbornness: number
  volatility: number
  memory: number
  learning: number
}

export interface InferenceProfileEvaluationOptions {
  persist: boolean
  statsOverride?: InferenceProfileStatsOverride
}

export interface InferenceProfileEvaluationResult {
  profile: AgentInferenceProfile
  snapshot: InferenceProfileSnapshot
  narrative: OwnerPersonalityNarrative
  shadowReview: AgentInferenceShadowReview | null
}

export interface ResolveVisibleRouteInput {
  agentId: string
  requestedTier: RenderTier
}

export type StoredInferenceShadowReview = Awaited<
  ReturnType<PersonaStateRepository['findLatestInferenceShadowReview']>
>
