import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import { toSearchString } from '../utils'
import type { ApiResponse, AgentStatsSnapshot, AgentStatEventInfo, AgentStatePoint, StatsAllocationInput, StatsAllocationPreview, DerivedKnobsInfo } from '../types'

export function useAgentStats(agentId: string) {
  return useQuery({
    queryKey: queryKeys.agentStats(agentId),
    queryFn: () =>
      api.get(`agents/${agentId}/stats`).json<ApiResponse<AgentStatsSnapshot>>(),
    enabled: !!agentId,
  })
}

export function useAgentStatsEvents(agentId: string, params?: { limit?: number; cursor?: string }) {
  return useQuery({
    queryKey: queryKeys.agentStatsEvents(agentId, params),
    queryFn: () =>
      api.get(`agents/${agentId}/stats/events${toSearchString(params)}`)
        .json<ApiResponse<{ items: AgentStatEventInfo[]; next_cursor: string | null }>>(),
    enabled: !!agentId,
  })
}

export function useAgentStateTimeline(agentId: string, hours = 24) {
  return useQuery({
    queryKey: queryKeys.agentStateTimeline(agentId, hours),
    queryFn: () =>
      api.get(`agents/${agentId}/stats/state-timeline?hours=${hours}`).json<ApiResponse<AgentStatePoint[]>>(),
    enabled: !!agentId,
  })
}

export function useAgentDerivedKnobs(agentId: string, scene: 'forum' | 'chat' | 'relation' | 'vote' | 'memory') {
  return useQuery({
    queryKey: queryKeys.agentDerivedKnobs(agentId, scene),
    queryFn: () =>
      api.get(`agents/${agentId}/stats/derived?scene=${scene}`).json<ApiResponse<DerivedKnobsInfo>>(),
    enabled: !!agentId,
  })
}

export function usePreviewStatsAllocation(agentId: string) {
  return useMutation({
    mutationFn: (body: { allocation: StatsAllocationInput; version?: number }) =>
      api.post(`agents/${agentId}/stats/preview-allocation`, { json: body }).json<ApiResponse<StatsAllocationPreview>>(),
  })
}

export function useAllocateStats(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { allocation: StatsAllocationInput; version?: number; confirm_no_respec: true; idempotency_key: string }) =>
      api.post(`agents/${agentId}/stats/allocate`, { json: body }).json<ApiResponse<AgentStatsSnapshot & { spent_points: number; remaining_points: number; deduped: boolean }>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agentStats(agentId) })
      qc.invalidateQueries({ queryKey: ['agentStatsEvents', agentId] })
      qc.invalidateQueries({ queryKey: ['agentStateTimeline', agentId] })
      qc.invalidateQueries({ queryKey: ['agentDerivedKnobs', agentId] })
    },
  })
}
