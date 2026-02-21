import { describe, it, expect } from 'vitest'
import { ModerationService } from '../moderation-service.js'
import { DefaultRuleFilter } from '../rule-filter.js'
import { KeywordRiskClassifier } from '../risk-classifier.js'
import { DefaultDecisionEngine } from '../decision-engine.js'
import type { ModerationInput, CommunityThresholds, RuleFilter, RiskClassifier } from '../types.js'

function buildService(opts?: { ruleFilter?: RuleFilter; classifier?: RiskClassifier }) {
  return new ModerationService({
    ruleFilter: opts?.ruleFilter ?? new DefaultRuleFilter({
      blockKeywords: ['blocked_word'],
      piiPatterns: [
        { name: 'email', regex: /[\w.+-]+@[\w.-]+\.\w{2,}/g, severity: 'flag' },
        { name: 'ssn', regex: /\b\d{3}-\d{2}-\d{4}\b/g, severity: 'block' },
      ],
      urlPatterns: [/https?:\/\/evil\.test/gi],
    }),
    classifier: opts?.classifier ?? new KeywordRiskClassifier([
      { pattern: 'hate', weight: 0.6, category: 'hate_harassment' },
      { pattern: 'scam', weight: 0.5, category: 'scam_manipulation' },
      { pattern: 'mild_risk', weight: 0.35, category: 'spam_flooding' },
    ]),
    decisionEngine: new DefaultDecisionEngine(),
  })
}

function input(text: string, overrides?: Partial<ModerationInput>): ModerationInput {
  return {
    text,
    author_agent_id: 'agent-1',
    community_id: 'comm-1',
    content_type: 'post',
    ...overrides,
  }
}

describe('ModerationService — end-to-end pipeline', () => {
  const service = buildService()

  it('clean content → PUBLIC/APPROVED', () => {
    const r = service.evaluate(input('A perfectly normal discussion'))
    expect(r.risk_level).toBe('low')
    expect(r.visibility).toBe('PUBLIC')
    expect(r.state).toBe('APPROVED')
    expect(r.verdict).toBe('APPROVE')
    expect(r.details.fail_closed).toBe(false)
  })

  it('medium risk content → GRAY/APPROVED/FOLD', () => {
    const r = service.evaluate(input('This has mild_risk keyword'))
    expect(r.risk_level).toBe('medium')
    expect(r.visibility).toBe('GRAY')
    expect(r.state).toBe('APPROVED')
    expect(r.verdict).toBe('FOLD')
  })

  it('high risk content → QUARANTINE', () => {
    const r = service.evaluate(input('This is hate plus mild_risk combined'))
    expect(r.risk_score).toBeGreaterThan(0.7)
    expect(r.risk_level).toBe('high')
    expect(r.visibility).toBe('QUARANTINE')
    expect(r.verdict).toBe('QUARANTINE')
  })

  it('extreme risk → auto-reject', () => {
    const r = service.evaluate(input('hate scam all together now'))
    expect(r.risk_score).toBeGreaterThanOrEqual(0.95)
    expect(r.verdict).toBe('REJECT')
    expect(r.state).toBe('REJECTED')
  })

  it('rule filter blocked_word → immediate REJECT', () => {
    const r = service.evaluate(input('This has blocked_word'))
    expect(r.verdict).toBe('REJECT')
    expect(r.visibility).toBe('QUARANTINE')
    expect(r.details.rule_filter.passed).toBe(false)
  })

  it('PII email flagged but not blocked', () => {
    const r = service.evaluate(input('Reach me at test@example.com'))
    expect(r.visibility).toBe('PUBLIC')
    expect(r.details.rule_filter.matched_rules).toContainEqual(
      expect.objectContaining({ rule_type: 'pii', pattern: 'email', severity: 'flag' }),
    )
  })

  it('PII SSN blocks content', () => {
    const r = service.evaluate(input('My number is 123-45-6789'))
    expect(r.verdict).toBe('REJECT')
    expect(r.visibility).toBe('QUARANTINE')
  })

  it('blacklisted URL blocks content', () => {
    const r = service.evaluate(input('Visit https://evil.test/phish'))
    expect(r.verdict).toBe('REJECT')
  })
})

describe('ModerationService — community thresholds', () => {
  const service = buildService()

  it('strict community classifies same content as higher risk', () => {
    const strict: CommunityThresholds = {
      low_max_score: 0.1,
      medium_max_score: 0.3,
      auto_reject_score: 0.5,
    }
    const text = 'Contains mild_risk keyword'

    const rDefault = service.evaluate(input(text))
    expect(rDefault.risk_level).toBe('medium')
    expect(rDefault.visibility).toBe('GRAY')

    const rStrict = service.evaluate(input(text, { community_thresholds: strict }))
    expect(rStrict.risk_level).toBe('high')
    expect(rStrict.visibility).toBe('QUARANTINE')
  })

  it('lenient community passes borderline content', () => {
    const lenient: CommunityThresholds = {
      low_max_score: 0.5,
      medium_max_score: 0.9,
      auto_reject_score: 0.99,
    }
    const text = 'Contains mild_risk keyword'

    const r = service.evaluate(input(text, { community_thresholds: lenient }))
    expect(r.risk_level).toBe('low')
    expect(r.visibility).toBe('PUBLIC')
  })
})

describe('ModerationService — fail-closed', () => {
  it('defaults to GRAY/PENDING when rule filter throws', () => {
    const throwingFilter: RuleFilter = {
      check: () => { throw new Error('filter crashed') },
    }
    const service = buildService({ ruleFilter: throwingFilter })
    const r = service.evaluate(input('any text'))
    expect(r.visibility).toBe('GRAY')
    expect(r.state).toBe('PENDING')
    expect(r.verdict).toBe('FOLD')
    expect(r.details.fail_closed).toBe(true)
  })

  it('defaults to GRAY/PENDING when classifier throws', () => {
    const throwingClassifier: RiskClassifier = {
      classify: () => { throw new Error('classifier crashed') },
    }
    const service = buildService({ classifier: throwingClassifier })
    const r = service.evaluate(input('any text'))
    expect(r.visibility).toBe('GRAY')
    expect(r.state).toBe('PENDING')
    expect(r.details.fail_closed).toBe(true)
  })
})
