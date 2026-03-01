import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type {
  ApiResponse,
  PostWithMeta,
  Comment,
  Community,
  Agent,
  AgentConfig,
  AgentRun,
  GovernanceResult,
  HealthData,
  FeedParams,
  PaginationParams,
  GovernanceActionType,
  Room,
  RoomWithMembers,
  ChatMessage,
  AgentChatConfig,
  AgentDashboardData,
  CostSummary,
  BudgetTierOption,
  RoomStatus,
  AgentGrowthInfo,
  AgentTraitInfo,
  AgentCreditInfo,
  GrowthEventInfo,
  TraitDefinition,
  CreditEventInfo,
  LevelTableEntry,
  InstructionInfo,
  InstructionTemplate,
  StyleSettings,
  PromptOverrides,
  PrivateSession,
  PrivateMessage,
  AgentMemoryInfo,
  AgentRelationItem,
  AgentRelationSummary,
  AgentRelationView,
  PrivacySettings,
  Notification,
  SendMessageResult,
  PaginatedList,
  AgentStatsSnapshot,
  AgentStatEventInfo,
  AgentStatePoint,
  StatsAllocationInput,
  StatsAllocationPreview,
  DerivedKnobsInfo,
  AgentSearchItem,
  FollowedAgentItem,
  HumanVoteResult,
  InclinationAsset,
  InclinationAssetCurrentState,
  AgentAchievementItem,
  ChronicleEntryItem,
  AgentHighlightsData,
} from './types'

export const queryKeys = {
  health: ['health'] as const,
  feed: (params?: FeedParams) => ['feed', params] as const,
  post: (postId: string) => ['post', postId] as const,
  comments: (postId: string, params?: PaginationParams) =>
    ['comments', postId, params] as const,
  communities: (params?: PaginationParams) => ['communities', params] as const,
  agentProfile: (agentId: string) => ['agent', agentId] as const,
  agentRuns: (agentId: string, params?: PaginationParams) =>
    ['agentRuns', agentId, params] as const,
  rooms: (params?: { status?: RoomStatus }) => ['rooms', params] as const,
  room: (roomId: string) => ['room', roomId] as const,
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
  agentMemories: (agentId: string) => ['agentMemories', agentId] as const,
  agentRelations: (agentId: string, params?: { view?: AgentRelationView; state?: string; cursor?: string; limit?: number }) =>
    ['agentRelations', agentId, params] as const,
  agentRelationSummary: (agentId: string) => ['agentRelationSummary', agentId] as const,
  privacySettings: (agentId: string) => ['privacySettings', agentId] as const,
  notifications: (params?: { read?: boolean }) => ['notifications', params] as const,
  myAgents: ['myAgents'] as const,
  agentsSearch: (params?: { q?: string; cursor?: string; limit?: number }) => ['agentsSearch', params] as const,
  followedAgents: (params?: { cursor?: string; limit?: number }) => ['followedAgents', params] as const,
  inclinationAssetCurrent: (agentId: string) => ['inclinationAssetCurrent', agentId] as const,
  agentAchievements: (agentId: string, params?: PaginationParams) => ['agentAchievements', agentId, params] as const,
  agentChronicle: (agentId: string, params?: PaginationParams & { include_folded?: boolean }) =>
    ['agentChronicle', agentId, params] as const,
  agentHighlights: (agentId: string) => ['agentHighlights', agentId] as const,
}

function toSearchString(params?: object): string {
  if (!params) return ''
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api.get('health').json<ApiResponse<HealthData>>(),
  })
}

export function useFeed(params?: FeedParams) {
  return useQuery({
    queryKey: queryKeys.feed(params),
    queryFn: () =>
      api.get(`feed${toSearchString(params)}`).json<ApiResponse<PostWithMeta[]>>(),
  })
}

export function usePost(postId: string) {
  return useQuery({
    queryKey: queryKeys.post(postId),
    queryFn: () => api.get(`posts/${postId}`).json<ApiResponse<PostWithMeta>>(),
    enabled: !!postId,
  })
}

export function useComments(postId: string, params?: PaginationParams) {
  return useQuery({
    queryKey: queryKeys.comments(postId, params),
    queryFn: () =>
      api
        .get(`posts/${postId}/comments${toSearchString(params)}`)
        .json<ApiResponse<Comment[]>>(),
    enabled: !!postId,
  })
}

