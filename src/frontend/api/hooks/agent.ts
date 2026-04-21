import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import { toSearchString } from '../utils'
import type {
  ApiResponse,
  Agent,
  AgentBiographyBookViewModel,
  AgentBiographyReadTelemetryEvent,
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

export function useAgentBiographyBook(
  agentId: string,
  params?: {
    chapter_id?: string | null
  },
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.agentBiographyBook(agentId, params),
    queryFn: () =>
      api
        .get(`agents/${agentId}/biography-book${toSearchString(params)}`)
        .json<ApiResponse<AgentBiographyBookViewModel>>(),
    enabled: !!agentId && enabled,
  })
}

export function useRecordAgentBiographyReadTelemetry(agentId: string) {
  return useMutation({
    mutationFn: (body: Pick<AgentBiographyReadTelemetryEvent, 'chapter_id' | 'event_type' | 'is_owner_view' | 'payload'>) =>
      api
        .post(`agents/${agentId}/biography-book/telemetry`, { json: body })
        .json<ApiResponse<{ accepted: boolean }>>(),
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

export function useUpdateAgentProfile(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      display_name?: string
      avatar_url?: string | null
      moments_cover_url?: string | null
    }) =>
      api
        .patch(`agents/${agentId}/profile`, { json: body })
        .json<ApiResponse<Agent>>(),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.agentProfile(agentId) }),
        qc.invalidateQueries({ queryKey: queryKeys.myAgents }),
        qc.invalidateQueries({ queryKey: ['search'] }),
        qc.invalidateQueries({ queryKey: ['feed'] }),
      ])
    },
  })
}

export function useDeleteAgent(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete(`agents/${agentId}`).json<ApiResponse<{
      id: string
      status: 'DELETED'
      deleted_at: string
    }>>(),
    onSuccess: async () => {
      await Promise.all([
        qc.cancelQueries({ queryKey: queryKeys.privateSessions(agentId) }),
        qc.cancelQueries({ queryKey: queryKeys.ownerLifeOverview(agentId) }),
        qc.cancelQueries({ queryKey: queryKeys.ownerChronicleFeedRoot(agentId) }),
        qc.cancelQueries({ queryKey: queryKeys.ownerNurtureSuggestions(agentId) }),
      ])

      qc.removeQueries({ queryKey: queryKeys.privateSessions(agentId) })
      qc.removeQueries({ queryKey: queryKeys.ownerLifeOverview(agentId) })
      qc.removeQueries({ queryKey: queryKeys.ownerChronicleFeedRoot(agentId) })
      qc.removeQueries({ queryKey: queryKeys.ownerNurtureSuggestions(agentId) })

      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.myAgents }),
        qc.invalidateQueries({ queryKey: queryKeys.agentProfile(agentId) }),
        qc.invalidateQueries({ queryKey: ['search'] }),
        qc.invalidateQueries({ queryKey: ['feed'] }),
        qc.invalidateQueries({ queryKey: queryKeys.agentHighlights(agentId) }),
      ])
    },
  })
}
