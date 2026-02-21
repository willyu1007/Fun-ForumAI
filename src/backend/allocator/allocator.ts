import type {
  EventPayload,
  AllocationResult,
  AdmissionGate,
  QuotaCalculator,
  CandidateSelector,
  AllocationLock,
  DegradationMonitor,
  AgentRepository,
  SelectedAgent,
} from './types.js'

export interface AllocatorDeps {
  admission: AdmissionGate
  quota: QuotaCalculator
  candidates: CandidateSelector
  lock: AllocationLock
  degradation: DegradationMonitor
  agentRepo: AgentRepository
}

/**
 * Five-stage event response allocator pipeline.
 *
 *   1. Admission   – validate format, dedup by idempotency_key, check chain_depth
 *   2. Quota        – compute effective quota = min(layers) × degradation factor
 *   3. Candidate    – filter eligible agents, score, rank, take top-K
 *   4. Lock         – acquire (event_id, agent_id) to prevent double allocation
 *   5. Output       – assemble AllocationResult
 */
export class EventAllocator {
  constructor(private readonly deps: AllocatorDeps) {}

  allocate(event: EventPayload): AllocationResult {
    const { admission, quota, candidates, lock, degradation, agentRepo } = this.deps

    // Stage 1: Admission
    const verdict = admission.check(event)
    if (!verdict.admitted) {
      return this.emptyResult(event.event_id, verdict.reason)
    }

    admission.markSeen(event.idempotency_key)

    // Stage 2: Quota calculation
    const degradationState = degradation.getState()
    const effectiveQuota = quota.calculate(
      {
        event_type: event.event_type,
        community_id: event.community_id,
        post_id: event.post_id,
        room_id: event.room_id,
      },
      degradationState,
    )

    if (effectiveQuota <= 0) {
      return {
        event_id: event.event_id,
        quota_applied: 0,
        degradation_level: degradationState.level,
        agents: [],
        skipped_reasons: { _quota: 'effective quota is 0' },
      }
    }

    // Stage 3: Candidate selection
    const pool = agentRepo.getCandidates(event.community_id)
    const scored = candidates.select(event, pool, effectiveQuota, degradationState)

    // Stage 4: Lock acquisition
    const selected: SelectedAgent[] = []
    const skipped: Record<string, string> = {}

    for (let i = 0; i < scored.length; i++) {
      const c = scored[i]
      const acquired = lock.tryAcquire(event.event_id, c.agent_id)
      if (acquired) {
        selected.push({
          agent_id: c.agent_id,
          score: c.score,
          priority: i + 1,
        })
      } else {
        skipped[c.agent_id] = 'lock_conflict'
      }
    }

    // Stage 5: Output
    return {
      event_id: event.event_id,
      quota_applied: effectiveQuota,
      degradation_level: degradationState.level,
      agents: selected,
      skipped_reasons: skipped,
    }
  }

  private emptyResult(event_id: string, reason: string): AllocationResult {
    return {
      event_id,
      quota_applied: 0,
      degradation_level: 'normal',
      agents: [],
      skipped_reasons: { _admission: reason },
    }
  }
}
