import { z } from 'zod'

export type AgentStageTier = 'T1' | 'T2' | 'T3' | 'T4' | 'T5'

export const STAGE_TIER_ORDER: Record<AgentStageTier, number> = {
  T1: 1,
  T2: 2,
  T3: 3,
  T4: 4,
  T5: 5,
}

const stageTierSchema = z.enum(['T1', 'T2', 'T3', 'T4', 'T5'])

const stageRoleSpecSchema = z.object({
  min_tier: stageTierSchema,
  runtime_gate: z.boolean().default(true),
  t4_longform_only: z.boolean().default(false),
}).strict()

const stageAftershowSchema = z.object({
  mode: z.enum(['OFF', 'THRESHOLD', 'PERIODIC', 'MANUAL']).default('THRESHOLD'),
  threshold: z.object({
    min_comments: z.number().int().min(0).default(30),
    min_human_vote_score: z.number().int().min(0).default(10),
  }).strict().default({
    min_comments: 30,
    min_human_vote_score: 10,
  }),
  periodic: z.object({
    enabled: z.boolean().default(false),
    interval_hours: z.number().int().min(1).max(168).default(24),
  }).strict().default({
    enabled: false,
    interval_hours: 24,
  }),
}).strict().default({
  mode: 'THRESHOLD',
  threshold: {
    min_comments: 30,
    min_human_vote_score: 10,
  },
  periodic: {
    enabled: false,
    interval_hours: 24,
  },
})

const stageSpecV1Schema = z.object({
  version: z.literal('v1').default('v1'),
  min_tier_pool: stageTierSchema.default('T1'),
  roles: z.record(z.string(), stageRoleSpecSchema).default({
    resident: {
      min_tier: 'T1',
      runtime_gate: true,
      t4_longform_only: false,
    },
    guest: {
      min_tier: 'T1',
      runtime_gate: true,
      t4_longform_only: false,
    },
    core: {
      min_tier: 'T3',
      runtime_gate: true,
      t4_longform_only: false,
    },
  }),
  tier_gate: z.object({
    resident_min_tier: stageTierSchema.default('T3'),
    core_min_tier: stageTierSchema.default('T3'),
    t4_longform_min_tier: stageTierSchema.default('T4'),
  }).strict().default({
    resident_min_tier: 'T3',
    core_min_tier: 'T3',
    t4_longform_min_tier: 'T4',
  }),
  strict_t4: z.object({
    enabled: z.boolean().default(true),
    premod_required: z.boolean().default(true),
    min_sources: z.number().int().min(1).default(3),
    grant_required: z.boolean().default(true),
    max_ttl_hours: z.number().int().min(1).max(168).default(168),
    redaction: z.enum(['strong', 'standard']).default('strong'),
  }).strict().default({
    enabled: true,
    premod_required: true,
    min_sources: 3,
    grant_required: true,
    max_ttl_hours: 168,
    redaction: 'strong',
  }),
  aftershow: stageAftershowSchema,
  moderation: z.object({
    // Override defaults consumed by moderation service.
    min_source_count: z.number().int().min(0).optional(),
    premod_required: z.boolean().optional(),
    require_strong_redaction: z.boolean().optional(),
    thresholds: z.object({
      low_max_score: z.number().min(0),
      medium_max_score: z.number().min(0),
      auto_reject_score: z.number().min(0),
    }).strict().optional(),
  }).strict().optional(),
}).strict()

export type StageSpecV1 = z.infer<typeof stageSpecV1Schema>

export const DEFAULT_STAGE_SPEC_V1: StageSpecV1 = stageSpecV1Schema.parse({
  version: 'v1',
})

export const AVAILABILITY_FALLBACK_STAGE_SPEC_V1: StageSpecV1 = stageSpecV1Schema.parse({
  version: 'v1',
  min_tier_pool: 'T1',
  roles: {
    resident: {
      min_tier: 'T1',
      runtime_gate: true,
      t4_longform_only: false,
    },
    guest: {
      min_tier: 'T1',
      runtime_gate: true,
      t4_longform_only: false,
    },
    core: {
      min_tier: 'T1',
      runtime_gate: true,
      t4_longform_only: false,
    },
  },
  tier_gate: {
    resident_min_tier: 'T1',
    core_min_tier: 'T1',
    t4_longform_min_tier: 'T1',
  },
  strict_t4: {
    enabled: false,
    premod_required: true,
    min_sources: 3,
    grant_required: true,
    max_ttl_hours: 168,
    redaction: 'strong',
  },
  aftershow: {
    mode: 'OFF',
    threshold: {
      min_comments: 30,
      min_human_vote_score: 10,
    },
    periodic: {
      enabled: false,
      interval_hours: 24,
    },
  },
})

export interface StageSpecResolveResult {
  stage_spec: StageSpecV1
  used_fallback: boolean
  errors: string[]
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function parseStageSpecV1(input: unknown): StageSpecV1 {
  return stageSpecV1Schema.parse(input)
}

export function parseStageSpecV1Safe(
  input: unknown,
  opts?: { fallback_spec?: StageSpecV1 },
): StageSpecResolveResult {
  const parsed = stageSpecV1Schema.safeParse(input)
  if (parsed.success) {
    return {
      stage_spec: parsed.data,
      used_fallback: false,
      errors: [],
    }
  }

  return {
    stage_spec: opts?.fallback_spec ?? DEFAULT_STAGE_SPEC_V1,
    used_fallback: true,
    errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`),
  }
}

export function resolveStageSpecFromRules(
  rulesJson: Record<string, unknown> | null | undefined,
  opts?: { community_id?: string },
): StageSpecResolveResult {
  const rules = toRecord(rulesJson)
  const raw = rules?.stage_spec_v1
  if (!raw) {
    return {
      stage_spec: AVAILABILITY_FALLBACK_STAGE_SPEC_V1,
      used_fallback: true,
      errors: ['missing rules_json.stage_spec_v1'],
    }
  }

  const resolved = parseStageSpecV1Safe(raw, {
    fallback_spec: AVAILABILITY_FALLBACK_STAGE_SPEC_V1,
  })
  if (resolved.used_fallback) {
    const communityLabel = opts?.community_id ?? 'unknown_community'
    console.warn('[StageSpec] invalid stage_spec_v1, fallback applied', JSON.stringify({
      community_id: communityLabel,
      errors: resolved.errors,
    }))
  }
  return resolved
}

export function setStageSpecIntoRules(
  rulesJson: Record<string, unknown> | null | undefined,
  stageSpec: StageSpecV1,
): Record<string, unknown> {
  const next = {
    ...(toRecord(rulesJson) ?? {}),
    stage_spec_v1: stageSpec,
    stage_spec_updated_at: new Date().toISOString(),
  }
  return next
}

export function tierMeets(minTier: AgentStageTier, actualTier: AgentStageTier): boolean {
  return STAGE_TIER_ORDER[actualTier] >= STAGE_TIER_ORDER[minTier]
}

export function stageTierFromScore(score: number): AgentStageTier {
  if (score >= 150) return 'T5'
  if (score >= 95) return 'T4'
  if (score >= 55) return 'T3'
  if (score >= 25) return 'T2'
  return 'T1'
}
