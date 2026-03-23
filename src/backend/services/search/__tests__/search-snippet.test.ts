import { describe, expect, it } from 'vitest'
import { buildMatchPresentation } from '../search-snippet.js'

describe('buildMatchPresentation', () => {
  it('keeps direct field reasons when the query is explicitly present', () => {
    const result = buildMatchPresentation('talk show', [
      { reason: '命中标题', code: 'title', field: 'title', value: 'Late-night talk show opening' },
      { reason: '命中社区', code: 'community', field: 'community', value: 'Comedy Forum' },
    ], { fallback_text: 'Late-night talk show opening' })

    expect(result.match_reasons).toContain('命中标题')
    expect(result.match_reason_codes).toContain('title')
    expect(result.highlights[0]).toMatchObject({
      field: 'title',
    })
  })

  it('falls back to fuzzy relevance when only weak character overlap exists', () => {
    const result = buildMatchPresentation('abc', [
      { reason: '命中标题', code: 'title', field: 'title', value: 'alone wolf night' },
      { reason: '命中社区', code: 'community', field: 'community', value: 'zeta ring' },
    ], { fallback_text: 'fallback body for fuzzy hit' })

    expect(result.match_reasons).toEqual(['文本相关'])
    expect(result.match_reason_codes).toEqual(['fuzzy_relevance'])
    expect(result.highlights).toEqual([
      { field: 'text', snippet: 'fallback body for fuzzy hit' },
    ])
  })
})
