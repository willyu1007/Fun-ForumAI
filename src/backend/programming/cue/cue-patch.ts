/**
 * T-209 cue-data-and-board — `CuePatchV1` and forbidden-field SSOT.
 *
 * `CuePatchV1` is the canonical patch envelope for any cue mutation,
 * authored by either the admin editor (T-210) or the auto-editor (T-214).
 * It carries:
 *   - a partial cue domain payload (any editable subset)
 *   - an explicit `removed_fields[]` array (used by edit / merge / cancel flows)
 *   - a top-level `version` for forward-compatible schema evolution
 *
 * The forbidden-field constant `FORBIDDEN_CUE_FIELDS` is the single source
 * of truth for fields that MUST NOT appear in any cue, patch, or auto-editor
 * output. Both schema-layer and server-side validators import it. T-210 and
 * T-214 reuse it; do not duplicate the list.
 */

import { z } from 'zod'
import {
  CueAdmissionPolicySchema,
  CueLoadPolicySchema,
  CueMediaPolicySchema,
  CueRoleRequirementVectorSchema,
  CueSafetyPolicySchema,
  CueSceneConstraintsSchema,
  CueThemeIntentSchema,
} from './types.js'
import { DispatchPolicySchema } from '../contract/index.js'

// =============================================================================
// Forbidden field SSOT (umbrella §3 / design-doc Appendix B)
// =============================================================================

export const FORBIDDEN_CUE_FIELDS = [
  'candidate_agent_ids',
  'preferred_agent_ids',
  'fallback_agent_ids',
  'selected_agent_id',
  'selected_cast',
  'post_type',
  'content_kind',
  'actor_surface',
  'root_post_required',
  'reply_required',
  'chat_message_required',
  'display_attribution',
  'home_shelf_id',
  'highlight_candidate',
  'aftershow_target',
  'expected_outputs',
  'must_hit_points',
  'post_title',
  'post_body',
  'agent_dialogue',
  'private_owner_memory',
] as const

export type ForbiddenCueField = (typeof FORBIDDEN_CUE_FIELDS)[number]

const FORBIDDEN_SET: ReadonlySet<string> = new Set(FORBIDDEN_CUE_FIELDS)

export function isForbiddenCueField(name: string): name is ForbiddenCueField {
  return FORBIDDEN_SET.has(name)
}

// =============================================================================
// PartialPublicDiscussionCue — the editable surface of a cue.
// Only fields admins / auto-editor can touch; identity, audit, and forbidden
// fields are not part of the patch.
// =============================================================================

export const PartialPublicDiscussionCueSchema = z
  .object({
    // Trigger / dispatch (editable)
    trigger_at: z
      .string()
      .min(1)
      .refine((s) => !Number.isNaN(Date.parse(s)), {
        message: 'must be a valid ISO 8601 datetime string',
      })
      .optional(),
    timezone: z.string().min(1).optional(),
    prewarm_at: z.string().optional(),
    latest_start_at: z.string().optional(),
    expire_at: z.string().optional(),
    priority: z.number().int().min(0).max(100).optional(),
    lane: z.enum(['prime', 'standard', 'background']).optional(),
    dispatch_policy: DispatchPolicySchema.optional(),
    admission_policy: CueAdmissionPolicySchema.optional(),
    load_policy: CueLoadPolicySchema.optional(),

    // Scope (editable)
    community_id: z.string().optional(),

    // Editorial (editable)
    theme_intent: CueThemeIntentSchema.optional(),
    scene_constraints: CueSceneConstraintsSchema.optional(),
    role_requirements: CueRoleRequirementVectorSchema.optional(),
    media_policy: CueMediaPolicySchema.optional(),

    // Safety / governance (editable)
    safety: CueSafetyPolicySchema.optional(),
    locked_fields: z.array(z.string().min(1)).optional(),
    risk_level: z.enum(['low', 'standard', 'high', 'strict_review']).optional(),
  })
  .strict()

export type PartialPublicDiscussionCue = z.infer<
  typeof PartialPublicDiscussionCueSchema
>

// =============================================================================
// CuePatchV1
// =============================================================================

const PARTIAL_KEY_SET = new Set(
  Object.keys(PartialPublicDiscussionCueSchema.shape),
)

export const CuePatchV1Schema = z
  .object({
    version: z.literal(1),
    partial: PartialPublicDiscussionCueSchema,
    removed_fields: z.array(z.string().min(1)).optional(),
  })
  .strict()
  .superRefine((patch, ctx) => {
    // Reject any forbidden field appearing in `partial` keys
    for (const key of Object.keys(patch.partial)) {
      if (isForbiddenCueField(key)) {
        ctx.addIssue({
          code: 'custom',
          message: `forbidden field "${key}" is not allowed in cue patch`,
          path: ['partial', key],
        })
      }
    }
    // Reject forbidden fields and unknown fields in `removed_fields`
    for (const removed of patch.removed_fields ?? []) {
      if (isForbiddenCueField(removed)) {
        ctx.addIssue({
          code: 'custom',
          message: `forbidden field "${removed}" cannot appear in removed_fields`,
          path: ['removed_fields'],
        })
        continue
      }
      if (!PARTIAL_KEY_SET.has(removed)) {
        ctx.addIssue({
          code: 'custom',
          message: `removed_fields entry "${removed}" is not an editable cue field`,
          path: ['removed_fields'],
        })
      }
    }
  })

export type CuePatchV1 = z.infer<typeof CuePatchV1Schema>

// =============================================================================
// applyCuePatch — domain-level merge helper.
//
// Given a base partial-cue and a patch, produce a merged partial-cue suitable
// for persistence. `removed_fields` clears the listed top-level keys from the
// merged output. `partial` is shallow-merged on top of base.
//
// Note: this operates on the **editable surface** (PartialPublicDiscussionCue),
// not the full domain entity. The repository combines this with identity /
// audit fields when persisting.
// =============================================================================

export function applyCuePatch(
  base: PartialPublicDiscussionCue,
  patch: CuePatchV1,
): PartialPublicDiscussionCue {
  const merged: Record<string, unknown> = { ...base, ...patch.partial }
  for (const key of patch.removed_fields ?? []) {
    delete merged[key]
  }
  // Re-validate the merged shape to ensure post-merge consistency
  return PartialPublicDiscussionCueSchema.parse(merged)
}
