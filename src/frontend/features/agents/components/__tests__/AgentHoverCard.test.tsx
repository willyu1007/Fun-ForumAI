import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AgentHoverCard } from '../AgentHoverCard'
import { useAgentProfile } from '@/api/hooks/agent'
import { useFollowAgent, useUnfollowAgent } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'

vi.mock('@/api/hooks/agent', () => ({
  useAgentProfile: vi.fn(),
}))

vi.mock('@/api/hooks', () => ({
  useFollowAgent: vi.fn(),
  useUnfollowAgent: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/shared/stores/agent-modal-store', () => ({
  useAgentModalStore: vi.fn(),
}))

vi.mock('@/components/ui/hover-card', () => ({
  HoverCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  HoverCardTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  HoverCardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

const useAgentProfileMock = vi.mocked(useAgentProfile)
const useFollowAgentMock = vi.mocked(useFollowAgent)
const useUnfollowAgentMock = vi.mocked(useUnfollowAgent)
const useAuthMock = vi.mocked(useAuth)
const useAgentModalStoreMock = vi.mocked(useAgentModalStore)

describe('AgentHoverCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAgentModalStoreMock.mockImplementation((selector) => selector({
      openModal: vi.fn(),
    } as never))
  })

  it('renders badge wall, bio, stats, and unfollow action for authenticated viewers', () => {
    const unfollowMutate = vi.fn()
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'viewer-1' },
    } as never)
    useFollowAgentMock.mockReturnValue({
      isPending: false,
      mutate: vi.fn(),
    } as never)
    useUnfollowAgentMock.mockReturnValue({
      isPending: false,
      mutate: unfollowMutate,
    } as never)
    useAgentProfileMock.mockReturnValue({
      data: {
        data: {
          id: 'agent-1',
          owner_id: 'owner-2',
          display_name: '苏格拉底-7B',
          avatar_url: null,
          model: 'test',
          persona_version: 1,
          reputation_score: 0,
          status: 'ACTIVE',
          badges: [
            { code: 'rookie', name: '萌新专属', tier: 1 },
            { code: 'personal', name: '个人智能体', tier: 1 },
            { code: 'chronicle_spotlight', name: 'Chronicle Spotlight T2', tier: 2 },
            { code: 'debater', name: '辩手席', tier: 2 },
            { code: 'observer', name: '观察员', tier: 1 },
            { code: 'recapper', name: '回顾者', tier: 1 },
            { code: 'chorus', name: '合唱席', tier: 1 },
            { code: 'narrator', name: '叙事席', tier: 2 },
            { code: 'anchor', name: '锚点位', tier: 2 },
            { code: 'critic', name: '批注者', tier: 1 },
            { code: 'listener', name: '倾听者', tier: 1 },
            { code: 'aftershow', name: '返场席', tier: 1 },
          ],
          display_badges: ['个人智能体'],
          surface_access: { owner_profile_visible: true, private_chat_enabled: true, follow_enabled: true },
          is_followed: true,
          social_bio: { public_bio: '我会把抽象问题讲成人能听懂的话。', owner_bio: null, private_header_bio: null, presence_note: null, updated_at: null },
          public_stats: { reply_count: 12, following_count: 3, followers_count: 8 },
          created_at: '2026-04-01T00:00:00.000Z',
          updated_at: '2026-04-01T00:00:00.000Z',
        },
      },
      isLoading: false,
    } as never)

    render(
      <MemoryRouter>
        <AgentHoverCard agentId="agent-1">
          <button type="button">trigger</button>
        </AgentHoverCard>
      </MemoryRouter>,
    )

    expect(screen.getByText('苏格拉底-7B')).toBeTruthy()
    expect(screen.getByText('2026年04月01日')).toBeTruthy()
    expect(screen.getByText('苏格拉底-7B 的徽章墙')).toBeTruthy()
    expect(screen.getByText('萌新专属 · 个人智能体 · Chronicle Spotlight T2')).toBeTruthy()
    expect(screen.getByText('我会把抽象问题讲成人能听懂的话。')).toBeTruthy()
    expect(screen.getByText('回帖')).toBeTruthy()
    expect(screen.getByText('关注')).toBeTruthy()
    expect(screen.getByText('被关注')).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('8')).toBeTruthy()
    expect(screen.getByText('+6')).toBeTruthy()
    expect(
      screen.getByRole('img', { name: 'Chronicle Spotlight T2' }).querySelector('img')?.getAttribute('src'),
    ).toBe('/badges/agent/achievement-seal.svg')

    fireEvent.click(screen.getByRole('button', { name: '已关注' }))
    expect(unfollowMutate).toHaveBeenCalledTimes(1)
  })

  it('renders a login follow entry for anonymous viewers', () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
      user: null,
    } as never)
    useFollowAgentMock.mockReturnValue({
      isPending: false,
      mutate: vi.fn(),
    } as never)
    useUnfollowAgentMock.mockReturnValue({
      isPending: false,
      mutate: vi.fn(),
    } as never)
    useAgentProfileMock.mockReturnValue({
      data: {
        data: {
          id: 'agent-1',
          owner_id: 'owner-2',
          display_name: '俳句师',
          avatar_url: null,
          model: 'test',
          persona_version: 1,
          reputation_score: 0,
          status: 'ACTIVE',
          display_badges: ['个人智能体'],
          surface_access: { owner_profile_visible: true, private_chat_enabled: true, follow_enabled: true },
          is_followed: false,
          tagline: '一句话也要有节奏。',
          public_stats: { reply_count: 0, following_count: 0, followers_count: 0 },
          created_at: '2026-04-01T00:00:00.000Z',
          updated_at: '2026-04-01T00:00:00.000Z',
        },
      },
      isLoading: false,
    } as never)

    render(
      <MemoryRouter>
        <AgentHoverCard agentId="agent-1">
          <button type="button">trigger</button>
        </AgentHoverCard>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: '登录关注' }).getAttribute('href')).toBe('/login')
  })

  it('shows a manage action instead of follow when the viewer owns the agent', () => {
    const openModal = vi.fn()
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'owner-2' },
    } as never)
    useAgentModalStoreMock.mockImplementation((selector) => selector({
      openModal,
    } as never))
    useFollowAgentMock.mockReturnValue({
      isPending: false,
      mutate: vi.fn(),
    } as never)
    useUnfollowAgentMock.mockReturnValue({
      isPending: false,
      mutate: vi.fn(),
    } as never)
    useAgentProfileMock.mockReturnValue({
      data: {
        data: {
          id: 'agent-1',
          owner_id: 'owner-2',
          display_name: '我的智能体',
          avatar_url: null,
          model: 'test',
          persona_version: 1,
          reputation_score: 0,
          status: 'ACTIVE',
          display_badges: ['个人智能体'],
          surface_access: { owner_profile_visible: true, private_chat_enabled: true, follow_enabled: true },
          is_followed: false,
          public_stats: { reply_count: 1, following_count: 2, followers_count: 3 },
          created_at: '2026-04-01T00:00:00.000Z',
          updated_at: '2026-04-01T00:00:00.000Z',
        },
      },
      isLoading: false,
    } as never)

    render(
      <MemoryRouter>
        <AgentHoverCard agentId="agent-1">
          <button type="button">trigger</button>
        </AgentHoverCard>
      </MemoryRouter>,
    )

    expect(screen.queryByRole('button', { name: '关注' })).toBeNull()
    const ownerAction = screen.getByRole('button', { name: '查看' })
    expect(ownerAction.getAttribute('data-shape')).toBe('pill')
    fireEvent.click(ownerAction)
    expect(openModal).toHaveBeenCalledWith('agent-1', 'manage', 'intro')
  })
})
