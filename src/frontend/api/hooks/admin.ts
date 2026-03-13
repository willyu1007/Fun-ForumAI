import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import type {
  ApiResponse,
  AgentRiskProfile,
  ClaimedReviewTask,
  CommunityConfigApplyResult,
  CommunityConfigPatch,
  CommunityConfigValidationResult,
  DisclosureCapOverride,
  DisclosureCapQueryResult,
  GovernanceResult,
  GovernanceActionType,
  HotTopicAlert,
  HotTopicDashboardItem,
  IdentityVerification,
  ReleasedReviewCase,
  ReviewCase,
  ReviewCaseDetail,
  ReviewEvidenceExport,
  RuntimeFeaturesData,
  TransferredReviewCase,
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

export function useApplyCommunityHotTopicPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      communityId: string
      mode: 'NORMAL' | 'MANUAL_REVIEW_ONLY' | 'DISABLED'
      allowedDomains: string[]
      sceneModes?: Record<string, 'NORMAL' | 'MANUAL_REVIEW_ONLY' | 'DISABLED'>
      userCopy?: Record<string, string>
      summary?: string
      reason?: string
    }) => {
      const proposal = await api.post(`communities/${input.communityId}/config/proposals`, {
        json: {
          patch: {
            hot_topic_policy_v1: {
              mode: input.mode,
              allowed_domains: input.allowedDomains,
              scene_modes: input.sceneModes ?? {},
              user_copy: input.userCopy ?? {},
            },
          },
          summary: input.summary ?? 'Update hot topic policy',
          reason: input.reason ?? 'Admin updated hot topic policy',
          risk_level: 'HIGH',
        },
      }).json<ApiResponse<CommunityConfigPatch>>()

      await api.post(`communities/${input.communityId}/config/proposals/${proposal.data.id}/validate`, {
        json: {},
      }).json<ApiResponse<CommunityConfigValidationResult>>()

      await api.post(`communities/${input.communityId}/config/proposals/${proposal.data.id}/approve`, {
        json: {
          reason: input.reason ?? 'Approve hot topic policy change',
        },
      }).json<ApiResponse<CommunityConfigPatch>>()

      return api.post(`communities/${input.communityId}/config/apply`, {
        json: {
          proposal_id: proposal.data.id,
        },
      }).json<ApiResponse<CommunityConfigApplyResult>>()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communities'] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['room'] })
      qc.invalidateQueries({ queryKey: ['roomProgram'] })
    },
  })
}

export function useAdminHotTopicDashboard() {
  return useQuery({
    queryKey: queryKeys.adminHotTopicDashboard,
    queryFn: () => api.get('admin/hot-topic/dashboard').json<ApiResponse<HotTopicDashboardItem[]>>(),
    refetchInterval: 15_000,
  })
}

export function useAdminHotTopicAlerts() {
  return useQuery({
    queryKey: queryKeys.adminHotTopicAlerts,
    queryFn: () => api.get('admin/hot-topic/alerts').json<ApiResponse<HotTopicAlert[]>>(),
    refetchInterval: 15_000,
  })
}

export function useAdminHotTopicPostDistribution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      postId: string
      distribution_state: 'NORMAL' | 'NO_RECOMMEND'
      reason?: string | null
    }) =>
      api.post(`admin/hot-topic/posts/${input.postId}/distribution`, {
        json: {
          distribution_state: input.distribution_state,
          reason: input.reason ?? null,
        },
      }).json<ApiResponse<HotTopicDashboardItem>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminHotTopicDashboard })
      qc.invalidateQueries({ queryKey: queryKeys.adminHotTopicAlerts })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['post'] })
    },
  })
}

export function useAdminHotTopicRoomControl() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      roomId: string
      hot_topic_mode?: 'NORMAL' | 'MANUAL_REVIEW_ONLY' | 'DISABLED'
      distribution_state?: 'NORMAL' | 'NO_RECOMMEND' | 'BLOCKED'
      reason?: string | null
    }) =>
      api.post(`admin/hot-topic/rooms/${input.roomId}/control`, {
        json: {
          hot_topic_mode: input.hot_topic_mode,
          distribution_state: input.distribution_state,
          reason: input.reason ?? null,
        },
      }).json<ApiResponse<HotTopicDashboardItem>>(),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.adminHotTopicDashboard })
      qc.invalidateQueries({ queryKey: queryKeys.adminHotTopicAlerts })
      qc.invalidateQueries({ queryKey: queryKeys.room(variables.roomId) })
      qc.invalidateQueries({ queryKey: queryKeys.roomProgram(variables.roomId) })
      qc.invalidateQueries({ queryKey: queryKeys.roomControlState(variables.roomId) })
    },
  })
}

