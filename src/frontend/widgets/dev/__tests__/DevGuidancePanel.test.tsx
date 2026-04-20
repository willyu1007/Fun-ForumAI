import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNavigate } from 'react-router'
import { useGuidanceSummary, useMyAgents } from '@/api/hooks'
import { useDevGuidanceScenarioMutation } from '@/api/hooks/dev'
import { useAuth } from '@/shared/hooks/use-auth'
import { useDevGuidanceStore } from '@/shared/stores/dev-guidance-store'
import { DevGuidancePanel } from '../DevGuidancePanel'

vi.mock('react-router', () => ({
  useNavigate: vi.fn(),
}))

vi.mock('@/api/hooks', () => ({
  useGuidanceSummary: vi.fn(),
  useMyAgents: vi.fn(),
}))

vi.mock('@/api/hooks/dev', () => ({
  useDevGuidanceScenarioMutation: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

const useGuidanceSummaryMock = vi.mocked(useGuidanceSummary)
const useMyAgentsMock = vi.mocked(useMyAgents)
const useDevGuidanceScenarioMutationMock = vi.mocked(useDevGuidanceScenarioMutation)
const useAuthMock = vi.mocked(useAuth)
const useNavigateMock = vi.mocked(useNavigate)

function buildSummary(completedOverrides?: Partial<Record<string, boolean>>) {
  return {
    data: {
      data: {
        actor: {
          actor_type: 'USER',
          actor_id: 'dev-user-001',
          stage: 'EXPLORING',
          completed: {
            followed_first_agent: false,
            used_following_feed: false,
            created_agent: true,
            started_private_chat: false,
            nurture_receipt_ready: false,
            watch_public_effect: false,
            ...completedOverrides,
          },
          first_success: { achieved: false, at: null },
          reveal: { style: false, instructions: false, advanced: false },
          latest_owner_agent_id: 'agent-1',
          latest_receipt_session_id: null,
        },
        modules: [],
      },
    },
    isLoading: false,
    refetch: vi.fn(),
  } as never
}

describe('DevGuidancePanel', () => {
  const mutateAsync = vi.fn()
  const navigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useNavigateMock.mockReturnValue(navigate)
    useDevGuidanceStore.setState({ myAgentsMode: 'LIVE' })
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'dev-user-001', email: 'dev-user@llm-forum.test', role: 'user' },
    } as never)
    useGuidanceSummaryMock.mockReturnValue(buildSummary())
    useMyAgentsMock.mockReturnValue({
      data: { data: [] },
      isFetched: true,
      refetch: vi.fn(),
    } as never)
    useDevGuidanceScenarioMutationMock.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never)
    mutateAsync.mockResolvedValue({})
  })

  it('renders completion flags with correct checked state', () => {
    render(<DevGuidancePanel open onOpenChange={vi.fn()} />)

    expect(screen.getByTestId('dev-guidance-actor')).toBeTruthy()
    expect(screen.getByText('创建角色')).toBeTruthy()
    expect(screen.getByText('发起私聊')).toBeTruthy()
    expect(screen.getByText('关注首个角色')).toBeTruthy()
  })

  it('renders all scenario buttons', () => {
    render(<DevGuidancePanel open onOpenChange={vi.fn()} />)

    expect(screen.getByText('无 Agent 引导')).toBeTruthy()
    expect(screen.getByText('首次私聊引导')).toBeTruthy()
    expect(screen.getByText('未读回执')).toBeTruthy()
    expect(screen.getByText('公开效果就绪')).toBeTruthy()
  })

  it('applies a scenario and shows status message', async () => {
    render(<DevGuidancePanel open onOpenChange={vi.fn()} />)

    fireEvent.click(screen.getByText('无 Agent 引导'))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ scenario: 'NO_AGENT_BOOTSTRAP' })
    })
    expect(navigate).toHaveBeenCalledWith('/feed')
    expect(useDevGuidanceStore.getState().myAgentsMode).toBe('EMPTY')
    expect(screen.getByText('已应用「无 Agent 引导」')).toBeTruthy()
  })

  it('shows loading state when no actor data', () => {
    useGuidanceSummaryMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      refetch: vi.fn(),
    } as never)

    render(<DevGuidancePanel open onOpenChange={vi.fn()} />)

    expect(screen.getByText('加载中…')).toBeTruthy()
  })

  it('disables scenario buttons when not authenticated', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false, user: null } as never)

    render(<DevGuidancePanel open onOpenChange={vi.fn()} />)

    const buttons = screen.getAllByRole('button')
    const scenarioButtons = buttons.filter((b) =>
      ['无 Agent 引导', '首次私聊引导', '未读回执', '公开效果就绪'].some((label) =>
        b.textContent?.includes(label),
      ),
    )
    for (const btn of scenarioButtons) {
      expect(btn.hasAttribute('disabled')).toBe(true)
    }
    expect(screen.getByText('先切到用户身份，再应用场景。')).toBeTruthy()
  })
})
