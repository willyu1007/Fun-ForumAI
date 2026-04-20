import { useEffect, useState } from 'react'
import {
  useAdminAgentRiskProfile,
  useAdminCommunityProposals,
  useAdminHotTopicAlerts,
  useAdminHotTopicDashboard,
  useAdminHotTopicPostDistribution,
  useAdminHotTopicRoomControl,
  useAdminKickoffStatus,
  useAdminWarmupRunDetail,
  useAdminWarmupRuns,
  useAdminWarmupVerifierLatestRun,
  useApplyCommunityProposalAction,
  useApplyCommunityHotTopicPolicy,
  useAssignModerationCase,
  useClaimModerationTask,
  useCreateDisclosureCapOverride,
  useDisclosureCaps,
  useGovernanceAction,
  useHealth,
  useIdentityReviews,
  useModerationCase,
  useModerationEvidenceExport,
  useModerationQueue,
  useReleaseDisclosureCapOverride,
  useReleaseModerationCase,
  useReopenModerationCase,
  useRollbackAdminWarmupRun,
  useRunAdminWarmupVerifier,
  useResolveIdentityReview,
  useResolveModerationCase,
  useRefreshCommunityProposalRecommendation,
  useStartAdminWarmupRun,
  useTransferModerationCase,
  useCommunities,
} from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import type {
  CommunityIncubationVisibilityMode,
  CommunityProposalAction,
  GovernanceActionType,
  GovernanceResult,
  HotTopicDashboardItem,
} from '@/api/types'
import { COMMUNITY_TOPIC_DOMAIN_OPTIONS, type EvidenceExportRedaction } from './constants'

