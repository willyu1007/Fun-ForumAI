import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StyleControlPanel } from '../StyleControlPanel'
import { useAgentStyle, useUpdateAgentStyle } from '@/api/hooks'
import type { StyleSettings } from '@/api/types'

vi.mock('@/api/hooks', () => ({
  useAgentStyle: vi.fn(),
  useUpdateAgentStyle: vi.fn(),
}))

const useAgentStyleMock = vi.mocked(useAgentStyle)
const useUpdateAgentStyleMock = vi.mocked(useUpdateAgentStyle)

function buildStyleSettings(): StyleSettings {
  return {
    formality: 3,
    verbosity: 2,
    mood: 'neutral',
    habits: ['summarizes'],
    forum_activity: 4,
  }
}

describe('StyleControlPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('enables save after local changes and submits the edited settings', () => {
    const mutate = vi.fn()

    useAgentStyleMock.mockReturnValue({
      data: { data: buildStyleSettings() },
      isLoading: false,
    } as never)

    useUpdateAgentStyleMock.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as never)

    render(<StyleControlPanel agentId="agent-1" />)

    const saveButton = screen.getByRole('button', { name: '保存设定' })
    expect((saveButton as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(screen.getByRole('slider', { name: '正式度' }), {
      target: { value: '5' },
    })

    expect((saveButton as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(saveButton)

    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        formality: 5,
        verbosity: 2,
        mood: 'neutral',
        habits: ['summarizes'],
        forum_activity: 4,
      }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
      }),
    )
  })

  it('does not submit immediately when local controls change', () => {
    const mutate = vi.fn()

    useAgentStyleMock.mockReturnValue({
      data: { data: buildStyleSettings() },
      isLoading: false,
    } as never)

    useUpdateAgentStyleMock.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as never)

    render(<StyleControlPanel agentId="agent-1" />)

    fireEvent.change(screen.getByRole('slider', { name: '详细度' }), {
      target: { value: '4' },
    })

    expect(mutate).not.toHaveBeenCalled()
  })

  it('preserves unsaved local edits when fresh query data arrives', () => {
    let serverStyle = buildStyleSettings()

    useAgentStyleMock.mockImplementation(
      () =>
        ({
          data: { data: serverStyle },
          isLoading: false,
        }) as never,
    )

    useUpdateAgentStyleMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never)

    const { rerender } = render(<StyleControlPanel agentId="agent-1" />)

    fireEvent.change(screen.getByRole('slider', { name: '正式度' }), {
      target: { value: '5' },
    })

    serverStyle = {
      ...serverStyle,
      formality: 2,
    }

    rerender(<StyleControlPanel agentId="agent-1" />)

    expect((screen.getByRole('slider', { name: '正式度' }) as HTMLInputElement).value).toBe('5')
    expect(screen.getByText('设定已修改，点击保存后生效。')).toBeTruthy()
  })
})
