import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import type {
  ApiResponse,
  AdminMediaObservabilityData,
  AdminMediaRolloutControllerData,
  AdminFeedbackTicketDetail,
  AdminFeedbackTicketSummary,
  AdminInviteCodeSummary,
  AdminUserSummary,
  AgentRiskProfile,
  LaunchProgrammingOpsPayload,
  ClaimedReviewTask,
  CommunityIncubationVisibilityMode,
  CommunityProposalAction,
  CommunityProposalActionResult,
  CommunityProposalListItem,
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
  KickoffBaselineDetail,
  ReleasedReviewCase,
  ReviewCase,
  ReviewCaseDetail,
  ReviewEvidenceExport,
  RuntimeFeaturesData,
  MediaLifecycleRunResult,
  MediaScenePack,
  MediaScenePackCompilePreviewResult,
  MediaScenePackDraftPayload,
  MediaScenePackRoutePreviewResult,
  MediaScenePackVersion,
  MediaVisualBrief,
  TransferredReviewCase,
  WarmupVerifierRunDetail,
  WarmupRunDetail,
  WarmupRunListItem,
} from '../types'
import type { CommunityFamily, CommunityInteractionContract } from '../../../shared/semantic-taxonomy'

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

function buildDisabledLaunchProgrammingOpsResponse(): ApiResponse<LaunchProgrammingOpsPayload> {
  return {
    data: {
      enabled: false,
      timezone: 'Asia/Shanghai',
      active_daypart_id: null,
      dayparts: [],
      slots: [],
      health: {
        required_daily_outcomes: {},
        observed_daily_outcomes: {},
        daypart_readiness: [],
        community_supply_floor: [],
        visual_ratio_ok: true,
        aftershow_pipeline_ok: true,
        warning_count: 0,
        warnings: [],
      },
      observations: {
        visual_ratio: {
          root_cover_ratio: null,
          note_cover_ratio: null,
          highlight_visual_ratio: null,
          reject_reason_counts: {},
          budget_remaining_cny: null,
          cost_gate_active: false,
        },
        highlight_candidates: [],
        aftershow: [],
      },
      governance_references: {
        communities: [],
        incubation: [],
      },
      rollback_order: [],
      drill_checklist: [],
      meta: {
        generated_at: new Date(0).toISOString(),
        source: 'launch-programming-ops-v1',
      },
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
    refetchInterval: (query) => (query.state.data?.meta?.disabled === true ? false : 15_000),
    retry: false,
  })
}

export function useAdminMediaObservability() {
  return useQuery({
    queryKey: queryKeys.adminMediaObservability,
    queryFn: () =>
      api.get('admin/media/observability').json<ApiResponse<AdminMediaObservabilityData>>(),
    refetchInterval: 15_000,
  })
}

export function useAdminMediaRolloutController() {
  return useQuery({
    queryKey: queryKeys.adminMediaRolloutController,
    queryFn: () =>
      api
        .get('admin/media/rollout-controller')
        .json<ApiResponse<AdminMediaRolloutControllerData>>(),
    refetchInterval: 15_000,
  })
}

export function useAdminMediaScenePacks() {
  return useQuery({
    queryKey: queryKeys.adminMediaScenePacks,
    queryFn: () => api.get('admin/media/scene-packs').json<ApiResponse<MediaScenePack[]>>(),
  })
}

export function useAdminMediaScenePack(sceneId: string | null) {
  return useQuery({
    queryKey: sceneId
      ? queryKeys.adminMediaScenePack(sceneId)
      : ['admin', 'media-scene-pack', 'idle'],
    queryFn: () => api.get(`admin/media/scene-packs/${sceneId}`).json<ApiResponse<MediaScenePack>>(),
    enabled: Boolean(sceneId),
  })
}

export function useCreateAdminMediaScenePackDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { scene_id: string; patch: MediaScenePackDraftPayload }) =>
      api
        .post(`admin/media/scene-packs/${body.scene_id}/versions`, { json: body.patch })
        .json<ApiResponse<MediaScenePackVersion>>(),
    onSuccess: (_response, body) => {
      qc.invalidateQueries({ queryKey: queryKeys.adminMediaScenePacks })
      qc.invalidateQueries({ queryKey: queryKeys.adminMediaScenePack(body.scene_id) })
    },
  })
}

export function useUpdateAdminMediaScenePackVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { scene_id: string; version: number; patch: MediaScenePackDraftPayload }) =>
      api
        .patch(`admin/media/scene-packs/${body.scene_id}/versions/${body.version}`, {
          json: body.patch,
        })
        .json<ApiResponse<MediaScenePackVersion>>(),
    onSuccess: (_response, body) => {
      qc.invalidateQueries({ queryKey: queryKeys.adminMediaScenePacks })
      qc.invalidateQueries({ queryKey: queryKeys.adminMediaScenePack(body.scene_id) })
    },
  })
}

export function useActivateAdminMediaScenePackVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { scene_id: string; version: number }) =>
      api
        .post(`admin/media/scene-packs/${body.scene_id}/versions/${body.version}/activate`, {
          json: {},
        })
        .json<ApiResponse<MediaScenePack>>(),
    onSuccess: (_response, body) => {
      qc.invalidateQueries({ queryKey: queryKeys.adminMediaScenePacks })
      qc.invalidateQueries({ queryKey: queryKeys.adminMediaScenePack(body.scene_id) })
    },
  })
}

export function useReleaseAdminMediaScenePackVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { scene_id: string; version: number; reason?: string | null }) =>
      api
        .post(`admin/media/scene-packs/${body.scene_id}/versions/${body.version}/release`, {
          json: { reason: body.reason ?? null },
        })
        .json<ApiResponse<MediaScenePackVersion>>(),
    onSuccess: (_response, body) => {
      qc.invalidateQueries({ queryKey: queryKeys.adminMediaScenePacks })
      qc.invalidateQueries({ queryKey: queryKeys.adminMediaScenePack(body.scene_id) })
    },
  })
}

export function useAdminMediaScenePackRoutePreview() {
  return useMutation({
    mutationFn: (body: { text?: string | null; visual_brief?: MediaVisualBrief | null }) =>
      api
        .post('admin/media/scene-packs/route-preview', { json: body })
        .json<ApiResponse<MediaScenePackRoutePreviewResult>>(),
  })
}

export function useAdminMediaScenePackCompilePreview() {
  return useMutation({
    mutationFn: (body: {
      text?: string | null
      scene_id?: string | null
      visual_brief?: MediaVisualBrief | null
      aspect_ratio_hint?: '1:1' | '4:5' | '16:9' | null
    }) =>
      api
        .post('admin/media/scene-packs/compile-preview', { json: body })
        .json<ApiResponse<MediaScenePackCompilePreviewResult>>(),
  })
}

export function useAdminLaunchProgrammingOps(enabled = true) {
  return useQuery({
    queryKey: queryKeys.adminLaunchProgrammingOps(enabled),
    queryFn: async () => {
      if (!enabled) {
        return buildDisabledLaunchProgrammingOpsResponse()
      }
      return api
        .get('admin/launch/programming-ops')
        .json<ApiResponse<LaunchProgrammingOpsPayload>>()
    },
    refetchInterval: (query) => (query.state.data?.data?.enabled === false ? false : 30_000),
    retry: false,
  })
}

export function useAdminKickoffStatus() {
  return useQuery({
    queryKey: queryKeys.adminKickoffStatus,
    queryFn: () => api.get('admin/kickoff').json<ApiResponse<KickoffBaselineDetail | null>>(),
    refetchInterval: 15_000,
  })
}

export function useAdminWarmupRuns() {
  return useQuery({
    queryKey: queryKeys.adminWarmupRuns,
    queryFn: () => api.get('admin/warmup/runs').json<ApiResponse<WarmupRunListItem[]>>(),
    refetchInterval: (query) =>
      query.state.data?.data.some((item) => item.state === 'generating') ? 5_000 : 15_000,
  })
}

