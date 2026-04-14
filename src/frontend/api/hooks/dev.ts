import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import type {
  ApiResponse,
  BadgeDebugCatalogItem,
  BadgeDebugMeta,
  KickoffAuthoringPatch,
  KickoffBootstrapResult,
  KickoffImportReport,
  KickoffProfileId,
  KickoffRunDetail,
  KickoffRunSummary,
  KickoffStatusPayload,
} from '../types'

type DevSeedProfile = 'canonical' | 'smoke-minimal' | 'launch'

function invalidateKickoffQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.devKickoffStatus })
  qc.invalidateQueries({ queryKey: queryKeys.devKickoffLatestRun })
  qc.invalidateQueries({ queryKey: queryKeys.devKickoffRecentRuns })
  qc.invalidateQueries({ queryKey: queryKeys.adminWarmupSuites })
  qc.invalidateQueries({ queryKey: queryKeys.adminRuntimeFeatures })
  qc.invalidateQueries({ queryKey: ['admin', 'runtime-stats'] })
  qc.invalidateQueries({ queryKey: ['feed'] })
  qc.invalidateQueries({ queryKey: ['homeProgramming'] })
}

export function useBadgeDebugCatalog(enabled = true) {
  return useQuery({
    queryKey: queryKeys.devBadgeDebugCatalog,
    queryFn: () => api.get('dev/badges/debug').json<ApiResponse<BadgeDebugCatalogItem[]> & { meta: BadgeDebugMeta }>(),
    enabled,
    staleTime: 60_000,
  })
}

export function useDevSeedMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      profile: DevSeedProfile
      reset_before_seed?: boolean
    }) =>
      api.post('dev/seed', {
        json: input,
      }).json<ApiResponse<{ counts: Record<string, number> }>>(),
    onSuccess: () => {
      invalidateKickoffQueries(qc)
    },
  })
}

export function useDevKickoffBootstrap() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      mode: 'candidate' | 'active'
      suite_label?: string | null
      profile_id: KickoffProfileId
      max_runtime_topup_posts?: number
      reset_before_bootstrap?: boolean
    }) => api.post('dev/kickoff/bootstrap', { json: body }).json<ApiResponse<KickoffBootstrapResult>>(),
    onSuccess: (response) => {
      invalidateKickoffQueries(qc)
      if (response.data.run_id) {
        qc.invalidateQueries({ queryKey: queryKeys.devKickoffRun(response.data.run_id) })
      }
      if (response.data.suite_id) {
        qc.invalidateQueries({ queryKey: queryKeys.adminWarmupSuiteDetail(response.data.suite_id) })
      }
    },
  })
}

export function useDevKickoffImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      dry_run: boolean
      patch: KickoffAuthoringPatch
      patch_pack_id?: string | null
      profile_id: KickoffProfileId
    }) => api.post('dev/kickoff/imports', { json: body }).json<ApiResponse<KickoffImportReport>>(),
    onSuccess: (response) => {
      invalidateKickoffQueries(qc)
      const runId = response.data.report_meta.run_id
      if (runId) {
        qc.invalidateQueries({ queryKey: queryKeys.devKickoffRun(runId) })
      }
      if (response.data.resolved_context.suite_id) {
        qc.invalidateQueries({ queryKey: queryKeys.adminWarmupSuiteDetail(response.data.resolved_context.suite_id) })
      }
    },
  })
}

export function useDevKickoffStatus(enabled = true) {
  return useQuery({
    queryKey: queryKeys.devKickoffStatus,
    queryFn: () => api.get('dev/kickoff/status').json<ApiResponse<KickoffStatusPayload>>(),
    enabled,
    staleTime: 10_000,
    refetchInterval: enabled ? 15_000 : false,
  })
}

export function useDevKickoffRecentRuns(enabled = true) {
  return useQuery({
    queryKey: queryKeys.devKickoffRecentRuns,
    queryFn: () => api.get('dev/kickoff/runs?limit=10').json<ApiResponse<KickoffRunSummary[]>>(),
    enabled,
    staleTime: 10_000,
  })
}

export function useDevKickoffLatestRun(enabled = true) {
  return useQuery({
    queryKey: queryKeys.devKickoffLatestRun,
    queryFn: () => api.get('dev/kickoff/runs/latest').json<ApiResponse<KickoffRunDetail>>(),
    enabled,
    retry: false,
    staleTime: 10_000,
  })
}

export function useDevKickoffRun(runId: string | null, enabled = true) {
  return useQuery({
    queryKey: runId ? queryKeys.devKickoffRun(runId) : ['devKickoffRun', 'idle'],
    queryFn: () => api.get(`dev/kickoff/runs/${runId}`).json<ApiResponse<KickoffRunDetail>>(),
    enabled: enabled && Boolean(runId),
    retry: false,
    staleTime: 10_000,
  })
}
