/**
 * T-209 cue-data-and-board — placeholder permission constants for the
 * programming layer. Defined here so the registry is fixed at frozen-fields
 * time; T-210 (admin editor) wires these strings to actual auth gates.
 *
 * Source: design doc §17.3, umbrella §G3.
 *
 * The set is closed: adding a new permission requires re-opening T-210.
 */

export const PROGRAMMING_PERMISSIONS = {
  /** Read Cue Board (T-210 enforces; T-215 reuses for public actuals view). */
  view_programming: 'view_programming',
  /** Create / update / cancel cue draft (T-210). */
  edit_programming_draft: 'edit_programming_draft',
  /** Flip schedule from draft -> published (T-210). */
  publish_programming_schedule: 'publish_programming_schedule',
  /** Approve any pending CueChange (T-210 + T-214 inbox). */
  approve_programming_change: 'approve_programming_change',
  /** Approve auto-editor patches (T-214 reuses). */
  approve_auto_patch: 'approve_auto_patch',
  /** Operate the media picker; T-216 M3 also gates anchor / selected_only_pool. */
  manage_programming_media: 'manage_programming_media',
  /**
   * Reserved permission — not exposed in MVP per umbrella decision D-11.
   * Placeholder so future T-216 follow-up can grant.
   */
  require_public_display_media: 'require_public_display_media',
  /** Cancel a scheduled cue before triggerAt (T-210). */
  cancel_scheduled_cue: 'cancel_scheduled_cue',
  /**
   * Force-skip a due or executing cue (T-210; coordinates with T-212
   * cancel-during-executing semantics, see umbrella G11).
   */
  force_skip_due_cue: 'force_skip_due_cue',
  /** Create a rollback schedule version (T-210). */
  rollback_programming_schedule: 'rollback_programming_schedule',
  /** View audit chain UI per umbrella §5 (T-210 base; T-215 actuals dashboard). */
  inspect_programming_audit: 'inspect_programming_audit',
} as const

export type ProgrammingPermission =
  (typeof PROGRAMMING_PERMISSIONS)[keyof typeof PROGRAMMING_PERMISSIONS]

export const PROGRAMMING_PERMISSION_LIST: readonly ProgrammingPermission[] =
  Object.values(PROGRAMMING_PERMISSIONS)

export function isProgrammingPermission(
  raw: string,
): raw is ProgrammingPermission {
  return (PROGRAMMING_PERMISSION_LIST as readonly string[]).includes(raw)
}