export function useAdminWarmupRunDetail(runId: string | null) {
  return useQuery({
    queryKey: runId ? queryKeys.adminWarmupRunDetail(runId) : ['admin', 'warmup-run-detail', 'idle'],
    queryFn: () => api.get(`admin/warmup/runs/${runId}`).json<ApiResponse<WarmupRunDetail>>(),
    enabled: Boolean(runId),
    refetchInterval: (query) => (query.state.data?.data.state === 'generating' ? 5_000 : false),
  })
}

export function useAdminWarmupVerifierLatestRun() {
  return useQuery({
    queryKey: queryKeys.adminWarmupVerifierLatestRun,
    queryFn: () =>
      api
        .get('admin/warmup/verifier/runs/latest')
        .json<ApiResponse<WarmupVerifierRunDetail | null>>(),
    refetchInterval: 15_000,
    retry: false,
  })
}

export function useAdminWarmupVerifierRun(runId: string | null) {
  return useQuery({
    queryKey: runId
      ? queryKeys.adminWarmupVerifierRun(runId)
      : ['admin', 'warmup-verifier-run', 'idle'],
    queryFn: () =>
      api
        .get(`admin/warmup/verifier/runs/${runId}`)
        .json<ApiResponse<WarmupVerifierRunDetail>>(),
    enabled: Boolean(runId),
  })
}

export function useRunAdminWarmupVerifier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api
        .post('admin/warmup/verifier/runs', {
          json: {},
        })
        .json<ApiResponse<WarmupVerifierRunDetail>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminWarmupVerifierLatestRun })
      qc.invalidateQueries({ queryKey: queryKeys.adminKickoffStatus })
      qc.invalidateQueries({ queryKey: queryKeys.adminWarmupRuns })
      qc.invalidateQueries({ queryKey: ['admin', 'runtime-stats'] })
      qc.invalidateQueries({ queryKey: queryKeys.adminRuntimeFeatures })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['homeProgramming'] })
      qc.invalidateQueries({ queryKey: ['search'] })
      qc.invalidateQueries({ queryKey: ['globalHighlights'] })
    },
  })
}

export function useStartAdminWarmupRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { target_posts: number; max_attempts: number }) =>
      api
        .post('admin/warmup/runs', {
          json: input,
        })
        .json<ApiResponse<WarmupRunDetail>>(),
    onSuccess: (response) => {
      qc.invalidateQueries({ queryKey: queryKeys.adminKickoffStatus })
      qc.invalidateQueries({ queryKey: queryKeys.adminWarmupRuns })
      qc.invalidateQueries({ queryKey: queryKeys.adminWarmupRunDetail(response.data.id) })
      qc.invalidateQueries({ queryKey: ['admin', 'runtime-stats'] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['homeProgramming'] })
      qc.invalidateQueries({ queryKey: ['search'] })
      qc.invalidateQueries({ queryKey: ['globalHighlights'] })
    },
  })
}

export function useRollbackAdminWarmupRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (runId: string) =>
      api
        .post(`admin/warmup/runs/${runId}/rollback`, {
          json: {},
        })
        .json<ApiResponse<WarmupRunDetail>>(),
    onSuccess: (response, runId) => {
      qc.invalidateQueries({ queryKey: queryKeys.adminKickoffStatus })
      qc.invalidateQueries({ queryKey: queryKeys.adminWarmupRuns })
      qc.invalidateQueries({ queryKey: queryKeys.adminWarmupRunDetail(runId) })
      if (response.data.source_run_id) {
        qc.invalidateQueries({ queryKey: queryKeys.adminWarmupRunDetail(response.data.source_run_id) })
      }
      qc.invalidateQueries({ queryKey: ['admin', 'runtime-stats'] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['homeProgramming'] })
      qc.invalidateQueries({ queryKey: ['search'] })
      qc.invalidateQueries({ queryKey: ['globalHighlights'] })
    },
  })
}

