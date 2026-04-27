import type {
  LlmRegistryBundle,
  ModelProfileEntry,
} from '../llm/registry-loader.js'
import type {
  LLMGatewayRequest,
  LLMGatewayResponse,
} from '../llm/gateway-contract.js'
import { LLMGatewayContractError } from '../llm/gateway-contract.js'

/**
 * LLM connectivity diagnostics for the admin "运行记录" console (T-301 Slice 4).
 *
 * Listing rules (locked in 07-contract-review.md):
 * - source rows from staging-active/admitted candidates only
 * - include provider, model id, model name/version, profile, voice line,
 *   credential pool identifier
 *
 * Manual test rules:
 * - MUST go through the existing LLM gateway (not provider-specific endpoints)
 * - MUST use a dedicated tiny diagnostic prompt
 * - MUST NOT enqueue runtime events
 * - MUST NOT mutate agent memory or business state
 * - MUST NOT persist `RuntimeOperationRecord` rows for results
 * - MUST NOT store raw prompts/completions
 * - Only sanitized status / latency / error_code / tested_at are returned
 */

export const ADMIN_LLM_CONNECTIVITY_PROMPT_ID = 'admin-llm-connectivity-diagnostic'
export const ADMIN_LLM_CONNECTIVITY_PROMPT_VERSION = 1

export interface LlmConnectivityRow {
  route_id: string
  provider_id: string
  model_id: string
  model_name: string | null
  model_version: string | null
  profile_id: string
  voice_line_id: string
  policy_id: string
  intent: string
  visibility: string
  tier: string
  credential_pool_id: string | null
  adapter_id: string
  endpoint_id: string
  region: string
  admission: 'admitted'
  shadow_dimensions: string[]
}

export interface LlmConnectivityListResult {
  rows: LlmConnectivityRow[]
  manual_tests_auto_polled: false
}

export type LlmConnectivityTestStatus = 'ok' | 'failed'

export interface LlmConnectivityTestResult {
  route_id: string
  status: LlmConnectivityTestStatus
  latency_ms: number | null
  tested_at: string
  error_code: string | null
  error_message_redacted: string | null
}

export interface LlmConnectivityServiceDeps {
  bundle: LlmRegistryBundle
  /** Resolves at call-time so registry hot-reload still works. */
  getBundle?: () => LlmRegistryBundle
  /**
   * Invoke the LLM gateway with a `LLMGatewayRequest`. The service builds the
   * request itself; this hook only exists to keep tests deterministic and to
   * avoid coupling to the concrete gateway class.
   */
  invokeGateway: (request: LLMGatewayRequest) => Promise<LLMGatewayResponse>
  now?: () => Date
}

const MAX_ERROR_MESSAGE_LENGTH = 256

export class LlmConnectivityDiagnosticService {
  private readonly deps: LlmConnectivityServiceDeps

  constructor(deps: LlmConnectivityServiceDeps) {
    this.deps = deps
  }

  list(): LlmConnectivityListResult {
    const bundle = this.bundle()
    const credentialPoolByEndpoint = new Map<string, string>()
    for (const pool of bundle.credentialPools.pools) {
      credentialPoolByEndpoint.set(`${pool.provider_id}|${pool.region}|${pool.endpoint_id}`, pool.credential_id)
    }
    const admissionPoolByVoiceLine = new Map<string, string[]>()
    for (const pool of bundle.providerAdmission.pools) {
      admissionPoolByVoiceLine.set(
        pool.voice_line_id,
        pool.compare_dimensions.map((dim) => String(dim)),
      )
    }

    const rows: LlmConnectivityRow[] = []
    for (const profile of bundle.modelProfiles.profiles) {
      const admittedCandidates = filterAdmittedCandidates(profile, bundle)
      for (const candidate of admittedCandidates) {
        const credentialKey = `${candidate.provider_id}|${candidate.region}|${candidate.endpoint_id}`
        rows.push({
          route_id: buildRouteId(profile, candidate),
          provider_id: candidate.provider_id,
          model_id: candidate.model_id,
          model_name: deriveModelName(candidate.model_id),
          model_version: deriveModelVersion(candidate.model_id),
          profile_id: profile.profile_id,
          voice_line_id: profile.voice_line_id,
          policy_id: profile.policy_id,
          intent: profile.intent,
          visibility: profile.visibility,
          tier: profile.tier,
          credential_pool_id: credentialPoolByEndpoint.get(credentialKey) ?? null,
          adapter_id: candidate.adapter_id,
          endpoint_id: candidate.endpoint_id,
          region: candidate.region,
          admission: 'admitted',
          shadow_dimensions: admissionPoolByVoiceLine.get(profile.voice_line_id) ?? [],
        })
      }
    }
    return { rows, manual_tests_auto_polled: false }
  }

