import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import type {
  ApiResponse,
  Room,
  RoomWithMembers,
  ChatMessage,
  AgentChatConfig,
  RoomStatus,
  RoomLiveSnapshot,
  RoomCastView,
  RoomProgramView,
  RoomHighlight,
  RoomControlState,
  RoomCueType,
  RoomCastRole,
  RoomSceneType,
  RoomWanderPolicy,
} from '../types'

function invalidateRoomQueries(qc: ReturnType<typeof useQueryClient>, roomId: string) {
  qc.invalidateQueries({ queryKey: ['rooms'] })
  qc.invalidateQueries({ queryKey: queryKeys.room(roomId) })
  qc.invalidateQueries({ queryKey: queryKeys.roomLiveSnapshot(roomId) })
  qc.invalidateQueries({ queryKey: queryKeys.roomCast(roomId) })
  qc.invalidateQueries({ queryKey: queryKeys.roomProgram(roomId) })
  qc.invalidateQueries({ queryKey: queryKeys.roomControlState(roomId) })
  qc.invalidateQueries({ queryKey: queryKeys.roomHighlightsRoot(roomId) })
}

export function useRooms(params?: { status?: RoomStatus; refetchInterval?: number }) {
  return useQuery({
    queryKey: queryKeys.rooms(params ? { status: params.status } : undefined),
    queryFn: () =>
      api.get(`rooms${params?.status ? `?status=${params.status}` : ''}`).json<ApiResponse<Room[]>>(),
    refetchInterval: params?.refetchInterval,
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

export function useRoomLiveSnapshot(roomId: string) {
  return useQuery({
    queryKey: queryKeys.roomLiveSnapshot(roomId),
    queryFn: () =>
      api.get(`rooms/${roomId}/live-snapshot`).json<ApiResponse<RoomLiveSnapshot>>(),
    enabled: !!roomId,
  })
}

export function useRoomCast(roomId: string) {
  return useQuery({
    queryKey: queryKeys.roomCast(roomId),
    queryFn: () =>
      api.get(`rooms/${roomId}/cast`).json<ApiResponse<RoomCastView>>(),
    enabled: !!roomId,
  })
}

export function useRoomProgram(roomId: string) {
  return useQuery({
    queryKey: queryKeys.roomProgram(roomId),
    queryFn: () =>
      api.get(`rooms/${roomId}/program`).json<ApiResponse<RoomProgramView>>(),
    enabled: !!roomId,
  })
}

export function useRoomControlState(roomId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.roomControlState(roomId),
    queryFn: () =>
      api.get(`rooms/${roomId}/control-state`).json<ApiResponse<RoomControlState>>(),
    enabled: !!roomId && (options?.enabled ?? true),
    retry: false,
  })
}

export function useRoomHighlights(
  roomId: string,
  params?: { episode_id?: string | null; cursor?: string | null; limit?: number },
) {
  const search = new URLSearchParams()
  if (params?.episode_id) search.set('episode_id', params.episode_id)
  if (params?.cursor) search.set('before', params.cursor)
  if (params?.limit) search.set('limit', String(params.limit))
  const suffix = search.toString()

  return useQuery({
    queryKey: queryKeys.roomHighlights(roomId, params),
    queryFn: () =>
      api.get(`rooms/${roomId}/highlights${suffix ? `?${suffix}` : ''}`).json<ApiResponse<RoomHighlight[]>>(),
    enabled: !!roomId,
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
    onSuccess: (_data, variables) => {
      invalidateRoomQueries(qc, variables.roomId)
    },
  })
}

export function useRecallAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ roomId, agentId }: { roomId: string; agentId: string }) =>
      api.post(`rooms/${roomId}/agents/${agentId}/leave`).json<ApiResponse<unknown>>(),
    onSuccess: (_data, variables) => {
      invalidateRoomQueries(qc, variables.roomId)
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

export function usePatchRoomProgram(roomId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      enabled?: boolean
      scene_type?: RoomSceneType
      pacing_preset?: string
      target_cast_min?: number
      target_cast_max?: number
      callback_window?: number
      recap_every_turns?: number
      max_consecutive_turns?: number
      idle_cue_after_ms?: number
      allow_wandering?: boolean
      director_policy?: Record<string, unknown>
      wander_policy?: Partial<RoomWanderPolicy>
      discoverability?: {
        tags?: string[]
        short_hook?: string | null
        default_view?: string
      }
    }) =>
      api.patch(`rooms/${roomId}/program`, { json: body }).json<ApiResponse<RoomProgramView>>(),
    onSuccess: () => {
      invalidateRoomQueries(qc, roomId)
    },
  })
}

export function useCreateRoomCue(roomId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      cue_type: RoomCueType
      director_goal: string
      target_roles?: RoomCastRole[]
      anchor_message_id?: string | null
      callback_message_id?: string | null
    }) =>
      api.post(`rooms/${roomId}/program/cues`, { json: body }).json<ApiResponse<unknown>>(),
    onSuccess: () => {
      invalidateRoomQueries(qc, roomId)
    },
  })
}

export function usePatchRoomMemberControl(roomId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      agentId: string
      role_hint?: RoomCastRole | null
      spotlight_weight?: number
      wander_eligible?: boolean
      suppressed_until?: string | null
    }) => {
      const { agentId, ...body } = input
      return api.patch(`rooms/${roomId}/members/${agentId}/control`, { json: body }).json<ApiResponse<unknown>>()
    },
    onSuccess: () => {
      invalidateRoomQueries(qc, roomId)
    },
  })
}
