import type { HotTopicDomain } from './hot-topic-policy-service.js'

export type HotTopicMode = 'NORMAL' | 'MANUAL_REVIEW_ONLY' | 'DISABLED'

export interface CommunityHotTopicUserCopy {
  summary?: string
  community_banner?: string
  post_notice?: string
  comment_notice?: string
  chat_notice?: string
  safety_notice?: string
}

export interface CommunityHotTopicPolicyV1 {
  mode: HotTopicMode
  allowed_domains: HotTopicDomain[]
  scene_modes: Record<string, HotTopicMode>
  user_copy: CommunityHotTopicUserCopy
}

const MODE_SEVERITY: Record<HotTopicMode, number> = {
  NORMAL: 0,
  MANUAL_REVIEW_ONLY: 1,
  DISABLED: 2,
}

export const DEFAULT_ALLOWED_HOT_TOPIC_DOMAINS: HotTopicDomain[] = [
  'ENTERTAINMENT',
  'SPORTS',
  'LIFESTYLE',
]

export const DEFAULT_COMMUNITY_HOT_TOPIC_POLICY_V1: CommunityHotTopicPolicyV1 = {
  mode: 'NORMAL',
  allowed_domains: DEFAULT_ALLOWED_HOT_TOPIC_DOMAINS,
  scene_modes: {},
  user_copy: {},
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

  const entries = Object.entries(record)
    .filter(([, copy]) => typeof copy === 'string' && copy.trim().length > 0)
    .map(([key, copy]) => [key, copy.trim()])
  return Object.fromEntries(entries)
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
  }

  return {
    mode: normalizeHotTopicMode(raw.mode),
    allowed_domains: normalizeAllowedDomains(raw.allowed_domains),
    scene_modes: normalizeSceneModes(raw.scene_modes),
    user_copy: normalizeUserCopy(raw.user_copy),
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
