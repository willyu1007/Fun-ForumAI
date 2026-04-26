/**
 * T-212 M5 — schedule-rollback handler.
 *
 * Implements the cancel-cascade T-212 owes T-210 (overview §6.1):
 *   - cues in `{draft, validating, validated, scheduled, prewarming, due,
 *     deferred}` → `cancelled` + emit `CueExecutionCancelled` per cue
 *   - cues in `{claimed, executing}` → **not** rolled back; they run to
 *     completion against the original schedule version (audit chain stays
 *     intact via `change_ids`)
 *   - terminal states (`consumed`, `failed`, `skipped`, `cancelled`,
 *     `expired`) → no-op (already past the rollback boundary)
 *
 * The handler is invoked by the cue editor service when an admin issues a
 * `RollbackSchedule` change. The change record is the source of truth for
 * the affected_cue_ids list — we record it on `patch_json.affected_cue_ids`
 * (R6 — do not extend `RecordCueChangeInput` for this).
 */

import type { CueRepository } from '../../repos/cue-repository.js'
import type { EventRepository } from '../../repos/event-repository.js'
import type {
  PublicDiscussionCueDomain,
  PublicDiscussionCueStatus,
} from './types.js'
import { buildCueExecutionCancelledEvent } from './cue-domain-events.js'

const PRE_EXECUTION_STATUSES: ReadonlySet<PublicDiscussionCueStatus> = new Set([
  'draft',
  'validating',
  'validated',
  'scheduled',
  'prewarming',
  'due',
  'deferred',
])

const IN_FLIGHT_STATUSES: ReadonlySet<PublicDiscussionCueStatus> = new Set([
  'claimed',
  'executing',
])

export interface ScheduleRollbackHandlerDeps {
  cueRepo: CueRepository
  eventRepo: EventRepository
  now?: () => Date
}

export interface ApplyScheduleRollbackInput {
  scheduleId: string
  affectedCueIds: string[]
  /** Identity of the actor that issued the rollback (admin / system). */
  actor: { actor_type: 'agent' | 'human' | 'system'; actor_id: string | null }
  reason?: string
}

export interface ScheduleRollbackOutcome {
  cancelled: string[]
  inFlight: string[]
  /** Cues already in a terminal state when the rollback was applied. */
  noop: string[]
  /** Cues whose ids were not found in the repo (data drift; logged). */
  missing: string[]
}

export class ScheduleRollbackHandler {
  constructor(private readonly deps: ScheduleRollbackHandlerDeps) {}

  async apply(input: ApplyScheduleRollbackInput): Promise<ScheduleRollbackOutcome> {
    const outcome: ScheduleRollbackOutcome = {
      cancelled: [],
      inFlight: [],
      noop: [],
      missing: [],
    }
    const occurredAt = this.deps.now ? this.deps.now() : new Date()

    for (const cueId of input.affectedCueIds) {
      const cue = await this.deps.cueRepo.findCueById(cueId)
      if (!cue) {
        outcome.missing.push(cueId)
        continue
      }
      if (PRE_EXECUTION_STATUSES.has(cue.status)) {
        await this.deps.cueRepo.setCueStatus(cueId, 'cancelled')
        outcome.cancelled.push(cueId)
        // Emit a Cancelled event per cancelled cue. We only have the cue
        // identity at this point — the worker's CueExecutionCancelled is
        // attempt-scoped, but rollback cancels happen *before* an attempt
        // is created. We synthesize a sentinel attempt_id namespaced as
        // `rollback:<scheduleId>:<cueId>` so dedup index stays consistent.
        const sentinelAttemptId = synthesizeRollbackAttemptId(input.scheduleId, cueId)
        const event = buildCueExecutionCancelledEvent({
          attempt_id: sentinelAttemptId,
          cue_id: cueId,
          schedule_id: cue.schedule_id,
          community_id: resolveCueCommunityId(cue),
          occurred_at: occurredAt,
          lease_owner: null,
          cancelled_by: {
            actor_type: input.actor.actor_type,
            actor_id: input.actor.actor_id,
          },
          reason:
            input.reason ?? `schedule_rollback:${input.scheduleId}`,
        })
        this.deps.eventRepo.create(event)
      } else if (IN_FLIGHT_STATUSES.has(cue.status)) {
        // Run-to-completion semantics — leave the cue alone. The audit
        // chain will still link via the original schedule version.
        outcome.inFlight.push(cueId)
      } else {
        // consumed / failed / skipped / cancelled / expired — already past
        // the rollback boundary.
        outcome.noop.push(cueId)
      }
    }

    return outcome
  }
}

function resolveCueCommunityId(cue: PublicDiscussionCueDomain): string | null {
  if (cue.community_id) return cue.community_id
  if (cue.scope.mode === 'single' && cue.scope.community_id) {
    return cue.scope.community_id
  }
  return null
}

/**
 * Sentinel attempt id used when emitting `CueExecutionCancelled` for cues
 * that were rolled back *before* a real `CueExecutionAttempt` row was
 * created. Encoding the schedule + cue ids keeps the idempotency key
 * (built from this id) stable across retries of the same rollback.
 */
function synthesizeRollbackAttemptId(scheduleId: string, cueId: string): string {
  return `rollback-${scheduleId}-${cueId}`
}
