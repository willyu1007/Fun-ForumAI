import { useQuery } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import { toSearchString } from '../utils'
import type { ApiResponse, PostWithMeta, Comment, Community, HealthData, FeedParams, PaginationParams } from '../types'

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
