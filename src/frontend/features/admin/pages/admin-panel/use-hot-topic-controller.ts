import { useState } from 'react'
import {
  useAdminHotTopicAlerts,
  useAdminHotTopicDashboard,
  useAdminHotTopicPostDistribution,
  useAdminHotTopicRoomControl,
  useApplyCommunityHotTopicPolicy,
} from '@/api/hooks'
import type { HotTopicDashboardItem } from '@/api/types'
import { COMMUNITY_TOPIC_DOMAIN_OPTIONS } from './constants'

export function useHotTopicController() {
  const { data: hotTopicDashboard } = useAdminHotTopicDashboard()
  const { data: hotTopicAlerts } = useAdminHotTopicAlerts()
  const setPostDistributionMutation = useAdminHotTopicPostDistribution()
  const setRoomControlMutation = useAdminHotTopicRoomControl()
  const applyCommunityPolicyMutation = useApplyCommunityHotTopicPolicy()

  const [communityPolicyId, setCommunityPolicyId] = useState('')
  const [communityPolicyMode, setCommunityPolicyMode] = useState<
    'NORMAL' | 'MANUAL_REVIEW_ONLY' | 'DISABLED'
  >('NORMAL')
  const [communityAllowedDomains, setCommunityAllowedDomains] = useState<
    Array<(typeof COMMUNITY_TOPIC_DOMAIN_OPTIONS)[number]>
  >(['ENTERTAINMENT', 'SPORTS', 'LIFESTYLE'])
  const [communityPolicyCopy, setCommunityPolicyCopy] = useState('')
  const [hotTopicReason, setHotTopicReason] = useState('')

  const toggleCommunityAllowedDomain = (
    domain: (typeof COMMUNITY_TOPIC_DOMAIN_OPTIONS)[number],
  ) => {
    setCommunityAllowedDomains((current) =>
      current.includes(domain) ? current.filter((item) => item !== domain) : [...current, domain],
    )
  }

  const handleApplyCommunityPolicy = async () => {
    if (!communityPolicyId.trim()) return
    await applyCommunityPolicyMutation.mutateAsync({
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
    await setPostDistributionMutation.mutateAsync({
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
    await setRoomControlMutation.mutateAsync({
      roomId: item.target_id,
      ...input,
      reason: hotTopicReason.trim() || 'admin_hot_topic_room_control',
    })
    setHotTopicReason('')
  }

  return {
    dashboardItems: hotTopicDashboard?.data ?? [],
    alertItems: hotTopicAlerts?.data ?? [],
    setPostDistributionMutation,
    setRoomControlMutation,
    applyCommunityPolicyMutation,
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
  }
}
