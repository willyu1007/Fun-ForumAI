import { z } from 'zod'

const kickoffProfileIdSchema = z.enum([
  'local-llm-assisted-candidate',
  'local-llm-assisted-runtime-simulation',
])

const kickoffModeSchema = z.enum(['candidate', 'active'])

const actorSelectorSchema = z.object({
  agent_id: z.string().trim().min(1).nullable().optional(),
  roster_entry_id: z.string().trim().min(1).nullable().optional(),
  display_name: z.string().trim().min(1).nullable().optional(),
}).strict()

const communitySelectorSchema = z.object({
  slug: z.string().trim().min(1),
}).strict()

const baseOperationSchema = z.object({
  op_id: z.string().trim().min(1),
  logical_key: z.string().trim().min(1),
  depends_on: z.array(z.string().trim().min(1)).optional(),
  target_batch_kind: z.enum(['kickoff', 'warmup']).optional(),
  generation_mode: z.enum([
    'kickoff_candidate',
    'warmup_candidate',
    'warmup_topup_candidate',
    'governance_restore',
  ]).optional(),
}).strict()

const createPostOperationSchema = baseOperationSchema.extend({
  action: z.literal('create'),
  entity_kind: z.literal('post'),
  community_selector: communitySelectorSchema,
  actor_selector: actorSelectorSchema,
  payload: z.object({
    title: z.string().trim().min(1).max(300),
    body: z.string().trim().min(1).max(50_000),
    tags: z.array(z.string().trim().min(1).max(64)).max(10).optional(),
    content_kind: z.enum(['highlight_hero', 'note_entry', 'programming_slot', 'standard']).optional(),
    storyline_hooks: z.array(z.string().trim().min(1)).max(10).optional(),
  }).strict(),
})

const createThreadOperationSchema = baseOperationSchema.extend({
  action: z.literal('create'),
  entity_kind: z.literal('thread'),
  actor_selector: actorSelectorSchema,
  payload: z.object({
    post_ref_key: z.string().trim().min(1),
    body: z.string().trim().min(1).max(20_000),
    channel: z.enum(['STAGE', 'ASIDE']).optional(),
  }).strict(),
})

const createTurnOperationSchema = baseOperationSchema.extend({
  action: z.literal('create'),
  entity_kind: z.literal('turn'),
  actor_selector: actorSelectorSchema,
  payload: z.object({
    thread_ref_key: z.string().trim().min(1),
    body: z.string().trim().min(1).max(20_000),
    anchor_turn_key: z.string().trim().min(1).nullable().optional(),
    channel: z.enum(['STAGE', 'ASIDE']).optional(),
  }).strict(),
})

const createVoteOperationSchema = baseOperationSchema.extend({
  action: z.literal('create'),
  entity_kind: z.literal('vote'),
  actor_selector: actorSelectorSchema,
  payload: z.object({
    target_ref_key: z.string().trim().min(1),
    direction: z.enum(['UP', 'DOWN', 'NEUTRAL']),
  }).strict(),
})

const attachMediaOperationSchema = baseOperationSchema.extend({
  action: z.literal('attach_media'),
  entity_kind: z.literal('media'),
  actor_selector: actorSelectorSchema,
  payload: z.object({
    post_ref_key: z.string().trim().min(1),
    source_kind: z.enum(['repo_local', 'inline_base64']),
    relative_path: z.string().trim().min(1).nullable().optional(),
    inline_base64: z.string().trim().min(1).nullable().optional(),
    mime_type: z.string().trim().min(1),
    owner_note: z.string().trim().max(500).nullable().optional(),
    alt_intent: z.string().trim().max(500).nullable().optional(),
    semantic_expectation: z.string().trim().max(500).nullable().optional(),
    safety_expectation: z.string().trim().max(500).nullable().optional(),
  }).strict(),
})

const runtimeInstructionOperationSchema = baseOperationSchema.extend({
  action: z.literal('runtime_instruction'),
  entity_kind: z.literal('runtime_instruction'),
  payload: z.object({
    community_selector: communitySelectorSchema,
    actor_selector: actorSelectorSchema,
    title: z.string().trim().min(1).max(300),
    body: z.string().trim().min(1).max(50_000),
    tags: z.array(z.string().trim().min(1).max(64)).max(10).optional(),
    director_goal: z.string().trim().min(1).max(500),
    scene_hint: z.string().trim().max(500).nullable().optional(),
    placement_goal: z.string().trim().max(500).nullable().optional(),
    topup_reason: z.string().trim().max(500).nullable().optional(),
  }).strict(),
})

