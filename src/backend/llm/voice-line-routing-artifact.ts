import type {
  RenderTier,
  VoiceLineId,
  VoiceLineRoutingIntent,
} from '../../shared/agent-persona-catalog.js'

export type VoiceLineRoutingArtifact = Partial<
  Record<
    VoiceLineId,
    Partial<Record<VoiceLineRoutingIntent, Partial<Record<RenderTier, string>>>>
  >
>

export interface VoiceLineRoutingProfileLike {
  profile_id: string
  voice_line_id: VoiceLineId
  intent: VoiceLineRoutingIntent
  tier: RenderTier
}

export function buildVoiceLineRoutingArtifact(
  profiles: Iterable<VoiceLineRoutingProfileLike>,
): VoiceLineRoutingArtifact {
  const artifact: VoiceLineRoutingArtifact = {}

  for (const profile of profiles) {
    const lineEntry = artifact[profile.voice_line_id] ?? {}
    const intentEntry = lineEntry[profile.intent] ?? {}
    intentEntry[profile.tier] = profile.profile_id
    lineEntry[profile.intent] = intentEntry
    artifact[profile.voice_line_id] = lineEntry
  }

  return normalizeVoiceLineRoutingArtifact(artifact)
}

export function normalizeVoiceLineRoutingArtifact(
  artifact: VoiceLineRoutingArtifact,
): VoiceLineRoutingArtifact {
  const normalized: VoiceLineRoutingArtifact = {}

  for (const voiceLineId of sortedKeys(artifact)) {
    const intents = artifact[voiceLineId]
    if (!intents) continue

    const normalizedIntents: Partial<
      Record<VoiceLineRoutingIntent, Partial<Record<RenderTier, string>>>
    > = {}

    for (const intent of sortedKeys(intents)) {
      const tiers = intents[intent]
      if (!tiers) continue

      const normalizedTiers: Partial<Record<RenderTier, string>> = {}
      for (const tier of sortedKeys(tiers)) {
        const profileId = tiers[tier]
        if (!profileId) continue
        normalizedTiers[tier] = profileId
      }

      if (Object.keys(normalizedTiers).length > 0) {
        normalizedIntents[intent] = normalizedTiers
      }
    }

    if (Object.keys(normalizedIntents).length > 0) {
      normalized[voiceLineId] = normalizedIntents
    }
  }

  return normalized
}

function sortedKeys<T extends object>(record: T): Array<Extract<keyof T, string>> {
  return Object.keys(record).sort() as Array<Extract<keyof T, string>>
}
