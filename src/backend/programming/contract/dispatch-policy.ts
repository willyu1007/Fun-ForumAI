import { z } from 'zod'

export type DispatchMode = 'strict' | 'graceful' | 'opportunistic'
export type Lane = 'prime' | 'standard' | 'background'
export type MisfirePolicy = 'skip' | 'delay' | 'coalesce' | 'degrade'

export interface DispatchPolicy {
  trigger_at: string
  timezone: string
  dispatch_mode: DispatchMode
  not_before_at?: string
  deadline_at?: string
  grace_seconds: number
  priority: number
  lane: Lane
  misfire_policy: MisfirePolicy
  max_attempts: number
  retry_backoff_seconds: number
}

const DispatchModeEnum = z.enum(['strict', 'graceful', 'opportunistic'])
const LaneEnum = z.enum(['prime', 'standard', 'background'])
const MisfirePolicyEnum = z.enum(['skip', 'delay', 'coalesce', 'degrade'])

const isoDateString = z.string().min(1).refine(
  (s) => !Number.isNaN(Date.parse(s)),
  { message: 'must be a valid ISO 8601 datetime string' },
)

export const DispatchPolicySchema = z
  .object({
    trigger_at: isoDateString,
    timezone: z.string().min(1),
    dispatch_mode: DispatchModeEnum,
    not_before_at: isoDateString.optional(),
    deadline_at: isoDateString.optional(),
    grace_seconds: z.number().int().min(0),
    priority: z.number().int().min(0).max(100),
    lane: LaneEnum,
    misfire_policy: MisfirePolicyEnum,
    max_attempts: z.number().int().min(1),
    retry_backoff_seconds: z.number().int().min(0),
  })
  .strict()
  .refine(
    (v) => {
      if (v.not_before_at == null) return true
      return Date.parse(v.not_before_at) <= Date.parse(v.trigger_at)
    },
    { message: 'not_before_at must be <= trigger_at', path: ['not_before_at'] },
  )
  .refine(
    (v) => {
      if (v.deadline_at == null) return true
      return Date.parse(v.deadline_at) > Date.parse(v.trigger_at)
    },
    { message: 'deadline_at must be > trigger_at', path: ['deadline_at'] },
  )
