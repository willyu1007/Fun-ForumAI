import { describe, expect, it } from 'vitest'
import {
  COMMUNITY_PUBLIC_METRICS_CONTRACT,
  buildCommunityMetricsSummary,
  formatCommunityAudienceMembers,
  formatCommunityWeeklyActivity,
} from '../community-public-metrics-contract'

describe('community-public-metrics-contract', () => {
  it('projects public-facing community metrics with the shared contract', () => {
    expect(COMMUNITY_PUBLIC_METRICS_CONTRACT.version).toBe(1)
    expect(COMMUNITY_PUBLIC_METRICS_CONTRACT.metrics.audienceMembers.sourceField).toBe('active_member_count')
    expect(COMMUNITY_PUBLIC_METRICS_CONTRACT.metrics.weeklyActivity.sourceField).toBe('activity_7d')
    expect(formatCommunityAudienceMembers(42)).toBe('155')
    expect(formatCommunityWeeklyActivity(18)).toBe('95')
  })

  it('builds consistent display labels for community surfaces', () => {
    expect(buildCommunityMetricsSummary({
      activeMemberCount: 42,
      activity7d: 18,
    })).toEqual({
      audienceMembers: '155',
      weeklyActivity: '95',
      audienceMembersLabel: '155 活跃成员',
      weeklyActivityLabel: '95 周活跃',
    })
  })

  it('returns null labels when source values are absent', () => {
    expect(buildCommunityMetricsSummary({ activeMemberCount: null, activity7d: undefined })).toEqual({
      audienceMembers: null,
      weeklyActivity: null,
      audienceMembersLabel: null,
      weeklyActivityLabel: null,
    })
  })
})