export function useCommunities(params?: PaginationParams) {
  return useQuery({
    queryKey: queryKeys.communities(params),
    queryFn: () =>
      api.get(`communities${toSearchString(params)}`).json<ApiResponse<Community[]>>(),
  })
}

export function useAgentProfile(agentId: string) {
  return useQuery({
    queryKey: queryKeys.agentProfile(agentId),
    queryFn: () => api.get(`agents/${agentId}/profile`).json<ApiResponse<Agent>>(),
    enabled: !!agentId,
  })
}

export function useAgentSearch(params?: { q?: string; cursor?: string; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.agentsSearch(params),
    queryFn: () =>
      api.get(`agents${toSearchString(params)}`).json<ApiResponse<AgentSearchItem[]>>(),
  })
}

export function useAgentRuns(agentId: string, params?: PaginationParams) {
  return useQuery({
    queryKey: queryKeys.agentRuns(agentId, params),
    queryFn: () =>
      api
        .get(`agents/${agentId}/runs${toSearchString(params)}`)
        .json<ApiResponse<AgentRun[]>>(),
    enabled: !!agentId,
  })
}

export function useCommunityBySlug(slug: string) {
  const { data, ...rest } = useCommunities()
  const community = data?.data?.find((c) => c.slug === slug) ?? null
  return { data: community, ...rest }
}

export function useCreateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { display_name: string; model?: string; avatar_url?: string }) =>
      api.post('agents', { json: body }).json<ApiResponse<Agent>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}

export function useUpdateAgentConfig(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (config_json: Record<string, unknown>) =>
      api
        .patch(`agents/${agentId}/config`, { json: { config_json } })
        .json<ApiResponse<AgentConfig>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agentProfile(agentId) })
    },
  })
}

export function useGovernanceAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      action: GovernanceActionType
      target_type: 'post' | 'comment' | 'message' | 'agent'
      target_id: string
      reason?: string
    }) =>
      api
        .post('admin/moderation/actions', { json: body })
        .json<ApiResponse<GovernanceResult>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['post'] })
    },
  })
}

// ─── Chat hooks ──────────────────────────────────────────────

export function useRooms(params?: { status?: RoomStatus }) {
  return useQuery({
    queryKey: queryKeys.rooms(params),
    queryFn: () =>
      api.get(`rooms${toSearchString(params)}`).json<ApiResponse<Room[]>>(),
  })
}

export function useRoom(roomId: string) {
  return useQuery({
    queryKey: queryKeys.room(roomId),
    queryFn: () => api.get(`rooms/${roomId}`).json<ApiResponse<RoomWithMembers>>(),
    enabled: !!roomId,
  })
}

export function useRoomMessages(roomId: string) {
  return useQuery({
    queryKey: queryKeys.roomMessages(roomId),
    queryFn: () =>
      api.get(`rooms/${roomId}/messages?limit=100`).json<ApiResponse<ChatMessage[]>>(),
    enabled: !!roomId,
    refetchInterval: 10_000,
  })
}

export function useAgentChatConfig(agentId: string) {
  return useQuery({
    queryKey: queryKeys.agentChatConfig(agentId),
    queryFn: () =>
      api.get(`agents/${agentId}/chat-config`).json<ApiResponse<AgentChatConfig>>(),
    enabled: !!agentId,
  })
}

export function useCreateRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; description?: string; created_by_agent_id: string }) =>
      api.post('rooms', { json: body }).json<ApiResponse<Room>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export function useDispatchAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ roomId, agentId }: { roomId: string; agentId: string }) =>
      api.post(`rooms/${roomId}/agents/${agentId}/join`).json<ApiResponse<unknown>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] })
      qc.invalidateQueries({ queryKey: ['room'] })
    },
  })
}

export function useRecallAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ roomId, agentId }: { roomId: string; agentId: string }) =>
      api.post(`rooms/${roomId}/agents/${agentId}/leave`).json<ApiResponse<unknown>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] })
      qc.invalidateQueries({ queryKey: ['room'] })
    },
  })
}

export function useUpdateAgentChatConfig2(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { talkativeness?: number; allow_wandering?: boolean }) =>
      api
        .patch(`agents/${agentId}/chat-config`, { json: body })
        .json<ApiResponse<AgentChatConfig>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agentChatConfig(agentId) })
    },
  })
}

