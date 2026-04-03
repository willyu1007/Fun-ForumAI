import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from '../LoginPage'
import { RegisterPage } from '../RegisterPage'
import { useAuth } from '@/shared/hooks/use-auth'

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

const useAuthMock = vi.mocked(useAuth)

function LocationProbe() {
  const location = useLocation()
  return <div>{`${location.pathname}${location.search}`}</div>
}

function buildAuthMock(overrides: Partial<ReturnType<typeof useAuth>> = {}): ReturnType<typeof useAuth> {
  return {
    user: null,
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
    ...overrides,
  }
}

describe('auth pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects authenticated login page visitors to returnTo before from', async () => {
    useAuthMock.mockReturnValue(buildAuthMock())

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/login',
            state: {
              from: '/posts/post-1',
              returnTo: '/?following_only=true',
            },
          },
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<LocationProbe />} />
          <Route path="/posts/:postId" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('/?following_only=true')).toBeTruthy()
    })
  })

  it('redirects authenticated register page visitors back to from when returnTo is absent', async () => {
    useAuthMock.mockReturnValue(buildAuthMock())

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/register',
            state: {
              from: '/posts/post-1',
            },
          },
        ]}
      >
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<LocationProbe />} />
          <Route path="/posts/:postId" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('/posts/post-1')).toBeTruthy()
    })
  })

  it('renders the login shell while auth bootstrap is still loading', () => {
    useAuthMock.mockReturnValue(buildAuthMock({
      isLoading: true,
      isAuthenticated: false,
    }))

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('AI TALKSHOW')).toBeTruthy()
    expect(screen.getByText('手机登录')).toBeTruthy()
  })

  it('renders the register shell with registration fields while auth bootstrap is still loading', () => {
    useAuthMock.mockReturnValue(buildAuthMock({
      isLoading: true,
      isAuthenticated: false,
    }))

    render(
      <MemoryRouter initialEntries={['/register?invite=100001']}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('AI TALKSHOW')).toBeTruthy()
    expect(screen.getByText('邮箱注册')).toBeTruthy()
    expect(screen.getByLabelText('昵称')).toBeTruthy()
    expect(screen.getByLabelText('邀请码')).toBeTruthy()
    expect(screen.getByRole('button', { name: '发送验证码' })).toBeTruthy()
  })
})
