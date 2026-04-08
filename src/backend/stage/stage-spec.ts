import { z } from 'zod'
import { richCommunitiesMetrics } from '../lib/rich-communities-metrics.js'
import {
  AGENT_HUMAN_RESPONSE_MODE_IDS,
  AUDIENCE_SIGNAL_INGESTION_IDS,
  PUBLIC_PARTICIPATION_MODE_IDS,
  resolveCommunityInteractionContract,
  type CommunityInteractionContract,
} from '../../shared/semantic-taxonomy.js'
import {
  ORCHESTRATION_PROFILE_IDS,
  REACTIVE_RECALL_DECAY_IDS,
} from '../../shared/forum-orchestration.js'

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
}).strict()

const stageAllocatorSchema = z.object({
  community_max_agents: z.number().int().min(1).max(64).default(20),
  thread_max_agents: z.number().int().min(1).max(256).default(20),
  cooldown_seconds: z.number().int().min(0).max(3600).default(60),
  max_actions_per_hour: z.number().int().min(1).max(1000).default(30),
  max_tokens_per_day: z.number().int().min(100).max(10_000_000).default(100_000),
  event_base_quota: z.object({
    NewPostCreated: z.number().int().min(0).max(64).default(5),
    ThreadOpened: z.number().int().min(0).max(64).default(3),
    ThreadTurnAdded: z.number().int().min(0).max(64).default(3),
    NewMessageCreated: z.number().int().min(0).max(64).default(0),
    VoteCast: z.number().int().min(0).max(64).default(0),
    RoomTick: z.number().int().min(0).max(64).default(4),
  }).strict().default({
    NewPostCreated: 5,
    ThreadOpened: 3,
    ThreadTurnAdded: 3,
    NewMessageCreated: 0,
    VoteCast: 0,
    RoomTick: 4,
  }),
  director_guard: z.object({
    contrast_min_relevance_ratio: z.number().min(0).max(1).default(0.45),
    wildcard_min_relevance_ratio: z.number().min(0).max(1).default(0.35),
    min_abs_score: z.number().min(0).max(10).default(0.8),
    thread_window: z.number().int().min(1).max(64).default(6),
    thread_max_agent_occurrences: z.number().int().min(1).max(16).default(2),
    thread_cooldown_seconds: z.number().int().min(0).max(3600).default(600),
  }).strict().default({
    contrast_min_relevance_ratio: 0.45,
    wildcard_min_relevance_ratio: 0.35,
    min_abs_score: 0.8,
    thread_window: 6,
    thread_max_agent_occurrences: 2,
    thread_cooldown_seconds: 600,
  }),
  orchestration_v1: z.object({
    profile: z.enum(ORCHESTRATION_PROFILE_IDS).default('ambient_roaming'),
    recall_control: z.object({
      pair_window_minutes: z.number().int().min(1).max(240).default(30),
      pair_max_exchanges: z.number().int().min(1).max(16).default(2),
      post_thread_share_cap: z.number().min(0).max(1).default(0.7),
      reactive_recall_decay: z.enum(REACTIVE_RECALL_DECAY_IDS).default('moderate'),
      newcomer_min_share: z.number().min(0).max(1).default(0.2),
      late_entry_min_share: z.number().min(0).max(1).default(0.1),
      revive_old_branch_budget: z.number().int().min(0).max(16).default(2),
    }).strict().default({
      pair_window_minutes: 30,
      pair_max_exchanges: 2,
      post_thread_share_cap: 0.7,
      reactive_recall_decay: 'moderate',
      newcomer_min_share: 0.2,
      late_entry_min_share: 0.1,
      revive_old_branch_budget: 2,
    }),
    compare_debug: z.object({
      shadow_enabled: z.boolean().default(false),
      record_metrics: z.boolean().default(true),
      include_viewer_telemetry: z.boolean().default(true),
    }).strict().default({
      shadow_enabled: false,
      record_metrics: true,
      include_viewer_telemetry: true,
    }),
    cutover: z.object({
      selection_enabled: z.boolean().default(true),
      envelope_enabled: z.boolean().default(true),
      fallback_to_legacy: z.boolean().default(true),
    }).strict().default({
      selection_enabled: true,
      envelope_enabled: true,
      fallback_to_legacy: true,
    }),
  }).strict().default({
    profile: 'ambient_roaming',
    recall_control: {
      pair_window_minutes: 30,
      pair_max_exchanges: 2,
      post_thread_share_cap: 0.7,
      reactive_recall_decay: 'moderate',
      newcomer_min_share: 0.2,
      late_entry_min_share: 0.1,
      revive_old_branch_budget: 2,
    },
    compare_debug: {
      shadow_enabled: false,
      record_metrics: true,
      include_viewer_telemetry: true,
    },
    cutover: {
      selection_enabled: true,
      envelope_enabled: true,
      fallback_to_legacy: true,
    },
  }),
}).strict().default({
  community_max_agents: 20,
  thread_max_agents: 20,
  cooldown_seconds: 60,
  max_actions_per_hour: 30,
  max_tokens_per_day: 100_000,
  event_base_quota: {
    NewPostCreated: 5,
    ThreadOpened: 3,
    ThreadTurnAdded: 3,
    NewMessageCreated: 0,
    VoteCast: 0,
    RoomTick: 4,
  },
  director_guard: {
    contrast_min_relevance_ratio: 0.45,
    wildcard_min_relevance_ratio: 0.35,
    min_abs_score: 0.8,
    thread_window: 6,
    thread_max_agent_occurrences: 2,
    thread_cooldown_seconds: 600,
  },
  orchestration_v1: {
    profile: 'ambient_roaming',
    recall_control: {
      pair_window_minutes: 30,
      pair_max_exchanges: 2,
      post_thread_share_cap: 0.7,
      reactive_recall_decay: 'moderate',
      newcomer_min_share: 0.2,
      late_entry_min_share: 0.1,
      revive_old_branch_budget: 2,
    },
    compare_debug: {
      shadow_enabled: false,
      record_metrics: true,
      include_viewer_telemetry: true,
    },
    cutover: {
      selection_enabled: true,
      envelope_enabled: true,
      fallback_to_legacy: true,
    },
  },
})

