process.env.DB_PERSISTENCE ??= 'true'

import {
  closeRuntimeInfrastructure,
  llmGateway,
  llmRegistryBundle,
  usageLedgerRepo,
  warmPersistenceState,
} from '../container.js'
import { disconnectPrisma } from '../persistence/prisma-client.js'
import { LLM_CALLSITE_INVENTORY, isRoutingIntent } from '../llm/callsite-inventory.js'
import { filterVisibleProfileCandidates } from '../llm/provider-admission.js'
import { resolveIdentityWriteProfileRef, resolveVoiceLineTierProfileRef } from '../llm/voice-line-routing.js'
import type {
  LLMBudgetClass,
  LLMVisibility,
  PromptTemplateRef,
  ResponseMode,
  RuntimeModality,
} from '../llm/gateway-contract.js'
import type { LlmMessage } from '../llm/types.js'
import {
  type RenderTier,
  type VoiceLineId,
} from '../../shared/agent-persona-catalog.js'
import { DashScopeTextEmbeddingGateway } from '../media/dashscope-text-embedding-gateway.js'
import { ArkSeedreamGateway } from '../media/ark-seedream-gateway.js'
import { DashScopeQwenImageGateway } from '../media/dashscope-qwen-image-gateway.js'
import type { CompiledMediaPrompt } from '../repos/types.js'
import type { LlmCallsiteInventoryEntry } from '../llm/callsite-inventory.js'

type ProbeStatus = 'passed' | 'failed' | 'skipped'

interface Args {
  sourceIds: Set<string> | null
  voiceLineIds: Set<string> | null
  providerIds: Set<string> | null
  modelIds: Set<string> | null
  maxCases: number | null
  skipLlm: boolean
  skipMedia: boolean
  failFast: boolean
  json: boolean
  debugTimeoutMs: number
  debugMaxRetries: number
}

interface LlmProbeCase {
  kind: 'llm'
  sourceId: string
  visibility: Exclude<LLMVisibility, 'dev_only'>
  intent: string
  scene: string
  voiceLineId: VoiceLineId
  requestedTier: RenderTier
  promptRef: PromptTemplateRef
  profileId: string
  policyId: string
  policyBindingMode: LlmCallsiteInventoryEntry['policy_binding_mode']
  localExecutionPolicyId?: string
  modality: RuntimeModality
  responseMode: ResponseMode
  providerId: string
  modelId: string
}

interface MediaProbeCase {
  kind: 'media'
  sourceId: 'media-retrieval-embedding' | 'media-generation-primary' | 'media-generation-fallback'
  providerId: string
  modelId: string
}

type ProbeCase = LlmProbeCase | MediaProbeCase

interface LlmProbeResult {
  kind: 'llm'
  sourceId: string
  voiceLineId: string
  profileId: string
  policyId: string
  providerId: string
  modelId: string
  visibility: string
  status: ProbeStatus
  traceId: string
  latencyMs: number
  errorCode: string | null
  errorMessage: string | null
  credentialId: string | null
  routeOrder: string[]
  warnings: string[]
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null
  contentPreview: string | null
  ledgerEntryCount: number
}

interface MediaProbeResult {
  kind: 'media'
  sourceId: string
  providerId: string
  modelId: string
  status: ProbeStatus
  latencyMs: number
  errorCode: string | null
  errorMessage: string | null
  providerRequestSummary: Record<string, unknown> | null
}

interface ProbeSummary {
  startedAt: string
  completedAt: string
  totalCases: number
  passed: number
  failed: number
  skipped: number
  llmCases: number
  mediaCases: number
  results: Array<LlmProbeResult | MediaProbeResult>
}

const DEFAULT_DEBUG_TIMEOUT_MS = 60_000
const DEFAULT_DEBUG_MAX_RETRIES = 1
const PROBE_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR42mMwnvmfJMQwqmFUw/DVAAA4MssQTouyZwAAAABJRU5ErkJggg=='
const HOME_VOICE_LINE_IDS: readonly VoiceLineId[] = [
  'qwen-social-v1',
  'glm-deep-v1',
  'minimax-her-v1',
  'doubao-deep-v1',
  'kimi-deep-v1',
]

