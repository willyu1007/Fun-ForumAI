/**
 * T-216 M1 — `MediaPlanResolutionRepository`.
 *
 * Audit log for cue-media planner decisions. One row per attempt × pool item.
 * Append-only: no update / delete API. Future milestones (M2/M3) extend the
 * outcome distribution; the row schema does not change.
 */

import type {
  CueMediaRole,
  CueMediaUsageStrength,
} from './cue-repository.js'

export type MediaPlanOutcome =
  | 'runtime_context'
  | 'public_display'
  | 'derivative_source'
  | 'not_used'
  | 'blocked'
  | 'degraded'

export interface MediaPlanResolution {
  id: string
  attempt_id: string
  asset_id: string
  image_planner_decision_id: string | null
  requested_strength: CueMediaUsageStrength
  requested_role: CueMediaRole
  plan_outcome: MediaPlanOutcome
  reason: string | null
  created_at: Date
}

export interface RecordMediaPlanResolutionInput {
  attempt_id: string
  asset_id: string
  image_planner_decision_id?: string | null
  requested_strength: CueMediaUsageStrength
  requested_role: CueMediaRole
  plan_outcome: MediaPlanOutcome
  reason?: string | null
}

export interface MediaPlanResolutionRepository {
  recordMany(
    inputs: ReadonlyArray<RecordMediaPlanResolutionInput>,
  ): Promise<MediaPlanResolution[]>
  findByAttempt(attemptId: string): Promise<MediaPlanResolution[]>
}

let counter = 0
function localId(): string {
  return `media_plan_resolution_${Date.now().toString(36)}_${(++counter).toString(36)}`
}

export class InMemoryMediaPlanResolutionRepository
  implements MediaPlanResolutionRepository
{
  private readonly rows: MediaPlanResolution[] = []

  async recordMany(
    inputs: ReadonlyArray<RecordMediaPlanResolutionInput>,
  ): Promise<MediaPlanResolution[]> {
    const now = new Date()
    const created: MediaPlanResolution[] = []
    for (const input of inputs) {
      const row: MediaPlanResolution = {
        id: localId(),
        attempt_id: input.attempt_id,
        asset_id: input.asset_id,
        image_planner_decision_id: input.image_planner_decision_id ?? null,
        requested_strength: input.requested_strength,
        requested_role: input.requested_role,
        plan_outcome: input.plan_outcome,
        reason: input.reason ?? null,
        created_at: now,
      }
      this.rows.push(row)
      created.push({ ...row })
    }
    return created
  }

  async findByAttempt(attemptId: string): Promise<MediaPlanResolution[]> {
    return this.rows
      .filter((r) => r.attempt_id === attemptId)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
      .map((r) => ({ ...r }))
  }
}
