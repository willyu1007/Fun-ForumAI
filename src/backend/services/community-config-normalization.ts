import type {
  CommunityConfigPatch,
  CommunityConfigVersion,
  ConfigRiskLevel,
} from '../repos/index.js'
import { ValidationError } from '../lib/errors.js'

export const REJECTED_TOP_LEVEL_STAGE_SPEC_KEYS = [
  'version',
  'min_tier_pool',
  'roles',
  'tier_gate',
  'strict_t4',
  'aftershow',
  'allocator',
  'human_participation',
  'incubation',
  'moderation',
] as const

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

export function deepMerge(base: unknown, patch: unknown): unknown {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch
  if (!base || typeof base !== 'object' || Array.isArray(base)) return patch
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    const existing = out[key]
    if (
      value
      && typeof value === 'object'
      && !Array.isArray(value)
      && existing
      && typeof existing === 'object'
      && !Array.isArray(existing)
    ) {
      out[key] = deepMerge(existing, value)
    } else {
      out[key] = value
    }
  }
  return out
}

function normalizeCommunityConfigRecordInternal(
  record: Record<string, unknown>,
  opts?: { rejectTopLevelStageSpecPatch?: boolean },
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {}
  const rejectedTopLevelKeys: string[] = []

  for (const [key, value] of Object.entries(record)) {
    if ((REJECTED_TOP_LEVEL_STAGE_SPEC_KEYS as readonly string[]).includes(key)) {
      rejectedTopLevelKeys.push(key)
      continue
    }
    normalized[key] = value
  }

  if (opts?.rejectTopLevelStageSpecPatch && rejectedTopLevelKeys.length > 0) {
    throw new ValidationError('top-level stage spec fields are no longer accepted; nest them under stage_spec_v1')
  }

  return normalized
}

export function normalizeCommunityConfigRules(
  rules: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return normalizeCommunityConfigRecordInternal(rules ?? {})
}

export function normalizeIncomingCommunityConfigPatch(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return normalizeCommunityConfigRecordInternal(patch, {
    rejectTopLevelStageSpecPatch: true,
  })
}

export function inferCommunityConfigRiskLevel(
  normalizedPatch: Record<string, unknown>,
  explicit?: ConfigRiskLevel,
): ConfigRiskLevel {
  if (explicit === 'HIGH') return 'HIGH'
  if (hasOwn(normalizedPatch, 'stage_spec_v1')) return 'HIGH'
  if (hasOwn(normalizedPatch, 'hot_topic_policy_v1')) return 'HIGH'
  if (hasOwn(normalizedPatch, 'notifications')) return 'HIGH'
  return 'LOW'
}

export function normalizeCommunityConfigPatchRecord(
  patch: CommunityConfigPatch,
): CommunityConfigPatch {
  const normalizedPatchJson = normalizeCommunityConfigRules(patch.patch_json)
  return {
    ...patch,
    patch_json: normalizedPatchJson,
    proposed_rules_json: patch.proposed_rules_json
      ? normalizeCommunityConfigRules(patch.proposed_rules_json)
      : null,
    risk_level: inferCommunityConfigRiskLevel(normalizedPatchJson, patch.risk_level),
  }
}

export function normalizeCommunityConfigVersionRecord(
  version: CommunityConfigVersion,
): CommunityConfigVersion {
  return {
    ...version,
    rules_json: normalizeCommunityConfigRules(version.rules_json),
  }
}
