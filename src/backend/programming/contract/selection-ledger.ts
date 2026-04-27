import { z } from 'zod'

export interface SelectionReason {
  code: string
  value?: string
  message?: string
}

export interface SelectionLedger {
  candidate_id: string
  selected: boolean
  score: number
  reasons: SelectionReason[]
}

const SelectionReasonSchema = z
  .object({
    code: z.string().min(1),
    value: z.string().optional(),
    message: z.string().optional(),
  })
  .strict()

export const SelectionLedgerSchema = z
  .object({
    candidate_id: z.string().min(1),
    selected: z.boolean(),
    score: z.number().finite(),
    reasons: z.array(SelectionReasonSchema),
  })
  .strict()

const LEGACY_REASON_PATTERN = /^([A-Za-z][A-Za-z0-9_-]*)=(.+)$/

/**
 * Convert allocator's legacy free-form `key=value` reason strings
 * (see src/backend/allocator/types.ts ScoredCandidate.reasons: string[])
 * into the canonical structured SelectionReason form.
 *
 * Bare codes without `=` (e.g., 'no_match') are returned with code only.
 */
export function parseLegacyReasonString(raw: string): SelectionReason {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new Error('parseLegacyReasonString: input must be a non-empty string')
  }
  const m = LEGACY_REASON_PATTERN.exec(raw)
  if (m == null) {
    return { code: raw }
  }
  return { code: m[1]!, value: m[2]! }
}
