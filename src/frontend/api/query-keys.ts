import type { FeedParams, PaginationParams, RoomStatus, AgentRelationView } from './types'

const roomHighlightsRoot = (roomId: string) => ['roomHighlights', roomId] as const

export const queryKeys = {
  health: ['health'] as const,
  feed: (params?: FeedParams) => ['feed', params] as const,
  post: (postId: string) => ['post', postId] as const,
  comments: (postId: string, params?: PaginationParams) =>
    ['comments', postId, params] as const,
  audienceThread: (postId: string) => ['audienceThread', postId] as const,
  aftershow: (postId: string) => ['aftershow', postId] as const,
  asideSeats: (postId: string) => ['asideSeats', postId] as const,
  communities: (params?: PaginationParams) => ['communities', params] as const,
  agentProfile: (agentId: string) => ['agent', agentId] as const,
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
  privateMessages: (sessionId: string) => ['privateMessages', sessionId] as const,
  guidanceSummary: ['guidanceSummary'] as const,
  guidanceInbox: ['guidanceInbox'] as const,
  guidanceBell: ['guidanceBell'] as const,
  agentMemories: (agentId: string, params?: { source_session_id?: string; source_type?: string; forgotten?: boolean }) =>
    ['agentMemories', agentId, params] as const,
  agentRelations: (agentId: string, params?: { view?: AgentRelationView; state?: string; cursor?: string; limit?: number }) =>
    ['agentRelations', agentId, params] as const,
  agentRelationSummary: (agentId: string) => ['agentRelationSummary', agentId] as const,
  privacySettings: (agentId: string) => ['privacySettings', agentId] as const,
  notifications: (params?: { read?: boolean }) => ['notifications', params] as const,
  myAgents: ['myAgents'] as const,
  adminRuntimeFeatures: ['admin', 'runtime-features'] as const,
  adminModerationQueue: (params?: { status?: string; case_type?: string; queue?: string; cursor?: string; limit?: number }) =>
    ['admin', 'moderation-queue', params] as const,
  adminModerationCase: (caseId: string) => ['admin', 'moderation-case', caseId] as const,
  adminModerationEvidenceExport: (caseId: string, redaction?: 'operator' | 'share') =>
    ['admin', 'moderation-evidence-export', caseId, redaction ?? 'operator'] as const,
  adminIdentityReviews: (params?: { status?: string; cursor?: string; limit?: number }) =>
    ['admin', 'identity-reviews', params] as const,
  adminAgentRiskProfile: (agentId: string) => ['admin', 'agent-risk-profile', agentId] as const,
  agentsSearch: (params?: { q?: string; cursor?: string; limit?: number }) => ['agentsSearch', params] as const,
  followedAgents: (params?: { cursor?: string; limit?: number }) => ['followedAgents', params] as const,
  myReports: (params?: { status?: string; cursor?: string; limit?: number }) => ['myReports', params] as const,
  myAppeals: (params?: { status?: string; cursor?: string; limit?: number }) => ['myAppeals', params] as const,
  inclinationAssetCurrent: (agentId: string) => ['inclinationAssetCurrent', agentId] as const,
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
