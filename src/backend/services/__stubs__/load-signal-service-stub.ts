/**
 * T-210 M3 — load-signal stub.
 *
 * Stub stays at the module path the real `LoadSignalService` (T-213) will
 * occupy. T-213's swap is a single-file replacement; the consumer's import
 * line never changes.
 *
 * Returns `green` unconditionally. Any consumer (preview chain, T-214
 * TriggerDetector load-gate) treats this as "load is fine".
 */

export type LoadState = 'green' | 'yellow' | 'red'

export interface LoadSignalSnapshot {
  status: LoadState
  community_id: string
  trigger_at_iso: string | null
  source: 'stub_until_t213'
}

export interface LoadSignalService {
  get(communityId: string, triggerAtIso?: string | null): Promise<LoadSignalSnapshot>
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
