/**
 * T-214 A-M1 — LoadGate.
 *
 * Deterministic gate that consumes a cached `LoadSignalSnapshot` (TTL ~30s
 * from `LoadSignalService`) and returns the auto-editor's allowed-actions
 * envelope plus a `propose_only` flag and a short-circuit signal.
 *
 * Pipeline placement: runs **after** the trigger detector emits a
 * candidate event and **before** the LLM call. If `short_circuit=true`,
 * the scheduler skips the LLM call entirely and the trigger row stays in
 * the log for observability without producing a CueChange.
 *
 * Contract location: see overview §32-34. The decision table is owned by
 * `auto-editor-allowed-actions.ts`; this class only orchestrates the
 * read + envelope construction.
 */

import type { LoadSignalService } from '../../services/load-signal-service.js'
import {
  lookupAutoEditorAllowedActions,
} from '../load/auto-editor-allowed-actions.js'
import type { LoadState } from '../load/types.js'
import type { LoadGateDecision } from './types.js'

export interface LoadGateDeps {
  loadSignalService: LoadSignalService
}

export class LoadGate {
  constructor(private readonly deps: LoadGateDeps) {}

  /**
   * Evaluate the gate for a given community. `triggerAtIso` is forwarded
   * to the load signal service for diagnostic provenance only — it does
   * not influence the load state itself (which is community-wide).
   */
  async evaluate(input: {
    communityId: string
    triggerAtIso?: string | null
  }): Promise<LoadGateDecision> {
    const snapshot = await this.deps.loadSignalService.get(
      input.communityId,
      input.triggerAtIso ?? null,
    )
    return this.deriveDecision({
      loadState: snapshot.status,
      communityId: snapshot.community_id,
      loadSignalSource: snapshot.source,
    })
  }

  /**
   * Deterministic derivation exposed separately so callers (admin
   * preview UI, tests) can probe the gate without round-tripping
   * through `LoadSignalService`.
   */
  deriveDecision(input: {
    loadState: LoadState
    communityId: string | null
    loadSignalSource: string
  }): LoadGateDecision {
    const row = lookupAutoEditorAllowedActions(input.loadState)
    const shortCircuit =
      row.allowed_actions.length === 0 && row.propose_only === true
    return {
      load_state: input.loadState,
      load_signal_source: input.loadSignalSource,
      community_id: input.communityId,
      allowed_actions: row.allowed_actions,
      propose_only: row.propose_only,
      short_circuit: shortCircuit,
      reason_code: deriveReasonCode(input.loadState, shortCircuit),
    }
  }
}

function deriveReasonCode(
  loadState: LoadState,
  shortCircuit: boolean,
): LoadGateDecision['reason_code'] {
  switch (loadState) {
    case 'green':
      return 'green_full_surface'
    case 'yellow':
      return 'yellow_triage_only'
    case 'red':
      return shortCircuit ? 'red_short_circuit' : 'red_propose_only'
  }
}
