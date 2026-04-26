/**
 * T-210 M3 — load-signal stub (test fixture).
 *
 * **Test-only.** Production code imports the contract types
 * (`LoadSignalService`, `LoadSignalSnapshot`, `LoadSignalSource`) from
 * `services/load-signal-service.ts` directly — that is the canonical home
 * after T-213 M2 swapped the cached path in. This module exists solely to
 * provide the `loadSignalServiceStub` value (always returns `green`) for
 * unit tests that don't need the cached read-through machinery, and to
 * re-export the contract types so existing test imports keep working.
 */

import type {
  LoadSignalService,
  LoadSignalSnapshot,
  LoadSignalSource,
} from '../load-signal-service.js'
import type { LoadState } from '../../programming/load/types.js'

export type {
  LoadSignalService,
  LoadSignalSnapshot,
  LoadSignalSource,
  LoadState,
}

export const loadSignalServiceStub: LoadSignalService = {
  async get(communityId, triggerAtIso) {
    return {
      status: 'green',
      community_id: communityId,
      trigger_at_iso: triggerAtIso ?? null,
      source: 'stub_until_t213',
    }
  },
}
