import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDevSeedMutation } from '@/api/hooks/dev'
import { useAuth } from '@/shared/hooks/use-auth'
import { useDevAuthToolbarStore } from '@/shared/stores/dev-auth-toolbar-store'
import { DevAuthToolbar } from '../DevAuthToolbar'

vi.mock('../DevBadgeDebugPanel', () => ({
  DevBadgeDebugPanel: ({ open }: { open: boolean }) =>
    open ? <div data-testid="badge-debug-panel" /> : null,
}))

vi.mock('../DevKickoffPanel', () => ({
  DevKickoffPanel: () => null,
}))

vi.mock('../DevGuidancePanel', () => ({
  DevGuidancePanel: ({ open }: { open: boolean }) =>
    open ? <div data-testid="guidance-panel" /> : null,
}))

vi.mock('../DevFrontendFlagsPanel', () => ({
  DevFrontendFlagsPanel: ({ open }: { open: boolean }) =>
    open ? <div data-testid="frontend-flags-panel" /> : null,
}))

vi.mock('@/api/hooks/dev', () => ({
  useDevSeedMutation: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/shared/stores/dev-auth-toolbar-store', () => ({
  useDevAuthToolbarStore: vi.fn(),
}))

const useAuthMock = vi.mocked(useAuth)
const useDevAuthToolbarStoreMock = vi.mocked(useDevAuthToolbarStore)
const useDevSeedMutationMock = vi.mocked(useDevSeedMutation)

describe('DevAuthToolbar', () => {
  const seedMutateAsync = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({
      currentIdentity: 'admin',
      switchIdentity: vi.fn(() => Promise.resolve()),
      user: { id: 'user-1', email: 'dev-admin-001@dev.local', role: 'admin' },
    } as never)
    useDevSeedMutationMock.mockReturnValue({
      mutateAsync: seedMutateAsync,
      isPending: false,
    } as never)
    seedMutateAsync.mockResolvedValue({
      data: {
        counts: {
          communities: 2,
          agents: 3,
          posts: 4,
          threads: 5,
        },
      },
    })
    vi.stubGlobal('alert', vi.fn())
    Object.defineProperty(window, 'location', {
      value: { reload: vi.fn() },
      writable: true,
    })
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
    expect(screen.queryByText('游客')).toBeNull()
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
  })

  it('renders identity buttons and dev tool entries in the expanded toolbar', () => {
    useDevAuthToolbarStoreMock.mockImplementation((selector) =>
      selector({
        collapsed: false,
        setCollapsed: vi.fn(),
        toggleCollapsed: vi.fn(),
      } as never),
    )

    render(<DevAuthToolbar />)

    expect(screen.getByText('游客')).toBeTruthy()
    expect(screen.getByText('用户')).toBeTruthy()
    expect(screen.getByText('管理员')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '开发工具' }))

    expect(screen.getByText('加载 Mock')).toBeTruthy()
    expect(screen.getByText('VITE 功能门')).toBeTruthy()
    expect(screen.getByText('引导内容调试')).toBeTruthy()
    expect(screen.getByText('勋章调试')).toBeTruthy()
  })

  it('opens the guidance debug panel from the tools menu', async () => {
    useDevAuthToolbarStoreMock.mockImplementation((selector) =>
      selector({
        collapsed: false,
        setCollapsed: vi.fn(),
        toggleCollapsed: vi.fn(),
      } as never),
    )

    render(<DevAuthToolbar />)

    fireEvent.click(screen.getByRole('button', { name: '开发工具' }))
    fireEvent.click(screen.getByText('引导内容调试'))

    await waitFor(() => {
      expect(screen.getByTestId('guidance-panel')).toBeTruthy()
    })
  })

  it('loads mock data through the explicit dev seed mutation', async () => {
    useDevAuthToolbarStoreMock.mockImplementation((selector) =>
      selector({
        collapsed: false,
        setCollapsed: vi.fn(),
        toggleCollapsed: vi.fn(),
      } as never),
    )

    render(<DevAuthToolbar />)

    fireEvent.click(screen.getByRole('button', { name: '开发工具' }))
    fireEvent.click(screen.getByText('加载 Mock'))

    await waitFor(() => {
      expect(seedMutateAsync).toHaveBeenCalledWith({
        profile: 'canonical',
        reset_before_seed: true,
      })
    })
  })

  it('disables destructive actions while a dev seed import is pending', () => {
    useDevAuthToolbarStoreMock.mockImplementation((selector) =>
      selector({
        collapsed: false,
        setCollapsed: vi.fn(),
        toggleCollapsed: vi.fn(),
      } as never),
    )
    useDevSeedMutationMock.mockReturnValue({
      mutateAsync: seedMutateAsync,
      isPending: true,
    } as never)

    render(<DevAuthToolbar />)

    fireEvent.click(screen.getByRole('button', { name: '开发工具' }))

    expect(screen.getByText('加载 Mock').closest('button')?.disabled).toBe(true)
  })
})
