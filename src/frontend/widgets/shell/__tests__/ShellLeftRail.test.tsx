import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCommunities } from '@/api/hooks/forum'
import { ShellLeftRail } from '../ShellLeftRail'

vi.mock('@/api/hooks/forum', () => ({
  useCommunities: vi.fn(),
}))

const useCommunitiesMock = vi.mocked(useCommunities)

describe('ShellLeftRail', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('renders the new grouped navigation without the inbox entry', () => {
    useCommunitiesMock.mockReturnValue({
      data: {
        data: [
          {
            id: 'community-1',
            name: '技术前沿',
            slug: 'tech',
            description: '编程与算法',
          },
        ],
      },
    } as never)

    render(
      <MemoryRouter initialEntries={['/']}>
        <ShellLeftRail />
      </MemoryRouter>,
    )

    expect(screen.getAllByText('主页').length).toBeGreaterThan(0)
    expect(screen.getByText('浏览')).toBeTruthy()
    expect(screen.getByText('聊天室')).toBeTruthy()
    expect(screen.getByText('我的关联')).toBeTruthy()
    expect(screen.getByText('智能体轨迹')).toBeTruthy()
    expect(screen.getByText('所属社区')).toBeTruthy()
    expect(screen.getByText('公开动向')).toBeTruthy()
    expect(screen.getByText('最近访问')).toBeTruthy()
    expect(screen.getByText('高光时刻')).toBeTruthy()
    expect(screen.getByText('资源与设置')).toBeTruthy()
    expect(screen.getByText(/圆桌议题/)).toBeTruthy()
    expect(screen.getByText('全部社区')).toBeTruthy()
    expect(screen.queryByText('收件箱')).toBeNull()
  })

  it('shows only recently visited communities in the recent section', () => {
    useCommunitiesMock.mockReturnValue({
      data: {
        data: [
          {
            id: 'community-1',
            name: '技术前沿',
            slug: 'tech',
            description: '编程与算法',
          },
          {
            id: 'community-2',
            name: '自由讨论',
            slug: 'general',
            description: '闲聊',
          },
        ],
      },
    } as never)

    window.localStorage.setItem(
      'shell-left-rail-recent-visits',
      JSON.stringify(['/agents/manage', '/c/tech', '/rooms', '/c/general']),
    )

    render(
      <MemoryRouter initialEntries={['/']}>
        <ShellLeftRail />
      </MemoryRouter>,
    )

    const recentSection = screen.getByTestId('left-rail-recent-section')
    expect(within(recentSection).getByText('技术前沿')).toBeTruthy()
    expect(within(recentSection).getByText('自由讨论')).toBeTruthy()
    expect(within(recentSection).queryByText('智能体管理')).toBeNull()
    expect(within(recentSection).queryByText('聊天室')).toBeNull()
  })
})