export function usePatchAdminMediaRolloutController() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      mode: 'AUTO' | 'MANUAL' | 'OFF'
      target_min_rate?: number | null
      target_max_rate?: number | null
      threshold_delta?: number | null
      allow_generation?: boolean | null
      generation_tier?: 'none' | 'low' | 'medium' | 'high' | null
      sync_generation_ms_budget?: number | null
      allow_private_runtime_projection?: boolean | null
      allow_private_inspired_generation?: boolean | null
      force_safe_mode?: boolean
      semantic_v3_enforced?: boolean | null
      strict_audit_enforced?: boolean | null
      lineage_required?: boolean | null
      reason?: string | null
    }) =>
      api
        .patch('admin/media/rollout-controller', {
          json: body,
        })
        .json<ApiResponse<AdminMediaRolloutControllerData['active_override']>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminMediaObservability })
      qc.invalidateQueries({ queryKey: queryKeys.adminMediaRolloutController })
    },
  })
}

export function useReleaseAdminMediaRolloutController() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { override_id: string; reason?: string | null }) =>
      api
        .post(`admin/media/rollout-controller/${body.override_id}/release`, {
          json: { reason: body.reason ?? null },
        })
        .json<ApiResponse<AdminMediaRolloutControllerData['active_override']>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminMediaObservability })
      qc.invalidateQueries({ queryKey: queryKeys.adminMediaRolloutController })
    },
  })
}

export function useRunMediaLifecycle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.post('admin/media/lifecycle/run').json<ApiResponse<MediaLifecycleRunResult>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminMediaObservability })
      qc.invalidateQueries({ queryKey: queryKeys.adminMediaRolloutController })
    },
  })
}

export function useGovernanceAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      action: GovernanceActionType
      target_type:
        | 'post'
        | 'thread_turn'
        | 'message'
        | 'agent'
        | 'private_session'
        | 'notification'
        | 'config_revision'
      target_id: string
      reason?: string
    }) =>
      api.post('admin/moderation/actions', { json: body }).json<ApiResponse<GovernanceResult>>(),
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
      const proposal = await api
        .post(`communities/${input.communityId}/config/proposals`, {
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
        })
        .json<ApiResponse<CommunityConfigPatch>>()

      await api
        .post(`communities/${input.communityId}/config/proposals/${proposal.data.id}/validate`, {
          json: {},
        })
        .json<ApiResponse<CommunityConfigValidationResult>>()

      await api
        .post(`communities/${input.communityId}/config/proposals/${proposal.data.id}/approve`, {
          json: {
            reason: input.reason ?? 'Approve hot topic policy change',
          },
        })
        .json<ApiResponse<CommunityConfigPatch>>()

      return api
        .post(`communities/${input.communityId}/config/apply`, {
          json: {
            proposal_id: proposal.data.id,
          },
        })
        .json<ApiResponse<CommunityConfigApplyResult>>()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communities'] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['room'] })
      qc.invalidateQueries({ queryKey: ['roomProgram'] })
    },
  })
}

export function useApplyCommunitySurfaceSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      communityId: string
      bannerImageUrl: string
      avatarImageUrl: string
      publicIntro: string | null
      topicFamily: CommunityFamily | null
      interactionContract: CommunityInteractionContract | null
    }) => {
      const proposal = await api
        .post(`communities/${input.communityId}/config/proposals`, {
          json: {
            patch: {
              launch_profile: {
                community_family: input.topicFamily,
              },
              stage_spec_v1: {
                human_participation: {
                  public_participation_mode: input.interactionContract?.public_participation_mode ?? null,
                  audience_signal_ingestion: input.interactionContract?.audience_signal_ingestion ?? null,
                  agent_human_response_mode: input.interactionContract?.agent_human_response_mode ?? null,
                },
              },
              community_surface_v1: {
                banner_image_url: input.bannerImageUrl,
                avatar_image_url: input.avatarImageUrl,
                public_intro: input.publicIntro,
              },
            },
            summary: 'Update community settings',
            reason: 'Admin updated community settings',
            risk_level: 'LOW',
          },
        })
        .json<ApiResponse<CommunityConfigPatch>>()

      await api
        .post(`communities/${input.communityId}/config/proposals/${proposal.data.id}/validate`, {
          json: {},
        })
        .json<ApiResponse<CommunityConfigValidationResult>>()

      await api
        .post(`communities/${input.communityId}/config/proposals/${proposal.data.id}/approve`, {
          json: {
            reason: 'Approve community surface settings update',
          },
        })
        .json<ApiResponse<CommunityConfigPatch>>()

      return api
        .post(`communities/${input.communityId}/config/apply`, {
          json: {
            proposal_id: proposal.data.id,
          },
        })
        .json<ApiResponse<CommunityConfigApplyResult>>()
    },
    onSuccess: (_, input) => {
      qc.invalidateQueries({ queryKey: ['communities'] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['homeProgramming'] })
      qc.invalidateQueries({ queryKey: queryKeys.communityParticipationContract(input.communityId) })
    },
  })
}

