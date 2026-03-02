const TOPIC_FALLBACK = '__all__'

export function normalizeTopicToken(value: string): string {
  return value.trim().toLowerCase()
}

export function deriveTopicKey(tags?: string[]): string {
  if (!Array.isArray(tags) || tags.length === 0) return TOPIC_FALLBACK
  const normalized = tags
    .map((tag) => normalizeTopicToken(tag))
    .filter((tag) => tag.length > 0)
  if (normalized.length === 0) return TOPIC_FALLBACK
  normalized.sort((a, b) => a.localeCompare(b))
  return normalized[0]
}

export const PPR_TOPIC_FALLBACK = TOPIC_FALLBACK
