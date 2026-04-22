import type { VoiceLineId } from '../../../shared/agent-persona-catalog.js'
import type { UsageLedgerEntry } from '../../llm/gateway-contract.js'
import { collectCostBaselineFromLedger, collectFallbackOrDegradedEntries } from '../../runtime/rollout-evidence-collector.js'
import type {
  AgentInferenceProfile,
  AgentInferenceShadowReview,
  CoreFamily,
  InferenceProfileSnapshot,
  ShadowReviewEvidence,
} from '../../runtime/inference-profile-types.js'
import { ValidationError } from '../../lib/errors.js'
import {
  buildIdentityWriteDelta,
  toRuntimeShadowReview,
} from './codec.js'
import {
  buildAgentScopedObservabilitySnapshot,
  buildCollectedShadowReviewSummary,
  buildNotRunGateSnapshot,
  buildRunningShadowReviewEvidence,
  buildRunningShadowReviewSummary,
  buildShadowCompareDimensions,
  serializeShadowReviewEvidence,
  serializeShadowReviewSummary,
  summarizeWindow,
  toShadowReviewFallbackEntry,
} from './shadow-review.js'
import type {
  InferenceProfileEvaluationResult,
  InferenceProfileServiceDeps,
  StoredInferenceShadowReview,
} from './types.js'

export async function reconcileShadowReview(
  deps: InferenceProfileServiceDeps,
  input: {
    agentId: string
    incumbentFamily: CoreFamily
    homeVoiceLineId: VoiceLineId
    profile: AgentInferenceProfile
    snapshot: InferenceProfileSnapshot
    existingShadowReview: StoredInferenceShadowReview
  },
): Promise<AgentInferenceShadowReview | null> {
  const latest = input.existingShadowReview
  const hasShadowChallenger =
    input.profile.migrationState === 'shadow' &&
    Boolean(input.profile.challengerFamily && input.profile.challengerVoiceLineId)

  if (!hasShadowChallenger) {
    if (latest && (latest.status === 'running' || latest.status === 'collected')) {
      const superseded = await deps.personaStateRepo.updateInferenceShadowReview(latest.id, {
        status: 'superseded',
        decided_at: new Date(),
        decided_by_user_id: 'system',
      })
      await resolveShadowReviewCase(
        deps,
        latest.review_case_id,
        'shadow_compare_superseded',
        'system',
      )
      return superseded ? toRuntimeShadowReview(superseded) : null
    }
    return latest ? toRuntimeShadowReview(latest) : null
  }

  if (
    latest &&
    latest.challenger_voice_line_id === input.profile.challengerVoiceLineId &&
    latest.challenger_family === input.profile.challengerFamily &&
    (latest.status === 'running' || latest.status === 'collected' || latest.status === 'applied')
  ) {
    return toRuntimeShadowReview(latest)
  }

  if (latest && (latest.status === 'running' || latest.status === 'collected')) {
    const superseded = await deps.personaStateRepo.updateInferenceShadowReview(latest.id, {
      status: 'superseded',
      decided_at: new Date(),
      decided_by_user_id: 'system',
    })
    await resolveShadowReviewCase(
      deps,
      latest.review_case_id,
      'shadow_compare_superseded',
      'system',
    )
    return superseded ? toRuntimeShadowReview(superseded) : null
  }

  return latest ? toRuntimeShadowReview(latest) : null
}

