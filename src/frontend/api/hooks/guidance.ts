import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isGuidanceBellEnabled, isGuidanceEnabled } from '@/features/guidance/feature-flags'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import type {
  ApiResponse,
  GuidanceBellData,
  GuidanceInboxData,
  GuidanceItemCard,
  GuidanceSummaryData,
} from '../types'

function buildDisabledGuidanceItemActionResponse(itemId: string): ApiResponse<GuidanceItemCard> {
  const now = new Date().toISOString()
  return {
    data: {
      id: itemId,
      module_type: 'CARD',
      reason_code: 'GUIDANCE_DISABLED',
      title: '',
      body: '',
      unread: false,
      status: 'DISMISSED',
      cta: null,
      payload: null,
      related_agent_id: null,
      related_session_id: null,
      created_at: now,
      updated_at: now,
    },
  }
}

export function useGuidanceSummary() {
  const enabled = isGuidanceEnabled()
  return useQuery({
    queryKey: queryKeys.guidanceSummary,
    enabled,
    queryFn: () => api.get('guidance/summary').json<ApiResponse<GuidanceSummaryData>>(),
  })
}

export function useGuidanceInbox() {
  const enabled = isGuidanceEnabled()
  return useQuery({
    queryKey: queryKeys.guidanceInbox,
    enabled,
    queryFn: () => api.get('guidance/inbox').json<ApiResponse<GuidanceInboxData>>(),
  })
}

export function useGuidanceBell() {
  const enabled = isGuidanceBellEnabled()
  return useQuery({
    queryKey: queryKeys.guidanceBell,
    enabled,
    queryFn: () => api.get('guidance/bell').json<ApiResponse<GuidanceBellData>>(),
    refetchInterval: 30_000,
  })
}

export function useGuidanceClientEvent() {
  const qc = useQueryClient()
  const enabled = isGuidanceEnabled()
  return useMutation({
    mutationFn: (input: {
      event_type: string
      payload?: Record<string, unknown>
      dedup_key?: string
    }) => enabled
      ? api.post('guidance/client-events', { json: input }).json<ApiResponse<{ accepted: boolean }>>()
      : Promise.resolve({ data: { accepted: true } }),
    onSuccess: (_data, variables) => {
      if (
        !enabled
        || variables.event_type === 'GUIDANCE_BELL_OPENED'
        || variables.event_type === 'GUIDANCE_TAKEOVER_SNOOZED'
      ) {
        return
      }
      qc.invalidateQueries({ queryKey: queryKeys.guidanceSummary })
      qc.invalidateQueries({ queryKey: queryKeys.guidanceInbox })
      qc.invalidateQueries({ queryKey: queryKeys.guidanceBell })
    },
  })
}

export function useGuidanceItemAction() {
  const qc = useQueryClient()
  const enabled = isGuidanceEnabled()
  return useMutation({
    mutationFn: (input: { item_id: string; action: 'open' | 'dismiss' | 'complete' }) =>
      enabled
        ? api
          .post(`guidance/items/${input.item_id}/action`, { json: { action: input.action } })
          .json<ApiResponse<GuidanceItemCard>>()
        : Promise.resolve(buildDisabledGuidanceItemActionResponse(input.item_id)),
    onSuccess: () => {
      if (!enabled) {
        return
      }
      qc.invalidateQueries({ queryKey: queryKeys.guidanceSummary })
      qc.invalidateQueries({ queryKey: queryKeys.guidanceInbox })
      qc.invalidateQueries({ queryKey: queryKeys.guidanceBell })
    },
  })
}
