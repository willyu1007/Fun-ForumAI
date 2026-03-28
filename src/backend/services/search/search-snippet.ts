import type { SearchHighlight, SearchMatchReasonCode } from '../../../shared/public-search.js'

interface MatchField {
  label?: string
  reason?: string
  code: SearchMatchReasonCode
  field?: string
  value: string | null | undefined
}

const MIN_FIELD_REASON_STRENGTH = 0.5

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function stripMarkdownFormatting(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\(([^)]*)\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]*)\)/g, '$1')
    .replace(/```(?:[\w-]+)?\s*\n?[\s\S]*?```/g, ' ')
    .replace(/~~~(?:[\w-]+)?\s*\n?[\s\S]*?~~~/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(^|\n)\s{0,3}#{1,6}\s+/g, '$1')
    .replace(/(^|\n)\s{0,3}>\s?/g, '$1')
    .replace(/(^|\n)\s{0,3}(?:[*+-]|\d+\.)\s+/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/<[^>]+>/g, ' ')
}

function normalizeMatchValue(value: string): string {
  return toSearchPreviewText(value).toLowerCase()
}

export function toSearchPreviewText(value: string | null | undefined): string {
  return normalizeWhitespace(stripMarkdownFormatting(value ?? ''))
}

export function buildPreviewSource(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => toSearchPreviewText(part))
    .filter((part) => part.length > 0)
    .join(' · ')
}

function estimateMatchStrength(normalizedValue: string, normalizedQuery: string): number {
  if (!normalizedValue || !normalizedQuery) return 0
  if (normalizedValue.includes(normalizedQuery)) return 1

  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean)
  if (queryTokens.length > 1) {
    const tokenHits = queryTokens.filter((token) => normalizedValue.includes(token)).length
    if (tokenHits > 0) {
      return Number((tokenHits / queryTokens.length).toFixed(4))
    }
  }

  const uniqueChars = Array.from(new Set(Array.from(normalizedQuery).filter((char) => char.trim().length > 0)))
  if (uniqueChars.length === 0) return 0
  const charHits = uniqueChars.filter((char) => normalizedValue.includes(char)).length
  return Number((charHits / uniqueChars.length).toFixed(4))
}

export function buildSnippet(
  text: string | null | undefined,
  query: string,
  maxLength = 140,
): string {
  const normalizedText = toSearchPreviewText(text)
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

export function buildMatchPresentation(
  query: string,
  fields: MatchField[],
  options?: { fallback_text?: string | null | undefined },
): {
  match_reasons: string[]
  match_reason_codes: SearchMatchReasonCode[]
  highlights: SearchHighlight[]
} {
  if (!query) {
    return {
      match_reasons: [],
      match_reason_codes: [],
      highlights: [],
    }
  }

  const normalizedQuery = normalizeMatchValue(query)
  const candidates = fields
    .filter((field) => typeof field.value === 'string' && field.value.trim().length > 0)
    .map((field) => {
      const normalizedValue = normalizeMatchValue(field.value!)
      const strength = estimateMatchStrength(normalizedValue, normalizedQuery)
      const direct = normalizedValue.includes(normalizedQuery)
      return {
        ...field,
        direct,
        strength,
      }
    })
    .filter((field) => field.direct || field.strength >= MIN_FIELD_REASON_STRENGTH)
    .sort((a, b) => Number(b.direct) - Number(a.direct) || b.strength - a.strength || (a.field ?? a.code).localeCompare(b.field ?? b.code))

  if (candidates.length === 0) {
    return {
      match_reasons: ['文本相关'],
      match_reason_codes: ['fuzzy_relevance'],
      highlights: options?.fallback_text
        ? [{ field: 'text', snippet: buildSnippet(options.fallback_text, query) }]
        : [],
    }
  }

  const selected = candidates.slice(0, 3)
  return {
    match_reasons: Array.from(new Set(selected.map((field) => field.reason ?? `${field.label ?? '文本'}命中`))).slice(0, 3),
    match_reason_codes: Array.from(new Set(selected.map((field) => field.code))).slice(0, 3),
    highlights: selected.map((field) => ({
      field: field.field ?? field.code,
      snippet: buildSnippet(field.value, query),
    })),
  }
}

export function buildMatchReasons(query: string, fields: MatchField[]): string[] {
  return buildMatchPresentation(query, fields).match_reasons
}
