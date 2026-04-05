import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@/shared/hooks/use-auth'
import { useDevAuthToolbarStore } from '@/shared/stores/dev-auth-toolbar-store'
import { DevAuthToolbar } from '../DevAuthToolbar'

vi.mock('../DevBadgeDebugPanel', () => ({
  DevBadgeDebugPanel: () => <button type="button">勋章调试</button>,
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/shared/stores/dev-auth-toolbar-store', () => ({
  useDevAuthToolbarStore: vi.fn(),
}))

const useAuthMock = vi.mocked(useAuth)
const useDevAuthToolbarStoreMock = vi.mocked(useDevAuthToolbarStore)

describe('DevAuthToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({
      currentIdentity: 'admin',
      switchIdentity: vi.fn(() => Promise.resolve()),
      user: { id: 'user-1', email: 'dev-admin-001@dev.local', role: 'admin' },
    } as never)
  })

  it('renders a compact expand button when collapsed', () => {
    const setCollapsed = vi.fn()
    useDevAuthToolbarStoreMock.mockImplementation((selector) =>
      selector({
        collapsed: true,
        setCollapsed,
        toggleCollapsed: vi.fn(),
      } as never),
    )

    render(<DevAuthToolbar />)

    expect(screen.getByRole('button', { name: '展开开发模式工具栏' })).toBeTruthy()
    expect(screen.queryByText('身份切换：')).toBeNull()
  })

  it('collapses the full toolbar when the collapse button is clicked', () => {
    const setCollapsed = vi.fn()
    useDevAuthToolbarStoreMock.mockImplementation((selector) =>
      selector({
        collapsed: false,
        setCollapsed,
        toggleCollapsed: vi.fn(),
      } as never),
    )

    render(<DevAuthToolbar />)

    fireEvent.click(screen.getByRole('button', { name: '收起开发模式工具栏' }))

    expect(setCollapsed).toHaveBeenCalledWith(true)
    expect(screen.getByText('身份切换：')).toBeTruthy()
  })

  it('renders a badge debug entry in the expanded toolbar', () => {
    useDevAuthToolbarStoreMock.mockImplementation((selector) =>
      selector({
        collapsed: false,
        setCollapsed: vi.fn(),
        toggleCollapsed: vi.fn(),
      } as never),
    )

    render(<DevAuthToolbar />)

    expect(screen.getByRole('button', { name: '勋章调试' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /VITE 功能/i })).toBeTruthy()
  })
})
