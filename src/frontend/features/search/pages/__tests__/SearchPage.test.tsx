import type { ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRecordSearchTelemetry, useSearch, useSearchInfinite } from '@/api/hooks'
import { buildAgentTarget } from '@/shared/utils/agent-target'
import { SearchPage } from '../SearchPage'

vi.mock('@/api/hooks', () => ({
  useSearch: vi.fn(),
  useSearchInfinite: vi.fn(),
  useRecordSearchTelemetry: vi.fn(),
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

vi.mock('@/features/forum/components/CommunityHoverCard', () => ({
  CommunityHoverCard: ({
    children,
    slug,
  }: {
    children: ReactNode
    slug: string
  }) => (
    <div data-testid="community-hover-card" data-community-slug={slug}>
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
const originalInnerWidth = window.innerWidth
const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect

const SEARCH_EXPLANATION_FIXTURES = {
  title: { label: '命中标题', kind: 'lexical' },
  community: { label: '命中社区', kind: 'semantic' },
  author_public_projection: { label: '命中公域投射', kind: 'projection' },
  chronicle: { label: '命中公共经历', kind: 'semantic' },
  active_community: { label: '命中常驻社区', kind: 'semantic' },
} as const

function buildMatchExplanations(
  ...codes: Array<keyof typeof SEARCH_EXPLANATION_FIXTURES>
) {
  return codes.map((code) => ({
    code,
    label: SEARCH_EXPLANATION_FIXTURES[code].label,
    kind: SEARCH_EXPLANATION_FIXTURES[code].kind,
  }))
}

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
      {
        path: '/posts/:postId',
        element: <LocationProbe />,
      },
      {
        path: '/c/:communitySlug',
        element: <LocationProbe />,
      },
      {
        path: '/recommended',
        element: <LocationProbe />,
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

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1280,
    })

    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this.tagName === 'ASIDE' && this.getAttribute('aria-hidden') === 'true') {
        return {
          x: 900,
          y: 120,
          width: 360,
          height: 640,
          top: 120,
          right: 1260,
          bottom: 760,
          left: 900,
          toJSON: () => ({}),
        } as DOMRect
      }

      return originalGetBoundingClientRect.call(this)
    }
  })

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    })
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
  })

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
          public_identity: {
            agent_kind: 'system',
            identity_badges: [{
              badge_id: 'identity:resident',
              internal_code: 'resident_badge',
              label: '常驻席',
              source_kind: 'system_display',
              priority_rank: 200,
            }],
            identity_visibility_role_id: 'resident',
          },
          persona_seed_label: '毒舌主持',
          home_voice_line_label: '总能接住梗',
          public_projection: {
            tagline: '会把火花抬高半格',
          },
          public_proof: {
            achievement_badges: [{ code: 'host', name: '主持', level: 2 }],
          },
          active_communities: [{ id: 'community-1', name: 'Community 1', slug: 'community-1' }],
          public_activity_score: 4.5,
          is_followed: true,
          score: 1.25,
          snippet: '更适合 TALK_SHOW · 常站 HOST · 在 talk show 里接住爆梗',
          highlights: [{ field: 'author_public_projection', snippet: '更适合 TALK_SHOW · 常站 HOST' }],
          match_explanations: buildMatchExplanations('author_public_projection', 'chronicle', 'active_community'),
          match_reasons: ['命中公域投射', '命中公共经历', '命中常驻社区'],
          match_reason_codes: ['author_public_projection', 'chronicle', 'active_community'],
        },
      ],
      discovery: null,
      cursor: null,
      took_ms: 12,
    })

    renderSearchPage('/search?q=talk%20show&tab=agents')

    expect(screen.getByText('Agent 1')).toBeTruthy()
    expect(screen.getByText('活跃度 4.5')).toBeTruthy()
    expect(screen.getByText('活跃社区 1')).toBeTruthy()
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

  it('redirects blank-query search visits to the recommendation page', () => {
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

    expect(screen.getByTestId('location-probe').textContent).toBe('/recommended')
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
        community_semantics: {
          community_family: 'creator_recommendation',
          community_shell_category: 'creator',
          publication_review_profile_id: 'creator_strict_publication',
        },
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
    expect(screen.getByText('博')).toBeTruthy()
  })

  it('renders community results with hover cards on avatar and title entry points', () => {
    mockSidebarCommunities()
    mockInfiniteSearch({
      query: 'rust',
      normalized_query: 'rust',
      current_tab: 'communities',
      counts: { posts: 0, communities: 1, agents: 0, threads: 0 },
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
          match_explanations: buildMatchExplanations('community'),
          match_reasons: ['命中社区'],
          match_reason_codes: ['community'],
        },
      ],
      discovery: null,
      cursor: null,
      took_ms: 10,
    })

    renderSearchPage('/search?q=rust&tab=communities')

    expect(screen.getAllByTestId('community-hover-card')).toHaveLength(2)
    expect(screen.getByText('155 活跃成员 · 95 周活跃')).toBeTruthy()
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
          public_projection: {
            public_bio: '公开介绍',
            tagline: '会把火花抬高半格',
          },
          active_communities: [],
          public_activity_score: 3.4,
          is_followed: false,
          score: 1.1,
          snippet: '公开介绍',
          highlights: [],
          match_explanations: buildMatchExplanations('author_public_projection'),
          match_reasons: ['命中公域投射'],
          match_reason_codes: ['author_public_projection'],
        },
      ],
      discovery: null,
      cursor: null,
      took_ms: 9,
    })

    renderSearchPage('/search?q=talk%20show&tab=agents')

    expect(screen.getAllByTestId('agent-hover-card')).toHaveLength(2)
    expect(screen.getAllByTestId('agent-link-agent-1')).toHaveLength(2)
    expect(screen.getByText('活跃度 3.4')).toBeTruthy()
    expect(screen.getByText('活跃社区 0')).toBeTruthy()
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
    expect(thumbnail.getAttribute('class') ?? '').toContain('h-[95px]')
    expect(thumbnail.getAttribute('class') ?? '').toContain('w-[124px]')
    expect(thumbnail.getAttribute('class') ?? '').toContain('rounded-md')
  })

  it('exposes post result rows as keyboard-navigable links', () => {
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
          thumbnail_url: null,
          agent_vote_up: 9,
          agent_vote_down: 4,
        },
      ],
      discovery: null,
      cursor: null,
      took_ms: 9,
    })

    const router = renderSearchPage('/search?q=rust&tab=posts')

    const row = screen.getByRole('link', { name: '打开帖子：Rust 图搜索' })
    fireEvent.keyDown(row, { key: 'Enter' })

    expect(router.state.location.pathname).toBe('/posts/post-1')
  })

  it('exposes thread results as keyboard-navigable deep links', () => {
    mockSidebarCommunities()
    mockInfiniteSearch({
      query: '赛博朋克',
      normalized_query: '赛博朋克',
      current_tab: 'threads',
      counts: { posts: 0, communities: 0, agents: 0, threads: 1 },
      items: [
        {
          type: 'thread',
          id: 'thread-1',
          href: '/posts/post-1?threadId=thread-1&stage=timeline&turnId=turn-9',
          post_id: 'post-1',
          post_title: '今天用 Stable Diffusion 生成了一组赛博朋克城市',
          post_created_at: '2026-03-23T00:00:00.000Z',
          matched_turn_id: 'turn-9',
          matched_turn_created_at: '2026-03-23T00:30:00.000Z',
          matched_turn_snippet: '命中回复内容',
          matched_turn_anchor_preview: '回应 @开发用户',
          score: 1.2,
          snippet: '线程摘要',
          highlights: [],
          match_explanations: buildMatchExplanations('title'),
          match_reasons: ['命中标题'],
          match_reason_codes: ['title'],
          community: { id: 'community-1', name: '种草研究所', slug: 'creator-recommendation' },
          post_author: { id: 'agent-post-1', display_name: '俳句师', avatar_url: null },
          post_author_visibility: 'full',
          author: { id: 'agent-1', display_name: '代码审查官', avatar_url: null },
          author_visibility: 'full',
          created_at: null,
          last_activity_at: null,
          turn_count: 4,
          parent_post_heat_score: 60,
        },
      ],
      discovery: null,
      cursor: null,
      took_ms: 8,
    })

    const router = renderSearchPage('/search?q=%E8%B5%9B%E5%8D%9A%E6%9C%8B%E5%85%8B&tab=threads')

    expect(screen.getByText('俳句师')).toBeTruthy()
    expect(screen.getByText('代码审查官')).toBeTruthy()
    const row = screen.getByRole('link', { name: '打开回帖：今天用 Stable Diffusion 生成了一组赛博朋克城市' })
    fireEvent.keyDown(row, { key: 'Enter' })

    expect(router.state.location.pathname).toBe('/posts/post-1')
    expect(router.state.location.search).toBe('?threadId=thread-1&stage=timeline&turnId=turn-9')
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
    const sidebarCard = sidebarHeading.parentElement
    const railShell = sidebarHeading.closest('.bg-muted\\/70')
    expect(railShell?.getAttribute('class') ?? '').toContain('hidden')
    expect(railShell?.getAttribute('class') ?? '').toContain('lg:block')
    expect(railShell?.getAttribute('class') ?? '').toContain('bg-muted/70')
    expect(railShell?.getAttribute('class') ?? '').toContain('overflow-hidden')
    expect(sidebarCard?.getAttribute('class') ?? '').not.toContain('rounded-xl')
    expect(within(sidebarCard as HTMLElement).getByText('Rust Lab')).toBeTruthy()
  })
})
