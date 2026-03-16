import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  LLMGenerationIntent,
  LLMVisibility,
  PromptTemplateRef,
  RenderDecision,
  RoutingFallbackLevel,
} from '../llm/gateway-contract.js'
import { LLM_CALLSITE_INVENTORY } from '../llm/callsite-inventory.js'
import {
  loadLlmRegistryBundle,
  type LlmRegistryBundle,
  type ModelProfileEntry,
} from '../llm/registry-loader.js'
import { resolveVoiceLineTierProfileRef } from '../llm/voice-line-routing.js'
import type { LlmTokenUsage } from '../llm/types.js'
import type { AgentRun } from '../repos/types.js'
import type {
  PersonaSeedCode,
  RenderTier,
  VoiceLineRoutingIntent,
  VoiceLineId,
} from '../../shared/agent-persona-catalog.js'
import type { PromptComposeAudit, PromptScene } from './types.js'
import { runtimeFeatureMetrics } from './runtime-feature-metrics.js'

export type PersonaObservationVersion = 'persona-observation-v1'
export type PersonaObservationScene = PromptScene | 'background_hidden' | 'inclination_asset'
export type PersonaObservationCoverageStatus =
  | 'visible_complete'
  | 'visible_partial'
  | 'hidden_partial'

export interface PersonaObservationPromptAuditSummary {
  included_layer_ids: string[]
  token_estimates: Record<string, number>
  lint_warnings: string[]
  trim_reasons: string[]
  provenance?: PromptComposeAudit['provenance']
}

export interface PersonaObservationRuntimeState {
  active_overlay_id?: string
  overlay_cause?: string
  overlay_rng_seed?: string
  drift_score?: number
  tier_floor?: RenderTier
  tier_floor_reason?: string
}

export interface PersonaObservationRenderDecision {
  profile_id?: string
  provider_id?: string
  model_id?: string
  region?: string
  fallback_level?: RoutingFallbackLevel
  reasons: string[]
}

export interface PersonaObservationIdentityWrite {
  attempted: boolean
  success: boolean
}

export interface PersonaObservationV1 {
  version: PersonaObservationVersion
  trace_id: string
  source_callsite_id: string
  scene: PersonaObservationScene
  intent: LLMGenerationIntent
  visibility: LLMVisibility
  coverage_status: PersonaObservationCoverageStatus
  persona_seed_code?: PersonaSeedCode
  home_voice_line_id?: VoiceLineId
  prompt_ref?: PromptTemplateRef
  requested_tier?: RenderTier
  resolved_tier?: RenderTier
  render_decision?: PersonaObservationRenderDecision
  usage?: LlmTokenUsage
  latency_ms?: number
  parse_success?: boolean
  identity_write: PersonaObservationIdentityWrite
  prompt_audit?: PersonaObservationPromptAuditSummary
  runtime_state?: PersonaObservationRuntimeState
  error?: string | null
}

export type PersonaGateId =
  | 'render-log-completeness'
  | 'persona-consistency'
  | 'group-distinctiveness'
  | 'overlay-naturalness'
  | 'nurture-perceptibility'
  | 'parse-success'
  | 'identity-write-success'
  | 'visible-fallback-frequency'
  | 'visible-p95-latency'
  | 'visible-render-cost'

export type PersonaGateStatus = 'pass' | 'fail' | 'warn' | 'not_run'

export interface PersonaGateResultV1 {
  gate_id: PersonaGateId
  kind: 'blocking' | 'guardrail'
  threshold: string
  status: PersonaGateStatus
  actual: string | null
  note?: string
}

export interface PersonaGateSnapshotV1 {
  version: 'persona-gate-snapshot-v1'
  generated_at: string | null
  overall_status: PersonaGateStatus
  gating_basis: 'persona-eval-v1'
  results: PersonaGateResultV1[]
}

export interface BlindReviewRubricDimensionV1 {
  id:
    | 'persona_consistency'
    | 'group_distinctiveness'
    | 'overlay_naturalness'
    | 'nurture_perceptibility'
  prompt: string
  scale: '0-5'
}

export interface BlindReviewRubricV1 {
  version: 'blind-review-rubric-v1'
  dimensions: BlindReviewRubricDimensionV1[]
}

