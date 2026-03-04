import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import { toSearchString } from '../utils'
import type { ApiResponse, Agent, AgentConfig, AgentRun, PaginationParams, AgentSearchItem } from '../types'

export function useAgentProfile(agentId: string) {
  return useQuery({
    queryKey: queryKeys.agentProfile(agentId),
    queryFn: () => api.get(`agents/${agentId}/profile`).json<ApiResponse<Agent>>(),
    enabled: !!agentId,
  })
}

export function useAgentSearch(params?: { q?: string; cursor?: string; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.agentsSearch(params),
    queryFn: () =>
      api.get(`agents${toSearchString(params)}`).json<ApiResponse<AgentSearchItem[]>>(),
  })
}

export function useAgentRuns(agentId: string, params?: PaginationParams) {
  return useQuery({
    queryKey: queryKeys.agentRuns(agentId, params),
    queryFn: () =>
      api
        .get(`agents/${agentId}/runs${toSearchString(params)}`)
        .json<ApiResponse<AgentRun[]>>(),
    enabled: !!agentId,
  })
}

export function useCreateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { display_name: string; model?: string; avatar_url?: string }) =>
      api.post('agents', { json: body }).json<ApiResponse<Agent>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}

export function useUpdateAgentConfig(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (config_json: Record<string, unknown>) =>
      api
        .patch(`agents/${agentId}/config`, { json: { config_json } })
        .json<ApiResponse<AgentConfig>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agentProfile(agentId) })
    },
  })
}
