import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import type {
  ApiResponse,
  AdminMediaImportItemDto,
  AdminMediaImportListPayloadDto,
  AdminMediaImportUrlRequestBody,
  AdminMediaObservabilityData,
  AdminMediaRolloutControllerData,
  CueBoardPayload,
  CueChangeDomain,
  CueDetailPayload,
  CueMediaItem,
  CuePatchV1,
  CuePreviewPayload,
  MediaPickerPayload,
  PublicDiscussionCueDomain,
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
  RuntimeOperationRecordsListData,
  RuntimeOperationRecordDetailData,
  RuntimeOperationRecordListFilters,
  InfraSnapshotData,
  LlmConnectivityListData,
  LlmConnectivityTestResponseData,
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

export interface UseAdminCueBoardParams {
  schedule_id?: string
  community_id?: string
  from?: string
  to?: string
  limit?: number
  enabled?: boolean
}

export function useAdminCueBoard(params: UseAdminCueBoardParams = {}) {
  const { enabled = true, ...query } = params
  return useQuery({
    queryKey: queryKeys.adminCueBoard(query),
    queryFn: async () => {
      const search = new URLSearchParams()
      if (query.schedule_id) search.set('schedule_id', query.schedule_id)
      if (query.community_id) search.set('community_id', query.community_id)
      if (query.from) search.set('from', query.from)
      if (query.to) search.set('to', query.to)
      if (query.limit !== undefined) search.set('limit', String(query.limit))
      const path = `admin/programming/cue-board${
        search.toString() ? `?${search.toString()}` : ''
      }`
      return api.get(path).json<ApiResponse<CueBoardPayload>>()
    },
    enabled,
    refetchInterval: 30_000,
    retry: false,
  })
}

export interface AdminCueBoardBaselineImportResult {
  schedule_id: string
  schedule_status: string
  schedule_source: string
  baseline_contract_version: string | null
  cue_count: number
  is_new: boolean
}

export function useAdminCueBoardBaselineImport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      return api
        .post('admin/programming/cue-board/baseline-import')
        .json<ApiResponse<AdminCueBoardBaselineImportResult>>()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'cue-board'] })
    },
  })
}

// =============================================================================
// T-210 M2 — admin cue editor mutation hooks
// =============================================================================

function invalidateCueQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['admin', 'cue-board'] })
  void queryClient.invalidateQueries({ queryKey: ['admin', 'cue-detail'] })
}

export function useAdminCueDetail(cueId: string | null) {
  return useQuery({
    queryKey: cueId ? queryKeys.adminCueDetail(cueId) : ['admin', 'cue-detail', 'idle'],
    queryFn: () =>
      api.get(`admin/programming/cues/${cueId}`).json<ApiResponse<CueDetailPayload>>(),
    enabled: Boolean(cueId),
    retry: false,
  })
}

interface CueMutationResult {
  cue: PublicDiscussionCueDomain
  change: CueChangeDomain
}

export function useAdminCueCreate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { schedule_id: string; scope: PublicDiscussionCueDomain['scope']; patch: CuePatchV1 }) =>
      api
        .post('admin/programming/cues', { json: input })
        .json<ApiResponse<CueMutationResult>>(),
    onSuccess: () => invalidateCueQueries(queryClient),
  })
}

export function useAdminCueUpdate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { cueId: string; patch: CuePatchV1 }) =>
      api
        .patch(`admin/programming/cues/${input.cueId}`, { json: { patch: input.patch } })
        .json<ApiResponse<CueMutationResult>>(),
    onSuccess: () => invalidateCueQueries(queryClient),
  })
}

export function useAdminCueCancel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { cueId: string; reason?: string }) =>
      api
        .post(`admin/programming/cues/${input.cueId}/cancel`, {
          json: input.reason ? { reason: input.reason } : {},
        })
        .json<ApiResponse<CueMutationResult>>(),
    onSuccess: () => invalidateCueQueries(queryClient),
  })
}

