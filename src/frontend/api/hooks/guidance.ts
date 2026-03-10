import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import type {
  ApiResponse,
  GuidanceInboxData,
  GuidanceItemCard,
  GuidanceSummaryData,
} from '../types'

export function useGuidanceSummary() {
  return useQuery({
    queryKey: queryKeys.guidanceSummary,
    queryFn: () => api.get('guidance/summary').json<ApiResponse<GuidanceSummaryData>>(),
  })
}

export function useGuidanceInbox() {
  return useQuery({
    queryKey: queryKeys.guidanceInbox,
    queryFn: () => api.get('guidance/inbox').json<ApiResponse<GuidanceInboxData>>(),
  })
}

export function useGuidanceClientEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      event_type: string
      payload?: Record<string, unknown>
      dedup_key?: string
    }) => api.post('guidance/client-events', { json: input }).json<ApiResponse<{ accepted: boolean }>>(),
    onSuccess: (_data, variables) => {
      if (variables.event_type === 'GUIDANCE_MODULE_VIEWED') {
        return
      }
      qc.invalidateQueries({ queryKey: queryKeys.guidanceSummary })
      qc.invalidateQueries({ queryKey: queryKeys.guidanceInbox })
    },
  })
}

export function useGuidanceItemAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { item_id: string; action: 'open' | 'dismiss' | 'complete' }) =>
      api
        .post(`guidance/items/${input.item_id}/action`, { json: { action: input.action } })
        .json<ApiResponse<GuidanceItemCard>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.guidanceSummary })
      qc.invalidateQueries({ queryKey: queryKeys.guidanceInbox })
    },
  })
}
