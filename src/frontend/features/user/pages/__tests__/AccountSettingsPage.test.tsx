import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountSettingsPage } from '../AccountSettingsPage'
import { useAuth } from '@/shared/hooks/use-auth'
import type { UserProfile } from '@/api/auth'

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
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
    birthDate: null,
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
    startEmailPasswordReset: vi.fn(),
    verifyEmailPasswordReset: vi.fn(),
    resendEmailPasswordReset: vi.fn(),
    sendSmsCode: vi.fn(),
    verifySmsCode: vi.fn(),
    resendSmsCode: vi.fn(),
    logout: vi.fn(),
    updateProfile: vi.fn(),
    startEmailChange: vi.fn(),
    verifyEmailChange: vi.fn(),
    startPhoneChange: vi.fn(),
    verifyPhoneChange: vi.fn(),
    resendContactChange: vi.fn(),
    switchIdentity: vi.fn(),
    isLoginPending: false,
    isEmailRegisterStartPending: false,
    isEmailRegisterVerifyPending: false,
    isEmailRegisterResendPending: false,
    isPasswordResetStartPending: false,
    isPasswordResetVerifyPending: false,
    isPasswordResetResendPending: false,
    isSmsSendPending: false,
    isSmsVerifyPending: false,
    isSmsResendPending: false,
    isLogoutPending: false,
    isUpdateProfilePending: false,
    isEmailChangeStartPending: false,
    isEmailChangeVerifyPending: false,
    isPhoneChangeStartPending: false,
    isPhoneChangeVerifyPending: false,
    isContactChangeResendPending: false,
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
    expect(screen.getByText(/请先/)).toBeTruthy()

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
        birthDate: null,
      })
    })
    expect(screen.getByText('已保存')).toBeTruthy()
  })

  it('resets the password through the account settings email verification flow', async () => {
    const startEmailPasswordReset = vi.fn().mockResolvedValue({
      challengeId: 'reset-challenge-1',
      maskedTarget: 'us***@example.com',
      expiresInSec: 600,
      resendAfterSec: 60,
    })
    const verifyEmailPasswordReset = vi.fn().mockResolvedValue({
      user: buildUser(),
      token: 'token-1',
    })

    useAuthMock.mockReturnValue(buildAuthMock({
      startEmailPasswordReset,
      verifyEmailPasswordReset,
    }))

    renderPage()

    fireEvent.click(screen.getByRole('button', { name: '发送邮箱验证码' }))

    await waitFor(() => {
      expect(startEmailPasswordReset).toHaveBeenCalledWith({
        email: 'user@example.com',
      })
    })

    fireEvent.change(screen.getByLabelText('验证码'), {
      target: { value: '123456' },
    })
    fireEvent.change(screen.getByLabelText('新密码'), {
      target: { value: 'newpassword123' },
    })
    fireEvent.change(screen.getByLabelText('确认新密码'), {
      target: { value: 'newpassword123' },
    })
    fireEvent.click(screen.getByRole('button', { name: '验证并更新密码' }))

    await waitFor(() => {
      expect(verifyEmailPasswordReset).toHaveBeenCalledWith({
        challengeId: 'reset-challenge-1',
        code: '123456',
        password: 'newpassword123',
      })
    })

    expect(screen.getByText('密码已更新')).toBeTruthy()
  })
})