export function useAdminCueForceSkip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { cueId: string; reason?: string }) =>
      api
        .post(`admin/programming/cues/${input.cueId}/force-skip`, {
          json: input.reason ? { reason: input.reason } : {},
        })
        .json<ApiResponse<CueMutationResult>>(),
    onSuccess: () => invalidateCueQueries(queryClient),
  })
}

export function useAdminCuePublish() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (cueId: string) =>
      api
        .post(`admin/programming/cues/${cueId}/publish`, { json: {} })
        .json<ApiResponse<CueMutationResult>>(),
    onSuccess: () => invalidateCueQueries(queryClient),
  })
}

export function useAdminCueAttachMedia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      cueId: string
      asset_id: string
      role: CueMediaItem['role']
      // T-216 M3 — all four strengths now exposed. Server-side
      // `manage_programming_media` permission still gates the
      // operation as a whole; future fine-grained permission can
      // restrict `anchor` / `selected_only_pool` to a stricter role.
      usage_strength?: 'optional' | 'preferred' | 'anchor' | 'selected_only_pool'
      use_policy?:
        | 'runtime_only'
        | 'prefer_runtime_context'
        | 'prefer_public_display'
        | 'allow_generated_derivative'
      selection_note?: string | null
      sort_order?: number
    }) => {
      const { cueId, ...body } = input
      return api
        .post(`admin/programming/cues/${cueId}/media`, { json: body })
        .json<ApiResponse<{ media_id: string; change: CueChangeDomain }>>()
    },
    onSuccess: () => invalidateCueQueries(queryClient),
  })
}

export function useAdminCueRemoveMedia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { cueId: string; mediaId: string }) =>
      api
        .delete(`admin/programming/cues/${input.cueId}/media/${input.mediaId}`)
        .json<ApiResponse<{ removed: boolean; change: CueChangeDomain }>>(),
    onSuccess: () => invalidateCueQueries(queryClient),
  })
}

export function useAdminScheduleRollback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { scheduleId: string; summary?: string }) =>
      api
        .post(`admin/programming/schedule/${input.scheduleId}/rollback`, {
          json: input.summary ? { summary: input.summary } : {},
        })
        .json<ApiResponse<{ schedule: { id: string; version: number }; change: CueChangeDomain }>>(),
    onSuccess: () => invalidateCueQueries(queryClient),
  })
}

export function useAdminCueAudit(
  params: {
    cue_id?: string
    schedule_id?: string
    actor_user_id?: string
    limit?: number
    enabled?: boolean
  } = {},
) {
  const { enabled = true, ...query } = params
  return useQuery({
    queryKey: queryKeys.adminCueAudit(query),
    queryFn: async () => {
      const search = new URLSearchParams()
      if (query.cue_id) search.set('cue_id', query.cue_id)
      if (query.schedule_id) search.set('schedule_id', query.schedule_id)
      if (query.actor_user_id) search.set('actor_user_id', query.actor_user_id)
      if (query.limit !== undefined) search.set('limit', String(query.limit))
      const path = `admin/programming/audit${search.toString() ? `?${search.toString()}` : ''}`
      return api
        .get(path)
        .json<ApiResponse<{ items: CueChangeDomain[]; total: number }>>()
    },
    enabled: enabled && Boolean(query.cue_id || query.schedule_id),
    retry: false,
  })
}

export function useAdminCuePreview() {
  return useMutation({
    mutationFn: async (input: { cueId: string; patch: CuePatchV1 }) =>
      api
        .post(`admin/programming/cues/${input.cueId}/preview`, { json: { patch: input.patch } })
        .json<ApiResponse<CuePreviewPayload>>(),
  })
}

