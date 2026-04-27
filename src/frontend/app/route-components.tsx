import { Suspense, type ReactNode } from 'react'
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
export const CommunitySettingsPage = lazyWithDynamicImportRecovery(() =>
  import('../features/forum/pages/CommunitySettingsPage').then((m) => ({
    default: m.CommunitySettingsPage,
  })),
  'route:community-settings',
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
export const AdminShellContainer = lazyWithDynamicImportRecovery(() =>
  import('./shell/AdminShellContainer').then((m) => ({ default: m.AdminShellContainer })),
  'route:admin-shell',
)

export const AdminGovernancePage = lazyWithDynamicImportRecovery(() =>
  import('../features/admin/pages/AdminPages').then((m) => ({ default: m.AdminGovernancePage })),
  'route:admin-governance',
)
export const AdminProgrammingPage = lazyWithDynamicImportRecovery(() =>
  import('../features/admin/pages/AdminPages').then((m) => ({ default: m.AdminProgrammingPage })),
  'route:admin-programming',
)
export const AdminCueBoardPage = lazyWithDynamicImportRecovery(() =>
  import('../features/admin/pages/AdminPages').then((m) => ({ default: m.AdminCueBoardPage })),
  'route:admin-cue-board',
)
export const AdminAutoPatchInboxPage = lazyWithDynamicImportRecovery(() =>
  import('../features/admin/pages/AdminPages').then((m) => ({ default: m.AdminAutoPatchInboxPage })),
  'route:admin-auto-patch-inbox',
)
export const AdminCueProjectionPreviewPage = lazyWithDynamicImportRecovery(() =>
  import('../features/admin/pages/AdminPages').then((m) => ({ default: m.AdminCueProjectionPreviewPage })),
  'route:admin-cue-projection-preview',
)
export const AdminMediaPlanAuditPage = lazyWithDynamicImportRecovery(() =>
  import('../features/admin/pages/AdminPages').then((m) => ({ default: m.AdminMediaPlanAuditPage })),
  'route:admin-media-plan-audit',
)
export const AdminMediaPromptsPage = lazyWithDynamicImportRecovery(() =>
  import('../features/admin/pages/AdminPages').then((m) => ({ default: m.AdminMediaPromptsPage })),
  'route:admin-media-prompts',
)
export const AdminUsersPage = lazyWithDynamicImportRecovery(() =>
  import('../features/admin/pages/AdminPages').then((m) => ({ default: m.AdminUsersPage })),
  'route:admin-users',
)
export const AdminInvitesPage = lazyWithDynamicImportRecovery(() =>
  import('../features/admin/pages/AdminPages').then((m) => ({ default: m.AdminInvitesPage })),
  'route:admin-invites',
)
export const AdminFeedbackPage = lazyWithDynamicImportRecovery(() =>
  import('../features/admin/pages/AdminPages').then((m) => ({ default: m.AdminFeedbackPage })),
  'route:admin-feedback',
)
export const AdminHotTopicPage = lazyWithDynamicImportRecovery(() =>
  import('../features/admin/pages/AdminPages').then((m) => ({ default: m.AdminHotTopicPage })),
  'route:admin-hot-topic',
)
export const AdminRuntimePage = lazyWithDynamicImportRecovery(() =>
  import('../features/admin/pages/AdminPages').then((m) => ({ default: m.AdminRuntimePage })),
  'route:admin-runtime',
)
export const AdminWarmupPage = lazyWithDynamicImportRecovery(() =>
  import('../features/admin/pages/AdminPages').then((m) => ({ default: m.AdminWarmupPage })),
  'route:admin-warmup',
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
export const LoginPage = lazyWithDynamicImportRecovery(() =>
  import('../features/auth/pages/LoginPage').then((m) => ({
    default: m.LoginPage,
  })),
  'route:login',
)
export const RegisterPage = lazyWithDynamicImportRecovery(() =>
  import('../features/auth/pages/RegisterPage').then((m) => ({
    default: m.RegisterPage,
  })),
  'route:register',
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
