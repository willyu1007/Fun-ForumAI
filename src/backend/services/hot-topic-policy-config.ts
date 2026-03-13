import type { HotTopicDomain } from './hot-topic-policy-service.js'

export type HotTopicMode = 'NORMAL' | 'MANUAL_REVIEW_ONLY' | 'DISABLED'
export type AllowedHotTopicDomain = Exclude<HotTopicDomain, 'GENERAL' | 'SENSITIVE'>

export interface CommunityHotTopicUserCopy {
  summary?: string
  community_banner?: string
  post_notice?: string
  comment_notice?: string
  chat_notice?: string
  safety_notice?: string
}

export interface CommunityHotTopicKeywordOverrides {
  allow: Partial<Record<AllowedHotTopicDomain, string[]>>
  gray: string[]
  deny: string[]
}

export interface CommunityHotTopicSamplingThresholds {
  post_comment_count: number
  room_message_count_hour: number
  report_count_24h: number
}

export interface CommunityHotTopicPolicyV1 {
  mode: HotTopicMode
  allowed_domains: HotTopicDomain[]
  scene_modes: Record<string, HotTopicMode>
  user_copy: CommunityHotTopicUserCopy
  keyword_overrides: CommunityHotTopicKeywordOverrides
  sampling_thresholds: CommunityHotTopicSamplingThresholds
}

const MODE_SEVERITY: Record<HotTopicMode, number> = {
  NORMAL: 0,
  MANUAL_REVIEW_ONLY: 1,
  DISABLED: 2,
}

export const DEFAULT_ALLOWED_HOT_TOPIC_DOMAINS: AllowedHotTopicDomain[] = [
  'ENTERTAINMENT',
  'SPORTS',
  'LIFESTYLE',
]

export const DEFAULT_COMMUNITY_HOT_TOPIC_POLICY_V1: CommunityHotTopicPolicyV1 = {
  mode: 'NORMAL',
  allowed_domains: DEFAULT_ALLOWED_HOT_TOPIC_DOMAINS,
  scene_modes: {},
  user_copy: {},
  keyword_overrides: {
    allow: {},
    gray: [],
    deny: [],
  },
  sampling_thresholds: {
    post_comment_count: 20,
    room_message_count_hour: 20,
    report_count_24h: 3,
  },
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function normalizeMode(value: unknown): HotTopicMode | null {
  if (value === 'NORMAL' || value === 'MANUAL_REVIEW_ONLY' || value === 'DISABLED') {
    return value
  }
  return null
}

function normalizeAllowedDomains(value: unknown): HotTopicDomain[] {
  if (!Array.isArray(value)) return [...DEFAULT_ALLOWED_HOT_TOPIC_DOMAINS]
  const normalized = value.filter((item): item is HotTopicDomain =>
    item === 'ENTERTAINMENT'
    || item === 'SPORTS'
    || item === 'LIFESTYLE'
    || item === 'SENSITIVE'
    || item === 'GENERAL')
  return normalized.length > 0
    ? Array.from(new Set(normalized))
    : [...DEFAULT_ALLOWED_HOT_TOPIC_DOMAINS]
}

function normalizeSceneModes(value: unknown): Record<string, HotTopicMode> {
  const record = toRecord(value)
  if (!record) return {}
  const normalized: Record<string, HotTopicMode> = {}
  for (const [key, mode] of Object.entries(record)) {
    const next = normalizeMode(mode)
    if (!next || !key.trim()) continue
    normalized[key.trim()] = next
  }
  return normalized
}

function normalizeUserCopy(value: unknown): CommunityHotTopicUserCopy {
  const record = toRecord(value)
  if (!record) return {}

  const entries = Object.entries(record).flatMap(([key, copy]) =>
    typeof copy === 'string' && copy.trim().length > 0
      ? [[key, copy.trim()] as const]
      : [])
  return Object.fromEntries(entries) as CommunityHotTopicUserCopy
}

function normalizeKeywordList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(
    value
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim().toLowerCase()),
  ))
}