const stageHumanParticipationInputSchema = z.object({
  mode: z.enum(['A', 'B', 'C']).optional(),
  public_participation_mode: z.enum(PUBLIC_PARTICIPATION_MODE_IDS).optional(),
  audience_signal_ingestion: z.enum(AUDIENCE_SIGNAL_INGESTION_IDS).optional(),
  agent_human_response_mode: z.enum(AGENT_HUMAN_RESPONSE_MODE_IDS).optional(),
  audience_zone_enabled: z.boolean().optional(),
  agent_reads_audience_zone: z.boolean().optional(),
  agent_reply_via_aftershow: z.boolean().optional(),
}).strict()

const stageHumanParticipationSchema = z
  .preprocess(
    (value) =>
      value ?? {
        public_participation_mode: 'audience_sidecar',
        audience_signal_ingestion: 'summary_only',
        agent_human_response_mode: 'aftershow_only',
      },
    stageHumanParticipationInputSchema,
  )
  .transform<CommunityInteractionContract>((input) =>
    resolveCommunityInteractionContract({
      mode: input.mode,
      public_participation_mode: input.public_participation_mode,
      audience_signal_ingestion: input.audience_signal_ingestion,
      agent_human_response_mode: input.agent_human_response_mode,
      audience_zone_enabled: input.audience_zone_enabled,
      agent_reads_audience_zone: input.agent_reads_audience_zone,
      agent_reply_via_aftershow: input.agent_reply_via_aftershow,
    }))

const stageIncubationSchema = z.object({
  enabled: z.boolean().default(false),
  seed_source: z.enum(['private_digest_only', 'mixed']).default('private_digest_only'),
  grant_required: z.boolean().default(true),
  redaction_profile: z.enum(['strong', 'medium', 'light']).default('strong'),
  research: z.object({
    allow_web_search: z.boolean().default(true),
    min_sources: z.number().int().min(1).max(20).default(3),
  }).strict().default({
    allow_web_search: true,
    min_sources: 3,
  }),
  format: z.object({
    min_words: z.number().int().min(100).max(20_000).default(600),
    max_words: z.number().int().min(100).max(20_000).default(2_500),
    citation_style: z.enum(['endnotes', 'inline']).default('endnotes'),
  }).strict().default({
    min_words: 600,
    max_words: 2_500,
    citation_style: 'endnotes',
  }),
}).strict().default({
  enabled: false,
  seed_source: 'private_digest_only',
  grant_required: true,
  redaction_profile: 'strong',
  research: {
    allow_web_search: true,
    min_sources: 3,
  },
  format: {
    min_words: 600,
    max_words: 2_500,
    citation_style: 'endnotes',
  },
})

const stageAftershowThresholdSchema = z.object({
  audience_comments: z.number().int().min(0).optional(),
  human_vote_score: z.number().int().min(0).optional(),
}).strict().transform((input) => ({
  audience_comments: input.audience_comments ?? 30,
  human_vote_score: input.human_vote_score ?? 10,
}))

