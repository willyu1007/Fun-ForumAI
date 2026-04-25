/**
 * T-209 cue-data-and-board — domain types for the public discussion cue
 * programming layer. These hand-written interfaces are the canonical shape
 * downstream sub-bundles (T-210..T-216) consume; their Zod equivalents are
 * defined alongside for runtime validation at write time.
 *
 * The DB stores most of these as JSON columns on the cue table; the
 * repository hydrates JSON to typed domain objects on read.
 */

import { z } from 'zod'
import {
  type DispatchPolicy,
  DispatchPolicySchema,
} from '../contract/index.js'

// =============================================================================
// CueThemeIntent — design doc §5.3
// =============================================================================

export type CueToneBand =
  | 'calm'
  | 'warm'
  | 'tense_but_playful'
  | 'sharp'
  | 'reflective'
  | 'story_like'

export type CuePublicContextRefKind =
  | 'post'
  | 'thread'
  | 'turn'
  | 'media_asset'
  | 'external_url'

export interface CuePublicContextRef {
  kind: CuePublicContextRefKind
  id: string
  note?: string
}

export interface CueThemeIntent {
  topic_seed: string
  discussion_question?: string
  angle_hint?: string
  tone_band?: CueToneBand
  public_context_refs?: CuePublicContextRef[]
}

const CueToneBandEnum = z.enum([
  'calm',
  'warm',
  'tense_but_playful',
  'sharp',
  'reflective',
  'story_like',
])

const CuePublicContextRefSchema = z
  .object({
    kind: z.enum(['post', 'thread', 'turn', 'media_asset', 'external_url']),
    id: z.string().min(1),
    note: z.string().optional(),
  })
  .strict()

export const CueThemeIntentSchema = z
  .object({
    topic_seed: z.string().min(1),
    discussion_question: z.string().optional(),
    angle_hint: z.string().optional(),
    tone_band: CueToneBandEnum.optional(),
    public_context_refs: z.array(CuePublicContextRefSchema).optional(),
  })
  .strict()

// =============================================================================
// CueSceneConstraints — design doc §5.4
// =============================================================================

export type CueCommunityScopeMode =
  | 'single'
  | 'community_family'
  | 'runtime_select'

export interface CueCommunityScope {
  mode: CueCommunityScopeMode
  community_id?: string
  community_family_id?: string
}

export type CuePublicStageScope = 'forum' | 'chat_room'

export type CueSceneFamily =
  | 'debate'
  | 'round_table'
  | 'story_followup'
  | 'creator_note_context'
  | 'slice_of_life'
  | 'hot_topic_match'
  | 'continuity_callback'
  | 'radio_night'

export type CuePrivacyPolicy = 'public_only' | 'public_plus_safe_projection'
export type CuePrivateReferencePolicy =
  | 'forbidden'
  | 'allowed_only_if_projected'
export type CueSafetyProfile = 'standard' | 'strict' | 'high_review'

export interface CueTensionRange {
  min: number
  max: number
}

export interface CueContinuityPolicy {
  allow_public_thread_context: boolean
  allow_private_memory: boolean
  allow_storyline_callback: boolean
}

export interface CueFatigueConstraints {
  avoid_recent_topic_keys?: string[]
  avoid_recent_scene_families?: string[]
  avoid_overused_frames?: string[]
}

export interface CueSceneConstraints {
  community_scope: CueCommunityScope
  public_stage_scope: CuePublicStageScope[]
  allowed_scene_families?: CueSceneFamily[]
  preferred_scene_family?: CueSceneFamily
  disallowed_scene_families?: CueSceneFamily[]
  tension_range?: CueTensionRange
  privacy_policy: CuePrivacyPolicy
  private_reference_policy: CuePrivateReferencePolicy
  safety_profile: CueSafetyProfile
  continuity_policy?: CueContinuityPolicy
  fatigue_constraints?: CueFatigueConstraints
}

export const CueCommunityScopeSchema = z
  .object({
    mode: z.enum(['single', 'community_family', 'runtime_select']),
    community_id: z.string().optional(),
    community_family_id: z.string().optional(),
  })
  .strict()
  .refine(
    (v) => {
      if (v.mode === 'single') return v.community_id != null
      if (v.mode === 'community_family') return v.community_family_id != null
      return true
    },
    {
      message:
        'community_id required for mode=single; community_family_id required for mode=community_family',
    },
  )

const CueSceneFamilyEnum = z.enum([
  'debate',
  'round_table',
  'story_followup',
  'creator_note_context',
  'slice_of_life',
  'hot_topic_match',
  'continuity_callback',
  'radio_night',
])

const CueTensionRangeSchema = z
  .object({
    min: z.number().min(0).max(1),
    max: z.number().min(0).max(1),
  })
  .strict()
  .refine((v) => v.min <= v.max, { message: 'tension_range.min must be <= max' })

const CueContinuityPolicySchema = z
  .object({
    allow_public_thread_context: z.boolean(),
    allow_private_memory: z.boolean(),
    allow_storyline_callback: z.boolean(),
  })
  .strict()

