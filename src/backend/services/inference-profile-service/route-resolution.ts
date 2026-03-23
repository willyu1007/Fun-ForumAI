import type { RenderTier, VoiceLineId } from '../../../shared/agent-persona-catalog.js'
import { resolvePreferredVisibleModelId } from '../../llm/model-preference.js'
import type {
  AgentInferenceProfile,
  InferenceProfileSnapshot,
  InferenceRouteDecision,
} from '../../runtime/inference-profile-types.js'
import { maxRenderTier } from './compile.js'

export function buildVisibleRouteDecision(input: {
  requestedTier: RenderTier
  requestedTierFloor: RenderTier | null
  homeVoiceLineId: VoiceLineId
  agentModel: string | null | undefined
  envVisibleModelPin?: string | null
  visibleModelPin: string | null
  profile: AgentInferenceProfile
  snapshot: InferenceProfileSnapshot
}): InferenceRouteDecision {
  const preferredModelId =
    (input.envVisibleModelPin?.trim() || null) ??
    input.visibleModelPin ??
    resolvePreferredVisibleModelId(input.agentModel ?? null, input.homeVoiceLineId)

  return {
    homeVoiceLineId: input.homeVoiceLineId,
    preferredModelId: preferredModelId ?? undefined,
    requestedTier: maxRenderTier(input.requestedTier, input.requestedTierFloor),
    profile: input.profile,
    snapshot: input.snapshot,
  }
}
