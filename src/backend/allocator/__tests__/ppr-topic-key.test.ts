import { describe, expect, it } from 'vitest'
import { deriveTopicKey, deriveTopicWeights, PPR_TOPIC_FALLBACK } from '../ppr-topic-key.js'

describe('ppr-topic-key', () => {
  it('returns fallback when tags are empty', () => {
    expect(deriveTopicKey([])).toBe(PPR_TOPIC_FALLBACK)
    expect(deriveTopicKey()).toBe(PPR_TOPIC_FALLBACK)
  })

  it('prefers weighted main tag by position and frequency', () => {
    const tags = ['AI', 'db', 'ai', 'cache']
    const weights = deriveTopicWeights(tags)
    expect((weights.get('ai') ?? 0)).toBeGreaterThan(weights.get('db') ?? 0)
    expect(deriveTopicKey(tags)).toBe('ai')
  })
})
