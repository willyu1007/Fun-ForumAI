import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminUserSummary } from '@/api/types'
import {
  useAdminUsers,
  useGrantAdminAccess,
  useRevokeAdminAccess,
} from '@/api/hooks'
import { AdminUsersTab } from '../AdminUsersTab'

vi.mock('@/api/hooks', () => ({
  useAdminUsers: vi.fn(),
  useGrantAdminAccess: vi.fn(),
  useRevokeAdminAccess: vi.fn(),
}))

const useAdminUsersMock = vi.mocked(useAdminUsers)
const useGrantAdminAccessMock = vi.mocked(useGrantAdminAccess)
const useRevokeAdminAccessMock = vi.mocked(useRevokeAdminAccess)

const bootstrapAdmin: AdminUserSummary = {
  id: 'admin-root',
  email: 'root@example.com',
  phone: null,
  displayName: 'Root Admin',
  planTier: 'ADMIN',
  status: 'ACTIVE',
  isBootstrapAdmin: true,
  lastLoginAt: '2026-04-02T10:00:00.000Z',
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-04-02T10:00:00.000Z',
}

describe('AdminUsersTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('grants admin access by email', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      data: {
        ...bootstrapAdmin,
        id: 'admin-2',
        email: 'operator@example.com',
        displayName: 'Operator',
        isBootstrapAdmin: false,
      },
    })

    useAdminUsersMock.mockReturnValue({
      data: { data: [bootstrapAdmin] },
      isLoading: false,
      error: null,
    } as never)
    useGrantAdminAccessMock.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never)
    useRevokeAdminAccessMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never)

    render(<AdminUsersTab />)

    fireEvent.change(screen.getByLabelText('管理员邮箱'), {
      target: { value: 'operator@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: '授予管理员' }))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ email: 'operator@example.com' })
      expect(screen.getByText('已授予管理员：Operator')).toBeTruthy()
    })
  })

  it('renders bootstrap admins as protected and revokes regular admins', async () => {
    const revokeAsync = vi.fn().mockResolvedValue({
      data: {
        ...bootstrapAdmin,
        id: 'admin-2',
        email: 'operator@example.com',
        displayName: 'Operator',
        isBootstrapAdmin: false,
        planTier: 'FREE',
      },
    })

    useAdminUsersMock.mockReturnValue({
      data: {
        data: [
          bootstrapAdmin,
          {
            ...bootstrapAdmin,
            id: 'admin-2',
            email: 'operator@example.com',
            displayName: 'Operator',
            isBootstrapAdmin: false,
          },
        ],
      },
      isLoading: false,
      error: null,
    } as never)
    useGrantAdminAccessMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never)
    useRevokeAdminAccessMock.mockReturnValue({
      mutateAsync: revokeAsync,
      isPending: false,
    } as never)

    render(<AdminUsersTab />)

    expect(screen.getByRole('button', { name: 'Bootstrap 保护中' }).hasAttribute('disabled')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: '撤销管理员' }))

    await waitFor(() => {
      expect(revokeAsync).toHaveBeenCalledWith({ userId: 'admin-2' })
      expect(screen.getByText('已撤销管理员：Operator')).toBeTruthy()
    })
  })
})