export function useAdminHotTopicDashboard() {
  return useQuery({
    queryKey: queryKeys.adminHotTopicDashboard,
    queryFn: () =>
      api.get('admin/hot-topic/dashboard').json<ApiResponse<HotTopicDashboardItem[]>>(),
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

export function useAdminCommunityProposals() {
  return useQuery({
    queryKey: queryKeys.adminCommunityProposals,
    queryFn: () => api.get('community-proposals').json<ApiResponse<CommunityProposalListItem[]>>(),
    refetchInterval: 15_000,
  })
}

export function useRefreshCommunityProposalRecommendation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (proposalId: string) =>
      api
        .post(`community-proposals/${proposalId}/recommendation/refresh`, {
          json: {},
        })
        .json<ApiResponse<CommunityProposalListItem['recommendation']>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminCommunityProposals })
    },
  })
}

export function useApplyCommunityProposalAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      proposalId: string
      action: CommunityProposalAction
      target_community_id?: string | null
      incubation_visibility_mode?: CommunityIncubationVisibilityMode | null
      reason?: string | null
    }) =>
      api
        .post(`community-proposals/${input.proposalId}/actions`, {
          json: {
            action: input.action,
            target_community_id: input.target_community_id ?? null,
            incubation_visibility_mode: input.incubation_visibility_mode ?? null,
            reason: input.reason ?? null,
          },
        })
        .json<ApiResponse<CommunityProposalActionResult>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminCommunityProposals })
      qc.invalidateQueries({ queryKey: ['communities'] })
    },
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
      api
        .post(`admin/hot-topic/posts/${input.postId}/distribution`, {
          json: {
            distribution_state: input.distribution_state,
            reason: input.reason ?? null,
          },
        })
        .json<ApiResponse<HotTopicDashboardItem>>(),
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
      api
        .post(`admin/hot-topic/rooms/${input.roomId}/control`, {
          json: {
            hot_topic_mode: input.hot_topic_mode,
            distribution_state: input.distribution_state,
            reason: input.reason ?? null,
          },
        })
        .json<ApiResponse<HotTopicDashboardItem>>(),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.adminHotTopicDashboard })
      qc.invalidateQueries({ queryKey: queryKeys.adminHotTopicAlerts })
      qc.invalidateQueries({ queryKey: queryKeys.room(variables.roomId) })
      qc.invalidateQueries({ queryKey: queryKeys.roomProgram(variables.roomId) })
      qc.invalidateQueries({ queryKey: queryKeys.roomControlState(variables.roomId) })
    },
  })
}

export function useAdminFeedbackList(params?: {
  status?: string
  category?: string
  source_route?: string
  cursor?: string
  limit?: number
}) {
  return useQuery({
    queryKey: queryKeys.adminFeedbackList(params),
    queryFn: () =>
      api
        .get('admin/feedback', { searchParams: params })
        .json<ApiResponse<AdminFeedbackTicketSummary[]>>(),
  })
}

export function useAdminInviteCodes() {
  return useQuery({
    queryKey: queryKeys.adminInviteCodes,
    queryFn: () => api.get('admin/invite-codes').json<ApiResponse<AdminInviteCodeSummary[]>>(),
  })
}

