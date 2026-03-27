import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import { toSearchString } from '../utils'
import type {
  ApiResponse,
  Agent,
  AgentConfig,
  AgentRun,
  OwnerChronicleFeed,
  OwnerLifeOverview,
  OwnerNurtureSuggestionList,
  OwnerStylePins,
  PaginationParams,
} from '../types'

interface AgentRunsOptions {
  enabled?: boolean
}

export function useAgentProfile(agentId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.agentProfile(agentId),
    queryFn: () => api.get(`agents/${agentId}/profile`).json<ApiResponse<Agent>>(),
    enabled: !!agentId && enabled,
  })
}

export function useAgentRuns(
  agentId: string,
  params?: PaginationParams,
  options?: AgentRunsOptions,
) {
  return useQuery({
    queryKey: queryKeys.agentRuns(agentId, params),
    queryFn: () =>
      api
        .get(`agents/${agentId}/runs${toSearchString(params)}`)
        .json<ApiResponse<AgentRun[]>>(),
    enabled: (options?.enabled ?? true) && !!agentId,
  })
}

export function useOwnerLifeOverview(agentId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.ownerLifeOverview(agentId),
    queryFn: () =>
      api
        .get(`private/agents/${agentId}/life-overview`)
        .json<ApiResponse<OwnerLifeOverview>>(),
    enabled: !!agentId && enabled,
  })
}

export function useOwnerChronicleFeed(
  agentId: string,
  params?: {
    cursor?: string
    limit?: number
    chapter_key?: string
    actor_id?: string
    scene_label?: string
    source_dimension?: 'WORLD' | 'SOCIAL' | 'OWNER' | 'SYSTEM'
  },
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.ownerChronicleFeed(agentId, params),
    queryFn: () =>
      api
        .get(`private/agents/${agentId}/chronicle-feed${toSearchString(params)}`)
        .json<ApiResponse<OwnerChronicleFeed>>(),
    enabled: !!agentId && enabled,
  })
}

export function useOwnerNurtureSuggestions(agentId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.ownerNurtureSuggestions(agentId),
    queryFn: () =>
      api
        .get(`private/agents/${agentId}/nurture-suggestions`)
        .json<ApiResponse<OwnerNurtureSuggestionList>>(),
    enabled: !!agentId && enabled,
  })
}

export function useCreateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      display_name: string
      model?: string
      avatar_url?: string
      persona_seed_code?: string
      owner_style_pins?: OwnerStylePins
    }) =>
      api.post('agents', { json: body }).json<ApiResponse<Agent>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: queryKeys.myAgents })
      qc.invalidateQueries({ queryKey: ['search'] })
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
