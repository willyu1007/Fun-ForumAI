import { z } from 'zod'
import {
  COMMUNITY_INCUBATION_VISIBILITY_MODES,
  COMMUNITY_PROPOSAL_ACTIONS,
} from '../repos/types/governance.js'
import {
  AGENT_HUMAN_RESPONSE_MODE_IDS,
  AUDIENCE_SIGNAL_INGESTION_IDS,
  COMMUNITY_FAMILY_IDS,
  PUBLIC_PARTICIPATION_MODE_IDS,
  PUBLICATION_REVIEW_PROFILE_IDS,
} from '../../shared/semantic-taxonomy.js'
import {
  ORCHESTRATION_PROFILE_IDS,
  REACTIVE_RECALL_DECAY_IDS,
} from '../../shared/forum-orchestration.js'

const httpsUrlSchema = z
  .string()
  .url()
  .refine((value) => value.startsWith('https://'), { message: 'must be an https URL' })

const profileAvatarUrlSchema = z
  .string()
  .trim()
  .min(1, '请输入有效头像地址')
  .refine((value) => value.startsWith('https://') || value.startsWith('/'), {
    message: '头像地址必须为 https URL 或站内静态资源路径',
  })

const profileMomentsCoverUrlSchema = z
  .string()
  .trim()
  .min(1, '请输入有效背景地址')
  .refine((value) => value.startsWith('/agent-moments-covers/'), {
    message: '背景地址必须使用系统提供的朋友圈背景图路径',
  })

const personaSeedCodeSchema = z.enum([
  'scholar',
  'sharp-tongue',
  'warmhearted',
  'philosopher',
  'comedian',
  'mediator',
])

export const feedbackCategorySchema = z.enum([
  'PRODUCT_SUGGESTION',
  'BUG_REPORT',
  'UX_ISSUE',
  'OTHER',
])

export const feedbackStatusSchema = z.enum(['RECEIVED', 'UNDER_REVIEW', 'PLANNED', 'CLOSED'])

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

const routeHandoffSchema = z
  .object({
    route_type: z.enum(['SPINOFF', 'AFTERSHOW', 'PRIVATE', 'AUDIENCE']),
    route_state: z.string().trim().min(1).max(64).optional(),
    reason_code: z.string().trim().min(1).max(120),
    handoff_label: z.string().trim().min(1).max(240),
    handoff_payload: z.record(z.string(), z.any()).nullable().optional(),
    cta: z.record(z.string(), z.any()).nullable().optional(),
  })
  .strict()

export const createThreadSchema = z
  .object({
    actor_agent_id: z.string().min(1),
    run_id: z.string().min(1),
    body: z.string().min(1).max(10_000),
    channel: z.enum(['STAGE', 'ASIDE']).optional(),
    chain_depth: z.number().int().min(0).max(64).optional(),
    route_handoff: routeHandoffSchema.optional(),
  })
  .strict()

export const createThreadTurnSchema = z
  .object({
    actor_agent_id: z.string().min(1),
    run_id: z.string().min(1),
    anchor_turn_id: z.string().min(1).optional(),
    body: z.string().min(1).max(10_000),
    channel: z.enum(['STAGE', 'ASIDE']).optional(),
    chain_depth: z.number().int().min(0).max(64).optional(),
    route_handoff: routeHandoffSchema.optional(),
  })
  .strict()

const communitySlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug_candidate must be kebab-case')

const humanParticipationInputSchema = z
  .object({
    public_participation_mode: z.enum(PUBLIC_PARTICIPATION_MODE_IDS).optional(),
    audience_signal_ingestion: z.enum(AUDIENCE_SIGNAL_INGESTION_IDS).optional(),
    agent_human_response_mode: z.enum(AGENT_HUMAN_RESPONSE_MODE_IDS).optional(),
  })
  .strict()

export const upsertVoteSchema = z
  .object({
    actor_agent_id: z.string().min(1),
    run_id: z.string().min(1),
    target_type: z.enum(['POST', 'THREAD', 'TURN', 'MESSAGE']),
    target_id: z.string().min(1),
    direction: z.enum(['UP', 'DOWN', 'NEUTRAL']),
    chain_depth: z.number().int().min(0).max(64).optional(),
  })
  .strict()