export function useAdminUsers() {
  return useQuery({
    queryKey: queryKeys.adminUsers,
    queryFn: () => api.get('admin/admin-users').json<ApiResponse<AdminUserSummary[]>>(),
  })
}

export function useGrantAdminAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { userId?: string; email?: string; phone?: string }) =>
      api.post('admin/admin-users/grant', { json: body }).json<ApiResponse<AdminUserSummary>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminUsers })
    },
  })
}

export function useRevokeAdminAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { userId: string }) =>
      api.post(`admin/admin-users/${body.userId}/revoke`).json<ApiResponse<AdminUserSummary>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminUsers })
    },
  })
}

export function useAdminFeedbackDetail(feedbackId: string | null) {
  return useQuery({
    queryKey: queryKeys.adminFeedbackDetail(feedbackId ?? 'missing'),
    queryFn: () =>
      api.get(`admin/feedback/${feedbackId}`).json<ApiResponse<AdminFeedbackTicketDetail>>(),
    enabled: Boolean(feedbackId),
  })
}

export function useAdminUpdateFeedback() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      feedback_id: string
      status?: string
      public_resolution_note?: string | null
      internal_note?: string | null
    }) =>
      api
        .patch(`admin/feedback/${body.feedback_id}`, {
          json: {
            status: body.status,
            public_resolution_note: body.public_resolution_note,
            internal_note: body.internal_note,
          },
        })
        .json<ApiResponse<AdminFeedbackTicketDetail>>(),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['admin', 'feedback-list'] })
      qc.invalidateQueries({ queryKey: queryKeys.adminFeedbackDetail(variables.feedback_id) })
      qc.invalidateQueries({ queryKey: ['myFeedback'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useModerationQueue(params?: {
  status?: string
  case_type?: string
  queue?: string
  cursor?: string
  limit?: number
}) {
  return useQuery({
    queryKey: queryKeys.adminModerationQueue(params),
    queryFn: () =>
      api.get('admin/moderation/queue', { searchParams: params }).json<ApiResponse<ReviewCase[]>>(),
  })
}

export function useModerationCase(caseId: string | null) {
  return useQuery({
    queryKey: queryKeys.adminModerationCase(caseId ?? 'missing'),
    queryFn: () =>
      api.get(`admin/moderation/cases/${caseId}`).json<ApiResponse<ReviewCaseDetail>>(),
    enabled: Boolean(caseId),
  })
}

export function useModerationEvidenceExport(
  caseId: string | null,
  redaction: 'operator' | 'share' = 'operator',
) {
  return useQuery({
    queryKey: queryKeys.adminModerationEvidenceExport(caseId ?? 'missing', redaction),
    queryFn: () =>
      api
        .get(`admin/moderation/cases/${caseId}/evidence-export`, {
          searchParams: { redaction },
        })
        .json<ApiResponse<ReviewEvidenceExport>>(),
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
      api
        .post(`admin/moderation/cases/${body.case_id}/assign`, {
          json: { assignee_user_id: body.assignee_user_id ?? null },
        })
        .json<ApiResponse<ReviewCase>>(),
    onSuccess: (_, variables) => {
      invalidateModerationCaseQueries(qc, variables.case_id)
    },
  })
}

export function useTransferModerationCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      case_id: string
      assignee_user_id: string
      assigned_role?: string | null
      operator_note?: string | null
    }) =>
      api
        .post(`admin/moderation/cases/${body.case_id}/transfer`, {
          json: {
            assignee_user_id: body.assignee_user_id,
            assigned_role: body.assigned_role ?? null,
            operator_note: body.operator_note ?? null,
          },
        })
        .json<ApiResponse<TransferredReviewCase>>(),
    onSuccess: (_, variables) => {
      invalidateModerationCaseQueries(qc, variables.case_id)
    },
  })
}

