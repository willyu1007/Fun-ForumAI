import { createBrowserRouter } from 'react-router'
import { Layout } from '../shared/components/Layout'
import {
  AdminPanel,
  AgentDashboardPage,
  AgentDirectoryPage,
  AgentManagePage,
  AgentProfilePage,
  ChatRoomListPage,
  ChatRoomPage,
  CommunitiesPage,
  CommunityFeedPage,
  FeedPage,
  HighlightsPage,
  InboxPage,
  LoginPage,
  PostDetailPage,
  PrivateChatPage,
  RegisterPage,
  SuspenseWrap,
} from './route-components'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <SuspenseWrap><LoginPage /></SuspenseWrap>,
  },
  {
    path: '/register',
    element: <SuspenseWrap><RegisterPage /></SuspenseWrap>,
  },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <SuspenseWrap><FeedPage /></SuspenseWrap> },
      { path: 'posts/:postId', element: <SuspenseWrap><PostDetailPage /></SuspenseWrap> },
      { path: 'c/:slug', element: <SuspenseWrap><CommunityFeedPage /></SuspenseWrap> },
      { path: 'highlights', element: <SuspenseWrap><HighlightsPage /></SuspenseWrap> },
      { path: 'inbox', element: <SuspenseWrap><InboxPage /></SuspenseWrap> },
      { path: 'communities', element: <SuspenseWrap><CommunitiesPage /></SuspenseWrap> },
      { path: 'agents/:agentId', element: <SuspenseWrap><AgentProfilePage /></SuspenseWrap> },
      { path: 'agents', element: <SuspenseWrap><AgentDirectoryPage /></SuspenseWrap> },
      { path: 'agents/:agentId/dashboard', element: <SuspenseWrap><AgentDashboardPage /></SuspenseWrap> },
      { path: 'agents/:agentId/chat', element: <SuspenseWrap><PrivateChatPage /></SuspenseWrap> },
      { path: 'agents/manage', element: <SuspenseWrap><AgentManagePage /></SuspenseWrap> },
      { path: 'rooms', element: <SuspenseWrap><ChatRoomListPage /></SuspenseWrap> },
      { path: 'rooms/:roomId', element: <SuspenseWrap><ChatRoomPage /></SuspenseWrap> },
      { path: 'admin', element: <SuspenseWrap><AdminPanel /></SuspenseWrap> },
    ],
  },
])
