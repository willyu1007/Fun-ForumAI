import type { AgentBioCandidate, BioRhetoricFamily, BioSurface } from './types.js'
import {
  containsGenericPlaceholderLexicon,
  containsMetaLexicon,
  fingerprintBioLead,
  fingerprintBioText,
  normalizeBioText,
} from './fingerprint.js'

const LENGTH_BUDGETS: Record<BioSurface, { min: number; max: number }> = {
  public: { min: 14, max: 96 },
  owner: { min: 20, max: 140 },
  private_header: { min: 12, max: 88 },
}

const TEMPLATE_OPENERS = [
  '我是一个',
  '我是个',
  '我是一名',
  '最近我',
  '我的性格',
  '我通常会',
  '我喜欢把',
] as const

function hasMeaningfulLength(surface: BioSurface, text: string): boolean {
  const normalized = text.trim()
  return normalized.length >= LENGTH_BUDGETS[surface].min
    && normalized.length <= LENGTH_BUDGETS[surface].max
}

export interface RejectBioCandidateContext {
  recentFingerprints: ReadonlySet<string>
  disallowedFamilies?: ReadonlySet<BioRhetoricFamily>
  recentOpeningFingerprints?: ReadonlySet<string>
  agentDisplayName?: string | null
  forbiddenLexicon?: string[]
}

export function rejectBioCandidate(
  candidate: AgentBioCandidate,
  context: RejectBioCandidateContext,
): { rejected: boolean; reasons: string[] } {
  const normalized = normalizeBioText(candidate.text)
  const reasons: string[] = []
  if (!hasMeaningfulLength(candidate.surface, candidate.text)) {
    reasons.push('invalid_length')
  }
  if (normalized.length < 10) {
    reasons.push('too_sparse')
  }
  if (context.recentFingerprints.has(fingerprintBioText(candidate.text))) {
    reasons.push('recent_duplicate')
  }
  if (
    candidate.rhetoric_family
    && context.disallowedFamilies?.has(candidate.rhetoric_family)
  ) {
    reasons.push('recent_family_repeat')
  }
  if (context.recentOpeningFingerprints?.has(fingerprintBioLead(candidate.text))) {
    reasons.push('recent_opening_repeat')
  }
  if (TEMPLATE_OPENERS.some((prefix) => candidate.text.trim().startsWith(prefix))) {
    reasons.push('template_opener')
  }
  if (containsMetaLexicon(candidate.text, context.agentDisplayName)) {
    reasons.push('meta_lexicon')
  }
  if (containsGenericPlaceholderLexicon(candidate.text, context.agentDisplayName)) {
    reasons.push('generic_placeholder')
  }
  const normalizedForbiddenLexicon = (context.forbiddenLexicon ?? [])
    .map((item) => normalizeBioText(item))
    .filter((item) => item.length >= 4)
  if (normalizedForbiddenLexicon.some((item) => normalized.includes(item))) {
    reasons.push('forbidden_tone')
  }
  const parts = candidate.text
    .split(/[，。；、,.!?！？]/)
    .map((item) => normalizeBioText(item))
    .filter(Boolean)
  if (parts.length >= 2 && new Set(parts).size !== parts.length) {
    reasons.push('repeat_phrase')
  }

  return {
    rejected: reasons.length > 0,
    reasons,
  }
}

export function scoreBioCandidate(
  candidate: AgentBioCandidate,
  options: {
    family_weights?: Partial<Record<BioRhetoricFamily, number>>
  } = {},
): AgentBioCandidate {
  const punctuationBonus = /[，。；]/.test(candidate.text) ? 0.04 : 0
  const varietyBonus = new Set(
    candidate.text
      .split(/[，。；、,.!?！？]/)
      .map((item) => normalizeBioText(item))
      .filter(Boolean),
  ).size >= 2
    ? 0.05
    : 0
  const familyBonus = candidate.rhetoric_family
    ? Math.max((options.family_weights?.[candidate.rhetoric_family] ?? 0.4) - 0.35, 0) * 0.35
    : 0
  return {
    ...candidate,
    score: Number((candidate.score + punctuationBonus + varietyBonus + familyBonus).toFixed(3)),
  }
}

export function selectBestBioCandidate(candidates: AgentBioCandidate[]): AgentBioCandidate | null {
  return candidates
    .slice()
    .sort((left, right) => right.score - left.score || right.text.length - left.text.length)[0] ?? null
}
