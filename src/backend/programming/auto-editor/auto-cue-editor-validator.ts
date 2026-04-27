/**
 * T-214 A-M2 — `AutoCueEditorValidator`.
 *
 * Layered defense between the LLM and the inbox:
 *
 *   1. **Schema** — `AutoCueEditorOutputSchema` (Zod). Off-shape JSON is
 *      rejected before any field is read.
 *   2. **CuePatchV1** — `CuePatchV1Schema.safeParse` (already enforces
 *      `FORBIDDEN_CUE_FIELDS` via `superRefine` on `partial` and on
 *      `removed_fields`).
 *   3. **Forbidden-field backstop** — explicit second pass over the
 *      patch keys against `FORBIDDEN_CUE_FIELDS`. Defense in depth: if
 *      the schema ever loosens, the backstop still trips.
 *   4. **Locked-fields** — `validateLockedFields` (T-210 helper) checks
 *      the patch doesn't touch any path the cue's owner has marked
 *      immutable.
 *   5. **Media-asset whitelist** — every `asset_id` referenced in the
 *      patch's `media_policy.media_resource_pool` (and via media-attach
 *      shapes) must come from the input candidate set the editor was
 *      handed. This blocks the LLM from inventing asset ids.
 *   6. **Action × allowed_actions** — the patch's declared action MUST
 *      be in the LoadGate's `allowed_actions` for this run.
 *
 * Reuses the manual editor's `cue-patch.ts` SSOT — never duplicates
 * forbidden lists, schemas, or locked-field semantics.
 */

import { z } from 'zod'
import {
  CuePatchV1Schema,
  FORBIDDEN_CUE_FIELDS,
  isForbiddenCueField,
  type CuePatchV1,
} from '../cue/cue-patch.js'
import type { CueChangeType } from '../../repos/cue-repository.js'
import type { AutoCueEditorOutput } from './types.js'

// =============================================================================
// AutoCueEditorOutputSchema — what the LLM must shape its JSON as.
// =============================================================================

const ALLOWED_CUE_CHANGE_TYPES = [
  'create_cue',
  'update_cue',
  'cancel_cue',
  'defer_cue',
  'merge_into_existing_cue',
  'split_cue',
  'attach_media',
  'remove_media',
  'update_dispatch_policy',
  'update_risk_level',
  'publish_schedule',
  'rollback_schedule',
] as const

export const AutoCueEditorOutputSchema = z
  .object({
    action: z.enum(ALLOWED_CUE_CHANGE_TYPES),
    reason: z.string().min(1).max(500),
    risk_level: z.enum(['low', 'standard', 'high']),
    target_cue_id: z.string().min(1).optional().nullable(),
    patch_json: CuePatchV1Schema,
    confidence: z.number().min(0).max(1),
    requires_review: z.boolean(),
  })
  .strict()

// =============================================================================
// Validation result envelope
// =============================================================================

export type AutoCueEditorValidationFailureCode =
  | 'off_schema'
  | 'forbidden_field'
  | 'locked_field_violation'
  | 'unauthorized_media_asset'
  | 'action_not_allowed'
  | 'patch_action_mismatch'

export interface AutoCueEditorValidationFailure {
  code: AutoCueEditorValidationFailureCode
  message: string
  /** When known, the path within the patch that triggered the rejection. */
  path?: ReadonlyArray<string | number>
  /** Forbidden field names / asset ids / paths that triggered the failure. */
  offending?: ReadonlyArray<string>
}

export type AutoCueEditorValidationResult =
  | { ok: true; output: AutoCueEditorOutput }
  | { ok: false; failures: AutoCueEditorValidationFailure[] }

export interface AutoCueEditorValidationContext {
  /**
   * Asset ids the editor was permitted to reference (typically the
   * filtered set passed into `AutoCueEditor.generate({media_candidates})`).
   * Empty array means "no media may be attached / referenced"; the
   * validator rejects any media reference in that case.
   */
  authorizedMediaAssetIds: ReadonlyArray<string>
  /** Allowed action set from `LoadGate.evaluate(...)`. */
  allowedActions: ReadonlyArray<CueChangeType>
  /**
   * Locked field paths the patch must not touch. Sourced from the
   * target cue's `locked_fields[]` (when editing an existing cue) or
   * empty (when creating a new cue).
   */
  lockedFields: ReadonlyArray<string>
}

// =============================================================================
// Validator
// =============================================================================

