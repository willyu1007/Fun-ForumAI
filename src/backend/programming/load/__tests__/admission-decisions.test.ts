/**
 * T-213 M1 — admission decision matrix snapshot.
 *
 * Locks the full 3 × 3 × 3 matrix against unintentional drift. Two purposes:
 *   1. Catches accidental re-ordering, missing entries, or value flips during
 *      hand edits to `admission-decisions.ts`.
 *   2. Forms the contract T-214 LoadGate inherits — that bundle imports the
 *      same constant; this test guarantees the constant doesn't change shape
 *      without an explicit snapshot update.
 */

import { describe, expect, it } from 'vitest'
import {
  ADMISSION_DECISIONS,
  CUE_LANES_ORDERED,
  LOAD_STATES_ORDERED,
  PRIORITY_BUCKETS_ORDERED,
  lookupAdmissionAction,
} from '../admission-decisions.js'
import { bucketPriority } from '../types.js'

describe('admission-decisions matrix', () => {
  it('covers every (state, lane, priority bucket) cell with no holes', () => {
    for (const state of LOAD_STATES_ORDERED) {
      for (const lane of CUE_LANES_ORDERED) {
        for (const bucket of PRIORITY_BUCKETS_ORDERED) {
          const action = ADMISSION_DECISIONS[state][lane][bucket]
          expect(action, `missing entry for ${state}/${lane}/${bucket}`).toBeDefined()
        }
      }
    }
  })

  it('matches the locked snapshot (drift detector)', () => {
    expect(ADMISSION_DECISIONS).toMatchInlineSnapshot(`
      {
        "green": {
          "background": {
            "high": "admit",
            "low": "admit",
            "normal": "admit",
          },
          "prime": {
            "high": "admit",
            "low": "admit",
            "normal": "admit",
          },
          "standard": {
            "high": "admit",
            "low": "admit",
            "normal": "admit",
          },
        },
        "red": {
          "background": {
            "high": "defer",
            "low": "skip",
            "normal": "skip",
          },
          "prime": {
            "high": "admit",
            "low": "defer",
            "normal": "defer",
          },
          "standard": {
            "high": "defer",
            "low": "skip",
            "normal": "defer",
          },
        },
        "yellow": {
          "background": {
            "high": "defer",
            "low": "skip",
            "normal": "defer",
          },
          "prime": {
            "high": "admit",
            "low": "admit",
            "normal": "admit",
          },
          "standard": {
            "high": "admit",
            "low": "defer",
            "normal": "admit",
          },
        },
      }
    `)
  })
})

describe('lookupAdmissionAction', () => {
  it.each([
    [{ loadState: 'green', cueLane: 'background', cuePriority: 0 }, 'admit'],
    [{ loadState: 'red', cueLane: 'background', cuePriority: 30 }, 'skip'],
    [{ loadState: 'red', cueLane: 'prime', cuePriority: 90 }, 'admit'],
    [{ loadState: 'yellow', cueLane: 'standard', cuePriority: 50 }, 'admit'],
    [{ loadState: 'yellow', cueLane: 'standard', cuePriority: 39 }, 'defer'],
  ] as const)('lookup(%j) → %s', (input, expected) => {
    expect(lookupAdmissionAction(input)).toBe(expected)
  })
})

describe('bucketPriority', () => {
  it.each([
    [0, 'low'],
    [39, 'low'],
    [40, 'normal'],
    [79, 'normal'],
    [80, 'high'],
    [100, 'high'],
  ] as const)('priority=%i → %s', (priority, bucket) => {
    expect(bucketPriority(priority)).toBe(bucket)
  })
})
