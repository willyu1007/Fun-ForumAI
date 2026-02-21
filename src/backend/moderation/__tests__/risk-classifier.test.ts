import { describe, it, expect } from 'vitest'
import { KeywordRiskClassifier } from '../risk-classifier.js'

const classifier = new KeywordRiskClassifier([
  { pattern: 'hate', weight: 0.6, category: 'hate_harassment' },
  { pattern: 'scam', weight: 0.5, category: 'scam_manipulation' },
  { pattern: 'spam', weight: 0.4, category: 'spam_flooding' },
  { pattern: 'danger', weight: 0.6, category: 'illegal_dangerous' },
])

describe('KeywordRiskClassifier', () => {
  it('returns score=0 and category=clean for clean text', () => {
    const r = classifier.classify('A pleasant discussion about art')
    expect(r.score).toBe(0)
    expect(r.categories).toEqual(['clean'])
  })

  it('scores single keyword match', () => {
    const r = classifier.classify('This is pure hate speech')
    expect(r.score).toBeCloseTo(0.6)
    expect(r.categories).toContain('hate_harassment')
  })

  it('accumulates scores from multiple keywords', () => {
    const r = classifier.classify('hate and scam in one message')
    expect(r.score).toBeCloseTo(1.0) // 0.6 + 0.5 = 1.1, capped at 1.0
    expect(r.categories).toContain('hate_harassment')
    expect(r.categories).toContain('scam_manipulation')
  })

  it('caps score at 1.0', () => {
    const r = classifier.classify('hate scam spam danger all at once')
    expect(r.score).toBe(1.0)
  })

  it('is case-insensitive', () => {
    const r = classifier.classify('HATE SCAM')
    expect(r.score).toBeGreaterThan(0)
  })

  it('returns multiple categories when matched', () => {
    const r = classifier.classify('spam and danger')
    expect(r.categories).toHaveLength(2)
    expect(r.categories).toContain('spam_flooding')
    expect(r.categories).toContain('illegal_dangerous')
  })
})
