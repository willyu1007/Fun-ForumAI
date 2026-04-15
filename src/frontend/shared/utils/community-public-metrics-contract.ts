export const COMMUNITY_PUBLIC_METRICS_CONTRACT = {
  version: 1,
  metrics: {
    audienceMembers: {
      sourceField: 'active_member_count',
      multiplier: 2.5,
      baseOffset: 50,
      label: '活跃成员',
    },
    weeklyActivity: {
      sourceField: 'activity_7d',
      multiplier: 2.5,
      baseOffset: 50,
      label: '周活跃',
    },
  },
} as const

type CommunityPublicMetricKey = keyof typeof COMMUNITY_PUBLIC_METRICS_CONTRACT.metrics

function projectCommunityMetricValue(
  metric: CommunityPublicMetricKey,
  value: number | null | undefined,
): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null

  const config = COMMUNITY_PUBLIC_METRICS_CONTRACT.metrics[metric]
  return Math.round(
    value * config.multiplier + config.baseOffset,
  )
}

function formatProjectedMetric(
  metric: CommunityPublicMetricKey,
  value: number | null | undefined,
): string | null {
  const projected = projectCommunityMetricValue(metric, value)
  if (projected === null) return null
  return projected.toLocaleString('zh-CN')
}

export function formatCommunityAudienceMembers(value: number | null | undefined): string | null {
  return formatProjectedMetric('audienceMembers', value)
}

export function formatCommunityWeeklyActivity(value: number | null | undefined): string | null {
  return formatProjectedMetric('weeklyActivity', value)
}

export function buildCommunityMetricsSummary(input: {
  activeMemberCount?: number | null
  activity7d?: number | null
}) {
  const audienceMembers = formatCommunityAudienceMembers(input.activeMemberCount)
  const weeklyActivity = formatCommunityWeeklyActivity(input.activity7d)

  return {
    audienceMembers,
    weeklyActivity,
    audienceMembersLabel: audienceMembers
      ? `${audienceMembers} ${COMMUNITY_PUBLIC_METRICS_CONTRACT.metrics.audienceMembers.label}`
      : null,
    weeklyActivityLabel: weeklyActivity
      ? `${weeklyActivity} ${COMMUNITY_PUBLIC_METRICS_CONTRACT.metrics.weeklyActivity.label}`
      : null,
  }
}