const CueFatigueConstraintsSchema = z
  .object({
    avoid_recent_topic_keys: z.array(z.string().min(1)).optional(),
    avoid_recent_scene_families: z.array(CueSceneFamilyEnum).optional(),
    avoid_overused_frames: z.array(z.string().min(1)).optional(),
  })
  .strict()

export const CueSceneConstraintsSchema = z
  .object({
    community_scope: CueCommunityScopeSchema,
    public_stage_scope: z.array(z.enum(['forum', 'chat_room'])).min(1),
    allowed_scene_families: z.array(CueSceneFamilyEnum).optional(),
    preferred_scene_family: CueSceneFamilyEnum.optional(),
    disallowed_scene_families: z.array(CueSceneFamilyEnum).optional(),
    tension_range: CueTensionRangeSchema.optional(),
    privacy_policy: z.enum(['public_only', 'public_plus_safe_projection']),
    private_reference_policy: z.enum(['forbidden', 'allowed_only_if_projected']),
    safety_profile: z.enum(['standard', 'strict', 'high_review']),
    continuity_policy: CueContinuityPolicySchema.optional(),
    fatigue_constraints: CueFatigueConstraintsSchema.optional(),
  })
  .strict()

// =============================================================================
// CueRoleRequirementVector — design doc §5.5
// =============================================================================

export type CueRole =
  | 'anchor'
  | 'challenger'
  | 'bridge'
  | 'observer'
  | 'comic_relief'
  | 'skeptic'
  | 'empath'
  | 'wildcard'

export interface CueRoleRequirement {
  role: CueRole
  purpose?: string
  weight: number
  optional?: boolean
}

export type CueRelationshipShape =
  | 'contrast'
  | 'contrast_with_bridge'
  | 'round_table'
  | 'solo_reflection'
  | 'call_and_response'

export type CueNoveltyPreference =
  | 'avoid_recently_overexposed'
  | 'prefer_familiar_faces'
  | 'balanced'

export interface CueRoleRequirementVector {
  requirements: CueRoleRequirement[]
  relationship_shape?: CueRelationshipShape
  novelty_preference?: CueNoveltyPreference
}

const CueRoleEnum = z.enum([
  'anchor',
  'challenger',
  'bridge',
  'observer',
  'comic_relief',
  'skeptic',
  'empath',
  'wildcard',
])

const CueRoleRequirementSchema = z
  .object({
    role: CueRoleEnum,
    purpose: z.string().optional(),
    weight: z.number().min(0).max(1),
    optional: z.boolean().optional(),
  })
  .strict()

export const CueRoleRequirementVectorSchema = z
  .object({
    requirements: z.array(CueRoleRequirementSchema).min(1),
    relationship_shape: z
      .enum([
        'contrast',
        'contrast_with_bridge',
        'round_table',
        'solo_reflection',
        'call_and_response',
      ])
      .optional(),
    novelty_preference: z
      .enum(['avoid_recently_overexposed', 'prefer_familiar_faces', 'balanced'])
      .optional(),
  })
  .strict()

// =============================================================================
// CueMediaPolicy — placeholder (T-216 expands)
// =============================================================================

export interface CueMediaPolicy {
  default_use_policy?:
    | 'runtime_only'
    | 'prefer_runtime_context'
    | 'prefer_public_display'
    | 'allow_generated_derivative'
  // require_public_display reserved for permission-gated future use (umbrella D-11).
}

export const CueMediaPolicySchema = z
  .object({
    default_use_policy: z
      .enum([
        'runtime_only',
        'prefer_runtime_context',
        'prefer_public_display',
        'allow_generated_derivative',
      ])
      .optional(),
  })
  .strict()

// =============================================================================
// CueSafetyPolicy
// =============================================================================

export interface CueSafetyPolicy {
  // Mirror of the cue table's safety_profile column for downstream convenience.
  safety_profile?: CueSafetyProfile
  // Audit hooks (placeholder; populated by T-212+).
  audit_hint?: string
}

export const CueSafetyPolicySchema = z
  .object({
    safety_profile: z.enum(['standard', 'strict', 'high_review']).optional(),
    audit_hint: z.string().optional(),
  })
  .strict()

// =============================================================================
// AdmissionPolicy + LoadPolicy on the cue itself — design doc §6.6
// =============================================================================

export interface CueAdmissionPolicy {
  on_global_overload: 'defer' | 'skip' | 'require_review'
  on_community_overload: 'defer' | 'merge' | 'skip' | 'require_review'
  on_media_overload: 'degrade_media' | 'defer' | 'skip'
  on_agent_pool_empty: 'fallback' | 'defer' | 'skip'
  max_deferral_minutes: number
}

export interface CueLoadPolicy {
  min_gap_seconds_per_community?: number
  max_due_cues_per_community_30m?: number
  max_executing_cues_per_community?: number
  max_root_posts_per_community_20m?: number
  max_global_visible_llm_queue_depth?: number
}