export class AutoCueEditorValidator {
  /**
   * Validate raw LLM JSON output. The text is parsed once and then
   * walked through the layered checks. Multiple failures are collected
   * (instead of short-circuiting on the first) so the caller can log
   * everything that's wrong with one run.
   */
  validate(
    rawJson: unknown,
    context: AutoCueEditorValidationContext,
  ): AutoCueEditorValidationResult {
    const parsed = AutoCueEditorOutputSchema.safeParse(rawJson)
    if (!parsed.success) {
      return {
        ok: false,
        failures: [
          {
            code: 'off_schema',
            message: parsed.error.issues
              .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
              .join('; '),
          },
        ],
      }
    }

    const output = parsed.data as AutoCueEditorOutput & { patch_json: CuePatchV1 }
    const failures: AutoCueEditorValidationFailure[] = []

    // Layer 3 — forbidden-field backstop (CuePatchV1Schema also enforces,
    // but a second sweep guards against future schema relaxation).
    failures.push(...this.scanForbiddenFields(output.patch_json))

    // Layer 4 — locked-field collision.
    failures.push(
      ...this.scanLockedFields(output.patch_json, context.lockedFields),
    )

    // Layer 5 — media-asset whitelist.
    failures.push(
      ...this.scanMediaWhitelist(
        output.patch_json,
        context.authorizedMediaAssetIds,
      ),
    )

    // Layer 6 — action surface check (LoadGate-allowed only).
    if (!context.allowedActions.includes(output.action)) {
      failures.push({
        code: 'action_not_allowed',
        message: `action "${output.action}" is not in the load-gate allowed actions for this run`,
        offending: [output.action],
      })
    }

    // Patch-action sanity: action `create_cue` should not carry
    // `target_cue_id`; everything else should. (Missing target on
    // non-create is suspicious but not always wrong; we only block the
    // truly inconsistent shape.)
    if (output.action === 'create_cue' && output.target_cue_id) {
      failures.push({
        code: 'patch_action_mismatch',
        message: `action "create_cue" must not carry a target_cue_id`,
      })
    }

    if (failures.length > 0) {
      return { ok: false, failures }
    }
    return { ok: true, output }
  }

  /**
   * Walk every key under `patch.partial` (recursively) and reject any
   * key listed in `FORBIDDEN_CUE_FIELDS`. Recursion is required because
   * a malicious LLM could nest a forbidden key inside a non-strict
   * sub-object. The CuePatchV1Schema enforces a `.strict()` shape on the
   * top-level keys; this scan adds defense in depth across nested
   * payloads (e.g. `media_policy.candidate_agent_ids`).
   */
  private scanForbiddenFields(
    patch: CuePatchV1,
  ): AutoCueEditorValidationFailure[] {
    const offending = new Set<string>()
    walkKeys(patch.partial, (key) => {
      if (isForbiddenCueField(key)) offending.add(key)
    })
    if (offending.size === 0) return []
    return [
      {
        code: 'forbidden_field',
        message: `forbidden field(s) present in patch: ${[...offending].join(', ')}`,
        offending: [...offending],
      },
    ]
  }

  /**
   * Reject the patch if any `partial` key OR `removed_fields` entry
   * collides with a locked field path. T-210's
   * `validateLockedFields` is path-aware (dot-paths); for M1 we use a
   * simpler shallow comparison: a locked field path's first segment
   * must not appear in the patch's top-level keys / removed_fields.
   * The richer dot-path check lands in A-M3 alongside admin route
   * validation.
   */
  private scanLockedFields(
    patch: CuePatchV1,
    lockedFields: ReadonlyArray<string>,
  ): AutoCueEditorValidationFailure[] {
    if (lockedFields.length === 0) return []
    const lockedTopLevels = new Set(
      lockedFields.map((path) => path.split('.', 1)[0]).filter(Boolean),
    )
    const offending: string[] = []
    for (const key of Object.keys(patch.partial)) {
      if (lockedTopLevels.has(key)) offending.push(key)
    }
    for (const removed of patch.removed_fields ?? []) {
      const top = removed.split('.', 1)[0]
      if (top && lockedTopLevels.has(top) && !offending.includes(top)) {
        offending.push(top)
      }
    }
    if (offending.length === 0) return []
    return [
      {
        code: 'locked_field_violation',
        message: `patch touches locked field(s): ${offending.join(', ')}`,
        offending,
      },
    ]
  }

  /**
   * Collect every `asset_id` literal under the patch and verify it is
   * in the authorized list. The CuePatchV1 surface places media refs
   * in `partial.media_policy.media_resource_pool[*].asset_id`; an
   * unauthorized id signals the LLM tried to reference an asset
   * outside the candidate set it was given.
   */
  private scanMediaWhitelist(
    patch: CuePatchV1,
    authorizedIds: ReadonlyArray<string>,
  ): AutoCueEditorValidationFailure[] {
    const authorized = new Set(authorizedIds)
    const found: string[] = []
    walkValues(patch.partial, (value, parentKey) => {
      if (parentKey !== 'asset_id') return
      if (typeof value !== 'string') return
      if (!authorized.has(value)) found.push(value)
    })
    if (found.length === 0) return []
    return [
      {
        code: 'unauthorized_media_asset',
        message: `patch references asset_id(s) outside the authorized candidate set: ${found.join(', ')}`,
        offending: [...new Set(found)],
      },
    ]
  }
}

/**
 * Recursively visit every key in a record-like value, calling
 * `visitor(key)` once per descent. Arrays are descended index-wise but
 * indexes are not surfaced (we only care about object keys). Stops at
 * primitives.
 */
function walkKeys(
  node: unknown,
  visitor: (key: string) => void,
): void {
  if (node === null || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) walkKeys(item, visitor)
    return
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    visitor(key)
    walkKeys(value, visitor)
  }
}

/**
 * Recursively visit every leaf value, surfacing the immediate parent key
 * so the visitor can act on `(asset_id, value)` tuples without
 * reconstructing the path.
 */
function walkValues(
  node: unknown,
  visitor: (value: unknown, parentKey: string | null) => void,
  parentKey: string | null = null,
): void {
  if (node === null || typeof node !== 'object') {
    visitor(node, parentKey)
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) walkValues(item, visitor, parentKey)
    return
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    walkValues(value, visitor, key)
  }
}

/** Re-export for tests / observability. */
export { FORBIDDEN_CUE_FIELDS }
