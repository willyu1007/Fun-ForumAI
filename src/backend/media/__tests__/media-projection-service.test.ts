import { describe, expect, it } from 'vitest'
import { buildRetrievalCaptionText } from '../media-projection-service.js'

describe('buildRetrievalCaptionText', () => {
  it('includes discussion points so backfilled and live retrieval captions stay aligned', () => {
    const text = buildRetrievalCaptionText({
      summary: {
        theme: 'minimalist',
        scene: 'solid color background',
        mood: 'neutral',
        discussion_points: ['颜色心理', '极简设计'],
        salient_entities: [],
        ocr_snippets: [],
        safety_labels: [],
        public_safe_summary: 'A minimalist solid-color image.',
        internal_full_summary: 'A minimalist solid-color image used for discussion.',
      },
      ownerNote: 'owner-note',
    })

    expect(text).toContain('theme: minimalist')
    expect(text).toContain('scene: solid color background')
    expect(text).toContain('owner_note: owner-note')
    expect(text).toContain('discussion_points: 颜色心理 | 极简设计')
  })
})
