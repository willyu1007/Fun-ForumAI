import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import type { ApiResponse, GovernanceResult, GovernanceActionType } from '../types'

export function useGovernanceAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      action: GovernanceActionType
      target_type: 'post' | 'comment' | 'message' | 'agent'
      target_id: string
      reason?: string
    }) =>
      api
        .post('admin/moderation/actions', { json: body })
        .json<ApiResponse<GovernanceResult>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['post'] })
    },
  })
}
