import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import { toSearchString } from '../utils'
import type { ApiResponse, AgentXpInfo, AgentTraitInfo, AgentCreditInfo, XpEventInfo, TraitDefinition, CreditEventInfo, PaginationParams, AgentAchievementItem, ChronicleEntryItem, AgentHighlightsData, GlobalHighlightsData } from '../types'

export function useAgentXp(agentId: string) {
  return useQuery({
    queryKey: queryKeys.agentXp(agentId),
    queryFn: () => api.get(`agents/${agentId}/xp`).json<ApiResponse<AgentXpInfo>>(),
    enabled: !!agentId,
  })
}

export function useAgentAchievements(agentId: string, params?: PaginationParams) {
  return useQuery({
    queryKey: queryKeys.agentAchievements(agentId, params),
    queryFn: () =>
      api
        .get(`agents/${agentId}/achievements${toSearchString(params)}`)
        .json<ApiResponse<AgentAchievementItem[]>>(),
    enabled: !!agentId,
  })
}

export function useAgentChronicle(
  agentId: string,
  params?: PaginationParams & { include_folded?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.agentChronicle(agentId, params),
    queryFn: () =>
      api
        .get(`agents/${agentId}/chronicle${toSearchString(params)}`)
        .json<ApiResponse<ChronicleEntryItem[]>>(),
    enabled: !!agentId,
  })
}

export function useAgentHighlights(agentId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.agentHighlights(agentId),
    queryFn: () =>
      api
        .get(`agents/${agentId}/highlights`)
        .json<ApiResponse<AgentHighlightsData>>(),
    enabled: !!agentId && enabled,
  })
}

export function useGlobalHighlights(enabled = true) {
  return useQuery({
    queryKey: queryKeys.globalHighlights,
    queryFn: () =>
      api
        .get('highlights')
        .json<ApiResponse<GlobalHighlightsData>>(),
    enabled,
  })
}

export function useAgentTraits(agentId: string) {
  return useQuery({
    queryKey: queryKeys.agentTraits(agentId),
    queryFn: () => api.get(`agents/${agentId}/traits`).json<ApiResponse<AgentTraitInfo[]>>(),
    enabled: !!agentId,
  })
}

export function useTraitDefinitions() {
  return useQuery({
    queryKey: queryKeys.traitDefinitions,
    queryFn: () => api.get('trait-definitions').json<ApiResponse<TraitDefinition[]>>(),
    staleTime: Infinity,
  })
}

export function useEquipTrait(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (traitCode: string) =>
      api.post(`agents/${agentId}/traits/${traitCode}/equip`).json<ApiResponse<unknown>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agentTraits(agentId) })
      qc.invalidateQueries({ queryKey: queryKeys.agentDashboard(agentId) })
    },
  })
}

export function useUnequipTrait(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (traitCode: string) =>
      api.post(`agents/${agentId}/traits/${traitCode}/unequip`).json<ApiResponse<unknown>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agentTraits(agentId) })
      qc.invalidateQueries({ queryKey: queryKeys.agentDashboard(agentId) })
    },
  })
}

export function useAgentCredit(agentId: string) {
  return useQuery({
    queryKey: queryKeys.agentCredit(agentId),
    queryFn: () => api.get(`agents/${agentId}/credit`).json<ApiResponse<AgentCreditInfo>>(),
    enabled: !!agentId,
  })
}

export function useAgentCreditEvents(agentId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.agentCreditEvents(agentId),
    queryFn: () => api.get(`agents/${agentId}/credit-events?limit=20`).json<ApiResponse<CreditEventInfo[]>>(),
    enabled: !!agentId && (options?.enabled ?? true),
  })
}

export function useAgentXpEvents(agentId: string) {
  return useQuery({
    queryKey: queryKeys.agentXpEvents(agentId),
    queryFn: () => api.get(`agents/${agentId}/xp-events?limit=50`).json<ApiResponse<XpEventInfo[]>>(),
    enabled: !!agentId,
  })
}
