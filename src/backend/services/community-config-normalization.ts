import type {
  CommunityConfigPatch,
  CommunityConfigVersion,
  ConfigRiskLevel,
} from '../repos/index.js'
import { ValidationError } from '../lib/errors.js'

export const LEGACY_STAGE_SPEC_KEYS = [
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

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function normalizeCommunityConfigRecordInternal(
  record: Record<string, unknown>,
  opts?: { rejectMixedStageSpecPatch?: boolean },
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {}
  const legacyStageSpec: Record<string, unknown> = {}
  const rawStageSpecValue = hasOwn(record, 'stage_spec_v1') ? record.stage_spec_v1 : undefined
  const rawStageSpecRecord = toRecord(rawStageSpecValue)

  for (const [key, value] of Object.entries(record)) {
    if (key === 'stage_spec_v1') continue
    if ((LEGACY_STAGE_SPEC_KEYS as readonly string[]).includes(key)) {
      legacyStageSpec[key] = value
      continue
    }
    normalized[key] = value
  }

  if (opts?.rejectMixedStageSpecPatch && rawStageSpecValue !== undefined && Object.keys(legacyStageSpec).length > 0) {
    throw new ValidationError('stage_spec_v1 cannot be combined with top-level stage spec fields in the same patch')
  }

  if (rawStageSpecRecord) {
    normalized.stage_spec_v1 = deepMerge(legacyStageSpec, rawStageSpecRecord) as Record<string, unknown>
  } else if (rawStageSpecValue !== undefined) {
    normalized.stage_spec_v1 = rawStageSpecValue
  } else if (Object.keys(legacyStageSpec).length > 0) {
    normalized.stage_spec_v1 = legacyStageSpec
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
    rejectMixedStageSpecPatch: true,
  })
}

export function inferCommunityConfigRiskLevel(
  normalizedPatch: Record<string, unknown>,
  explicit?: ConfigRiskLevel,
): ConfigRiskLevel {
  if (explicit === 'HIGH') return 'HIGH'
  if (hasOwn(normalizedPatch, 'stage_spec_v1')) return 'HIGH'
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
