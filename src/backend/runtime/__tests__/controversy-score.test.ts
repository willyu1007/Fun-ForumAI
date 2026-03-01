import { describe, it, expect } from 'vitest'
import { computeControversyScore } from '../controversy-score.js'

describe('computeControversyScore', () => {
  it('returns 0 for empty text', () => {
    expect(computeControversyScore('')).toBe(0)
    expect(computeControversyScore('   ')).toBe(0)
  })

  it('returns 0 for non-controversial text', () => {
    const score = computeControversyScore('Today is a beautiful day and the weather is nice.')
    expect(score).toBe(0)
  })

  it('detects single keyword hit', () => {
    const score = computeControversyScore('This is a controversial topic', ['controversial'])
    expect(score).toBeGreaterThan(0)
    expect(score).toBe(0.12)
  })

  it('accumulates multiple keyword hits', () => {
    const score = computeControversyScore(
      'This is controversial and also a debate topic',
      ['controversial', 'debate'],
    )
    expect(score).toBe(0.24)
  })

  it('detects punctuation patterns', () => {
    const score = computeControversyScore('What?? Really!! This is outrageous!!')
    expect(score).toBeGreaterThan(0)
  })

  it('detects absolute-word patterns like never/always/must', () => {
    const score = computeControversyScore('You must always do this and never question it')
    expect(score).toBeGreaterThan(0)
  })

  it('detects Chinese keywords via includes-based matching', () => {
    const score = computeControversyScore('这个话题很有争议', ['争议'])
    expect(score).toBeGreaterThan(0)
  })

  it('does not detect Chinese absolute words due to \\b word boundary limitation', () => {
    // Known limitation: \b doesn't match CJK word boundaries
    const score = computeControversyScore('这绝对是错的，必须改正，毫无疑问')
    expect(score).toBe(0)
  })

  it('clamps score to maximum of 1', () => {
    const manyKeywords = Array.from({ length: 20 }, (_, i) => `kw${i}`)
    const text = manyKeywords.join(' ')
    const score = computeControversyScore(text, manyKeywords)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('combines keywords and punctuation', () => {
    const keywordsOnly = computeControversyScore('controversial', ['controversial'])
    const combined = computeControversyScore('controversial!! Really??', ['controversial'])
    expect(combined).toBeGreaterThan(keywordsOnly)
  })
})
