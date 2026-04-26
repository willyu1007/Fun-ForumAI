/**
 * T-210 M1 — Cue Editor Service.
 *
 * Manual cue mutation pipeline: validate (schema → forbidden → locked →
 * deterministic) → apply repo update → record CueChange row with
 * `source='manual'` and `approval_status='auto_applied'` (per
 * cue-editor-admin/02-architecture.md DEC-T210-A).
 *
 * Atomicity note: the underlying CueRepository does not expose a transaction
 * primitive. This service applies a best-effort write-then-record pattern with
 * compensating rollback on change-row failure. For PG, transactional safety is
 * a follow-up (wrap repo operations in `prisma.$transaction`).
 *
 * Forbidden-field SSOT: cue-patch.ts FORBIDDEN_CUE_FIELDS. The CuePatchV1Schema
 * `superRefine` is the first line; the service's `assertNoForbiddenFields`
 * pass is a server-side backstop that runs on the parsed patch.
 *
 * Locked-fields validator: shared with T-214 (auto-editor) — see
 * locked-fields-validator.ts.
 */

import { ZodError } from 'zod'
import { ConflictError, NotFoundError, ValidationError } from '../lib/errors.js'
import {
  CuePatchV1Schema,
  applyCuePatch,
  isForbiddenCueField,
  PartialPublicDiscussionCueSchema,
  type CuePatchV1,
  type PartialPublicDiscussionCue,
} from '../programming/cue/cue-patch.js'
import {
  validateLockedFields,
  type LockedFieldsViolation,
} from '../programming/cue/locked-fields-validator.js'
import type {
  CueChangeType,
  CueRepository,
  PublicDiscussionCueChangeDomain,
  PublicDiscussionCueScheduleDomain,
  UpdateCueInput,
  AttachCueMediaInput,
} from '../repos/cue-repository.js'
import type {
  PublicDiscussionCueDomain,
  PublicDiscussionCueStatus,
  CueAdmissionPolicy,
  CueLoadPolicy,
  CueMediaPolicy,
  CueRiskLevel,
  CueRoleRequirementVector,
  CueSafetyPolicy,
  CueSceneConstraints,
  CueThemeIntent,
  CueLane,
} from '../programming/cue/types.js'
import type { DispatchPolicy } from '../programming/contract/index.js'

// =============================================================================
// Actor (subset of AuthenticatedUser the service needs)
// =============================================================================

export interface CueEditorActor {
  userId: string
  role: 'admin' | 'user'
}

// =============================================================================
// Inputs
// =============================================================================

/**
 * The minimum set of fields needed to create a cue. CuePatchV1 carries the
 * editable surface; identity fields (schedule_id, scope, source_type) come
 * outside the patch envelope.
 */
export interface CueCreateBundle {
  scheduleId: string
  scope: import('../programming/cue/types.js').CueCommunityScope
  patch: CuePatchV1
}

// Required-on-create fields of the editable surface. If a create-bundle does
// not supply these (via patch.partial), the service rejects.
const REQUIRED_ON_CREATE: ReadonlyArray<keyof PartialPublicDiscussionCue> = [
  'trigger_at',
  'theme_intent',
  'scene_constraints',
  'role_requirements',
  'dispatch_policy',
]

// Top-level keys whose underlying domain type is `T | undefined` and can
// therefore be cleared via removed_fields.
const CLEARABLE_OPTIONAL_KEYS: ReadonlyArray<keyof PartialPublicDiscussionCue> = [
  'prewarm_at',
  'latest_start_at',
  'expire_at',
  'admission_policy',
  'load_policy',
  'media_policy',
  'safety',
  'community_id',
]

// =============================================================================
// Errors
// =============================================================================

export class ForbiddenFieldError extends ValidationError {
  constructor(public readonly violations: { field: string; in: 'partial' | 'removed_fields' }[]) {
    super(
      `forbidden field(s) in patch: ${violations.map((v) => `${v.in}.${v.field}`).join(', ')}`,
      violations,
    )
  }
}

export class LockedFieldError extends ValidationError {
  constructor(public readonly violations: LockedFieldsViolation[]) {
    super(
      `patch touches locked field(s): ${violations
        .map((v) => `${v.patchPath}<-${v.lockedBy}`)
        .join(', ')}`,
      violations,
    )
  }
}

