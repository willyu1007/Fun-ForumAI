import type {
  ExecutionParamMergeTrace,
  UsageLedgerEntry,
} from './gateway-contract.js'

export interface RuntimeAuthoritySignal {
  source: 'env_pin' | 'debug_field' | 'debug_pin'
  key: string
  trace_id?: string
  created_at?: string
  value?: string
}

export interface RuntimeAuthorityState {
  routing_mode: string
  env_pins: string[]
  env_pins_present: boolean
  debug_signal_sources: RuntimeAuthoritySignal[]
  debug_signals_present: boolean
}

export function buildRuntimeAuthorityState(input: {
  routingMode: string
  env?: NodeJS.ProcessEnv
  recentLedgerEntries?: UsageLedgerEntry[]
}): RuntimeAuthorityState {
  const env = input.env ?? process.env
  const envPins = ['LLM_PROVIDER', 'LLM_MODEL', 'LLM_BASE_URL']
    .filter((key) => Boolean(env[key]?.trim()))
  const envSignals = envPins.map((key) => ({
    source: 'env_pin' as const,
    key,
    value: env[key]?.trim(),
  }))
  const debugSignalSources = dedupeSignals([
    ...envSignals,
    ...collectLedgerDebugSignals(input.recentLedgerEntries ?? []),
  ])

  return {
    routing_mode: input.routingMode,
    env_pins: envPins,
    env_pins_present: envPins.length > 0,
    debug_signal_sources: debugSignalSources,
    debug_signals_present: debugSignalSources.length > 0,
  }
}

function collectLedgerDebugSignals(entries: UsageLedgerEntry[]): RuntimeAuthoritySignal[] {
  const signals: RuntimeAuthoritySignal[] = []

  for (const entry of entries) {
    const mergeTrace = entry.merge_trace
    if (!mergeTrace) continue

    const debugFields = mergeTrace.appliedDebugOverrideFields
      ?? inferDebugFields(mergeTrace.debugOverrides)
    for (const field of debugFields) {
      signals.push({
        source: 'debug_field',
        key: field,
        trace_id: entry.trace_id,
        created_at: entry.created_at,
      })
    }

    const debugPins = mergeTrace.debugRoutingOverrides
    if (debugPins?.providerPin) {
      signals.push({
        source: 'debug_pin',
        key: 'providerPin',
        value: debugPins.providerPin,
        trace_id: entry.trace_id,
        created_at: entry.created_at,
      })
    }
    if (debugPins?.modelPin) {
      signals.push({
        source: 'debug_pin',
        key: 'modelPin',
        value: debugPins.modelPin,
        trace_id: entry.trace_id,
        created_at: entry.created_at,
      })
    }
    if (debugPins?.adapterPin) {
      signals.push({
        source: 'debug_pin',
        key: 'adapterPin',
        value: debugPins.adapterPin,
        trace_id: entry.trace_id,
        created_at: entry.created_at,
      })
    }
  }

  return signals
}

function inferDebugFields(
  debugOverrides: ExecutionParamMergeTrace['debugOverrides'] | undefined,
): string[] {
  if (!debugOverrides) return []

  const fields: string[] = []
  if (debugOverrides.timeoutMs !== undefined) fields.push('timeoutMs')
  if (debugOverrides.maxRetries !== undefined) fields.push('maxRetries')
  if (debugOverrides.regionHint !== undefined) fields.push('regionHint')
  return fields
}

function dedupeSignals(signals: RuntimeAuthoritySignal[]): RuntimeAuthoritySignal[] {
  const seen = new Set<string>()
  const deduped: RuntimeAuthoritySignal[] = []

  for (const signal of signals) {
    const key = [
      signal.source,
      signal.key,
      signal.trace_id ?? '',
      signal.created_at ?? '',
      signal.value ?? '',
    ].join('::')
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(signal)
  }

  return deduped
}