export function useAdminMediaPicker(params: { community_id?: string; cursor?: string; limit?: number; enabled?: boolean } = {}) {
  const { enabled = true, ...query } = params
  return useQuery({
    queryKey: queryKeys.adminMediaPicker(query),
    queryFn: async () => {
      const search = new URLSearchParams()
      if (query.community_id) search.set('community_id', query.community_id)
      if (query.cursor) search.set('cursor', query.cursor)
      if (query.limit !== undefined) search.set('limit', String(query.limit))
      const path = `admin/programming/media-picker${
        search.toString() ? `?${search.toString()}` : ''
      }`
      return api.get(path).json<ApiResponse<MediaPickerPayload>>()
    },
    enabled,
    retry: false,
  })
}

// =============================================================================

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

// =============================================================================
// T-215 B-M3 — admin preview of public cue projection
// =============================================================================

export interface UseAdminCueProjectionParams {
  community_id?: string
  lookahead_minutes?: number
  completed_window_minutes?: number
  upcoming_limit?: number
  completed_limit?: number
  enabled?: boolean
}

export function useAdminCueProjection(params: UseAdminCueProjectionParams = {}) {
  const { enabled = true, ...query } = params
  return useQuery({
    queryKey: queryKeys.adminCueProjection(query),
    queryFn: async () => {
      const search = new URLSearchParams()
      if (query.community_id) search.set('community_id', query.community_id)
      if (query.lookahead_minutes !== undefined) search.set('lookahead_minutes', String(query.lookahead_minutes))
      if (query.completed_window_minutes !== undefined) search.set('completed_window_minutes', String(query.completed_window_minutes))
      if (query.upcoming_limit !== undefined) search.set('upcoming_limit', String(query.upcoming_limit))
      if (query.completed_limit !== undefined) search.set('completed_limit', String(query.completed_limit))
      const path = `admin/programming/cue-projection${search.toString() ? `?${search.toString()}` : ''}`
      return api.get(path).json<ApiResponse<import('../types').CueProjectionFacet>>()
    },
    enabled,
    refetchInterval: 30_000,
    retry: false,
  })
}

// =============================================================================
// T-216 M3 closer — media plan resolution audit hook
// =============================================================================

export interface UseAdminMediaPlanResolutionsParams {
  attempt_id?: string
  cue_id?: string
  limit?: number
  enabled?: boolean
}

export function useAdminMediaPlanResolutions(params: UseAdminMediaPlanResolutionsParams = {}) {
  const { enabled = true, ...query } = params
  const ready = Boolean(query.attempt_id || query.cue_id)
  return useQuery({
    queryKey: queryKeys.adminMediaPlanResolutions(query),
    queryFn: async () => {
      const search = new URLSearchParams()
      if (query.attempt_id) search.set('attempt_id', query.attempt_id)
      if (query.cue_id) search.set('cue_id', query.cue_id)
      if (query.limit !== undefined) search.set('limit', String(query.limit))
      const path = `admin/programming/media-plan-resolutions?${search.toString()}`
      return api.get(path).json<ApiResponse<{
        items: import('../types').MediaPlanResolutionRow[]
        total: number
        attempt_id: string | null
      }>>()
    },
    enabled: enabled && ready,
    retry: false,
  })
}

// =============================================================================
// T-214 A-M3 — auto-patch inbox hooks
// =============================================================================

export type AdminAutoPatchInboxItem = CueChangeDomain

export interface UseAdminAutoPatchInboxParams {
  approval_status?: 'pending' | 'approved' | 'rejected' | 'auto_applied' | 'rolled_back'
  limit?: number
  enabled?: boolean
}

export function useAdminAutoPatchInbox(params: UseAdminAutoPatchInboxParams = {}) {
  const { enabled = true, approval_status, limit } = params
  return useQuery({
    queryKey: queryKeys.adminAutoPatchInbox({
      approval_status,
      limit,
    }),
    queryFn: async () => {
      const search = new URLSearchParams()
      if (approval_status) search.set('approval_status', approval_status)
      if (limit !== undefined) search.set('limit', String(limit))
      const path = `admin/programming/auto-patches${search.toString() ? `?${search.toString()}` : ''}`
      return api.get(path).json<ApiResponse<{
        items: AdminAutoPatchInboxItem[]
        total: number
      }>>()
    },
    enabled,
    refetchInterval: 30_000,
    retry: false,
  })
}