// ─── Agent Dashboard hooks ───────────────────────────────────

export function useAgentDashboard(agentId: string) {
  return useQuery({
    queryKey: queryKeys.agentDashboard(agentId),
    queryFn: () =>
      api
        .get(`agents/${agentId}/dashboard`)
        .json<ApiResponse<AgentDashboardData>>(),
    enabled: !!agentId,
    refetchInterval: 30_000,
  })
}

export function useAgentCostReview(agentId: string, days = 30) {
  return useQuery({
    queryKey: ['agentCostReview', agentId, days] as const,
    queryFn: () =>
      api
        .get(`agents/${agentId}/cost-review?days=${days}`)
        .json<ApiResponse<CostSummary>>(),
    enabled: !!agentId,
  })
}

export function useBudgetTiers() {
  return useQuery({
    queryKey: ['budgetTiers'] as const,
    queryFn: () =>
      api.get('budget/tiers').json<ApiResponse<Record<string, BudgetTierOption>>>(),
    staleTime: Infinity,
  })
}

export function useInitBudget(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tier: string) =>
      api.post(`agents/${agentId}/budget/init`, { json: { tier } }).json<ApiResponse<unknown>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agentDashboard(agentId) })
    },
  })
}

export function useChangeBudgetTier(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tier: string) =>
      api.patch(`agents/${agentId}/budget/tier`, { json: { tier } }).json<ApiResponse<unknown>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agentDashboard(agentId) })
    },
  })
}

// ─── Stats hooks ────────────────────────────────────────────

export function useAgentStats(agentId: string) {
  return useQuery({
    queryKey: queryKeys.agentStats(agentId),
    queryFn: () =>
      api.get(`agents/${agentId}/stats`).json<ApiResponse<AgentStatsSnapshot>>(),
    enabled: !!agentId,
  })
}

export function useAgentStatsEvents(agentId: string, params?: { limit?: number; cursor?: string }) {
  return useQuery({
    queryKey: queryKeys.agentStatsEvents(agentId, params),
    queryFn: () =>
      api.get(`agents/${agentId}/stats/events${toSearchString(params)}`)
        .json<ApiResponse<{ items: AgentStatEventInfo[]; next_cursor: string | null }>>(),
    enabled: !!agentId,
  })
}

export function useAgentStateTimeline(agentId: string, hours = 24) {
  return useQuery({
    queryKey: queryKeys.agentStateTimeline(agentId, hours),
    queryFn: () =>
      api.get(`agents/${agentId}/stats/state-timeline?hours=${hours}`).json<ApiResponse<AgentStatePoint[]>>(),
    enabled: !!agentId,
  })
}

export function useAgentDerivedKnobs(agentId: string, scene: 'forum' | 'chat' | 'relation' | 'vote' | 'memory') {
  return useQuery({
    queryKey: queryKeys.agentDerivedKnobs(agentId, scene),
    queryFn: () =>
      api.get(`agents/${agentId}/stats/derived?scene=${scene}`).json<ApiResponse<DerivedKnobsInfo>>(),
    enabled: !!agentId,
  })
}

export function usePreviewStatsAllocation(agentId: string) {
  return useMutation({
    mutationFn: (body: { allocation: StatsAllocationInput; version?: number }) =>
      api.post(`agents/${agentId}/stats/preview-allocation`, { json: body }).json<ApiResponse<StatsAllocationPreview>>(),
  })
}

export function useAllocateStats(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { allocation: StatsAllocationInput; version?: number; confirm_no_respec: true; idempotency_key: string }) =>
      api.post(`agents/${agentId}/stats/allocate`, { json: body }).json<ApiResponse<AgentStatsSnapshot & { spent_points: number; remaining_points: number; deduped: boolean }>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agentStats(agentId) })
      qc.invalidateQueries({ queryKey: ['agentStatsEvents', agentId] })
      qc.invalidateQueries({ queryKey: ['agentStateTimeline', agentId] })
      qc.invalidateQueries({ queryKey: ['agentDerivedKnobs', agentId] })
    },
  })
}

// ─── Interaction UX hooks ───────────────────────────────────

export function useAgentStyle(agentId: string) {
  return useQuery({
    queryKey: ['agentStyle', agentId] as const,
    queryFn: () => api.get(`agents/${agentId}/style`).json<ApiResponse<StyleSettings>>(),
    enabled: !!agentId,
  })
}

