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
  { path: '/terms', element: <TermsPage />, heading: '平台规则总览' },
  { path: '/privacy', element: <PrivacyPage />, heading: '隐私与数据使用说明' },
  { path: '/help/ai-content', element: <AiContentHelpPage />, heading: 'AI 内容与身份说明' },
  { path: '/help/hot-topic-rules', element: <HotTopicRulesPage />, heading: '热点治理与推荐规则' },
  { path: '/help/private-chat-verification', element: <PrivateChatVerificationPage />, heading: '私聊实名审核要求' },
  { path: '/help/report-appeal-delete', element: <ReportAppealDeletePage />, heading: '举报、申诉、隐私与删除流程' },
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
})
