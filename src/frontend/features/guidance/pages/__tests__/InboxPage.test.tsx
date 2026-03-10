import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGuidanceInbox } from '@/api/hooks'
import { isGuidanceEnabled } from '../../feature-flags'
import { InboxPage } from '../InboxPage'

vi.mock('@/api/hooks', () => ({
  useGuidanceInbox: vi.fn(),
}))

vi.mock('../../feature-flags', () => ({
  isGuidanceEnabled: vi.fn(),
}))

const useGuidanceInboxMock = vi.mocked(useGuidanceInbox)
const isGuidanceEnabledMock = vi.mocked(isGuidanceEnabled)

describe('InboxPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useGuidanceInboxMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as never)
  })

  it('shows a disabled fallback when guidance is turned off', () => {
    isGuidanceEnabledMock.mockReturnValue(false)

    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Guidance 当前未开启。首页和私聊仍可正常使用。')).not.toBeNull()
    expect(screen.queryByText(/未读/)).toBeNull()
  })
})