export async function createShadowReview(
  deps: InferenceProfileServiceDeps,
  input: {
    agentId: string
    actorUserId: string
    incumbentFamily: CoreFamily
    incumbentVoiceLineId: VoiceLineId
    challengerFamily: CoreFamily
    challengerVoiceLineId: VoiceLineId
    shadowStartedAt: string | null
    snapshot: InferenceProfileSnapshot
    previousReview: AgentInferenceShadowReview | null
  },
): Promise<AgentInferenceShadowReview> {
  const reviewStartedAt = input.previousReview
    ? new Date()
    : input.shadowStartedAt
      ? new Date(input.shadowStartedAt)
      : new Date()

  if (
    input.previousReview &&
    (input.previousReview.status === 'running' || input.previousReview.status === 'collected')
  ) {
    await deps.personaStateRepo.updateInferenceShadowReview(input.previousReview.id, {
      status: 'superseded',
      decided_at: new Date(),
      decided_by_user_id: input.actorUserId,
    })
    await resolveShadowReviewCase(
      deps,
      input.previousReview.reviewCaseId,
      'shadow_compare_superseded',
      input.actorUserId,
    )
  }

  const observabilitySnapshot = buildAgentScopedObservabilitySnapshot(
    await listAgentLedgerEntries(deps, input.agentId),
  )
  const summary = buildRunningShadowReviewSummary()
  const evidence = buildRunningShadowReviewEvidence(observabilitySnapshot)
  const created = await deps.personaStateRepo.createInferenceShadowReview({
    agent_id: input.agentId,
    incumbent_family: input.incumbentFamily,
    incumbent_voice_line_id: input.incumbentVoiceLineId,
    challenger_family: input.challengerFamily,
    challenger_voice_line_id: input.challengerVoiceLineId,
    status: 'running',
    summary_json: serializeShadowReviewSummary(summary),
    evidence_json: serializeShadowReviewEvidence(evidence),
    started_at: reviewStartedAt,
  })

  let next = created
  if (deps.reviewService) {
    const reviewCase = await deps.reviewService.openAutomatedCase({
      case_type: 'CONFIG_REVIEW',
      queue: 'CONFIG_REVIEW',
      priority: 75,
      summary_text: `Inference shadow compare for agent ${input.agentId}`,
      risk_summary: {
        review_type: 'inference_shadow_compare',
        challenger_voice_line_id: input.challengerVoiceLineId,
        challenger_family: input.challengerFamily,
      },
      opened_reason: 'inference_shadow_compare',
      opened_by: input.actorUserId,
      target: {
        case_id: '',
        target_type: 'inference_shadow_review',
        target_id: created.id,
        relation_type: 'PRIMARY',
        channel: 'inference_shadow_review',
        agent_id: input.agentId,
        user_id: input.actorUserId,
      },
      evidence: [
        {
          case_id: '',
          snapshot_type: 'inference_shadow_compare_start',
          payload: {
            incumbent_family: input.incumbentFamily,
            incumbent_voice_line_id: input.incumbentVoiceLineId,
            challenger_family: input.challengerFamily,
            challenger_voice_line_id: input.challengerVoiceLineId,
          },
          content: {
            snapshot: input.snapshot,
          },
          context: {
            agent_id: input.agentId,
            review_id: created.id,
          },
          policy_hits: {
            review_type: 'inference_shadow_compare',
          },
          action_history: {
            opened_reason: 'inference_shadow_compare',
          },
        },
      ],
    })
    next =
      (await deps.personaStateRepo.updateInferenceShadowReview(created.id, {
        review_case_id: reviewCase.id,
      })) ?? created
  }
  return toRuntimeShadowReview(next)
}

