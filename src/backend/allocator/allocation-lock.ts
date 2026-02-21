import type { AllocationLock } from './types.js'

/**
 * In-memory (event_id, agent_id) lock with TTL.
 * Prevents the same agent from being allocated to the same event twice.
 *
 * Production: use DB advisory locks, Redis SET NX, or a unique constraint.
 */
export class InMemoryAllocationLock implements AllocationLock {
  private locks = new Map<string, number>()

  constructor(private readonly ttlMs: number) {}

  tryAcquire(event_id: string, agent_id: string): boolean {
    this.evictExpired()
    const key = `${event_id}:${agent_id}`
    if (this.locks.has(key)) return false
    this.locks.set(key, Date.now())
    return true
  }

  release(event_id: string, agent_id: string): void {
    this.locks.delete(`${event_id}:${agent_id}`)
  }

  get size(): number {
    return this.locks.size
  }

  clear(): void {
    this.locks.clear()
  }

  private evictExpired(): void {
    const cutoff = Date.now() - this.ttlMs
    for (const [key, ts] of this.locks) {
      if (ts < cutoff) this.locks.delete(key)
    }
  }
}
