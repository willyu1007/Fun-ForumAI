/**
 * T-216 M1 — Postgres `MediaPlanResolutionRepository`.
 *
 * Append-only audit log. Bulk insert via `createMany` with `skipDuplicates:false`
 * since the planner generates fresh ids per row. Domain rows are returned in
 * the same order as input so callers can correlate.
 */

import {
  type PrismaClient,
  type MediaPlanResolution as PrismaMediaPlanResolution,
  type CueMediaPlanOutcome as PrismaCueMediaPlanOutcome,
  type CueMediaUsageStrength as PrismaCueMediaUsageStrength,
  type CueMediaRole as PrismaCueMediaRole,
} from '@prisma/client'
import type {
  MediaPlanOutcome,
  MediaPlanResolution,
  MediaPlanResolutionRepository,
  RecordMediaPlanResolutionInput,
} from '../media-plan-resolution-repository.js'
import type {
  CueMediaRole,
  CueMediaUsageStrength,
} from '../cue-repository.js'

const OUTCOME_TO_DB: Record<MediaPlanOutcome, PrismaCueMediaPlanOutcome> = {
  runtime_context: 'RUNTIME_CONTEXT',
  public_display: 'PUBLIC_DISPLAY',
  derivative_source: 'DERIVATIVE_SOURCE',
  not_used: 'NOT_USED',
  blocked: 'BLOCKED',
  degraded: 'DEGRADED',
}
const OUTCOME_FROM_DB: Record<PrismaCueMediaPlanOutcome, MediaPlanOutcome> = {
  RUNTIME_CONTEXT: 'runtime_context',
  PUBLIC_DISPLAY: 'public_display',
  DERIVATIVE_SOURCE: 'derivative_source',
  NOT_USED: 'not_used',
  BLOCKED: 'blocked',
  DEGRADED: 'degraded',
}

const STRENGTH_TO_DB: Record<CueMediaUsageStrength, PrismaCueMediaUsageStrength> = {
  optional: 'OPTIONAL',
  preferred: 'PREFERRED',
  anchor: 'ANCHOR',
  selected_only_pool: 'SELECTED_ONLY_POOL',
}
const STRENGTH_FROM_DB: Record<PrismaCueMediaUsageStrength, CueMediaUsageStrength> = {
  OPTIONAL: 'optional',
  PREFERRED: 'preferred',
  ANCHOR: 'anchor',
  SELECTED_ONLY_POOL: 'selected_only_pool',
}

const ROLE_TO_DB: Record<CueMediaRole, PrismaCueMediaRole> = {
  context_anchor: 'CONTEXT_ANCHOR',
  mood_reference: 'MOOD_REFERENCE',
  evidence_card: 'EVIDENCE_CARD',
  visual_seed: 'VISUAL_SEED',
  cover_candidate: 'COVER_CANDIDATE',
  continuity_anchor: 'CONTINUITY_ANCHOR',
}
const ROLE_FROM_DB: Record<PrismaCueMediaRole, CueMediaRole> = {
  CONTEXT_ANCHOR: 'context_anchor',
  MOOD_REFERENCE: 'mood_reference',
  EVIDENCE_CARD: 'evidence_card',
  VISUAL_SEED: 'visual_seed',
  COVER_CANDIDATE: 'cover_candidate',
  CONTINUITY_ANCHOR: 'continuity_anchor',
}

export class PgMediaPlanResolutionRepository
  implements MediaPlanResolutionRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async recordMany(
    inputs: ReadonlyArray<RecordMediaPlanResolutionInput>,
  ): Promise<MediaPlanResolution[]> {
    if (inputs.length === 0) return []
    // Append per-row so we can return generated ids in the original order;
    // batches are tiny (one cue's pool, typically 1-5 items) so the round-trip
    // cost is negligible.
    const created: MediaPlanResolution[] = []
    for (const input of inputs) {
      const row = await this.prisma.mediaPlanResolution.create({
        data: {
          attemptId: input.attempt_id,
          assetId: input.asset_id,
          imagePlannerDecisionId: input.image_planner_decision_id ?? null,
          requestedStrength: STRENGTH_TO_DB[input.requested_strength],
          requestedRole: ROLE_TO_DB[input.requested_role],
          planOutcome: OUTCOME_TO_DB[input.plan_outcome],
          reason: input.reason ?? null,
        },
      })
      created.push(this.toDomain(row))
    }
    return created
  }

  async findByAttempt(attemptId: string): Promise<MediaPlanResolution[]> {
    const rows = await this.prisma.mediaPlanResolution.findMany({
      where: { attemptId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map((row) => this.toDomain(row))
  }

  private toDomain(row: PrismaMediaPlanResolution): MediaPlanResolution {
    return {
      id: row.id,
      attempt_id: row.attemptId,
      asset_id: row.assetId,
      image_planner_decision_id: row.imagePlannerDecisionId,
      requested_strength: STRENGTH_FROM_DB[row.requestedStrength],
      requested_role: ROLE_FROM_DB[row.requestedRole],
      plan_outcome: OUTCOME_FROM_DB[row.planOutcome],
      reason: row.reason,
      created_at: row.createdAt,
    }
  }
}
