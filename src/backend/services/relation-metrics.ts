export interface RelationMetricsSnapshot {
  relation_state_transition_total: number
  relation_block_total: number
  relation_eval_latency_ms: number
  relation_eval_count: number
  relation_dedup_hit_total: number
}

export class RelationMetrics {
  private stateTransitions = 0
  private blocks = 0
  private evalTotalLatencyMs = 0
  private evalCount = 0
  private dedupHits = 0

  markStateTransition(): void {
    this.stateTransitions += 1
  }

  markBlock(): void {
    this.blocks += 1
  }

  markEval(latencyMs: number): void {
    this.evalTotalLatencyMs += Math.max(latencyMs, 0)
    this.evalCount += 1
  }

  markDedupHit(): void {
    this.dedupHits += 1
  }

  snapshot(): RelationMetricsSnapshot {
    return {
      relation_state_transition_total: this.stateTransitions,
      relation_block_total: this.blocks,
      relation_eval_latency_ms: this.evalCount > 0 ? this.evalTotalLatencyMs / this.evalCount : 0,
      relation_eval_count: this.evalCount,
      relation_dedup_hit_total: this.dedupHits,
    }
  }
}
