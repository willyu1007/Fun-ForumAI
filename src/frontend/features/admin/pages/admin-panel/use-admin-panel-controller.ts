import { useEffect, useState } from 'react'
import {
  useApplyAdminWarmupSuiteEdit,
  useAdminAgentRiskProfile,
  useAdminCommunityProposals,
  useAdminHotTopicAlerts,
  useAdminHotTopicDashboard,
  useAdminHotTopicPostDistribution,
  useAdminHotTopicRoomControl,
  useAdminWarmupSuiteDetail,
  useAdminWarmupSuites,
  useAdminWarmupVerifierLatestRun,
  useApplyCommunityProposalAction,
  useApplyCommunityHotTopicPolicy,
  useArchiveAdminWarmupSuite,
  useAssignModerationCase,
  useClaimModerationTask,
  useCreateAdminWarmupSuite,
  useCreateDisclosureCapOverride,
  useDisclosureCaps,
  useExecuteAdminWarmupGovernanceBatch,
  useGovernanceAction,
  useHealth,
  useIdentityReviews,
  useModerationCase,
  useModerationEvidenceExport,
  useModerationQueue,
  usePreviewAdminWarmupGovernanceBatch,
  usePreviewAdminWarmupSuiteEdit,
  useRebuildAdminWarmupSuite,
  useReleaseDisclosureCapOverride,
  useReleaseModerationCase,
  useReopenModerationCase,
  useReviewAdminWarmupSuite,
  useRunAdminWarmupVerifier,
  useRetryAdminWarmupSuite,
  useResolveIdentityReview,
  useResolveModerationCase,
  useRefreshCommunityProposalRecommendation,
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
  KickoffSuiteEditAction,
  WarmupGovernanceAction,
  WarmupReviewDecision,
  WarmupReviewReasonCode,
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
  const { data: evidenceExport, refetch: refetchEvidenceExport } =
    useModerationEvidenceExport(selectedCaseId, evidenceExportRedaction)
  const { data: riskProfile } = useAdminAgentRiskProfile(riskProfileAgentId || null)
  const { data: disclosureCaps } = useDisclosureCaps(capScopeType, capScopeId || null)
  const { data: warmupSuites } = useAdminWarmupSuites()
  const { data: warmupVerifierLatestRun } = useAdminWarmupVerifierLatestRun()
  const createWarmupSuite = useCreateAdminWarmupSuite()
  const reviewWarmupSuite = useReviewAdminWarmupSuite()
  const retryWarmupSuite = useRetryAdminWarmupSuite()
  const rebuildWarmupSuite = useRebuildAdminWarmupSuite()
  const archiveWarmupSuite = useArchiveAdminWarmupSuite()
  const runWarmupVerifier = useRunAdminWarmupVerifier()
  const previewWarmupGovernance = usePreviewAdminWarmupGovernanceBatch()
  const executeWarmupGovernance = useExecuteAdminWarmupGovernanceBatch()
  const previewWarmupSuiteEdit = usePreviewAdminWarmupSuiteEdit()
  const applyWarmupSuiteEdit = useApplyAdminWarmupSuiteEdit()
  const [selectedWarmupSuiteId, setSelectedWarmupSuiteId] = useState<string | null>(null)
  const [warmupSuiteLabel, setWarmupSuiteLabel] = useState('')
  const [warmupTopupPosts, setWarmupTopupPosts] = useState('0')
  const [warmupReviewDecision, setWarmupReviewDecision] =
    useState<WarmupReviewDecision>('pass_to_active')
  const [warmupReviewNote, setWarmupReviewNote] = useState('')
  const [warmupReviewReasons, setWarmupReviewReasons] = useState<WarmupReviewReasonCode[]>([])
  const [warmupGovernanceAction, setWarmupGovernanceAction] =
    useState<WarmupGovernanceAction>('quarantine')
  const [warmupEditAction, setWarmupEditAction] =
    useState<KickoffSuiteEditAction>('rewrite_post')
  const [warmupEditReason, setWarmupEditReason] = useState('local kickoff repair')
  const [warmupEditPostId, setWarmupEditPostId] = useState('')
  const [warmupEditThreadId, setWarmupEditThreadId] = useState('')
  const [warmupEditTurnId, setWarmupEditTurnId] = useState('')
  const [warmupEditPayload, setWarmupEditPayload] = useState('{\n  "body": ""\n}')
  const { data: warmupSuiteDetail } = useAdminWarmupSuiteDetail(selectedWarmupSuiteId)

  useEffect(() => {
    if (selectedWarmupSuiteId || !(warmupSuites?.data?.length)) return
    setSelectedWarmupSuiteId(warmupSuites.data[0]!.id)
  }, [selectedWarmupSuiteId, warmupSuites])

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
      current.includes(domain)
        ? current.filter((item) => item !== domain)
        : [...current, domain],
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

  const toggleWarmupReason = (reasonCode: WarmupReviewReasonCode) => {
    setWarmupReviewReasons((current) =>
      current.includes(reasonCode)
        ? current.filter((item) => item !== reasonCode)
        : [...current, reasonCode],
    )
  }

  const handleCreateWarmupSuite = async () => {
    const response = await createWarmupSuite.mutateAsync({
      suite_label: warmupSuiteLabel.trim() || null,
      max_runtime_topup_posts: Number.parseInt(warmupTopupPosts, 10) || 0,
    })
    setSelectedWarmupSuiteId(response.data.suite_id)
  }

  const handleReviewWarmupSuite = async (confirmActivation = false) => {
    if (!selectedWarmupSuiteId) return
    await reviewWarmupSuite.mutateAsync({
      suiteId: selectedWarmupSuiteId,
      decision: warmupReviewDecision,
      reason_codes:
        warmupReviewDecision === 'not_passed' ? warmupReviewReasons : [],
      note: warmupReviewNote.trim() || null,
      confirm_activation: confirmActivation,
    })
  }

  const handleRetryWarmupSuite = async () => {
    if (!selectedWarmupSuiteId) return
    await retryWarmupSuite.mutateAsync(selectedWarmupSuiteId)
  }

  const handleRebuildWarmupSuite = async () => {
    if (!selectedWarmupSuiteId) return
    await rebuildWarmupSuite.mutateAsync({
      suiteId: selectedWarmupSuiteId,
      max_runtime_topup_posts: Number.parseInt(warmupTopupPosts, 10) || 0,
    })
  }

  const handleArchiveWarmupSuite = async () => {
    if (!selectedWarmupSuiteId) return
    await archiveWarmupSuite.mutateAsync(selectedWarmupSuiteId)
  }

  const handlePreviewWarmupGovernance = async () => {
    if (!selectedWarmupSuiteId) return
    await previewWarmupGovernance.mutateAsync({
      action: warmupGovernanceAction,
      suite_id: selectedWarmupSuiteId,
    })
  }

  const handleExecuteWarmupGovernance = async () => {
    if (!selectedWarmupSuiteId) return
    await executeWarmupGovernance.mutateAsync({
      action: warmupGovernanceAction,
      suite_id: selectedWarmupSuiteId,
    })
  }

  const handlePreviewWarmupEdit = async () => {
    if (!selectedWarmupSuiteId) return
    await previewWarmupSuiteEdit.mutateAsync(buildWarmupEditRequest({
      suiteId: selectedWarmupSuiteId,
      action: warmupEditAction,
      reason: warmupEditReason,
      postId: warmupEditPostId,
      threadId: warmupEditThreadId,
      turnId: warmupEditTurnId,
      payloadText: warmupEditPayload,
    }))
  }

  const handleApplyWarmupEdit = async () => {
    if (!selectedWarmupSuiteId) return
    await applyWarmupSuiteEdit.mutateAsync(buildWarmupEditRequest({
      suiteId: selectedWarmupSuiteId,
      action: warmupEditAction,
      reason: warmupEditReason,
      postId: warmupEditPostId,
      threadId: warmupEditThreadId,
      turnId: warmupEditTurnId,
      payloadText: warmupEditPayload,
    }))
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
      suites: warmupSuites?.data ?? [],
      selectedSuiteId: selectedWarmupSuiteId,
      setSelectedSuiteId: setSelectedWarmupSuiteId,
      detail: warmupSuiteDetail?.data ?? null,
      latestVerifierRun: warmupVerifierLatestRun?.data ?? null,
      createMutation: createWarmupSuite,
      reviewMutation: reviewWarmupSuite,
      retryMutation: retryWarmupSuite,
      rebuildMutation: rebuildWarmupSuite,
      archiveMutation: archiveWarmupSuite,
      runVerifierMutation: runWarmupVerifier,
      previewMutation: previewWarmupGovernance,
      executeMutation: executeWarmupGovernance,
      previewEditMutation: previewWarmupSuiteEdit,
      applyEditMutation: applyWarmupSuiteEdit,
      suiteLabel: warmupSuiteLabel,
      setSuiteLabel: setWarmupSuiteLabel,
      topupPosts: warmupTopupPosts,
      setTopupPosts: setWarmupTopupPosts,
      reviewDecision: warmupReviewDecision,
      setReviewDecision: setWarmupReviewDecision,
      reviewNote: warmupReviewNote,
      setReviewNote: setWarmupReviewNote,
      reviewReasons: warmupReviewReasons,
      toggleReason: toggleWarmupReason,
      governanceAction: warmupGovernanceAction,
      setGovernanceAction: setWarmupGovernanceAction,
      governancePreview: previewWarmupGovernance.data?.data ?? null,
      editAction: warmupEditAction,
      setEditAction: setWarmupEditAction,
      editReason: warmupEditReason,
      setEditReason: setWarmupEditReason,
      editPostId: warmupEditPostId,
      setEditPostId: setWarmupEditPostId,
      editThreadId: warmupEditThreadId,
      setEditThreadId: setWarmupEditThreadId,
      editTurnId: warmupEditTurnId,
      setEditTurnId: setWarmupEditTurnId,
      editPayload: warmupEditPayload,
      setEditPayload: setWarmupEditPayload,
      editPreview: previewWarmupSuiteEdit.data?.data ?? null,
      latestEditResult: applyWarmupSuiteEdit.data?.data ?? null,
      handleCreateSuite: handleCreateWarmupSuite,
      handleReviewSuite: handleReviewWarmupSuite,
      handleRetrySuite: handleRetryWarmupSuite,
      handleRebuildSuite: handleRebuildWarmupSuite,
      handleArchiveSuite: handleArchiveWarmupSuite,
      handlePreviewGovernance: handlePreviewWarmupGovernance,
      handleExecuteGovernance: handleExecuteWarmupGovernance,
      handlePreviewEdit: handlePreviewWarmupEdit,
      handleApplyEdit: handleApplyWarmupEdit,
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

function buildWarmupEditRequest(input: {
  suiteId: string
  action: KickoffSuiteEditAction
  reason: string
  postId: string
  threadId: string
  turnId: string
  payloadText: string
}) {
  const payload = parsePayloadText(input.payloadText)
  return {
    action: input.action,
    target: {
      suite_id: input.suiteId,
      post_id: input.postId.trim() || null,
      thread_id: input.threadId.trim() || null,
      turn_id: input.turnId.trim() || null,
    },
    payload,
    reason: input.reason.trim() || 'local kickoff repair',
  }
}

function parsePayloadText(payloadText: string): Record<string, unknown> {
  if (!payloadText.trim()) return {}
  const parsed = JSON.parse(payloadText) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('编辑 payload 必须是 JSON object')
  }
  return parsed as Record<string, unknown>
}

export type AdminPanelController = ReturnType<typeof useAdminPanelController>
