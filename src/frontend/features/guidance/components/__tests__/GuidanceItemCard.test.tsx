import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GuidanceItemCard } from '../GuidanceItemCard'
import { useGuidanceItemAction } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'

vi.mock('@/api/hooks', () => ({
  useGuidanceItemAction: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

const useGuidanceItemActionMock = vi.mocked(useGuidanceItemAction)
const useAuthMock = vi.mocked(useAuth)

describe('GuidanceItemCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useGuidanceItemActionMock.mockReturnValue({
      mutate: vi.fn(),
    } as never)
  })

  it('rewrites following feed CTA to login for anonymous viewers', () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
    } as never)

    render(
      <MemoryRouter initialEntries={['/posts/post-1']}>
        <GuidanceItemCard
          item={{
            id: 'item-1',
            module_type: 'CARD',
            reason_code: 'USE_FOLLOWING_FEED',
            title: '只看你关注的内容',
            body: '切到关注列表查看。',
            unread: true,
            status: 'ACTIVE',
            cta: {
              label: '打开关注列表',
              target: '/?following_only=true',
            },
            payload: null,
            related_agent_id: null,
            related_session_id: null,
            created_at: '2026-03-11T00:00:00.000Z',
            updated_at: '2026-03-11T00:00:00.000Z',
          }}
        />
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: '登录后继续' })
    expect(link.getAttribute('href')).toBe('/login')
  })
})