export function useUpdateAgentStyle(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (style: Partial<StyleSettings>) =>
      api.patch(`agents/${agentId}/style`, { json: style }).json<ApiResponse<unknown>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agentStyle', agentId] })
    },
  })
}

export function useAgentInstructions(agentId: string) {
  return useQuery({
    queryKey: ['agentInstructions', agentId] as const,
    queryFn: () => api.get(`agents/${agentId}/instructions`).json<ApiResponse<InstructionInfo[]>>(),
    enabled: !!agentId,
  })
}

export function useCreateInstruction(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; trigger_type: string; trigger_params?: unknown; body: string; priority?: number }) =>
      api.post(`agents/${agentId}/instructions`, { json: data }).json<ApiResponse<{ id: string }>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agentInstructions', agentId] })
    },
  })
}

export function useUpdateInstruction(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; trigger_type?: string; trigger_params?: unknown; body?: string; priority?: number }) =>
      api.patch(`agents/${agentId}/instructions/${id}`, { json: data }).json<ApiResponse<unknown>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agentInstructions', agentId] })
    },
  })
}

export function useDeleteInstruction(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`agents/${agentId}/instructions/${id}`).json<ApiResponse<unknown>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agentInstructions', agentId] })
    },
  })
}

export function useToggleInstruction(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`agents/${agentId}/instructions/${id}/toggle`).json<ApiResponse<{ enabled: boolean }>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agentInstructions', agentId] })
    },
  })
}

export function useInstructionTemplates() {
  return useQuery({
    queryKey: ['instructionTemplates'] as const,
    queryFn: () => api.get('instruction-templates').json<ApiResponse<InstructionTemplate[]>>(),
    staleTime: Infinity,
  })
}

export function useAgentPromptOverrides(agentId: string) {
  return useQuery({
    queryKey: ['agentPromptOverrides', agentId] as const,
    queryFn: () => api.get(`agents/${agentId}/prompt-overrides`).json<ApiResponse<PromptOverrides>>(),
    enabled: !!agentId,
  })
}

export function useUpdatePromptOverrides(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (overrides: PromptOverrides) =>
      api.patch(`agents/${agentId}/prompt-overrides`, { json: overrides }).json<ApiResponse<unknown>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agentPromptOverrides', agentId] })
    },
  })
}

// ─── Nurture hooks ──────────────────────────────────────────

export function useAgentGrowth(agentId: string) {
  return useQuery({
    queryKey: ['agentGrowth', agentId] as const,
    queryFn: () => api.get(`agents/${agentId}/growth`).json<ApiResponse<AgentGrowthInfo>>(),
    enabled: !!agentId,
  })
}

export function useAgentAchievements(agentId: string, params?: PaginationParams) {
  return useQuery({
    queryKey: queryKeys.agentAchievements(agentId, params),
    queryFn: () =>
      api
        .get(`agents/${agentId}/achievements${toSearchString(params)}`)
        .json<ApiResponse<AgentAchievementItem[]>>(),
    enabled: !!agentId,
  })
}

export function useAgentChronicle(
  agentId: string,
  params?: PaginationParams & { include_folded?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.agentChronicle(agentId, params),
    queryFn: () =>
      api
        .get(`agents/${agentId}/chronicle${toSearchString(params)}`)
        .json<ApiResponse<ChronicleEntryItem[]>>(),
    enabled: !!agentId,
  })
}

export function useAgentHighlights(agentId: string) {
  return useQuery({
    queryKey: queryKeys.agentHighlights(agentId),
    queryFn: () =>
      api
        .get(`agents/${agentId}/highlights`)
        .json<ApiResponse<AgentHighlightsData>>(),
    enabled: !!agentId,
  })
}

export function useAgentTraits(agentId: string) {
  return useQuery({
    queryKey: ['agentTraits', agentId] as const,
    queryFn: () => api.get(`agents/${agentId}/traits`).json<ApiResponse<AgentTraitInfo[]>>(),
    enabled: !!agentId,
  })
}

export function useTraitDefinitions() {
  return useQuery({
    queryKey: ['traitDefinitions'] as const,
    queryFn: () => api.get('trait-definitions').json<ApiResponse<TraitDefinition[]>>(),
    staleTime: Infinity,
  })
}

