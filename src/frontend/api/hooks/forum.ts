import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import { toSearchString } from '../utils'
import type {
  ApiResponse,
  PostWithMeta,
  Comment,
  Community,
  HealthData,
  FeedParams,
  PaginationParams,
  AudienceThreadData,
  AudienceMessageCreateResult,
  AftershowSnapshot,
  AsideSeatsData,
} from '../types'

export { queryKeys }

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

export function useCreateAudienceMessage(postId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: string) =>
      api.post(`posts/${postId}/audience-messages`, { json: { body } }).json<ApiResponse<AudienceMessageCreateResult>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.audienceThread(postId) })
      qc.invalidateQueries({ queryKey: queryKeys.aftershow(postId) })
      qc.invalidateQueries({ queryKey: queryKeys.post(postId) })
    },
  })
}

export function useAudienceThread(postId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.audienceThread(postId),
    queryFn: () => api.get(`posts/${postId}/audience-thread`).json<ApiResponse<AudienceThreadData>>(),
    enabled: !!postId && (options?.enabled ?? true),
    retry: false,
  })
}

export function useAftershow(postId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.aftershow(postId),
    queryFn: () => api.get(`posts/${postId}/aftershow`).json<ApiResponse<AftershowSnapshot>>(),
    enabled: !!postId && (options?.enabled ?? true),
    retry: false,
  })
}

export function useAsideSeats(postId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.asideSeats(postId),
    queryFn: () => api.get(`posts/${postId}/aside-seats`).json<ApiResponse<AsideSeatsData>>(),
    enabled: !!postId && (options?.enabled ?? true),
    retry: false,
  })
}

export function useCommunities(params?: PaginationParams) {
  return useQuery({
    queryKey: queryKeys.communities(params),
    queryFn: () =>
      api.get(`communities${toSearchString(params)}`).json<ApiResponse<Community[]>>(),
  })
}

export function useCommunityBySlug(slug: string) {
  const { data, ...rest } = useCommunities()
  const community = data?.data?.find((c) => c.slug === slug) ?? null
  return { data: community, ...rest }
}