const authoringOperationSchema = z.union([
  createPostOperationSchema,
  createThreadOperationSchema,
  createTurnOperationSchema,
  createVoteOperationSchema,
  attachMediaOperationSchema,
  runtimeInstructionOperationSchema,
])

export const kickoffAuthoringPatchSchema = z.object({
  patch_meta: z.object({
    contract_version: z.literal(1),
    patch_id: z.string().trim().min(1),
    patch_kind: kickoffProfileIdSchema,
    generated_by_tool: z.string().trim().min(1),
    generated_at: z.string().datetime(),
    iteration: z.number().int().min(1),
    parent_patch_id: z.string().trim().min(1).nullable().optional(),
    repair_of_patch_id: z.string().trim().min(1).nullable().optional(),
  }).strict(),
  target: z.object({
    mode: kickoffModeSchema,
    suite_label: z.string().trim().min(1),
    expected_seed_profile: z.literal('launch'),
    target_environment: z.literal('local'),
    target_batch_scope: z.enum(['kickoff', 'warmup', 'both']),
  }).strict(),
  source_contract_refs: z.object({
    launch_manifest_path: z.string().trim().min(1),
    manifest_version: z.literal(1),
    community_rules_contract_path: z.string().trim().min(1),
    system_roster_contract_path: z.string().trim().min(1),
    programming_schedule_contract_path: z.string().trim().min(1),
    visual_rollout_contract_path: z.string().trim().min(1),
  }).strict(),
  preconditions: z.object({
    require_clean_db: z.boolean(),
    require_launch_seed_ready: z.boolean(),
    require_no_other_review_ready_suite: z.boolean(),
    require_roster_memberships_ready: z.boolean(),
    require_media_backend_available: z.boolean(),
  }).strict(),
  operations: z.array(authoringOperationSchema).min(1),
  quality_expectations: z.object({
    summary_floor: z.object({
      posts: z.number().int().min(0),
      threads: z.number().int().min(0),
      turns: z.number().int().min(0),
      votes: z.number().int().min(0),
    }).strict(),
    coverage_floor: z.object({
      communities: z.number().int().min(0),
      media_coverage_ratio: z.number().min(0).max(1),
    }).strict(),
    media_floor: z.object({
      minimum_media_assets: z.number().int().min(0),
    }).strict(),
    interaction_floor: z.object({
      minimum_threads: z.number().int().min(0),
      minimum_turns: z.number().int().min(0),
    }).strict(),
    key_communities_expected: z.array(z.string().trim().min(1)).min(1),
    key_shelves_expected: z.array(z.string().trim().min(1)).min(1),
    aftershow_pipeline_expected: z.boolean(),
    allow_public_growth_expected: z.boolean(),
  }).strict(),
  notes: z.array(z.string().trim().min(1)).optional(),
}).strict()

export const kickoffBootstrapSchema = z.object({
  mode: kickoffModeSchema,
  suite_label: z.string().trim().min(1).nullable().optional(),
  profile_id: kickoffProfileIdSchema.default('local-llm-assisted-candidate'),
  max_runtime_topup_posts: z.number().int().min(0).max(50).optional(),
  reset_before_bootstrap: z.boolean().optional(),
}).strict()

export const kickoffImportSchema = z.object({
  dry_run: z.boolean(),
  patch: kickoffAuthoringPatchSchema,
  patch_pack_id: z.string().trim().min(1).nullable().optional(),
  profile_id: kickoffProfileIdSchema.default('local-llm-assisted-candidate'),
}).strict()

export const kickoffRunIdParamSchema = z.object({
  runId: z.string().trim().min(1),
}).strict()

export const kickoffSuiteEditSchema = z.object({
  action: z.enum(['rewrite_post', 'replace_post_media', 'regenerate_thread', 'regenerate_turn']),
  target: z.object({
    suite_id: z.string().trim().min(1),
    post_id: z.string().trim().min(1).nullable().optional(),
    thread_id: z.string().trim().min(1).nullable().optional(),
    turn_id: z.string().trim().min(1).nullable().optional(),
  }).strict(),
  payload: z.record(z.string(), z.unknown()),
  reason: z.string().trim().min(1).max(500),
}).strict()
