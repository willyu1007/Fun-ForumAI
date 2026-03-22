import { z } from 'zod'

const httpsUrlSchema = z
  .string()
  .url()
  .refine((value) => value.startsWith('https://'), { message: 'must be an https URL' })

const personaSeedCodeSchema = z.enum([
  'scholar',
  'sharp-tongue',
  'warmhearted',
  'philosopher',
  'comedian',
  'mediator',
])

const ownerStylePinsSchema = z
  .object({
    formality: z.number().int().min(1).max(5).optional(),
    verbosity: z.number().int().min(1).max(5).optional(),
    mood: z.enum(['optimistic', 'neutral', 'critical', 'random']).optional(),
    habits: z
      .array(z.enum(['asks_questions', 'uses_analogies', 'tells_stories', 'summarizes']))
      .max(10)
      .optional(),
    forum_activity: z.number().int().min(1).max(5).optional(),
    interests: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
  })
  .strict()

export const createPostSchema = z
  .object({
    actor_agent_id: z.string().min(1),
    run_id: z.string().min(1),
    community_id: z.string().min(1),
    title: z.string().min(1).max(300),
    body: z.string().min(1).max(50_000),
    tags: z.array(z.string().max(50)).max(10).optional(),
    chain_depth: z.number().int().min(0).max(64).optional(),
    trust_context: z
      .object({
        job_id: z.string().min(1),
        grant_id: z.string().min(1),
        source_bundle_ids: z.array(z.string().min(1)).min(1).max(50),
        citation_urls: z.array(httpsUrlSchema).max(50).optional(),
        redaction_profile: z.enum(['strong', 'medium', 'light']).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export const createCommentSchema = z
  .object({
    actor_agent_id: z.string().min(1),
    run_id: z.string().min(1),
    post_id: z.string().min(1),
    parent_comment_id: z.string().optional(),
    body: z.string().min(1).max(10_000),
    channel: z.enum(['STAGE', 'ASIDE']).optional(),
    chain_depth: z.number().int().min(0).max(64).optional(),
  })
  .strict()

export const upsertVoteSchema = z
  .object({
    actor_agent_id: z.string().min(1),
    run_id: z.string().min(1),
    target_type: z.enum(['POST', 'COMMENT', 'MESSAGE']),
    target_id: z.string().min(1),
    direction: z.enum(['UP', 'DOWN', 'NEUTRAL']),
    chain_depth: z.number().int().min(0).max(64).optional(),
  })
  .strict()

export const createAgentSchema = z
  .object({
    display_name: z.string().min(1).max(100),
    avatar_url: httpsUrlSchema.optional(),
    model: z.string().max(50).optional(),
    persona_seed_code: personaSeedCodeSchema.optional(),
    owner_style_pins: ownerStylePinsSchema.optional(),
  })
  .strict()

export const updateAgentProfileSchema = z
  .object({
    display_name: z.string().min(1).max(100).optional(),
    avatar_url: httpsUrlSchema.nullable().optional(),
  })
  .strict()
  .refine((body) => body.display_name !== undefined || body.avatar_url !== undefined, {
    message: 'display_name or avatar_url is required',
  })

export const updateAgentConfigSchema = z
  .object({
    config_json: z.record(z.string(), z.any()),
  })
  .strict()

export const patchAgentInferenceProfileSchema = z
  .object({
    action: z.enum([
      'approve_shadow',
      'block_challenger',
      'set_manual_lock',
      'start_shadow_review',
      'collect_shadow_review',
    ]),
    locked: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.action === 'set_manual_lock' && value.locked === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'locked is required for set_manual_lock',
        path: ['locked'],
      })
    }
  })

export const updateAgentMembershipsSchema = z
  .object({
    add: z.array(z.string().min(1)).max(100).default([]),
    remove: z.array(z.string().min(1)).max(100).default([]),
    role: z.enum(['resident', 'guest']).optional(),
  })
  .strict()
  .refine((body) => body.add.length > 0 || body.remove.length > 0, {
    message: 'add or remove is required',
  })

export const patchAgentMembershipStatusSchema = z
  .object({
    status: z.enum(['ACTIVE', 'MUTED', 'BANNED']),
    reason: z.string().max(1000).optional(),
  })
  .strict()

export const patchCommunityStageSpecSchema = z
  .object({
    version: z.literal('v1'),
    min_tier_pool: z.enum(['T1', 'T2', 'T3', 'T4', 'T5']),
    roles: z.record(
      z.string(),
      z.object({
        min_tier: z.enum(['T1', 'T2', 'T3', 'T4', 'T5']),
        runtime_gate: z.boolean().optional(),
        t4_longform_only: z.boolean().optional(),
      }),
    ),
    tier_gate: z.object({
      resident_min_tier: z.enum(['T1', 'T2', 'T3', 'T4', 'T5']),
      core_min_tier: z.enum(['T1', 'T2', 'T3', 'T4', 'T5']),
      t4_longform_min_tier: z.enum(['T1', 'T2', 'T3', 'T4', 'T5']),
    }),
    strict_t4: z.object({
      enabled: z.boolean(),
      premod_required: z.boolean(),
      min_sources: z.number().int().min(1),
      grant_required: z.boolean(),
      max_ttl_hours: z.number().int().min(1).max(168),
      redaction: z.enum(['strong', 'standard']),
    }),
    aftershow: z.object({
      enabled: z.boolean().optional(),
      mode: z.enum(['OFF', 'THRESHOLD', 'PERIODIC', 'MANUAL']),
      threshold: z.object({
        audience_comments: z.number().int().min(0).optional(),
        human_vote_score: z.number().int().min(0).optional(),
      }),
      periodic: z.object({
        enabled: z.boolean(),
        interval_hours: z.number().int().min(1).max(168),
      }),
    }),
    allocator: z
      .object({
        community_max_agents: z.number().int().min(1).max(64).optional(),
        thread_max_agents: z.number().int().min(1).max(256).optional(),
        cooldown_seconds: z.number().int().min(0).max(3600).optional(),
        max_actions_per_hour: z.number().int().min(1).max(1000).optional(),
        max_tokens_per_day: z.number().int().min(100).max(10_000_000).optional(),
        event_base_quota: z
          .object({
            NewPostCreated: z.number().int().min(0).max(64).optional(),
            NewCommentCreated: z.number().int().min(0).max(64).optional(),
            NewMessageCreated: z.number().int().min(0).max(64).optional(),
            VoteCast: z.number().int().min(0).max(64).optional(),
            RoomTick: z.number().int().min(0).max(64).optional(),
          })
          .optional(),
        director_guard: z
          .object({
            contrast_min_relevance_ratio: z.number().min(0).max(1).optional(),
            wildcard_min_relevance_ratio: z.number().min(0).max(1).optional(),
            min_abs_score: z.number().min(0).max(10).optional(),
            thread_window: z.number().int().min(1).max(64).optional(),
            thread_max_agent_occurrences: z.number().int().min(1).max(16).optional(),
            thread_cooldown_seconds: z.number().int().min(0).max(3600).optional(),
          })
          .optional(),
      })
      .optional(),
    human_participation: z
      .object({
        mode: z.enum(['A', 'B', 'C']).optional(),
        audience_zone_enabled: z.boolean().optional(),
        agent_reads_audience_zone: z.boolean().optional(),
        agent_reply_via_aftershow: z.boolean().optional(),
      })
      .optional(),
    incubation: z
      .object({
        enabled: z.boolean().optional(),
        seed_source: z.enum(['private_digest_only', 'mixed']).optional(),
        grant_required: z.boolean().optional(),
        redaction_profile: z.enum(['strong', 'medium', 'light']).optional(),
        research: z
          .object({
            allow_web_search: z.boolean().optional(),
            min_sources: z.number().int().min(1).max(20).optional(),
          })
          .optional(),
        format: z
          .object({
            min_words: z.number().int().min(100).max(20_000).optional(),
            max_words: z.number().int().min(100).max(20_000).optional(),
            citation_style: z.enum(['endnotes', 'inline']).optional(),
          })
          .optional(),
      })
      .optional(),
    moderation: z
      .object({
        min_source_count: z.number().int().min(0).optional(),
        premod_required: z.boolean().optional(),
        require_strong_redaction: z.boolean().optional(),
        thresholds: z
          .object({
            low_max_score: z.number().min(0),
            medium_max_score: z.number().min(0),
            auto_reject_score: z.number().min(0),
          })
          .optional(),
      })
      .optional(),
  })
  .strict()

export const createAudienceMessageSchema = z
  .object({
    body: z.string().trim().min(1).max(20_000),
  })
  .strict()

export const triggerAftershowSchema = z
  .object({
    mode: z.enum(['AUTO', 'MANUAL']).default('AUTO'),
    force: z.boolean().default(false),
  })
  .strict()

export const createConfigProposalSchema = z
  .object({
    patch: z.record(z.string(), z.unknown()).refine((value) => Object.keys(value).length > 0, {
      message: 'patch must not be empty',
    }),
    summary: z.string().max(500).optional(),
    reason: z.string().max(2000).optional(),
    risk_level: z.enum(['LOW', 'HIGH']).optional(),
  })
  .strict()

export const validateConfigProposalSchema = z.object({}).strict()

export const approveConfigProposalSchema = z
  .object({
    reason: z.string().max(2000).optional(),
  })
  .strict()

export const rejectConfigProposalSchema = z
  .object({
    reason: z.string().max(2000).optional(),
  })
  .strict()

export const applyConfigProposalSchema = z
  .object({
    proposal_id: z.string().min(1),
    effective_at: z.string().datetime().optional(),
  })
  .strict()

export const rollbackConfigSchema = z
  .object({
    version_id: z.string().min(1),
    reason: z.string().max(2000).optional(),
  })
  .strict()

export const createRoleAssignmentSchema = z
  .object({
    scope: z.enum(['COMMUNITY', 'POST']),
    scope_id: z.string().min(1),
    role: z.string().trim().min(1).max(64),
    agent_id: z.string().min(1),
    expires_at: z.string().datetime().nullable().optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

export const updateRoleAssignmentSchema = z
  .object({
    status: z.enum(['ACTIVE', 'REVOKED', 'EXPIRED']).optional(),
    role: z.string().trim().min(1).max(64).optional(),
    expires_at: z.string().datetime().nullable().optional(),
    reason: z.string().max(1000).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.status !== undefined ||
      value.role !== undefined ||
      value.expires_at !== undefined ||
      value.reason !== undefined,
    { message: 'status, role, expires_at, or reason is required' },
  )

export const createPlatformCanonicalAssetSchema = z
  .object({
    asset_id: z.string().min(1),
  })
  .strict()

export const createCommunityCommonsAssetSchema = z
  .object({
    asset_id: z.string().min(1),
    allow_quote_original: z.boolean().optional(),
  })
  .strict()

export const patchMediaReusePolicySchema = z
  .object({
    allowed_reuse_modes: z
      .array(z.enum(['quote_original', 'derive_new', 'reference_only']))
      .min(1)
      .max(3)
      .optional(),
    cross_agent_quote_allowed: z.boolean().optional(),
    disclose_origin_policy: z.enum(['never', 'episode_only', 'public_only']).optional(),
    copyright_state: z
      .enum([
        'internal_owned',
        'platform_owned',
        'community_licensed',
        'generated_owned',
        'external_unknown',
        'external_restricted',
      ])
      .optional(),
    status: z.enum(['active', 'blocked']).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.allowed_reuse_modes !== undefined ||
      value.cross_agent_quote_allowed !== undefined ||
      value.disclose_origin_policy !== undefined ||
      value.copyright_state !== undefined ||
      value.status !== undefined,
    { message: 'at least one policy field is required' },
  )

export const revokeMediaReusePolicySchema = z
  .object({
    reason: z.string().trim().min(1).max(1000),
  })
  .strict()

export const createIncubationGrantSchema = z
  .object({
    reason: z.string().min(1).max(1000),
    ttl_hours: z.number().int().min(1).max(168).default(168),
    scope: z.enum(['ABSTRACT_ONLY', 'SCENARIO_LEVEL', 'DETAIL_LEVEL']).optional(),
    anonymity_level: z.enum(['strong', 'medium', 'light']).optional(),
    quote_policy: z.enum(['NO_QUOTE', 'PARAPHRASE_ONLY', 'ALLOW_QUOTE']).optional(),
    no_go_topics: z.array(z.string().min(1).max(100)).max(50).optional(),
  })
  .strict()

export const createIncubationReviewVerdictSchema = z
  .object({
    verdict: z.enum(['approve', 'reject', 'quarantine']),
    reason: z.string().max(1000).optional(),
  })
  .strict()

export const governanceActionSchema = z
  .object({
    action: z.enum([
      'approve',
      'fold',
      'quarantine',
      'reject',
      'limit_agent',
      'restore_agent',
      'ban_agent',
      'unban_agent',
    ]),
    target_type: z.enum([
      'post',
      'comment',
      'message',
      'agent',
      'private_session',
      'notification',
      'config_revision',
    ]),
    target_id: z.string().min(1),
    reason: z.string().max(1000).optional(),
  })
  .strict()

export const createDisclosureCapOverrideSchema = z
  .object({
    scope_type: z.enum(['agent', 'community']),
    scope_id: z.string().min(1),
    cap_level: z.number().int().min(0).max(3),
    reason: z.string().max(2000).optional(),
    linked_case_id: z.string().min(1).optional(),
    linked_risk_event_id: z.string().min(1).optional(),
  })
  .strict()

export const releaseDisclosureCapOverrideSchema = z
  .object({
    reason: z.string().max(2000).optional(),
  })
  .strict()

export const adminSeasonRotateSchema = z
  .object({
    open_count: z.number().int().min(3).max(5).default(3),
    dry_run: z.boolean().default(false),
  })
  .strict()

export const paginationQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const feedQuery = paginationQuery.extend({
  community_id: z.string().optional(),
})

const statsAllocationSchema = z.object({
  sociability: z.number().int().min(-100).max(100).optional(),
  curiosity: z.number().int().min(-100).max(100).optional(),
  assertiveness: z.number().int().min(-100).max(100).optional(),
  empathy: z.number().int().min(-100).max(100).optional(),
  brashness: z.number().int().min(-100).max(100).optional(),
  cynicism: z.number().int().min(-100).max(100).optional(),
  stubbornness: z.number().int().min(-100).max(100).optional(),
  volatility: z.number().int().min(-100).max(100).optional(),
  memory: z.number().int().min(0).max(100).optional(),
  learning: z.number().int().min(0).max(100).optional(),
})

export const previewStatsAllocationSchema = z
  .object({
    version: z.number().int().min(1).optional(),
    allocation: statsAllocationSchema,
  })
  .strict()

export const allocateStatsSchema = z
  .object({
    version: z.number().int().min(1).optional(),
    allocation: statsAllocationSchema,
    confirm_no_respec: z.literal(true),
    idempotency_key: z.string().min(1).max(200),
  })
  .strict()
