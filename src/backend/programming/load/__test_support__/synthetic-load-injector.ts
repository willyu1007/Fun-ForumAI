/**
 * T-213 M5 — synthetic load injector for E2E tests.
 *
 * Wraps a base `AdmissionLoadService` and lets the caller force the next
 * `compute()` call to return a `LoadState` of their choice. Useful for
 * driving admission outcomes through the full decision matrix without
 * fabricating realistic counter values.
 *
 * Usage:
 * ```ts
 * const real = new AdmissionLoadService({ cueRepo, postRepo })
 * const injector = new SyntheticLoadInjector(real)
 * injector.forceState('red')
 * await admissionLoadService.compute(communityId) // returns red
 * injector.reset()
 * ```
 *
 * Not exported from production barrel files; test surface only.
 */

import type {
  AdmissionLoadService,
  AdmissionLoadServiceDeps,
} from '../admission-load-service.js'
import { AdmissionLoadService as BaseAdmissionLoadService } from '../admission-load-service.js'
import type { LoadSnapshot, LoadState } from '../types.js'

export class SyntheticLoadInjector {
  private forced: LoadState | null = null
  private forcedGlobal: LoadState | null = null
  /** True after the injection has been consumed (one-shot) — flipped by `oneShot=true`. */
  private consumed = false
  private oneShot = false

  constructor(private readonly base: AdmissionLoadService) {}

  /**
   * Force the next snapshot's `state` (and optionally `global_state`) to a
   * fixed value. Without `oneShot`, every subsequent `compute()` returns the
   * forced state until `reset()` is called.
   */
  forceState(state: LoadState, options: { global?: LoadState; oneShot?: boolean } = {}): void {
    this.forced = state
    this.forcedGlobal = options.global ?? state
    this.oneShot = options.oneShot ?? false
    this.consumed = false
  }

  reset(): void {
    this.forced = null
    this.forcedGlobal = null
    this.consumed = false
    this.oneShot = false
  }

  /** Drop-in replacement for `AdmissionLoadService.compute`. */
  async compute(communityId: string, now?: Date): Promise<LoadSnapshot> {
    const snapshot = await this.base.compute(communityId, now)
    if (this.forced && !(this.oneShot && this.consumed)) {
      const overridden: LoadSnapshot = {
        ...snapshot,
        state: this.forced,
        global_state: this.forcedGlobal ?? snapshot.global_state,
      }
      if (this.oneShot) this.consumed = true
      return overridden
    }
    return snapshot
  }

  /**
   * Returns a `Pick<AdmissionLoadService, 'compute'>` so it can be plugged
   * into anything expecting the live service.
   */
  asService(): Pick<AdmissionLoadService, 'compute'> {
    return { compute: this.compute.bind(this) }
  }
}

/** Convenience: stand up a fully-configured injector backed by an isolated base service. */
export function buildSyntheticInjector(
  deps: AdmissionLoadServiceDeps,
): SyntheticLoadInjector {
  return new SyntheticLoadInjector(new BaseAdmissionLoadService(deps))
}
