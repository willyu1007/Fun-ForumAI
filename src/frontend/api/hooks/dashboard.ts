import { useQuery } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import type { ApiResponse, AgentDashboardData } from '../types'

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