export interface PersonaEvalCorpusSlice {
  slice_id:
    | 'cross_scene_same_agent'
    | 'private_to_public_delta'
    | 'same_seed_cross_line'
    | 'fallback_or_degraded'
  label: string
  description: string
}

export interface PersonaObservationCounters {
  observed_runs_total: number
  observed_visible_runs_total: number
  observed_hidden_runs_total: number
  visible_complete_runs_total: number
  visible_partial_runs_total: number
  hidden_partial_runs_total: number
  complete_runs_total: number
  parse_attempt_total: number
  parse_success_total: number
  identity_write_attempt_total: number
  identity_write_success_total: number
  fallback_none_total: number
  fallback_same_line_total: number
  fallback_same_family_total: number
  fallback_cross_family_hidden_total: number
  fallback_rare_reanchor_total: number
  overlay_activation_total: number
  rare_reanchor_total: number
}

export interface BuildPersonaObservationInput {
  traceId?: string
  sourceCallsiteId: string
  scene: PersonaObservationScene
  intent: LLMGenerationIntent
  visibility: LLMVisibility
  coverageStatus?: PersonaObservationCoverageStatus
  personaSeedCode?: PersonaSeedCode
  homeVoiceLineId?: VoiceLineId
  routingVoiceLineId?: VoiceLineId
  promptRef?: PromptTemplateRef
  requestedTier?: RenderTier
  resolvedTier?: RenderTier
  renderDecision?: RenderDecision | null
  usage?: LlmTokenUsage
  latencyMs?: number
  parseSuccess?: boolean
  identityWriteAttempted?: boolean
  identityWriteSuccess?: boolean
  promptAudit?: PromptComposeAudit | null
  runtimeState?: PersonaObservationRuntimeState
  llmProviderId?: string
  llmModelId?: string
  error?: string | null
}

const PERSONA_OBSERVATION_VERSION: PersonaObservationVersion = 'persona-observation-v1'
const PERSONA_EVAL_LATEST_PATH = join(
  process.cwd(),
  '.ai',
  '.tmp',
  'persona-eval',
  'latest',
  'gate-summary.json',
)

let cachedRegistryBundle: LlmRegistryBundle | null = null

export const PERSONA_EVAL_CORPUS_SLICES: PersonaEvalCorpusSlice[] = [
  {
    slice_id: 'cross_scene_same_agent',
    label: '同一 Agent 跨场景样本',
    description: '用于评估 forum/chat/DM 是否仍像同一角色。',
  },
  {
    slice_id: 'private_to_public_delta',
    label: '私聊前后公域行为变化',
    description: '用于评估 nurture perceptibility 是否可被识别。',
  },
  {
    slice_id: 'same_seed_cross_line',
    label: '同 seed 跨 line 对比',
    description: '用于评估同一 seed 在不同 voice line 下的适配差异。',
  },
  {
    slice_id: 'fallback_or_degraded',
    label: 'fallback / degraded 样本',
    description: '用于评估 fallback 与降级是否破坏角色稳定性。',
  },
]

export const BLIND_REVIEW_RUBRIC_V1: BlindReviewRubricV1 = {
  version: 'blind-review-rubric-v1',
  dimensions: [
    {
      id: 'persona_consistency',
      prompt: '这些输出是否像同一个角色在不同场景中说的话？',
      scale: '0-5',
    },
    {
      id: 'group_distinctiveness',
      prompt: '这些角色之间是否足够可辨认，是否容易混淆？',
      scale: '0-5',
    },
    {
      id: 'overlay_naturalness',
      prompt: '状态波动是否自然，像这个人短期起伏，而不是写崩？',
      scale: '0-5',
    },
    {
      id: 'nurture_perceptibility',
      prompt: '是否能感知私聊/养成带来的公域行为变化？',
      scale: '0-5',
    },
  ],
}