export function useAdminAutoPatchDetail(id: string | null) {
  return useQuery({
    queryKey: id ? queryKeys.adminAutoPatchDetail(id) : ['admin', 'auto-patch-detail', 'idle'],
    queryFn: () =>
      api
        .get(`admin/programming/auto-patches/${id}`)
        .json<ApiResponse<{ change: AdminAutoPatchInboxItem }>>(),
    enabled: Boolean(id),
    retry: false,
  })
}

function invalidateAutoPatchQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['admin', 'auto-patch-inbox'] })
  void queryClient.invalidateQueries({ queryKey: ['admin', 'auto-patch-detail'] })
}

export function useApproveAutoPatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; reason?: string }) =>
      api
        .post(`admin/programming/auto-patches/${input.id}/approve`, {
          json: input.reason ? { reason: input.reason } : {},
        })
        .json<ApiResponse<{ change: AdminAutoPatchInboxItem }>>(),
    onSuccess: () => invalidateAutoPatchQueries(queryClient),
  })
}

export function useRejectAutoPatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; reason: string }) =>
      api
        .post(`admin/programming/auto-patches/${input.id}/reject`, {
          json: { reason: input.reason },
        })
        .json<ApiResponse<{ change: AdminAutoPatchInboxItem }>>(),
    onSuccess: () => invalidateAutoPatchQueries(queryClient),
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

// T-301 admin runtime operation records
function buildRuntimeOperationSearchParams(
  filters: RuntimeOperationRecordListFilters,
): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  if (filters.severity?.length) out.severity = filters.severity.join(',')
  if (filters.source?.length) out.source = filters.source.join(',')
  if (filters.status?.length) out.status = filters.status.join(',')
  if (filters.agent_id) out.agent_id = filters.agent_id
  if (filters.trace_id) out.trace_id = filters.trace_id
  if (filters.correlation_id) out.correlation_id = filters.correlation_id
  if (filters.event_id) out.event_id = filters.event_id
  if (filters.linked_risk_event_id) out.linked_risk_event_id = filters.linked_risk_event_id
  if (filters.entity_type) out.entity_type = filters.entity_type
  if (filters.entity_id) out.entity_id = filters.entity_id
  if (filters.since) out.since = filters.since
  if (filters.until) out.until = filters.until
  if (filters.cursor) out.cursor = filters.cursor
  if (typeof filters.limit === 'number') out.limit = filters.limit
  return out
}

export function useAdminRuntimeOperationRecords(
  filters: RuntimeOperationRecordListFilters = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.adminRuntimeOperationRecords(filters as Record<string, unknown>),
    queryFn: () =>
      api
        .get('admin/runtime/operation-records', {
          searchParams: buildRuntimeOperationSearchParams(filters),
        })
        .json<ApiResponse<RuntimeOperationRecordsListData>>(),
    enabled: options.enabled !== false,
    retry: false,
  })
}

export function useAdminRuntimeOperationRecord(
  id: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.adminRuntimeOperationRecord(id ?? ''),
    queryFn: () =>
      api
        .get(`admin/runtime/operation-records/${id}`)
        .json<ApiResponse<RuntimeOperationRecordDetailData>>(),
    enabled: Boolean(id) && options.enabled !== false,
    retry: false,
  })
}

export function useAdminRuntimeInfraSnapshot(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.adminRuntimeInfraSnapshot,
    queryFn: () =>
      api.get('admin/runtime/infra-snapshot').json<ApiResponse<InfraSnapshotData>>(),
    enabled: options.enabled !== false,
    refetchInterval: 15_000,
    retry: false,
  })
}

