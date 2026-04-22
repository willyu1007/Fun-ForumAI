import type { BiographyChapterBodyV1 } from '../../shared/agent-biography.js'

export interface BiographyGuardrailRule {
  id: string
  pattern: RegExp
  safer_rewrite: string
}

export const BIOGRAPHY_FORBIDDEN_LEXICON_RULES: BiographyGuardrailRule[] = [
  { id: 'persona_label', pattern: /\bpersona\b/giu, safer_rewrite: '表达轮廓' },
  { id: 'persona_zh', pattern: /人设/gu, safer_rewrite: '表达轮廓' },
  { id: 'secret_language', pattern: /秘密/gu, safer_rewrite: '较私密的经历' },
  { id: 'owner_direct', pattern: /owner/giu, safer_rewrite: '相熟的人' },
  { id: 'destiny_language', pattern: /命运|宿命/gu, safer_rewrite: '这一阶段的走向' },
  { id: 'destined_language', pattern: /注定/gu, safer_rewrite: '慢慢' },
  { id: 'real_self', pattern: /真实的(她|他|它|ta|TA|Ta)/gu, safer_rewrite: '后来显露出的样子' },
]

export const BIOGRAPHY_PRIVATE_OVERREACH_RULES: BiographyGuardrailRule[] = [
  { id: 'private_chat', pattern: /私聊/gu, safer_rewrite: '较私密的经历' },
  { id: 'chat_logs', pattern: /聊天记录|原话/gu, safer_rewrite: '较私密的经历' },
  { id: 'session_id', pattern: /session[-_\s]?\w+/giu, safer_rewrite: '较私密的经历' },
]

export const BIOGRAPHY_META_LEAK_RULES: BiographyGuardrailRule[] = [
  { id: 'prompt_meta', pattern: /prompt|提示词/giu, safer_rewrite: '这些内部痕迹' },
  { id: 'model_meta', pattern: /model|模型/giu, safer_rewrite: '这些内部痕迹' },
  { id: 'token_meta', pattern: /token/giu, safer_rewrite: '这些内部痕迹' },
  { id: 'system_meta', pattern: /系统机制|系统提示|runtime/giu, safer_rewrite: '这些内部痕迹' },
]

export const BIOGRAPHY_RELATIONSHIP_OVERREACH_PATTERNS = [
  /恋人/gu,
  /家人/gu,
  /血缘/gu,
  /宿敌/gu,
]

export const BIOGRAPHY_ABSOLUTE_CLAIM_PATTERNS = [
  /永远/gu,
  /从不/gu,
  /唯一/gu,
  /注定/gu,
  /第一次/gu,
]

export const BIOGRAPHY_INVENTED_ABSTRACTION_PATTERNS = [
  /\bpersona\b/giu,
  /人设/gu,
  /真实的(她|他|它|ta|TA|Ta)/gu,
  /隐藏设定/gu,
  /命运|宿命/gu,
]

export interface BiographyRepairResult {
  body: BiographyChapterBodyV1
  applied: boolean
  rule_hits: string[]
}

