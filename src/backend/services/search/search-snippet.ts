import type {
  SearchHighlight,
  SearchMatchExplanation,
  SearchMatchExplanationKind,
  SearchMatchReasonCode,
} from '../../../shared/public-search.js'

interface MatchField {
  label?: string
  reason?: string
  code: SearchMatchReasonCode
  kind?: SearchMatchExplanationKind
  chip?: string
  field?: string
  value: string | null | undefined
}

const MIN_FIELD_REASON_STRENGTH = 0.5
const META_PREVIEW_PATTERN =
  /\b(llm|prompt|token|state|system|runtime|digest|signal\s+captured|batch_daily|forum_post)\b|模型|系统|提示词|上下文|记忆|私聊|论坛中的信号|信号已被捕捉|信号已捕获|捕捉到信号|日常信号|每日信号|信号捕捉|批处理|正式书面语|正式话语|正式且详细|正式而全面|详细论述|细致剖析|即时回应|即时反应|自由聊天场景|种子成熟度|深度交流|\b[a-z_]+=/i
const UPPER_META_TOKEN_PATTERN =
  /\b(FREE_CHAT|TALK_SHOW|ROUND_TABLE|ROAST|DEBATE|SLICE_OF_LIFE|STORY_LAB|REGULAR|PREMIUM)\b/u
const GENERIC_PLACEHOLDER_PATTERN =
  /通用话题|最近的话头|最近的重心|把最近的重心慢慢理顺|常聊的题目|常聊的题/u

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

function sanitizeSearchPreviewPart(value: string | null | undefined): string {
  const normalized = toSearchPreviewText(value)
  if (!normalized) return ''
  if (META_PREVIEW_PATTERN.test(normalized) || UPPER_META_TOKEN_PATTERN.test(normalized)) {
    return ''
  }
  if (GENERIC_PLACEHOLDER_PATTERN.test(normalized)) {
    return ''
  }
  return normalized
}

export function buildPreviewSource(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => sanitizeSearchPreviewPart(part))
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
  match_explanations: SearchMatchExplanation[]
  match_reasons: string[]
  match_reason_codes: SearchMatchReasonCode[]
  highlights: SearchHighlight[]
} {
  if (!query) {
    return {
      match_explanations: [],
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
    const explanation: SearchMatchExplanation = {
      code: 'fuzzy_relevance',
      label: '文本相关',
      kind: 'lexical',
    }
    return {
      match_explanations: [explanation],
      match_reasons: [explanation.label],
      match_reason_codes: [explanation.code],
      highlights: options?.fallback_text
        ? [{ field: 'text', snippet: buildSnippet(options.fallback_text, query) }]
        : [],
    }
  }

  const selected = candidates.slice(0, 3)
  const explanations = Array.from(new Map(
    selected.map((field) => {
      const explanation: SearchMatchExplanation = {
        code: field.code,
        label: field.reason ?? field.label ?? `${field.field ?? field.code}命中`,
        kind: field.kind ?? 'lexical',
        ...(field.chip ? { chip: field.chip } : {}),
      }
      return [`${explanation.code}:${explanation.label}:${explanation.kind}:${explanation.chip ?? ''}`, explanation]
    }),
  ).values()).slice(0, 3)
  return {
    match_explanations: explanations,
    match_reasons: explanations.map((field) => field.label),
    match_reason_codes: explanations.map((field) => field.code),
    highlights: selected.map((field) => ({
      field: field.field ?? field.code,
      snippet: buildSnippet(field.value, query),
    })),
  }
}

export function buildMatchReasons(query: string, fields: MatchField[]): string[] {
  return buildMatchPresentation(query, fields).match_reasons
}
