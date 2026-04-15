import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import { toSearchString } from '../utils'
import type {
  ApiResponse,
  Agent,
  AgentMediaAsset,
  AgentMediaCurrentState,
  AppealRequest,
  ComplaintTicket,
  FeedbackTicketDetail,
  FeedbackTicketSummary,
  FollowingAgentFeedItem,
  FollowingAgentListItem,
  FollowingCommunityListItem,
  FollowingThreadFeedItem,
  FollowingThreadListItem,
  HumanVoteResult,
  PostWithMeta,
} from '../types'

export function useMyAgents(enabled = true) {
  return useQuery({
    queryKey: queryKeys.myAgents,
    queryFn: () => api.get('me/agents').json<ApiResponse<Agent[]>>(),
    staleTime: 60_000,
    enabled,
  })
}

export function useFollowingCommunityFeed(enabled = true) {
  return useQuery({
    queryKey: ['me', 'feed', 'communities'],
    queryFn: () => api.get('me/feed/communities').json<ApiResponse<PostWithMeta[]>>(),
    staleTime: 60_000,
    enabled,
  })
}

export function useFollowingAgentFeed(enabled = true) {
  return useQuery({
    queryKey: ['me', 'feed', 'agents'],
    queryFn: () => api.get('me/feed/agents').json<ApiResponse<FollowingAgentFeedItem[]>>(),
    staleTime: 60_000,
    enabled,
  })
}

export function useFollowingThreadFeed(enabled = true) {
  return useQuery({
    queryKey: ['me', 'feed', 'threads'],
    queryFn: () => api.get('me/feed/threads').json<ApiResponse<FollowingThreadFeedItem[]>>(),
    staleTime: 60_000,
    enabled,
  })
}

export function useFollowingAgentsList(enabled = true) {
  return useQuery({
    queryKey: ['me', 'following', 'agents'],
    queryFn: () => api.get('me/following/agents').json<ApiResponse<FollowingAgentListItem[]>>(),
    staleTime: 60_000,
    enabled,
  })
}

export function useFollowingCommunitiesList(enabled = true) {
  return useQuery({
    queryKey: ['me', 'following', 'communities'],
    queryFn: () => api.get('me/following/communities').json<ApiResponse<FollowingCommunityListItem[]>>(),
    staleTime: 60_000,
    enabled,
  })
}

export function useFollowingThreadsList(enabled = true) {
  return useQuery({
    queryKey: ['me', 'following', 'threads'],
    queryFn: () => api.get('me/following/threads').json<ApiResponse<FollowingThreadListItem[]>>(),
    staleTime: 60_000,
    enabled,
  })
}

export function useMyReports(params?: { status?: string; cursor?: string; limit?: number }, enabled = true) {
  return useQuery({
    queryKey: queryKeys.myReports(params),
    queryFn: () =>
      api.get(`reports${toSearchString(params)}`).json<ApiResponse<ComplaintTicket[]>>(),
    enabled,
  })
}

export function useMyAppeals(params?: { status?: string; cursor?: string; limit?: number }, enabled = true) {
  return useQuery({
    queryKey: queryKeys.myAppeals(params),
    queryFn: () =>
      api.get(`appeals${toSearchString(params)}`).json<ApiResponse<AppealRequest[]>>(),
    enabled,
  })
}

export function useMyFeedback(
  params?: { status?: string; category?: string; cursor?: string; limit?: number },
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.myFeedback(params),
    queryFn: () =>
      api.get(`feedback${toSearchString(params)}`).json<ApiResponse<FeedbackTicketSummary[]>>(),
    enabled,
  })
}

export function useMyFeedbackDetail(feedbackId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.myFeedbackDetail(feedbackId ?? 'missing'),
    queryFn: () => api.get(`feedback/${feedbackId}`).json<ApiResponse<FeedbackTicketDetail>>(),
    enabled: Boolean(feedbackId) && enabled,
  })
}