function clip(value: string, maxLength = 520): string {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) return ''
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength)}…`
}

function stripSentenceEnding(value: string): string {
  return clip(value).replace(/[。！？!?]+$/u, '')
}

function normalizeSentenceCore(value: string): string {
  return stripSentenceEnding(value).replace(/\s+/g, '')
}

function isEquivalentSentence(a: string, b: string): boolean {
  const left = normalizeSentenceCore(a)
  const right = normalizeSentenceCore(b)
  return left.length > 0 && left === right
}

export function splitBiographySentences(value: string): string[] {
  return clip(value, 960)
    .match(/[^。！？!?]+[。！？!?]?/gu)
    ?.map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => /[。！？!?]$/u.test(item) ? item : `${item}。`)
    ?? []
}

function joinBiographySentences(sentences: string[]): string {
  const normalized = sentences
    .map((item) => clip(item))
    .map((item) => /[。！？!?]$/u.test(item) ? item : `${item}。`)
    .filter((item) => item.length > 0)
  return normalized.join('')
}

function applyRuleRewrites(
  value: string,
  rules: BiographyGuardrailRule[],
  ruleHits: string[],
): string {
  let output = value
  for (const rule of rules) {
    rule.pattern.lastIndex = 0
    if (!rule.pattern.test(output)) continue
    rule.pattern.lastIndex = 0
    output = output.replace(rule.pattern, rule.safer_rewrite)
    ruleHits.push(rule.id)
  }
  return output
}

function clampSentenceWindow(input: {
  text: string
  fallbackText: string
  minSentences: number
  maxSentences: number
  rulePrefix: string
}): { text: string; hits: string[] } {
  const hits: string[] = []
  const fallbackSentences = splitBiographySentences(input.fallbackText)
  const seenFallback = new Set<string>()
  let sentences = splitBiographySentences(input.text)

  if (sentences.length > input.maxSentences) {
    sentences = sentences.slice(0, input.maxSentences)
    hits.push(`${input.rulePrefix}:trim_sentences`)
  }

  for (const fallbackSentence of fallbackSentences) {
    if (sentences.length >= input.minSentences) break
    const key = normalizeSentenceCore(fallbackSentence)
    if (!key || seenFallback.has(key) || sentences.some((item) => isEquivalentSentence(item, fallbackSentence))) {
      continue
    }
    seenFallback.add(key)
    sentences.push(fallbackSentence)
    hits.push(`${input.rulePrefix}:pad_sentences`)
  }

  if (sentences.length === 0) {
    sentences = fallbackSentences.slice(0, Math.max(input.minSentences, 1))
    hits.push(`${input.rulePrefix}:reset_to_fallback`)
  }

  return {
    text: joinBiographySentences(sentences.slice(0, input.maxSentences)),
    hits,
  }
}

function repairTextBlock(input: {
  text: string
  fallbackText: string
  minSentences: number
  maxSentences: number
  rulePrefix: string
}): { text: string; hits: string[] } {
  const hits: string[] = []
  let working = clip(input.text, 960)

  working = applyRuleRewrites(working, BIOGRAPHY_FORBIDDEN_LEXICON_RULES, hits)
  working = applyRuleRewrites(working, BIOGRAPHY_PRIVATE_OVERREACH_RULES, hits)
  working = applyRuleRewrites(working, BIOGRAPHY_META_LEAK_RULES, hits)

  if (
    BIOGRAPHY_RELATIONSHIP_OVERREACH_PATTERNS.some((pattern) => {
      pattern.lastIndex = 0
      return pattern.test(working)
    })
    || BIOGRAPHY_INVENTED_ABSTRACTION_PATTERNS.some((pattern) => {
      pattern.lastIndex = 0
      return pattern.test(working)
    })
  ) {
    hits.push(`${input.rulePrefix}:reset_to_fallback`)
    working = input.fallbackText
  }

  const clamped = clampSentenceWindow({
    text: working,
    fallbackText: input.fallbackText,
    minSentences: input.minSentences,
    maxSentences: input.maxSentences,
    rulePrefix: input.rulePrefix,
  })
  return {
    text: clamped.text,
    hits: [...hits, ...clamped.hits],
  }
}

export function repairBiographyChapterBody(input: {
  body: BiographyChapterBodyV1
  fallback: BiographyChapterBodyV1
}): BiographyRepairResult {
  const hits: string[] = []
  const fallback = input.fallback
  const opening = repairTextBlock({
    text: input.body.opening,
    fallbackText: fallback.opening,
    minSentences: 1,
    maxSentences: 2,
    rulePrefix: 'opening',
  })
  hits.push(...opening.hits)

  const existingSections = input.body.body_sections.slice(0, 4)
  if (input.body.body_sections.length > 4) {
    hits.push('body_sections:trim_count')
  }
  const bodySections = existingSections.map((section, index) => {
    const fallbackSection = fallback.body_sections[index] ?? fallback.body_sections[fallback.body_sections.length - 1]
    const repaired = repairTextBlock({
      text: section.text,
      fallbackText: fallbackSection?.text ?? fallback.afterword,
      minSentences: 2,
      maxSentences: 4,
      rulePrefix: `body_section_${index}`,
    })
    hits.push(...repaired.hits)
    return {
      title: section.title ?? fallbackSection?.title,
      text: repaired.text,
      visual_anchor: section.visual_anchor,
    }
  })

  for (let index = bodySections.length; index < 2; index += 1) {
    const fallbackSection = fallback.body_sections[index] ?? fallback.body_sections[fallback.body_sections.length - 1]
    if (!fallbackSection) break
    bodySections.push({
      title: fallbackSection.title,
      text: fallbackSection.text,
      visual_anchor: fallbackSection.visual_anchor,
    })
    hits.push('body_sections:pad_count')
  }

  const turningPoint = (() => {
    const source = input.body.turning_point ?? fallback.turning_point
    if (!source) return undefined
    const fallbackTurning = fallback.turning_point ?? source
    const repaired = repairTextBlock({
      text: source.text,
      fallbackText: fallbackTurning.text,
      minSentences: 1,
      maxSentences: 2,
      rulePrefix: 'turning_point',
    })
    hits.push(...repaired.hits)
    return {
      title: source.title || fallbackTurning.title,
      text: repaired.text,
    }
  })()

  const afterword = repairTextBlock({
    text: input.body.afterword,
    fallbackText: fallback.afterword,
    minSentences: 1,
    maxSentences: 2,
    rulePrefix: 'afterword',
  })
  hits.push(...afterword.hits)

  const closingLine = repairTextBlock({
    text: input.body.closing_line,
    fallbackText: fallback.closing_line,
    minSentences: 1,
    maxSentences: 1,
    rulePrefix: 'closing_line',
  })
  hits.push(...closingLine.hits)

  const traceText = repairTextBlock({
    text: input.body.trace_text,
    fallbackText: fallback.trace_text,
    minSentences: 1,
    maxSentences: 2,
    rulePrefix: 'trace_text',
  })
  hits.push(...traceText.hits)

  const fallbackMarginNotes = fallback.margin_notes ?? []
  const seenNotes = new Set<string>()
  const marginNotes = (input.body.margin_notes ?? [])
    .map((note, index) => {
      const fallbackNote = fallbackMarginNotes[index] ?? fallbackMarginNotes[fallbackMarginNotes.length - 1]
      const repaired = repairTextBlock({
        text: note.text,
        fallbackText: fallbackNote?.text ?? fallback.trace_text,
        minSentences: 1,
        maxSentences: 2,
        rulePrefix: `margin_note_${index}`,
      })
      hits.push(...repaired.hits)
      return {
        anchor_section_index: Math.max(0, Math.min(note.anchor_section_index, Math.max(bodySections.length - 1, 0))),
        text: repaired.text,
      }
    })
    .filter((note) => {
      const key = normalizeSentenceCore(note.text)
      if (!key || seenNotes.has(key)) {
        hits.push('margin_notes:dedupe')
        return false
      }
      seenNotes.add(key)
      return true
    })
    .slice(0, 2)

  if ((input.body.margin_notes ?? []).length > 2) {
    hits.push('margin_notes:trim_count')
  }

  const repairedBody: BiographyChapterBodyV1 = {
    chapter_title: input.body.chapter_title || fallback.chapter_title,
    chapter_subtitle: input.body.chapter_subtitle || fallback.chapter_subtitle,
    epigraph: (() => {
      if (!input.body.epigraph && !fallback.epigraph) return undefined
      const repaired = repairTextBlock({
        text: input.body.epigraph ?? fallback.epigraph ?? '',
        fallbackText: fallback.epigraph ?? fallback.opening,
        minSentences: 1,
        maxSentences: 1,
        rulePrefix: 'epigraph',
      })
      hits.push(...repaired.hits)
      return repaired.text
    })(),
    opening: opening.text,
    body_sections: bodySections,
    turning_point: turningPoint,
    afterword: afterword.text,
    closing_line: closingLine.text,
    trace_text: traceText.text,
    margin_notes: marginNotes.length > 0 ? marginNotes : undefined,
  }

  return {
    body: repairedBody,
    applied: hits.length > 0 || JSON.stringify(repairedBody) !== JSON.stringify(input.body),
    rule_hits: Array.from(new Set(hits)),
  }
}
