import { describe, it, expect } from 'vitest'
import { DefaultDecisionEngine } from '../decision-engine.js'
import { DEFAULT_THRESHOLDS } from '../config.js'
import type { FilterResult, CommunityThresholds } from '../types.js'

const engine = new DefaultDecisionEngine()
const PASS_FILTER: FilterResult = { passed: true, matched_rules: [] }
const BLOCK_FILTER: FilterResult = {
  passed: false,
  matched_rules: [{ rule_type: 'keyword', pattern: 'bad', severity: 'block' }],
}

describe('DefaultDecisionEngine', () => {
  it('low risk (score <= 0.3) → PUBLIC/APPROVED/APPROVE', () => {
    const d = engine.decide(0.1, ['clean'], PASS_FILTER, DEFAULT_THRESHOLDS)
    expect(d.risk_level).toBe('low')
    expect(d.visibility).toBe('PUBLIC')
    expect(d.state).toBe('APPROVED')
    expect(d.verdict).toBe('APPROVE')
  })

  it('boundary: score = 0.3 → still low', () => {
    const d = engine.decide(0.3, ['clean'], PASS_FILTER, DEFAULT_THRESHOLDS)
    expect(d.risk_level).toBe('low')
  })

  it('medium risk (0.3 < score <= 0.7) → GRAY/APPROVED/FOLD', () => {
    const d = engine.decide(0.5, ['spam_flooding'], PASS_FILTER, DEFAULT_THRESHOLDS)
    expect(d.risk_level).toBe('medium')
    expect(d.visibility).toBe('GRAY')
    expect(d.state).toBe('APPROVED')
    expect(d.verdict).toBe('FOLD')
  })

  it('boundary: score = 0.7 → still medium', () => {
    const d = engine.decide(0.7, ['spam_flooding'], PASS_FILTER, DEFAULT_THRESHOLDS)
    expect(d.risk_level).toBe('medium')
  })

  it('high risk (score > 0.7) → QUARANTINE/PENDING/QUARANTINE', () => {
    const d = engine.decide(0.8, ['hate_harassment'], PASS_FILTER, DEFAULT_THRESHOLDS)
    expect(d.risk_level).toBe('high')
    expect(d.visibility).toBe('QUARANTINE')
    expect(d.state).toBe('PENDING')
    expect(d.verdict).toBe('QUARANTINE')
  })

  it('auto-reject (score > 0.95) → QUARANTINE/REJECTED/REJECT', () => {
    const d = engine.decide(0.96, ['hate_harassment'], PASS_FILTER, DEFAULT_THRESHOLDS)
    expect(d.risk_level).toBe('high')
    expect(d.visibility).toBe('QUARANTINE')
    expect(d.state).toBe('REJECTED')
    expect(d.verdict).toBe('REJECT')
  })

  it('rule filter blocked → REJECT regardless of score', () => {
    const d = engine.decide(0.0, ['clean'], BLOCK_FILTER, DEFAULT_THRESHOLDS)
    expect(d.risk_level).toBe('high')
    expect(d.visibility).toBe('QUARANTINE')
    expect(d.state).toBe('REJECTED')
    expect(d.verdict).toBe('REJECT')
    expect(d.reason).toMatch(/rule_filter_blocked/)
  })

  it('custom community thresholds change boundaries', () => {
    const strict: CommunityThresholds = {
      low_max_score: 0.1,
      medium_max_score: 0.3,
      auto_reject_score: 0.8,
    }
    // score 0.2 is medium in strict community but low in default
    const d = engine.decide(0.2, ['clean'], PASS_FILTER, strict)
    expect(d.risk_level).toBe('medium')
    expect(d.visibility).toBe('GRAY')

    const dDefault = engine.decide(0.2, ['clean'], PASS_FILTER, DEFAULT_THRESHOLDS)
    expect(dDefault.risk_level).toBe('low')
    expect(dDefault.visibility).toBe('PUBLIC')
  })

  it('strict community auto-rejects at lower score', () => {
    const strict: CommunityThresholds = {
      low_max_score: 0.1,
      medium_max_score: 0.3,
      auto_reject_score: 0.5,
    }
    const d = engine.decide(0.55, ['spam_flooding'], PASS_FILTER, strict)
    expect(d.verdict).toBe('REJECT')
  })
})
