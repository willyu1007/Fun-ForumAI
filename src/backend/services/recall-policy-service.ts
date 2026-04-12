import type {
  AttentionOpportunity,
  EffectiveOrchestrationPolicy,
  RecallDecision,
  ThreadAttentionBudgetSnapshot,
} from '../../shared/forum-orchestration.js'
import type { EventPayload, ScoredCandidate } from '../allocator/types.js'
import {
  InMemoryRecallStateStore,
  type RecallStateStore,
} from './recall-state-store.js'

export class RecallPolicyService {
  constructor(
    private readonly store: RecallStateStore = new InMemoryRecallStateStore(),
  ) {}

  async evaluate(input: {
    event: EventPayload
    opportunity: AttentionOpportunity
    candidates: ScoredCandidate[]
    policy?: EffectiveOrchestrationPolicy | null
    budget?: Partial<ThreadAttentionBudgetSnapshot>
  }): Promise<{
    decisions: RecallDecision[]
    granted: ScoredCandidate[]
  }> {
    const recallControl = input.policy?.recall_control ?? {
      schema_version: 'forum-orchestration-policy.v1',
      pair_window_minutes: 30,
      pair_max_exchanges: 2,
      post_thread_share_cap: 0.7,
      reactive_recall_decay: 'moderate' as const,
      newcomer_min_share: 0.2,
      late_entry_min_share: 0.1,
      revive_old_branch_budget: 2,
    }
    const budget: ThreadAttentionBudgetSnapshot = {
      thread_id: input.opportunity.thread_id ?? input.event.thread_id ?? input.event.post_id ?? 'unknown',
      pair_window_seconds:
        input.budget?.pair_window_seconds ?? recallControl.pair_window_minutes * 60,
      pair_max_exchanges:
        input.budget?.pair_max_exchanges ?? recallControl.pair_max_exchanges,
      revive_old_branch_budget:
        input.budget?.revive_old_branch_budget ?? recallControl.revive_old_branch_budget,
    }

    const decisions: RecallDecision[] = []
    const granted: ScoredCandidate[] = []
    const outsiderCandidates = input.candidates.filter((candidate) =>
      !input.opportunity.target_agent_ids.includes(candidate.agent_id))
    const diversityReason = resolveDiversityPressureReason(input.opportunity, recallControl)

    for (const candidate of input.candidates) {
      const isTargeted = input.opportunity.target_agent_ids.includes(candidate.agent_id)
      const isPriority = input.opportunity.priority_agent_ids.includes(candidate.agent_id)
      const isOutsider = !isTargeted
      const quotaKind = resolveQuotaKind({
        diversityReason,
        isOutsider,
        isTargeted,
        isPriority,
      })
      const appliedPolicySnapshot = {
        profile: input.policy?.profile ?? input.opportunity.profile,
        recall_control: recallControl,
      }

      if (input.opportunity.suppressed_agent_ids.includes(candidate.agent_id)) {
        decisions.push({
          agent_id: candidate.agent_id,
          opportunity_id: input.opportunity.id,
          decision: 'SUPPRESSED',
          decision_source: 'opportunity',
          decision_scope: 'opportunity',
          decay_stage: null,
          quota_kind: quotaKind,
          reason_codes: ['suppressed_by_opportunity'],
          applied_policy_snapshot: appliedPolicySnapshot,
          suppression_reason: 'suppressed_by_opportunity',
        })
        continue
      }

      if (
        diversityReason
        && outsiderCandidates.length > 0
        && isTargeted
        && !isPriority
      ) {
        decisions.push({
          agent_id: candidate.agent_id,
          opportunity_id: input.opportunity.id,
          decision: 'SUPPRESSED',
          decision_source: 'policy_guard',
          decision_scope: 'post',
          decay_stage: null,
          quota_kind: 'outsider_diversity',
          reason_codes: [diversityReason],
          applied_policy_snapshot: appliedPolicySnapshot,
          suppression_reason: diversityReason,
        })
        continue
      }

      const storeResult = await this.store.attemptGrant({
        thread_id: budget.thread_id,
        event_author_key: resolveEventAuthorKey(input.event),
        candidate_agent_id: candidate.agent_id,
        pair_window_seconds: budget.pair_window_seconds,
        pair_max_exchanges: budget.pair_max_exchanges,
        quota_kind: quotaKind,
        reactive_recall_decay: recallControl.reactive_recall_decay,
        is_revive_branch: input.opportunity.source === 'REVIVE_OLD_BRANCH',
        revive_old_branch_budget: budget.revive_old_branch_budget,
      })

      if (!storeResult.granted) {
        decisions.push({
          agent_id: candidate.agent_id,
          opportunity_id: input.opportunity.id,
          decision: 'SUPPRESSED',
          decision_source: 'policy_guard',
          decision_scope: storeResult.suppression_reason === 'revive_budget_exhausted'
            ? 'thread'
            : 'thread_pair',
          decay_stage: storeResult.decay_stage,
          quota_kind: quotaKind,
          reason_codes: storeResult.suppression_reason ? [storeResult.suppression_reason] : [],
          applied_policy_snapshot: appliedPolicySnapshot,
          suppression_reason: storeResult.suppression_reason,
        })
        continue
      }

      const grantedCandidate = quotaKind === 'outsider_diversity'
        ? {
            ...candidate,
            score: candidate.score + 0.75,
            reasons: candidate.reasons.includes('recall_quota=outsider_diversity')
              ? candidate.reasons
              : [...candidate.reasons, 'recall_quota=outsider_diversity'],
          }
        : candidate
      granted.push(grantedCandidate)
      decisions.push({
        agent_id: candidate.agent_id,
        opportunity_id: input.opportunity.id,
        decision: 'GRANTED',
        decision_source:
          quotaKind === 'outsider_diversity'
            ? 'outsider_diversity'
            : quotaKind === 'incumbent_reactive'
              ? 'reactive_recall'
              : 'baseline',
        decision_scope:
          quotaKind === 'outsider_diversity'
            ? 'post'
            : quotaKind === 'incumbent_reactive'
              ? 'thread_pair'
              : 'candidate',
        decay_stage: quotaKind === 'incumbent_reactive' ? storeResult.decay_stage : null,
        quota_kind: quotaKind,
        reason_codes: input.opportunity.reason_codes,
        applied_policy_snapshot: appliedPolicySnapshot,
        suppression_reason: null,
      })
    }

    granted.sort((left, right) => right.score - left.score)
    return { decisions, granted }
  }
}