function normalizeKeywordOverrides(value: unknown): CommunityHotTopicKeywordOverrides {
  const record = toRecord(value)
  if (!record) {
    return {
      allow: {},
      gray: [],
      deny: [],
    }
  }
  const allowRecord = toRecord(record.allow)
  const allow: Partial<Record<AllowedHotTopicDomain, string[]>> = {}
  for (const domain of DEFAULT_ALLOWED_HOT_TOPIC_DOMAINS) {
    const normalized = normalizeKeywordList(allowRecord?.[domain])
    if (normalized.length > 0) {
      allow[domain] = normalized
    }
  }
  return {
    allow,
    gray: normalizeKeywordList(record.gray),
    deny: normalizeKeywordList(record.deny),
  }
}

function normalizeSamplingThreshold(
  value: unknown,
  fallback: number,
): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback
}

function normalizeSamplingThresholds(value: unknown): CommunityHotTopicSamplingThresholds {
  const record = toRecord(value)
  if (!record) {
    return { ...DEFAULT_COMMUNITY_HOT_TOPIC_POLICY_V1.sampling_thresholds }
  }
  return {
    post_comment_count: normalizeSamplingThreshold(
      record.post_comment_count,
      DEFAULT_COMMUNITY_HOT_TOPIC_POLICY_V1.sampling_thresholds.post_comment_count,
    ),
    room_message_count_hour: normalizeSamplingThreshold(
      record.room_message_count_hour,
      DEFAULT_COMMUNITY_HOT_TOPIC_POLICY_V1.sampling_thresholds.room_message_count_hour,
    ),
    report_count_24h: normalizeSamplingThreshold(
      record.report_count_24h,
      DEFAULT_COMMUNITY_HOT_TOPIC_POLICY_V1.sampling_thresholds.report_count_24h,
    ),
  }
}

export function normalizeHotTopicMode(value: unknown, fallback: HotTopicMode = 'NORMAL'): HotTopicMode {
  return normalizeMode(value) ?? fallback
}

export function readCommunityHotTopicPolicyV1(
  rulesJson: Record<string, unknown> | null | undefined,
): CommunityHotTopicPolicyV1 {
  const raw = toRecord(rulesJson?.hot_topic_policy_v1)
  if (!raw) return {
    ...DEFAULT_COMMUNITY_HOT_TOPIC_POLICY_V1,
    allowed_domains: [...DEFAULT_COMMUNITY_HOT_TOPIC_POLICY_V1.allowed_domains],
    scene_modes: {},
    user_copy: {},
    keyword_overrides: {
      allow: {},
      gray: [],
      deny: [],
    },
    sampling_thresholds: {
      ...DEFAULT_COMMUNITY_HOT_TOPIC_POLICY_V1.sampling_thresholds,
    },
  }

  return {
    mode: normalizeHotTopicMode(raw.mode),
    allowed_domains: normalizeAllowedDomains(raw.allowed_domains),
    scene_modes: normalizeSceneModes(raw.scene_modes),
    user_copy: normalizeUserCopy(raw.user_copy),
    keyword_overrides: normalizeKeywordOverrides(raw.keyword_overrides),
    sampling_thresholds: normalizeSamplingThresholds(raw.sampling_thresholds),
  }
}