export const DEFAULT_PERSONA_GATE_SNAPSHOT_V1: PersonaGateSnapshotV1 = {
  version: 'persona-gate-snapshot-v1',
  generated_at: null,
  overall_status: 'not_run',
  gating_basis: 'persona-eval-v1',
  results: [
    {
      gate_id: 'render-log-completeness',
      kind: 'blocking',
      threshold: 'visible complete=100%, partial runs have source_callsite_id+coverage_status',
      status: 'not_run',
      actual: null,
    },
    {
      gate_id: 'persona-consistency',
      kind: 'blocking',
      threshold: '>=75%, any line/tier slice >=65%',
      status: 'not_run',
      actual: null,
    },
    {
      gate_id: 'group-distinctiveness',
      kind: 'blocking',
      threshold: 'blind review >=70%, misclassification <=20%',
      status: 'not_run',
      actual: null,
    },
    {
      gate_id: 'overlay-naturalness',
      kind: 'blocking',
      threshold: 'avg >=3.5/5, obvious breakdown <15%',
      status: 'not_run',
      actual: null,
    },
    {
      gate_id: 'nurture-perceptibility',
      kind: 'blocking',
      threshold: 'recognition >=55%, confidence avg >=3.5/5',
      status: 'not_run',
      actual: null,
    },
    {
      gate_id: 'parse-success',
      kind: 'guardrail',
      threshold: '>=97%',
      status: 'not_run',
      actual: null,
    },
    {
      gate_id: 'identity-write-success',
      kind: 'guardrail',
      threshold: '>=95%',
      status: 'not_run',
      actual: null,
    },
    {
      gate_id: 'visible-fallback-frequency',
      kind: 'guardrail',
      threshold: 'same-line<=10%, cross-family=0',
      status: 'not_run',
      actual: null,
    },
    {
      gate_id: 'visible-p95-latency',
      kind: 'guardrail',
      threshold: '<=15s or baseline +20%',
      status: 'not_run',
      actual: null,
    },
    {
      gate_id: 'visible-render-cost',
      kind: 'guardrail',
      threshold: '<=baseline +25%',
      status: 'not_run',
      actual: null,
    },
  ],
}

export function createPersonaTraceId(): string {
  return randomUUID()
}

export function buildPersonaObservation(input: BuildPersonaObservationInput): PersonaObservationV1 {
  const inventoryEntry = LLM_CALLSITE_INVENTORY.find((entry) => entry.source_id === input.sourceCallsiteId)
  const promptRef = input.promptRef ?? inventoryEntry?.prompt_ref
  const fallbackTier = deriveInventoryTier(inventoryEntry?.tier_floor)
  const requestedTier = input.requestedTier ?? fallbackTier
  const resolvedTier = input.resolvedTier ?? fallbackTier
  const coverageStatus =
    input.coverageStatus ??
    (input.visibility === 'visible' ? 'visible_partial' : 'hidden_partial')

  const renderDecision = normalizeRenderDecision({
    coverageStatus,
    renderDecision: input.renderDecision,
    llmModelId: input.llmModelId,
    llmProviderId: input.llmProviderId,
    homeVoiceLineId: input.homeVoiceLineId,
    routingVoiceLineId: input.routingVoiceLineId,
    intent: input.intent,
    resolvedTier,
    visibility: input.visibility,
  })

  const observation: PersonaObservationV1 = {
    version: PERSONA_OBSERVATION_VERSION,
    trace_id: input.traceId ?? createPersonaTraceId(),
    source_callsite_id: input.sourceCallsiteId,
    scene: input.scene,
    intent: input.intent,
    visibility: input.visibility,
    coverage_status: coverageStatus,
    ...(input.personaSeedCode ? { persona_seed_code: input.personaSeedCode } : {}),
    ...(input.homeVoiceLineId ? { home_voice_line_id: input.homeVoiceLineId } : {}),
    ...(promptRef ? { prompt_ref: promptRef } : {}),
    ...(requestedTier ? { requested_tier: requestedTier } : {}),
    ...(resolvedTier ? { resolved_tier: resolvedTier } : {}),
    ...(renderDecision ? { render_decision: renderDecision } : {}),
    ...(input.usage ? { usage: input.usage } : {}),
    ...(typeof input.latencyMs === 'number' ? { latency_ms: input.latencyMs } : {}),
    ...(typeof input.parseSuccess === 'boolean' ? { parse_success: input.parseSuccess } : {}),
    identity_write: {
      attempted: input.identityWriteAttempted === true,
      success: input.identityWriteSuccess === true,
    },
    ...(input.promptAudit ? { prompt_audit: summarizePromptAudit(input.promptAudit) } : {}),
    ...(input.runtimeState ? { runtime_state: sanitizeRuntimeState(input.runtimeState) } : {}),
    ...(input.error !== undefined ? { error: input.error } : {}),
  }

  validatePersonaObservation(observation)
  return observation
}