export class DeterministicValidationError extends ValidationError {
  constructor(public readonly issues: string[]) {
    super(`deterministic validation failed: ${issues.join('; ')}`, issues)
  }
}

// =============================================================================
// Service
// =============================================================================

export interface CueEditorServiceDeps {
  repo: CueRepository
  /** `now()` factory for testability. */
  now?: () => Date
  /**
   * T-212 cancel-cascade hook. When `rollbackSchedule` records the schedule
   * transition, this handler walks the affected cues and cancels those
   * still in pre-execution states (run-to-completion preserved for cues
   * already `claimed` / `executing`). MVP without a handler keeps the old
   * "schedule-only" behavior for backward compat with the T-210 test
   * fixtures, but production wiring (`container/index.ts`) MUST supply it.
   */
  scheduleRollbackHandler?: {
    apply(input: {
      scheduleId: string
      affectedCueIds: string[]
      actor: { actor_type: 'agent' | 'human' | 'system'; actor_id: string | null }
      reason?: string
    }): Promise<{
      cancelled: string[]
      inFlight: string[]
      noop: string[]
      missing: string[]
    }>
  }
}

export class CueEditorService {
  private readonly repo: CueRepository
  private readonly now: () => Date
  private readonly scheduleRollbackHandler?: CueEditorServiceDeps['scheduleRollbackHandler']

  constructor(deps: CueEditorServiceDeps) {
    this.repo = deps.repo
    this.now = deps.now ?? (() => new Date())
    this.scheduleRollbackHandler = deps.scheduleRollbackHandler
  }

  // ---------------------------------------------------------------------------
  // createCueDraft
  // ---------------------------------------------------------------------------

  async createCueDraft(
    bundle: CueCreateBundle,
    actor: CueEditorActor,
  ): Promise<{ cue: PublicDiscussionCueDomain; change: PublicDiscussionCueChangeDomain }> {
    const patch = this.parsePatch(bundle.patch)
    this.assertNoForbiddenFields(patch)

    // No old state to compare against; locked-fields validation is meaningful
    // only on update. But if patch.partial.locked_fields is supplied at create,
    // it is recorded as the initial lockset.
    const partial = patch.partial

    for (const required of REQUIRED_ON_CREATE) {
      if (partial[required] === undefined) {
        throw new ValidationError(
          `cue create requires \`partial.${required}\` to be set`,
          { field: required },
        )
      }
    }

    const schedule = await this.repo.findScheduleById(bundle.scheduleId)
    if (!schedule) {
      throw new NotFoundError('CueSchedule', bundle.scheduleId)
    }
    this.assertScheduleEditable(schedule)

    this.runDeterministicChecks({
      partial,
      scheduleBoundary: { from: schedule.date_range_start, to: schedule.date_range_end },
      now: this.now(),
    })

    const cue = await this.repo.createCue({
      schedule_id: bundle.scheduleId,
      source_type: 'manual',
      status: 'draft',
      community_id: partial.community_id ?? null,
      scope: bundle.scope,
      trigger_at: new Date(partial.trigger_at as string),
      timezone: partial.timezone,
      prewarm_at: optionalDate(partial.prewarm_at),
      latest_start_at: optionalDate(partial.latest_start_at),
      expire_at: optionalDate(partial.expire_at),
      priority: partial.priority,
      lane: partial.lane,
      dispatch_policy: partial.dispatch_policy as DispatchPolicy,
      admission_policy: partial.admission_policy as CueAdmissionPolicy | undefined,
      load_policy: partial.load_policy as CueLoadPolicy | undefined,
      theme_intent: partial.theme_intent as CueThemeIntent,
      scene_constraints: partial.scene_constraints as CueSceneConstraints,
      role_requirements: partial.role_requirements as CueRoleRequirementVector,
      media_policy: partial.media_policy as CueMediaPolicy | undefined,
      safety: partial.safety as CueSafetyPolicy | undefined,
      locked_fields: partial.locked_fields,
      risk_level: partial.risk_level,
      created_by_user_id: actor.userId,
    })

    const change = await this.recordChangeWithRollback({
      previousCueState: null,
      currentCueState: cue,
      input: {
        schedule_id: bundle.scheduleId,
        cue_id: cue.id,
        source: 'manual',
        actor_user_id: actor.userId,
        change_type: 'create_cue',
        base_revision: 0,
        patch_json: patch,
        validation_status: 'passed',
        risk_level: cue.risk_level,
        approval_status: 'auto_applied',
        applied_at: this.now(),
      },
    })

    return { cue, change }
  }

