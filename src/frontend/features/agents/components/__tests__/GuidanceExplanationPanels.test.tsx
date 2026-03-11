import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PrivacySettingsPanel } from '../PrivacySettingsPanel'
import AchievementChroniclePanel from '../AchievementChroniclePanel'
import { RelationNetworkPanel } from '../RelationNetworkPanel'
import {
  useAgentAchievements,
  useAgentChronicle,
  useAgentMemories,
  useAgentRelations,
  useAgentRelationSummary,
  useGuidanceItemAction,
  usePrivacySettings,
  useUpdatePrivacySettings,
} from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'

vi.mock('@/api/hooks', () => ({
  usePrivacySettings: vi.fn(),
  useUpdatePrivacySettings: vi.fn(),
  useAgentMemories: vi.fn(),
  useAgentAchievements: vi.fn(),
  useAgentChronicle: vi.fn(),
  useAgentRelations: vi.fn(),
  useAgentRelationSummary: vi.fn(),
  useGuidanceItemAction: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

const usePrivacySettingsMock = vi.mocked(usePrivacySettings)
const useUpdatePrivacySettingsMock = vi.mocked(useUpdatePrivacySettings)
const useAgentMemoriesMock = vi.mocked(useAgentMemories)
const useAgentAchievementsMock = vi.mocked(useAgentAchievements)
const useAgentChronicleMock = vi.mocked(useAgentChronicle)
const useAgentRelationsMock = vi.mocked(useAgentRelations)
const useAgentRelationSummaryMock = vi.mocked(useAgentRelationSummary)
const useGuidanceItemActionMock = vi.mocked(useGuidanceItemAction)
const useAuthMock = vi.mocked(useAuth)

const guidanceItem = {
  id: 'guidance-1',
  module_type: 'CARD' as const,
  reason_code: 'WATCH_PUBLIC_EFFECT',
  title: '去看它在公开场合的变化',
  body: '你的影响已经开始溢出到公开内容。',
  unread: true,
  status: 'ACTIVE' as const,
  cta: {
    label: '查看公开效果',
    target: '/posts/post-1',
  },
  payload: {
    post_id: 'post-1',
  },
  related_agent_id: 'agent-1',
  related_session_id: null,
  created_at: '2026-03-11T00:00:00.000Z',
  updated_at: '2026-03-11T00:00:00.000Z',
}

function renderWithRouter(node: ReactNode) {
  return render(
    <MemoryRouter>
      {node}
    </MemoryRouter>,
  )
}

describe('owner explanation surfaces', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    usePrivacySettingsMock.mockReturnValue({
      data: {
        data: {
          disclosure_level: 1,
          public_memory_budget: 1000,
          public_memory_top_k: 4,
        },
      },
      isLoading: false,
    } as never)
    useUpdatePrivacySettingsMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never)
    useAgentMemoriesMock.mockReturnValue({
      data: {
        data: {
          items: [],
          next_cursor: null,
        },
      },
    } as never)
    useAgentAchievementsMock.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    } as never)
    useAgentChronicleMock.mockReturnValue({
      data: {
        data: [],
        meta: {
          folded_count: 0,
        },
      },
      isLoading: false,
    } as never)
    useAgentRelationsMock.mockReturnValue({
      data: {
        data: {
          items: [],
        },
      },
      isLoading: false,
    } as never)
    useAgentRelationSummaryMock.mockReturnValue({
      data: {
        data: {
          following: { effective: 0, shadow: 0 },
          followers: { effective: 0, shadow: 0 },
          friends: 0,
        },
      },
      isLoading: false,
    } as never)
    useGuidanceItemActionMock.mockReturnValue({
      mutate: vi.fn(),
    } as never)
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
    } as never)
  })

  it('shows the privacy explanation rail when no canonical item is available', () => {
    renderWithRouter(
      <PrivacySettingsPanel
        agentId="agent-1"
        sourceSessionId="session-1"
        fallbackRail={{
          title: '这次私聊已经沉淀成记忆',
          body: '这里展示的是这轮对话真正留下的记忆痕迹。',
          cta: {
            kind: 'route',
            label: '回到私聊继续塑形',
            target: '/agents/agent-1/chat',
          },
        }}
      />,
    )

    expect(screen.getByText('这次私聊已经沉淀成记忆')).toBeTruthy()
    expect(screen.getByRole('link', { name: '回到私聊继续塑形' })).toBeTruthy()
  })

  it('prefers the canonical item over the fallback rail on the achievement surface', () => {
    renderWithRouter(
      <AchievementChroniclePanel
        agentId="agent-1"
        guidanceItem={guidanceItem}
        fallbackRail={{
          title: '成就线是养成结果在公开舞台上的外显',
          body: 'fallback body',
          cta: {
            kind: 'route',
            label: '去看看公开舞台最近的动静',
            target: '/highlights',
          },
        }}
        showRelationNodes={false}
      />,
    )

    expect(screen.getByText('去看它在公开场合的变化')).toBeTruthy()
    expect(screen.queryByText('成就线是养成结果在公开舞台上的外显')).toBeNull()
    expect(useAgentRelationsMock).toHaveBeenCalledWith('agent-1', { view: 'friends', limit: 3 }, false)
  })

  it('shows the relation explanation rail when no canonical item is available', () => {
    renderWithRouter(
      <RelationNetworkPanel
        agentId="agent-1"
        queriesEnabled={false}
        fallbackRail={{
          title: '关系网反映的是公开互动和长期积累',
          body: '这里看到的是角色之间慢慢累积出来的走向。',
          cta: {
            kind: 'route',
            label: '去看看公开舞台最近的动静',
            target: '/highlights',
          },
        }}
      />,
    )

    expect(screen.getByText('关系网反映的是公开互动和长期积累')).toBeTruthy()
    expect(screen.getByRole('link', { name: '去看看公开舞台最近的动静' })).toBeTruthy()
    expect(screen.getByText('关系网详情仅对所有者开放')).toBeTruthy()
    expect(useAgentRelationSummaryMock).toHaveBeenCalledWith('agent-1', false)
    expect(useAgentRelationsMock).toHaveBeenCalledWith('agent-1', { view: 'following', limit: 50 }, false)
  })
})
