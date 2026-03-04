import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import type { ApiResponse, AgentDashboardData, CostSummary, BudgetTierOption } from '../types'

export function useAgentDashboard(agentId: string) {
  return useQuery({
    queryKey: queryKeys.agentDashboard(agentId),
    queryFn: () =>
      api
        .get(`agents/${agentId}/dashboard`)
        .json<ApiResponse<AgentDashboardData>>(),
    enabled: !!agentId,
    refetchInterval: 30_000,
  })
}

export function useAgentCostReview(agentId: string, days = 30) {
  return useQuery({
    queryKey: ['agentCostReview', agentId, days] as const,
    queryFn: () =>
      api
        .get(`agents/${agentId}/cost-review?days=${days}`)
        .json<ApiResponse<CostSummary>>(),
    enabled: !!agentId,
  })
}

export function useBudgetTiers() {
  return useQuery({
    queryKey: ['budgetTiers'] as const,
    queryFn: () =>
      api.get('budget/tiers').json<ApiResponse<Record<string, BudgetTierOption>>>(),
    staleTime: Infinity,
  })
}

export function useInitBudget(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tier: string) =>
      api.post(`agents/${agentId}/budget/init`, { json: { tier } }).json<ApiResponse<unknown>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agentDashboard(agentId) })
    },
  })
}

export function useChangeBudgetTier(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tier: string) =>
      api.patch(`agents/${agentId}/budget/tier`, { json: { tier } }).json<ApiResponse<unknown>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agentDashboard(agentId) })
    },
  })
}
