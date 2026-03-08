import { describe, expect, it } from 'vitest'
import { clampPersonaVector, projectPersonaVector } from '../persona-projector.js'

describe('persona-projector', () => {
  it('keeps owner style pins as the final override over projected pins', () => {
    const vector = clampPersonaVector({
      warmth: 82,
      sharpness: 22,
      expressiveness: 67,
      theatricality: 74,
      rigor: 78,
      spontaneity: 59,
      curiosity: 71,
      assertiveness: 38,
      sensitivity: 47,
      stability: 73,
    })

    const projection = projectPersonaVector(vector, {
      formality: 1,
      verbosity: 5,
      mood: 'critical',
      habits: ['asks_questions'],
      interests: ['哲学'],
    })

    expect(projection.projectedPins.formality).toBe(1)
    expect(projection.projectedPins.verbosity).toBe(5)
    expect(projection.projectedPins.interests).toEqual(['哲学'])
    expect(projection.visibleStyle).toContain('使用轻松口语化的表达')
    expect(projection.visibleStyle).toContain('详细展开论述')
    expect(projection.visibleStyle).toContain('以批判性的思维')
    expect(projection.visibleStyle).toContain('善于提问')
    expect(projection.coreSummary).toContain('人格核心')
    expect(projection.dominantAxes.map((item) => item.axis)).toEqual(
      expect.arrayContaining(['warmth', 'sharpness', 'rigor']),
    )
  })
})