export function useEquipTrait(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (traitCode: string) =>
      api.post(`agents/${agentId}/traits/${traitCode}/equip`).json<ApiResponse<unknown>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agentTraits', agentId] })
      qc.invalidateQueries({ queryKey: ['agentDashboard', agentId] })
    },
  })
}

export function useUnequipTrait(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (traitCode: string) =>
      api.post(`agents/${agentId}/traits/${traitCode}/unequip`).json<ApiResponse<unknown>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agentTraits', agentId] })
      qc.invalidateQueries({ queryKey: ['agentDashboard', agentId] })
    },
  })
}

export function useAgentCredit(agentId: string) {
  return useQuery({
    queryKey: ['agentCredit', agentId] as const,
    queryFn: () => api.get(`agents/${agentId}/credit`).json<ApiResponse<AgentCreditInfo>>(),
    enabled: !!agentId,
  })
}

export function useAgentCreditEvents(agentId: string) {
  return useQuery({
    queryKey: ['agentCreditEvents', agentId] as const,
    queryFn: () => api.get(`agents/${agentId}/credit-events?limit=20`).json<ApiResponse<CreditEventInfo[]>>(),
    enabled: !!agentId,
  })
}

export function useAgentGrowthEvents(agentId: string) {
  return useQuery({
    queryKey: ['agentGrowthEvents', agentId] as const,
    queryFn: () => api.get(`agents/${agentId}/growth-events?limit=50`).json<ApiResponse<GrowthEventInfo[]>>(),
    enabled: !!agentId,
  })
}

export function useAgentMilestones(agentId: string) {
  return useQuery({
    queryKey: ['agentMilestones', agentId] as const,
    queryFn: () => api.get(`agents/${agentId}/milestones`).json<ApiResponse<string[]>>(),
    enabled: !!agentId,
  })
}

export function useLevelTable() {
  return useQuery({
    queryKey: ['levelTable'] as const,
    queryFn: () => api.get('growth/level-table').json<ApiResponse<LevelTableEntry[]>>(),
    staleTime: Infinity,
  })
}

// ─── Private Channel hooks ──────────────────────────────────

export function usePrivateSessions(agentId: string) {
  return useQuery({
    queryKey: queryKeys.privateSessions(agentId),
    queryFn: () =>
      api.get(`agents/${agentId}/chat/sessions`).json<ApiResponse<PaginatedList<PrivateSession>>>(),
    enabled: !!agentId,
  })
}

export function usePrivateMessages(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.privateMessages(sessionId),
    queryFn: () =>
      api
        .get(`agents/_/chat/sessions/${sessionId}/messages?limit=100`)
        .json<ApiResponse<PaginatedList<PrivateMessage>>>(),
    enabled: !!sessionId,
    refetchInterval: 0,
  })
}

export function useCreatePrivateSession(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.post(`agents/${agentId}/chat/sessions`).json<ApiResponse<PrivateSession>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.privateSessions(agentId) })
    },
  })
}

export function useSendPrivateMessage(agentId: string, sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: string) =>
      api
        .post(`agents/${agentId}/chat/sessions/${sessionId}/messages`, { json: { content } })
        .json<ApiResponse<SendMessageResult>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.privateMessages(sessionId) })
    },
  })
}

export function useEndPrivateSession(agentId: string, sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api
        .post(`agents/${agentId}/chat/sessions/${sessionId}/end`)
        .json<ApiResponse<{ session: PrivateSession; digest_status: string }>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.privateSessions(agentId) })
      qc.invalidateQueries({ queryKey: queryKeys.privateMessages(sessionId) })
    },
  })
}

export function useAgentMemories(agentId: string) {
  return useQuery({
    queryKey: queryKeys.agentMemories(agentId),
    queryFn: () =>
      api.get(`agents/${agentId}/memories`).json<ApiResponse<PaginatedList<AgentMemoryInfo>>>(),
    enabled: !!agentId,
  })
}

export function useAgentRelations(
  agentId: string,
  params?: { view?: AgentRelationView; state?: string; cursor?: string; limit?: number },
) {
  return useQuery({
    queryKey: queryKeys.agentRelations(agentId, params),
    queryFn: () =>
      api
        .get(`agents/${agentId}/relations${toSearchString(params)}`)
        .json<ApiResponse<PaginatedList<AgentRelationItem>>>(),
    enabled: !!agentId,
  })
}