  // ---------------------------------------------------------------------------
  // updateCue
  // ---------------------------------------------------------------------------

  async updateCue(
    cueId: string,
    rawPatch: unknown,
    actor: CueEditorActor,
  ): Promise<{ cue: PublicDiscussionCueDomain; change: PublicDiscussionCueChangeDomain }> {
    const patch = this.parsePatch(rawPatch)
    this.assertNoForbiddenFields(patch)

    const existing = await this.repo.findCueById(cueId)
    if (!existing) throw new NotFoundError('Cue', cueId)
    this.assertCueEditable(existing)

    const oldEditable = extractEditable(existing)
    const lockedPaths = existing.locked_fields ?? []

    // Reject any removed_fields that target required keys.
    if (patch.removed_fields && patch.removed_fields.length > 0) {
      const invalidRemovals = patch.removed_fields.filter((field) =>
        REQUIRED_ON_CREATE.includes(field as keyof PartialPublicDiscussionCue) ||
        !CLEARABLE_OPTIONAL_KEYS.includes(field as keyof PartialPublicDiscussionCue),
      )
      if (invalidRemovals.length > 0) {
        throw new ValidationError(
          `cannot remove required or non-clearable field(s): ${invalidRemovals.join(', ')}`,
          { invalidRemovals },
        )
      }
    }

    // Locked-fields validation runs on the actual patch, against old state.
    const lockViolations = validateLockedFields({
      oldPartial: oldEditable,
      patch,
      lockedPaths,
    })
    if (lockViolations.length > 0) {
      throw new LockedFieldError(lockViolations)
    }

    // Deterministic validation runs on the post-merge state.
    const merged = applyCuePatch(oldEditable, patch)
    const schedule = await this.repo.findScheduleById(existing.schedule_id)
    if (!schedule) {
      throw new NotFoundError('CueSchedule', existing.schedule_id)
    }
    this.runDeterministicChecks({
      partial: merged,
      scheduleBoundary: { from: schedule.date_range_start, to: schedule.date_range_end },
      now: this.now(),
    })

    // Snapshot revision before update because the in-memory repo mutates the
    // cue object in place (PG returns fresh objects, so this is a no-op there).
    const baseRevision = existing.revision

    const updateInput = patchToUpdateInput(patch)
    const updated = await this.repo.updateCue(cueId, updateInput)
    if (!updated) throw new NotFoundError('Cue', cueId)

    const change = await this.recordChangeWithRollback({
      previousCueState: existing,
      currentCueState: updated,
      input: {
        schedule_id: existing.schedule_id,
        cue_id: cueId,
        source: 'manual',
        actor_user_id: actor.userId,
        change_type: 'update_cue',
        base_revision: baseRevision,
        patch_json: patch,
        validation_status: 'passed',
        risk_level: updated.risk_level,
        approval_status: 'auto_applied',
        applied_at: this.now(),
      },
    })

    return { cue: updated, change }
  }

  // ---------------------------------------------------------------------------
  // cancelCue / forceSkipCue
  // ---------------------------------------------------------------------------

  async cancelCue(
    cueId: string,
    actor: CueEditorActor,
    reason?: string,
  ): Promise<{ cue: PublicDiscussionCueDomain; change: PublicDiscussionCueChangeDomain }> {
    return this.transitionCueStatus({
      cueId,
      actor,
      kind: 'cancel',
      targetStatus: 'cancelled',
      reason: reason ?? null,
    })
  }

  async forceSkipCue(
    cueId: string,
    actor: CueEditorActor,
    reason?: string,
  ): Promise<{ cue: PublicDiscussionCueDomain; change: PublicDiscussionCueChangeDomain }> {
    return this.transitionCueStatus({
      cueId,
      actor,
      kind: 'force_skip',
      targetStatus: 'skipped',
      reason: reason ?? 'force_skip',
    })
  }

