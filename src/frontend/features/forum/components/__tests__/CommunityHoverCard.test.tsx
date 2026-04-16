import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommunityHoverCard } from '../CommunityHoverCard'
import { useCommunityBySlug } from '@/api/hooks'
import { useFollowCommunity, useFollowingCommunitiesList, useUnfollowCommunity } from '@/api/hooks/user'
import { useAuth } from '@/shared/hooks/use-auth'

vi.mock('@/api/hooks', () => ({
  useCommunityBySlug: vi.fn(),
}))

vi.mock('@/api/hooks/user', () => ({
  useFollowCommunity: vi.fn(),
  useFollowingCommunitiesList: vi.fn(),
  useUnfollowCommunity: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/components/ui/hover-card', () => ({
  HoverCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  HoverCardTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  HoverCardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

const useCommunityBySlugMock = vi.mocked(useCommunityBySlug)
const useFollowCommunityMock = vi.mocked(useFollowCommunity)
const useFollowingCommunitiesListMock = vi.mocked(useFollowingCommunitiesList)
const useUnfollowCommunityMock = vi.mocked(useUnfollowCommunity)
const useAuthMock = vi.mocked(useAuth)

describe('CommunityHoverCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a clean community summary and supports unsubscribing for authenticated viewers', () => {
    const unfollowMutate = vi.fn()

    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'viewer-1' },
    } as never)
    useCommunityBySlugMock.mockReturnValue({
      data: {
        id: 'community-1',
        name: 'Rust Lab',
        slug: 'rust-lab',
        description: '系统编程与编译器实践。',
        rules_json: null,
        active_member_count: 42,
        visibility_default: 'PUBLIC',
        created_at: '2026-04-01T00:00:00.000Z',
        updated_at: '2026-04-01T00:00:00.000Z',
        community_semantics: {
          community_family: 'values_debate',
          community_shell_category: 'theme',
          publication_review_profile_id: 'standard_publication',
          default_editorial_shelf_ids: ['all_communities'],
        },
        interaction_contract: {
          public_participation_mode: 'audience_sidecar',
          audience_signal_ingestion: 'summary_only',
          agent_human_response_mode: 'aftershow_only',
        },
      },
      isLoading: false,
    } as never)
    useFollowingCommunitiesListMock.mockReturnValue({
      data: {
        data: [{ id: 'community-1', name: 'Rust Lab', slug: 'rust-lab' }],
      },
    } as never)
    useFollowCommunityMock.mockReturnValue({
      isPending: false,
      mutate: vi.fn(),
    } as never)
    useUnfollowCommunityMock.mockReturnValue({
      isPending: false,
      mutate: unfollowMutate,
    } as never)

    render(
      <MemoryRouter initialEntries={['/search?q=rust&tab=communities']}>
        <CommunityHoverCard
          slug="rust-lab"
          preview={{
            id: 'community-1',
            name: 'Rust Lab',
            slug: 'rust-lab',
            description: '系统编程与编译器实践。',
            active_member_count: 42,
            activity_7d: 18,
          }}
        >
          <button type="button">trigger</button>
        </CommunityHoverCard>
      </MemoryRouter>,
    )

    expect(screen.getByText('Rust Lab')).toBeTruthy()
    expect(screen.getByText('公开 · 2026年04月创建')).toBeTruthy()
    expect(screen.getByText('主题：圆桌议题 · 价值辩论')).toBeTruthy()
    expect(screen.getByText('观众观点会被摘要吸收，通常在场后被纳入回应。')).toBeTruthy()
    expect(screen.getByText('155')).toBeTruthy()
    expect(screen.getByText('95')).toBeTruthy()
    expect(screen.getByText('活跃成员')).toBeTruthy()
    expect(screen.getByText('周活跃')).toBeTruthy()
    expect(screen.getByRole('link', { name: '进入社区' }).getAttribute('href')).toBe('/c/rust-lab')

    fireEvent.click(screen.getByRole('button', { name: '已订阅' }))
    expect(unfollowMutate).toHaveBeenCalledTimes(1)
  })

  it('renders a login subscribe action for anonymous viewers', () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
      user: null,
    } as never)
    useCommunityBySlugMock.mockReturnValue({
      data: {
        id: 'community-1',
        name: 'Rust Lab',
        slug: 'rust-lab',
        description: '系统编程与编译器实践。',
        rules_json: null,
        active_member_count: 42,
        visibility_default: 'PUBLIC',
        created_at: '2026-04-01T00:00:00.000Z',
        updated_at: '2026-04-01T00:00:00.000Z',
        community_semantics: {
          community_family: 'values_debate',
          community_shell_category: 'theme',
          publication_review_profile_id: 'standard_publication',
          default_editorial_shelf_ids: ['all_communities'],
        },
        interaction_contract: {
          public_participation_mode: 'audience_sidecar',
          audience_signal_ingestion: 'summary_only',
          agent_human_response_mode: 'aftershow_only',
        },
      },
      isLoading: false,
    } as never)
    useFollowingCommunitiesListMock.mockReturnValue({
      data: { data: [] },
    } as never)
    useFollowCommunityMock.mockReturnValue({
      isPending: false,
      mutate: vi.fn(),
    } as never)
    useUnfollowCommunityMock.mockReturnValue({
      isPending: false,
      mutate: vi.fn(),
    } as never)

    render(
      <MemoryRouter initialEntries={['/search?q=rust&tab=communities']}>
        <CommunityHoverCard slug="rust-lab">
          <button type="button">trigger</button>
        </CommunityHoverCard>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: '订阅' }).getAttribute('href')).toBe('/login')
  })
})
