import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import type { ApiResponse, PrivateSession, PrivateMessage, PaginatedList, SendMessageResult } from '../types'

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
