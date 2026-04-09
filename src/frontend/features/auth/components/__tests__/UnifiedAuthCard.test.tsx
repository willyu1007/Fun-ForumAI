import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnifiedAuthCard } from '../UnifiedAuthCard'
import { useAuth } from '@/shared/hooks/use-auth'

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

const useAuthMock = vi.mocked(useAuth)

function buildAuthMock(overrides: Partial<ReturnType<typeof useAuth>> = {}): ReturnType<typeof useAuth> {
  return {
    user: null,
    isLoading: false,
    isAuthenticated: false,
    currentIdentity: 'anonymous',
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

function createApiError(message: string, code: string) {
  return Object.assign(new Error(message), { code })
}

function LocationProbe() {
  const location = useLocation()
  return <div>{`${location.pathname}${location.search}`}</div>
}

describe('UnifiedAuthCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('expands email registration details after an unknown-email login attempt', async () => {
    const login = vi.fn().mockRejectedValue(createApiError('该邮箱尚未注册', 'USER_NOT_FOUND'))
    const startEmailRegistration = vi.fn().mockResolvedValue({
      challengeId: 'email-challenge-1',
      maskedTarget: 'us***@example.com',
      expiresInSec: 600,
      resendAfterSec: 60,
    })

    useAuthMock.mockReturnValue(
      buildAuthMock({
        login,
        startEmailRegistration,
      }),
    )

    render(
      <MemoryRouter initialEntries={['/login?invite=100001']}>
        <Routes>
          <Route path="/login" element={<UnifiedAuthCard initialMethod="email" />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('邮箱地址'), {
      target: { value: 'new-user@example.com' },
    })
    fireEvent.change(screen.getByLabelText('密码'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: '入场' }))

    await waitFor(() => {
      expect(screen.getByText('这是首次使用，请补全昵称和邀请码后完成创建。')).toBeTruthy()
    })

    expect((screen.getByLabelText('邀请码') as HTMLInputElement).value).toBe('100001')

    fireEvent.change(screen.getByLabelText('昵称'), {
      target: { value: 'New User' },
    })
    fireEvent.change(screen.getByLabelText('确认密码'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送验证码' }))

    await waitFor(() => {
      expect(startEmailRegistration).toHaveBeenCalledWith({
        email: 'new-user@example.com',
        password: 'password123',
        displayName: 'New User',
        inviteCode: '100001',
      })
    })
  })

  it('collapses email registration fields after code send and shows the masked target inline', async () => {
    const login = vi.fn().mockRejectedValue(createApiError('该邮箱尚未注册', 'USER_NOT_FOUND'))
    const startEmailRegistration = vi.fn().mockResolvedValue({
      challengeId: 'email-challenge-2',
      maskedTarget: 'ne***@example.com',
      expiresInSec: 600,
      resendAfterSec: 60,
    })

    useAuthMock.mockReturnValue(
      buildAuthMock({
        login,
        startEmailRegistration,
      }),
    )

    render(
      <MemoryRouter initialEntries={['/login?invite=100001']}>
        <Routes>
          <Route path="/login" element={<UnifiedAuthCard initialMethod="email" />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('邮箱地址'), {
      target: { value: 'new-user@example.com' },
    })
    fireEvent.change(screen.getByLabelText('密码'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: '入场' }))

    await waitFor(() => {
      expect(screen.getByText('这是首次使用，请补全昵称和邀请码后完成创建。')).toBeTruthy()
    })

    fireEvent.change(screen.getByLabelText('昵称'), {
      target: { value: 'Compact User' },
    })
    fireEvent.change(screen.getByLabelText('确认密码'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送验证码' }))

    await waitFor(() => {
      expect(screen.getByText('已发送至 ne***@example.com')).toBeTruthy()
    })

    expect(screen.queryByLabelText('昵称')).toBeNull()
    expect(screen.queryByLabelText('邀请码')).toBeNull()
  })

  it('validates email format on the client before login submit', async () => {
    const login = vi.fn()

    useAuthMock.mockReturnValue(
      buildAuthMock({
        login,
      }),
    )

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<UnifiedAuthCard initialMethod="email" />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('邮箱地址'), {
      target: { value: 'invalid-email' },
    })
    fireEvent.change(screen.getByLabelText('密码'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: '入场' }))

    await waitFor(() => {
      expect(screen.getByText('请输入有效的邮箱地址')).toBeTruthy()
    })

    expect(login).not.toHaveBeenCalled()
  })

  it('renders wechat login as a disabled auth panel with helper copy', () => {
    useAuthMock.mockReturnValue(buildAuthMock())

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<UnifiedAuthCard initialMethod="wechat" />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('微信扫码区域')).toBeTruthy()
    expect(screen.getByText('暂时不可扫码，请先使用手机号或邮箱登录')).toBeTruthy()
    expect(screen.getByRole('button', { name: '即将开放' })).toHaveProperty('disabled', true)
  })

  it('shows the dev tools panel by default in development', () => {
    useAuthMock.mockReturnValue(buildAuthMock())

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<UnifiedAuthCard initialMethod="email" />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Dev Tools')).toBeTruthy()
  })

  it('uses script font only for nickname fields after blur', () => {
    useAuthMock.mockReturnValue(buildAuthMock())

    render(
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route
            path="/register"
            element={<UnifiedAuthCard initialMethod="email" initialIntent="register" />}
          />
        </Routes>
      </MemoryRouter>,
    )

    const emailInput = screen.getByLabelText('邮箱地址') as HTMLInputElement
    const displayNameInput = screen.getByLabelText('昵称') as HTMLInputElement

    fireEvent.change(emailInput, {
      target: { value: 'new-user@example.com' },
    })
    fireEvent.focus(displayNameInput)
    fireEvent.change(displayNameInput, {
      target: { value: 'New User' },
    })

    expect(emailInput.className).not.toContain('auth-card-input-script')
    expect(displayNameInput.className).not.toContain('auth-card-input-script')

    fireEvent.blur(emailInput)
    fireEvent.blur(displayNameInput)

    expect(emailInput.className).not.toContain('auth-card-input-script')
    expect(displayNameInput.className).toContain('auth-card-input-script')

    fireEvent.focus(displayNameInput)
    expect(displayNameInput.className).not.toContain('auth-card-input-script')
  })

  it('expands phone registration details after first-time verification', async () => {
    const sendSmsCode = vi.fn().mockResolvedValue({
      challengeId: 'sms-challenge-1',
      maskedTarget: '138****0000',
      expiresInSec: 600,
      resendAfterSec: 60,
    })
    const verifySmsCode = vi
      .fn()
      .mockRejectedValueOnce(createApiError('首次使用手机号注册时需要填写昵称', 'DISPLAY_NAME_REQUIRED'))
      .mockResolvedValueOnce({
        isNewUser: true,
        user: {
          id: 'user-1',
          email: null,
          phone: '13800138000',
          displayName: 'Phone User',
          avatarUrl: null,
          planTier: 'FREE',
          role: 'user',
        },
        token: 'token-1',
      })

    useAuthMock.mockReturnValue(
      buildAuthMock({
        sendSmsCode,
        verifySmsCode,
      }),
    )

    render(
      <MemoryRouter initialEntries={['/login?invite=100002']}>
        <Routes>
          <Route path="/login" element={<UnifiedAuthCard initialMethod="phone" />} />
          <Route path="/" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('手机号'), {
      target: { value: '13800138000' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送验证码' }))

    await waitFor(() => {
      expect(sendSmsCode).toHaveBeenCalledWith({
        phone: '13800138000',
        inviteCode: '100002',
      })
    })

    fireEvent.change(screen.getByLabelText('验证码'), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByRole('button', { name: '入场' }))

    await waitFor(() => {
      expect(screen.getByText('这是首次使用，请补全昵称和邀请码后完成创建。')).toBeTruthy()
    })

    expect((screen.getByLabelText('邀请码') as HTMLInputElement).value).toBe('100002')

    fireEvent.change(screen.getByLabelText('昵称'), {
      target: { value: 'Phone User' },
    })
    fireEvent.click(screen.getByRole('button', { name: '完成创建并入场' }))

    await waitFor(() => {
      expect(verifySmsCode).toHaveBeenLastCalledWith({
        challengeId: 'sms-challenge-1',
        code: '123456',
        displayName: 'Phone User',
        inviteCode: '100002',
      })
    })
  })

  it('supports dev auth panel helpers for phone registration flows', async () => {
    useAuthMock.mockReturnValue(buildAuthMock())

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<UnifiedAuthCard initialMethod="phone" />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: '模拟手机首次使用' }))

    await waitFor(() => {
      expect(screen.getByText('这是首次使用，请补全昵称和邀请码后完成创建。')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: '自动填入验证码' }))

    expect((screen.getByLabelText('验证码') as HTMLInputElement).value).toBe('123456')
  })

  it('supports resetting password through email verification', async () => {
    const startEmailPasswordReset = vi.fn().mockResolvedValue({
      challengeId: 'reset-challenge-1',
      maskedTarget: 'us***@example.com',
      expiresInSec: 600,
      resendAfterSec: 60,
    })
    const verifyEmailPasswordReset = vi.fn().mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'user@example.com',
        phone: null,
        displayName: 'Forum User',
        avatarUrl: null,
        planTier: 'FREE',
        role: 'user',
      },
      token: 'token-1',
    })

    useAuthMock.mockReturnValue(
      buildAuthMock({
        startEmailPasswordReset,
        verifyEmailPasswordReset,
      }),
    )

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<UnifiedAuthCard initialMethod="email" />} />
          <Route path="/" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: '忘记密码？' }))
    fireEvent.change(screen.getByLabelText('邮箱地址'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送重置验证码' }))

    await waitFor(() => {
      expect(startEmailPasswordReset).toHaveBeenCalledWith({
        email: 'user@example.com',
      })
    })

    fireEvent.change(screen.getByLabelText('新密码'), {
      target: { value: 'newpassword123' },
    })
    fireEvent.change(screen.getByLabelText('确认新密码'), {
      target: { value: 'newpassword123' },
    })
    fireEvent.change(screen.getByLabelText('邮箱验证码'), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByRole('button', { name: '验证并更新密码' }))

    await waitFor(() => {
      expect(verifyEmailPasswordReset).toHaveBeenCalledWith({
        challengeId: 'reset-challenge-1',
        code: '123456',
        password: 'newpassword123',
      })
    })
  })
})
