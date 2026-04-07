import type {
  AttentionOpportunity,
  PairInteractionWindow,
  RecallDecision,
  ThreadAttentionBudgetSnapshot,
} from '../../shared/forum-orchestration.js'
import type { EventPayload, ScoredCandidate } from '../allocator/types.js'

export class RecallPolicyService {
  private readonly pairWindows = new Map<string, PairInteractionWindow>()

  evaluate(input: {
    event: EventPayload
    opportunity: AttentionOpportunity
    candidates: ScoredCandidate[]
    budget?: Partial<ThreadAttentionBudgetSnapshot>
  }): {
    decisions: RecallDecision[]
    granted: ScoredCandidate[]
  } {
    const now = Date.now()
    const budget: ThreadAttentionBudgetSnapshot = {
      thread_id: input.opportunity.thread_id ?? input.event.thread_id ?? input.event.post_id ?? 'unknown',
      pair_window_seconds: input.budget?.pair_window_seconds ?? 600,
      pair_max_exchanges: input.budget?.pair_max_exchanges ?? 2,
      revive_old_branch_budget: input.budget?.revive_old_branch_budget ?? 2,
    }

    const decisions: RecallDecision[] = []
    const granted: ScoredCandidate[] = []

    for (const candidate of input.candidates) {
      if (input.opportunity.suppressed_agent_ids.includes(candidate.agent_id)) {
        decisions.push({
          agent_id: candidate.agent_id,
          opportunity_id: input.opportunity.id,
          decision: 'SUPPRESSED',
          reason_codes: ['suppressed_by_opportunity'],
        })
        continue
      }

      const pairKey = buildPairKey(input.event.author_agent_id, candidate.agent_id)
      const currentWindow = this.getPairWindow(pairKey, budget.thread_id, now, budget.pair_window_seconds)
      if (currentWindow.exchange_count >= budget.pair_max_exchanges) {
        decisions.push({
          agent_id: candidate.agent_id,
          opportunity_id: input.opportunity.id,
          decision: 'SUPPRESSED',
          reason_codes: ['pair_window_cap'],
        })
        continue
      }

      this.pairWindows.set(pairKey, {
        ...currentWindow,
        exchange_count: currentWindow.exchange_count + 1,
        last_exchanged_at: new Date(now).toISOString(),
      })
      decisions.push({
        agent_id: candidate.agent_id,
        opportunity_id: input.opportunity.id,
        decision: 'GRANTED',
        reason_codes: input.opportunity.reason_codes,
      })
      granted.push(candidate)
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
}

function buildPairKey(left: string, right: string): string {
  return [left, right].sort().join('::')
}
