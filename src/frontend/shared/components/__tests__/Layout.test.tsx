import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGuidanceInbox, useNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from '@/api/hooks'
import { isGuidanceEnabled } from '@/features/guidance/feature-flags'
import { useAuth } from '@/shared/hooks/use-auth'
import { useSidebarStore } from '@/shared/stores/sidebar-store'
import { Layout } from '../Layout'

vi.mock('@/api/hooks', () => ({
  useGuidanceInbox: vi.fn(),
  useNotifications: vi.fn(),
  useMarkNotificationRead: vi.fn(),
  useMarkAllNotificationsRead: vi.fn(),
}))

vi.mock('@/features/guidance/feature-flags', () => ({
  isGuidanceEnabled: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/shared/stores/sidebar-store', () => ({
  useSidebarStore: vi.fn(),
}))

vi.mock('../AgentPanel', () => ({
  AgentPanel: () => <div data-testid="agent-panel" />,
}))

vi.mock('../DevAuthToolbar', () => ({
  DevAuthToolbar: () => null,
}))

vi.mock('../LeftSidebar', () => ({
  LeftSidebar: () => <div data-testid="left-sidebar" />,
}))

vi.mock('../RightSidebar', () => ({
  RightSidebar: () => <div data-testid="right-sidebar" />,
}))

const useGuidanceInboxMock = vi.mocked(useGuidanceInbox)
const useNotificationsMock = vi.mocked(useNotifications)
const useMarkNotificationReadMock = vi.mocked(useMarkNotificationRead)
const useMarkAllNotificationsReadMock = vi.mocked(useMarkAllNotificationsRead)
const isGuidanceEnabledMock = vi.mocked(isGuidanceEnabled)
const useAuthMock = vi.mocked(useAuth)
const useSidebarStoreMock = vi.mocked(useSidebarStore)

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useGuidanceInboxMock.mockReturnValue({ data: undefined } as never)
    useNotificationsMock.mockReturnValue({
      data: {
        data: {
          unread_count: 0,
          items: [],
        },
      },
    } as never)
    useMarkNotificationReadMock.mockReturnValue({ mutate: vi.fn() } as never)
    useMarkAllNotificationsReadMock.mockReturnValue({ mutate: vi.fn() } as never)
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      user: {
        displayName: 'Owner',
        email: 'owner@test.com',
        role: 'user',
      },
      logout: vi.fn(),
    } as never)
    useSidebarStoreMock.mockReturnValue({
      leftOpen: true,
      toggleLeft: vi.fn(),
    } as never)
  })

  it('does not render the guidance inbox entry when the feature flag is off', () => {
    isGuidanceEnabledMock.mockReturnValue(false)

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByText('Inbox')).toBeNull()
  })
})