  private async transitionCueStatus(input: {
    cueId: string
    actor: CueEditorActor
    kind: 'cancel' | 'force_skip'
    targetStatus: PublicDiscussionCueStatus
    reason: string | null
  }): Promise<{ cue: PublicDiscussionCueDomain; change: PublicDiscussionCueChangeDomain }> {
    const existing = await this.repo.findCueById(input.cueId)
    if (!existing) throw new NotFoundError('Cue', input.cueId)

    if (input.kind === 'cancel') {
      // cancel applies to pre-execution states (excluding 'executing'); umbrella semantics.
      const allowedFrom: PublicDiscussionCueStatus[] = [
        'draft',
        'validating',
        'validated',
        'scheduled',
        'prewarming',
        'due',
        'deferred',
      ]
      if (!allowedFrom.includes(existing.status)) {
        throw new ConflictError(
          `cannot cancel cue in status '${existing.status}'`,
          { current_status: existing.status },
        )
      }
    }
    // force_skip is permitted from a wider set including 'due' / 'executing';
    // T-212 owns 'executing' semantics. T-210 still records the intent here;
    // worker-side observation is T-212.

    const updated = await this.repo.setCueStatus(input.cueId, input.targetStatus)
    if (!updated) throw new NotFoundError('Cue', input.cueId)

    const change = await this.recordChangeWithRollback({
      previousCueState: existing,
      currentCueState: updated,
      // Both kinds use change_type='cancel_cue'; reason discriminates.
      input: {
        schedule_id: existing.schedule_id,
        cue_id: input.cueId,
        source: 'manual',
        actor_user_id: input.actor.userId,
        change_type: 'cancel_cue',
        base_revision: existing.revision,
        patch_json: {
          version: 1,
          partial: {},
          transition: { from: existing.status, to: input.targetStatus, kind: input.kind },
        },
        validation_status: 'passed',
        risk_level: existing.risk_level,
        approval_status: 'auto_applied',
        reason: input.reason,
        applied_at: this.now(),
      },
    })

    return { cue: updated, change }
  }

  // ---------------------------------------------------------------------------
  // attachMedia / removeMedia
  // ---------------------------------------------------------------------------

  async attachCueMedia(
    cueId: string,
    input: Omit<AttachCueMediaInput, 'cue_id' | 'created_by_type' | 'created_by_id'>,
    actor: CueEditorActor,
  ): Promise<{ media_id: string; change: PublicDiscussionCueChangeDomain }> {
    const cue = await this.repo.findCueById(cueId)
    if (!cue) throw new NotFoundError('Cue', cueId)
    this.assertCueEditable(cue)

    // T-216 M0 (2026-04-26): semantics unlock — all four `usage_strength`
    // values are now accepted at the validator. Runtime media planner still
    // treats `anchor` and `selected_only_pool` as `preferred` (no behavior
    // change); real strength-aware routing lands in T-216 M2/M3.
    // TODO(T-216 M3): gate `anchor` / `selected_only_pool` behind the
    // `manage_programming_media` permission once that permission ships.
    if (input.use_policy === 'require_public_display') {
      throw new ValidationError(
        'use_policy "require_public_display" is not exposed in MVP (umbrella D-11)',
        { rejected_value: input.use_policy },
      )
    }

    const media = await this.repo.attachMedia({
      cue_id: cueId,
      asset_id: input.asset_id,
      semantic_snapshot_id: input.semantic_snapshot_id ?? null,
      role: input.role,
      usage_strength: input.usage_strength,
      use_policy: input.use_policy,
      selection_note: input.selection_note ?? null,
      sort_order: input.sort_order,
      reuse_limit: input.reuse_limit,
      validation_status: input.validation_status,
      validation_reason: input.validation_reason,
      created_by_type: 'admin',
      created_by_id: actor.userId,
    })

    const change = await this.repo.recordChange({
      schedule_id: cue.schedule_id,
      cue_id: cueId,
      source: 'manual',
      actor_user_id: actor.userId,
      change_type: 'attach_media',
      base_revision: cue.revision,
      patch_json: {
        version: 1,
        partial: {},
        media: {
          op: 'attach',
          asset_id: input.asset_id,
          role: input.role,
          usage_strength: input.usage_strength,
          use_policy: input.use_policy,
          media_id: media.id,
        },
      },
      validation_status: 'passed',
      risk_level: cue.risk_level,
      approval_status: 'auto_applied',
      applied_at: this.now(),
    })

    return { media_id: media.id, change }
  }

