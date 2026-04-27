/**
 * T-212 M1 — community-budget-service (in-process trivial stub).
 *
 * Interface frozen by T-211 boundary doc §C.1. The real per-community
 * cap-enforcing implementation lives in `community-budget-service-real.ts`
 * (T-213 M3); this trivial stub stays around as the default-off mode and
 * for tests that don't need cap enforcement. Both impls share the same
 * `CommunityBudgetService` interface — call sites never see a difference.
 *
 * Behavior contract:
 *   - `acquire` ALWAYS grants. Records the `(community, path, cost)` tuple
 *     in memory so dashboards can project utilization before caps enforce.
 *   - `release` (T-213 M3 audit): rolls back the per-path daily counters
 *     and drops the reservation from the in-memory map (idempotent). Prior
 *     to M3 the counters stayed elevated on release, which diverged from
 *     the real impl's behavior; aligning them eliminates that semantic split.
 *   - `query` returns per-community totals; `daily_remaining` and
 *     `window_remaining` are `Infinity` (no cap on this stub).
 *
 * Invariant I-4 (T-211 §E): both autonomous (PostScheduler) and cue
 * (CueWorker) paths must `acquire` against this same service so caps cover
 * the union of both production paths. T-213 M3 wired the autonomous-side
 * call site at `runtime/post-scheduler.ts`.
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
    const reservation = this.reservations.get(reservationId)
    if (!reservation) return
    this.reservations.delete(reservationId)
    // T-213 M3 audit — keep release symmetric with the real impl so tests
    // that exercise rollback semantics see the same observable state on
    // both stubs. Prior to this fix the counters stayed elevated on
    // release; that produced a subtle semantic split between the trivial
    // and real services that could mask production bugs.
    const counters = this.counters.get(reservation.communityId)
    if (!counters) return
    if (reservation.path === 'autonomous') {
      counters.autonomous_used_today = Math.max(
        0,
        counters.autonomous_used_today - reservation.cost,
      )
    } else {
      counters.cue_used_today = Math.max(
        0,
        counters.cue_used_today - reservation.cost,
      )
    }
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
