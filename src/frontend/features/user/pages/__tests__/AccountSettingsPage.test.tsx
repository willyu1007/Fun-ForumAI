import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountSettingsPage } from '../AccountSettingsPage'
import { useAuth } from '@/shared/hooks/use-auth'
import type { UserProfile } from '@/api/auth'

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/shared/stores/agent-modal-store', () => ({
  useAgentModalStore: {
    getState: () => ({
      openModal: vi.fn(),
    }),
  },
}))

vi.mock('@/shared/components/PresetAvatarDialog', () => ({
  PresetAvatarDialog: () => null,
}))

const useAuthMock = vi.mocked(useAuth)

function buildUser(overrides: Partial<UserProfile> = {}): UserProfile {
  const base: UserProfile = {
    id: 'user-1',
    email: 'user@example.com',
    phone: null,
    displayName: 'Default User',
    avatarUrl: null,
    planTier: 'FREE',
    role: 'user',
  }
  return { ...base, ...overrides }
}

function buildAuthMock(overrides: Partial<ReturnType<typeof useAuth>> = {}): ReturnType<typeof useAuth> {
  return {
    user: buildUser(),
    isLoading: false,
    isAuthenticated: true,
    currentIdentity: 'user',
    login: vi.fn(),
    startEmailRegistration: vi.fn(),
    verifyEmailRegistration: vi.fn(),
    resendEmailRegistration: vi.fn(),
    sendSmsCode: vi.fn(),
    verifySmsCode: vi.fn(),
    resendSmsCode: vi.fn(),
    logout: vi.fn(),
    updateProfile: vi.fn(),
    switchIdentity: vi.fn(),
    isLoginPending: false,
    isRegisterPending: false,
    isEmailRegisterStartPending: false,
    isEmailRegisterVerifyPending: false,
    isEmailRegisterResendPending: false,
    isSmsSendPending: false,
    isSmsVerifyPending: false,
    isSmsResendPending: false,
    isLogoutPending: false,
    isUpdateProfilePending: false,
    loginError: null,
    registerError: null,
    smsError: null,
    updateProfileError: null,
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountSettingsPage />
    </MemoryRouter>,
  )
}

describe('AccountSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hydrates the display name when the authenticated user arrives after the first render', async () => {
    let authState = buildAuthMock({
      user: null,
      isAuthenticated: true,
    })
    useAuthMock.mockImplementation(() => authState)

    const view = renderPage()
    expect(screen.getByText('需要登录')).toBeTruthy()

    authState = buildAuthMock({
      user: buildUser({ displayName: 'Hydrated User' }),
      isAuthenticated: true,
    })
    view.rerender(
      <MemoryRouter>
        <AccountSettingsPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('Hydrated User')).toBeTruthy()
    })
  })

  it('persists profile updates through useAuth.updateProfile', async () => {
    const updateProfile = vi.fn().mockResolvedValue(buildUser({ displayName: 'Renamed User' }))
    useAuthMock.mockReturnValue(buildAuthMock({ updateProfile }))

    renderPage()

    fireEvent.change(screen.getByLabelText('显示名称'), {
      target: { value: 'Renamed User' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }))

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith({
        displayName: 'Renamed User',
        avatarUrl: null,
      })
    })
    expect(screen.getByText('资料已保存。')).toBeTruthy()
  })
})
