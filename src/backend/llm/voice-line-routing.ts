import {
  type RenderTier,
  type VoiceLineId,
  type VoiceLineRoutingIntent,
} from '../../shared/agent-persona-catalog.js'
import { GENERATED_VOICE_LINE_ROUTING } from './generated/voice-line-routing.generated.js'

const TIER_RESOLUTION_ORDER: Record<RenderTier, RenderTier[]> = {
  lite: ['lite', 'base', 'premium'],
  base: ['base', 'lite', 'premium'],
  premium: ['premium', 'base', 'lite'],
}

export function resolveVoiceLineTierProfileRef(
  voiceLineId: VoiceLineId,
  intent: VoiceLineRoutingIntent,
  tier: RenderTier,
): string | null {
  const tierMap = GENERATED_VOICE_LINE_ROUTING[voiceLineId]?.[intent]
  if (!tierMap) return null

  for (const candidateTier of TIER_RESOLUTION_ORDER[tier]) {
    const profileId = tierMap[candidateTier]
    if (profileId) {
      return profileId
    }
  }

  return null
}

export function resolveIdentityWriteProfileRef(
  voiceLineId: VoiceLineId,
  tier: RenderTier = 'premium',
): string | null {
  const tierMap = GENERATED_VOICE_LINE_ROUTING[voiceLineId]?.identity_write
  if (!tierMap) return null

  for (const candidateTier of TIER_RESOLUTION_ORDER[tier]) {
    const profileId = tierMap[candidateTier]
    if (profileId) {
      return profileId
    }
  }

  return null
}
