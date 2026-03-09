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
} from '../types'

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
      qc.invalidateQueries({ queryKey: ['rooms'] })
      qc.invalidateQueries({ queryKey: queryKeys.room(variables.roomId) })
      qc.invalidateQueries({ queryKey: queryKeys.roomLiveSnapshot(variables.roomId) })
      qc.invalidateQueries({ queryKey: queryKeys.roomCast(variables.roomId) })
      qc.invalidateQueries({ queryKey: queryKeys.roomProgram(variables.roomId) })
    },
  })
}

export function useRecallAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ roomId, agentId }: { roomId: string; agentId: string }) =>
      api.post(`rooms/${roomId}/agents/${agentId}/leave`).json<ApiResponse<unknown>>(),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['rooms'] })
      qc.invalidateQueries({ queryKey: queryKeys.room(variables.roomId) })
      qc.invalidateQueries({ queryKey: queryKeys.roomLiveSnapshot(variables.roomId) })
      qc.invalidateQueries({ queryKey: queryKeys.roomCast(variables.roomId) })
      qc.invalidateQueries({ queryKey: queryKeys.roomProgram(variables.roomId) })
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