interface ProbeWindow {
  minIntervalMs: number
  rateLimitCooldownMs: number
}

const PROVIDER_PROBE_WINDOWS: Readonly<Record<string, ProbeWindow>> = {
  'moonshot-openai': {
    minIntervalMs: 3_000,
    rateLimitCooldownMs: 12_000,
  },
  'zai-openai': {
    minIntervalMs: 4_000,
    rateLimitCooldownMs: 12_000,
  },
}

const MODEL_PROBE_WINDOWS: Readonly<Record<string, ProbeWindow>> = {
  'zai-openai/glm-4.7-flash': {
    minIntervalMs: 8_000,
    rateLimitCooldownMs: 20_000,
  },
}

const FIXED_VOICE_LINES_BY_SOURCE_ID: Partial<Record<string, readonly VoiceLineId[]>> = {
  'forum-scene-director-plan-enrichment': ['qwen-director-v1'],
  'public-observation-digest': ['qwen-director-v1'],
  'agent-biography-chapter-render': ['biography-director-v1'],
  'agent-biography-later-note-render': ['biography-director-v1'],
  'public-context-summary-extract': ['qwen-director-v1'],
  'public-context-summary-distill': ['qwen-director-v1'],
  'private-context-summary-extract': ['qwen-director-v1'],
  'private-context-summary-distill': ['qwen-director-v1'],
  'vision-summary': ['qwen-director-v1'],
}

const MEDIA_PROMPT: CompiledMediaPrompt = {
  schema_version: 'compiled-media-prompt.v1',
  template_id: 'media-generation-compiler',
  rendered_prompt:
    'A safe minimal illustration of a blue square centered on a white background, flat vector style.',
  sections: {
    intent: 'render a harmless abstract test image',
    subject: ['blue square'],
    scene: ['white background'],
    style: ['flat vector illustration'],
    negative: ['nsfw', 'graphic violence', 'text watermark'],
  },
  style_hint: 'flat vector illustration',
  aspect_ratio_hint: '1:1',
}

