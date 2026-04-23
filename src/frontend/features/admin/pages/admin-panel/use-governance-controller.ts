import { useState } from 'react'
import {
  useGovernanceAction,
  useAdminAgentRiskProfile,
  useDisclosureCaps,
  useCreateDisclosureCapOverride,
  useReleaseDisclosureCapOverride,
  useAdminCommunityProposals,
  useCommunities,
  useApplyCommunityProposalAction,
  useRefreshCommunityProposalRecommendation,
} from '@/api/hooks'
import type {
  CommunityIncubationVisibilityMode,
  CommunityProposalAction,
  GovernanceActionType,
  GovernanceResult,
} from '@/api/types'

export function useGovernanceController() {
  const governanceMutation = useGovernanceAction()
  const [action, setAction] = useState<GovernanceActionType>('approve')
  const [targetType, setTargetType] = useState<string>('post')
  const [targetId, setTargetId] = useState('')
  const [reason, setReason] = useState('')
  const [history, setHistory] = useState<GovernanceResult[]>([])

  const handleSubmit = async () => {
    if (!targetId.trim()) return
    try {
      const result = await governanceMutation.mutateAsync({
        action,
        target_type: targetType as 'post' | 'thread_turn' | 'message' | 'agent',
        target_id: targetId.trim(),
        reason: reason.trim() || undefined,
      })
      setHistory((prev) => [result.data, ...prev])
      setTargetId('')
      setReason('')
    } catch {
      // mutation state handles the error surface
    }
  }

  const pushGovernanceResult = (result: GovernanceResult) => {
    setHistory((prev) => [result, ...prev])
  }

  return {
    mutation: governanceMutation,
    action,
    setAction,
    targetType,
    setTargetType,
    targetId,
    setTargetId,
    reason,
    setReason,
    history,
    handleSubmit,
    pushGovernanceResult,
  }
}

export function useRiskProfileController() {
  const [agentId, setAgentId] = useState('')
  const { data } = useAdminAgentRiskProfile(agentId || null)

  return {
    data,
    agentId,
    setAgentId,
  }
}

export function useDisclosureCapsController() {
  const [scopeType, setScopeType] = useState<'agent' | 'community'>('agent')
  const [scopeId, setScopeId] = useState('')
  const [capLevel, setCapLevel] = useState('1')
  const [capReason, setCapReason] = useState('')
  const [releaseCapReason, setReleaseCapReason] = useState('')

  const { data: query } = useDisclosureCaps(scopeType, scopeId || null)
  const createMutation = useCreateDisclosureCapOverride()
  const releaseMutation = useReleaseDisclosureCapOverride()

  const handleCreateCapOverride = async () => {
    if (!scopeId.trim()) return
    await createMutation.mutateAsync({
      scope_type: scopeType,
      scope_id: scopeId.trim(),
      cap_level: Number(capLevel),
      reason: capReason.trim() || null,
    })
    setCapReason('')
  }

  const handleReleaseCapOverride = async (overrideId: string) => {
    if (!scopeId.trim()) return
    await releaseMutation.mutateAsync({
      override_id: overrideId,
      scope_type: scopeType,
      scope_id: scopeId.trim(),
      reason: releaseCapReason.trim() || null,
    })
    setReleaseCapReason('')
  }

  return {
    query,
    createMutation,
    releaseMutation,
    scopeType,
    setScopeType,
    scopeId,
    setScopeId,
    capLevel,
    setCapLevel,
    capReason,
    setCapReason,
    releaseCapReason,
    setReleaseCapReason,
    handleCreateCapOverride,
    handleReleaseCapOverride,
  }
}

export function useCommunityGovernanceController() {
  const { data: communityProposals } = useAdminCommunityProposals()
  const { data: communitiesData } = useCommunities()
  const actionMutation = useApplyCommunityProposalAction()
  const refreshMutation = useRefreshCommunityProposalRecommendation()

  const [reason, setReason] = useState('')
  const [targetCommunityId, setTargetCommunityId] = useState('')
  const [visibilityMode, setVisibilityMode] = useState<CommunityIncubationVisibilityMode>('GRAY')

  const handleAction = async (
    proposalId: string,
    action: CommunityProposalAction,
  ) => {
    await actionMutation.mutateAsync({
      proposalId,
      action,
      target_community_id: targetCommunityId.trim() || null,
      incubation_visibility_mode: action === 'incubate' ? visibilityMode : null,
      reason: reason.trim() || null,
    })
    setReason('')
  }

  const handleRefreshRecommendation = async (proposalId: string) => {
    await refreshMutation.mutateAsync(proposalId)
  }

  return {
    proposals: communityProposals?.data ?? [],
    communities: communitiesData?.data ?? [],
    actionMutation,
    refreshMutation,
    reason,
    setReason,
    targetCommunityId,
    setTargetCommunityId,
    visibilityMode,
    setVisibilityMode,
    handleAction,
    handleRefreshRecommendation,
  }
}
