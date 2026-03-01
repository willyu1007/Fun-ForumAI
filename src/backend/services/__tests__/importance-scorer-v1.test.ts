import { describe, it, expect } from 'vitest'
import { ImportanceScorerV1, IMPORTANCE_D_MAP_V1, IMPORTANCE_R_MAP_V1 } from '../achievements/importance-scorer-v1.js'

describe('ImportanceScorerV1', () => {
  it('returns deterministic score for fixed inputs', () => {
    const scorer = new ImportanceScorerV1()
    const score = scorer.score({
      F: 0.8,
      S: 0.75,
      R: IMPORTANCE_R_MAP_V1[2],
      D: IMPORTANCE_D_MAP_V1.PUBLIC,
      O: 0.6,
      N: 0.7,
      C: 0.65,
      T: 0.9,
      spamPenalty: 0.1,
    })

    expect(score).toBe(0.6582)
  })

  it('keeps score in [0,1] and applies decay', () => {
    const scorer = new ImportanceScorerV1()
    const old = new Date('2025-01-01T00:00:00.000Z')
    const now = new Date('2026-03-01T00:00:00.000Z')

    expect(scorer.timeDecay(now, now)).toBe(1)
    expect(scorer.timeDecay(old, now)).toBeLessThanOrEqual(0.45)

    const clamped = scorer.score({
      F: 99,
      S: 99,
      R: 99,
      D: 99,
      O: 99,
      N: 99,
      C: 99,
      T: 99,
      spamPenalty: -10,
    })
    expect(clamped).toBe(1)
  })
})
