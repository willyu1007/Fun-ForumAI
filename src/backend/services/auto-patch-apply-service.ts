/**
 * T-214 A-M3 follow-on closer — `AutoPatchApplyService`.
 *
 * Closes the inbox loop: when an admin approves a pending automated
 * `CueChange` row, this service dispatches the patch to the matching
 * `CueEditorService` mutation method **with `existingChangeId`** so
 * the audit chain stays single-row. The original automated row is the
 * canonical audit — proposal, admin approval, and runtime mutation
 * all live on it.
 *
 * Supported change types (MVP):
 *   - `update_cue` → `cueEditorService.updateCue`
 *   - `cancel_cue` → `cueEditorService.cancelCue`
 *   - `defer_cue` → `cueEditorService.cancelCue` with reason='auto_defer'
 *     (uses cancel_cue path's status transition machinery; the cue
 *     ends up at status `cancelled` not `deferred` though — defer is
 *     a worker-internal state today, see deferred note below)
 *   - `attach_media` → `cueEditorService.attachCueMedia`
 *   - `remove_media` → `cueEditorService.removeCueMedia`
 *
 * Other change types (`create_cue`, `merge_into_existing_cue`,
 * `split_cue`, `update_dispatch_policy`, `update_risk_level`,
 * `publish_schedule`, `rollback_schedule`) return `'unsupported'`. The
 * original automated row stays at `approval_status='approved'` (the
 * route handler stamps that) and admin must manually finish via the
 * Cue Board manual editor.
 *
 * Single-row audit: with `existingChangeId` plumbed through the
 * editor service, applying flips the original row to
 * `auto_applied` (stamping `applied_at` + `actor_user_id`) and does
 * NOT write a duplicate `source='manual'` row. The dual-row trade-off
 * documented in the prior milestone is now resolved.
 *
 * `defer_cue` note: the cue domain status enum has both `cancelled`
 * and `deferred`, but `deferred` is a worker-internal transition
 * (admission denial result). The auto-editor's `defer_cue` action
 * is best modelled as a soft cancel + scheduler-side retry. MVP
 * routes it through `cancelCue` with reason='auto_defer'; a richer
 * defer semantic (push trigger_at) can land in a follow-on once the
 * action surface specifies it.
 */

import type {
  CueCreateBundle,
  CueEditorActor,
  CueEditorService,
} from './cue-editor-service.js'
import type {
  AttachCueMediaInput,
  CueRepository,
  PublicDiscussionCueChangeDomain,
} from '../repos/cue-repository.js'
import type { PublicDiscussionCueDomain } from '../programming/cue/types.js'
import { ConflictError, ValidationError } from '../lib/errors.js'

type CueCreateBundlePatch = CueCreateBundle['patch']

export interface AutoPatchApplyServiceDeps {
  cueRepo: Pick<CueRepository, 'findChangeById' | 'findActiveScheduleForScope'>
  cueEditorService: Pick<
    CueEditorService,
    'updateCue' | 'cancelCue' | 'attachCueMedia' | 'removeCueMedia' | 'createCueDraft'
  >
  now?: () => Date
}

export type AutoPatchApplyOutcome =
  | {
      kind: 'applied'
      change: PublicDiscussionCueChangeDomain
      cue?: PublicDiscussionCueDomain
    }
  | {
      kind: 'unsupported'
      change: PublicDiscussionCueChangeDomain
      reason: string
    }
  | {
      kind: 'failed'
      change: PublicDiscussionCueChangeDomain
      error: string
    }

export class AutoPatchApplyService {
  constructor(private readonly deps: AutoPatchApplyServiceDeps) {}

  async apply(input: {
    change: PublicDiscussionCueChangeDomain
    actor: CueEditorActor
  }): Promise<AutoPatchApplyOutcome> {
    const { change, actor } = input
    if (change.source !== 'automated') {
      return {
        kind: 'unsupported',
        change,
        reason: 'apply route is reserved for automated changes',
      }
    }

    switch (change.change_type) {
      case 'create_cue':
        return this.applyCreate(change, actor)
      case 'update_cue':
        return this.applyUpdate(change, actor)
      case 'cancel_cue':
        return this.applyCancel(change, actor)
      case 'defer_cue':
        return this.applyDefer(change, actor)
      case 'attach_media':
        return this.applyAttachMedia(change, actor)
      case 'remove_media':
        return this.applyRemoveMedia(change, actor)
      default:
        return {
          kind: 'unsupported',
          change,
          reason: `auto-apply not supported for change_type=${change.change_type}; admin should manually edit via Cue Board`,
        }
    }
  }