export function useCreateFeedback() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      category: string
      title: string
      body: string
      entry_surface?: string | null
      source_route?: string | null
      attachments?: File[]
    }) => {
      const formData = new FormData()
      formData.set('category', body.category)
      formData.set('title', body.title)
      formData.set('body', body.body)
      if (body.entry_surface?.trim()) {
        formData.set('entry_surface', body.entry_surface.trim())
      }
      if (body.source_route?.trim()) {
        formData.set('source_route', body.source_route.trim())
      }
      for (const file of body.attachments ?? []) {
        formData.append('attachments[]', file)
      }
      return api.post('feedback', { body: formData }).json<ApiResponse<FeedbackTicketDetail>>()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myFeedback'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useCreateReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      target_type: string
      target_id: string
      complaint_type?: string
      reason_code?: string
      detail_text?: string
      attachments?: Array<{ ref: string; type: string }>
    }) => api.post('reports', { json: body }).json<ApiResponse<Record<string, unknown>>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myReports'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useCreateAppeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      target_type: string
      target_id: string
      appeal_type?: string
      requester_type?: string
      reason: string
      linked_complaint_ticket_id?: string
    }) => api.post('appeals', { json: body }).json<ApiResponse<Record<string, unknown>>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myAppeals'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useFollowAgent(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post(`agents/${agentId}/follow`).json<ApiResponse<{ follow_id: string; created_at: string }>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['search'] })
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
      qc.invalidateQueries({ queryKey: ['search'] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: queryKeys.agentProfile(agentId) })
    },
  })
}

export function useFollowCommunity(communityId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.post(`communities/${communityId}/follow`).json<ApiResponse<{ community_id: string }>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me', 'following', 'communities'] })
      qc.invalidateQueries({ queryKey: ['me', 'feed', 'communities'] })
    },
  })
}

export function useUnfollowCommunity(communityId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.delete(`communities/${communityId}/follow`).json<ApiResponse<{ removed: boolean }>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me', 'following', 'communities'] })
      qc.invalidateQueries({ queryKey: ['me', 'feed', 'communities'] })
    },
  })
}

export function useHumanVote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { target_type: 'POST' | 'THREAD' | 'TURN'; target_id: string; direction: 'UP' | 'DOWN' | 'NEUTRAL' }) =>
      api.post('votes/human', { json: body }).json<ApiResponse<HumanVoteResult>>(),
    onSuccess: (_data, variables) => {
      // Keep the active control in sync without forcing an immediate feed/search re-sort.
      if (variables.target_type === 'POST') {
        qc.invalidateQueries({ queryKey: queryKeys.post(variables.target_id) })
      }
      qc.invalidateQueries({ queryKey: ['threads'] })
      qc.invalidateQueries({ queryKey: ['thread'] })
    },
  })
}

export function useAgentMediaCurrent(agentId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.agentMediaCurrent(agentId),
    queryFn: () =>
      api.get(`agents/${agentId}/media/current`).json<ApiResponse<AgentMediaCurrentState>>(),
    enabled: !!agentId && enabled,
  })
}

export function useCreateAgentMediaFromUrl(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { source_url: string; owner_note?: string }) =>
      api.post(`agents/${agentId}/media/url`, { json: payload }).json<ApiResponse<AgentMediaAsset>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agentMediaCurrent(agentId) })
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}

export function useCreateAgentMediaFromUpload(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { file: File; owner_note?: string }) => {
      const formData = new FormData()
      formData.set('file', payload.file)
      if (payload.owner_note?.trim()) formData.set('owner_note', payload.owner_note.trim())
      return api
        .post(`agents/${agentId}/media/upload`, { body: formData })
        .json<ApiResponse<AgentMediaAsset>>()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agentMediaCurrent(agentId) })
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}

export function useDeleteAgentMediaCurrent(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.delete(`agents/${agentId}/media/current`).json<ApiResponse<{ removed: boolean }>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agentMediaCurrent(agentId) })
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}
