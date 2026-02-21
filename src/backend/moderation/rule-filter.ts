import type { RuleFilter, FilterResult, MatchedRule } from './types.js'
import { BLOCK_KEYWORDS, PII_PATTERNS, URL_BLACKLIST_PATTERNS } from './config.js'

/**
 * Stage 1: Rule-based filter.
 *
 * Checks text against:
 *   1. Keyword blacklist → severity: block
 *   2. PII patterns (email, phone, SSN) → severity: block or flag
 *   3. URL blacklist → severity: block
 *
 * If any "block"-severity rule matches, the content fails the filter.
 */
export class DefaultRuleFilter implements RuleFilter {
  private blockKeywords: string[]
  private piiPatterns: typeof PII_PATTERNS
  private urlPatterns: RegExp[]

  constructor(
    opts: {
      blockKeywords?: string[]
      piiPatterns?: typeof PII_PATTERNS
      urlPatterns?: RegExp[]
    } = {},
  ) {
    this.blockKeywords = opts.blockKeywords ?? BLOCK_KEYWORDS
    this.piiPatterns = opts.piiPatterns ?? PII_PATTERNS
    this.urlPatterns = opts.urlPatterns ?? URL_BLACKLIST_PATTERNS
  }

  check(text: string): FilterResult {
    const matched: MatchedRule[] = []
    const lower = text.toLowerCase()

    for (const kw of this.blockKeywords) {
      if (lower.includes(kw.toLowerCase())) {
        matched.push({ rule_type: 'keyword', pattern: kw, severity: 'block' })
      }
    }

    for (const pii of this.piiPatterns) {
      pii.regex.lastIndex = 0
      if (pii.regex.test(text)) {
        matched.push({ rule_type: 'pii', pattern: pii.name, severity: pii.severity })
      }
    }

    for (const urlRe of this.urlPatterns) {
      urlRe.lastIndex = 0
      if (urlRe.test(text)) {
        matched.push({ rule_type: 'url', pattern: urlRe.source, severity: 'block' })
      }
    }

    const hasBlock = matched.some((m) => m.severity === 'block')
    return { passed: !hasBlock, matched_rules: matched }
  }
}
