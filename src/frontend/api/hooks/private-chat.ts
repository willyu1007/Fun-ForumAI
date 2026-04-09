import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getApiErrorCode } from '../client'
import { queryKeys } from '../query-keys'
import type {
  ApiResponse,
  PaginatedList,
  PrivateMessage,
  PrivateMessageAttachment,
  PrivateSession,
  SendMessageResult,
  SendPrivateMessageInput,
} from '../types'

export interface PrivateMessageTimelineChunk {
  session: PrivateSession
  messages: PrivateMessage[]
}

export function usePrivateSessions(agentId: string) {
  return useQuery({
    queryKey: queryKeys.privateSessions(agentId),
    queryFn: () =>
      api.get(`agents/${agentId}/chat/sessions`).json<ApiResponse<PaginatedList<PrivateSession>>>(),
    enabled: !!agentId,
  })
}

export function usePrivateMessageTimeline(agentId: string, sessions: PrivateSession[]) {
  const results = useQueries({
    queries: sessions.map((session) => ({
      queryKey: queryKeys.privateMessages(agentId, session.id),
      queryFn: () =>
        api
          .get(`agents/${agentId}/chat/sessions/${session.id}/messages?limit=100`)
          .json<ApiResponse<PaginatedList<PrivateMessage>>>(),
      enabled: !!agentId && !!session.id,
      refetchInterval: 0,
    })),
  })

  const items: PrivateMessageTimelineChunk[] = sessions.map((session, index) => ({
    session,
    messages: results[index]?.data?.data?.items ?? [],
  }))

  const firstError = results.find((result) => result.isError)?.error

  return {
    items,
    isLoading: sessions.length > 0 && results.some((result) => result.isLoading),
    isError: Boolean(firstError),
    error: firstError instanceof Error ? firstError : null,
  }
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
    mutationFn: (input: SendPrivateMessageInput) =>
      api
        .post(`agents/${agentId}/chat/sessions/${sessionId}/messages`, { json: input })
        .json<ApiResponse<SendMessageResult>>(),
    onError: (error) => {
      const isInactiveSession =
        getApiErrorCode(error) === 'VALIDATION_ERROR'
        && error instanceof Error
        && error.message.includes('Session is not active')

      if (!isInactiveSession) {
        return
      }

      qc.invalidateQueries({ queryKey: queryKeys.privateSessions(agentId) })
      qc.invalidateQueries({ queryKey: queryKeys.privateMessages(agentId, sessionId) })
    },
    onSuccess: (response) => {
      qc.setQueryData<ApiResponse<PaginatedList<PrivateMessage>> | undefined>(
        queryKeys.privateMessages(agentId, sessionId),
        (current) => {
          const existing = current?.data?.items ?? []
          const appended = appendPrivateMessages(existing, [
            response.data.human_message,
            response.data.agent_reply,
          ])
          return {
            data: {
              items: appended,
              next_cursor: current?.data?.next_cursor ?? null,
            },
            meta: current?.meta,
          }
        },
      )
      qc.invalidateQueries({ queryKey: queryKeys.privateMessages(agentId, sessionId) })
    },
  })
}

export function useUploadPrivateMessageAttachment(agentId: string, sessionId: string) {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.set('file', file)
      return api
        .post(`agents/${agentId}/chat/sessions/${sessionId}/attachments`, { body: formData })
        .json<ApiResponse<PrivateMessageAttachment>>()
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
      qc.invalidateQueries({ queryKey: queryKeys.privateMessages(agentId, sessionId) })
    },
  })
}

function appendPrivateMessages(
  existing: PrivateMessage[],
  incoming: PrivateMessage[],
): PrivateMessage[] {
  const byId = new Map(existing.map((message) => [message.id, message] as const))
  for (const message of incoming) {
    byId.set(message.id, message)
  }
  return Array.from(byId.values()).sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
  )
}
