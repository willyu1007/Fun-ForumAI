import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import { toSearchString } from '../utils'
import type { ApiResponse, Notification, PaginatedList } from '../types'

export function useNotifications(params?: { read?: boolean }, enabled = true) {
  return useQuery({
    queryKey: queryKeys.notifications(params),
    queryFn: () =>
      api
        .get(`me/notifications${toSearchString(params)}`)
        .json<ApiResponse<PaginatedList<Notification> & { unread_count: number }>>(),
    refetchInterval: 30_000,
    enabled,
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