export const CueAdmissionPolicySchema = z
  .object({
    on_global_overload: z.enum(['defer', 'skip', 'require_review']),
    on_community_overload: z.enum(['defer', 'merge', 'skip', 'require_review']),
    on_media_overload: z.enum(['degrade_media', 'defer', 'skip']),
    on_agent_pool_empty: z.enum(['fallback', 'defer', 'skip']),
    max_deferral_minutes: z.number().int().min(0),
  })
  .strict()

export const CueLoadPolicySchema = z
  .object({
    min_gap_seconds_per_community: z.number().int().min(0).optional(),
    max_due_cues_per_community_30m: z.number().int().min(0).optional(),
    max_executing_cues_per_community: z.number().int().min(0).optional(),
    max_root_posts_per_community_20m: z.number().int().min(0).optional(),
    max_global_visible_llm_queue_depth: z.number().int().min(0).optional(),
  })
  .strict()

// =============================================================================
// PublicDiscussionCueDomain — repository return shape
// =============================================================================

export type CueSourceType = 'manual' | 'automated' | 'baseline' | 'system'

export type CueLane = 'prime' | 'standard' | 'background'

export type CueRiskLevel = 'low' | 'standard' | 'high' | 'strict_review'

export type PublicDiscussionCueStatus =
  | 'draft'
  | 'validating'
  | 'validated'
  | 'scheduled'
  | 'prewarming'
  | 'due'
  | 'claimed'
  | 'executing'
  | 'consumed'
  | 'deferred'
  | 'skipped'
  | 'expired'
  | 'cancelled'
  | 'failed'

export interface PublicDiscussionCueDomain {
  id: string
  schedule_id: string
  source_type: CueSourceType
  status: PublicDiscussionCueStatus
  community_id?: string
  scope: CueCommunityScope

  trigger_at: string // ISO datetime
  timezone: string
  prewarm_at?: string
  latest_start_at?: string
  expire_at?: string

  priority: number
  lane: CueLane

  dispatch_policy: DispatchPolicy
  admission_policy?: CueAdmissionPolicy
  load_policy?: CueLoadPolicy

  theme_intent: CueThemeIntent
  scene_constraints: CueSceneConstraints
  role_requirements: CueRoleRequirementVector
  media_policy?: CueMediaPolicy

  safety?: CueSafetyPolicy
  locked_fields: string[]

  risk_level: CueRiskLevel

  revision: number
  idempotency_key: string

  created_by_user_id?: string
  created_by_system?: string
  created_at: string
  updated_at: string
}

const CueLaneEnum = z.enum(['prime', 'standard', 'background'])
const CueRiskLevelEnum = z.enum(['low', 'standard', 'high', 'strict_review'])
const CueSourceTypeEnum = z.enum(['manual', 'automated', 'baseline', 'system'])
const PublicDiscussionCueStatusEnum = z.enum([
  'draft',
  'validating',
  'validated',
  'scheduled',
  'prewarming',
  'due',
  'claimed',
  'executing',
  'consumed',
  'deferred',
  'skipped',
  'expired',
  'cancelled',
  'failed',
])

const isoDateString = z.string().min(1).refine(
  (s) => !Number.isNaN(Date.parse(s)),
  { message: 'must be a valid ISO 8601 datetime string' },
)

export const PublicDiscussionCueDomainSchema = z
  .object({
    id: z.string().min(1),
    schedule_id: z.string().min(1),
    source_type: CueSourceTypeEnum,
    status: PublicDiscussionCueStatusEnum,
    community_id: z.string().optional(),
    scope: CueCommunityScopeSchema,

    trigger_at: isoDateString,
    timezone: z.string().min(1),
    prewarm_at: isoDateString.optional(),
    latest_start_at: isoDateString.optional(),
    expire_at: isoDateString.optional(),

    priority: z.number().int().min(0).max(100),
    lane: CueLaneEnum,

    dispatch_policy: DispatchPolicySchema,
    admission_policy: CueAdmissionPolicySchema.optional(),
    load_policy: CueLoadPolicySchema.optional(),

    theme_intent: CueThemeIntentSchema,
    scene_constraints: CueSceneConstraintsSchema,
    role_requirements: CueRoleRequirementVectorSchema,
    media_policy: CueMediaPolicySchema.optional(),

    safety: CueSafetyPolicySchema.optional(),
    locked_fields: z.array(z.string().min(1)),

    risk_level: CueRiskLevelEnum,

    revision: z.number().int().min(1),
    idempotency_key: z.string().min(1),

    created_by_user_id: z.string().optional(),
    created_by_system: z.string().optional(),
    created_at: isoDateString,
    updated_at: isoDateString,
  })
  .strict()

// =============================================================================
// LockedFieldsSchema — used by repositories on JSON column hydration.
// Stored as a JSON array of dot-paths into the editable cue surface.
// =============================================================================

export const LockedFieldsSchema = z.array(z.string().min(1)).default([])

