/**
 * T-212 M1 — community-budget-service (in-process trivial stub).
 *
 * Interface frozen by T-211 boundary doc §C.1; T-213 replaces this in-process
 * stub with the real per-community caps + rate-limit enforcement at the same
 * module path so callers' import lines never change.
 *
 * MVP behavior:
 *   - `acquire` ALWAYS grants. Records the (community, path) tuple in memory
 *     so dashboards can project utilization before T-213 enforces caps.
 *   - `release` is real (idempotent) — must drop the reservation from the
 *     in-memory map. T-213's real service must honor the same release call;
 *     a leaky stub here would mask the contract gap when T-213 swaps in.
 *   - `query` returns a per-community snapshot built from in-memory state.
 *
 * Invariant I-4 (T-211 §E): both autonomous (PostScheduler — wired by T-213)
 * and cue (T-212 CueWorker) paths must `acquire` against this same service so
 * caps cover the union of both production paths.
 */

import { randomUUID } from 'node:crypto'

export type ProductionPath = 'autonomous' | 'cue'

export interface CommunityBudgetReservation {
  reservationId: string
  communityId: string
  path: ProductionPath
  cost: number
  acquiredAt: Date
  /** Soft hold horizon; auto-released by sweeps after this if not committed. */
  expiresAt: Date
}

export type CommunityBudgetAcquireResult =
  | { granted: true; reservation: CommunityBudgetReservation }
  | {
      granted: false
      reason: 'budget_exhausted' | 'rate_limited' | 'service_disabled'
      retry_after_ms?: number
    }

export interface CommunityBudgetSnapshot {
  communityId: string
  daily_remaining: number
  window_remaining: number
  autonomous_used_today: number
  cue_used_today: number
}

export interface CommunityBudgetService {
  acquire(
    communityId: string,
    path: ProductionPath,
    cost: number,
  ): Promise<CommunityBudgetAcquireResult>
  release(reservationId: string): Promise<void>
  query(communityId: string): Promise<CommunityBudgetSnapshot>
}

const DEFAULT_SOFT_HOLD_MS = 5 * 60 * 1000

interface PerCommunityCounters {
  autonomous_used_today: number
  cue_used_today: number
  /** Date string (YYYY-MM-DD UTC) the counters belong to; resets on rollover. */
  counter_day: string
}

/**
 * In-process stub. Always grants; tracks reservations + per-day counters in
 * memory so observability is non-trivial even before T-213 enforces caps.
 */
export class InProcessTrivialCommunityBudgetService
  implements CommunityBudgetService
{
  private readonly reservations = new Map<string, CommunityBudgetReservation>()
  private readonly counters = new Map<string, PerCommunityCounters>()

  constructor(
    private readonly options: {
      softHoldMs?: number
      now?: () => Date
    } = {},
  ) {}

  async acquire(
    communityId: string,
    path: ProductionPath,
    cost: number,
  ): Promise<CommunityBudgetAcquireResult> {
    const now = this.now()
    this.rolloverIfNeeded(communityId, now)

    const reservation: CommunityBudgetReservation = {
      reservationId: randomUUID(),
      communityId,
      path,
      cost,
      acquiredAt: now,
      expiresAt: new Date(now.getTime() + (this.options.softHoldMs ?? DEFAULT_SOFT_HOLD_MS)),
    }
    this.reservations.set(reservation.reservationId, reservation)

    const counters = this.ensureCounters(communityId, now)
    if (path === 'autonomous') {
      counters.autonomous_used_today += cost
    } else {
      counters.cue_used_today += cost
    }

    return { granted: true, reservation }
  }

  async release(reservationId: string): Promise<void> {
    this.reservations.delete(reservationId)
  }

  async query(communityId: string): Promise<CommunityBudgetSnapshot> {
    const now = this.now()
    this.rolloverIfNeeded(communityId, now)
    const counters = this.ensureCounters(communityId, now)
    return {
      communityId,
      daily_remaining: Number.POSITIVE_INFINITY,
      window_remaining: Number.POSITIVE_INFINITY,
      autonomous_used_today: counters.autonomous_used_today,
      cue_used_today: counters.cue_used_today,
    }
  }

  private now(): Date {
    return this.options.now ? this.options.now() : new Date()
  }

  private ensureCounters(communityId: string, now: Date): PerCommunityCounters {
    const existing = this.counters.get(communityId)
    if (existing) return existing
    const fresh: PerCommunityCounters = {
      autonomous_used_today: 0,
      cue_used_today: 0,
      counter_day: utcDayString(now),
    }
    this.counters.set(communityId, fresh)
    return fresh
  }

  private rolloverIfNeeded(communityId: string, now: Date): void {
    const counters = this.counters.get(communityId)
    if (!counters) return
    const today = utcDayString(now)
    if (counters.counter_day === today) return
    counters.autonomous_used_today = 0
    counters.cue_used_today = 0
    counters.counter_day = today
  }
}

function utcDayString(date: Date): string {
  return date.toISOString().slice(0, 10)
}
