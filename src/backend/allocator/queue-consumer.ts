import type { EventAllocator } from './allocator.js'
import type { EventQueue } from './event-queue.js'
import type { AllocationResult, DegradationMonitor } from './types.js'
import type { DefaultQuotaCalculator } from './quota-calculator.js'

export interface ConsumerStats {
  processed: number
  allocated_agents: number
  rejected_admission: number
  rejected_quota: number
}

export interface BatchResult {
  results: AllocationResult[]
  stats: ConsumerStats
}

/**
 * Pulls events from the queue, computes lag for the degradation monitor,
 * delegates to EventAllocator, and tracks thread-level quotas.
 */
export class QueueConsumer {
  constructor(
    private readonly queue: EventQueue,
    private readonly allocator: EventAllocator,
    private readonly degradation: DegradationMonitor,
    private readonly quotaCalc: DefaultQuotaCalculator,
  ) {}

  /**
   * Process up to `maxBatch` events from the queue.
   * Before each dequeue, the consumer updates the degradation monitor with
   * the current queue lag (now − oldest event timestamp).
   */
  async processBatch(maxBatch: number): Promise<BatchResult> {
    const results: AllocationResult[] = []
    const stats: ConsumerStats = {
      processed: 0,
      allocated_agents: 0,
      rejected_admission: 0,
      rejected_quota: 0,
    }

    for (let i = 0; i < maxBatch; i++) {
      this.updateLag()

      const event = this.queue.dequeue()
      if (!event) break

      const result = await this.allocator.allocate(event)
      results.push(result)
      stats.processed++
      stats.allocated_agents += result.agents.length

      if (result.skipped_reasons._admission) stats.rejected_admission++
      if (result.skipped_reasons._quota) stats.rejected_quota++

      const threadQuotaScopeId = event.thread_id ?? event.post_id
      if (result.agents.length > 0 && threadQuotaScopeId) {
        this.quotaCalc.recordThreadAllocation(threadQuotaScopeId, result.agents.length)
      }
    }

    this.updateLag()
    return { results, stats }
  }

  /** Process a single event. Returns null if queue is empty. */
  async processOne(): Promise<AllocationResult | null> {
    this.updateLag()
    const event = this.queue.dequeue()
    if (!event) return null

    const result = await this.allocator.allocate(event)

    const threadQuotaScopeId = event.thread_id ?? event.post_id
    if (result.agents.length > 0 && threadQuotaScopeId) {
      this.quotaCalc.recordThreadAllocation(threadQuotaScopeId, result.agents.length)
    }

    this.updateLag()
    return result
  }

  /** Drain: process all remaining events in the queue. */
  async drain(): Promise<BatchResult> {
    const size = this.queue.size()
    if (size === 0) return { results: [], stats: { processed: 0, allocated_agents: 0, rejected_admission: 0, rejected_quota: 0 } }
    return this.processBatch(size)
  }

  private updateLag(): void {
    const oldest = this.queue.oldestTimestampMs()
    if (oldest === null) {
      this.degradation.reportLag(0)
      return
    }
    const lagSeconds = Math.max(0, (Date.now() - oldest) / 1000)
    this.degradation.reportLag(lagSeconds)
  }
}
