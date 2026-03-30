import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmailLoginForm } from '../EmailLoginForm'
import { EmailRegisterForm } from '../EmailRegisterForm'
import { useAuth } from '@/shared/hooks/use-auth'

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

const useAuthMock = vi.mocked(useAuth)

function LocationProbe() {
  const location = useLocation()
  return <div>{`${location.pathname}${location.search}`}</div>
}

describe('auth redirect forms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects login to returnTo before from', async () => {
    const login = vi.fn().mockResolvedValue(undefined)
    useAuthMock.mockReturnValue({
      login,
      isLoginPending: false,
    } as never)

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
          <Route path="/login" element={<EmailLoginForm />} />
          <Route path="/" element={<LocationProbe />} />
          <Route path="/posts/:postId" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('邮箱地址'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText('密码'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: '登 录' }))

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password123',
      })
    })

    await waitFor(() => {
      expect(screen.getByText('/?following_only=true')).toBeTruthy()
    })
  })

  it('redirects register to from when no returnTo is present', async () => {
    const startEmailRegistration = vi.fn().mockResolvedValue({
      challengeId: 'challenge-1',
      maskedTarget: 'us***@example.com',
      expiresInSec: 600,
      resendAfterSec: 60,
    })
    const verifyEmailRegistration = vi.fn().mockResolvedValue(undefined)
    useAuthMock.mockReturnValue({
      startEmailRegistration,
      verifyEmailRegistration,
      resendEmailRegistration: vi.fn(),
      isEmailRegisterStartPending: false,
      isEmailRegisterVerifyPending: false,
      isEmailRegisterResendPending: false,
      isRegisterPending: false,
    } as never)

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
          <Route path="/register" element={<EmailRegisterForm />} />
          <Route path="/" element={<LocationProbe />} />
          <Route path="/posts/:postId" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('昵称'), {
      target: { value: 'Forum User' },
    })
    fireEvent.change(screen.getByLabelText('邮箱地址'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText('密码'), {
      target: { value: 'password123' },
    })
    fireEvent.change(screen.getByLabelText('确认密码'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送验证码' }))
    await waitFor(() => {
      expect(startEmailRegistration).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password123',
        displayName: 'Forum User',
      })
    })

    fireEvent.change(screen.getByLabelText('邮箱验证码'), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByRole('button', { name: '验证并注册' }))

    await waitFor(() => {
      expect(verifyEmailRegistration).toHaveBeenCalledWith({
        challengeId: 'challenge-1',
        code: '123456',
      })
    })

    await waitFor(() => {
      expect(screen.getByText('/posts/post-1')).toBeTruthy()
    })
  })
})