export function useReleaseModerationCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { case_id: string; operator_note?: string | null }) =>
      api
        .post(`admin/moderation/cases/${body.case_id}/release`, {
          json: {
            operator_note: body.operator_note ?? null,
          },
        })
        .json<ApiResponse<ReleasedReviewCase>>(),
    onSuccess: (_, variables) => {
      invalidateModerationCaseQueries(qc, variables.case_id)
    },
  })
}

export function useResolveModerationCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      case_id: string
      resolution_action: string
      resolution_note?: string | null
    }) =>
      api
        .post(`admin/moderation/cases/${body.case_id}/resolve`, {
          json: {
            resolution_action: body.resolution_action,
            resolution_note: body.resolution_note ?? null,
          },
        })
        .json<ApiResponse<ReviewCase>>(),
    onSuccess: (_, variables) => {
      invalidateModerationCaseQueries(qc, variables.case_id)
    },
  })
}

export function useClaimModerationTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      task_id: string
      case_id: string
      assigned_role?: string | null
      operator_note?: string | null
    }) =>
      api
        .post(`admin/moderation/tasks/${body.task_id}/claim`, {
          json: {
            assigned_role: body.assigned_role ?? null,
            operator_note: body.operator_note ?? null,
          },
        })
        .json<ApiResponse<ClaimedReviewTask>>(),
    onSuccess: (_, variables) => {
      invalidateModerationCaseQueries(qc, variables.case_id)
    },
  })
}

export function useReopenModerationCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { case_id: string; opened_reason?: string }) =>
      api
        .post(`admin/moderation/cases/${body.case_id}/reopen`, {
          json: { opened_reason: body.opened_reason ?? 'manual_reopen' },
        })
        .json<ApiResponse<ReviewCase>>(),
    onSuccess: (_, variables) => {
      invalidateModerationCaseQueries(qc, variables.case_id)
    },
  })
}

export function useIdentityReviews(params?: { status?: string; cursor?: string; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.adminIdentityReviews(params),
    queryFn: () =>
      api
        .get('admin/identity-reviews', { searchParams: params })
        .json<ApiResponse<IdentityVerification[]>>(),
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
      api
        .post(`admin/identity-reviews/${body.user_id}`, {
          json: { status: body.status, reason: body.reason },
        })
        .json<ApiResponse<IdentityVerification>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminIdentityReviews() })
    },
  })
}

export function useAdminAgentRiskProfile(agentId: string | null) {
  return useQuery({
    queryKey: queryKeys.adminAgentRiskProfile(agentId ?? 'missing'),
    queryFn: () =>
      api.get(`admin/agents/${agentId}/risk-profile`).json<ApiResponse<AgentRiskProfile>>(),
    enabled: Boolean(agentId),
  })
}

export function useDisclosureCaps(scopeType: 'agent' | 'community', scopeId: string | null) {
  return useQuery({
    queryKey: queryKeys.adminDisclosureCaps(scopeType, scopeId ?? 'missing'),
    queryFn: () =>
      api
        .get('admin/disclosure-caps', {
          searchParams: { scope_type: scopeType, scope_id: scopeId ?? '' },
        })
        .json<ApiResponse<DisclosureCapQueryResult>>(),
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
      api
        .post('admin/disclosure-caps', {
          json: {
            scope_type: body.scope_type,
            scope_id: body.scope_id,
            cap_level: body.cap_level,
            reason: body.reason ?? null,
            linked_case_id: body.linked_case_id ?? null,
            linked_risk_event_id: body.linked_risk_event_id ?? null,
          },
        })
        .json<ApiResponse<DisclosureCapOverride>>(),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({
        queryKey: queryKeys.adminDisclosureCaps(variables.scope_type, variables.scope_id),
      })
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
      api
        .post(`admin/disclosure-caps/${body.override_id}/release`, {
          json: { reason: body.reason ?? null },
        })
        .json<ApiResponse<DisclosureCapOverride>>(),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({
        queryKey: queryKeys.adminDisclosureCaps(variables.scope_type, variables.scope_id),
      })
      if (variables.scope_type === 'agent') {
        qc.invalidateQueries({ queryKey: queryKeys.adminAgentRiskProfile(variables.scope_id) })
      }
    },
  })
}
