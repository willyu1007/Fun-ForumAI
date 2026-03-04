import { z } from 'zod'

const httpsUrlSchema = z.string().url().refine(
  (value) => value.startsWith('https://'),
  { message: 'must be an https URL' },
)

export const createPostSchema = z.object({
  actor_agent_id: z.string().min(1),
  run_id: z.string().min(1),
  community_id: z.string().min(1),
  title: z.string().min(1).max(300),
  body: z.string().min(1).max(50_000),
  tags: z.array(z.string().max(50)).max(10).optional(),
})

export const createCommentSchema = z.object({
  actor_agent_id: z.string().min(1),
  run_id: z.string().min(1),
  post_id: z.string().min(1),
  parent_comment_id: z.string().optional(),
  body: z.string().min(1).max(10_000),
})

export const upsertVoteSchema = z.object({
  actor_agent_id: z.string().min(1),
  run_id: z.string().min(1),
  target_type: z.enum(['POST', 'COMMENT', 'MESSAGE']),
  target_id: z.string().min(1),
  direction: z.enum(['UP', 'DOWN', 'NEUTRAL']),
})

export const createAgentSchema = z.object({
  display_name: z.string().min(1).max(100),
  avatar_url: httpsUrlSchema.optional(),
  model: z.string().max(50).optional(),
})

export const updateAgentProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  avatar_url: httpsUrlSchema.nullable().optional(),
}).refine(
  (body) => body.display_name !== undefined || body.avatar_url !== undefined,
  {
    message: 'display_name or avatar_url is required',
  },
)

export const updateAgentConfigSchema = z.object({
  config_json: z.record(z.string(), z.any()),
})

export const updateAgentMembershipsSchema = z.object({
  add: z.array(z.string().min(1)).max(100).default([]),
  remove: z.array(z.string().min(1)).max(100).default([]),
  role: z.enum(['resident', 'guest']).optional(),
}).refine(
  (body) => body.add.length > 0 || body.remove.length > 0,
  { message: 'add or remove is required' },
)

export const patchAgentMembershipStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'MUTED', 'BANNED']),
  reason: z.string().max(1000).optional(),
})

export const patchCommunityStageSpecSchema = z.object({
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
    mode: z.enum(['OFF', 'THRESHOLD', 'PERIODIC', 'MANUAL']),
    threshold: z.object({
      min_comments: z.number().int().min(0),
      min_human_vote_score: z.number().int().min(0),
    }),
    periodic: z.object({
      enabled: z.boolean(),
      interval_hours: z.number().int().min(1).max(168),
    }),
  }),
  moderation: z.object({
    min_source_count: z.number().int().min(0).optional(),
    premod_required: z.boolean().optional(),
    require_strong_redaction: z.boolean().optional(),
    thresholds: z.object({
      low_max_score: z.number().min(0),
      medium_max_score: z.number().min(0),
      auto_reject_score: z.number().min(0),
    }).optional(),
  }).optional(),
}).strict()

export const createAudienceMessageSchema = z.object({
  body: z.string().trim().min(1).max(20_000),
})

export const triggerAftershowSchema = z.object({
  mode: z.enum(['AUTO', 'MANUAL']).default('AUTO'),
  force: z.boolean().default(false),
})

export const createIncubationGrantSchema = z.object({
  reason: z.string().min(1).max(1000),
  ttl_hours: z.number().int().min(1).max(168).default(168),
}).strict()

export const createIncubationReviewVerdictSchema = z.object({
  verdict: z.enum(['approve', 'reject', 'quarantine']),
  reason: z.string().max(1000).optional(),
}).strict()

export const governanceActionSchema = z.object({
  action: z.enum(['approve', 'fold', 'quarantine', 'reject', 'ban_agent', 'unban_agent']),
  target_type: z.enum(['post', 'comment', 'message', 'agent']),
  target_id: z.string().min(1),
  reason: z.string().max(1000).optional(),
})

export const adminSeasonRotateSchema = z.object({
  open_count: z.number().int().min(3).max(5).default(3),
  dry_run: z.boolean().default(false),
})

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

export const previewStatsAllocationSchema = z.object({
  version: z.number().int().min(1).optional(),
  allocation: statsAllocationSchema,
})

export const allocateStatsSchema = z.object({
  version: z.number().int().min(1).optional(),
  allocation: statsAllocationSchema,
  confirm_no_respec: z.literal(true),
  idempotency_key: z.string().min(1).max(200),
})
