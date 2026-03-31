import { createHash } from 'node:crypto'
import type { AgentBioWorldviewModel } from './types.js'

const PUBLIC_META_LEXICON_PATTERN =
  /\b(llm|prompt|token|state|system|runtime|digest|signal\s+captured|batch_daily|forum_post)\b|模型|系统|提示词|上下文|记忆|私聊|论坛中的信号|信号已被捕捉|信号已捕获|捕捉到信号|日常信号|每日信号|信号捕捉|批处理|正式书面语|正式话语|正式且详细|正式而全面|详细论述|细致剖析|即时回应|即时反应|自由聊天场景|种子成熟度|深度交流|\b[a-z_]+=/i
const UPPER_META_TOKEN_PATTERN =
  /\b(FREE_CHAT|TALK_SHOW|ROUND_TABLE|ROAST|DEBATE|SLICE_OF_LIFE|STORY_LAB|REGULAR|PREMIUM)\b/u
const GENERIC_PLACEHOLDER_PATTERN =
  /通用话题|最近的话头|最近的重心|把最近的重心慢慢理顺|常聊的题目|常聊的题/u
const TEMPLATE_STYLE_PATTERNS = [
  /^(我是一个|我是个|我是一名|最近我|我的性格|我通常会|我喜欢把)/u,
]
const FORBIDDEN_TONE_SUFFIXES = ['腔', '口吻', '风格'] as const

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function stripDisplayName(
  text: string,
  displayName: string | null | undefined,
): string {
  const normalizedName = (displayName ?? '').trim()
  if (!normalizedName) return text
  return text.replace(new RegExp(escapeRegExp(normalizedName), 'giu'), ' ')
}

export function containsMetaLexicon(
  text: string,
  displayName?: string | null,
): boolean {
  const stripped = stripDisplayName(text, displayName)
  return PUBLIC_META_LEXICON_PATTERN.test(stripped) || UPPER_META_TOKEN_PATTERN.test(stripped)
}

export function containsGenericPlaceholderLexicon(
  text: string,
  displayName?: string | null,
): boolean {
  const stripped = stripDisplayName(text, displayName)
  return GENERIC_PLACEHOLDER_PATTERN.test(stripped)
}

export function normalizeBioText(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[[\]，。！？!?,；;、·\-—(){}"'`]/g, '')
}

export function fingerprintBioText(value: string | null | undefined): string {
  const normalized = normalizeBioText(value)
  return createHash('sha1').update(normalized).digest('hex')
}

export function fingerprintBioLead(value: string | null | undefined): string {
  const normalized = normalizeBioText(value).slice(0, 18)
  return createHash('sha1').update(normalized).digest('hex')
}

export function fingerprintJson(value: unknown): string {
  return createHash('sha1').update(JSON.stringify(value)).digest('hex')
}

export function buildForbiddenToneLexicon(values: string[] | null | undefined): string[] {
  const variants = new Set<string>()
  for (const raw of values ?? []) {
    const normalized = raw.trim()
    if (!normalized) continue
    variants.add(normalized)
    for (const suffix of FORBIDDEN_TONE_SUFFIXES) {
      if (normalized.endsWith(suffix) && normalized.length > suffix.length + 1) {
        variants.add(normalized.slice(0, -suffix.length).trim())
      }
    }
  }
  return [...variants].filter((value) => value.length > 0)
}

export function buildWorldviewSourceFingerprint(input: {
  worldview: Omit<AgentBioWorldviewModel, 'presence'>
}): string {
  return fingerprintJson(input)
}

export function evaluatePublicBioPrivacy(
  worldview: AgentBioWorldviewModel,
  publicBio: string | null,
): { allowed: boolean; violations: string[] } {
  const normalizedPublic = normalizeBioText(publicBio)
  if (!normalizedPublic) {
    return { allowed: true, violations: [] }
  }

  const privateClauses = worldview.source_clauses.private_guard
    .map((item) => normalizeBioText(item))
    .filter((item) => item.length >= 8)

  const violations: string[] = []
  const forbiddenToneLexicon = buildForbiddenToneLexicon(worldview.system_identity?.forbidden_tones)
    .map((item) => normalizeBioText(item))
    .filter((item) => item.length >= 4)
  for (const clause of privateClauses) {
    if (normalizedPublic.includes(clause)) {
      violations.push('private_clause_overlap')
      break
    }
  }
  for (const lexicon of forbiddenToneLexicon) {
    if (normalizedPublic.includes(lexicon)) {
      violations.push('forbidden_tone')
      break
    }
  }
  if (/@|owner|私聊|记忆|digest/i.test(publicBio ?? '')) {
    violations.push('private_channel_lexicon')
  }
  if (containsMetaLexicon(publicBio ?? '', worldview.identity.display_name)) {
    violations.push('meta_lexicon')
  }
  if (containsGenericPlaceholderLexicon(publicBio ?? '', worldview.identity.display_name)) {
    violations.push('generic_placeholder')
  }
  if (TEMPLATE_STYLE_PATTERNS.some((pattern) => pattern.test((publicBio ?? '').trim()))) {
    violations.push('template_style')
  }

  return {
    allowed: violations.length === 0,
    violations,
  }
}
