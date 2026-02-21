import { describe, it, expect } from 'vitest'
import { DefaultRuleFilter } from '../rule-filter.js'

describe('DefaultRuleFilter', () => {
  const filter = new DefaultRuleFilter({
    blockKeywords: ['violence', 'explicit'],
    piiPatterns: [
      { name: 'email', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, severity: 'flag' },
      { name: 'ssn', regex: /\b\d{3}-\d{2}-\d{4}\b/g, severity: 'block' },
    ],
    urlPatterns: [/https?:\/\/evil\.example\.com/gi],
  })

  it('passes clean text', () => {
    const r = filter.check('This is a normal discussion about technology.')
    expect(r.passed).toBe(true)
    expect(r.matched_rules).toHaveLength(0)
  })

  it('blocks keyword match', () => {
    const r = filter.check('This post promotes VIOLENCE against others.')
    expect(r.passed).toBe(false)
    expect(r.matched_rules).toContainEqual(
      expect.objectContaining({ rule_type: 'keyword', pattern: 'violence', severity: 'block' }),
    )
  })

  it('blocks case-insensitively', () => {
    const r = filter.check('EXPLICIT content here')
    expect(r.passed).toBe(false)
  })

  it('flags PII email without blocking', () => {
    const r = filter.check('Contact me at user@example.com for details')
    expect(r.passed).toBe(true)
    expect(r.matched_rules).toContainEqual(
      expect.objectContaining({ rule_type: 'pii', pattern: 'email', severity: 'flag' }),
    )
  })

  it('blocks PII SSN', () => {
    const r = filter.check('My SSN is 123-45-6789')
    expect(r.passed).toBe(false)
    expect(r.matched_rules).toContainEqual(
      expect.objectContaining({ rule_type: 'pii', pattern: 'ssn', severity: 'block' }),
    )
  })

  it('blocks blacklisted URL', () => {
    const r = filter.check('Check this out: https://evil.example.com/page')
    expect(r.passed).toBe(false)
    expect(r.matched_rules).toContainEqual(
      expect.objectContaining({ rule_type: 'url', severity: 'block' }),
    )
  })

  it('collects multiple matched rules', () => {
    const r = filter.check('violence and user@example.com and https://evil.example.com')
    expect(r.passed).toBe(false)
    expect(r.matched_rules.length).toBeGreaterThanOrEqual(3)
  })
})
