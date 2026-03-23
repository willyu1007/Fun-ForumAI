interface MatchField {
  label?: string
  reason?: string
  value: string | null | undefined
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function buildSnippet(
  text: string | null | undefined,
  query: string,
  maxLength = 140,
): string {
  const normalizedText = normalizeWhitespace(text ?? '')
  if (!normalizedText) return ''
  if (!query || normalizedText.length <= maxLength) {
    return normalizedText.slice(0, maxLength)
  }

  const lowerText = normalizedText.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const hitIndex = lowerText.indexOf(lowerQuery)
  if (hitIndex < 0) {
    return normalizedText.slice(0, maxLength)
  }

  const start = Math.max(0, hitIndex - Math.floor(maxLength * 0.35))
  const end = Math.min(normalizedText.length, start + maxLength)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < normalizedText.length ? '…' : ''
  return `${prefix}${normalizedText.slice(start, end)}${suffix}`
}

export function buildMatchReasons(query: string, fields: MatchField[]): string[] {
  if (!query) return []
  const normalizedQuery = query.toLowerCase()
  const reasons = fields
    .filter((field) => typeof field.value === 'string' && field.value.trim().length > 0)
    .filter((field) => field.value!.toLowerCase().includes(normalizedQuery))
    .map((field) => field.reason ?? `${field.label ?? '文本'}命中`)

  if (reasons.length > 0) {
    return Array.from(new Set(reasons)).slice(0, 3)
  }
  return ['文本相关']
}
