import { describe, expect, it } from 'vitest'
import {
  AUTO_EDITOR_ALLOWED_ACTIONS,
  AUTO_EDITOR_LOAD_STATES,
  lookupAutoEditorAllowedActions,
} from '../auto-editor-allowed-actions.js'

describe('AUTO_EDITOR_ALLOWED_ACTIONS — SSOT pinning', () => {
  it('emits a row for every LoadState (no missing axis values)', () => {
    expect(Object.keys(AUTO_EDITOR_ALLOWED_ACTIONS).sort()).toEqual(
      [...AUTO_EDITOR_LOAD_STATES].sort(),
    )
  })

  it('green: all editable change types allowed, propose_only=false', () => {
    const row = AUTO_EDITOR_ALLOWED_ACTIONS.green
    expect(row.propose_only).toBe(false)
    expect(row.allowed_actions).toContain('create_cue')
    expect(row.allowed_actions).toContain('update_cue')
    expect(row.allowed_actions).toContain('attach_media')
    expect(row.allowed_actions).toContain('update_dispatch_policy')
  })

  it('yellow: heavy-edit shapes blocked, triage shapes allowed, propose_only=false', () => {
    const row = AUTO_EDITOR_ALLOWED_ACTIONS.yellow
    expect(row.propose_only).toBe(false)
    expect(row.allowed_actions).not.toContain('create_cue')
    expect(row.allowed_actions).not.toContain('update_dispatch_policy')
    expect(row.allowed_actions).not.toContain('attach_media')
    expect(row.allowed_actions).toContain('cancel_cue')
    expect(row.allowed_actions).toContain('defer_cue')
    expect(row.allowed_actions).toContain('merge_into_existing_cue')
    expect(row.allowed_actions).toContain('update_risk_level')
    expect(row.allowed_actions).toContain('remove_media')
  })

  it('red: only triage cancel / defer / merge, propose_only=true (overview §34)', () => {
    const row = AUTO_EDITOR_ALLOWED_ACTIONS.red
    expect(row.propose_only).toBe(true)
    expect([...row.allowed_actions].sort()).toEqual([
      'cancel_cue',
      'defer_cue',
      'merge_into_existing_cue',
    ])
  })

  it('lookupAutoEditorAllowedActions returns mutable copies (no shared array references)', () => {
    const a = lookupAutoEditorAllowedActions('green')
    const b = lookupAutoEditorAllowedActions('green')
    expect(a.allowed_actions).not.toBe(b.allowed_actions)
    ;(a.allowed_actions as CueChangeTypeWritable).push('create_cue')
    // b unchanged — the underlying SSOT array is safe.
    expect(b.allowed_actions).toEqual(AUTO_EDITOR_ALLOWED_ACTIONS.green.allowed_actions)
  })
})

// Local type alias so the mutation probe above is type-safe without
// loosening the public ReadonlyArray contract.
type CueChangeTypeWritable = string[]
