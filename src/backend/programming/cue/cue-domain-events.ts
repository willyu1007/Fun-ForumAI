/**
 * T-212 M4 — cue execution domain events.
 *
 * Three additive event types fanned out through the existing forum event
 * dispatcher (no dispatcher schema change). Existing consumers
 * (achievementsOrchestrator / nurtureOrchestrator / relationService /
 * searchProjectionService) pick them up by `event_type`. Idempotency keys
 * are stable per attempt so worker restart / replay does not double-emit
 * (R9 — `EventRepository.create` honors `idempotency_key` index already).
 *
 * `CueExecutionFailed` covers `failed / skipped / expired` terminals; admin
 * cancels emit `CueExecutionCancelled` instead (T-212 overview §6.2 — admin
 * intent is a distinct class from system failure).
 */

import type {
  CreateEventInput,
  EventActorType,
} from '../../repos/types/common.js'
import { buildIdempotencyKey } from '../contract/index.js'
import type { CueExecutionAttemptStatus } from '../../repos/cue-repository.js'

export const CUE_EXECUTION_COMPLETED = 'CUE_EXECUTION_COMPLETED'
export const CUE_EXECUTION_FAILED = 'CUE_EXECUTION_FAILED'
export const CUE_EXECUTION_CANCELLED = 'CUE_EXECUTION_CANCELLED'

export type CueExecutionEventType =
  | typeof CUE_EXECUTION_COMPLETED
  | typeof CUE_EXECUTION_FAILED
  | typeof CUE_EXECUTION_CANCELLED

export interface CueExecutionEventBase {
  attempt_id: string
  cue_id: string
  schedule_id: string
  community_id: string | null
  /** When the worker generated the event (terminal transition timestamp). */
  occurred_at: Date
  /** Optional set of CueChange ids that influenced this attempt (audit). */
  change_ids?: string[]
  /** Worker that owned the lease at termination. */
  lease_owner: string | null
}

export interface CueExecutionCompletedEventInput extends CueExecutionEventBase {
  post_id: string
  thread_id?: string | null
  forum_scene_metadata_id?: string | null
  selected_cast: Array<{ agent_id: string; role?: string | null }>
  media_usage?: Array<{ asset_id: string; usage: 'context' | 'display' }>
}

export interface CueExecutionFailedEventInput extends CueExecutionEventBase {
  /** `failed` / `skipped` / `expired` — admin cancels go to the Cancelled event instead. */
  terminal_status: Extract<
    CueExecutionAttemptStatus,
    'failed' | 'skipped' | 'misfired'
  >
  reason_codes: string[]
  error_code?: string | null
  error_text?: string | null
}

export interface CueExecutionCancelledEventInput extends CueExecutionEventBase {
  /** Who initiated the cancel (admin user, system, etc.). */
  cancelled_by: { actor_type: EventActorType; actor_id: string | null }
  reason: string
  /** Distinct path: post-write cancel where the post landed but cue was force-cancelled afterwards. */
  force_cancelled_post_write?: boolean
}

// =============================================================================
// Builders
// =============================================================================

export function buildCueExecutionCompletedEvent(
  input: CueExecutionCompletedEventInput,
): CreateEventInput {
  return {
    event_type: CUE_EXECUTION_COMPLETED,
    plane: 'CONTROL',
    schema_version: 'v1',
    community_id: input.community_id,
    post_id: input.post_id,
    actor_type: 'system',
    actor_id: input.lease_owner,
    correlation_id: `cue:${input.cue_id}:attempt:${input.attempt_id}`,
    idempotency_key: buildIdempotencyKey(
      'cue-execution-completed',
      input.attempt_id,
    ),
    payload_json: {
      attempt_id: input.attempt_id,
      cue_id: input.cue_id,
      schedule_id: input.schedule_id,
      community_id: input.community_id,
      post_id: input.post_id,
      thread_id: input.thread_id ?? null,
      forum_scene_metadata_id: input.forum_scene_metadata_id ?? null,
      selected_cast: input.selected_cast,
      media_usage: input.media_usage ?? [],
      change_ids: input.change_ids ?? [],
      occurred_at: input.occurred_at.toISOString(),
    },
  }
}

export function buildCueExecutionFailedEvent(
  input: CueExecutionFailedEventInput,
): CreateEventInput {
  return {
    event_type: CUE_EXECUTION_FAILED,
    plane: 'CONTROL',
    schema_version: 'v1',
    community_id: input.community_id,
    actor_type: 'system',
    actor_id: input.lease_owner,
    correlation_id: `cue:${input.cue_id}:attempt:${input.attempt_id}`,
    idempotency_key: buildIdempotencyKey(
      'cue-execution-failed',
      input.attempt_id,
    ),
    payload_json: {
      attempt_id: input.attempt_id,
      cue_id: input.cue_id,
      schedule_id: input.schedule_id,
      community_id: input.community_id,
      terminal_status: input.terminal_status,
      reason_codes: input.reason_codes,
      error_code: input.error_code ?? null,
      error_text: input.error_text ?? null,
      change_ids: input.change_ids ?? [],
      occurred_at: input.occurred_at.toISOString(),
    },
  }
}

export function buildCueExecutionCancelledEvent(
  input: CueExecutionCancelledEventInput,
): CreateEventInput {
  return {
    event_type: CUE_EXECUTION_CANCELLED,
    plane: 'CONTROL',
    schema_version: 'v1',
    community_id: input.community_id,
    actor_type: input.cancelled_by.actor_type,
    actor_id: input.cancelled_by.actor_id,
    correlation_id: `cue:${input.cue_id}:attempt:${input.attempt_id}`,
    idempotency_key: buildIdempotencyKey(
      'cue-execution-cancelled',
      input.attempt_id,
    ),
    payload_json: {
      attempt_id: input.attempt_id,
      cue_id: input.cue_id,
      schedule_id: input.schedule_id,
      community_id: input.community_id,
      reason: input.reason,
      cancelled_by: input.cancelled_by,
      force_cancelled_post_write: input.force_cancelled_post_write ?? false,
      change_ids: input.change_ids ?? [],
      occurred_at: input.occurred_at.toISOString(),
    },
  }
}
