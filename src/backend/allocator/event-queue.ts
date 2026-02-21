import type { EventPayload } from './types.js'

// ─── Queue interface ────────────────────────────────────────

export interface EventQueue {
  enqueue(event: EventPayload): void
  dequeue(): EventPayload | null
  peek(): EventPayload | null
  size(): number
  /** Oldest event's created_at timestamp (ms since epoch), or null if empty */
  oldestTimestampMs(): number | null
  clear(): void
}

// ─── In-memory FIFO queue ───────────────────────────────────

/**
 * Simple FIFO queue backed by an array.
 * Production: swap to pg-boss (Postgres) or BullMQ (Redis).
 */
export class InMemoryEventQueue implements EventQueue {
  private items: EventPayload[] = []

  enqueue(event: EventPayload): void {
    this.items.push(event)
  }

  dequeue(): EventPayload | null {
    return this.items.shift() ?? null
  }

  peek(): EventPayload | null {
    return this.items[0] ?? null
  }

  size(): number {
    return this.items.length
  }

  oldestTimestampMs(): number | null {
    if (this.items.length === 0) return null
    return new Date(this.items[0].created_at).getTime()
  }

  clear(): void {
    this.items = []
  }
}