export function attachPersonaObservation(
  outputJson: Record<string, unknown> | null | undefined,
  observation: PersonaObservationV1,
): Record<string, unknown> {
  return {
    ...(outputJson ?? {}),
    persona_observation: observation,
  }
}

export function readPersonaObservation(
  outputJson: Record<string, unknown> | null | undefined,
): PersonaObservationV1 | null {
  const raw = outputJson?.persona_observation
  if (!isRecord(raw)) return null
  if (raw.version !== PERSONA_OBSERVATION_VERSION) return null

  const identityWriteRaw = isRecord(raw.identity_write) ? raw.identity_write : {}
  const renderDecisionRaw = isRecord(raw.render_decision) ? raw.render_decision : null
  const promptRefRaw = isRecord(raw.prompt_ref) ? raw.prompt_ref : null
  const usageRaw = isRecord(raw.usage) ? raw.usage : null
  const promptAuditRaw = isRecord(raw.prompt_audit) ? raw.prompt_audit : null
  const runtimeStateRaw = isRecord(raw.runtime_state) ? raw.runtime_state : null

  return {
    version: PERSONA_OBSERVATION_VERSION,
    trace_id: typeof raw.trace_id === 'string' ? raw.trace_id : '',
    source_callsite_id: typeof raw.source_callsite_id === 'string' ? raw.source_callsite_id : '',
    scene: typeof raw.scene === 'string'
      ? (raw.scene as PersonaObservationScene)
      : 'background_hidden',
    intent: typeof raw.intent === 'string'
      ? (raw.intent as LLMGenerationIntent)
      : 'director_plan',
    visibility: typeof raw.visibility === 'string'
      ? (raw.visibility as LLMVisibility)
      : 'hidden',
    coverage_status: typeof raw.coverage_status === 'string'
      ? (raw.coverage_status as PersonaObservationCoverageStatus)
      : (raw.visibility === 'hidden' ? 'hidden_partial' : 'visible_partial'),
    ...(typeof raw.persona_seed_code === 'string'
      ? { persona_seed_code: raw.persona_seed_code as PersonaSeedCode }
      : {}),
    ...(typeof raw.home_voice_line_id === 'string'
      ? { home_voice_line_id: raw.home_voice_line_id as VoiceLineId }
      : {}),
    ...(promptRefRaw &&
    typeof promptRefRaw.id === 'string' &&
    typeof promptRefRaw.version === 'number'
      ? { prompt_ref: { id: promptRefRaw.id, version: promptRefRaw.version } }
      : {}),
    ...(typeof raw.requested_tier === 'string'
      ? { requested_tier: raw.requested_tier as RenderTier }
      : {}),
    ...(typeof raw.resolved_tier === 'string'
      ? { resolved_tier: raw.resolved_tier as RenderTier }
      : {}),
    ...(renderDecisionRaw
      ? {
          render_decision: {
            ...(typeof renderDecisionRaw.profile_id === 'string'
              ? { profile_id: renderDecisionRaw.profile_id }
              : {}),
            ...(typeof renderDecisionRaw.provider_id === 'string'
              ? { provider_id: renderDecisionRaw.provider_id }
              : {}),
            ...(typeof renderDecisionRaw.model_id === 'string'
              ? { model_id: renderDecisionRaw.model_id }
              : {}),
            ...(typeof renderDecisionRaw.region === 'string'
              ? { region: renderDecisionRaw.region }
              : {}),
            ...(typeof renderDecisionRaw.fallback_level === 'string'
              ? {
                  fallback_level: renderDecisionRaw.fallback_level as RoutingFallbackLevel,
                }
              : {}),
            reasons: Array.isArray(renderDecisionRaw.reasons)
              ? renderDecisionRaw.reasons.filter((item): item is string => typeof item === 'string')
              : [],
          },
        }
      : {}),
    ...(usageRaw &&
    typeof usageRaw.prompt_tokens === 'number' &&
    typeof usageRaw.completion_tokens === 'number' &&
    typeof usageRaw.total_tokens === 'number'
      ? {
          usage: {
            prompt_tokens: usageRaw.prompt_tokens,
            completion_tokens: usageRaw.completion_tokens,
            total_tokens: usageRaw.total_tokens,
          },
        }
      : {}),
    ...(typeof raw.latency_ms === 'number' ? { latency_ms: raw.latency_ms } : {}),
    ...(typeof raw.parse_success === 'boolean' ? { parse_success: raw.parse_success } : {}),
    identity_write: {
      attempted: identityWriteRaw.attempted === true,
      success: identityWriteRaw.success === true,
    },
    ...(promptAuditRaw ? { prompt_audit: normalizePromptAuditSummary(promptAuditRaw) } : {}),
    ...(runtimeStateRaw ? { runtime_state: normalizeRuntimeState(runtimeStateRaw) } : {}),
    ...(typeof raw.error === 'string' || raw.error === null ? { error: raw.error } : {}),
  }
}