export const createAgentSchema = z
  .object({
    display_name: z.string().min(1).max(100),
    avatar_url: profileAvatarUrlSchema.optional(),
    persona_seed_code: personaSeedCodeSchema.optional(),
    owner_style_pins: ownerStylePinsSchema.optional(),
  })
  .strict()

export const createFeedbackSchema = z
  .object({
    category: feedbackCategorySchema,
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(5_000),
    entry_surface: z.string().trim().max(80).nullable().optional(),
    source_route: z.string().trim().max(500).nullable().optional(),
  })
  .strict()

export const patchAdminFeedbackSchema = z
  .object({
    status: feedbackStatusSchema.optional(),
    public_resolution_note: z.string().trim().max(5_000).nullable().optional(),
    internal_note: z.string().trim().max(5_000).nullable().optional(),
  })
  .strict()
  .refine(
    (body) =>
      body.status !== undefined ||
      body.public_resolution_note !== undefined ||
      body.internal_note !== undefined,
    {
      message: 'status, public_resolution_note, or internal_note is required',
    },
  )

export const grantAdminAccessSchema = z
  .object({
    userId: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().min(6).max(32).optional(),
  })
  .strict()
  .refine(
    (body) => {
      const provided = [body.userId, body.email, body.phone].filter((value) => value !== undefined)
      return provided.length === 1
    },
    {
      message: 'exactly one of userId, email, or phone is required',
    },
  )

export const adminUserIdParamSchema = z
  .object({
    userId: z.string().trim().min(1),
  })
  .strict()

export const updateAgentProfileSchema = z
  .object({
    display_name: z.string().min(1).max(100).optional(),
    avatar_url: profileAvatarUrlSchema.nullable().optional(),
    moments_cover_url: profileMomentsCoverUrlSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (body) =>
      body.display_name !== undefined
      || body.avatar_url !== undefined
      || body.moments_cover_url !== undefined,
    {
      message: 'display_name, avatar_url, or moments_cover_url is required',
    },
  )

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
      }),
    ),
    tier_gate: z.object({
      resident_min_tier: z.enum(['T1', 'T2', 'T3', 'T4', 'T5']),
      core_min_tier: z.enum(['T1', 'T2', 'T3', 'T4', 'T5']),
      strict_publication_longform_min_tier: z.enum(['T1', 'T2', 'T3', 'T4', 'T5']),
    }),
    strict_publication: z.object({
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
            ThreadOpened: z.number().int().min(0).max(64).optional(),
            ThreadTurnAdded: z.number().int().min(0).max(64).optional(),
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
        orchestration_v1: z
          .object({
            profile: z.enum(ORCHESTRATION_PROFILE_IDS).optional(),
            recall_control: z
              .object({
                pair_window_minutes: z.number().int().min(1).max(240).optional(),
                pair_max_exchanges: z.number().int().min(1).max(16).optional(),
                post_thread_share_cap: z.number().min(0).max(1).optional(),
                reactive_recall_decay: z.enum(REACTIVE_RECALL_DECAY_IDS).optional(),
                newcomer_min_share: z.number().min(0).max(1).optional(),
                late_entry_min_share: z.number().min(0).max(1).optional(),
                revive_old_branch_budget: z.number().int().min(0).max(16).optional(),
              })
              .strict()
              .optional(),
            compare_debug: z
              .object({
                shadow_enabled: z.boolean().optional(),
                record_metrics: z.boolean().optional(),
                include_viewer_telemetry: z.boolean().optional(),
              })
              .strict()
              .optional(),
            cutover: z
              .object({
                selection_enabled: z.boolean().optional(),
                envelope_enabled: z.boolean().optional(),
                fallback_to_baseline: z.boolean().optional(),
              })
              .strict()
              .optional(),
          })
          .strict()
          .optional(),
      })
      .optional(),
    human_participation: humanParticipationInputSchema.optional(),
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

export const createCommunityProposalSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    slug_candidate: communitySlugSchema,
    description: z.string().trim().min(1).max(500),
    premise_text: z.string().trim().min(1).max(2_000),
    target_audience: z.string().trim().max(500).nullable().optional(),
    scene_types: z.array(z.string().trim().min(1).max(64)).max(12).default([]),
    proposed_community_family: z.enum(COMMUNITY_FAMILY_IDS),
    publication_review_profile_id: z.enum(PUBLICATION_REVIEW_PROFILE_IDS).optional(),
    launch_wave: z.string().trim().min(1).max(120).nullable().optional(),
    human_participation: humanParticipationInputSchema.optional(),
    source_community_id: z.string().trim().min(1).nullable().optional(),
  })
  .strict()

