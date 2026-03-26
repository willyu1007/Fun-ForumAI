import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ScreenshotCropper, type ScreenshotDraft } from '../ScreenshotCropper'

const draft: ScreenshotDraft = {
  dataUrl: 'data:image/png;base64,stub',
  width: 1200,
  height: 800,
  mimeType: 'image/png',
  fileName: 'capture.png',
}

describe('ScreenshotCropper', () => {
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
  let getSelectionSpy: ReturnType<typeof vi.spyOn> | null = null
  const removeAllRanges = vi.fn()

  beforeEach(() => {
    HTMLElement.prototype.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1200,
      bottom: 800,
      width: 1200,
      height: 800,
      toJSON: () => ({}),
    }))
    removeAllRanges.mockReset()
    getSelectionSpy = vi.spyOn(window, 'getSelection').mockReturnValue({
      removeAllRanges,
    } as unknown as Selection)
  })

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
    getSelectionSpy?.mockRestore()
  })

  it('shows the initial hint before selection and hides it after dragging a crop', () => {
    render(
      <ScreenshotCropper
        draft={draft}
        open
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    expect(screen.getByTestId('screenshot-cropper-hint')).toBeTruthy()

    const stage = screen.getByTestId('screenshot-cropper-stage')

    act(() => {
      fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 120 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 420, clientY: 360 })
      fireEvent.pointerUp(window, { pointerId: 1 })
    })

    expect(screen.queryByTestId('screenshot-cropper-hint')).toBeNull()
    expect(screen.getByRole('button', { name: '取消截图' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '附到聊天' })).toBeTruthy()
  })

  it('disables text selection while open and clears selection when the cropper closes', () => {
    const { unmount } = render(
      <ScreenshotCropper
        draft={draft}
        open
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    expect(document.body.style.userSelect).toBe('none')
    expect(document.documentElement.style.userSelect).toBe('none')

    unmount()

    expect(removeAllRanges).toHaveBeenCalled()
    expect(document.body.style.userSelect).toBe('')
    expect(document.documentElement.style.userSelect).toBe('')
  })
})
