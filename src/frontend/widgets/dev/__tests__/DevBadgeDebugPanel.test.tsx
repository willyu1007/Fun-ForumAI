import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBadgeDebugCatalog } from '@/api/hooks/dev'
import { DevBadgeDebugPanel } from '../DevBadgeDebugPanel'

vi.mock('@/api/hooks/dev', () => ({
  useBadgeDebugCatalog: vi.fn(),
}))

const useBadgeDebugCatalogMock = vi.mocked(useBadgeDebugCatalog)

describe('DevBadgeDebugPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useBadgeDebugCatalogMock.mockReturnValue({
      data: {
        data: [
          {
            key: 'default:萌新专属',
            source_kind: 'default_display',
            name: '萌新专属',
            description: '给新创建的个人智能体一个短期可见的开场标记。',
            icon_src: '/badges/agent/rookie-exclusive.svg',
            condition_summary: '个人智能体创建后 7 天内。',
            evidence_summary: 'agentKind=owner；createdAt 在 7 天窗口内。',
            display_priority: '默认展示层：排在“个人智能体”前。',
            priority_rank: 120,
          },
          {
            key: 'achievement:chronicle_spotlight:tier1',
            source_kind: 'achievement',
            name: 'Chronicle Spotlight T1',
            description: '面向公共高光的公开成就组。',
            icon_src: '/badges/agent/achievement-seal.svg',
            condition_summary: '全局通过日批处理统计公开 chronicle 数，达到 1 后授予。',
            evidence_summary: '信号来源：每日批处理；证据：chronicle（最多 3 条）。',
            display_priority: '公开成就层：展示时排在 display_badges 前。',
            priority_rank: 301,
          },
        ],
      },
      isLoading: false,
      error: null,
    } as never)
  })

  it('opens the sheet and renders maintained badge copy fields', () => {
    render(<DevBadgeDebugPanel />)

    fireEvent.click(screen.getByRole('button', { name: '勋章调试' }))

    expect(screen.getAllByText('勋章调试').length).toBeGreaterThan(0)
    expect(screen.getByText('萌新专属')).toBeTruthy()
    expect(screen.getByText('Chronicle Spotlight T1')).toBeTruthy()
    expect(screen.getByText(/给新创建的个人智能体一个短期可见的开场标记/)).toBeTruthy()
    expect(screen.getByText(/公开成就层：展示时排在 display_badges 前/)).toBeTruthy()
    expect(screen.getAllByText('达成条件').length).toBeGreaterThan(0)
    expect(screen.getAllByText('判断依据').length).toBeGreaterThan(0)
    expect(screen.getAllByText('展示优先级').length).toBeGreaterThan(0)
  })
})
