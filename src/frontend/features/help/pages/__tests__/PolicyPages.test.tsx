import type { ReactElement } from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import {
  AiContentHelpPage,
  HelpCenterPage,
  HotTopicRulesPage,
  PrivacyPage,
  PrivateChatVerificationPage,
  ReportAppealDeletePage,
  TermsPage,
} from '../PolicyPages'

type RouteCase = {
  path: string
  element: ReactElement
  heading: string
}

const ROUTES: RouteCase[] = [
  { path: '/help', element: <HelpCenterPage />, heading: '规则与说明中心' },
  { path: '/terms', element: <TermsPage />, heading: '用户协议' },
  { path: '/privacy', element: <PrivacyPage />, heading: '隐私政策' },
  { path: '/help/ai-content', element: <AiContentHelpPage />, heading: 'AI 内容与身份说明' },
  { path: '/help/hot-topic-rules', element: <HotTopicRulesPage />, heading: '热点治理规则' },
  { path: '/help/private-chat-verification', element: <PrivateChatVerificationPage />, heading: '私聊实名审核要求' },
  { path: '/help/report-appeal-delete', element: <ReportAppealDeletePage />, heading: '举报与申诉' },
]

describe('Policy pages', () => {
  for (const routeCase of ROUTES) {
    it(`renders ${routeCase.path} without auth`, () => {
      render(
        <MemoryRouter initialEntries={[routeCase.path]}>
          <Routes>
            <Route path={routeCase.path} element={routeCase.element} />
          </Routes>
        </MemoryRouter>,
      )

      expect(screen.getByRole('heading', { name: routeCase.heading })).toBeTruthy()
    })
  }

  it('renders report-and-appeal markdown content, actions, and generated tables', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/help/report-appeal-delete']}>
        <Routes>
          <Route path="/help/report-appeal-delete" element={<ReportAppealDeletePage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText(/帖子、公共舞台发言、聊天室内容或智能体发起举报/)).toBeTruthy()
    expect(screen.getByText(/你可以对帖子、公共舞台发言、聊天室内容或智能体发起举报/)).toBeTruthy()
    expect(screen.getAllByRole('link', { name: '打开 Safety Center' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: '查看热点治理规则' })).toBeTruthy()
    expect(screen.getByText(/已提交 -> 处理中 -> 已处理/)).toBeTruthy()
    expect(container.querySelector('table')).toBeTruthy()
    expect(container.querySelector('h2[id]')).toBeTruthy()
    expect(screen.queryByText(/帖子、评论/)).toBeNull()
    expect(screen.queryByText(/评论区/)).toBeNull()
  })

  it('builds the help center index from markdown registry metadata', () => {
    render(
      <MemoryRouter initialEntries={['/help']}>
        <Routes>
          <Route path="/help" element={<HelpCenterPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '内容与治理' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '身份与申诉' })).toBeTruthy()
    expect(screen.getByText('AI 内容与身份说明')).toBeTruthy()
    expect(screen.getByText('私聊实名审核要求')).toBeTruthy()
    expect(screen.getAllByRole('link', { name: '用户协议' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: '隐私政策' }).length).toBeGreaterThan(0)
  })
})
