import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { useRecordSearchTelemetry, useSearch, useSearchInfinite } from '@/api/hooks'
import { buildAgentTarget } from '@/shared/utils/agent-target'
import { SearchPage } from '../SearchPage'

vi.mock('@/api/hooks', () => ({
  useSearch: vi.fn(),
  useSearchInfinite: vi.fn(),
  useRecordSearchTelemetry: vi.fn(),
  useFollowAgent: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUnfollowAgent: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(() => ({ isAuthenticated: true })),
}))

vi.mock('@/features/agents/components/AgentHoverCard', () => ({
  AgentHoverCard: ({ children, agentId }: { children: ReactNode; agentId: string }) => (
    <div data-testid="agent-hover-card" data-agent-id={agentId}>
      {children}
    </div>
  ),
}))

vi.mock('@/features/agents/components/AgentLink', () => ({
  AgentLink: ({
    children,
    agentId,
    className,
    onClick,
    ...props
  }: {
    children: ReactNode
    agentId: string
    className?: string
    onClick?: () => void
  }) => (
    <button
      type="button"
      data-testid={`agent-link-${agentId}`}
      className={className}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  ),
}))

vi.mock('@/features/forum/components/AgentSentimentBar', () => ({
  AgentSentimentBar: ({
    agentUp,
    agentDown,
    className,
  }: {
    agentUp: number
    agentDown: number
    className?: string
  }) => (
    <div data-testid="agent-sentiment-bar" className={className}>
      {agentUp}/{agentDown}
    </div>
  ),
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

const useSearchInfiniteMock = vi.mocked(useSearchInfinite)
const useSearchMock = vi.mocked(useSearch)
const useRecordSearchTelemetryMock = vi.mocked(useRecordSearchTelemetry)

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>
}

function readProbeSearchParams(): URLSearchParams {
  const raw = screen.getByTestId('location-probe').textContent ?? '/search'
  const url = new URL(raw, 'https://fun-forum.test')
  return url.searchParams
}

function renderSearchPage(initialEntry: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/search',
        element: (
          <>
            <SearchPage />
            <LocationProbe />
          </>
        ),
      },
    ],
    {
      initialEntries: [initialEntry],
    },
  )

  render(<RouterProvider router={router} />)
  return router
}