  async removeCueMedia(
    cueId: string,
    mediaId: string,
    actor: CueEditorActor,
  ): Promise<{ removed: boolean; change: PublicDiscussionCueChangeDomain }> {
    const cue = await this.repo.findCueById(cueId)
    if (!cue) throw new NotFoundError('Cue', cueId)
    this.assertCueEditable(cue)

    const removed = await this.repo.removeMedia(mediaId)
    if (!removed) {
      throw new NotFoundError('CueMedia', mediaId)
    }

    const change = await this.repo.recordChange({
      schedule_id: cue.schedule_id,
      cue_id: cueId,
      source: 'manual',
      actor_user_id: actor.userId,
      change_type: 'remove_media',
      base_revision: cue.revision,
      patch_json: {
        version: 1,
        partial: {},
        media: { op: 'remove', media_id: mediaId },
      },
      validation_status: 'passed',
      risk_level: cue.risk_level,
      approval_status: 'auto_applied',
      applied_at: this.now(),
    })

    return { removed, change }
  }

  // ---------------------------------------------------------------------------
  // publishCue (cue-level: draft → scheduled)
  // ---------------------------------------------------------------------------

  async publishCue(
    cueId: string,
    actor: CueEditorActor,
  ): Promise<{ cue: PublicDiscussionCueDomain; change: PublicDiscussionCueChangeDomain }> {
    const existing = await this.repo.findCueById(cueId)
    if (!existing) throw new NotFoundError('Cue', cueId)
    if (existing.status !== 'draft' && existing.status !== 'validated') {
      throw new ConflictError(
        `cue must be in 'draft' or 'validated' to publish; current status '${existing.status}'`,
        { current_status: existing.status },
      )
    }

    const updated = await this.repo.setCueStatus(cueId, 'scheduled')
    if (!updated) throw new NotFoundError('Cue', cueId)

    const change = await this.recordChangeWithRollback({
      previousCueState: existing,
      currentCueState: updated,
      input: {
        schedule_id: existing.schedule_id,
        cue_id: cueId,
        source: 'manual',
        actor_user_id: actor.userId,
        // Cue-level publish (single cue draft -> scheduled) is recorded as a
        // generic `update_cue` whose patch_json.transition.kind === 'publish_cue'.
        // The Prisma `publish_schedule` enum is reserved for actual schedule-level
        // publish (which T-210 MVP does not ship); using it here would cause
        // T-215 audit projections to mis-classify single-cue activations as
        // schedule-wide releases.
        change_type: 'update_cue',
        base_revision: existing.revision,
        patch_json: {
          version: 1,
          partial: {},
          transition: {
            from: existing.status,
            to: 'scheduled' as PublicDiscussionCueStatus,
            kind: 'publish_cue',
          },
        },
        validation_status: 'passed',
        risk_level: updated.risk_level,
        approval_status: 'auto_applied',
        applied_at: this.now(),
      },
    })

    return { cue: updated, change }
  }

  // ---------------------------------------------------------------------------
  // rollbackSchedule (creates a new schedule version pointing back)
  // ---------------------------------------------------------------------------