export function useModerationQueue(params?: { status?: string; case_type?: string; queue?: string; cursor?: string; limit?: number }) {
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

export function useModerationEvidenceExport(caseId: string | null, redaction: 'operator' | 'share' = 'operator') {
  return useQuery({
    queryKey: queryKeys.adminModerationEvidenceExport(caseId ?? 'missing', redaction),
    queryFn: () =>
      api.get(`admin/moderation/cases/${caseId}/evidence-export`, {
        searchParams: { redaction },
      }).json<ApiResponse<ReviewEvidenceExport>>(),
    enabled: Boolean(caseId),
  })
}

function invalidateModerationCaseQueries(qc: ReturnType<typeof useQueryClient>, caseId: string) {
  qc.invalidateQueries({ queryKey: queryKeys.adminModerationQueue() })
  qc.invalidateQueries({ queryKey: queryKeys.adminModerationCase(caseId) })
  qc.invalidateQueries({ queryKey: ['admin', 'moderation-evidence-export', caseId] })
}

export function useAssignModerationCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { case_id: string; assignee_user_id?: string | null }) =>
      api.post(`admin/moderation/cases/${body.case_id}/assign`, {
        json: { assignee_user_id: body.assignee_user_id ?? null },
      }).json<ApiResponse<ReviewCase>>(),
    onSuccess: (_, variables) => {
      invalidateModerationCaseQueries(qc, variables.case_id)
    },
  })
}

export function useTransferModerationCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { case_id: string; assignee_user_id: string; assigned_role?: string | null; operator_note?: string | null }) =>
      api.post(`admin/moderation/cases/${body.case_id}/transfer`, {
        json: {
          assignee_user_id: body.assignee_user_id,
          assigned_role: body.assigned_role ?? null,
          operator_note: body.operator_note ?? null,
        },
      }).json<ApiResponse<TransferredReviewCase>>(),
    onSuccess: (_, variables) => {
      invalidateModerationCaseQueries(qc, variables.case_id)
    },
  })
}

export function useReleaseModerationCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { case_id: string; operator_note?: string | null }) =>
      api.post(`admin/moderation/cases/${body.case_id}/release`, {
        json: {
          operator_note: body.operator_note ?? null,
        },
      }).json<ApiResponse<ReleasedReviewCase>>(),
    onSuccess: (_, variables) => {
      invalidateModerationCaseQueries(qc, variables.case_id)
    },
  })
}

export function useResolveModerationCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { case_id: string; resolution_action: string; resolution_note?: string | null }) =>
      api.post(`admin/moderation/cases/${body.case_id}/resolve`, {
        json: {
          resolution_action: body.resolution_action,
          resolution_note: body.resolution_note ?? null,
        },
      }).json<ApiResponse<ReviewCase>>(),
    onSuccess: (_, variables) => {
      invalidateModerationCaseQueries(qc, variables.case_id)
    },
  })
}

export function useClaimModerationTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { task_id: string; case_id: string; assigned_role?: string | null; operator_note?: string | null }) =>
      api.post(`admin/moderation/tasks/${body.task_id}/claim`, {
        json: {
          assigned_role: body.assigned_role ?? null,
          operator_note: body.operator_note ?? null,
        },
      }).json<ApiResponse<ClaimedReviewTask>>(),
    onSuccess: (_, variables) => {
      invalidateModerationCaseQueries(qc, variables.case_id)
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
      invalidateModerationCaseQueries(qc, variables.case_id)
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

export function useAdminAgentRiskProfile(agentId: string | null) {
  return useQuery({
    queryKey: queryKeys.adminAgentRiskProfile(agentId ?? 'missing'),
    queryFn: () => api.get(`admin/agents/${agentId}/risk-profile`).json<ApiResponse<AgentRiskProfile>>(),
    enabled: Boolean(agentId),
  })
}

export function useDisclosureCaps(scopeType: 'agent' | 'community', scopeId: string | null) {
  return useQuery({
    queryKey: queryKeys.adminDisclosureCaps(scopeType, scopeId ?? 'missing'),
    queryFn: () =>
      api.get('admin/disclosure-caps', {
        searchParams: { scope_type: scopeType, scope_id: scopeId ?? '' },
      }).json<ApiResponse<DisclosureCapQueryResult>>(),
    enabled: Boolean(scopeId),
  })
}

export function useCreateDisclosureCapOverride() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      scope_type: 'agent' | 'community'
      scope_id: string
      cap_level: number
      reason?: string | null
      linked_case_id?: string | null
      linked_risk_event_id?: string | null
    }) =>
      api.post('admin/disclosure-caps', {
        json: {
          scope_type: body.scope_type,
          scope_id: body.scope_id,
          cap_level: body.cap_level,
          reason: body.reason ?? null,
          linked_case_id: body.linked_case_id ?? null,
          linked_risk_event_id: body.linked_risk_event_id ?? null,
        },
      }).json<ApiResponse<DisclosureCapOverride>>(),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.adminDisclosureCaps(variables.scope_type, variables.scope_id) })
      if (variables.scope_type === 'agent') {
        qc.invalidateQueries({ queryKey: queryKeys.adminAgentRiskProfile(variables.scope_id) })
      }
    },
  })
}

export function useReleaseDisclosureCapOverride() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      override_id: string
      scope_type: 'agent' | 'community'
      scope_id: string
      reason?: string | null
    }) =>
      api.post(`admin/disclosure-caps/${body.override_id}/release`, {
        json: { reason: body.reason ?? null },
      }).json<ApiResponse<DisclosureCapOverride>>(),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.adminDisclosureCaps(variables.scope_type, variables.scope_id) })
      if (variables.scope_type === 'agent') {
        qc.invalidateQueries({ queryKey: queryKeys.adminAgentRiskProfile(variables.scope_id) })
      }
    },
  })
}
