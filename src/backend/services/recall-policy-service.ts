import type {
  AttentionOpportunity,
  EffectiveOrchestrationPolicy,
  PairInteractionWindow,
  RecallDecision,
  ThreadAttentionBudgetSnapshot,
} from '../../shared/forum-orchestration.js'
import type { EventPayload, ScoredCandidate } from '../allocator/types.js'

export class RecallPolicyService {
  private readonly pairWindows = new Map<string, PairInteractionWindow>()
  private readonly reviveWindows = new Map<string, { count: number; updated_at: number }>()

  evaluate(input: {
    event: EventPayload
    opportunity: AttentionOpportunity
    candidates: ScoredCandidate[]
    policy?: EffectiveOrchestrationPolicy | null
    budget?: Partial<ThreadAttentionBudgetSnapshot>
  }): {
    decisions: RecallDecision[]
    granted: ScoredCandidate[]
  } {
    const now = Date.now()
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
    const shouldPreferOutsiders = Boolean(
      outsiderCandidates.length > 0
      && (
        (input.opportunity.post_attention_state?.dominant_thread_share ?? 0) > recallControl.post_thread_share_cap
        || (input.opportunity.post_attention_state?.newcomer_share_recent ?? 1) < recallControl.newcomer_min_share
        || (input.opportunity.post_attention_state?.late_entry_share_recent ?? 1) < recallControl.late_entry_min_share
      ),
    )

    for (const candidate of input.candidates) {
      const pairKey = buildPairKey(resolveEventAuthorKey(input.event), candidate.agent_id)
      const currentWindow = this.getPairWindow(pairKey, budget.thread_id, now, budget.pair_window_seconds)
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
          reason_codes: ['suppressed_by_opportunity'],
          applied_policy_snapshot: appliedPolicySnapshot,
          suppression_reason: 'suppressed_by_opportunity',
        })
        continue
      }

      if (
        shouldPreferOutsiders
        && input.opportunity.target_agent_ids.includes(candidate.agent_id)
      ) {
        const reasonCode =
          (input.opportunity.post_attention_state?.dominant_thread_share ?? 0) > recallControl.post_thread_share_cap
            ? 'dominant_thread_cap'
            : (input.opportunity.post_attention_state?.newcomer_share_recent ?? 1) < recallControl.newcomer_min_share
              ? 'newcomer_floor'
              : 'late_entry_floor'
        decisions.push({
          agent_id: candidate.agent_id,
          opportunity_id: input.opportunity.id,
          decision: 'SUPPRESSED',
          decision_source: 'policy_guard',
          reason_codes: [reasonCode],
          applied_policy_snapshot: appliedPolicySnapshot,
          suppression_reason: reasonCode,
        })
        continue
      }

      if (input.opportunity.source === 'REVIVE_OLD_BRANCH') {
        const reviveWindow = this.getReviveWindow(budget.thread_id, now)
        if (reviveWindow.count >= budget.revive_old_branch_budget) {
          decisions.push({
            agent_id: candidate.agent_id,
            opportunity_id: input.opportunity.id,
            decision: 'SUPPRESSED',
            decision_source: 'policy_guard',
            reason_codes: ['revive_budget_exhausted'],
            applied_policy_snapshot: appliedPolicySnapshot,
            suppression_reason: 'revive_budget_exhausted',
          })
          continue
        }
      }

      if (currentWindow.exchange_count >= budget.pair_max_exchanges) {
        decisions.push({
          agent_id: candidate.agent_id,
          opportunity_id: input.opportunity.id,
          decision: 'SUPPRESSED',
          decision_source: 'policy_guard',
          reason_codes: ['pair_window_cap'],
          applied_policy_snapshot: appliedPolicySnapshot,
          suppression_reason: 'pair_window_cap',
        })
        continue
      }

      this.pairWindows.set(pairKey, {
        ...currentWindow,
        exchange_count: currentWindow.exchange_count + 1,
        last_exchanged_at: new Date(now).toISOString(),
      })
      if (input.opportunity.source === 'REVIVE_OLD_BRANCH') {
        this.reviveWindows.set(budget.thread_id, {
          count: this.getReviveWindow(budget.thread_id, now).count + 1,
          updated_at: now,
        })
      }

      granted.push(candidate)
      decisions.push({
        agent_id: candidate.agent_id,
        opportunity_id: input.opportunity.id,
        decision: 'GRANTED',
        decision_source: 'fallback',
        reason_codes: input.opportunity.reason_codes,
        applied_policy_snapshot: appliedPolicySnapshot,
        suppression_reason: null,
      })
    }

    return { decisions, granted }
  }

  private getPairWindow(
    pairKey: string,
    threadId: string,
    now: number,
    pairWindowSeconds: number,
  ): PairInteractionWindow {
    const existing = this.pairWindows.get(pairKey)
    if (!existing || !existing.last_exchanged_at) {
      return {
        post_id: 'unknown',
        thread_id: threadId,
        pair_key: pairKey,
        exchange_count: 0,
        last_exchanged_at: null,
      }
    }

    const ageMs = now - new Date(existing.last_exchanged_at).getTime()
    if (ageMs > pairWindowSeconds * 1000) {
      return {
        ...existing,
        exchange_count: 0,
        thread_id: threadId,
      }
    }
    return existing
  }

  private getReviveWindow(threadId: string, now: number): { count: number; updated_at: number } {
    const existing = this.reviveWindows.get(threadId)
    if (!existing) {
      return { count: 0, updated_at: now }
    }
    const ageMs = now - existing.updated_at
    if (ageMs > 60 * 60 * 1000) {
      return { count: 0, updated_at: now }
    }
    return existing
  }
}

function buildPairKey(left: string, right: string): string {
  return [left, right].sort().join('::')
}

function resolveEventAuthorKey(event: EventPayload): string {
  return event.author_agent_id
    ?? event.author_user_id
    ?? `${event.author_actor_type ?? 'unknown'}:${event.event_id}`
}
