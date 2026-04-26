/**
 * T-210 M1 — locked-fields validator (DEC-T210-B).
 *
 * Match rule (per cue-editor-admin/02-architecture.md §1, DEC-T210-B):
 *
 *   A patch is rejected for locked path L iff the patch causes a leaf value
 *   at L or below L to change.
 *
 *   Parent locks child:    L = 'X'              blocks any change under X.
 *   Child blocks parent:   L = 'X.y'            blocks rewrites of X that
 *                                               change X.y, even if patch
 *                                               supplies the whole X.
 *   Sibling independence:  L = 'X.a'            does not block change to X.b.
 *
 * Diff semantics: applyCuePatch shallow-merges, so `patch.partial.X` REPLACES
 * the entire X. The validator must therefore deep-diff `oldPartial.X` vs
 * `patch.partial.X` to find which leaves under X actually changed; replacing
 * X with a structurally-equal object is a no-op and trips no lock.
 *
 * `removed_fields[]` entries are top-level keys (whitelisted by CuePatchV1
 * schema); each entry counts as a change at the listed key path.
 *
 * Shared between manual (T-210) and auto-editor (T-214). One file, one
 * validator — do not fork.
 */

import type { CuePatchV1, PartialPublicDiscussionCue } from './cue-patch.js'

export interface LockedFieldsViolation {
  /** The dot-path under the cue where the change occurred. */
  patchPath: string
  /** The locked path that the change tripped. */
  lockedBy: string
}

export interface LockedFieldsValidatorInput {
  oldPartial: PartialPublicDiscussionCue
  patch: CuePatchV1
  lockedPaths: readonly string[]
}

export function validateLockedFields(
  input: LockedFieldsValidatorInput,
): LockedFieldsViolation[] {
  if (input.lockedPaths.length === 0) {
    return []
  }

  const changedLeaves = collectChangedLeafPaths(input.oldPartial, input.patch)
  if (changedLeaves.length === 0) {
    return []
  }

  const violations: LockedFieldsViolation[] = []
  for (const patchPath of changedLeaves) {
    for (const lockedBy of input.lockedPaths) {
      if (pathsConflict(patchPath, lockedBy)) {
        violations.push({ patchPath, lockedBy })
      }
    }
  }
  return violations
}

/**
 * `patchPath` and `lockedPath` conflict iff one is the other or one is an
 * ancestor of the other. Ancestor by dot-segment, not string prefix —
 * `'a.bb'` is NOT an ancestor of `'a.b'`.
 */
function pathsConflict(patchPath: string, lockedPath: string): boolean {
  if (patchPath === lockedPath) return true
  if (patchPath.startsWith(`${lockedPath}.`)) return true
  if (lockedPath.startsWith(`${patchPath}.`)) return true
  return false
}

function collectChangedLeafPaths(
  oldPartial: PartialPublicDiscussionCue,
  patch: CuePatchV1,
): string[] {
  const paths: string[] = []

  // partial keys: deep-diff against old to enumerate changed leaf paths
  for (const [key, newValue] of Object.entries(patch.partial)) {
    const oldValue = (oldPartial as Record<string, unknown>)[key]
    diffValues(oldValue, newValue, key, paths)
  }

  // removed_fields: each entry is a top-level key; treat as a change at that path
  for (const removed of patch.removed_fields ?? []) {
    if ((oldPartial as Record<string, unknown>)[removed] !== undefined) {
      paths.push(removed)
    }
  }

  return paths
}

function diffValues(
  oldValue: unknown,
  newValue: unknown,
  path: string,
  out: string[],
): void {
  if (deepEqual(oldValue, newValue)) {
    return
  }
  // If either side is non-plain (primitive, null, array, Date, etc.), record
  // the change at the current path and stop. Arrays compared by deep-equal
  // (no per-index diff in MVP).
  if (!isPlainObject(oldValue) || !isPlainObject(newValue)) {
    out.push(path)
    return
  }
  // Both plain objects: recurse over union of keys.
  const oldObj = oldValue as Record<string, unknown>
  const newObj = newValue as Record<string, unknown>
  const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])
  for (const k of keys) {
    diffValues(oldObj[k], newObj[k], `${path}.${k}`, out)
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return false
  if (value instanceof Date) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return false

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false
    }
    return true
  }
  if (Array.isArray(b)) return false

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime()
  }

  const aObj = a as Record<string, unknown>
  const bObj = b as Record<string, unknown>
  const aKeys = Object.keys(aObj)
  const bKeys = Object.keys(bObj)
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bObj, k)) return false
    if (!deepEqual(aObj[k], bObj[k])) return false
  }
  return true
}