  async rollbackSchedule(
    scheduleId: string,
    actor: CueEditorActor,
    summary?: string,
  ): Promise<{
    schedule: PublicDiscussionCueScheduleDomain
    change: PublicDiscussionCueChangeDomain
  }> {
    const original = await this.repo.findScheduleById(scheduleId)
    if (!original) throw new NotFoundError('CueSchedule', scheduleId)

    // MVP: mark original as 'rolled_back' and create a fresh draft pointing back.
    // Cue cancellation cascade is T-212 territory (see cue-worker-runtime §6.7);
    // T-210 only writes the schedule-level transition.
    await this.repo.updateScheduleStatus(scheduleId, 'rolled_back')

    const next = await this.repo.createSchedule({
      scope_type: original.scope_type,
      community_id: original.community_id,
      room_id: original.room_id,
      timezone: original.timezone,
      date_range_start: original.date_range_start,
      date_range_end: original.date_range_end,
      baseline_contract_version: original.baseline_contract_version,
      status: 'draft',
      source: original.source,
      version: original.version + 1,
      base_schedule_id: original.id,
      rollback_from_schedule_id: original.id,
      summary: summary ?? `rollback of ${original.id}`,
      created_by_user_id: actor.userId,
    })

    // T-212 cancel-cascade: enumerate cues attached to the original schedule
    // and (where they're still pre-execution) flip them to `cancelled`,
    // emitting per-cue `CueExecutionCancelled` events. In-flight cues
    // (`claimed`/`executing`) run to completion against the original
    // version. We capture the affected ids on the change row's patch_json
    // so audit consumers can reconstruct the cascade without re-reading
    // every cue (R6 — do not extend `RecordCueChangeInput`).
    const affectedCues = await this.repo.listCuesForSchedule(original.id)
    const affectedCueIds = affectedCues.map((c) => c.id)
    let cascadeOutcome: {
      cancelled: string[]
      inFlight: string[]
      noop: string[]
      missing: string[]
    } | null = null
    if (this.scheduleRollbackHandler && affectedCueIds.length > 0) {
      cascadeOutcome = await this.scheduleRollbackHandler.apply({
        scheduleId: original.id,
        affectedCueIds,
        actor: {
          actor_type: 'human',
          actor_id: actor.userId ?? null,
        },
        reason: summary ?? `rollback of ${original.id}`,
      })
    }

    const change = await this.repo.recordChange({
      schedule_id: next.id,
      cue_id: null,
      source: 'manual',
      actor_user_id: actor.userId,
      change_type: 'rollback_schedule',
      patch_json: {
        version: 1,
        partial: {},
        rollback: {
          from_schedule_id: original.id,
          new_schedule_id: next.id,
        },
        affected_cue_ids: affectedCueIds,
        ...(cascadeOutcome ? { cascade_outcome: cascadeOutcome } : {}),
      },
      validation_status: 'passed',
      approval_status: 'auto_applied',
      applied_at: this.now(),
    })

    return { schedule: next, change }
  }

  // ===========================================================================
  // Internal helpers
  // ===========================================================================

  private parsePatch(rawPatch: unknown): CuePatchV1 {
    try {
      return CuePatchV1Schema.parse(rawPatch)
    } catch (err) {
      if (err instanceof ZodError) {
        throw new ValidationError(
          `CuePatchV1 schema validation failed: ${err.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ')}`,
          err.issues,
        )
      }
      throw err
    }
  }

  /**
   * Backstop forbidden-field check. The Zod schema's superRefine already
   * rejects, but this server-side pass keeps the contract honest if the
   * schema is ever bypassed by a future shortcut.
   */
  private assertNoForbiddenFields(patch: CuePatchV1): void {
    const violations: { field: string; in: 'partial' | 'removed_fields' }[] = []
    for (const key of Object.keys(patch.partial)) {
      if (isForbiddenCueField(key)) {
        violations.push({ field: key, in: 'partial' })
      }
    }
    for (const removed of patch.removed_fields ?? []) {
      if (isForbiddenCueField(removed)) {
        violations.push({ field: removed, in: 'removed_fields' })
      }
    }
    if (violations.length > 0) throw new ForbiddenFieldError(violations)
  }

