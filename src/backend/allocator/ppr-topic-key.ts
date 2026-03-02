const TOPIC_FALLBACK = '__all__'

export function normalizeTopicToken(value: string): string {
  return value.trim().toLowerCase()
}

export function deriveTopicKey(tags?: string[]): string {
  const weighted = deriveTopicWeights(tags)
  if (weighted.size === 0) return TOPIC_FALLBACK

  return Array.from(weighted.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]
}

export const PPR_TOPIC_FALLBACK = TOPIC_FALLBACK

export function deriveTopicWeights(tags?: string[]): Map<string, number> {
  if (!Array.isArray(tags) || tags.length === 0) return new Map()

  const weights = new Map<string, number>()
  for (let i = 0; i < tags.length; i += 1) {
    const token = normalizeTopicToken(tags[i])
    if (!token) continue
    const positionWeight = 1 / (i + 1)
    weights.set(token, (weights.get(token) ?? 0) + positionWeight)
  }

  return weights
}
