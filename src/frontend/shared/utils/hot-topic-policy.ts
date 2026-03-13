import type { RoomProgramView } from '@/api/types'

export type HotTopicMode = 'NORMAL' | 'MANUAL_REVIEW_ONLY' | 'DISABLED'
export type HotTopicDomain =
  | 'ENTERTAINMENT'
  | 'SPORTS'
  | 'LIFESTYLE'
  | 'SENSITIVE'
  | 'GENERAL'

export interface CommunityHotTopicPolicyView {
  mode: HotTopicMode
  allowedDomains: HotTopicDomain[]
  blockedDomains: HotTopicDomain[]
  sceneModes: Record<string, HotTopicMode>
  userCopy: Record<string, string>
}

export interface TopicSignalsView {
  hotTopicFlag: boolean
  topicDomain: HotTopicDomain | null
  topicConfidence: number | null
  driftDetected: boolean
  driftRiskScore: number | null
  distributionState: string
  enforcementReason: string | null
}

const ALL_DOMAINS: HotTopicDomain[] = [
  'ENTERTAINMENT',
  'SPORTS',
  'LIFESTYLE',
  'SENSITIVE',
]
const DEFAULT_ALLOWED_DOMAINS: HotTopicDomain[] = ['ENTERTAINMENT', 'SPORTS', 'LIFESTYLE']

export const HOT_TOPIC_DOMAIN_LABELS: Record<HotTopicDomain, string> = {
  ENTERTAINMENT: '娱乐',
  SPORTS: '体育',
  LIFESTYLE: '生活方式',
  SENSITIVE: '敏感公共议题',
  GENERAL: '普通话题',
}

export const HOT_TOPIC_MODE_LABELS: Record<HotTopicMode, string> = {
  NORMAL: '正常放行',
  MANUAL_REVIEW_ONLY: '灰度复核',
  DISABLED: '禁用热点',
}

export const HOT_TOPIC_DISTRIBUTION_LABELS: Record<string, string> = {
  NORMAL: '正常分发',
  NO_RECOMMEND: '可直达，不参与推荐',
  BLOCKED: '已拦截',
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function toMode(value: unknown, fallback: HotTopicMode = 'NORMAL'): HotTopicMode {
  return value === 'NORMAL' || value === 'MANUAL_REVIEW_ONLY' || value === 'DISABLED'
    ? value
    : fallback
}

function isHotTopicDomain(value: string): value is HotTopicDomain {
  return value === 'ENTERTAINMENT'
    || value === 'SPORTS'
    || value === 'LIFESTYLE'
    || value === 'SENSITIVE'
    || value === 'GENERAL'
}

export function readCommunityHotTopicPolicy(
  rulesJson: Record<string, unknown> | null | undefined,
): CommunityHotTopicPolicyView | null {
  const policy = toRecord(rulesJson?.hot_topic_policy_v1)
  if (!policy) return null

  const allowedDomains = toStringArray(policy.allowed_domains)
    .filter(isHotTopicDomain)
  const effectiveAllowedDomains = allowedDomains.length > 0
    ? Array.from(new Set<HotTopicDomain>(allowedDomains))
    : DEFAULT_ALLOWED_DOMAINS
  const sceneModesRecord = toRecord(policy.scene_modes)
  const sceneModes = Object.fromEntries(
    Object.entries(sceneModesRecord ?? {})
      .filter(([key, value]) => key.trim().length > 0 && (value === 'NORMAL' || value === 'MANUAL_REVIEW_ONLY' || value === 'DISABLED'))
      .map(([key, value]) => [key, value as HotTopicMode]),
  )
  const userCopy: Record<string, string> = Object.fromEntries(
    Object.entries(toRecord(policy.user_copy) ?? {})
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0)
      .map(([key, copy]) => [key, copy.trim()] as const),
  )

  return {
    mode: toMode(policy.mode),
    allowedDomains: effectiveAllowedDomains,
    blockedDomains: ALL_DOMAINS.filter((domain) => !effectiveAllowedDomains.includes(domain)),
    sceneModes,
    userCopy,
  }
}

export function readTopicSignals(value: Record<string, unknown> | null | undefined): TopicSignalsView | null {
  const record = toRecord(value)
  if (!record) return null
  if (record.policy_shadowed === true) return null
  return {
    hotTopicFlag: record.hot_topic_flag === true,
    topicDomain: (
      record.topic_domain === 'ENTERTAINMENT'
      || record.topic_domain === 'SPORTS'
      || record.topic_domain === 'LIFESTYLE'
      || record.topic_domain === 'SENSITIVE'
      || record.topic_domain === 'GENERAL'
    )
      ? record.topic_domain
      : null,
    topicConfidence: typeof record.topic_confidence === 'number' ? record.topic_confidence : null,
    driftDetected: record.drift_detected === true,
    driftRiskScore: typeof record.drift_risk_score === 'number' ? record.drift_risk_score : null,
    distributionState: typeof record.distribution_state === 'string' ? record.distribution_state : 'NORMAL',
    enforcementReason: typeof record.enforcement_reason === 'string' ? record.enforcement_reason : null,
  }
}

export function readRoomHotTopicMode(program: RoomProgramView | null | undefined): HotTopicMode {
  return toMode(program?.director_policy?.hot_topic_mode)
}

export function hasNoRecommendRoomTag(tags: string[] | null | undefined): boolean {
  return (tags ?? []).some((tag) => tag.trim().toLowerCase() === 'no_recommend')
}

export function describeTopicSignals(
  topicSignals: TopicSignalsView | null,
  distributionState?: string | null,
): string | null {
  const effectiveDistributionState = distributionState ?? topicSignals?.distributionState ?? 'NORMAL'
  if (!topicSignals?.hotTopicFlag && effectiveDistributionState === 'NORMAL') {
    return null
  }

  if (effectiveDistributionState === 'NO_RECOMMEND') {
    if (topicSignals?.driftDetected) {
      return '热点漂移命中，当前内容保留直达访问，但不会进入推荐流。'
    }
    return '当前内容保留直达访问，但因热点置信度不足或需要人工复核，不会进入推荐流。'
  }

  if (effectiveDistributionState === 'BLOCKED') {
    return '当前内容命中热点限制，不会进入公开分发。'
  }

  if (topicSignals?.hotTopicFlag && topicSignals.topicDomain) {
    return `当前识别为${HOT_TOPIC_DOMAIN_LABELS[topicSignals.topicDomain]}热点。`
  }

  return null
}