export function normalizeAgentRunReadPayload(run: AgentRun): Record<string, unknown> {
  return {
    ...run,
    persona_observation: readPersonaObservation(run.output_json),
  }
}

export function recordPersonaObservation(observation: PersonaObservationV1): void {
  runtimeFeatureMetrics.recordPersonaObservation(observation, {
    complete: isPersonaObservationComplete(observation),
  })
}

export function isPersonaObservationComplete(observation: PersonaObservationV1): boolean {
  if (observation.coverage_status === 'visible_complete') {
    return Boolean(
      observation.trace_id &&
      observation.source_callsite_id &&
      observation.persona_seed_code &&
      observation.home_voice_line_id &&
      observation.prompt_ref?.id &&
      typeof observation.prompt_ref?.version === 'number' &&
      observation.requested_tier &&
      observation.resolved_tier &&
      observation.render_decision?.profile_id &&
      observation.render_decision?.provider_id &&
      observation.render_decision?.model_id &&
      observation.render_decision?.region &&
      observation.render_decision?.fallback_level &&
      observation.render_decision.reasons.length > 0 &&
      observation.usage &&
      typeof observation.latency_ms === 'number' &&
      typeof observation.parse_success === 'boolean'
    )
  }

  return Boolean(observation.source_callsite_id && observation.coverage_status)
}

export function buildPersonaObservabilitySummary(
  counters: PersonaObservationCounters,
  latestGateSnapshot = readLatestPersonaGateSnapshot(),
): Record<string, unknown> {
  return {
    log_completeness: {
      complete_runs: counters.complete_runs_total,
      observed_runs: counters.observed_runs_total,
      rate: ratio(counters.complete_runs_total, counters.observed_runs_total),
      visible_complete_runs: counters.visible_complete_runs_total,
      visible_partial_runs: counters.visible_partial_runs_total,
      hidden_partial_runs: counters.hidden_partial_runs_total,
    },
    fallback_mix: {
      none: counters.fallback_none_total,
      same_line: counters.fallback_same_line_total,
      same_family: counters.fallback_same_family_total,
      cross_family_hidden: counters.fallback_cross_family_hidden_total,
      rare_reanchor: counters.fallback_rare_reanchor_total,
    },
    parse_success: {
      attempts: counters.parse_attempt_total,
      successes: counters.parse_success_total,
      rate: ratio(counters.parse_success_total, counters.parse_attempt_total),
    },
    identity_write_success: {
      attempts: counters.identity_write_attempt_total,
      successes: counters.identity_write_success_total,
      rate: ratio(counters.identity_write_success_total, counters.identity_write_attempt_total),
    },
    latest_gate_snapshot: latestGateSnapshot,
  }
}

