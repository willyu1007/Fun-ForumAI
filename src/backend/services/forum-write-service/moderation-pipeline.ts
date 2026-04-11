import type { ModerationResult } from '../../moderation/types.js'
import { config } from '../../lib/config.js'
import type { StageSpecV1 } from '../../stage/index.js'
import type { PolicyGatewayResult } from '../policy-gateway-service.js'

export function resolveStricterVisibility(
  current: ModerationResult['visibility'],
  override: ModerationResult['visibility'] | null | undefined,
): ModerationResult['visibility'] {
  if (!override) return current
  const priority: Record<ModerationResult['visibility'], number> = {
    PUBLIC: 0,
    GRAY: 1,
    QUARANTINE: 2,
  }
  return priority[override] > priority[current] ? override : current
}

export function resolveStricterState(
  current: ModerationResult['state'],
  override: ModerationResult['state'] | null | undefined,
): ModerationResult['state'] {
  if (!override) return current
  const priority: Record<ModerationResult['state'], number> = {
    APPROVED: 0,
    PENDING: 1,
    REJECTED: 2,
  }
  return priority[override] > priority[current] ? override : current
}

export function deriveVerdictFromState(
  visibility: ModerationResult['visibility'],
  state: ModerationResult['state'],
): ModerationResult['verdict'] {
  if (state === 'REJECTED') return 'REJECT'
  if (visibility === 'QUARANTINE' || state === 'PENDING') return 'QUARANTINE'
  if (visibility === 'GRAY') return 'FOLD'
  return 'APPROVE'
}

export function applyPolicyDecisionToModeration(
  moderation: ModerationResult,
  gatewayDecision: Pick<PolicyGatewayResult, 'visibility_override' | 'state_override'> | null,
): ModerationResult {
  if (!gatewayDecision) return moderation
  const visibility = resolveStricterVisibility(
    moderation.visibility,
    gatewayDecision.visibility_override,
  )
  const state = resolveStricterState(moderation.state, gatewayDecision.state_override)
  if (visibility === moderation.visibility && state === moderation.state) return moderation

  return {
    ...moderation,
    visibility,
    state,
    verdict: deriveVerdictFromState(visibility, state),
    details: {
      ...moderation.details,
      decision_reason: `${moderation.details.decision_reason}; policy_gateway_distribution_override`,
    },
  }
}

export function applyPremodOverride(
  modResult: ModerationResult,
  stageSpec: StageSpecV1,
  opts: { is_longform: boolean },
): ModerationResult {
  if (!config.launch.capabilities.stageGovernanceV1) return modResult
  if (!stageSpec.strict_publication.enabled || !stageSpec.strict_publication.premod_required) return modResult
  if (!opts.is_longform) return modResult
  if (modResult.state === 'PENDING') return modResult

  return {
    ...modResult,
    visibility: modResult.visibility === 'PUBLIC' ? 'GRAY' : modResult.visibility,
    state: 'PENDING',
    verdict: modResult.verdict === 'APPROVE' ? 'FOLD' : modResult.verdict,
    details: {
      ...modResult.details,
      decision_reason: `${modResult.details.decision_reason}; strict_publication_premod_override`,
    },
  }
}

export function resolveModerationThresholds(stageSpec: StageSpecV1): {
  low_max_score: number
  medium_max_score: number
  auto_reject_score: number
} | undefined {
  if (!config.launch.capabilities.stageGovernanceV1) return undefined
  const moderation = stageSpec.moderation as Record<string, unknown> | undefined
  const thresholdsRaw = moderation?.thresholds
  if (!thresholdsRaw || typeof thresholdsRaw !== 'object' || Array.isArray(thresholdsRaw)) {
    return undefined
  }

  const raw = thresholdsRaw as Record<string, unknown>
  const lowMax = Number(raw.low_max_score)
  const mediumMax = Number(raw.medium_max_score)
  const autoReject = Number(raw.auto_reject_score)
  if (!Number.isFinite(lowMax) || !Number.isFinite(mediumMax) || !Number.isFinite(autoReject)) {
    return undefined
  }

  return {
    low_max_score: lowMax,
    medium_max_score: mediumMax,
    auto_reject_score: autoReject,
  }
}
