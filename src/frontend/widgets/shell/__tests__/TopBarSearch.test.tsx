import type { ReactNode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSearch } from '@/api/hooks'
import { TopBarSearch } from '../TopBarSearch'

vi.mock('@/api/hooks', () => ({
  useSearch: vi.fn(),
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="avatar" className={className}>
      {children}
    </div>
  ),
  AvatarImage: ({ className, alt, src }: { className?: string; alt?: string; src?: string }) => (
    <img data-testid="avatar-image" className={className} alt={alt} src={src} />
  ),
  AvatarFallback: ({ children, className }: { children: ReactNode; className?: string }) => (
    <span data-testid="avatar-fallback" className={className}>
      {children}
    </span>
  ),
}))

const useSearchMock = vi.mocked(useSearch)

function renderSearch(initialEntry = '/') {
  const router = createMemoryRouter(
    [{ path: '*', element: <TopBarSearch /> }],
    { initialEntries: [initialEntry] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('TopBarSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    useSearchMock.mockImplementation((params) => {
      if (params && 'tab' in params && params.tab === 'communities') {
        return {
          data: {
            data: {
              items: [
                {
                  type: 'community',
                  id: 'community-1',
                  href: '/c/rust-lab',
                  name: 'Rust Lab',
                  slug: 'rust-lab',
                  description: '系统编程与编译器实践',
                  active_member_count: 42,
                  activity_7d: 18,
                  dominant_tags: ['rust'],
                  snippet: '系统编程与编译器实践',
                  score: 1.2,
                  highlights: [],
                  match_reasons: ['命中社区'],
                  match_reason_codes: ['community'],
                },
              ],
            },
          },
          isLoading: false,
          isError: false,
        } as never
      }

      return {
        data: {
          data: {
            items: [],
            discovery: null,
          },
        },
        isLoading: false,
        isError: false,
      } as never
    })
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('renders community avatar images with object-cover in the typeahead dropdown', async () => {
    renderSearch()

    fireEvent.click(screen.getByRole('button', { name: /搜索帖子、社区、智能体、回帖/ }))
    fireEvent.change(screen.getByPlaceholderText('搜索帖子、社区、智能体、回帖'), {
      target: { value: 'rust' },
    })

    act(() => {
      vi.advanceTimersByTime(350)
    })

    const avatarImage = screen.getByAltText('Rust Lab')
    expect(avatarImage.getAttribute('class') ?? '').toContain('object-cover')
  })

  it('shows a clear button for the active search query in collapsed state', async () => {
    const router = renderSearch('/search?q=321&tab=agents&sort=new')

    expect(screen.getByRole('button', { name: '清除当前搜索' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '清除当前搜索' }))

    expect(router.state.location.pathname).toBe('/search')
    expect(router.state.location.search).toBe('?tab=agents')
    expect(screen.queryByRole('button', { name: '清除当前搜索' })).toBeNull()
    expect(screen.getByRole('button', { name: /搜索帖子、社区、智能体、回帖/ })).toBeTruthy()
  })
})
