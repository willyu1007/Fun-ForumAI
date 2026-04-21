import type {
  BiographyChapterBodyV1,
  BiographyFactualAudit,
  BiographyWriterInput,
} from '../../shared/agent-biography.js'
import {
  BIOGRAPHY_ABSOLUTE_CLAIM_PATTERNS,
  BIOGRAPHY_FORBIDDEN_LEXICON_RULES,
  BIOGRAPHY_INVENTED_ABSTRACTION_PATTERNS,
  BIOGRAPHY_PRIVATE_OVERREACH_RULES,
  BIOGRAPHY_RELATIONSHIP_OVERREACH_PATTERNS,
  splitBiographySentences,
} from './biography-writer-guardrails.js'

function collectBodyText(body: BiographyChapterBodyV1): string[] {
  return [
    body.opening,
    ...body.body_sections.map((section) => section.text),
    body.turning_point?.text ?? '',
    body.afterword,
    body.closing_line,
    body.trace_text,
    ...(body.margin_notes ?? []).map((item) => item.text),
  ].filter((item) => item.trim().length > 0)
}

function toKeywordSet(input: BiographyWriterInput): Set<string> {
  const keywords = new Set<string>()

  const push = (value: string | null | undefined) => {
    if (!value) return
    for (const token of value.split(/[\s，、；：:()（）"“”'‘’/]+/u)) {
      const normalized = token.trim()
      if (normalized.length >= 2) {
        keywords.add(normalized)
      }
    }
  }

  push(input.current_chapter_skeleton.book_position.chapter_title)
  push(input.current_chapter_skeleton.book_position.chapter_subtitle)
  push(input.current_chapter_skeleton.mainline.thesis)
  push(input.current_chapter_skeleton.mainline.question)
  push(input.current_chapter_skeleton.mainline.emotional_direction)
  push(input.current_material_digest.top_experiences.map((item) => item.title).join(' '))
  push(input.current_material_digest.top_experiences.map((item) => item.factual_summary).join(' '))
  push(input.current_material_digest.repeated_patterns.join(' '))
  push(input.current_material_digest.relationship_signals.map((item) => item.signal).join(' '))
  push(input.current_material_digest.achievement_signals.map((item) => item.title).join(' '))
  push(input.previous_chapter_digest?.title)
  push(input.previous_chapter_digest?.one_line_summary)

  for (const item of input.current_chapter_skeleton.key_experiences) {
    push(item.title)
    push(item.what_happened)
    push(item.why_it_mattered)
    push(item.scene)
  }
  for (const item of input.current_chapter_skeleton.influences) {
    push(item.source_label)
    push(item.influence_summary)
  }
  for (const item of input.book_memory.stable_traits) {
    push(item)
  }
  for (const item of input.book_memory.recurring_themes) {
    push(item)
  }

  return keywords
}

export class BiographyFactualAuditService {
  auditChapter(input: {
    revision_id: string
    writer_input: BiographyWriterInput
    body: BiographyChapterBodyV1
  }): BiographyFactualAudit {
    const textBlocks = collectBodyText(input.body)
    const supportedKeywords = toKeywordSet(input.writer_input)
    const unsupported_claims: BiographyFactualAudit['unsupported_claims'] = []
    const private_overreach_claims: BiographyFactualAudit['private_overreach_claims'] = []
    const forbidden_lexicon_hits: BiographyFactualAudit['forbidden_lexicon_hits'] = []
    const invented_abstractions: BiographyFactualAudit['invented_abstractions'] = []
    const invented_entities = new Set<string>()
    const invented_relationships = new Set<string>()

    for (const block of textBlocks) {
      for (const rule of BIOGRAPHY_PRIVATE_OVERREACH_RULES) {
        rule.pattern.lastIndex = 0
        if (!rule.pattern.test(block)) continue
        private_overreach_claims.push({
          claim: block,
          safer_rewrite: block.replace(rule.pattern, rule.safer_rewrite),
        })
      }

      for (const rule of BIOGRAPHY_FORBIDDEN_LEXICON_RULES) {
        rule.pattern.lastIndex = 0
        if (!rule.pattern.test(block)) continue
        forbidden_lexicon_hits.push({
          phrase: rule.id,
          safer_rewrite: rule.safer_rewrite,
        })
      }

      if (BIOGRAPHY_RELATIONSHIP_OVERREACH_PATTERNS.some((pattern) => {
        pattern.lastIndex = 0
        return pattern.test(block)
      })) {
        invented_relationships.add(block)
      }

      for (const pattern of BIOGRAPHY_INVENTED_ABSTRACTION_PATTERNS) {
        pattern.lastIndex = 0
        const matched = block.match(pattern)
        if (!matched) continue
        for (const phrase of matched) {
          invented_abstractions.push({
            phrase,
            reason: 'abstract_label_not_grounded_in_writer_input',
          })
        }
      }

      const capitalizedTokens = block.match(/\b[A-Z][A-Za-z0-9_-]{2,}\b/g) ?? []
      for (const token of capitalizedTokens) {
        if (!supportedKeywords.has(token)) {
          invented_entities.add(token)
        }
      }

      for (const sentence of splitBiographySentences(block)) {
        const hasAbsoluteClaim = BIOGRAPHY_ABSOLUTE_CLAIM_PATTERNS.some((pattern) => {
          pattern.lastIndex = 0
          return pattern.test(sentence)
        })
        if (!hasAbsoluteClaim) continue
        const matched = Array.from(supportedKeywords).some((keyword) => sentence.includes(keyword))
        if (!matched) {
          unsupported_claims.push({
            claim: sentence,
            reason: 'absolute_claim_without_matching_skeleton_or_digest_support',
          })
        }
      }
    }

    const failure_categories = [
      ...(forbidden_lexicon_hits.length > 0 ? ['forbidden_lexicon'] : []),
      ...(private_overreach_claims.length > 0 ? ['private_overreach'] : []),
      ...(unsupported_claims.length > 0 ? ['unsupported_claims'] : []),
      ...(invented_abstractions.length > 0 ? ['invented_abstraction'] : []),
      ...(invented_entities.size > 0 ? ['invented_entities'] : []),
      ...(invented_relationships.size > 0 ? ['invented_relationships'] : []),
    ]

    const status: BiographyFactualAudit['status'] =
      failure_categories.length === 0
        ? 'PASS'
        : forbidden_lexicon_hits.length > 0 || private_overreach_claims.length > 0 || unsupported_claims.length > 0
          ? 'FAILED'
          : 'NEEDS_REVIEW'

    return {
      revision_id: input.revision_id,
      status,
      failure_categories,
      unsupported_claims,
      private_overreach_claims,
      forbidden_lexicon_hits,
      invented_abstractions,
      invented_entities: Array.from(invented_entities),
      invented_relationships: Array.from(invented_relationships),
    }
  }
}
