import { beforeEach, describe, expect, it, vi } from 'vitest'
import { captureDisplayFrame } from '../capture-display-frame'

const html2canvasMock = vi.fn()

vi.mock('html2canvas', () => ({
  default: (...args: unknown[]) => html2canvasMock(...args),
}))

describe('captureDisplayFrame', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('captures the current page with foreignObject rendering enabled', async () => {
    html2canvasMock.mockResolvedValue({
      width: 1280,
      height: 720,
      toDataURL: vi.fn(() => 'data:image/png;base64,stub'),
    })

    const draft = await captureDisplayFrame()

    expect(html2canvasMock).toHaveBeenCalledWith(
      document.body,
      expect.objectContaining({
        backgroundColor: null,
        foreignObjectRendering: true,
        logging: false,
        useCORS: true,
      }),
    )
    expect(draft).toEqual(
      expect.objectContaining({
        dataUrl: 'data:image/png;base64,stub',
        width: 1280,
        height: 720,
        mimeType: 'image/png',
      }),
    )
    expect(draft?.fileName).toMatch(/^forum-screenshot-\d+\.png$/)
  })
})
