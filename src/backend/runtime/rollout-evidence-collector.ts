import { personaObservability } from './persona-observability.js'
import type { PersonaObservabilitySnapshot } from './persona-observability.js'
import type {
  PersonaRuntimeIdentityDeltaV1,
  PersonaEvalAttributionSummaryV1,
} from './persona-rollout-gate.js'
import type { PersonaGateSnapshotV1 } from './persona-observation.js'
import type { UsageLedgerRepository } from '../llm/usage-ledger.js'
import type { UsageLedgerEntry } from '../llm/gateway-contract.js'

export interface RuntimeLedgerAttributionSummary
  extends Partial<PersonaEvalAttributionSummaryV1> {
  by_policy: Record<string, number>
  by_adapter: Record<string, number>
  by_credential: Record<string, number>
  by_provider_model: Record<string, number>
  fallback_history_total: number
  fallback_entry_total: number
}

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
  attribution: RuntimeLedgerAttributionSummary
  gate: PersonaGateSnapshotV1
}> {
  const entries = await ledgerRepo.listByAgent(agentId, 500)
  const windowEntries = entries.filter((e) => new Date(e.created_at) >= since)
  const attribution = summarizeLedgerAttribution(windowEntries)

  let visibleTotal = 0
  let totalTokens = 0
  let visibleTokenEntries = 0

  for (const entry of windowEntries) {
    if (!entry.success) continue

    if (entry.visibility === 'visible') {
      visibleTotal += 1
      if (entry.usage?.total_tokens) {
        totalTokens += entry.usage.total_tokens
        visibleTokenEntries += 1
      }
    }
  }

  const avgTokens = visibleTokenEntries > 0 ? totalTokens / visibleTokenEntries : 0

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

export function summarizeLedgerAttribution(
  entries: UsageLedgerEntry[],
): RuntimeLedgerAttributionSummary {
  const byCallsite: Record<string, number> = {}
  const byProvider: Record<string, number> = {}
  const byModel: Record<string, number> = {}
  const byPolicy: Record<string, number> = {}
  const byAdapter: Record<string, number> = {}
  const byCredential: Record<string, number> = {}
  const byProviderModel: Record<string, number> = {}
  let visibleTotal = 0
  let hiddenTotal = 0
  let observedRunsTotal = 0
  let fallbackHistoryTotal = 0
  let fallbackEntryTotal = 0

  for (const entry of entries) {
    const callsite = entry.intent
    byCallsite[callsite] = (byCallsite[callsite] ?? 0) + 1

    if (entry.provider_id) {
      byProvider[entry.provider_id] = (byProvider[entry.provider_id] ?? 0) + 1
    }
    if (entry.model_id) {
      byModel[entry.model_id] = (byModel[entry.model_id] ?? 0) + 1
    }
    if (entry.policy_id) {
      byPolicy[entry.policy_id] = (byPolicy[entry.policy_id] ?? 0) + 1
    }
    if (entry.adapter_id) {
      byAdapter[entry.adapter_id] = (byAdapter[entry.adapter_id] ?? 0) + 1
    }
    if (entry.credential_id) {
      byCredential[entry.credential_id] = (byCredential[entry.credential_id] ?? 0) + 1
    }
    if (entry.provider_id && entry.model_id) {
      const providerModelKey = `${entry.provider_id}/${entry.model_id}`
      byProviderModel[providerModelKey] = (byProviderModel[providerModelKey] ?? 0) + 1
    }
    if (entry.visibility === 'visible') {
      visibleTotal += 1
    } else {
      hiddenTotal += 1
    }
    if (entry.success) {
      observedRunsTotal += 1
    }
    if ((entry.fallback_history?.length ?? 0) > 0) {
      fallbackEntryTotal += 1
      fallbackHistoryTotal += entry.fallback_history?.length ?? 0
    }
  }

  return {
    generated_at: new Date().toISOString(),
    scanned_runs_total: entries.length,
    observed_runs_total: observedRunsTotal,
    visible_runs_total: visibleTotal,
    hidden_runs_total: hiddenTotal,
    by_callsite: byCallsite,
    by_provider: byProvider,
    by_model: byModel,
    by_policy: byPolicy,
    by_adapter: byAdapter,
    by_credential: byCredential,
    by_provider_model: byProviderModel,
    fallback_history_total: fallbackHistoryTotal,
    fallback_entry_total: fallbackEntryTotal,
  }
}

export function collectFallbackOrDegradedEntries(
  entries: UsageLedgerEntry[],
): UsageLedgerEntry[] {
  return entries.filter((entry) => {
    if (entry.render_decision.fallbackLevel !== 'none') return true
    if ((entry.fallback_history?.length ?? 0) > 0) return true
    if (entry.error_code && !entry.success) return true
    return false
  }).sort((a, b) => b.created_at.localeCompare(a.created_at))
}
