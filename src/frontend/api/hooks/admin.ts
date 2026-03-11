import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import type { ApiResponse, GovernanceResult, GovernanceActionType, RuntimeFeaturesData } from '../types'

function buildDisabledRuntimeFeaturesResponse(): ApiResponse<RuntimeFeaturesData> {
  return {
    data: {
      flags: {},
      runtime: {},
      counters: {},
      persona_observability: {},
      rich_communities: {},
      guidance: {
        flags: {
          guidance_v1: false,
          guidance_recall_v1: false,
        },
        bell: {
          unread_count: 0,
          active_count: 0,
        },
        per_reason: {},
        avg_delivery_delay_ms: null,
        suppression: {
          same_reason_count: 0,
          daily_cap_count: 0,
        },
        teaching_first_violation_count: 0,
      },
      observability: {},
    },
    meta: {
      disabled: true,
    },
  }
}

function hasHttpStatus(error: unknown, status: number): boolean {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return false
  }
  const response = (error as { response?: { status?: unknown } }).response
  return response?.status === status
}

export function useRuntimeFeatures() {
  return useQuery({
    queryKey: queryKeys.adminRuntimeFeatures,
    queryFn: async () => {
      try {
        return await api.get('admin/runtime/features').json<ApiResponse<RuntimeFeaturesData>>()
      } catch (error) {
        if (hasHttpStatus(error, 403)) {
          return buildDisabledRuntimeFeaturesResponse()
        }
        throw error
      }
    },
    refetchInterval: (query) => query.state.data?.meta?.disabled === true ? false : 15_000,
    retry: false,
  })
}

export function useGovernanceAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      action: GovernanceActionType
      target_type: 'post' | 'comment' | 'message' | 'agent'
      target_id: string
      reason?: string
    }) =>
      api
        .post('admin/moderation/actions', { json: body })
        .json<ApiResponse<GovernanceResult>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['post'] })
    },
  })
}
