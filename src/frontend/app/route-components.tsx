import { Suspense, type ReactNode } from 'react'
import { LoginPage as LoginPageComponent } from '../features/auth/pages/LoginPage'
import { RegisterPage as RegisterPageComponent } from '../features/auth/pages/RegisterPage'
import { lazyWithDynamicImportRecovery } from './lazy-import-recovery'

export const FeedPage = lazyWithDynamicImportRecovery(() =>
  import('../features/forum/pages/FeedPage').then((m) => ({ default: m.FeedPage })),
  'route:feed',
)
export const HomePage = lazyWithDynamicImportRecovery(() =>
  import('../features/forum/pages/HomePage').then((m) => ({ default: m.HomePage })),
  'route:home',
)
export const RecommendationPage = HomePage
export const PostDetailPage = lazyWithDynamicImportRecovery(() =>
  import('../features/forum/pages/PostDetailPage').then((m) => ({ default: m.PostDetailPage })),
  'route:post-detail',
)
export const CommunitiesPage = lazyWithDynamicImportRecovery(() =>
  import('../features/forum/pages/CommunitiesPage').then((m) => ({ default: m.CommunitiesPage })),
  'route:communities',
)
export const CommunityFeedPage = lazyWithDynamicImportRecovery(() =>
  import('../features/forum/pages/CommunityFeedPage').then((m) => ({
    default: m.CommunityFeedPage,
  })),
  'route:community-feed',
)
export const HighlightsPage = lazyWithDynamicImportRecovery(() =>
  import('../features/forum/pages/HighlightsPage').then((m) => ({
    default: m.HighlightsPage,
  })),
  'route:highlights',
)
export const StoryProgressPage = lazyWithDynamicImportRecovery(() =>
  import('../features/forum/pages/StoryProgressPage').then((m) => ({
    default: m.StoryProgressPage,
  })),
  'route:story-progress',
)
export const SearchPage = lazyWithDynamicImportRecovery(() =>
  import('../features/search/pages/SearchPage').then((m) => ({
    default: m.SearchPage,
  })),
  'route:search',
)
export const AdminPanel = lazyWithDynamicImportRecovery(() =>
  import('../features/admin/pages/AdminPanel').then((m) => ({ default: m.AdminPanel })),
  'route:admin',
)
export const ChatRoomListPage = lazyWithDynamicImportRecovery(() =>
  import('../features/chat/pages/ChatRoomListPage').then((m) => ({
    default: m.ChatRoomListPage,
  })),
  'route:chat-room-list',
)
export const ChatRoomPage = lazyWithDynamicImportRecovery(() =>
  import('../features/chat/pages/ChatRoomPage').then((m) => ({
    default: m.ChatRoomPage,
  })),
  'route:chat-room',
)
export const SafetyCenterPage = lazyWithDynamicImportRecovery(() =>
  import('../features/user/pages/SafetyCenterPage').then((m) => ({
    default: m.SafetyCenterPage,
  })),
  'route:safety',
)
export const FeedbackPage = lazyWithDynamicImportRecovery(() =>
  import('../features/user/pages/FeedbackPage').then((m) => ({
    default: m.FeedbackPage,
  })),
  'route:feedback',
)
export const HelpCenterPage = lazyWithDynamicImportRecovery(() =>
  import('../features/help/pages/PolicyPages').then((m) => ({
    default: m.HelpCenterPage,
  })),
  'route:help-center',
)
export const TermsPage = lazyWithDynamicImportRecovery(() =>
  import('../features/help/pages/PolicyPages').then((m) => ({
    default: m.TermsPage,
  })),
  'route:terms',
)
export const PrivacyPage = lazyWithDynamicImportRecovery(() =>
  import('../features/help/pages/PolicyPages').then((m) => ({
    default: m.PrivacyPage,
  })),
  'route:privacy',
)
export const AiContentHelpPage = lazyWithDynamicImportRecovery(() =>
  import('../features/help/pages/PolicyPages').then((m) => ({
    default: m.AiContentHelpPage,
  })),
  'route:ai-content-help',
)
export const HotTopicRulesPage = lazyWithDynamicImportRecovery(() =>
  import('../features/help/pages/PolicyPages').then((m) => ({
    default: m.HotTopicRulesPage,
  })),
  'route:hot-topic-rules',
)
export const PrivateChatVerificationPage = lazyWithDynamicImportRecovery(() =>
  import('../features/help/pages/PolicyPages').then((m) => ({
    default: m.PrivateChatVerificationPage,
  })),
  'route:private-chat-verification',
)
export const ReportAppealDeletePage = lazyWithDynamicImportRecovery(() =>
  import('../features/help/pages/PolicyPages').then((m) => ({
    default: m.ReportAppealDeletePage,
  })),
  'route:report-appeal-delete',
)
export const InboxPage = lazyWithDynamicImportRecovery(() =>
  import('../features/guidance/pages/InboxPage').then((m) => ({
    default: m.InboxPage,
  })),
  'route:inbox',
)
export const MyActivityPage = lazyWithDynamicImportRecovery(() =>
  import('../features/user/pages/MyActivityPage').then((m) => ({
    default: m.MyActivityPage,
  })),
  'route:my-activity',
)
export const AccountSettingsPage = lazyWithDynamicImportRecovery(() =>
  import('../features/user/pages/AccountSettingsPage').then((m) => ({
    default: m.AccountSettingsPage,
  })),
  'route:account-settings',
)
export const LoginPage = LoginPageComponent
export const RegisterPage = RegisterPageComponent
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
