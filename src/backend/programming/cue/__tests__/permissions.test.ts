import { describe, it, expect } from 'vitest'
import {
  PROGRAMMING_PERMISSIONS,
  PROGRAMMING_PERMISSION_LIST,
  isProgrammingPermission,
} from '../permissions.js'

describe('PROGRAMMING_PERMISSIONS', () => {
  it('declares all 11 permissions per design doc §17.3', () => {
    expect(PROGRAMMING_PERMISSION_LIST).toHaveLength(11)
  })

  it('includes the umbrella-required permission identifiers', () => {
    const required = [
      'view_programming',
      'edit_programming_draft',
      'publish_programming_schedule',
      'approve_programming_change',
      'approve_auto_patch',
      'manage_programming_media',
      'require_public_display_media',
      'cancel_scheduled_cue',
      'force_skip_due_cue',
      'rollback_programming_schedule',
      'inspect_programming_audit',
    ]
    for (const perm of required) {
      expect(PROGRAMMING_PERMISSION_LIST).toContain(perm)
    }
  })

  it('keys equal values (string-key constants)', () => {
    for (const [key, value] of Object.entries(PROGRAMMING_PERMISSIONS)) {
      expect(value).toBe(key)
    }
  })

  it('isProgrammingPermission narrows on registered names only', () => {
    expect(isProgrammingPermission('view_programming')).toBe(true)
    expect(isProgrammingPermission('made_up_permission')).toBe(false)
  })
})