export async function collectShadowReviewEvidence(
  deps: InferenceProfileServiceDeps,
  input: {
    agentId: string
    actorUserId: string
    incumbentVoiceLineId: VoiceLineId
    compiled: InferenceProfileEvaluationResult
    review: AgentInferenceShadowReview
  },
): Promise<AgentInferenceShadowReview> {
  const agentLedgerEntries = await listAgentLedgerEntries(deps, input.agentId)
  const afterObservability = buildAgentScopedObservabilitySnapshot(agentLedgerEntries)
  const beforeObservability = input.review.evidence.beforeObservability
  const identityWriteDelta = buildIdentityWriteDelta(beforeObservability, afterObservability)
  const startedAt = new Date(input.review.startedAt)
  const windowEntries = agentLedgerEntries.filter((entry) => new Date(entry.created_at) >= startedAt)
  const fallbackEntries = collectFallbackOrDegradedEntries(windowEntries)
  const { attribution, gate } = deps.usageLedgerRepo
    ? await collectCostBaselineFromLedger(deps.usageLedgerRepo, input.agentId, startedAt)
    : { attribution: {}, gate: buildNotRunGateSnapshot() }
  const window = summarizeWindow(windowEntries, startedAt)
  const compareDimensions = buildShadowCompareDimensions({
    profile: input.compiled.profile,
    snapshot: input.compiled.snapshot,
    identityWriteDelta,
    gate,
    window,
  })
  const summary = buildCollectedShadowReviewSummary(compareDimensions, window)
  const evidence: ShadowReviewEvidence = {
    beforeObservability,
    afterObservability,
    identityWriteDelta,
    costAttribution: attribution,
    gate,
    window,
    fallbackEntries: fallbackEntries.slice(0, 20).map(toShadowReviewFallbackEntry),
  }
  const updated =
    (await deps.personaStateRepo.updateInferenceShadowReview(input.review.id, {
      status: 'collected',
      summary_json: serializeShadowReviewSummary(summary),
      evidence_json: serializeShadowReviewEvidence(evidence),
      collected_at: new Date(),
    })) ?? (await deps.personaStateRepo.findLatestInferenceShadowReview(input.agentId))
  if (!updated) {
    throw new ValidationError('Failed to persist shadow review evidence')
  }

  if (deps.reviewService) {
    await deps.reviewService.ensureCase({
      case_type: 'CONFIG_REVIEW',
      queue: 'CONFIG_REVIEW',
      priority: 75,
      summary_text: `Inference shadow compare collected for agent ${input.agentId}`,
      risk_summary: {
        review_type: 'inference_shadow_compare',
        recommendation: summary.recommendation,
      },
      opened_reason: 'inference_shadow_compare',
      opened_by: input.actorUserId,
      target: {
        case_id: '',
        target_type: 'inference_shadow_review',
        target_id: input.review.id,
        relation_type: 'PRIMARY',
        channel: 'inference_shadow_review',
        agent_id: input.agentId,
        user_id: input.actorUserId,
      },
      evidence: [
        {
          case_id: '',
          snapshot_type: 'inference_shadow_compare_collect',
          payload: {
            summary,
          },
          content: {
            evidence,
          },
          context: {
            agent_id: input.agentId,
            review_id: input.review.id,
            incumbent_voice_line_id: input.incumbentVoiceLineId,
            challenger_voice_line_id: input.review.challengerVoiceLineId,
          },
          policy_hits: {
            review_type: 'inference_shadow_compare',
            recommendation: summary.recommendation,
          },
          action_history: {
            collected_at: new Date().toISOString(),
          },
        },
      ],
    })
  }

  return toRuntimeShadowReview(updated)
}

export async function finalizeShadowReview(
  deps: InferenceProfileServiceDeps,
  reviewId: string,
  status: 'applied' | 'rejected',
  actorUserId: string,
  resolutionAction: string,
): Promise<void> {
  const review = await deps.personaStateRepo.updateInferenceShadowReview(reviewId, {
    status,
    decided_at: new Date(),
    decided_by_user_id: actorUserId,
  })
  if (!review) return
  await resolveShadowReviewCase(deps, review.review_case_id, resolutionAction, actorUserId)
}

export async function resolveShadowReviewCase(
  deps: InferenceProfileServiceDeps,
  reviewCaseId: string | null,
  resolutionAction: string,
  actorUserId: string,
): Promise<void> {
  if (!reviewCaseId || !deps.reviewService) return
  try {
    await deps.reviewService.resolveCase(reviewCaseId, resolutionAction, actorUserId)
  } catch {
    // Ignore already-resolved or missing review cases so the inference flow remains deterministic.
  }
}

async function listAgentLedgerEntries(
  deps: InferenceProfileServiceDeps,
  agentId: string,
): Promise<UsageLedgerEntry[]> {
  if (!deps.usageLedgerRepo) {
    return []
  }
  return deps.usageLedgerRepo.listByAgent(agentId, 500)
}
