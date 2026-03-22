import { lazy, Suspense, type ReactNode } from 'react'
export const FeedPage = lazy(() =>
  import('../features/forum/pages/FeedPage').then((m) => ({ default: m.FeedPage })),
)
export const PostDetailPage = lazy(() =>
  import('../features/forum/pages/PostDetailPage').then((m) => ({ default: m.PostDetailPage })),
)
export const CommunitiesPage = lazy(() =>
  import('../features/forum/pages/CommunitiesPage').then((m) => ({ default: m.CommunitiesPage })),
)
export const CommunityFeedPage = lazy(() =>
  import('../features/forum/pages/CommunityFeedPage').then((m) => ({
    default: m.CommunityFeedPage,
  })),
)
export const HighlightsPage = lazy(() =>
  import('../features/forum/pages/HighlightsPage').then((m) => ({
    default: m.HighlightsPage,
  })),
)
export const AgentProfilePage = lazy(() =>
  import('../features/agents/pages/AgentProfilePage').then((m) => ({
    default: m.AgentProfilePage,
  })),
)
export const AgentManagePage = lazy(() =>
  import('../features/agents/pages/AgentManagePage').then((m) => ({
    default: m.AgentManagePage,
  })),
)
export const AgentDirectoryPage = lazy(() =>
  import('../features/agents/pages/AgentDirectoryPage').then((m) => ({
    default: m.AgentDirectoryPage,
  })),
)
export const AdminPanel = lazy(() =>
  import('../features/admin/pages/AdminPanel').then((m) => ({ default: m.AdminPanel })),
)
export const ChatRoomListPage = lazy(() =>
  import('../features/chat/pages/ChatRoomListPage').then((m) => ({
    default: m.ChatRoomListPage,
  })),
)
export const ChatRoomPage = lazy(() =>
  import('../features/chat/pages/ChatRoomPage').then((m) => ({
    default: m.ChatRoomPage,
  })),
)
export const AgentDashboardPage = lazy(() =>
  import('../features/dashboard/pages/AgentDashboardPage').then((m) => ({
    default: m.AgentDashboardPage,
  })),
)
export const PrivateChatPage = lazy(() =>
  import('../features/private-chat/pages/PrivateChatPage').then((m) => ({
    default: m.PrivateChatPage,
  })),
)
export const SafetyCenterPage = lazy(() =>
  import('../features/user/pages/SafetyCenterPage').then((m) => ({
    default: m.SafetyCenterPage,
  })),
)
export const HelpCenterPage = lazy(() =>
  import('../features/help/pages/PolicyPages').then((m) => ({
    default: m.HelpCenterPage,
  })),
)
export const TermsPage = lazy(() =>
  import('../features/help/pages/PolicyPages').then((m) => ({
    default: m.TermsPage,
  })),
)
export const PrivacyPage = lazy(() =>
  import('../features/help/pages/PolicyPages').then((m) => ({
    default: m.PrivacyPage,
  })),
)
export const AiContentHelpPage = lazy(() =>
  import('../features/help/pages/PolicyPages').then((m) => ({
    default: m.AiContentHelpPage,
  })),
)
export const HotTopicRulesPage = lazy(() =>
  import('../features/help/pages/PolicyPages').then((m) => ({
    default: m.HotTopicRulesPage,
  })),
)
export const PrivateChatVerificationPage = lazy(() =>
  import('../features/help/pages/PolicyPages').then((m) => ({
    default: m.PrivateChatVerificationPage,
  })),
)
export const ReportAppealDeletePage = lazy(() =>
  import('../features/help/pages/PolicyPages').then((m) => ({
    default: m.ReportAppealDeletePage,
  })),
)
export const InboxPage = lazy(() =>
  import('../features/guidance/pages/InboxPage').then((m) => ({
    default: m.InboxPage,
  })),
)
export const MyActivityPage = lazy(() =>
  import('../features/user/pages/MyActivityPage').then((m) => ({
    default: m.MyActivityPage,
  })),
)
export const AccountSettingsPage = lazy(() =>
  import('../features/user/pages/AccountSettingsPage').then((m) => ({
    default: m.AccountSettingsPage,
  })),
)
export const LoginPage = lazy(() =>
  import('../features/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
)
export const RegisterPage = lazy(() =>
  import('../features/auth/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })),
)
function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-sm text-muted-foreground">加载中…</div>
    </div>
  )
}
export function SuspenseWrap({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}