export function useAdminRuntimeLlmConnectivity(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.adminRuntimeLlmConnectivity,
    queryFn: () =>
      api.get('admin/runtime/llm-connectivity').json<ApiResponse<LlmConnectivityListData>>(),
    enabled: options.enabled !== false,
    retry: false,
  })
}

export function useAdminRuntimeLlmConnectivityTest() {
  return useMutation({
    mutationFn: (body: { route_ids?: string[]; scope?: 'all_admitted' }) =>
      api
        .post('admin/runtime/llm-connectivity/test', { json: body })
        .json<ApiResponse<LlmConnectivityTestResponseData>>(),
  })
}

// ── T-302 Admin media import ──────────────────────────────────────────────

interface AdminMediaImportListParams {
  limit?: number
  enabled?: boolean
}

function buildAdminMediaImportListSearch(limit?: number): string {
  if (limit === undefined) return ''
  const search = new URLSearchParams()
  search.set('limit', String(limit))
  return `?${search.toString()}`
}

export function useAdminPlatformCanonicalAssets(params: AdminMediaImportListParams = {}) {
  const { enabled = true, limit } = params
  return useQuery({
    queryKey: queryKeys.adminPlatformCanonicalAssets({ limit }),
    queryFn: () =>
      api
        .get(`admin/media/platform-canonical/assets${buildAdminMediaImportListSearch(limit)}`)
        .json<ApiResponse<AdminMediaImportListPayloadDto>>(),
    enabled,
    retry: false,
  })
}

export function useAdminCommunityCommonsAssets(
  communityId: string | null,
  params: AdminMediaImportListParams = {},
) {
  const { enabled = true, limit } = params
  return useQuery({
    queryKey: communityId
      ? queryKeys.adminCommunityCommonsAssets(communityId, { limit })
      : ['admin', 'community-commons-assets', 'idle'],
    queryFn: () =>
      api
        .get(
          `admin/communities/${communityId}/media/commons/assets${buildAdminMediaImportListSearch(limit)}`,
        )
        .json<ApiResponse<AdminMediaImportListPayloadDto>>(),
    enabled: Boolean(communityId) && enabled,
    retry: false,
  })
}

interface UploadImportInput {
  file: File
  allow_quote_original?: boolean
}

function buildUploadFormData(input: UploadImportInput): FormData {
  const formData = new FormData()
  formData.set('file', input.file)
  if (input.allow_quote_original !== undefined) {
    formData.set('allow_quote_original', input.allow_quote_original ? 'true' : 'false')
  }
  return formData
}

export function useAdminPlatformMediaImportUpload() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UploadImportInput) =>
      api
        .post('admin/media/platform-canonical/imports/upload', { body: buildUploadFormData(input) })
        .json<ApiResponse<AdminMediaImportItemDto>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'platform-canonical-assets'] })
    },
  })
}

export function useAdminPlatformMediaImportUrl() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AdminMediaImportUrlRequestBody) =>
      api
        .post('admin/media/platform-canonical/imports/url', { json: input })
        .json<ApiResponse<AdminMediaImportItemDto>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'platform-canonical-assets'] })
    },
  })
}

export function useAdminCommunityMediaImportUpload(communityId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UploadImportInput) =>
      api
        .post(`admin/communities/${communityId}/media/commons/imports/upload`, {
          body: buildUploadFormData(input),
        })
        .json<ApiResponse<AdminMediaImportItemDto>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'community-commons-assets', communityId] })
    },
  })
}

export function useAdminCommunityMediaImportUrl(communityId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AdminMediaImportUrlRequestBody) =>
      api
        .post(`admin/communities/${communityId}/media/commons/imports/url`, { json: input })
        .json<ApiResponse<AdminMediaImportItemDto>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'community-commons-assets', communityId] })
    },
  })
}
