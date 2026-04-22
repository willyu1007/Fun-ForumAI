import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import type {
  ApiResponse,
  BadgeDebugCatalogItem,
  BadgeDebugMeta,
  KickoffRunDetail,
  KickoffRunSummary,
  KickoffSeedPayload,
  KickoffStatusPayload,
  DevGuidanceScenarioApplyResult,
  DevGuidanceScenarioId,
} from '../types'

// Public dev surfaces should expose only the broad interactive profiles.
// `smoke-minimal` remains an internal mobile-smoke fixture path.
type DevSeedProfile = 'canonical' | 'launch'

// Dev data operations can run destructive reset/seed/import flows
// and regularly exceed the default 30s API timeout in local environments.
const longRunningDevApi = api.extend({
  timeout: 10 * 60_000,
  retry: { limit: 0 },
})

function invalidateHomeQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['feed'] })
  qc.invalidateQueries({ queryKey: ['homeProgramming'] })
}

function invalidateGuidanceQueries(qc: ReturnType<typeof useQueryClient>) {
  invalidateHomeQueries(qc)
  qc.invalidateQueries({ queryKey: queryKeys.guidanceSummary })
  qc.invalidateQueries({ queryKey: queryKeys.guidanceInbox })
  qc.invalidateQueries({ queryKey: queryKeys.guidanceBell })
  qc.invalidateQueries({ queryKey: queryKeys.myAgents })
}

export function useBadgeDebugCatalog(enabled = true) {
  return useQuery({
    queryKey: queryKeys.devBadgeDebugCatalog,
    queryFn: () =>
      api
        .get('dev/badges/debug')
        .json<ApiResponse<BadgeDebugCatalogItem[]> & { meta: BadgeDebugMeta }>(),
    enabled,
    staleTime: 60_000,
  })
}

export function useDevSeedMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { profile: DevSeedProfile; reset_before_seed?: boolean }) =>
      longRunningDevApi
        .post('dev/seed', {
          json: input,
        })
        .json<ApiResponse<{ counts: Record<string, number> }>>(),
    onSuccess: () => {
      invalidateHomeQueries(qc)
      qc.invalidateQueries({ queryKey: queryKeys.devKickoffStatus })
      qc.invalidateQueries({ queryKey: queryKeys.devKickoffSeed })
      qc.invalidateQueries({ queryKey: queryKeys.devKickoffLatestRun })
      qc.invalidateQueries({ queryKey: queryKeys.devKickoffRecentRuns })
      qc.invalidateQueries({ queryKey: ['devKickoffRun'] })
      qc.invalidateQueries({ queryKey: queryKeys.adminKickoffStatus })
      qc.invalidateQueries({ queryKey: queryKeys.adminWarmupRuns })
      qc.invalidateQueries({ queryKey: queryKeys.adminRuntimeFeatures })
      qc.invalidateQueries({ queryKey: ['admin', 'runtime-stats'] })
    },
  })
}

export function useDevKickoffStatus(enabled = true) {
  return useQuery({
    queryKey: queryKeys.devKickoffStatus,
    queryFn: () => api.get('dev/kickoff/status').json<ApiResponse<KickoffStatusPayload>>(),
    enabled,
    staleTime: 15_000,
  })
}

export function useDevKickoffSeed(enabled = true) {
  return useQuery({
    queryKey: queryKeys.devKickoffSeed,
    queryFn: () =>
      api.get('dev/kickoff/seed').json<ApiResponse<KickoffSeedPayload | null>>(),
    enabled,
    staleTime: 15_000,
  })
}

export function useDevKickoffLatestRun(enabled = true) {
  return useQuery({
    queryKey: queryKeys.devKickoffLatestRun,
    queryFn: () =>
      api.get('dev/kickoff/runs/latest').json<ApiResponse<KickoffRunDetail | null>>(),
    enabled,
    staleTime: 15_000,
  })
}

export function useDevKickoffRecentRuns(enabled = true) {
  return useQuery({
    queryKey: queryKeys.devKickoffRecentRuns,
    queryFn: () => api.get('dev/kickoff/runs').json<ApiResponse<KickoffRunSummary[]>>(),
    enabled,
    staleTime: 15_000,
  })
}

export function useDevKickoffRun(runId: string | null, enabled = true) {
  return useQuery({
    queryKey: runId ? queryKeys.devKickoffRun(runId) : ['devKickoffRun', 'idle'],
    queryFn: () => api.get(`dev/kickoff/runs/${runId}`).json<ApiResponse<KickoffRunDetail | null>>(),
    enabled: enabled && Boolean(runId),
    staleTime: 15_000,
  })
}

export function useDevGuidanceScenarioMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { scenario: DevGuidanceScenarioId }) =>
      longRunningDevApi
        .post('dev/guidance/scenario', {
          json: body,
        })
        .json<ApiResponse<DevGuidanceScenarioApplyResult>>(),
    onSuccess: () => {
      invalidateGuidanceQueries(qc)
    },
  })
}