export function useAdminPanelController() {
  const { currentIdentity, user } = useAuth()
  const governanceMutation = useGovernanceAction()
  const { data: hotTopicDashboard } = useAdminHotTopicDashboard()
  const { data: hotTopicAlerts } = useAdminHotTopicAlerts()
  const { data: communityProposals } = useAdminCommunityProposals()
  const { data: communitiesData } = useCommunities()
  const setHotTopicPostDistribution = useAdminHotTopicPostDistribution()
  const setHotTopicRoomControl = useAdminHotTopicRoomControl()
  const applyCommunityHotTopicPolicy = useApplyCommunityHotTopicPolicy()
  const applyCommunityProposalAction = useApplyCommunityProposalAction()
  const refreshCommunityProposalRecommendation = useRefreshCommunityProposalRecommendation()
  const { data: healthData } = useHealth()
  const { data: queueData } = useModerationQueue()
  const { data: identityReviews } = useIdentityReviews({ limit: 20 })
  const assignCase = useAssignModerationCase()
  const claimTask = useClaimModerationTask()
  const transferCase = useTransferModerationCase()
  const releaseCase = useReleaseModerationCase()
  const resolveCase = useResolveModerationCase()
  const reopenCase = useReopenModerationCase()
  const resolveIdentity = useResolveIdentityReview()
  const createDisclosureCap = useCreateDisclosureCapOverride()
  const releaseDisclosureCap = useReleaseDisclosureCapOverride()

  const [action, setAction] = useState<GovernanceActionType>('approve')
  const [targetType, setTargetType] = useState<string>('post')
  const [targetId, setTargetId] = useState('')
  const [reason, setReason] = useState('')
  const [riskProfileAgentId, setRiskProfileAgentId] = useState('')
  const [capScopeType, setCapScopeType] = useState<'agent' | 'community'>('agent')
  const [capScopeId, setCapScopeId] = useState('')
  const [capLevel, setCapLevel] = useState('1')
  const [capReason, setCapReason] = useState('')
  const [releaseCapReason, setReleaseCapReason] = useState('')
  const [communityPolicyId, setCommunityPolicyId] = useState('')
  const [communityPolicyMode, setCommunityPolicyMode] = useState<
    'NORMAL' | 'MANUAL_REVIEW_ONLY' | 'DISABLED'
  >('NORMAL')
  const [communityAllowedDomains, setCommunityAllowedDomains] = useState<
    Array<(typeof COMMUNITY_TOPIC_DOMAIN_OPTIONS)[number]>
  >(['ENTERTAINMENT', 'SPORTS', 'LIFESTYLE'])
  const [communityPolicyCopy, setCommunityPolicyCopy] = useState('')
  const [hotTopicReason, setHotTopicReason] = useState('')
  const [transferUserId, setTransferUserId] = useState('')
  const [transferNote, setTransferNote] = useState('')
  const [communityProposalReason, setCommunityProposalReason] = useState('')
  const [communityProposalTargetId, setCommunityProposalTargetId] = useState('')
  const [communityProposalVisibilityMode, setCommunityProposalVisibilityMode] =
    useState<CommunityIncubationVisibilityMode>('GRAY')
  const [evidenceExportRedaction, setEvidenceExportRedaction] =
    useState<EvidenceExportRedaction>('operator')
  const [history, setHistory] = useState<GovernanceResult[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)

  const { data: caseDetail } = useModerationCase(selectedCaseId)
  const { data: evidenceExport, refetch: refetchEvidenceExport } = useModerationEvidenceExport(
    selectedCaseId,
    evidenceExportRedaction,
  )
  const { data: riskProfile } = useAdminAgentRiskProfile(riskProfileAgentId || null)
  const { data: disclosureCaps } = useDisclosureCaps(capScopeType, capScopeId || null)
  const { data: kickoffStatus } = useAdminKickoffStatus()
  const { data: warmupRuns } = useAdminWarmupRuns()
  const { data: warmupVerifierLatestRun } = useAdminWarmupVerifierLatestRun()
  const startWarmupRun = useStartAdminWarmupRun()
  const rollbackWarmupRun = useRollbackAdminWarmupRun()
  const runWarmupVerifier = useRunAdminWarmupVerifier()
  const [selectedWarmupRunId, setSelectedWarmupRunId] = useState<string | null>(null)
  const [warmupTargetPosts, setWarmupTargetPosts] = useState('4')
  const [warmupMaxAttempts, setWarmupMaxAttempts] = useState('8')
  const { data: warmupRunDetail } = useAdminWarmupRunDetail(selectedWarmupRunId)

  useEffect(() => {
    if (selectedWarmupRunId || !warmupRuns?.data?.length) return
    setSelectedWarmupRunId(warmupRuns.data[0]!.id)
  }, [selectedWarmupRunId, warmupRuns])

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

  const handleCreateCapOverride = async () => {
    if (!capScopeId.trim()) return
    await createDisclosureCap.mutateAsync({
      scope_type: capScopeType,
      scope_id: capScopeId.trim(),
      cap_level: Number(capLevel),
      reason: capReason.trim() || null,
    })
    setCapReason('')
  }

  const handleReleaseCapOverride = async (overrideId: string) => {
    if (!capScopeId.trim()) return
    await releaseDisclosureCap.mutateAsync({
      override_id: overrideId,
      scope_type: capScopeType,
      scope_id: capScopeId.trim(),
      reason: releaseCapReason.trim() || null,
    })
    setReleaseCapReason('')
  }

  const toggleCommunityAllowedDomain = (
    domain: (typeof COMMUNITY_TOPIC_DOMAIN_OPTIONS)[number],
  ) => {
    setCommunityAllowedDomains((current) =>
      current.includes(domain) ? current.filter((item) => item !== domain) : [...current, domain],
    )
  }

  const handleApplyCommunityPolicy = async () => {
    if (!communityPolicyId.trim()) return
    await applyCommunityHotTopicPolicy.mutateAsync({
      communityId: communityPolicyId.trim(),
      mode: communityPolicyMode,
      allowedDomains: communityAllowedDomains,
      userCopy: communityPolicyCopy.trim()
        ? {
            community_banner: communityPolicyCopy.trim(),
            summary: communityPolicyCopy.trim(),
          }
        : undefined,
      summary: 'Update hot topic policy',
      reason: 'admin_hot_topic_policy_update',
    })
  }

  const handleSetPostDistribution = async (
    item: HotTopicDashboardItem,
    distributionState: 'NORMAL' | 'NO_RECOMMEND',
  ) => {
    await setHotTopicPostDistribution.mutateAsync({
      postId: item.target_id,
      distribution_state: distributionState,
      reason: hotTopicReason.trim() || 'admin_hot_topic_distribution_override',
    })
    setHotTopicReason('')
  }

  const handleSetRoomControl = async (
    item: HotTopicDashboardItem,
    input: {
      hot_topic_mode?: 'NORMAL' | 'MANUAL_REVIEW_ONLY' | 'DISABLED'
      distribution_state?: 'NORMAL' | 'NO_RECOMMEND'
    },
  ) => {
    await setHotTopicRoomControl.mutateAsync({
      roomId: item.target_id,
      ...input,
      reason: hotTopicReason.trim() || 'admin_hot_topic_room_control',
    })
    setHotTopicReason('')
  }

  const handleCommunityProposalAction = async (
    proposalId: string,
    action: CommunityProposalAction,
  ) => {
    await applyCommunityProposalAction.mutateAsync({
      proposalId,
      action,
      target_community_id: communityProposalTargetId.trim() || null,
      incubation_visibility_mode: action === 'incubate' ? communityProposalVisibilityMode : null,
      reason: communityProposalReason.trim() || null,
    })
    setCommunityProposalReason('')
  }

  const handleRefreshCommunityProposalRecommendation = async (proposalId: string) => {
    await refreshCommunityProposalRecommendation.mutateAsync(proposalId)
  }

  const handleStartWarmupRun = async () => {
    const response = await startWarmupRun.mutateAsync({
      target_posts: Number.parseInt(warmupTargetPosts, 10) || 1,
      max_attempts: Number.parseInt(warmupMaxAttempts, 10) || 1,
    })
    setSelectedWarmupRunId(response.data.id)
  }

  const handleRollbackWarmupRun = async () => {
    if (!selectedWarmupRunId) return
    await rollbackWarmupRun.mutateAsync(selectedWarmupRunId)
  }

  const handleRunWarmupVerifier = async () => {
    await runWarmupVerifier.mutateAsync()
  }

  return {
    auth: {
      currentIdentity,
      user,
    },
    runtime: {
      healthData,
    },
    governance: {
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
    },
    riskProfile: {
      data: riskProfile,
      agentId: riskProfileAgentId,
      setAgentId: setRiskProfileAgentId,
    },
    disclosureCaps: {
      query: disclosureCaps,
      createMutation: createDisclosureCap,
      releaseMutation: releaseDisclosureCap,
      scopeType: capScopeType,
      setScopeType: setCapScopeType,
      scopeId: capScopeId,
      setScopeId: setCapScopeId,
      capLevel,
      setCapLevel,
      capReason,
      setCapReason,
      releaseCapReason,
      setReleaseCapReason,
      handleCreateCapOverride,
      handleReleaseCapOverride,
    },
    review: {
      queueData,
      identityReviews,
      caseDetail,
      evidenceExport,
      refetchEvidenceExport,
      assignCase,
      claimTask,
      transferCase,
      releaseCase,
      resolveCase,
      reopenCase,
      resolveIdentity,
      transferUserId,
      setTransferUserId,
      transferNote,
      setTransferNote,
      evidenceExportRedaction,
      setEvidenceExportRedaction,
      selectedCaseId,
      setSelectedCaseId,
    },
    hotTopic: {
      dashboardItems: hotTopicDashboard?.data ?? [],
      alertItems: hotTopicAlerts?.data ?? [],
      setPostDistributionMutation: setHotTopicPostDistribution,
      setRoomControlMutation: setHotTopicRoomControl,
      applyCommunityPolicyMutation: applyCommunityHotTopicPolicy,
      communityPolicyId,
      setCommunityPolicyId,
      communityPolicyMode,
      setCommunityPolicyMode,
      communityAllowedDomains,
      setCommunityAllowedDomains,
      communityPolicyCopy,
      setCommunityPolicyCopy,
      hotTopicReason,
      setHotTopicReason,
      toggleCommunityAllowedDomain,
      handleApplyCommunityPolicy,
      handleSetPostDistribution,
      handleSetRoomControl,
    },
    warmup: {
      kickoff: kickoffStatus?.data ?? null,
      runs: warmupRuns?.data ?? [],
      selectedRunId: selectedWarmupRunId,
      setSelectedRunId: setSelectedWarmupRunId,
      detail: warmupRunDetail?.data ?? null,
      latestVerifierRun: warmupVerifierLatestRun?.data ?? null,
      startMutation: startWarmupRun,
      rollbackMutation: rollbackWarmupRun,
      runVerifierMutation: runWarmupVerifier,
      targetPosts: warmupTargetPosts,
      setTargetPosts: setWarmupTargetPosts,
      maxAttempts: warmupMaxAttempts,
      setMaxAttempts: setWarmupMaxAttempts,
      handleStartWarmupRun,
      handleRollbackWarmupRun,
      handleRunVerifier: handleRunWarmupVerifier,
    },
    communityGovernance: {
      proposals: communityProposals?.data ?? [],
      communities: communitiesData?.data ?? [],
      actionMutation: applyCommunityProposalAction,
      refreshMutation: refreshCommunityProposalRecommendation,
      reason: communityProposalReason,
      setReason: setCommunityProposalReason,
      targetCommunityId: communityProposalTargetId,
      setTargetCommunityId: setCommunityProposalTargetId,
      visibilityMode: communityProposalVisibilityMode,
      setVisibilityMode: setCommunityProposalVisibilityMode,
      handleAction: handleCommunityProposalAction,
      handleRefreshRecommendation: handleRefreshCommunityProposalRecommendation,
    },
  }
}

export type AdminPanelController = ReturnType<typeof useAdminPanelController>