describe('SearchPage', () => {
  const telemetryMutation = {
    mutate: vi.fn(),
  }

  useRecordSearchTelemetryMock.mockReturnValue(telemetryMutation as never)

  function mockInfiniteSearch(pageData: Record<string, unknown>) {
    useSearchInfiniteMock.mockReturnValue({
      data: {
        pages: [{ data: pageData }],
        pageParams: [undefined],
      },
      isLoading: false,
      isError: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    } as never)
  }

  function mockSidebarCommunities(items: Record<string, unknown>[] = []) {
    useSearchMock.mockReturnValue({
      data: {
        data: {
          items,
        },
      },
      isLoading: false,
      isError: false,
    } as never)
  }

  it('renders enriched agent results and tab counts without changing the route contract', () => {
    mockSidebarCommunities()
    mockInfiniteSearch({
      query: 'talk show',
      normalized_query: 'talk show',
      current_tab: 'agents',
      counts: { posts: 2, communities: 1, agents: 1, threads: 3 },
      items: [
        {
          type: 'agent',
          id: 'agent-1',
          href: buildAgentTarget({ agentId: 'agent-1', mode: 'readonly' }),
          display_name: 'Agent 1',
          avatar_url: null,
          status: 'ACTIVE',
          display_badges: ['Resident'],
          persona_seed_label: '毒舌主持',
          home_voice_line_label: '总能接住梗',
          tagline: '会把火花抬高半格',
          badges: [{ code: 'host', name: '主持', tier: 2 }],
          active_communities: [{ id: 'community-1', name: 'Community 1', slug: 'community-1' }],
          public_activity_score: 4.5,
          is_followed: true,
          score: 1.25,
          snippet: '更适合 TALK_SHOW · 常站 HOST · 在 talk show 里接住爆梗',
          highlights: [{ field: 'projection', snippet: '更适合 TALK_SHOW · 常站 HOST' }],
          match_reasons: ['命中公域投射', '命中公共经历', '命中常驻社区'],
          match_reason_codes: ['projection', 'chronicle', 'active_community'],
        },
      ],
      discovery: null,
      cursor: null,
      took_ms: 12,
    })

    renderSearchPage('/search?q=talk%20show&tab=agents')

    expect(screen.getByText('Agent 1')).toBeTruthy()
    expect(screen.getByText('Resident')).toBeTruthy()
    expect(screen.getByText('Community 1')).toBeTruthy()
    expect(screen.getByText('会把火花抬高半格')).toBeTruthy()
    expect(screen.getByText('已关注')).toBeTruthy()
  })

  it('reads tab and query from URL search params', () => {
    mockSidebarCommunities()
    mockInfiniteSearch({
      query: 'talk show',
      normalized_query: 'talk show',
      current_tab: 'agents',
      counts: { posts: 2, communities: 1, agents: 1, threads: 3 },
      items: [],
      discovery: null,
      cursor: null,
      took_ms: 8,
    })

    renderSearchPage('/search?q=talk%20show&tab=agents')

    const params = readProbeSearchParams()
    expect(params.get('q')).toBe('talk show')
    expect(params.get('tab')).toBe('agents')

    const agentsTab = screen.getByRole('tab', { name: /智能体/ })
    expect(agentsTab.getAttribute('class') ?? '').toContain('bg-foreground')

    expect(screen.getByTestId('search-page')).toBeTruthy()
  })

  it('renders blank-query discovery suggestions and featured sections', () => {
    mockSidebarCommunities()
    mockInfiniteSearch({
      query: '',
      normalized_query: '',
      current_tab: 'posts',
      counts: { posts: 0, communities: 0, agents: 0, threads: 0 },
      items: [],
      discovery: {
        suggested_queries: ['talk show', 'Community 1'],
        featured_posts: [{
          type: 'post',
          id: 'post-1',
          href: '/posts/post-1',
          title: '精选帖子标题',
          score: 2.1,
          snippet: '精选帖子摘要',
          highlights: [],
          match_reasons: [],
          match_reason_codes: [],
          community: { id: 'community-1', name: 'Community 1', slug: 'community-1' },
          author: { id: 'agent-1', display_name: 'Agent 1', avatar_url: null },
          author_visibility: 'full',
          thread_turn_count: 3,
          heat_score: 42,
          last_activity_at: null,
        }],
        featured_communities: [],
        featured_agents: [],
      },
      cursor: null,
      took_ms: 6,
    })

    renderSearchPage('/search')

    expect(screen.getByRole('button', { name: 'talk show' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '精选帖子' })).toBeTruthy()
    expect(screen.getByText('精选帖子标题')).toBeTruthy()
  })

  it('renders community sidebar avatars with object-cover to avoid vertical stretching', () => {
    mockInfiniteSearch({
      query: 'rust',
      normalized_query: 'rust',
      current_tab: 'posts',
      counts: { posts: 1, communities: 1, agents: 0, threads: 0 },
      items: [],
      discovery: null,
      cursor: null,
      took_ms: 10,
    })
    mockSidebarCommunities([
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
    ])

    renderSearchPage('/search?q=rust&tab=posts')

    const avatarImage = screen.getByAltText('Rust Lab')
    expect(avatarImage.getAttribute('class') ?? '').toContain('object-cover')
  })

  it('renders agent results with hover cards and separate avatar/name entry points', () => {
    mockSidebarCommunities()
    mockInfiniteSearch({
      query: 'talk show',
      normalized_query: 'talk show',
      current_tab: 'agents',
      counts: { posts: 0, communities: 0, agents: 1, threads: 0 },
      items: [
        {
          type: 'agent',
          id: 'agent-1',
          href: buildAgentTarget({ agentId: 'agent-1', mode: 'readonly' }),
          display_name: 'Agent 1',
          avatar_url: null,
          status: 'ACTIVE',
          persona_seed_label: '毒舌主持',
          home_voice_line_label: '总能接住梗',
          tagline: '会把火花抬高半格',
          public_bio: '公开介绍',
          badges: [],
          active_communities: [],
          public_activity_score: 3.4,
          is_followed: false,
          score: 1.1,
          snippet: '公开介绍',
          highlights: [],
          match_reasons: ['命中公域投射'],
          match_reason_codes: ['projection'],
        },
      ],
      discovery: null,
      cursor: null,
      took_ms: 9,
    })

    renderSearchPage('/search?q=talk%20show&tab=agents')

    expect(screen.getAllByTestId('agent-hover-card')).toHaveLength(2)
    expect(screen.getAllByTestId('agent-link-agent-1')).toHaveLength(2)
    expect(screen.getByText('公开介绍')).toBeTruthy()
  })

  it('renders post results with homepage-style agent sentiment bar', () => {
    mockSidebarCommunities()
    mockInfiniteSearch({
      query: 'rust',
      normalized_query: 'rust',
      current_tab: 'posts',
      counts: { posts: 1, communities: 0, agents: 0, threads: 0 },
      items: [
        {
          type: 'post',
          id: 'post-1',
          href: '/posts/post-1',
          title: 'Rust 图搜索',
          score: 1.4,
          snippet: '只显示纯文本摘要',
          highlights: [],
          match_reasons: ['命中标题'],
          match_reason_codes: ['title'],
          community: { id: 'community-1', name: 'Rust Lab', slug: 'rust-lab' },
          author: { id: 'agent-2', display_name: 'Agent 2', avatar_url: null },
          author_visibility: 'full',
          thread_turn_count: 3,
          heat_score: 18,
          last_activity_at: null,
          thumbnail_url: '/thumb.png',
          agent_vote_up: 9,
          agent_vote_down: 4,
        },
      ],
      discovery: null,
      cursor: null,
      took_ms: 9,
    })

    renderSearchPage('/search?q=rust&tab=posts')

    expect(screen.getByTestId('agent-sentiment-bar').textContent).toBe('9/4')
    expect(screen.getAllByTestId('agent-link-agent-2')).toHaveLength(2)
    const thumbnail = screen.getByAltText('')
    expect(thumbnail.getAttribute('class') ?? '').toContain('h-[80px]')
    expect(thumbnail.getAttribute('class') ?? '').toContain('rounded-md')
  })

  it('does not render avatar or profile links for restricted authors in search results', () => {
    mockSidebarCommunities()
    mockInfiniteSearch({
      query: 'late night',
      normalized_query: 'late night',
      current_tab: 'posts',
      counts: { posts: 1, communities: 0, agents: 0, threads: 0 },
      items: [
        {
          type: 'post',
          id: 'post-1',
          href: '/posts/post-1',
          title: 'Late Night Set',
          score: 1.2,
          snippet: 'restricted author should stay text-only',
          highlights: [],
          match_reasons: ['命中标题'],
          match_reason_codes: ['title'],
          community: { id: 'community-1', name: 'Comedy', slug: 'comedy' },
          author: { id: 'agent-restricted', display_name: 'Restricted Agent', avatar_url: null },
          author_visibility: 'restricted',
          thread_turn_count: 2,
          heat_score: 10,
          last_activity_at: null,
          thumbnail_url: null,
          agent_vote_up: 3,
          agent_vote_down: 1,
        },
      ],
      discovery: null,
      cursor: null,
      took_ms: 7,
    })

    renderSearchPage('/search?q=late%20night&tab=posts')

    expect(screen.queryByTestId('agent-link-agent-restricted')).toBeNull()
    expect(screen.queryByAltText('Restricted Agent')).toBeNull()
    expect(screen.getByText('Restricted Agent')).toBeTruthy()
  })

  it('renders the community sidebar as a fixed darker rail instead of a rounded card', () => {
    mockInfiniteSearch({
      query: 'rust',
      normalized_query: 'rust',
      current_tab: 'posts',
      counts: { posts: 1, communities: 1, agents: 0, threads: 0 },
      items: [],
      discovery: null,
      cursor: null,
      took_ms: 10,
    })
    mockSidebarCommunities([
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
    ])

    renderSearchPage('/search?q=rust&tab=posts')

    const sidebarHeading = screen.getByRole('heading', { name: '社区' })
    const aside = sidebarHeading.closest('aside')
    expect(aside?.getAttribute('class') ?? '').toContain('self-stretch')
    const stickyRail = sidebarHeading.parentElement?.parentElement
    expect(stickyRail?.getAttribute('class') ?? '').toContain('sticky')
    expect(stickyRail?.getAttribute('class') ?? '').toContain('bg-muted/70')
    expect(stickyRail?.getAttribute('class') ?? '').toContain('overflow-hidden')
    expect(sidebarHeading.parentElement?.getAttribute('class') ?? '').not.toContain('rounded-xl')
    expect(within(sidebarHeading.parentElement as HTMLElement).getByText('Rust Lab')).toBeTruthy()
  })
})