  private runDeterministicChecks(input: {
    partial: PartialPublicDiscussionCue
    scheduleBoundary: { from: Date; to: Date }
    now: Date
  }): void {
    const issues: string[] = []
    const triggerAt = input.partial.trigger_at
      ? new Date(input.partial.trigger_at)
      : null

    if (triggerAt) {
      if (Number.isNaN(triggerAt.getTime())) {
        issues.push('trigger_at must be a valid datetime')
      } else {
        if (triggerAt.getTime() < input.now.getTime() - 60_000) {
          // Allow up to 1 minute clock skew.
          issues.push('trigger_at must not be in the past')
        }
        if (
          triggerAt.getTime() < input.scheduleBoundary.from.getTime() ||
          triggerAt.getTime() > input.scheduleBoundary.to.getTime()
        ) {
          issues.push(
            `trigger_at out of schedule window [${input.scheduleBoundary.from.toISOString()}, ${input.scheduleBoundary.to.toISOString()}]`,
          )
        }
      }
    }

    if (input.partial.prewarm_at && triggerAt) {
      const prewarm = new Date(input.partial.prewarm_at)
      if (prewarm.getTime() >= triggerAt.getTime()) {
        issues.push('prewarm_at must be earlier than trigger_at')
      }
    }
    if (input.partial.latest_start_at && triggerAt) {
      const latest = new Date(input.partial.latest_start_at)
      if (latest.getTime() < triggerAt.getTime()) {
        issues.push('latest_start_at must be at or after trigger_at')
      }
    }
    if (input.partial.expire_at && triggerAt) {
      const expire = new Date(input.partial.expire_at)
      if (expire.getTime() < triggerAt.getTime()) {
        issues.push('expire_at must be at or after trigger_at')
      }
    }

    if (issues.length > 0) {
      throw new DeterministicValidationError(issues)
    }
  }

  private assertCueEditable(cue: PublicDiscussionCueDomain): void {
    const editableStatus: PublicDiscussionCueStatus[] = [
      'draft',
      'validating',
      'validated',
      'scheduled',
      'deferred',
    ]
    if (!editableStatus.includes(cue.status)) {
      throw new ConflictError(
        `cue in status '${cue.status}' is not editable`,
        { current_status: cue.status },
      )
    }
  }

  private assertScheduleEditable(schedule: PublicDiscussionCueScheduleDomain): void {
    const editable: typeof schedule.status[] = ['draft', 'review', 'published', 'active']
    if (!editable.includes(schedule.status)) {
      throw new ConflictError(
        `schedule in status '${schedule.status}' does not accept new cues`,
        { current_status: schedule.status },
      )
    }
  }

  private async recordChangeWithRollback(input: {
    previousCueState: PublicDiscussionCueDomain | null
    currentCueState: PublicDiscussionCueDomain
    input: Parameters<CueRepository['recordChange']>[0]
  }): Promise<PublicDiscussionCueChangeDomain> {
    try {
      return await this.repo.recordChange(input.input)
    } catch (err) {
      // Best-effort rollback: restore previous state (ignore secondary failures —
      // failing to rollback is logged but does not mask the original error).
      if (input.previousCueState) {
        try {
          await this.repo.setCueStatus(input.currentCueState.id, input.previousCueState.status)
          await this.repo.updateCue(
            input.currentCueState.id,
            cueDomainToUpdateInput(input.previousCueState),
          )
        } catch (rollbackErr) {
          console.error(
            '[CueEditorService] Compensating rollback failed after recordChange error:',
            rollbackErr,
          )
        }
      }
      throw err
    }
  }
}

// =============================================================================
// helpers
// =============================================================================

function optionalDate(iso: string | undefined): Date | undefined {
  if (iso === undefined) return undefined
  return new Date(iso)
}

