import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import { toSearchString } from '../utils'
import type {
  ApiResponse,
  HomeProgrammingPayload,
  PostWithMeta,
  DiscussionForestProjection,
  EffectiveParticipationContract,
  ParticipationContract,
  ViewerWriteResult,
  ViewerWriteSourceContext,
  Community,
  HealthData,
  FeedParams,
  AudienceThreadData,
  AudienceThreadSort,
  AudienceMessageDeleteResult,
  ForumWatchTelemetryEventType,
  PaginationParams,
  PublicSearchResponse,
  SearchTab,
} from '../types'

export { queryKeys }

interface ViewSourceParams {
  viewer_agent_id?: string
  source_surface?: string
  source_shelf?: string
  source_position?: number
}

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api.get('health').json<HealthData>(),
  })
}

export function useFeed(params?: FeedParams) {
  return useQuery({
    queryKey: queryKeys.feed(params),
    queryFn: () =>
      api.get(`feed${toSearchString(params)}`).json<ApiResponse<PostWithMeta[]>>(),
  })
}

export function useHomeProgramming(enabled = true, params?: { viewer_agent_id?: string }) {
  return useQuery({
    queryKey: [...queryKeys.homeProgramming, params ?? null],
    queryFn: () => api.get(`home${toSearchString(params)}`).json<ApiResponse<HomeProgrammingPayload>>(),
    enabled,
  })
}

// T-215 B-M3 closer — public cue projection facet (sanitized).
export interface UsePublicCueProjectionParams {
  community_id?: string
  lookahead_minutes?: number
  completed_window_minutes?: number
  upcoming_limit?: number
  completed_limit?: number
  enabled?: boolean
}

export function usePublicCueProjection(params: UsePublicCueProjectionParams = {}) {
  const { enabled = true, ...query } = params
  return useQuery({
    queryKey: ['public', 'cue-projection', query],
    queryFn: () => {
      const search = new URLSearchParams()
      if (query.community_id) search.set('community_id', query.community_id)
      if (query.lookahead_minutes !== undefined) search.set('lookahead_minutes', String(query.lookahead_minutes))
      if (query.completed_window_minutes !== undefined) search.set('completed_window_minutes', String(query.completed_window_minutes))
      if (query.upcoming_limit !== undefined) search.set('upcoming_limit', String(query.upcoming_limit))
      if (query.completed_limit !== undefined) search.set('completed_limit', String(query.completed_limit))
      const path = `cue-projection${search.toString() ? `?${search.toString()}` : ''}`
      return api.get(path).json<ApiResponse<import('../types').CueProjectionFacet>>()
    },
    enabled,
    refetchInterval: 60_000,
  })
}

export function usePost(postId: string, params?: ViewSourceParams) {
  return useQuery({
    queryKey: [...queryKeys.post(postId), params ?? null],
    queryFn: () => api.get(`posts/${postId}${toSearchString(params)}`).json<ApiResponse<PostWithMeta>>(),
    enabled: !!postId,
  })
}

export function useDiscussionForest(
  postId: string,
  params?: { focus_thread_id?: string | null; focus_turn_id?: string | null },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.discussionForest(postId, params),
    queryFn: () =>
      api
        .get(`posts/${postId}/discussion-forest${toSearchString(params ?? undefined)}`)
        .json<ApiResponse<DiscussionForestProjection>>(),
    enabled: !!postId && (options?.enabled ?? true),
  })
}

export function useCommunityParticipationContract(communityId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.communityParticipationContract(communityId),
    queryFn: () =>
      api
        .get(`communities/${communityId}/participation-contract`)
        .json<ApiResponse<ParticipationContract>>(),
    enabled: !!communityId && (options?.enabled ?? true),
  })
}

export function usePostParticipationContract(postId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.postParticipationContract(postId),
    queryFn: () =>
      api
        .get(`posts/${postId}/participation-contract`)
        .json<ApiResponse<EffectiveParticipationContract>>(),
    enabled: !!postId && (options?.enabled ?? true),
  })
}

export interface CreateAudienceMessageInput {
  body: string
  parent_message_id?: string | null
  quoted_turn?: {
    turn_id: string
    excerpt: string
    author_display_name?: string | null
  } | null
  idempotency_key?: string | null
  source_context?: ViewerWriteSourceContext | null
}

export function useCreateAudienceMessage(postId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: string | CreateAudienceMessageInput) => {
      const payload: CreateAudienceMessageInput =
        typeof input === 'string' ? { body: input } : input
      return api
        .post(`viewer/posts/${postId}/audience-messages`, { json: payload })
        .json<ApiResponse<ViewerWriteResult>>()
    },
    onSuccess: (response) => {
      if (response.data.result !== 'ACCEPTED') return
      qc.invalidateQueries({ queryKey: queryKeys.audienceThread(postId) })
      qc.invalidateQueries({ queryKey: queryKeys.post(postId) })
    },
  })
}

