import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import type { ApiResponse, StyleSettings, InstructionInfo, InstructionTemplate, PromptOverrides } from '../types'

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

export function useAgentInstructions(agentId: string) {
  return useQuery({
    queryKey: ['agentInstructions', agentId] as const,
    queryFn: () => api.get(`agents/${agentId}/instructions`).json<ApiResponse<InstructionInfo[]>>(),
    enabled: !!agentId,
  })
}

export function useCreateInstruction(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; trigger_type: string; trigger_params?: unknown; body: string; priority?: number }) =>
      api.post(`agents/${agentId}/instructions`, { json: data }).json<ApiResponse<{ id: string }>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agentInstructions', agentId] })
    },
  })
}

export function useUpdateInstruction(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; trigger_type?: string; trigger_params?: unknown; body?: string; priority?: number }) =>
      api.patch(`agents/${agentId}/instructions/${id}`, { json: data }).json<ApiResponse<unknown>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agentInstructions', agentId] })
    },
  })
}

export function useDeleteInstruction(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`agents/${agentId}/instructions/${id}`).json<ApiResponse<unknown>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agentInstructions', agentId] })
    },
  })
}

export function useToggleInstruction(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`agents/${agentId}/instructions/${id}/toggle`).json<ApiResponse<{ enabled: boolean }>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agentInstructions', agentId] })
    },
  })
}

export function useInstructionTemplates() {
  return useQuery({
    queryKey: ['instructionTemplates'] as const,
    queryFn: () => api.get('instruction-templates').json<ApiResponse<InstructionTemplate[]>>(),
    staleTime: Infinity,
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