export function readLatestPersonaGateSnapshot(): PersonaGateSnapshotV1 {
  if (!existsSync(PERSONA_EVAL_LATEST_PATH)) {
    return cloneGateSnapshot(DEFAULT_PERSONA_GATE_SNAPSHOT_V1)
  }

  try {
    const raw = JSON.parse(readFileSync(PERSONA_EVAL_LATEST_PATH, 'utf-8')) as Partial<PersonaGateSnapshotV1>
    if (
      raw.version !== 'persona-gate-snapshot-v1' ||
      raw.gating_basis !== 'persona-eval-v1' ||
      !Array.isArray(raw.results)
    ) {
      return cloneGateSnapshot(DEFAULT_PERSONA_GATE_SNAPSHOT_V1)
    }
    return {
      version: 'persona-gate-snapshot-v1',
      generated_at: typeof raw.generated_at === 'string' ? raw.generated_at : null,
      overall_status: isGateStatus(raw.overall_status) ? raw.overall_status : 'not_run',
      gating_basis: 'persona-eval-v1',
      results: raw.results
        .filter((item): item is PersonaGateResultV1 => isRecord(item) && typeof item.gate_id === 'string')
        .map((item) => ({
          gate_id: item.gate_id,
          kind: item.kind === 'guardrail' ? 'guardrail' : 'blocking',
          threshold: typeof item.threshold === 'string' ? item.threshold : '',
          status: isGateStatus(item.status) ? item.status : 'not_run',
          actual: typeof item.actual === 'string' || item.actual === null ? item.actual : null,
          ...(typeof item.note === 'string' ? { note: item.note } : {}),
        })),
    }
  } catch {
    return cloneGateSnapshot(DEFAULT_PERSONA_GATE_SNAPSHOT_V1)
  }
}

function summarizePromptAudit(audit: PromptComposeAudit): PersonaObservationPromptAuditSummary {
  return {
    included_layer_ids: [...audit.includedLayerIds],
    token_estimates: { ...audit.tokenEstimates },
    lint_warnings: [...audit.lintWarnings],
    trim_reasons: [...audit.trimReasons],
    ...(audit.provenance
      ? {
          provenance: {
            ...(audit.provenance.community_profile
              ? {
                  community_profile: {
                    ...audit.provenance.community_profile,
                  },
                }
              : {}),
            ...(audit.provenance.private_memory
              ? {
                  private_memory: {
                    ...audit.provenance.private_memory,
                    used_memory_ids: [...audit.provenance.private_memory.used_memory_ids],
                    ...(audit.provenance.private_memory.server_cap_sources
                      ? {
                          server_cap_sources: audit.provenance.private_memory.server_cap_sources
                            .map((item) => ({ ...item })),
                        }
                      : {}),
                  },
                }
              : {}),
          },
        }
      : {}),
  }
}