export function useAgentRelationSummary(agentId: string) {
  return useQuery({
    queryKey: queryKeys.agentRelationSummary(agentId),
    queryFn: () =>
      api
        .get(`agents/${agentId}/relations/summary`)
        .json<ApiResponse<AgentRelationSummary>>(),
    enabled: !!agentId,
  })
}

export function usePrivacySettings(agentId: string) {
  return useQuery({
    queryKey: queryKeys.privacySettings(agentId),
    queryFn: () =>
      api.get(`agents/${agentId}/privacy-settings`).json<ApiResponse<PrivacySettings>>(),
    enabled: !!agentId,
  })
}

export function useUpdatePrivacySettings(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<PrivacySettings>) =>
      api
        .patch(`agents/${agentId}/privacy-settings`, { json: data })
        .json<ApiResponse<PrivacySettings>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.privacySettings(agentId) })
    },
  })
}

export function useNotifications(params?: { read?: boolean }) {
  return useQuery({
    queryKey: queryKeys.notifications(params),
    queryFn: () =>
      api
        .get(`me/notifications${toSearchString(params)}`)
        .json<ApiResponse<PaginatedList<Notification> & { unread_count: number }>>(),
    refetchInterval: 30_000,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`me/notifications/${id}/read`).json<ApiResponse<Notification>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.post('me/notifications/read-all').json<ApiResponse<{ count: number }>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMyAgents() {
  return useQuery({
    queryKey: queryKeys.myAgents,
    queryFn: () => api.get('me/agents').json<ApiResponse<Agent[]>>(),
    staleTime: 60_000,
  })
}

export function useFollowedAgents(params?: { cursor?: string; limit?: number }, enabled = true) {
  return useQuery({
    queryKey: queryKeys.followedAgents(params),
    queryFn: () =>
      api.get(`me/followed-agents${toSearchString(params)}`).json<ApiResponse<FollowedAgentItem[]>>(),
    enabled,
  })
}

export function useFollowAgent(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post(`agents/${agentId}/follow`).json<ApiResponse<{ follow_id: string; created_at: string }>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agentsSearch'] })
      qc.invalidateQueries({ queryKey: ['followedAgents'] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: queryKeys.agentProfile(agentId) })
    },
  })
}

export function useUnfollowAgent(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete(`agents/${agentId}/follow`).json<ApiResponse<{ removed: boolean }>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agentsSearch'] })
      qc.invalidateQueries({ queryKey: ['followedAgents'] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: queryKeys.agentProfile(agentId) })
    },
  })
}

export function useHumanVote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { target_type: 'POST' | 'COMMENT'; target_id: string; direction: 'UP' | 'DOWN' | 'NEUTRAL' }) =>
      api.post('votes/human', { json: body }).json<ApiResponse<HumanVoteResult>>(),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      if (variables.target_type === 'POST') {
        qc.invalidateQueries({ queryKey: ['post', variables.target_id] })
      }
      qc.invalidateQueries({ queryKey: ['comments'] })
    },
  })
}

export function useInclinationAssetCurrent(agentId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.inclinationAssetCurrent(agentId),
    queryFn: () =>
      api.get(`agents/${agentId}/inclination-asset/current`).json<ApiResponse<InclinationAssetCurrentState>>(),
    enabled: !!agentId && enabled,
  })
}

export function useCreateInclinationAssetFromUrl(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { source_url: string; owner_note?: string }) =>
      api.post(`agents/${agentId}/inclination-asset/url`, { json: payload }).json<ApiResponse<InclinationAsset>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inclinationAssetCurrent(agentId) })
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}

export function useCreateInclinationAssetFromUpload(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { file: File; owner_note?: string }) => {
      const formData = new FormData()
      formData.set('file', payload.file)
      if (payload.owner_note?.trim()) formData.set('owner_note', payload.owner_note.trim())
      return api
        .post(`agents/${agentId}/inclination-asset/upload`, { body: formData })
        .json<ApiResponse<InclinationAsset>>()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inclinationAssetCurrent(agentId) })
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}

export function useDeleteInclinationAssetCurrent(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.delete(`agents/${agentId}/inclination-asset/current`).json<ApiResponse<{ removed: boolean }>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inclinationAssetCurrent(agentId) })
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}