function patchToUpdateInput(patch: CuePatchV1): UpdateCueInput {
  const out: UpdateCueInput = {}
  const p = patch.partial

  if (p.trigger_at !== undefined) out.trigger_at = new Date(p.trigger_at)
  if (p.timezone !== undefined) out.timezone = p.timezone
  if (p.prewarm_at !== undefined) out.prewarm_at = new Date(p.prewarm_at)
  if (p.latest_start_at !== undefined) out.latest_start_at = new Date(p.latest_start_at)
  if (p.expire_at !== undefined) out.expire_at = new Date(p.expire_at)
  if (p.priority !== undefined) out.priority = p.priority
  if (p.lane !== undefined) out.lane = p.lane as CueLane
  if (p.community_id !== undefined) out.community_id = p.community_id
  if (p.dispatch_policy !== undefined) out.dispatch_policy = p.dispatch_policy as DispatchPolicy
  if (p.admission_policy !== undefined) out.admission_policy = p.admission_policy as CueAdmissionPolicy
  if (p.load_policy !== undefined) out.load_policy = p.load_policy as CueLoadPolicy
  if (p.theme_intent !== undefined) out.theme_intent = p.theme_intent as CueThemeIntent
  if (p.scene_constraints !== undefined) out.scene_constraints = p.scene_constraints as CueSceneConstraints
  if (p.role_requirements !== undefined) out.role_requirements = p.role_requirements as CueRoleRequirementVector
  if (p.media_policy !== undefined) out.media_policy = p.media_policy as CueMediaPolicy
  if (p.safety !== undefined) out.safety = p.safety as CueSafetyPolicy
  if (p.locked_fields !== undefined) out.locked_fields = p.locked_fields
  if (p.risk_level !== undefined) out.risk_level = p.risk_level as CueRiskLevel

  for (const removed of patch.removed_fields ?? []) {
    if (removed === 'prewarm_at') out.prewarm_at = null
    else if (removed === 'latest_start_at') out.latest_start_at = null
    else if (removed === 'expire_at') out.expire_at = null
    else if (removed === 'admission_policy') out.admission_policy = null
    else if (removed === 'load_policy') out.load_policy = null
    else if (removed === 'media_policy') out.media_policy = null
    else if (removed === 'safety') out.safety = null
    else if (removed === 'community_id') out.community_id = null
    // Required-field removals are rejected by the service caller before this point.
  }

  return out
}

// Exported for cue-preview-service (M3 — runs the same locked-fields validator
// against the same editable surface).
export function extractEditableFromCue(
  cue: PublicDiscussionCueDomain,
): PartialPublicDiscussionCue {
  return extractEditable(cue)
}

function extractEditable(cue: PublicDiscussionCueDomain): PartialPublicDiscussionCue {
  // Build an object containing only the editable surface, then validate it
  // against PartialPublicDiscussionCueSchema to keep the locked-fields diff
  // working on validated shapes.
  const editable: Record<string, unknown> = {
    trigger_at: cue.trigger_at,
    timezone: cue.timezone,
    priority: cue.priority,
    lane: cue.lane,
    dispatch_policy: cue.dispatch_policy,
    theme_intent: cue.theme_intent,
    scene_constraints: cue.scene_constraints,
    role_requirements: cue.role_requirements,
    locked_fields: cue.locked_fields,
    risk_level: cue.risk_level,
  }
  if (cue.prewarm_at !== undefined) editable.prewarm_at = cue.prewarm_at
  if (cue.latest_start_at !== undefined) editable.latest_start_at = cue.latest_start_at
  if (cue.expire_at !== undefined) editable.expire_at = cue.expire_at
  if (cue.admission_policy !== undefined) editable.admission_policy = cue.admission_policy
  if (cue.load_policy !== undefined) editable.load_policy = cue.load_policy
  if (cue.media_policy !== undefined) editable.media_policy = cue.media_policy
  if (cue.safety !== undefined) editable.safety = cue.safety
  if (cue.community_id !== undefined) editable.community_id = cue.community_id

  return PartialPublicDiscussionCueSchema.parse(editable)
}

function cueDomainToUpdateInput(cue: PublicDiscussionCueDomain): UpdateCueInput {
  return {
    trigger_at: new Date(cue.trigger_at),
    timezone: cue.timezone,
    prewarm_at: cue.prewarm_at ? new Date(cue.prewarm_at) : null,
    latest_start_at: cue.latest_start_at ? new Date(cue.latest_start_at) : null,
    expire_at: cue.expire_at ? new Date(cue.expire_at) : null,
    priority: cue.priority,
    lane: cue.lane,
    community_id: cue.community_id ?? null,
    dispatch_policy: cue.dispatch_policy,
    admission_policy: cue.admission_policy ?? null,
    load_policy: cue.load_policy ?? null,
    theme_intent: cue.theme_intent,
    scene_constraints: cue.scene_constraints,
    role_requirements: cue.role_requirements,
    media_policy: cue.media_policy ?? null,
    safety: cue.safety ?? null,
    locked_fields: cue.locked_fields,
    risk_level: cue.risk_level,
  }
}

// CueChangeType is re-exported so route handlers can reference it without
// reaching into repo internals.
export type { CueChangeType }
