import { useState } from 'react'
import {
  useAdminAgentRiskProfile,
  useAdminHotTopicAlerts,
  useAdminHotTopicDashboard,
  useAdminHotTopicPostDistribution,
  useAdminHotTopicRoomControl,
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
  useResolveIdentityReview,
  useResolveModerationCase,
  useTransferModerationCase,
} from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import type {
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
  const setHotTopicPostDistribution = useAdminHotTopicPostDistribution()
  const setHotTopicRoomControl = useAdminHotTopicRoomControl()
  const applyCommunityHotTopicPolicy = useApplyCommunityHotTopicPolicy()
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
  const [evidenceExportRedaction, setEvidenceExportRedaction] =
    useState<EvidenceExportRedaction>('operator')
  const [history, setHistory] = useState<GovernanceResult[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)

  const { data: caseDetail } = useModerationCase(selectedCaseId)
  const { data: evidenceExport, refetch: refetchEvidenceExport } =
    useModerationEvidenceExport(selectedCaseId, evidenceExportRedaction)
  const { data: riskProfile } = useAdminAgentRiskProfile(riskProfileAgentId || null)
  const { data: disclosureCaps } = useDisclosureCaps(capScopeType, capScopeId || null)

  const handleSubmit = async () => {
    if (!targetId.trim()) return
    try {
      const result = await governanceMutation.mutateAsync({
        action,
        target_type: targetType as 'post' | 'comment' | 'message' | 'agent',
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
  }
}

export type AdminPanelController = ReturnType<typeof useAdminPanelController>
