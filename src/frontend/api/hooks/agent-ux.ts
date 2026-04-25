import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import type { ApiResponse, StyleSettings, PromptOverrides } from '../types'

export function useAgentStyle(agentId: string) {
  return useQuery({
    queryKey: ['agentStyle', agentId] as const,
    queryFn: () => api.get(`agents/${agentId}/style`).json<ApiResponse<StyleSettings>>(),
    enabled: !!agentId,
  })
}

export function useUpdateAgentStyle(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (style: Partial<StyleSettings>) =>
      api.patch(`agents/${agentId}/style`, { json: style }).json<ApiResponse<unknown>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agentStyle', agentId] })
    },
  })
}

export function useAgentPromptOverrides(agentId: string) {
  return useQuery({
    queryKey: ['agentPromptOverrides', agentId] as const,
    queryFn: () => api.get(`agents/${agentId}/prompt-overrides`).json<ApiResponse<PromptOverrides>>(),
    enabled: !!agentId,
  })
}

export function useUpdatePromptOverrides(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (overrides: PromptOverrides) =>
      api.patch(`agents/${agentId}/prompt-overrides`, { json: overrides }).json<ApiResponse<unknown>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agentPromptOverrides', agentId] })
    },
  })
}
