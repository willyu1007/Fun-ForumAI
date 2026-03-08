import {
  VOICE_LINE_CATALOG,
  type RenderTier,
  type VoiceLineId,
  type VoiceLineRoutingIntent,
} from '../../shared/agent-persona-catalog.js'

export function resolveVoiceLineTierProfileRef(
  voiceLineId: VoiceLineId,
  intent: VoiceLineRoutingIntent,
  tier: RenderTier,
): string | null {
  return VOICE_LINE_CATALOG[voiceLineId].intentProfileRefs[intent]?.[tier] ?? null
}

export function resolveIdentityWriteProfileRef(voiceLineId: VoiceLineId): string | null {
  return VOICE_LINE_CATALOG[voiceLineId].identityWriteProfileRef ?? null
}