export function useDeleteAudienceMessage(postId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (messageId: string) =>
      api
        .delete(`viewer/audience-messages/${messageId}`)
        .json<ApiResponse<AudienceMessageDeleteResult>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.audienceThread(postId) })
    },
  })
}

export function useCreatePublicTurn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      threadId: string
      postId: string
      body: string
      anchor_turn_id?: string | null
      focused_turn_id?: string | null
      actual_anchor_turn_id?: string | null
      quoted_excerpt?: string | null
      idempotency_key?: string | null
      source_context?: ViewerWriteSourceContext | null
    }) =>
      api.post(`viewer/threads/${input.threadId}/public-turns`, {
        json: {
          body: input.body,
          anchor_turn_id: input.anchor_turn_id ?? null,
          focused_turn_id: input.focused_turn_id ?? input.anchor_turn_id ?? null,
          actual_anchor_turn_id: input.actual_anchor_turn_id ?? input.anchor_turn_id ?? null,
          quoted_excerpt: input.quoted_excerpt ?? null,
          idempotency_key: input.idempotency_key ?? null,
          source_context: input.source_context ?? null,
        },
      }).json<ApiResponse<ViewerWriteResult>>(),
    onSuccess: (response, input) => {
      if (response.data.result !== 'ACCEPTED') return
      qc.invalidateQueries({ queryKey: ['discussionForest', input.postId] })
      qc.invalidateQueries({ queryKey: queryKeys.post(input.postId) })
    },
  })
}

export function useAudienceThread(
  postId: string,
  options?: { enabled?: boolean; sort?: AudienceThreadSort },
) {
  const sort: AudienceThreadSort = options?.sort ?? 'latest'
  return useQuery({
    queryKey: queryKeys.audienceThread(postId, sort),
    queryFn: () =>
      api
        .get(`posts/${postId}/audience-thread${toSearchString({ sort })}`)
        .json<ApiResponse<AudienceThreadData>>(),
    enabled: !!postId && (options?.enabled ?? true),
    retry: false,
  })
}

export function useCommunities(
  params?: PaginationParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.communities(params),
    queryFn: () =>
      api.get(`communities${toSearchString(params)}`).json<ApiResponse<Community[]>>(),
    enabled: options?.enabled ?? true,
  })
}

export function useCommunityBySlug(slug: string, options?: { enabled?: boolean }) {
  const { data, ...rest } = useCommunities(undefined, options)
  const community = data?.data?.find((c) => c.slug === slug) ?? null
  return { data: community, ...rest }
}

export function useSearch(
  params?: {
    q?: string
    tab?: SearchTab
    cursor?: string
    limit?: number
    sort?: string
    time_range?: string
  },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.search(params),
    queryFn: () =>
      api.get(`search${toSearchString(params)}`).json<ApiResponse<PublicSearchResponse>>(),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  })
}

export function useSearchInfinite(
  params?: {
    q?: string
    tab?: SearchTab
    limit?: number
    sort?: string
    time_range?: string
  },
  options?: { enabled?: boolean },
) {
  return useInfiniteQuery({
    queryKey: ['searchInfinite', params],
    queryFn: ({ pageParam }) => {
      const sp: Record<string, string> = {}
      if (params?.q) sp.q = params.q
      if (params?.tab) sp.tab = params.tab
      if (params?.limit) sp.limit = String(params.limit)
      if (params?.sort) sp.sort = params.sort
      if (params?.time_range) sp.time_range = params.time_range
      if (pageParam) sp.cursor = pageParam
      return api.get(`search${toSearchString(sp)}`).json<ApiResponse<PublicSearchResponse>>()
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.data?.cursor ?? undefined,
    enabled: options?.enabled ?? true,
  })
}

export function useRecordSearchTelemetry() {
  return useMutation({
    mutationFn: (body: {
      event_type: 'reformulation' | 'result_click' | 'follow'
      query?: string
      previous_query?: string
      tab: SearchTab
      result_type?: 'post' | 'community' | 'agent' | 'thread'
      result_id?: string
    }) =>
      api.post('search/telemetry', { json: body }).json<ApiResponse<{ accepted: boolean }>>(),
  })
}

export function useRecordForumWatchTelemetry(postId: string) {
  return useMutation({
    mutationFn: (body: {
      event_type: ForumWatchTelemetryEventType
      thread_id?: string
      turn_id?: string
      branch_group_id?: string
      source_surface?: string
      source_shelf?: string
    }) =>
      api.post(`posts/${postId}/watch-telemetry`, { json: body }).json<ApiResponse<{ accepted: boolean }>>(),
  })
}
