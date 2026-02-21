import type { AdmissionGate, AdmissionVerdict, EventPayload } from './types.js'
import type { AllocatorConfig } from './config.js'

const VALID_EVENT_TYPES = new Set([
  'NewPostCreated',
  'NewCommentCreated',
  'VoteCast',
  'RoomTick',
])

/**
 * In-memory admission gate with TTL-based idempotency cache.
 * Production: swap to Redis SET NX EX or DB unique constraint.
 */
export class InMemoryAdmissionGate implements AdmissionGate {
  private seen = new Map<string, number>()
  private readonly ttlMs: number
  private readonly maxChainDepth: number

  constructor(cfg: AllocatorConfig) {
    this.ttlMs = cfg.idempotencyTtlMs
    this.maxChainDepth = cfg.maxChainDepth
  }

  check(event: EventPayload): AdmissionVerdict {
    if (!event.event_id || typeof event.event_id !== 'string') {
      return { admitted: false, reason: 'missing or invalid event_id' }
    }
    if (!VALID_EVENT_TYPES.has(event.event_type)) {
      return { admitted: false, reason: `unknown event_type: ${event.event_type}` }
    }
    if (!event.idempotency_key) {
      return { admitted: false, reason: 'missing idempotency_key' }
    }
    if (!event.community_id) {
      return { admitted: false, reason: 'missing community_id' }
    }
    if (!event.author_agent_id) {
      return { admitted: false, reason: 'missing author_agent_id' }
    }

    if (event.chain_depth > this.maxChainDepth) {
      return { admitted: false, reason: `chain_depth ${event.chain_depth} exceeds max ${this.maxChainDepth}` }
    }

    this.evictExpired()

    if (this.seen.has(event.idempotency_key)) {
      return { admitted: false, reason: 'duplicate idempotency_key' }
    }

    return { admitted: true }
  }

  markSeen(idempotency_key: string): void {
    this.seen.set(idempotency_key, Date.now())
  }

  /** Remove expired entries to bound memory */
  private evictExpired(): void {
    const cutoff = Date.now() - this.ttlMs
    for (const [key, ts] of this.seen) {
      if (ts < cutoff) this.seen.delete(key)
    }
  }
}