export const refreshCommunityProposalRecommendationSchema = z.object({}).strict()

export const communityProposalActionSchema = z
  .object({
    action: z.enum(COMMUNITY_PROPOSAL_ACTIONS),
    target_community_id: z.string().trim().min(1).nullable().optional(),
    incubation_visibility_mode: z.enum(COMMUNITY_INCUBATION_VISIBILITY_MODES).nullable().optional(),
    reason: z.string().trim().max(1_000).nullable().optional(),
  })
  .strict()

export const createAudienceMessageSchema = z
  .object({
    body: z.string().trim().min(1).max(20_000),
    idempotency_key: z.string().trim().min(1).max(200).nullable().optional(),
    source_context: z
      .object({
        discovered_via: z.enum([
          'reading_guide',
          'discussion_forest',
          'timeline',
          'share_link',
          'unknown',
        ]),
        source_surface: z.string().trim().max(80).nullable().optional(),
        source_shelf: z.string().trim().max(80).nullable().optional(),
        source_position: z.number().int().min(0).nullable().optional(),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict()

export const createPublicThreadSchema = z
  .object({
    body: z.string().trim().min(1).max(20_000),
    idempotency_key: z.string().trim().min(1).max(200).nullable().optional(),
    source_context: z
      .object({
        discovered_via: z.enum([
          'reading_guide',
          'discussion_forest',
          'timeline',
          'share_link',
          'unknown',
        ]),
        source_surface: z.string().trim().max(80).nullable().optional(),
        source_shelf: z.string().trim().max(80).nullable().optional(),
        source_position: z.number().int().min(0).nullable().optional(),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict()

export const createPublicTurnSchema = z
  .object({
    body: z.string().trim().min(1).max(20_000),
    anchor_turn_id: z.string().trim().min(1).nullable().optional(),
    idempotency_key: z.string().trim().min(1).max(200).nullable().optional(),
    source_context: z
      .object({
        discovered_via: z.enum([
          'reading_guide',
          'discussion_forest',
          'timeline',
          'share_link',
          'unknown',
        ]),
        source_surface: z.string().trim().max(80).nullable().optional(),
        source_shelf: z.string().trim().max(80).nullable().optional(),
        source_position: z.number().int().min(0).nullable().optional(),
      })
      .strict()
      .nullable()
      .optional(),
    focused_turn_id: z.string().trim().min(1).nullable().optional(),
    actual_anchor_turn_id: z.string().trim().min(1).nullable().optional(),
    quoted_excerpt: z.string().trim().min(1).max(500).nullable().optional(),
  })
  .strict()

export const updateParticipationContractOverrideSchema = z
  .object({
    public_participation_mode: z.enum(PUBLIC_PARTICIPATION_MODE_IDS).optional(),
    audience_signal_ingestion: z.enum(AUDIENCE_SIGNAL_INGESTION_IDS).optional(),
    agent_human_response_mode: z.enum(AGENT_HUMAN_RESPONSE_MODE_IDS).optional(),
    stage_open_reply: z
      .object({
        enabled: z.boolean().optional(),
        new_thread_enabled: z.boolean().optional(),
        turn_reply_enabled: z.boolean().optional(),
      })
      .strict()
      .optional(),
    audience_lane: z
      .object({
        enabled: z.boolean().optional(),
        posting_enabled: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.public_participation_mode !== undefined ||
      value.audience_signal_ingestion !== undefined ||
      value.agent_human_response_mode !== undefined ||
      value.stage_open_reply !== undefined ||
      value.audience_lane !== undefined,
    {
      message: 'at least one participation override field is required',
    },
  )

export const buildRuntimeContextPreviewSchema = z
  .object({
    post_id: z.string().trim().min(1),
    thread_id: z.string().trim().min(1).nullable().optional(),
    focus_turn_id: z.string().trim().min(1).nullable().optional(),
    agent_id: z.string().trim().min(1).nullable().optional(),
    compare_debug: z.boolean().optional(),
  })
  .strict()

export const updateOrchestrationPolicyOverrideSchema = z
  .object({
    profile: z.enum(ORCHESTRATION_PROFILE_IDS).optional(),
    recall_control: z
      .object({
        pair_window_minutes: z.number().int().min(1).max(240).optional(),
        pair_max_exchanges: z.number().int().min(1).max(16).optional(),
        post_thread_share_cap: z.number().min(0).max(1).optional(),
        reactive_recall_decay: z.enum(REACTIVE_RECALL_DECAY_IDS).optional(),
        newcomer_min_share: z.number().min(0).max(1).optional(),
        late_entry_min_share: z.number().min(0).max(1).optional(),
        revive_old_branch_budget: z.number().int().min(0).max(16).optional(),
      })
      .strict()
      .optional(),
    compare_debug: z
      .object({
        shadow_enabled: z.boolean().optional(),
        record_metrics: z.boolean().optional(),
        include_viewer_telemetry: z.boolean().optional(),
      })
      .strict()
      .optional(),
    cutover: z
      .object({
        selection_enabled: z.boolean().optional(),
        envelope_enabled: z.boolean().optional(),
        fallback_to_baseline: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.profile !== undefined ||
      value.recall_control !== undefined ||
      value.compare_debug !== undefined ||
      value.cutover !== undefined,
    {
      message: 'at least one orchestration override field is required',
    },
  )

export const forumWatchTelemetrySchema = z
  .object({
    event_type: z.enum([
      'guide_render',
      'guide_click',
      'branch_expand',
      'node_focus',
      'timeline_open',
      'reply_anchor_select',
    ]),
    thread_id: z.string().trim().min(1).max(200).optional(),
    turn_id: z.string().trim().min(1).max(200).optional(),
    branch_group_id: z.string().trim().min(1).max(200).optional(),
    source_surface: z.string().trim().min(1).max(80).optional(),
    source_shelf: z.string().trim().min(1).max(80).optional(),
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

export const patchMediaRolloutControllerSchema = z
  .object({
    mode: z.enum(['AUTO', 'MANUAL', 'OFF']),
    target_min_rate: z.number().min(0).max(1).optional(),
    target_max_rate: z.number().min(0).max(1).optional(),
    threshold_delta: z.number().min(-1).max(1).optional(),
    allow_generation: z.boolean().optional(),
    generation_tier: z.enum(['none', 'low', 'medium', 'high']).optional(),
    sync_generation_ms_budget: z.number().int().min(0).max(30_000).optional(),
    allow_private_runtime_projection: z.boolean().optional(),
    allow_private_inspired_generation: z.boolean().optional(),
    force_safe_mode: z.boolean().optional(),
    semantic_v3_enforced: z.boolean().nullable().optional(),
    strict_audit_enforced: z.boolean().nullable().optional(),
    lineage_required: z.boolean().nullable().optional(),
    reason: z.string().max(2000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.target_min_rate !== undefined &&
      value.target_max_rate !== undefined &&
      value.target_min_rate >= value.target_max_rate
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'target_min_rate must be less than target_max_rate',
        path: ['target_min_rate'],
      })
    }
    if (value.mode === 'MANUAL') {
      const hasManualField =
        value.target_min_rate !== undefined ||
        value.target_max_rate !== undefined ||
        value.threshold_delta !== undefined ||
        value.allow_generation !== undefined ||
        value.generation_tier !== undefined ||
        value.sync_generation_ms_budget !== undefined ||
        value.allow_private_runtime_projection !== undefined ||
        value.allow_private_inspired_generation !== undefined ||
        value.force_safe_mode !== undefined ||
        value.semantic_v3_enforced !== undefined ||
        value.strict_audit_enforced !== undefined ||
        value.lineage_required !== undefined
      if (!hasManualField) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'MANUAL mode requires at least one explicit override field',
          path: ['mode'],
        })
      }
    }
  })

export const releaseMediaRolloutControllerOverrideSchema = z
  .object({
    reason: z.string().max(2000).optional(),
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
      'thread_turn',
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

export const runWarmupVerifierSchema = z.object({}).strict()
export const warmupVerifierRunIdParamSchema = z
  .object({
    id: z.string().trim().min(1),
  })
  .strict()

export const warmupRunIdParamSchema = z
  .object({
    id: z.string().trim().min(1),
  })
  .strict()

export const startWarmupRunSchema = z
  .object({
    target_posts: z.number().int().min(1).max(100),
    max_attempts: z.number().int().min(1).max(200),
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
