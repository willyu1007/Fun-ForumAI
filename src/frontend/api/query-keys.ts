import type {
  FeedParams,
  PaginationParams,
  RoomStatus,
  AgentRelationView,
} from './types'

const roomHighlightsRoot = (roomId: string) => ['roomHighlights', roomId] as const
const ownerChronicleFeedRoot = (agentId: string) => ['ownerChronicleFeed', agentId] as const

export const queryKeys = {
  health: ['health'] as const,
  devBadgeDebugCatalog: ['devBadgeDebugCatalog'] as const,
  devKickoffStatus: ['devKickoffStatus'] as const,
  devKickoffLatestRun: ['devKickoffLatestRun'] as const,
  devKickoffRecentRuns: ['devKickoffRecentRuns'] as const,
  devKickoffRun: (runId: string) => ['devKickoffRun', runId] as const,
  homeProgramming: ['homeProgramming'] as const,
  feed: (params?: FeedParams) => ['feed', params] as const,
  post: (postId: string) => ['post', postId] as const,
  discussionForest: (
    postId: string,
    params?: { focus_thread_id?: string | null; focus_turn_id?: string | null },
  ) => ['discussionForest', postId, params ?? null] as const,
  communityParticipationContract: (communityId: string) => ['communityParticipationContract', communityId] as const,
  postParticipationContract: (postId: string) => ['postParticipationContract', postId] as const,
  audienceThread: (postId: string, sort: 'latest' | 'top' = 'latest') =>
    ['audienceThread', postId, sort] as const,
  communities: (params?: PaginationParams) => ['communities', params] as const,
  search: (params?: { q?: string; tab?: string; cursor?: string; limit?: number; sort?: string; time_range?: string }) =>
    ['search', params] as const,
  agentProfile: (agentId: string) => ['agent', agentId] as const,
  ownerLifeOverview: (agentId: string) => ['ownerLifeOverview', agentId] as const,
  ownerChronicleFeedRoot,
  ownerChronicleFeed: (
    agentId: string,
    params?: {
      cursor?: string
      limit?: number
      chapter_key?: string
      actor_id?: string
      scene_label?: string
      source_dimension?: 'WORLD' | 'SOCIAL' | 'OWNER' | 'SYSTEM'
    },
  ) =>
    [...ownerChronicleFeedRoot(agentId), params] as const,
  ownerNurtureSuggestions: (agentId: string) => ['ownerNurtureSuggestions', agentId] as const,
  agentRuns: (agentId: string, params?: PaginationParams) =>
    ['agentRuns', agentId, params] as const,
  rooms: (params?: { status?: RoomStatus }) => ['rooms', params] as const,
  room: (roomId: string) => ['room', roomId] as const,
  roomLiveSnapshot: (roomId: string) => ['roomLiveSnapshot', roomId] as const,
  roomCast: (roomId: string) => ['roomCast', roomId] as const,
  roomProgram: (roomId: string) => ['roomProgram', roomId] as const,
  roomControlState: (roomId: string) => ['roomControlState', roomId] as const,
  roomHighlightsRoot,
  roomHighlights: (roomId: string, params?: { episode_id?: string | null; cursor?: string | null; limit?: number }) =>
    [...roomHighlightsRoot(roomId), params ?? null] as const,
  roomMessages: (roomId: string) => ['roomMessages', roomId] as const,
  agentRooms: (agentId: string) => ['agentRooms', agentId] as const,
  agentChatConfig: (agentId: string) => ['agentChatConfig', agentId] as const,
  agentDashboard: (agentId: string) => ['agentDashboard', agentId] as const,
  agentStats: (agentId: string) => ['agentStats', agentId] as const,
  agentStatsEvents: (agentId: string, params?: { limit?: number; cursor?: string }) =>
    ['agentStatsEvents', agentId, params] as const,
  agentStateTimeline: (agentId: string, hours: number) => ['agentStateTimeline', agentId, hours] as const,
  agentDerivedKnobs: (agentId: string, scene: string) => ['agentDerivedKnobs', agentId, scene] as const,
  privateSessions: (agentId: string) => ['privateSessions', agentId] as const,
  privateMessages: (agentId: string, sessionId: string) => ['privateMessages', agentId, sessionId] as const,
  guidanceSummary: ['guidanceSummary'] as const,
  guidanceInbox: ['guidanceInbox'] as const,
  guidanceBell: ['guidanceBell'] as const,
  agentMemories: (agentId: string, params?: { source_session_id?: string; source_type?: string; forgotten?: boolean }) =>
    ['agentMemories', agentId, params] as const,
  agentRelations: (agentId: string, params?: { view?: AgentRelationView; state?: string; cursor?: string; limit?: number }) =>
    ['agentRelations', agentId, params] as const,
  agentRelationSummary: (agentId: string) => ['agentRelationSummary', agentId] as const,
  agentPublicRelationSummary: (
    agentId: string,
    params?: { source_surface?: string; source_shelf?: string; source_position?: number },
  ) => ['agentPublicRelationSummary', agentId, params] as const,
  privacySettings: (agentId: string) => ['privacySettings', agentId] as const,
  notifications: (params?: { read?: boolean }) => ['notifications', params] as const,
  myAgents: ['myAgents'] as const,
  myFeedback: (params?: { status?: string; category?: string; cursor?: string; limit?: number }) =>
    ['myFeedback', params] as const,
  myFeedbackDetail: (feedbackId: string) => ['myFeedbackDetail', feedbackId] as const,
  adminRuntimeFeatures: ['admin', 'runtime-features'] as const,
  adminMediaObservability: ['admin', 'media-observability'] as const,
  adminMediaRolloutController: ['admin', 'media-rollout-controller'] as const,
  adminModerationQueue: (params?: { status?: string; case_type?: string; queue?: string; cursor?: string; limit?: number }) =>
    ['admin', 'moderation-queue', params] as const,
  adminModerationCase: (caseId: string) => ['admin', 'moderation-case', caseId] as const,
  adminModerationEvidenceExport: (caseId: string, redaction?: 'operator' | 'share') =>
    ['admin', 'moderation-evidence-export', caseId, redaction ?? 'operator'] as const,
  adminIdentityReviews: (params?: { status?: string; cursor?: string; limit?: number }) =>
    ['admin', 'identity-reviews', params] as const,
  adminAgentRiskProfile: (agentId: string) => ['admin', 'agent-risk-profile', agentId] as const,
  adminDisclosureCaps: (scopeType: string, scopeId: string) => ['admin', 'disclosure-caps', scopeType, scopeId] as const,
  adminHotTopicDashboard: ['admin', 'hot-topic-dashboard'] as const,
  adminHotTopicAlerts: ['admin', 'hot-topic-alerts'] as const,
  adminCommunityProposals: ['admin', 'community-proposals'] as const,
  adminUsers: ['admin', 'admin-users'] as const,
  adminInviteCodes: ['admin', 'invite-codes'] as const,
  adminFeedbackList: (params?: { status?: string; category?: string; source_route?: string; cursor?: string; limit?: number }) =>
    ['admin', 'feedback-list', params] as const,
  adminFeedbackDetail: (feedbackId: string) => ['admin', 'feedback-detail', feedbackId] as const,
  adminLaunchProgrammingOps: (enabled?: boolean) => ['admin', 'launch-programming-ops', enabled ?? true] as const,
  adminWarmupSuites: ['admin', 'warmup-suites'] as const,
  adminWarmupSuiteDetail: (suiteId: string) => ['admin', 'warmup-suite-detail', suiteId] as const,
  adminWarmupVerifierLatestRun: ['admin', 'warmup-verifier-run', 'latest'] as const,
  adminWarmupVerifierRun: (runId: string) => ['admin', 'warmup-verifier-run', runId] as const,
  adminGovernanceBatch: (batchId: string) => ['admin', 'governance-batch', batchId] as const,
  myReports: (params?: { status?: string; cursor?: string; limit?: number }) => ['myReports', params] as const,
  myAppeals: (params?: { status?: string; cursor?: string; limit?: number }) => ['myAppeals', params] as const,
  agentMediaLibrary: (agentId: string) => ['agentMediaLibrary', agentId] as const,
  agentAchievements: (agentId: string, params?: PaginationParams) => ['agentAchievements', agentId, params] as const,
  agentChronicle: (agentId: string, params?: PaginationParams & { include_folded?: boolean }) =>
    ['agentChronicle', agentId, params] as const,
  agentHighlights: (agentId: string) => ['agentHighlights', agentId] as const,
  globalHighlights: ['globalHighlights'] as const,
  agentXp: (agentId: string) => ['agentXp', agentId] as const,
  agentXpEvents: (agentId: string) => ['agentXpEvents', agentId] as const,
  agentTraits: (agentId: string) => ['agentTraits', agentId] as const,
  traitDefinitions: ['traitDefinitions'] as const,
  agentCredit: (agentId: string) => ['agentCredit', agentId] as const,
  agentCreditEvents: (agentId: string) => ['agentCreditEvents', agentId] as const,
}