function readArgValue(name: string): string | null {
  const exact = `--${name}`
  const prefix = `${exact}=`
  const exactIndex = process.argv.indexOf(exact)
  if (exactIndex >= 0) {
    const next = process.argv[exactIndex + 1]
    if (!next || next.startsWith('--')) return ''
    return next
  }
  const inline = process.argv.find((arg) => arg.startsWith(prefix))
  return inline ? inline.slice(prefix.length) : null
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function parseCsvArg(name: string): Set<string> | null {
  const raw = readArgValue(name)
  if (raw === null) return null
  const values = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  return new Set(values)
}

function parseIntArg(name: string, fallback: number): number {
  const raw = readArgValue(name)
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function parseOptionalIntArg(name: string): number | null {
  const raw = readArgValue(name)
  if (!raw) return null
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseArgs(): Args {
  return {
    sourceIds: parseCsvArg('source-id'),
    voiceLineIds: parseCsvArg('voice-line-id'),
    providerIds: parseCsvArg('provider-id'),
    modelIds: parseCsvArg('model-id'),
    maxCases: parseOptionalIntArg('max-cases'),
    skipLlm: hasFlag('skip-llm'),
    skipMedia: hasFlag('skip-media'),
    failFast: hasFlag('fail-fast'),
    json: hasFlag('json'),
    debugTimeoutMs: parseIntArg('debug-timeout-ms', DEFAULT_DEBUG_TIMEOUT_MS),
    debugMaxRetries: parseIntArg('debug-max-retries', DEFAULT_DEBUG_MAX_RETRIES),
  }
}

function resolveRequestedTier(entry: LlmCallsiteInventoryEntry): RenderTier | null {
  if (entry.tier_floor === 'identityWriteTier') return 'premium'
  if (entry.tier_floor === 'n/a') return null
  return entry.tier_floor
}

function resolveVoiceLinesForEntry(entry: LlmCallsiteInventoryEntry): readonly VoiceLineId[] {
  const fixed = FIXED_VOICE_LINES_BY_SOURCE_ID[entry.source_id]
  if (fixed) return fixed
  return HOME_VOICE_LINE_IDS
}

function deriveBudgetClass(input: {
  visibility: Exclude<LLMVisibility, 'dev_only'>
  modality: RuntimeModality
  requestedTier: RenderTier
}): LLMBudgetClass {
  if (input.visibility === 'identity_write') return 'identity_write'
  if (input.visibility === 'hidden') {
    return input.modality === 'vision' ? 'hidden_multimodal' : 'hidden_background'
  }
  return input.requestedTier === 'premium' ? 'visible_premium' : 'visible_standard'
}

function buildPromptMessages(input: {
  modality: RuntimeModality
  responseMode: ResponseMode
  sourceId: string
  providerId: string
  modelId: string
}): LlmMessage[] {
  if (input.modality === 'vision') {
    return [
      {
        role: 'system',
        content: 'You are a connectivity probe. Return a strict JSON object only.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              `Inspect the image and return {"status":"ok","source":"${input.sourceId}","provider":"${input.providerId}","model":"${input.modelId}"} only.`,
          },
          {
            type: 'image_url',
            image_url: { url: PROBE_PNG_DATA_URL },
          },
        ],
      },
    ]
  }

  if (input.responseMode === 'json_object') {
    return [
      {
        role: 'user',
        content:
          `Return a minimal JSON object only: {"status":"ok","source":"${input.sourceId}","provider":"${input.providerId}","model":"${input.modelId}"}`,
      },
    ]
  }

  return [
    {
      role: 'user',
      content: `Reply with exactly: ok ${input.sourceId} ${input.providerId} ${input.modelId}`,
    },
  ]
}

function resolveProfileIdForCase(
  entry: LlmCallsiteInventoryEntry,
  voiceLineId: VoiceLineId,
  requestedTier: RenderTier,
): string | null {
  if (entry.visibility === 'identity_write' || entry.intent === 'identity_write') {
    return resolveIdentityWriteProfileRef(voiceLineId, requestedTier)
  }
  if (!isRoutingIntent(entry.intent)) {
    return null
  }
  return resolveVoiceLineTierProfileRef(
    voiceLineId,
    entry.intent,
    requestedTier,
  )
}

function buildLlmProbeCases(args: Args): LlmProbeCase[] {
  const profileById = new Map(
    llmRegistryBundle.modelProfiles.profiles.map((profile) => [profile.profile_id, profile] as const),
  )
  const executionPolicyById = new Map(
    llmRegistryBundle.executionPolicies.policies.map((policy) => [policy.policy_id, policy] as const),
  )

  const cases: LlmProbeCase[] = []
  for (const entry of LLM_CALLSITE_INVENTORY) {
    if (entry.visibility === 'dev_only') continue
    if (args.sourceIds && !args.sourceIds.has(entry.source_id)) continue

    const requestedTier = resolveRequestedTier(entry)
    if (!requestedTier) continue

    const candidateVoiceLines = resolveVoiceLinesForEntry(entry)
    for (const voiceLineId of candidateVoiceLines) {
      if (args.voiceLineIds && !args.voiceLineIds.has(voiceLineId)) continue

      const profileId = resolveProfileIdForCase(entry, voiceLineId, requestedTier)
      if (!profileId) continue
      const profile = profileById.get(profileId)
      if (!profile) continue

      const effectivePolicyId =
        entry.policy_binding_mode === 'callsite-execution-policy' && entry.target_policy_id
          ? entry.target_policy_id
          : profile.policy_id
      const policy = executionPolicyById.get(effectivePolicyId)
      if (!policy) {
        throw new Error(
          `Missing execution policy ${effectivePolicyId} for source ${entry.source_id} / profile ${profileId}`,
        )
      }

      const candidates = entry.visibility === 'visible'
        ? filterVisibleProfileCandidates(llmRegistryBundle, profile).admittedCandidates
        : profile.candidates

      for (const candidate of candidates) {
        if (args.providerIds && !args.providerIds.has(candidate.provider_id)) continue
        if (args.modelIds && !args.modelIds.has(candidate.model_id)) continue

        cases.push({
          kind: 'llm',
          sourceId: entry.source_id,
          visibility: entry.visibility,
          intent: entry.intent,
          scene: entry.scene,
          voiceLineId,
          requestedTier,
          promptRef: entry.prompt_ref,
          profileId,
          policyId: effectivePolicyId,
          policyBindingMode: entry.policy_binding_mode,
          localExecutionPolicyId:
            entry.policy_binding_mode === 'callsite-execution-policy' && entry.target_policy_id
              ? entry.target_policy_id
              : undefined,
          modality: policy.modality,
          responseMode: policy.response_mode,
          providerId: candidate.provider_id,
          modelId: candidate.model_id,
        })
      }
    }
  }

  return args.maxCases ? cases.slice(0, args.maxCases) : cases
}

function buildMediaProbeCases(args: Args): MediaProbeCase[] {
  const cases: MediaProbeCase[] = [
    {
      kind: 'media',
      sourceId: 'media-retrieval-embedding',
      providerId: 'dashscope-text-embedding',
      modelId: 'text-embedding-v4',
    },
    {
      kind: 'media',
      sourceId: 'media-generation-primary',
      providerId: 'ark-seedream',
      modelId: 'doubao-seedream-5-0-lite-260128',
    },
    {
      kind: 'media',
      sourceId: 'media-generation-fallback',
      providerId: 'dashscope-qwen-image',
      modelId: 'qwen-image-2.0',
    },
  ]

  const filtered = cases.filter((probeCase) => {
    if (args.sourceIds && !args.sourceIds.has(probeCase.sourceId)) return false
    if (args.providerIds && !args.providerIds.has(probeCase.providerId)) return false
    if (args.modelIds && !args.modelIds.has(probeCase.modelId)) return false
    return true
  })
  return args.maxCases ? filtered.slice(0, args.maxCases) : filtered
}

async function executeLlmProbeCase(input: {
  probeCase: LlmProbeCase
  debugTimeoutMs: number
  debugMaxRetries: number
}): Promise<LlmProbeResult> {
  const { probeCase } = input
  const traceId = [
    'llm-probe',
    probeCase.sourceId,
    probeCase.voiceLineId,
    probeCase.providerId,
    probeCase.modelId,
    Date.now().toString(36),
  ].join(':')

  const startedAt = Date.now()
  try {
    const response = await llmGateway.chat({
      intent: probeCase.intent as never,
      visibility: probeCase.visibility,
      scene: probeCase.scene as never,
      modality: probeCase.modality,
      responseMode: probeCase.responseMode,
      agentId: `connectivity-probe:${probeCase.voiceLineId}`,
      homeVoiceLineId: probeCase.voiceLineId,
      promptRef: probeCase.promptRef,
      variables: {},
      budgetClass: deriveBudgetClass({
        visibility: probeCase.visibility,
        modality: probeCase.modality,
        requestedTier: probeCase.requestedTier,
      }),
      traceId,
      requestedTier: probeCase.requestedTier,
      allowFallbackWithinLine: false,
      allowCrossFamily: false,
      promptMessages: buildPromptMessages({
        modality: probeCase.modality,
        responseMode: probeCase.responseMode,
        sourceId: probeCase.sourceId,
        providerId: probeCase.providerId,
        modelId: probeCase.modelId,
      }),
      localOverrides: probeCase.localExecutionPolicyId
        ? { executionPolicyId: probeCase.localExecutionPolicyId }
        : undefined,
      debug: {
        providerPin: probeCase.providerId,
        modelPin: probeCase.modelId,
        timeoutMs: input.debugTimeoutMs,
        maxRetries: input.debugMaxRetries,
      },
    })

    const ledgerEntries = await usageLedgerRepo.listByTracePrefix(traceId, 10)
    return {
      kind: 'llm',
      sourceId: probeCase.sourceId,
      voiceLineId: probeCase.voiceLineId,
      profileId: response.renderDecision.profileId,
      policyId: response.executionPlan.policy.policy_id,
      providerId: response.renderDecision.providerId,
      modelId: response.renderDecision.modelId,
      visibility: probeCase.visibility,
      status: 'passed',
      traceId,
      latencyMs: Date.now() - startedAt,
      errorCode: null,
      errorMessage: null,
      credentialId: response.renderDecision.credentialId ?? null,
      routeOrder: response.executionPlan.routeOrder,
      warnings: response.warnings ?? [],
      usage: response.usage,
      contentPreview: response.content.slice(0, 160),
      ledgerEntryCount: ledgerEntries.length,
    }
  } catch (error) {
    const ledgerEntries = await usageLedgerRepo.listByTracePrefix(traceId, 10).catch(() => [])
    const errorCode = readErrorCode(error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      kind: 'llm',
      sourceId: probeCase.sourceId,
      voiceLineId: probeCase.voiceLineId,
      profileId: probeCase.profileId,
      policyId: probeCase.policyId,
      providerId: probeCase.providerId,
      modelId: probeCase.modelId,
      visibility: probeCase.visibility,
      status: 'failed',
      traceId,
      latencyMs: Date.now() - startedAt,
      errorCode,
      errorMessage,
      credentialId: null,
      routeOrder: [],
      warnings: [],
      usage: null,
      contentPreview: null,
      ledgerEntryCount: ledgerEntries.length,
    }
  }
}

async function executeMediaProbeCase(
  probeCase: MediaProbeCase,
): Promise<MediaProbeResult> {
  const startedAt = Date.now()
  try {
    switch (probeCase.sourceId) {
      case 'media-retrieval-embedding': {
        const gateway = new DashScopeTextEmbeddingGateway()
        if (!gateway.isConfigured) {
          return {
            kind: 'media',
            sourceId: probeCase.sourceId,
            providerId: probeCase.providerId,
            modelId: gateway.modelName,
            status: 'skipped',
            latencyMs: Date.now() - startedAt,
            errorCode: 'not_configured',
            errorMessage: 'embedding gateway is not configured',
            providerRequestSummary: null,
          }
        }
        const result = await gateway.embed({
          text: 'connectivity probe for media retrieval',
          text_type: 'query',
          index_profile_id: 'text-embedding-v4-1024',
          trace_id: `embedding-probe:${Date.now().toString(36)}`,
        })
        return {
          kind: 'media',
          sourceId: probeCase.sourceId,
          providerId: result.provider_id,
          modelId: result.model_name,
          status: 'passed',
          latencyMs: Date.now() - startedAt,
          errorCode: null,
          errorMessage: null,
          providerRequestSummary: result.provider_request_summary ?? null,
        }
      }
      case 'media-generation-primary': {
        const gateway = new ArkSeedreamGateway()
        if (!gateway.isConfigured) {
          return {
            kind: 'media',
            sourceId: probeCase.sourceId,
            providerId: probeCase.providerId,
            modelId: gateway.modelName,
            status: 'skipped',
            latencyMs: Date.now() - startedAt,
            errorCode: 'not_configured',
            errorMessage: 'primary media generation gateway is not configured',
            providerRequestSummary: null,
          }
        }
        const result = await gateway.generate({
          compiled_prompt: MEDIA_PROMPT,
          trace_id: `media-gen-primary:${Date.now().toString(36)}`,
        })
        return {
          kind: 'media',
          sourceId: probeCase.sourceId,
          providerId: result.provider_id ?? gateway.providerId,
          modelId: result.model_name ?? gateway.modelName,
          status: 'passed',
          latencyMs: Date.now() - startedAt,
          errorCode: null,
          errorMessage: null,
          providerRequestSummary: result.provider_request_summary ?? null,
        }
      }
      case 'media-generation-fallback': {
        const gateway = new DashScopeQwenImageGateway()
        if (!gateway.isConfigured) {
          return {
            kind: 'media',
            sourceId: probeCase.sourceId,
            providerId: probeCase.providerId,
            modelId: gateway.modelName,
            status: 'skipped',
            latencyMs: Date.now() - startedAt,
            errorCode: 'not_configured',
            errorMessage: 'fallback media generation gateway is not configured',
            providerRequestSummary: null,
          }
        }
        const result = await gateway.generate({
          compiled_prompt: MEDIA_PROMPT,
          trace_id: `media-gen-fallback:${Date.now().toString(36)}`,
        })
        return {
          kind: 'media',
          sourceId: probeCase.sourceId,
          providerId: result.provider_id ?? gateway.providerId,
          modelId: result.model_name ?? gateway.modelName,
          status: 'passed',
          latencyMs: Date.now() - startedAt,
          errorCode: null,
          errorMessage: null,
          providerRequestSummary: result.provider_request_summary ?? null,
        }
      }
    }
  } catch (error) {
    return {
      kind: 'media',
      sourceId: probeCase.sourceId,
      providerId: probeCase.providerId,
      modelId: probeCase.modelId,
      status: 'failed',
      latencyMs: Date.now() - startedAt,
      errorCode: readErrorCode(error),
      errorMessage: error instanceof Error ? error.message : String(error),
      providerRequestSummary: readProviderSummary(error),
    }
  }
}

function readErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null
  const value = (error as { code?: unknown; error_code?: unknown }).code
  if (typeof value === 'string' && value.trim()) return value
  const fallback = (error as { error_code?: unknown }).error_code
  return typeof fallback === 'string' && fallback.trim() ? fallback : null
}