  /**
   * `create_cue` apply: resolve the active community schedule from
   * the trigger context (stored on the change row's
   * `load_snapshot_json.community_id`) and call
   * `cueEditorService.createCueDraft`. The original automated
   * change row gets flipped to `auto_applied` via `existingChangeId`.
   */
  private async applyCreate(
    change: PublicDiscussionCueChangeDomain,
    actor: CueEditorActor,
  ): Promise<AutoPatchApplyOutcome> {
    const communityId = readCommunityIdFromLoadSnapshot(change.load_snapshot_json)
    if (!communityId) {
      return {
        kind: 'failed',
        change,
        error: 'create_cue change missing community_id in load_snapshot_json',
      }
    }
    try {
      const schedule = await this.deps.cueRepo.findActiveScheduleForScope({
        scope_type: 'community',
        community_id: communityId,
      })
      if (!schedule) {
        return {
          kind: 'failed',
          change,
          error: `no active schedule for community ${communityId}; admin must create one before approving auto-create cues`,
        }
      }
      const result = await this.deps.cueEditorService.createCueDraft(
        {
          scheduleId: schedule.id,
          scope: { mode: 'single', community_id: communityId },
          patch: change.patch_json as CueCreateBundlePatch,
        },
        actor,
        { existingChangeId: change.id },
      )
      return { kind: 'applied', change: result.change, cue: result.cue }
    } catch (err) {
      return this.translateApplyError(change, err)
    }
  }

  private async applyUpdate(
    change: PublicDiscussionCueChangeDomain,
    actor: CueEditorActor,
  ): Promise<AutoPatchApplyOutcome> {
    if (!change.cue_id) {
      return { kind: 'failed', change, error: 'update_cue change missing cue_id' }
    }
    try {
      const result = await this.deps.cueEditorService.updateCue(
        change.cue_id,
        change.patch_json,
        actor,
        { existingChangeId: change.id },
      )
      return { kind: 'applied', change: result.change, cue: result.cue }
    } catch (err) {
      return this.translateApplyError(change, err)
    }
  }

  private async applyCancel(
    change: PublicDiscussionCueChangeDomain,
    actor: CueEditorActor,
  ): Promise<AutoPatchApplyOutcome> {
    if (!change.cue_id) {
      return { kind: 'failed', change, error: 'cancel_cue change missing cue_id' }
    }
    try {
      const result = await this.deps.cueEditorService.cancelCue(
        change.cue_id,
        actor,
        change.reason ?? undefined,
        { existingChangeId: change.id },
      )
      return { kind: 'applied', change: result.change, cue: result.cue }
    } catch (err) {
      return this.translateApplyError(change, err)
    }
  }

  private async applyDefer(
    change: PublicDiscussionCueChangeDomain,
    actor: CueEditorActor,
  ): Promise<AutoPatchApplyOutcome> {
    if (!change.cue_id) {
      return { kind: 'failed', change, error: 'defer_cue change missing cue_id' }
    }
    try {
      const result = await this.deps.cueEditorService.cancelCue(
        change.cue_id,
        actor,
        change.reason ?? 'auto_defer',
        { existingChangeId: change.id },
      )
      return { kind: 'applied', change: result.change, cue: result.cue }
    } catch (err) {
      return this.translateApplyError(change, err)
    }
  }

