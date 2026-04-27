import { z } from 'zod'

export type AdmissionDecision = 'admit' | 'defer' | 'skip' | 'merge' | 'require_review'

export interface AdmissionResult {
  granted: boolean
  decision: AdmissionDecision
  reason_codes: string[]
  recommended_next_trigger_at?: string
  load_snapshot_id?: string
  degraded_media?: boolean
}

const AdmissionDecisionEnum = z.enum([
  'admit',
  'defer',
  'skip',
  'merge',
  'require_review',
])

const isoDateString = z.string().min(1).refine(
  (s) => !Number.isNaN(Date.parse(s)),
  { message: 'must be a valid ISO 8601 datetime string' },
)

export const AdmissionResultSchema = z
  .object({
    granted: z.boolean(),
    decision: AdmissionDecisionEnum,
    reason_codes: z.array(z.string().min(1)),
    recommended_next_trigger_at: isoDateString.optional(),
    load_snapshot_id: z.string().min(1).optional(),
    degraded_media: z.boolean().optional(),
  })
  .strict()
  .refine(
    (v) => (v.granted ? v.decision === 'admit' : v.decision !== 'admit'),
    {
      message:
        'granted=true requires decision=admit; granted=false requires a non-admit decision',
      path: ['decision'],
    },
  )