function readProviderSummary(error: unknown): Record<string, unknown> | null {
  if (!error || typeof error !== 'object') return null
  const summary = (error as { provider_request_summary?: unknown }).provider_request_summary
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return null
  return summary as Record<string, unknown>
}

function printPlan(cases: ProbeCase[]): void {
  const llmCases = cases.filter((probeCase) => probeCase.kind === 'llm') as LlmProbeCase[]
  const mediaCases = cases.filter((probeCase) => probeCase.kind === 'media') as MediaProbeCase[]
  console.log(`[connectivity-probe] planned llm cases=${llmCases.length} media cases=${mediaCases.length}`)
  for (const probeCase of llmCases) {
    console.log(
      `[connectivity-probe] llm ${probeCase.sourceId} ${probeCase.voiceLineId} ${probeCase.providerId}/${probeCase.modelId} policy=${probeCase.policyId}`,
    )
  }
  for (const probeCase of mediaCases) {
    console.log(
      `[connectivity-probe] media ${probeCase.sourceId} ${probeCase.providerId}/${probeCase.modelId}`,
    )
  }
}

function printResult(result: LlmProbeResult | MediaProbeResult): void {
  if (result.kind === 'llm') {
    if (result.status === 'passed') {
      console.log(
        `[connectivity-probe] PASS llm ${result.sourceId} ${result.voiceLineId} ${result.providerId}/${result.modelId} credential=${result.credentialId ?? 'none'} latency=${result.latencyMs}ms`,
      )
      return
    }
    console.log(
      `[connectivity-probe] ${result.status.toUpperCase()} llm ${result.sourceId} ${result.voiceLineId} ${result.providerId}/${result.modelId} error=${result.errorCode ?? 'unknown'} message=${result.errorMessage ?? 'none'}`,
    )
    return
  }

  if (result.status === 'passed') {
    console.log(
      `[connectivity-probe] PASS media ${result.sourceId} ${result.providerId}/${result.modelId} latency=${result.latencyMs}ms`,
    )
    return
  }
  console.log(
    `[connectivity-probe] ${result.status.toUpperCase()} media ${result.sourceId} ${result.providerId}/${result.modelId} error=${result.errorCode ?? 'unknown'} message=${result.errorMessage ?? 'none'}`,
  )
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function applyProbeWindow(input: {
  probeCase: ProbeCase
  lastAttemptCompletedAtByProvider: Map<string, number>
  lastAttemptCompletedAtByTarget: Map<string, number>
}): Promise<void> {
  const targetKey = `${input.probeCase.providerId}/${input.probeCase.modelId}`
  const window = MODEL_PROBE_WINDOWS[targetKey] ?? PROVIDER_PROBE_WINDOWS[input.probeCase.providerId]
  if (!window) return

  const lastCompletedAt = MODEL_PROBE_WINDOWS[targetKey]
    ? input.lastAttemptCompletedAtByTarget.get(targetKey)
    : input.lastAttemptCompletedAtByProvider.get(input.probeCase.providerId)
  if (!lastCompletedAt) return

  const elapsedMs = Date.now() - lastCompletedAt
  const waitMs = window.minIntervalMs - elapsedMs
  if (waitMs > 0) {
    await sleep(waitMs)
  }
}

async function applyPostResultCooldown(result: LlmProbeResult | MediaProbeResult): Promise<void> {
  const targetKey = `${result.providerId}/${result.modelId}`
  const window = MODEL_PROBE_WINDOWS[targetKey] ?? PROVIDER_PROBE_WINDOWS[result.providerId]
  if (!window) return
  if (result.status !== 'failed' || result.errorCode !== 'RateLimitError') return
  await sleep(window.rateLimitCooldownMs)
}

async function main(): Promise<void> {
  const args = parseArgs()
  await warmPersistenceState()

  const llmCases = args.skipLlm ? [] : buildLlmProbeCases(args)
  const mediaCases = args.skipMedia ? [] : buildMediaProbeCases(args)
  const allCases = [...llmCases, ...mediaCases]
  if (!args.json) {
    printPlan(allCases)
  }

  const startedAt = new Date().toISOString()
  const results: Array<LlmProbeResult | MediaProbeResult> = []
  const lastAttemptCompletedAtByProvider = new Map<string, number>()
  const lastAttemptCompletedAtByTarget = new Map<string, number>()
  for (const probeCase of allCases) {
    await applyProbeWindow({
      probeCase,
      lastAttemptCompletedAtByProvider,
      lastAttemptCompletedAtByTarget,
    })
    const result = probeCase.kind === 'llm'
      ? await executeLlmProbeCase({
          probeCase,
          debugTimeoutMs: args.debugTimeoutMs,
          debugMaxRetries: args.debugMaxRetries,
        })
      : await executeMediaProbeCase(probeCase)
    results.push(result)
    if (!args.json) {
      printResult(result)
    }
    const completedAt = Date.now()
    lastAttemptCompletedAtByProvider.set(probeCase.providerId, completedAt)
    lastAttemptCompletedAtByTarget.set(`${probeCase.providerId}/${probeCase.modelId}`, completedAt)
    await applyPostResultCooldown(result)
    if (args.failFast && result.status === 'failed') {
      break
    }
  }

  const summary: ProbeSummary = {
    startedAt,
    completedAt: new Date().toISOString(),
    totalCases: results.length,
    passed: results.filter((result) => result.status === 'passed').length,
    failed: results.filter((result) => result.status === 'failed').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    llmCases: results.filter((result) => result.kind === 'llm').length,
    mediaCases: results.filter((result) => result.kind === 'media').length,
    results,
  }

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    console.log(
      `[connectivity-probe] summary total=${summary.totalCases} passed=${summary.passed} failed=${summary.failed} skipped=${summary.skipped}`,
    )
  }

  if (summary.failed > 0) {
    throw new Error(`connectivity probe failed for ${summary.failed} case(s)`)
  }
}

void main()
  .then(async () => {
    await Promise.allSettled([
      closeRuntimeInfrastructure(),
      disconnectPrisma(),
    ])
    process.exit(0)
  })
  .catch(async (error) => {
    console.error('[connectivity-probe] failed', error)
    await Promise.allSettled([
      closeRuntimeInfrastructure(),
      disconnectPrisma(),
    ])
    process.exit(1)
  })
