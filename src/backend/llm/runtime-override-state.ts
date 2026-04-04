import type {
  ExecutionParamMergeTrace,
  UsageLedgerEntry,
} from './gateway-contract.js'

export interface RuntimeOverrideSource {
  source: 'deprecated_env_pin' | 'debug_override_field' | 'debug_pin'
  key: string
  trace_id?: string
  created_at?: string
  value?: string
}

export interface RuntimeOverrideState {
  routing_mode: string
  deprecated_env_pins: string[]
  deprecated_env_pins_present: boolean
  debug_override_sources: RuntimeOverrideSource[]
  unapproved_debug_overrides_present: boolean
}

export function buildRuntimeOverrideState(input: {
  routingMode: string
  env?: NodeJS.ProcessEnv
  recentLedgerEntries?: UsageLedgerEntry[]
}): RuntimeOverrideState {
  const env = input.env ?? process.env
  const deprecatedEnvPins = ['LLM_PROVIDER', 'LLM_MODEL', 'LLM_BASE_URL']
    .filter((key) => Boolean(env[key]?.trim()))
  const envSources = deprecatedEnvPins.map((key) => ({
    source: 'deprecated_env_pin' as const,
    key,
    value: env[key]?.trim(),
  }))
  const debugOverrideSources = dedupeOverrideSources([
    ...envSources,
    ...collectLedgerDebugOverrideSources(input.recentLedgerEntries ?? []),
  ])

  return {
    routing_mode: input.routingMode,
    deprecated_env_pins: deprecatedEnvPins,
    deprecated_env_pins_present: deprecatedEnvPins.length > 0,
    debug_override_sources: debugOverrideSources,
    unapproved_debug_overrides_present: debugOverrideSources.length > 0,
  }
}

function collectLedgerDebugOverrideSources(entries: UsageLedgerEntry[]): RuntimeOverrideSource[] {
  const sources: RuntimeOverrideSource[] = []

  for (const entry of entries) {
    const mergeTrace = entry.merge_trace
    if (!mergeTrace) continue

    const debugFields = mergeTrace.appliedDebugOverrideFields
      ?? inferDebugOverrideFields(mergeTrace.debugOverrides)
    for (const field of debugFields) {
      sources.push({
        source: 'debug_override_field',
        key: field,
        trace_id: entry.trace_id,
        created_at: entry.created_at,
      })
    }

    const debugPins = mergeTrace.debugRoutingOverrides
    if (debugPins?.providerPin) {
      sources.push({
        source: 'debug_pin',
        key: 'providerPin',
        value: debugPins.providerPin,
        trace_id: entry.trace_id,
        created_at: entry.created_at,
      })
    }
    if (debugPins?.modelPin) {
      sources.push({
        source: 'debug_pin',
        key: 'modelPin',
        value: debugPins.modelPin,
        trace_id: entry.trace_id,
        created_at: entry.created_at,
      })
    }
    if (debugPins?.adapterPin) {
      sources.push({
        source: 'debug_pin',
        key: 'adapterPin',
        value: debugPins.adapterPin,
        trace_id: entry.trace_id,
        created_at: entry.created_at,
      })
    }
  }

  return sources
}

function inferDebugOverrideFields(
  debugOverrides: ExecutionParamMergeTrace['debugOverrides'] | undefined,
): string[] {
  if (!debugOverrides) return []

  const fields: string[] = []
  if (debugOverrides.temperature !== undefined) fields.push('temperature')
  if (debugOverrides.maxTokens !== undefined) fields.push('maxTokens')
  if (debugOverrides.stop !== undefined) fields.push('stop')
  if (debugOverrides.timeoutMs !== undefined) fields.push('timeoutMs')
  if (debugOverrides.maxRetries !== undefined) fields.push('maxRetries')
  if (debugOverrides.regionHint !== undefined) fields.push('regionHint')
  return fields
}

function dedupeOverrideSources(sources: RuntimeOverrideSource[]): RuntimeOverrideSource[] {
  const seen = new Set<string>()
  const deduped: RuntimeOverrideSource[] = []

  for (const source of sources) {
    const key = [
      source.source,
      source.key,
      source.trace_id ?? '',
      source.created_at ?? '',
      source.value ?? '',
    ].join('::')
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(source)
  }

  return deduped
}