function normalizePromptAuditSummary(raw: Record<string, unknown>): PersonaObservationPromptAuditSummary {
  const provenanceRaw = isRecord(raw.provenance) ? raw.provenance : null
  const communityProfileRaw = provenanceRaw && isRecord(provenanceRaw.community_profile)
    ? provenanceRaw.community_profile
    : null
  const privateMemoryRaw = provenanceRaw && isRecord(provenanceRaw.private_memory)
    ? provenanceRaw.private_memory
    : null

  return {
    included_layer_ids: Array.isArray(raw.included_layer_ids)
      ? raw.included_layer_ids.filter((item): item is string => typeof item === 'string')
      : [],
    token_estimates: isRecord(raw.token_estimates)
      ? Object.entries(raw.token_estimates).reduce<Record<string, number>>((acc, [key, value]) => {
          if (typeof value === 'number') {
            acc[key] = value
          }
          return acc
        }, {})
      : {},
    lint_warnings: Array.isArray(raw.lint_warnings)
      ? raw.lint_warnings.filter((item): item is string => typeof item === 'string')
      : [],
    trim_reasons: Array.isArray(raw.trim_reasons)
      ? raw.trim_reasons.filter((item): item is string => typeof item === 'string')
      : [],
    ...(provenanceRaw
      ? {
          provenance: {
            ...(communityProfileRaw
              && typeof communityProfileRaw.source === 'string'
              && typeof communityProfileRaw.version === 'string'
              ? {
                  community_profile: {
                    source: communityProfileRaw.source,
                    version: communityProfileRaw.version,
                  },
                }
              : {}),
            ...(privateMemoryRaw
              && typeof privateMemoryRaw.requested_disclosure_level === 'number'
              && typeof privateMemoryRaw.effective_disclosure_level === 'number'
              && (privateMemoryRaw.cap_source === 'owner_setting' || privateMemoryRaw.cap_source === 'server_cap')
              ? {
                  private_memory: {
                    used_memory_ids: Array.isArray(privateMemoryRaw.used_memory_ids)
                      ? privateMemoryRaw.used_memory_ids.filter((item): item is string => typeof item === 'string')
                      : [],
                    requested_disclosure_level: privateMemoryRaw.requested_disclosure_level,
                    effective_disclosure_level: privateMemoryRaw.effective_disclosure_level,
                    cap_source: privateMemoryRaw.cap_source,
                    public_disclosure_cap:
                      typeof privateMemoryRaw.public_disclosure_cap === 'number' || privateMemoryRaw.public_disclosure_cap === null
                        ? privateMemoryRaw.public_disclosure_cap
                        : null,
                    server_cap_sources: Array.isArray(privateMemoryRaw.server_cap_sources)
                      ? privateMemoryRaw.server_cap_sources.flatMap((item) => {
                          if (!isRecord(item)) return []
                          if (
                            typeof item.source_type !== 'string'
                            || typeof item.scope_type !== 'string'
                            || typeof item.cap_level !== 'number'
                            || typeof item.source !== 'string'
                          ) {
                            return []
                          }
                          return [{
                            source_type: item.source_type as 'baseline' | 'agent_override' | 'community_override' | 'hot_topic_runtime',
                            scope_type: item.scope_type as 'agent' | 'community' | 'runtime',
                            scope_id:
                              typeof item.scope_id === 'string' || item.scope_id === null
                                ? item.scope_id
                                : null,
                            cap_level: item.cap_level,
                            source: item.source as
                              | 'agent_privacy_settings'
                              | 'manual'
                              | 'owner_endorsement_public'
                              | 'owner_private_leak'
                              | 'hot_topic_drift',
                            override_id:
                              typeof item.override_id === 'string' || item.override_id === null
                                ? item.override_id
                                : undefined,
                            reason:
                              typeof item.reason === 'string' || item.reason === null
                                ? item.reason
                                : undefined,
                            linked_case_id:
                              typeof item.linked_case_id === 'string' || item.linked_case_id === null
                                ? item.linked_case_id
                                : undefined,
                            linked_risk_event_id:
                              typeof item.linked_risk_event_id === 'string' || item.linked_risk_event_id === null
                                ? item.linked_risk_event_id
                                : undefined,
                          }]
                        })
                      : [],
                    rewrite_cause:
                      typeof privateMemoryRaw.rewrite_cause === 'string' || privateMemoryRaw.rewrite_cause === null
                        ? privateMemoryRaw.rewrite_cause
                        : null,
                  },
                }
              : {}),
          },
        }
      : {}),
  }
}

function sanitizeRuntimeState(input: PersonaObservationRuntimeState): PersonaObservationRuntimeState {
  return {
    ...(typeof input.active_overlay_id === 'string' ? { active_overlay_id: input.active_overlay_id } : {}),
    ...(typeof input.overlay_cause === 'string' ? { overlay_cause: input.overlay_cause } : {}),
    ...(typeof input.overlay_rng_seed === 'string' ? { overlay_rng_seed: input.overlay_rng_seed } : {}),
    ...(typeof input.drift_score === 'number' ? { drift_score: input.drift_score } : {}),
    ...(typeof input.tier_floor === 'string' ? { tier_floor: input.tier_floor } : {}),
    ...(typeof input.tier_floor_reason === 'string'
      ? { tier_floor_reason: input.tier_floor_reason }
      : {}),
  }
}

function normalizeRuntimeState(raw: Record<string, unknown>): PersonaObservationRuntimeState {
  return sanitizeRuntimeState({
    ...(typeof raw.active_overlay_id === 'string' ? { active_overlay_id: raw.active_overlay_id } : {}),
    ...(typeof raw.overlay_cause === 'string' ? { overlay_cause: raw.overlay_cause } : {}),
    ...(typeof raw.overlay_rng_seed === 'string' ? { overlay_rng_seed: raw.overlay_rng_seed } : {}),
    ...(typeof raw.drift_score === 'number' ? { drift_score: raw.drift_score } : {}),
    ...(typeof raw.tier_floor === 'string' ? { tier_floor: raw.tier_floor as RenderTier } : {}),
    ...(typeof raw.tier_floor_reason === 'string'
      ? { tier_floor_reason: raw.tier_floor_reason }
      : {}),
  })
}

