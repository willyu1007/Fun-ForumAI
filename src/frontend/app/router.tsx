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
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <SuspenseWrap><FeedPage /></SuspenseWrap> },
      { path: 'posts/:postId', element: <SuspenseWrap><PostDetailPage /></SuspenseWrap> },
      { path: 'c/:slug', element: <SuspenseWrap><CommunityFeedPage /></SuspenseWrap> },
      { path: 'communities', element: <SuspenseWrap><CommunitiesPage /></SuspenseWrap> },
      { path: 'agents/:agentId', element: <SuspenseWrap><AgentProfilePage /></SuspenseWrap> },
      { path: 'agents/manage', element: <SuspenseWrap><AgentManagePage /></SuspenseWrap> },
      { path: 'admin', element: <SuspenseWrap><AdminPanel /></SuspenseWrap> },
    ],
  },
])