export function lintHotTopicPolicyV1(value: unknown): string[] {
  if (value === undefined || value === null) return []
  const record = toRecord(value)
  if (!record) return ['hot_topic_policy_v1 must be an object']

  const errors: string[] = []
  if (record.mode !== undefined && !normalizeMode(record.mode)) {
    errors.push('hot_topic_policy_v1.mode must be NORMAL, MANUAL_REVIEW_ONLY, or DISABLED')
  }

  if (record.allowed_domains !== undefined) {
    if (!Array.isArray(record.allowed_domains)) {
      errors.push('hot_topic_policy_v1.allowed_domains must be an array')
    } else if (record.allowed_domains.some((item) =>
      item !== 'ENTERTAINMENT'
      && item !== 'SPORTS'
      && item !== 'LIFESTYLE'
      && item !== 'SENSITIVE'
      && item !== 'GENERAL')) {
      errors.push('hot_topic_policy_v1.allowed_domains contains an unsupported topic domain')
    }
  }

  if (record.scene_modes !== undefined) {
    const sceneModes = toRecord(record.scene_modes)
    if (!sceneModes) {
      errors.push('hot_topic_policy_v1.scene_modes must be an object')
    } else {
      for (const [key, mode] of Object.entries(sceneModes)) {
        if (!key.trim()) {
          errors.push('hot_topic_policy_v1.scene_modes keys must be non-empty strings')
          break
        }
        if (!normalizeMode(mode)) {
          errors.push(`hot_topic_policy_v1.scene_modes.${key} must be NORMAL, MANUAL_REVIEW_ONLY, or DISABLED`)
          break
        }
      }
    }
  }

  if (record.user_copy !== undefined) {
    const userCopy = toRecord(record.user_copy)
    if (!userCopy) {
      errors.push('hot_topic_policy_v1.user_copy must be an object')
    } else {
      const invalidKey = Object.entries(userCopy).find(([, copy]) => typeof copy !== 'string')
      if (invalidKey) {
        errors.push(`hot_topic_policy_v1.user_copy.${invalidKey[0]} must be a string`)
      }
    }
  }

  if (record.keyword_overrides !== undefined) {
    const keywordOverrides = toRecord(record.keyword_overrides)
    if (!keywordOverrides) {
      errors.push('hot_topic_policy_v1.keyword_overrides must be an object')
    } else {
      if (keywordOverrides.allow !== undefined) {
        const allowRecord = toRecord(keywordOverrides.allow)
        if (!allowRecord) {
          errors.push('hot_topic_policy_v1.keyword_overrides.allow must be an object')
        } else {
          const invalidAllowEntry = Object.entries(allowRecord).find(([domain, value]) =>
            !DEFAULT_ALLOWED_HOT_TOPIC_DOMAINS.includes(domain as AllowedHotTopicDomain)
            || !Array.isArray(value)
            || value.some((item) => typeof item !== 'string' || !item.trim()))
          if (invalidAllowEntry) {
            errors.push(`hot_topic_policy_v1.keyword_overrides.allow.${invalidAllowEntry[0]} must be a non-empty string array`)
          }
        }
      }
      if (keywordOverrides.gray !== undefined
        && (!Array.isArray(keywordOverrides.gray)
          || keywordOverrides.gray.some((item) => typeof item !== 'string' || !item.trim()))) {
        errors.push('hot_topic_policy_v1.keyword_overrides.gray must be a non-empty string array')
      }
      if (keywordOverrides.deny !== undefined
        && (!Array.isArray(keywordOverrides.deny)
          || keywordOverrides.deny.some((item) => typeof item !== 'string' || !item.trim()))) {
        errors.push('hot_topic_policy_v1.keyword_overrides.deny must be a non-empty string array')
      }
    }
  }

  if (record.sampling_thresholds !== undefined) {
    const thresholds = toRecord(record.sampling_thresholds)
    if (!thresholds) {
      errors.push('hot_topic_policy_v1.sampling_thresholds must be an object')
    } else {
      for (const key of ['post_comment_count', 'room_message_count_hour', 'report_count_24h'] as const) {
        if (thresholds[key] !== undefined
          && (typeof thresholds[key] !== 'number' || !Number.isFinite(thresholds[key]) || Number(thresholds[key]) < 0)) {
          errors.push(`hot_topic_policy_v1.sampling_thresholds.${key} must be a non-negative number`)
          break
        }
      }
    }
  }

  return errors
}

export function readRoomHotTopicMode(
  directorPolicy: Record<string, unknown> | null | undefined,
): HotTopicMode | null {
  if (!directorPolicy) return null
  return normalizeMode(directorPolicy.hot_topic_mode)
}

export function hasNoRecommendTag(tags: string[] | null | undefined): boolean {
  return (tags ?? []).some((tag) => tag.trim().toLowerCase() === 'no_recommend')
}

export function pickStricterHotTopicMode(modes: HotTopicMode[]): HotTopicMode {
  return modes.reduce<HotTopicMode>((strictest, current) =>
    MODE_SEVERITY[current] > MODE_SEVERITY[strictest] ? current : strictest,
  'NORMAL')
}
