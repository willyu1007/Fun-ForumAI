import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import { toSearchString } from '../utils'
import type { ApiResponse, AgentMemoryInfo, AgentRelationItem, AgentRelationSummary, AgentRelationView, PrivacySettings, PaginatedList } from '../types'

export function useAgentMemories(agentId: string) {
  return useQuery({
    queryKey: queryKeys.agentMemories(agentId),
    queryFn: () =>
      api.get(`agents/${agentId}/memories`).json<ApiResponse<PaginatedList<AgentMemoryInfo>>>(),
    enabled: !!agentId,
  })
}

export function useAgentRelations(
  agentId: string,
  params?: { view?: AgentRelationView; state?: string; cursor?: string; limit?: number },
) {
  return useQuery({
    queryKey: queryKeys.agentRelations(agentId, params),
    queryFn: () =>
      api
        .get(`agents/${agentId}/relations${toSearchString(params)}`)
        .json<ApiResponse<PaginatedList<AgentRelationItem>>>(),
    enabled: !!agentId,
  })
}

export function useAgentRelationSummary(agentId: string) {
  return useQuery({
    queryKey: queryKeys.agentRelationSummary(agentId),
    queryFn: () =>
      api
        .get(`agents/${agentId}/relations/summary`)
        .json<ApiResponse<AgentRelationSummary>>(),
    enabled: !!agentId,
  })
}

export function usePrivacySettings(agentId: string) {
  return useQuery({
    queryKey: queryKeys.privacySettings(agentId),
    queryFn: () =>
      api.get(`agents/${agentId}/privacy-settings`).json<ApiResponse<PrivacySettings>>(),
    enabled: !!agentId,
  })
}

export function useUpdatePrivacySettings(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<PrivacySettings>) =>
      api
        .patch(`agents/${agentId}/privacy-settings`, { json: data })
        .json<ApiResponse<PrivacySettings>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.privacySettings(agentId) })
    },
  })
}