  /**
   * Manually exercise the gateway path for one or many admitted routes.
   * Results are transient — this method NEVER persists any runtime record.
   */
  async test(input: {
    route_ids?: string[]
    scope?: 'all_admitted'
    runId?: string
  } = {}): Promise<{ results: LlmConnectivityTestResult[] }> {
    const { rows } = this.list()
    const targetRoutes = input.scope === 'all_admitted'
      ? rows
      : rows.filter((row) => input.route_ids?.includes(row.route_id))

    if (targetRoutes.length === 0) {
      return { results: [] }
    }

    const runId = input.runId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const results: LlmConnectivityTestResult[] = []
    for (const row of targetRoutes) {
      results.push(await this.runOne(row, runId))
    }
    return { results }
  }

  private async runOne(row: LlmConnectivityRow, runId: string): Promise<LlmConnectivityTestResult> {
    const startedAt = Date.now()
    const traceId = `admin-llm-connectivity:${runId}:${row.route_id}`
    const request: LLMGatewayRequest = {
      intent: 'dev_prompt_render',
      visibility: 'dev_only',
      scene: 'dev_prompt_render',
      modality: 'text',
      responseMode: 'text',
      agentId: 'admin-llm-connectivity-diagnostic',
      homeVoiceLineId: row.voice_line_id as LLMGatewayRequest['homeVoiceLineId'],
      promptRef: {
        id: ADMIN_LLM_CONNECTIVITY_PROMPT_ID,
        version: ADMIN_LLM_CONNECTIVITY_PROMPT_VERSION,
      },
      variables: {},
      budgetClass: 'dev_only',
      traceId,
      requestedTier: row.tier as LLMGatewayRequest['requestedTier'],
      providerTags: [row.visibility],
      allowFallbackWithinLine: false,
      allowCrossFamily: false,
      routingConstraint: {
        profileId: row.profile_id,
        providerId: row.provider_id,
        modelId: row.model_id,
        adapterId: row.adapter_id,
      },
    }

    try {
      await this.deps.invokeGateway(request)
      return {
        route_id: row.route_id,
        status: 'ok',
        latency_ms: Date.now() - startedAt,
        tested_at: this.now().toISOString(),
        error_code: null,
        error_message_redacted: null,
      }
    } catch (err) {
      return {
        route_id: row.route_id,
        status: 'failed',
        latency_ms: Date.now() - startedAt,
        tested_at: this.now().toISOString(),
        error_code: classifyError(err),
        error_message_redacted: truncate(extractErrorMessage(err), MAX_ERROR_MESSAGE_LENGTH),
      }
    }
  }

  private now(): Date {
    return this.deps.now ? this.deps.now() : new Date()
  }

  private bundle(): LlmRegistryBundle {
    return this.deps.getBundle ? this.deps.getBundle() : this.deps.bundle
  }
}

function filterAdmittedCandidates(
  profile: ModelProfileEntry,
  bundle: LlmRegistryBundle,
): ModelProfileEntry['candidates'] {
  const pool = bundle.providerAdmission.pools.find(
    (entry) => entry.voice_line_id === profile.voice_line_id,
  )
  if (!pool) return []
  const admittedKeys = new Set<string>()
  for (const cand of pool.candidates) {
    if (cand.admission === 'admitted') {
      admittedKeys.add(`${cand.provider_id}|${cand.model_id}`)
    }
  }
  return profile.candidates.filter((cand) =>
    admittedKeys.has(`${cand.provider_id}|${cand.model_id}`),
  )
}

function buildRouteId(profile: ModelProfileEntry, candidate: { provider_id: string; model_id: string; endpoint_id: string; region: string }): string {
  return [profile.profile_id, candidate.provider_id, candidate.model_id, candidate.region, candidate.endpoint_id].join('|')
}

/** Derive a human-readable model name from `model_id` (strip vendor namespacing). */
function deriveModelName(modelId: string): string | null {
  if (!modelId) return null
  const lastSlash = modelId.lastIndexOf('/')
  return lastSlash === -1 ? modelId : modelId.slice(lastSlash + 1)
}

/** Best-effort version extraction from suffixes like `-2024-08-06`, `@v3`, or `-20251001`. */
function deriveModelVersion(modelId: string): string | null {
  const versionMatch = modelId.match(
    /(\d{4}-\d{2}-\d{2}|\d{8}|@v\d+|v\d+(?:[._-]\d+){0,3}|\d{4}\.\d{2})$/i,
  )
  return versionMatch ? versionMatch[0] : null
}

function classifyError(err: unknown): string {
  if (err instanceof LLMGatewayContractError) return err.code
  if (err instanceof Error) {
    const lower = err.message.toLowerCase()
    if (lower.includes('timeout')) return 'TimeoutError'
    if (lower.includes('rate limit') || lower.includes('429')) return 'RateLimitError'
    if (lower.includes('auth') || lower.includes('401') || lower.includes('403')) return 'AuthError'
  }
  return 'UpstreamError'
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) return value
  return `${value.slice(0, Math.max(0, limit - 1))}…`
}

export const __testing = {
  filterAdmittedCandidates,
  buildRouteId,
  deriveModelName,
  deriveModelVersion,
  classifyError,
}