function resolveEventAuthorKey(event: EventPayload): string {
  return event.author_agent_id
    ?? event.author_user_id
    ?? `${event.author_actor_type ?? 'unknown'}:${event.event_id}`
}

function resolveDiversityPressureReason(
  opportunity: AttentionOpportunity,
  recallControl: NonNullable<EffectiveOrchestrationPolicy['recall_control']>,
): string | null {
  if ((opportunity.post_attention_state?.dominant_thread_share ?? 0) > recallControl.post_thread_share_cap) {
    return 'dominant_thread_cap'
  }
  if ((opportunity.post_attention_state?.newcomer_share_recent ?? 1) < recallControl.newcomer_min_share) {
    return 'newcomer_floor'
  }
  if ((opportunity.post_attention_state?.late_entry_share_recent ?? 1) < recallControl.late_entry_min_share) {
    return 'late_entry_floor'
  }
  return null
}

function resolveQuotaKind(input: {
  diversityReason: string | null
  isOutsider: boolean
  isTargeted: boolean
  isPriority: boolean
}): RecallDecision['quota_kind'] {
  if (input.diversityReason && input.isOutsider) {
    return 'outsider_diversity'
  }
  if (input.isTargeted || input.isPriority) {
    return 'incumbent_reactive'
  }
  return 'neutral'
}
