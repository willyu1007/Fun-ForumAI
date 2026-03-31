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
})