  private async applyAttachMedia(
    change: PublicDiscussionCueChangeDomain,
    actor: CueEditorActor,
  ): Promise<AutoPatchApplyOutcome> {
    if (!change.cue_id) {
      return { kind: 'failed', change, error: 'attach_media change missing cue_id' }
    }
    const mediaInput = readMediaAttachInput(change.patch_json)
    if (!mediaInput) {
      return {
        kind: 'failed',
        change,
        error: 'attach_media change patch_json missing media block (asset_id, role, usage_strength)',
      }
    }
    try {
      const result = await this.deps.cueEditorService.attachCueMedia(
        change.cue_id,
        mediaInput,
        actor,
        { existingChangeId: change.id },
      )
      return { kind: 'applied', change: result.change }
    } catch (err) {
      return this.translateApplyError(change, err)
    }
  }

  private async applyRemoveMedia(
    change: PublicDiscussionCueChangeDomain,
    actor: CueEditorActor,
  ): Promise<AutoPatchApplyOutcome> {
    if (!change.cue_id) {
      return { kind: 'failed', change, error: 'remove_media change missing cue_id' }
    }
    const mediaId = readMediaRemoveId(change.patch_json)
    if (!mediaId) {
      return {
        kind: 'failed',
        change,
        error: 'remove_media change patch_json missing media.media_id',
      }
    }
    try {
      const result = await this.deps.cueEditorService.removeCueMedia(
        change.cue_id,
        mediaId,
        actor,
        { existingChangeId: change.id },
      )
      return { kind: 'applied', change: result.change }
    } catch (err) {
      return this.translateApplyError(change, err)
    }
  }

  private translateApplyError(
    change: PublicDiscussionCueChangeDomain,
    err: unknown,
  ): AutoPatchApplyOutcome {
    if (err instanceof ValidationError || err instanceof ConflictError) {
      return { kind: 'failed', change, error: err.message }
    }
    if (err instanceof Error) {
      return { kind: 'failed', change, error: err.message }
    }
    return { kind: 'failed', change, error: String(err) }
  }
}

// =============================================================================
// patch_json shape readers (defensive — patch_json is `unknown` per the repo
// type, so apply paths that need media metadata must read it carefully)
// =============================================================================

type AttachInput = Omit<AttachCueMediaInput, 'cue_id' | 'created_by_type' | 'created_by_id'>

function readMediaAttachInput(patchJson: unknown): AttachInput | null {
  if (!patchJson || typeof patchJson !== 'object' || Array.isArray(patchJson)) return null
  const media = (patchJson as { media?: unknown }).media
  if (!media || typeof media !== 'object' || Array.isArray(media)) return null
  const m = media as Record<string, unknown>
  if (typeof m.asset_id !== 'string') return null
  if (typeof m.role !== 'string') return null
  const result: AttachInput = {
    asset_id: m.asset_id,
    role: m.role as AttachInput['role'],
  }
  if (typeof m.usage_strength === 'string') {
    result.usage_strength = m.usage_strength as AttachInput['usage_strength']
  }
  if (typeof m.use_policy === 'string') {
    result.use_policy = m.use_policy as AttachInput['use_policy']
  }
  if (typeof m.semantic_snapshot_id === 'string') {
    result.semantic_snapshot_id = m.semantic_snapshot_id
  }
  if (typeof m.selection_note === 'string') {
    result.selection_note = m.selection_note
  }
  if (typeof m.sort_order === 'number') {
    result.sort_order = m.sort_order
  }
  if (typeof m.reuse_limit === 'number') {
    result.reuse_limit = m.reuse_limit
  }
  return result
}

function readMediaRemoveId(patchJson: unknown): string | null {
  if (!patchJson || typeof patchJson !== 'object' || Array.isArray(patchJson)) return null
  const media = (patchJson as { media?: unknown }).media
  if (!media || typeof media !== 'object' || Array.isArray(media)) return null
  const m = media as Record<string, unknown>
  if (typeof m.media_id === 'string') return m.media_id
  return null
}

/**
 * The auto-editor scheduler stamps `community_id` into the change
 * row's `load_snapshot_json` so the apply path can resolve the
 * active schedule for `create_cue` without re-walking the trigger
 * event log.
 */
function readCommunityIdFromLoadSnapshot(loadSnapshotJson: unknown): string | null {
  if (!loadSnapshotJson || typeof loadSnapshotJson !== 'object' || Array.isArray(loadSnapshotJson)) {
    return null
  }
  const value = (loadSnapshotJson as Record<string, unknown>).community_id
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}
