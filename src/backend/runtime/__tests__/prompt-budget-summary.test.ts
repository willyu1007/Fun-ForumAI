import { describe, expect, it } from 'vitest'
import { estimateRenderedPromptTokens } from '../prompt-budget-summary.js'

describe('estimateRenderedPromptTokens', () => {
  it('does not treat multimodal data URLs as raw base64 text for budgeting', () => {
    const dataUrl = `data:image/png;base64,${Buffer.alloc(2_000_000, 7).toString('base64')}`
    const tokens = estimateRenderedPromptTokens([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this image.' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ])

    expect(tokens).toBeGreaterThan(300)
    expect(tokens).toBeLessThan(1000)
  })
})