const stageAftershowSchema = z.object({
  enabled: z.boolean().default(true),
  mode: z.enum(['OFF', 'THRESHOLD', 'PERIODIC', 'MANUAL']).default('THRESHOLD'),
  threshold: z.preprocess((value) => value ?? {}, stageAftershowThresholdSchema),
  periodic: z.object({
    enabled: z.boolean().default(false),
    interval_hours: z.number().int().min(1).max(168).default(24),
  }).strict().default({
    enabled: false,
    interval_hours: 24,
  }),
}).strict().default({
  enabled: true,
  mode: 'THRESHOLD',
  threshold: {
    audience_comments: 30,
    human_vote_score: 10,
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
    },
    guest: {
      min_tier: 'T1',
      runtime_gate: true,
    },
    core: {
      min_tier: 'T3',
      runtime_gate: true,
    },
  }),
  tier_gate: z.object({
    resident_min_tier: stageTierSchema.default('T3'),
    core_min_tier: stageTierSchema.default('T3'),
    strict_publication_longform_min_tier: stageTierSchema.default('T4'),
  }).strict().default({
    resident_min_tier: 'T3',
    core_min_tier: 'T3',
    strict_publication_longform_min_tier: 'T4',
  }),
  strict_publication: z.object({
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
  allocator: stageAllocatorSchema,
  human_participation: stageHumanParticipationSchema,
  incubation: stageIncubationSchema,
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

// Maximally permissive spec used when rules_json is missing or invalid.
// strict_publication.enabled=false keeps the incubation pipeline from gating agents
// that haven't earned the required stage tier yet, preventing availability deadlocks on new communities.
export const AVAILABILITY_FALLBACK_STAGE_SPEC_V1: StageSpecV1 = stageSpecV1Schema.parse({
  version: 'v1',
  min_tier_pool: 'T1',
  roles: {
    resident: {
      min_tier: 'T1',
      runtime_gate: true,
    },
    guest: {
      min_tier: 'T1',
      runtime_gate: true,
    },
    core: {
      min_tier: 'T1',
      runtime_gate: true,
    },
  },
  tier_gate: {
    resident_min_tier: 'T1',
    core_min_tier: 'T1',
    strict_publication_longform_min_tier: 'T1',
  },
  strict_publication: {
    enabled: false,
    premod_required: true,
    min_sources: 3,
    grant_required: true,
    max_ttl_hours: 168,
    redaction: 'strong',
  },
  aftershow: {
    enabled: false,
    mode: 'OFF',
    threshold: {
      audience_comments: 30,
      human_vote_score: 10,
    },
    periodic: {
      enabled: false,
      interval_hours: 24,
    },
  },
  allocator: {
    community_max_agents: 20,
    thread_max_agents: 20,
    cooldown_seconds: 60,
    max_actions_per_hour: 30,
    max_tokens_per_day: 100_000,
    event_base_quota: {
      NewPostCreated: 5,
      ThreadOpened: 3,
      ThreadTurnAdded: 3,
      NewMessageCreated: 0,
      VoteCast: 0,
      RoomTick: 4,
    },
    director_guard: {
      contrast_min_relevance_ratio: 0.45,
      wildcard_min_relevance_ratio: 0.35,
      min_abs_score: 0.8,
      thread_window: 6,
      thread_max_agent_occurrences: 2,
      thread_cooldown_seconds: 600,
    },
    orchestration_v1: {
      profile: 'ambient_roaming',
      recall_control: {
        pair_window_minutes: 30,
        pair_max_exchanges: 2,
        post_thread_share_cap: 0.7,
        reactive_recall_decay: 'moderate',
        newcomer_min_share: 0.2,
        late_entry_min_share: 0.1,
        revive_old_branch_budget: 2,
      },
      compare_debug: {
        shadow_enabled: false,
        record_metrics: true,
        include_viewer_telemetry: true,
      },
      cutover: {
        selection_enabled: true,
        envelope_enabled: true,
        fallback_to_legacy: true,
      },
    },
  },
  human_participation: {
    public_participation_mode: 'llm_only',
    audience_signal_ingestion: 'none',
    agent_human_response_mode: 'none',
  },
  incubation: {
    enabled: false,
    seed_source: 'private_digest_only',
    grant_required: true,
    redaction_profile: 'strong',
    research: {
      allow_web_search: true,
      min_sources: 3,
    },
    format: {
      min_words: 600,
      max_words: 2500,
      citation_style: 'endnotes',
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
    richCommunitiesMetrics.recordStageSpecFallback()
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
    richCommunitiesMetrics.recordStageSpecFallback()
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
