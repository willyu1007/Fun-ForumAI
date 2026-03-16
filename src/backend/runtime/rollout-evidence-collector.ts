import { personaObservability } from './persona-observability.js'
import type { PersonaObservabilitySnapshot } from './persona-observability.js'
import type {
  PersonaRuntimeIdentityDeltaV1,
  PersonaEvalAttributionSummaryV1,
} from './persona-rollout-gate.js'
import type { PersonaGateSnapshotV1 } from './persona-observation.js'
import type { UsageLedgerRepository } from '../llm/usage-ledger.js'
import type { UsageLedgerEntry } from '../llm/gateway-contract.js'

export interface RolloutEvidenceWindow {
  startedAt: Date
  beforeSnapshot: PersonaObservabilitySnapshot
}

let activeWindow: RolloutEvidenceWindow | null = null

export function startRolloutEvidenceWindow(): RolloutEvidenceWindow {
  const window: RolloutEvidenceWindow = {
    startedAt: new Date(),
    beforeSnapshot: personaObservability.snapshot(),
  }
  activeWindow = window
  return window
}

export function getActiveRolloutWindow(): RolloutEvidenceWindow | null {
  return activeWindow
}

export function clearActiveRolloutWindow(): void {
  activeWindow = null
}

export function collectIdentityWriteDelta(
  beforeSnapshot: PersonaObservabilitySnapshot,
): PersonaRuntimeIdentityDeltaV1 {
  const afterSnapshot = personaObservability.snapshot()
  return {
    before_success_total: beforeSnapshot.context_memory.identity_writes.success_total,
    before_failure_total: beforeSnapshot.context_memory.identity_writes.failure_total,
    after_success_total: afterSnapshot.context_memory.identity_writes.success_total,
    after_failure_total: afterSnapshot.context_memory.identity_writes.failure_total,
  }
}

export async function collectCostBaselineFromLedger(
  ledgerRepo: UsageLedgerRepository,
  agentId: string,
  since: Date,
): Promise<{
  attribution: Partial<PersonaEvalAttributionSummaryV1>
  gate: PersonaGateSnapshotV1
}> {
  const entries = await ledgerRepo.listByAgent(agentId, 500)
  const windowEntries = entries.filter((e) => new Date(e.created_at) >= since)

  const byCallsite: Record<string, number> = {}
  const byProvider: Record<string, number> = {}
  const byModel: Record<string, number> = {}
  let visibleTotal = 0
  let hiddenTotal = 0
  let totalTokens = 0
  let visibleTokenEntries = 0

  for (const entry of windowEntries) {
    if (!entry.success) continue

    const callsite = entry.intent
    byCallsite[callsite] = (byCallsite[callsite] ?? 0) + 1
    if (entry.provider_id) {
      byProvider[entry.provider_id] = (byProvider[entry.provider_id] ?? 0) + 1
    }
    if (entry.model_id) {
      byModel[entry.model_id] = (byModel[entry.model_id] ?? 0) + 1
    }

    if (entry.visibility === 'visible') {
      visibleTotal += 1
      if (entry.usage?.total_tokens) {
        totalTokens += entry.usage.total_tokens
        visibleTokenEntries += 1
      }
    } else {
      hiddenTotal += 1
    }
  }

  const avgTokens = visibleTokenEntries > 0 ? totalTokens / visibleTokenEntries : 0

  const attribution: Partial<PersonaEvalAttributionSummaryV1> = {
    generated_at: new Date().toISOString(),
    scanned_runs_total: windowEntries.length,
    observed_runs_total: windowEntries.filter((e) => e.success).length,
    visible_runs_total: visibleTotal,
    hidden_runs_total: hiddenTotal,
    by_callsite: byCallsite,
    by_provider: byProvider,
    by_model: byModel,
  }

  const gate: PersonaGateSnapshotV1 = {
    version: 'persona-gate-snapshot-v1',
    generated_at: new Date().toISOString(),
    overall_status: visibleTokenEntries > 0 ? 'pass' : 'not_run',
    gating_basis: 'persona-eval-v1',
    results: [
      {
        gate_id: 'render-log-completeness',
        kind: 'blocking',
        threshold: 'visible complete=100%',
        status: visibleTotal > 0 ? 'pass' : 'not_run',
        actual: `visible=${visibleTotal}`,
      },
      {
        gate_id: 'visible-render-cost',
        kind: 'guardrail',
        threshold: '<=baseline +25%',
        status: visibleTokenEntries > 0 ? 'pass' : 'not_run',
        actual: visibleTokenEntries > 0 ? `avg=${avgTokens.toFixed(1)} tokens` : null,
        ...(visibleTokenEntries === 0
          ? { note: 'No visible token data available in the window.' }
          : {}),
      },
    ],
  }

  return { attribution, gate }
}

export function collectFallbackOrDegradedEntries(
  entries: UsageLedgerEntry[],
): UsageLedgerEntry[] {
  return entries.filter((entry) => {
    if (entry.render_decision.fallbackLevel !== 'none') return true
    if (entry.error_code && !entry.success) return true
    return false
  }).sort((a, b) => b.created_at.localeCompare(a.created_at))
}
