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
  requestedTierCeiling?: RenderTier
  homeVoiceLineId: VoiceLineId
  agentModel: string | null | undefined
  profile: AgentInferenceProfile
  snapshot: InferenceProfileSnapshot
}): InferenceRouteDecision {
  const preferredModelId = resolvePreferredVisibleModelId(
    input.agentModel ?? null,
    input.homeVoiceLineId,
  )

  return {
    homeVoiceLineId: input.homeVoiceLineId,
    preferredModelId: preferredModelId ?? undefined,
    requestedTier: clampRenderTier(
      input.requestedTier,
      input.requestedTierFloor,
      input.requestedTierCeiling,
    ),
    profile: input.profile,
    snapshot: input.snapshot,
  }
}

function clampRenderTier(
  requestedTier: RenderTier,
  requestedTierFloor: RenderTier | null,
  requestedTierCeiling?: RenderTier,
): RenderTier {
  const order: RenderTier[] = ['lite', 'base', 'premium']
  const flooredTier = maxRenderTier(requestedTier, requestedTierFloor)
  if (!requestedTierCeiling) {
    return flooredTier
  }
  return order[Math.min(order.indexOf(flooredTier), order.indexOf(requestedTierCeiling))]
}
