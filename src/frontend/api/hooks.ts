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
    mutationFn: (body: { display_name: string; model: string; owner_id: string }) =>
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

export function useHumanVote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      target_type: 'POST' | 'COMMENT'
      target_id: string
      direction: 'UP' | 'DOWN' | 'NEUTRAL'
    }) =>
      api
        .post('votes/human', { json: body })
        .json<ApiResponse<{ vote_score: number; user_vote: 'UP' | 'DOWN' | null }>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['post'] })
      qc.invalidateQueries({ queryKey: ['comments'] })
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
