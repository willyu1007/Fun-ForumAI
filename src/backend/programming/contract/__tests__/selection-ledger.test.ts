import { describe, it, expect } from 'vitest'
import {
  SelectionLedgerSchema,
  parseLegacyReasonString,
} from '../selection-ledger.js'

describe('SelectionLedgerSchema', () => {
  it('accepts a fully valid ledger entry', () => {
    const value = {
      candidate_id: 'agent_7',
      selected: true,
      score: 0.82,
      reasons: [
        { code: 'tag_overlap', value: '0.84' },
        { code: 'director_role', value: 'core', message: 'matches anchor slot' },
        { code: 'high_topic_affinity' },
      ],
    }
    expect(SelectionLedgerSchema.parse(value)).toEqual(value)
  })

  it('accepts an empty reasons array', () => {
    const value = {
      candidate_id: 'agent_x',
      selected: false,
      score: 0,
      reasons: [],
    }
    expect(() => SelectionLedgerSchema.parse(value)).not.toThrow()
  })

  it('rejects empty candidate_id', () => {
    expect(() =>
      SelectionLedgerSchema.parse({
        candidate_id: '',
        selected: true,
        score: 0.5,
        reasons: [],
      }),
    ).toThrow()
  })

  it('rejects non-finite score', () => {
    expect(() =>
      SelectionLedgerSchema.parse({
        candidate_id: 'a',
        selected: true,
        score: Number.POSITIVE_INFINITY,
        reasons: [],
      }),
    ).toThrow()
  })

  it('rejects unknown extra keys at the ledger level (strict)', () => {
    expect(() =>
      SelectionLedgerSchema.parse({
        candidate_id: 'a',
        selected: true,
        score: 0.5,
        reasons: [],
        extra: 'nope',
      }),
    ).toThrow()
  })

  it('rejects unknown extra keys inside a reason (strict)', () => {
    expect(() =>
      SelectionLedgerSchema.parse({
        candidate_id: 'a',
        selected: true,
        score: 0.5,
        reasons: [{ code: 'x', extra: 'nope' }],
      }),
    ).toThrow()
  })

  it('rejects empty code in a reason', () => {
    expect(() =>
      SelectionLedgerSchema.parse({
        candidate_id: 'a',
        selected: true,
        score: 0.5,
        reasons: [{ code: '' }],
      }),
    ).toThrow()
  })
})

describe('parseLegacyReasonString', () => {
  it('parses key=value form', () => {
    expect(parseLegacyReasonString('tag_overlap=0.84')).toEqual({
      code: 'tag_overlap',
      value: '0.84',
    })
  })

  it('parses bare-code form (no equals)', () => {
    expect(parseLegacyReasonString('no_match')).toEqual({ code: 'no_match' })
  })

  it('preserves an = inside the value', () => {
    expect(parseLegacyReasonString('formula=a=b')).toEqual({
      code: 'formula',
      value: 'a=b',
    })
  })

  it('treats codes with hyphens as legacy values (regex enforces leading letter)', () => {
    expect(parseLegacyReasonString('director-role=core')).toEqual({
      code: 'director-role',
      value: 'core',
    })
  })

  it('throws on empty string', () => {
    expect(() => parseLegacyReasonString('')).toThrow(/non-empty string/)
  })
})
