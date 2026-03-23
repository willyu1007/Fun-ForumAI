import type { RenderTier } from '../../shared/agent-persona-catalog.js'
import type { RenderTierDecisionInputs, RenderTierDecisionResult } from './persona-runtime-types.js'

const RENDER_TIER_ORDER: RenderTier[] = ['lite', 'base', 'premium']

export function decideRenderTier(inputs: RenderTierDecisionInputs): RenderTierDecisionResult {
  const reasons: string[] = []
  const tiers: RenderTier[] = [
    intentFloor(inputs.scene, reasons),
    maturityFloor(inputs.maturity, reasons),
    overlayFloor(inputs.overlay?.code, inputs.overlay?.critical ?? false, reasons),
    qualityGuardFloor(inputs.qualityGuard?.recentDriftScore ?? 0, inputs.qualityGuard?.recentFailures ?? 0, reasons),
  ]

  const requestedTier = tiers.reduce<RenderTier>((current, next) => {
    return tierRank(next) > tierRank(current) ? next : current
  }, 'lite')

  if (reasons.length === 0) {
    reasons.push('default_floor')
  }

  return {
    scene: inputs.scene,
    requestedTier,
    reasons,
    ...(inputs.overlay ? { overlayCode: inputs.overlay.code } : {}),
  }
}

function intentFloor(scene: RenderTierDecisionInputs['scene'], reasons: string[]): RenderTier {
  switch (scene) {
    case 'chat_room':
      reasons.push('intent_floor_chat_room_lite')
      return 'lite'
    case 'forum_thread':
    case 'forum_turn':
    case 'forum_post':
    case 'private_chat':
    case 'proactive_dm':
    case 'scheduled_post':
      reasons.push(`intent_floor_${scene}_base`)
      return 'base'
  }
}

function maturityFloor(maturity: RenderTierDecisionInputs['maturity'], reasons: string[]): RenderTier {
  switch (maturity) {
    case 'stable':
      reasons.push('maturity_floor_stable_lite')
      return 'lite'
    case 'arc_shift':
      reasons.push('maturity_floor_arc_shift_premium')
      return 'premium'
    case 'seed':
    case 'forming':
      reasons.push(`maturity_floor_${maturity}_base`)
      return 'base'
  }
}

function overlayFloor(
  overlayCode: string | undefined,
  critical: boolean,
  reasons: string[],
): RenderTier {
  if (!overlayCode) return 'lite'
  if (critical) {
    reasons.push(`overlay_floor_${overlayCode}_premium`)
    return 'premium'
  }
  if (overlayCode === 'guarded' || overlayCode === 'slightly_irritable' || overlayCode === 'overconfident') {
    reasons.push(`overlay_floor_${overlayCode}_base`)
    return 'base'
  }
  reasons.push(`overlay_floor_${overlayCode}_lite`)
  return 'lite'
}

function qualityGuardFloor(
  recentDriftScore: number,
  recentFailures: number,
  reasons: string[],
): RenderTier {
  if (recentFailures > 0 || recentDriftScore >= 70) {
    reasons.push('quality_guard_premium')
    return 'premium'
  }
  if (recentDriftScore >= 45) {
    reasons.push('quality_guard_base')
    return 'base'
  }
  return 'lite'
}

function tierRank(tier: RenderTier): number {
  return RENDER_TIER_ORDER.indexOf(tier)
}
