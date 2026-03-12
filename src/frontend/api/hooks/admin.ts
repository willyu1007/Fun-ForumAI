import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import type {
  ApiResponse,
  GovernanceResult,
  GovernanceActionType,
  IdentityVerification,
  ReviewCase,
  ReviewCaseDetail,
  RuntimeFeaturesData,
} from '../types'

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
      target_type: 'post' | 'comment' | 'message' | 'agent' | 'private_session' | 'notification' | 'config_revision'
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

export function useModerationQueue(params?: { status?: string; case_type?: string; cursor?: string; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.adminModerationQueue(params),
    queryFn: () => api.get('admin/moderation/queue', { searchParams: params }).json<ApiResponse<ReviewCase[]>>(),
  })
}

export function useModerationCase(caseId: string | null) {
  return useQuery({
    queryKey: queryKeys.adminModerationCase(caseId ?? 'missing'),
    queryFn: () => api.get(`admin/moderation/cases/${caseId}`).json<ApiResponse<ReviewCaseDetail>>(),
    enabled: Boolean(caseId),
  })
}

export function useAssignModerationCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { case_id: string; assignee_user_id?: string | null }) =>
      api.post(`admin/moderation/cases/${body.case_id}/assign`, {
        json: { assignee_user_id: body.assignee_user_id ?? null },
      }).json<ApiResponse<ReviewCase>>(),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.adminModerationQueue() })
      qc.invalidateQueries({ queryKey: queryKeys.adminModerationCase(variables.case_id) })
    },
  })
}

export function useResolveModerationCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { case_id: string; resolution_action: string }) =>
      api.post(`admin/moderation/cases/${body.case_id}/resolve`, {
        json: { resolution_action: body.resolution_action },
      }).json<ApiResponse<ReviewCase>>(),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.adminModerationQueue() })
      qc.invalidateQueries({ queryKey: queryKeys.adminModerationCase(variables.case_id) })
    },
  })
}

export function useReopenModerationCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { case_id: string; opened_reason?: string }) =>
      api.post(`admin/moderation/cases/${body.case_id}/reopen`, {
        json: { opened_reason: body.opened_reason ?? 'manual_reopen' },
      }).json<ApiResponse<ReviewCase>>(),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.adminModerationQueue() })
      qc.invalidateQueries({ queryKey: queryKeys.adminModerationCase(variables.case_id) })
    },
  })
}

export function useIdentityReviews(params?: { status?: string; cursor?: string; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.adminIdentityReviews(params),
    queryFn: () => api.get('admin/identity-reviews', { searchParams: params }).json<ApiResponse<IdentityVerification[]>>(),
  })
}

export function useResolveIdentityReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      user_id: string
      status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED'
      reason?: string
    }) =>
      api.post(`admin/identity-reviews/${body.user_id}`, {
        json: { status: body.status, reason: body.reason },
      }).json<ApiResponse<IdentityVerification>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminIdentityReviews() })
    },
  })
}