function normalizeRenderDecision(input: {
  coverageStatus: PersonaObservationCoverageStatus
  renderDecision?: RenderDecision | null
  llmProviderId?: string
  llmModelId?: string
  homeVoiceLineId?: VoiceLineId
  routingVoiceLineId?: VoiceLineId
  intent: LLMGenerationIntent
  resolvedTier?: RenderTier
  visibility: LLMVisibility
}): PersonaObservationRenderDecision | undefined {
  if (input.renderDecision) {
    return {
      profile_id: input.renderDecision.profileId,
      provider_id: input.renderDecision.providerId,
      model_id: input.renderDecision.modelId,
      region: input.renderDecision.region,
      fallback_level: input.renderDecision.fallbackLevel,
      reasons: [...input.renderDecision.reasons],
    }
  }

  const inferred = inferProfileResolution(
    input.coverageStatus,
    input.routingVoiceLineId ?? input.homeVoiceLineId,
    input.intent,
    input.resolvedTier,
  )
  if (!inferred && !input.llmProviderId && !input.llmModelId) {
    return undefined
  }

  const reasons = inferred?.reasons ? [...inferred.reasons] : []
  if (input.llmProviderId) {
    reasons.push(`provider_config_source=${input.llmProviderId}`)
  }
  if (input.llmModelId) {
    reasons.push(`runtime_model_source=${input.llmModelId}`)
  }

  const providerId = input.llmProviderId ?? inferred?.provider_id
  const modelId = input.llmModelId ?? inferred?.model_id

  return {
    ...(inferred?.profile_id ? { profile_id: inferred.profile_id } : {}),
    ...(providerId ? { provider_id: providerId } : {}),
    ...(modelId ? { model_id: modelId } : {}),
    ...(inferred?.region ? { region: inferred.region } : {}),
    ...(inferred?.fallback_level ? { fallback_level: inferred.fallback_level } : {}),
    reasons,
  }
}

function inferProfileResolution(
  coverageStatus: PersonaObservationCoverageStatus,
  homeVoiceLineId: VoiceLineId | undefined,
  intent: LLMGenerationIntent,
  resolvedTier: RenderTier | undefined,
): PersonaObservationRenderDecision | null {
  if (!homeVoiceLineId || !resolvedTier) return null
  if (!isRoutingIntent(intent)) return null

  const profileId = resolveVoiceLineTierProfileRef(homeVoiceLineId, intent, resolvedTier)
  if (!profileId) return null

  const profile = getRegistryProfile(profileId)
  if (!profile) return null

  const candidate = profile.candidates[0]
  return {
    profile_id: profileId,
    provider_id: candidate?.provider_id,
    model_id: candidate?.model_id,
    region: candidate?.region,
    fallback_level: 'none',
    reasons: [
      `coverage=${coverageStatus}`,
      'render_decision_inferred_from_voice_line_registry',
    ],
  }
}

function getRegistryProfile(profileId: string): ModelProfileEntry | null {
  if (!cachedRegistryBundle) {
    cachedRegistryBundle = loadLlmRegistryBundle()
  }
  return cachedRegistryBundle.modelProfiles.profiles.find((entry) => entry.profile_id === profileId) ?? null
}

function deriveInventoryTier(
  tier: RenderTier | 'identityWriteTier' | 'n/a' | undefined,
): RenderTier | undefined {
  if (!tier || tier === 'n/a') return undefined
  if (tier === 'identityWriteTier') return 'premium'
  return tier
}

function validatePersonaObservation(observation: PersonaObservationV1): void {
  if (!observation.source_callsite_id.trim()) {
    throw new Error('persona observation requires source_callsite_id')
  }

  if (observation.coverage_status !== 'visible_complete') {
    return
  }

  if (!isPersonaObservationComplete(observation)) {
    throw new Error('visible-complete persona observation is missing required fields')
  }
}

function isGateStatus(value: unknown): value is PersonaGateStatus {
  return value === 'pass' || value === 'fail' || value === 'warn' || value === 'not_run'
}

function isRoutingIntent(intent: LLMGenerationIntent): intent is VoiceLineRoutingIntent {
  return intent !== 'dev_prompt_render'
}

function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Number((numerator / denominator).toFixed(4))
}

function cloneGateSnapshot(snapshot: PersonaGateSnapshotV1): PersonaGateSnapshotV1 {
  return {
    ...snapshot,
    results: snapshot.results.map((item) => ({ ...item })),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
