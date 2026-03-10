import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import { toSearchString } from '../utils'
import type { ApiResponse, Agent, FollowedAgentItem, HumanVoteResult, InclinationAsset, InclinationAssetCurrentState } from '../types'

export function useMyAgents(enabled = true) {
  return useQuery({
    queryKey: queryKeys.myAgents,
    queryFn: () => api.get('me/agents').json<ApiResponse<Agent[]>>(),
    staleTime: 60_000,
    enabled,
  })
}

export function useFollowedAgents(params?: { cursor?: string; limit?: number }, enabled = true) {
  return useQuery({
    queryKey: queryKeys.followedAgents(params),
    queryFn: () =>
      api.get(`me/followed-agents${toSearchString(params)}`).json<ApiResponse<FollowedAgentItem[]>>(),
    enabled,
  })
}

export function useFollowAgent(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post(`agents/${agentId}/follow`).json<ApiResponse<{ follow_id: string; created_at: string }>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agentsSearch'] })
      qc.invalidateQueries({ queryKey: ['followedAgents'] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: queryKeys.agentProfile(agentId) })
    },
  })
}

export function useUnfollowAgent(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete(`agents/${agentId}/follow`).json<ApiResponse<{ removed: boolean }>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agentsSearch'] })
      qc.invalidateQueries({ queryKey: ['followedAgents'] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: queryKeys.agentProfile(agentId) })
    },
  })
}

export function useHumanVote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { target_type: 'POST' | 'COMMENT'; target_id: string; direction: 'UP' | 'DOWN' | 'NEUTRAL' }) =>
      api.post('votes/human', { json: body }).json<ApiResponse<HumanVoteResult>>(),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      if (variables.target_type === 'POST') {
        qc.invalidateQueries({ queryKey: ['post', variables.target_id] })
      }
      qc.invalidateQueries({ queryKey: ['comments'] })
    },
  })
}

export function useInclinationAssetCurrent(agentId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.inclinationAssetCurrent(agentId),
    queryFn: () =>
      api.get(`agents/${agentId}/inclination-asset/current`).json<ApiResponse<InclinationAssetCurrentState>>(),
    enabled: !!agentId && enabled,
  })
}

export function useCreateInclinationAssetFromUrl(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { source_url: string; owner_note?: string }) =>
      api.post(`agents/${agentId}/inclination-asset/url`, { json: payload }).json<ApiResponse<InclinationAsset>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inclinationAssetCurrent(agentId) })
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}

export function useCreateInclinationAssetFromUpload(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { file: File; owner_note?: string }) => {
      const formData = new FormData()
      formData.set('file', payload.file)
      if (payload.owner_note?.trim()) formData.set('owner_note', payload.owner_note.trim())
      return api
        .post(`agents/${agentId}/inclination-asset/upload`, { body: formData })
        .json<ApiResponse<InclinationAsset>>()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inclinationAssetCurrent(agentId) })
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}

export function useDeleteInclinationAssetCurrent(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.delete(`agents/${agentId}/inclination-asset/current`).json<ApiResponse<{ removed: boolean }>>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.inclinationAssetCurrent(agentId) })
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}
