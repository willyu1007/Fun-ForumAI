/**
 * T-213 M3 — `RealInProcessCommunityBudgetService`.
 *
 * Real per-community cap enforcement implementing the
 * `CommunityBudgetService` interface frozen by T-211 §C.1. Replaces the M1
 * `InProcessTrivialCommunityBudgetService` (always-grants) at the same
 * module path; downstream call sites (CueWorker / CueAdmissionController /
 * PostScheduler) keep the same import.
 *
 * Caps come from T-211 §G:
 *   - **Daily cap**: 24 root posts per community per UTC day. Tracked as a
 *     rolling per-community counter that resets on UTC midnight (mirrors the
 *     stub's `rolloverIfNeeded` pattern).
 *   - **Hourly window**: 4 root posts per community per 60-minute sliding
 *     window. Implemented as a timestamp deque: every grant pushes; every
 *     `acquire()` shifts entries older than the window. Token bucket was
 *     considered but rejected — spec is a hard cap, not a refill rate.
 *
 * Invariant I-4 enforcement:
 *   - both `'autonomous'` (PostScheduler call site, this milestone wires it
 *     in) and `'cue'` (CueWorker call site, wired by T-212) consume from the
 *     same per-community quota; the snapshot exposes their per-path counts
 *     separately so I-8 metric track separation stays intact.
 *
 * Reservation lifecycle:
 *   - `acquire()` increments the shared counters AND pushes a window
 *     timestamp; returns a reservation handle.
 *   - `release(reservationId)` decrements the counters and pulls the
 *     reservation's window timestamp out of the deque so a failed
 *     write doesn't burn budget. Idempotent.
 *   - Reservations carry a soft-hold `expiresAt`; if a caller never
 *     releases, a sweep run lazily inside `acquire()` rolls expired
 *     reservations back into the available budget. (MVP: lazy sweep —
 *     no background timer.)
 *
 * Feature flag: the constructor accepts `{ enforced }`. With
 * `enforced=false` the service falls through to always-grant behavior
 * (per the trivial stub) so the M3 PR can ship dark and flip on at the
 * deploy stage. The container reads `COMMUNITY_BUDGET_ENFORCED=true` to
 * enable.
 */

import { randomUUID } from 'node:crypto'
import type {
  CommunityBudgetAcquireResult,
  CommunityBudgetReservation,
  CommunityBudgetService,
  CommunityBudgetSnapshot,
  ProductionPath,
} from './community-budget-service.js'

const DEFAULT_DAILY_CAP = 24
const DEFAULT_WINDOW_CAP = 4
const DEFAULT_WINDOW_MS = 60 * 60 * 1000
const DEFAULT_SOFT_HOLD_MS = 5 * 60 * 1000

export interface RealCommunityBudgetCaps {
  /** Per-community per-UTC-day cap across both production paths. Default: 24. */
  dailyCap?: number
  /** Per-community per-window cap across both paths. Default: 4. */
  windowCap?: number
  /** Sliding-window length in ms. Default: 60 minutes. */
  windowMs?: number
  /** Soft-hold horizon (auto-release when `expiresAt` passes). Default: 5 minutes. */
  softHoldMs?: number
}

export interface RealCommunityBudgetServiceOptions extends RealCommunityBudgetCaps {
  /**
   * Master switch. `false` (default) makes the service always-grant — the
   * M3 PR ships with this off so the deploy can roll forward without
   * affecting either path. Operations flips it via the
   * `COMMUNITY_BUDGET_ENFORCED` env var.
   */
  enforced?: boolean
  now?: () => Date
}

interface PerCommunityState {
  counter_day: string
  autonomous_used_today: number
  cue_used_today: number
  /** Sorted ascending by `acquiredAt`; entries shifted when older than `windowMs`. */
  windowTimestamps: number[]
}

interface InternalReservation extends CommunityBudgetReservation {
  /** True once `release` (or sweep) has rolled the counters back. */
  released: boolean
}

