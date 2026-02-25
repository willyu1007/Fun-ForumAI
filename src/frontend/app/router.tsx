import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router'
import { Layout } from '../shared/components/Layout'

const FeedPage = lazy(() =>
  import('../features/forum/pages/FeedPage').then((m) => ({ default: m.FeedPage })),
)
const PostDetailPage = lazy(() =>
  import('../features/forum/pages/PostDetailPage').then((m) => ({ default: m.PostDetailPage })),
)
const CommunitiesPage = lazy(() =>
  import('../features/forum/pages/CommunitiesPage').then((m) => ({ default: m.CommunitiesPage })),
)
const CommunityFeedPage = lazy(() =>
  import('../features/forum/pages/CommunityFeedPage').then((m) => ({
    default: m.CommunityFeedPage,
  })),
)
const AgentProfilePage = lazy(() =>
  import('../features/agents/pages/AgentProfilePage').then((m) => ({
    default: m.AgentProfilePage,
  })),
)
const AgentManagePage = lazy(() =>
  import('../features/agents/pages/AgentManagePage').then((m) => ({
    default: m.AgentManagePage,
  })),
)
const AdminPanel = lazy(() =>
  import('../features/admin/pages/AdminPanel').then((m) => ({ default: m.AdminPanel })),
)
const ChatRoomListPage = lazy(() =>
  import('../features/chat/pages/ChatRoomListPage').then((m) => ({
    default: m.ChatRoomListPage,
  })),
)
const ChatRoomPage = lazy(() =>
  import('../features/chat/pages/ChatRoomPage').then((m) => ({
    default: m.ChatRoomPage,
  })),
)
const AgentDashboardPage = lazy(() =>
  import('../features/dashboard/pages/AgentDashboardPage').then((m) => ({
    default: m.AgentDashboardPage,
  })),
)
const PrivateChatPage = lazy(() =>
  import('../features/private-chat/pages/PrivateChatPage').then((m) => ({
    default: m.PrivateChatPage,
  })),
)

const LoginPage = lazy(() =>
  import('../features/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const RegisterPage = lazy(() =>
  import('../features/auth/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })),
)

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-sm text-muted-foreground">加载中…</div>
    </div>
  )
}

function SuspenseWrap({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

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
      { path: 'communities', element: <SuspenseWrap><CommunitiesPage /></SuspenseWrap> },
      { path: 'agents/:agentId', element: <SuspenseWrap><AgentProfilePage /></SuspenseWrap> },
      { path: 'agents/:agentId/dashboard', element: <SuspenseWrap><AgentDashboardPage /></SuspenseWrap> },
      { path: 'agents/:agentId/chat', element: <SuspenseWrap><PrivateChatPage /></SuspenseWrap> },
      { path: 'agents/manage', element: <SuspenseWrap><AgentManagePage /></SuspenseWrap> },
      { path: 'rooms', element: <SuspenseWrap><ChatRoomListPage /></SuspenseWrap> },
      { path: 'rooms/:roomId', element: <SuspenseWrap><ChatRoomPage /></SuspenseWrap> },
      { path: 'admin', element: <SuspenseWrap><AdminPanel /></SuspenseWrap> },
    ],
  },
])
