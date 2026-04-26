/**
 * T-213 M2 — `LoadSignalService` (cached, ~30s TTL) + canonical contract.
 *
 * Powers the consumers that tolerate slight staleness:
 *   - `cue-preview-service` stage 3 (admin pre-publish preview)
 *   - Cue Board heatmap (T-213 M4)
 *   - T-214 `TriggerDetector` LoadGate
 *
 * Keeps strict separation from `AdmissionLoadService` (live, hot-path) per the
 * umbrella spec: admission MUST NOT read cached snapshots. Both services share
 * the underlying `compute()` call but differ in caching policy.
 *
 * Read-through cache pattern:
 *   1. `get(communityId)` reads the latest cached row from
 *      `LoadSnapshotRepository` whose `computed_at > now - ttl`.
 *   2. If the cached row is still fresh, return it as a `LoadSignalSnapshot`.
 *   3. On miss / expiry, call `AdmissionLoadService.compute()`, persist the
 *      result with `freshness='cached'`, and return.
 *
 * Note on persistence under load: cached writes are best-effort — if the
 * repo throws, the service still returns the freshly computed snapshot so the
 * caller is not blocked. The cache is a performance optimization, not a
 * correctness gate.
 *
 * **Contract location** — `LoadSignalSnapshot`, `LoadSignalSource`, and the
 * `LoadSignalService` interface are declared here (the canonical home).
 * The historical stub at `services/__stubs__/load-signal-service-stub.ts`
 * is now a test-only fixture that re-exports these types and provides the
 * always-green stub value for unit tests.
 */

import type { LoadSnapshotRepository } from '../repos/load-snapshot-repository.js'
import type { AdmissionLoadService } from '../programming/load/admission-load-service.js'
import type { LoadState } from '../programming/load/types.js'

// =============================================================================
// Canonical contract types (T-213 M2; previously homed under `__stubs__/`).
// =============================================================================

/**
 * Audit-only tag distinguishing the data source of a load signal snapshot.
 * Admission decisions key off `status` — never `source`.
 *
 *   - `stub_until_t213` — historical always-green stub (test fixture only)
 *   - `admission_load_service:live` — live `AdmissionLoadService` snapshot
 *     adapted to the `LoadSignalSnapshot` shape for admission-controller use
 *   - `load_signal_service:cached` — cached read-through from this service
 */
export type LoadSignalSource =
  | 'stub_until_t213'
  | 'admission_load_service:live'
  | 'load_signal_service:cached'

export interface LoadSignalSnapshot {
  status: LoadState
  community_id: string
  trigger_at_iso: string | null
  source: LoadSignalSource
}

/**
 * Frozen seam for any consumer that wants to read load state. The
 * `CachedLoadSignalService` class below is the production impl; the
 * `loadSignalServiceStub` test fixture (in `__stubs__/`) is the unit-test
 * impl. Both implement this interface; downstream code depends on the
 * interface, never on a concrete class.
 */
export interface LoadSignalService {
  get(communityId: string, triggerAtIso?: string | null): Promise<LoadSignalSnapshot>
}

// =============================================================================
// Cached implementation
// =============================================================================

export interface LoadSignalServiceDeps {
  admissionLoadService: AdmissionLoadService
  loadSnapshotRepo: LoadSnapshotRepository
  /** Cache freshness window in ms; defaults to 30s. */
  ttlMs?: number
  /** Defaults to `() => new Date()`. */
  now?: () => Date
}

const DEFAULT_TTL_MS = 30_000

export class CachedLoadSignalService implements LoadSignalService {
  private readonly ttlMs: number
  private readonly nowFn: () => Date

  constructor(private readonly deps: LoadSignalServiceDeps) {
    this.ttlMs = deps.ttlMs ?? DEFAULT_TTL_MS
    this.nowFn = deps.now ?? (() => new Date())
  }

  async get(
    communityId: string,
    triggerAtIso?: string | null,
  ): Promise<LoadSignalSnapshot> {
    const now = this.nowFn()
    const computedAfter = new Date(now.getTime() - this.ttlMs)

    const cached = await this.deps.loadSnapshotRepo.findLatestForCommunity({
      communityId,
      freshness: 'cached',
      computedAfter,
    })
    if (cached) {
      return {
        status: cached.state,
        community_id: communityId,
        trigger_at_iso: triggerAtIso ?? null,
        source: 'load_signal_service:cached',
      }
    }

    const fresh = await this.deps.admissionLoadService.compute(communityId, now)
    // Best-effort persist; never let cache writes mask the live answer.
    try {
      await this.deps.loadSnapshotRepo.insert({
        ...fresh,
        freshness: 'cached',
      })
    } catch (err) {
      console.error(
        `[LoadSignalService] cached insert failed for community=${communityId}: ${(err as Error).message}`,
      )
    }
    return {
      status: fresh.state,
      community_id: communityId,
      trigger_at_iso: triggerAtIso ?? null,
      source: 'load_signal_service:cached',
    }
  }
}