export class RealInProcessCommunityBudgetService
  implements CommunityBudgetService
{
  private readonly dailyCap: number
  private readonly windowCap: number
  private readonly windowMs: number
  private readonly softHoldMs: number
  private readonly enforced: boolean
  private readonly nowFn: () => Date

  private readonly states = new Map<string, PerCommunityState>()
  private readonly reservations = new Map<string, InternalReservation>()

  constructor(options: RealCommunityBudgetServiceOptions = {}) {
    this.dailyCap = options.dailyCap ?? DEFAULT_DAILY_CAP
    this.windowCap = options.windowCap ?? DEFAULT_WINDOW_CAP
    this.windowMs = options.windowMs ?? DEFAULT_WINDOW_MS
    this.softHoldMs = options.softHoldMs ?? DEFAULT_SOFT_HOLD_MS
    this.enforced = options.enforced ?? false
    this.nowFn = options.now ?? (() => new Date())
  }

  async acquire(
    communityId: string,
    path: ProductionPath,
    cost: number,
  ): Promise<CommunityBudgetAcquireResult> {
    const now = this.nowFn()
    this.sweepExpired(now)
    const state = this.ensureState(communityId, now)
    this.rolloverIfNeeded(state, now)
    this.shiftWindow(state, now)

    if (this.enforced) {
      const usedToday = state.autonomous_used_today + state.cue_used_today
      if (usedToday + cost > this.dailyCap) {
        return {
          granted: false,
          reason: 'budget_exhausted',
          retry_after_ms: this.msUntilNextUtcMidnight(now),
        }
      }
      if (state.windowTimestamps.length + cost > this.windowCap) {
        // Earliest entry tells us when capacity frees up.
        const oldest = state.windowTimestamps[0]
        const retry = oldest + this.windowMs - now.getTime()
        return {
          granted: false,
          reason: 'rate_limited',
          retry_after_ms: Math.max(0, retry),
        }
      }
    }

    if (path === 'autonomous') {
      state.autonomous_used_today += cost
    } else {
      state.cue_used_today += cost
    }
    state.windowTimestamps.push(now.getTime())

    const reservation: InternalReservation = {
      reservationId: randomUUID(),
      communityId,
      path,
      cost,
      acquiredAt: now,
      expiresAt: new Date(now.getTime() + this.softHoldMs),
      released: false,
    }
    this.reservations.set(reservation.reservationId, reservation)
    return { granted: true, reservation: this.snapshotReservation(reservation) }
  }

  async release(reservationId: string): Promise<void> {
    const reservation = this.reservations.get(reservationId)
    if (!reservation || reservation.released) return
    this.releaseReservation(reservation, this.nowFn())
  }

  async query(communityId: string): Promise<CommunityBudgetSnapshot> {
    const now = this.nowFn()
    this.sweepExpired(now)
    const state = this.ensureState(communityId, now)
    this.rolloverIfNeeded(state, now)
    this.shiftWindow(state, now)
    const usedToday = state.autonomous_used_today + state.cue_used_today
    return {
      communityId,
      daily_remaining: this.enforced
        ? Math.max(0, this.dailyCap - usedToday)
        : Number.POSITIVE_INFINITY,
      window_remaining: this.enforced
        ? Math.max(0, this.windowCap - state.windowTimestamps.length)
        : Number.POSITIVE_INFINITY,
      autonomous_used_today: state.autonomous_used_today,
      cue_used_today: state.cue_used_today,
    }
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private ensureState(communityId: string, now: Date): PerCommunityState {
    const existing = this.states.get(communityId)
    if (existing) return existing
    const fresh: PerCommunityState = {
      counter_day: utcDayString(now),
      autonomous_used_today: 0,
      cue_used_today: 0,
      windowTimestamps: [],
    }
    this.states.set(communityId, fresh)
    return fresh
  }

  private rolloverIfNeeded(state: PerCommunityState, now: Date): void {
    const today = utcDayString(now)
    if (state.counter_day === today) return
    state.autonomous_used_today = 0
    state.cue_used_today = 0
    state.counter_day = today
    // Note: window timestamps are NOT cleared on UTC rollover — the sliding
    // window straddles day boundaries. shiftWindow handles aging.
  }

  private shiftWindow(state: PerCommunityState, now: Date): void {
    const cutoff = now.getTime() - this.windowMs
    while (
      state.windowTimestamps.length > 0 &&
      state.windowTimestamps[0] <= cutoff
    ) {
      state.windowTimestamps.shift()
    }
  }

  private sweepExpired(now: Date): void {
    const expired: InternalReservation[] = []
    for (const reservation of this.reservations.values()) {
      if (reservation.released) continue
      if (reservation.expiresAt.getTime() <= now.getTime()) {
        expired.push(reservation)
      }
    }
    for (const reservation of expired) {
      this.releaseReservation(reservation, now)
    }
  }

  private releaseReservation(
    reservation: InternalReservation,
    now: Date,
  ): void {
    if (reservation.released) return
    reservation.released = true
    const state = this.states.get(reservation.communityId)
    if (state) {
      this.rolloverIfNeeded(state, now)
      if (reservation.path === 'autonomous') {
        state.autonomous_used_today = Math.max(
          0,
          state.autonomous_used_today - reservation.cost,
        )
      } else {
        state.cue_used_today = Math.max(
          0,
          state.cue_used_today - reservation.cost,
        )
      }
      // Remove the matching window timestamp (best effort: oldest first
      // entry that equals the reservation's acquire time; if the deque has
      // already shifted past it, the slot is already free).
      const acquireMs = reservation.acquiredAt.getTime()
      const idx = state.windowTimestamps.indexOf(acquireMs)
      if (idx >= 0) state.windowTimestamps.splice(idx, 1)
    }
  }

  private snapshotReservation(
    reservation: InternalReservation,
  ): CommunityBudgetReservation {
    return {
      reservationId: reservation.reservationId,
      communityId: reservation.communityId,
      path: reservation.path,
      cost: reservation.cost,
      acquiredAt: new Date(reservation.acquiredAt.getTime()),
      expiresAt: new Date(reservation.expiresAt.getTime()),
    }
  }

  private msUntilNextUtcMidnight(now: Date): number {
    const next = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
      ),
    )
    return next.getTime() - now.getTime()
  }
}

function utcDayString(date: Date): string {
  return date.toISOString().slice(0, 10)
}
