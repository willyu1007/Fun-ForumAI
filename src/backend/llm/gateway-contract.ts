import type { LlmMessage, LlmTokenUsage } from './types.js'
import type { PromptBudgetSummary, PromptScene } from '../runtime/types.js'
import type {
  RenderTier,
  VoiceLineId,
  VoiceLineRoutingIntent,
} from '../../shared/agent-persona-catalog.js'

export type LLMVisibility = 'visible' | 'hidden' | 'identity_write' | 'dev_only'

export type LLMGenerationIntent = VoiceLineRoutingIntent | 'dev_prompt_render'

export type RuntimeModality = 'text' | 'vision'

export type ResponseMode = 'text' | 'json_object' | 'json_schema' | 'tool'

export type LLMBudgetClass =
  | 'bootstrap'
  | 'visible_standard'
  | 'visible_premium'
  | 'hidden_background'
  | 'hidden_multimodal'
  | 'identity_write'
  | 'dev_only'

export interface PromptTemplateRef {
  id: string
  version: number
}

export type LLMGatewayErrorCode =
  | 'AuthError'
  | 'RateLimitError'
  | 'TimeoutError'
  | 'TransientError'
  | 'InvalidRequestError'
  | 'BudgetExceededError'
  | 'RegistryResolutionError'
  | 'PromptValidationError'
  | 'UpstreamError'

export class LLMGatewayContractError extends Error {
  constructor(
    readonly code: LLMGatewayErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'LLMGatewayContractError'
  }
}

export type RoutingFallbackLevel =
  | 'none'
  | 'same-line'
  | 'same-family'
  | 'cross-family-hidden'
  | 'rare-reanchor'

export type RoutingOrderStep =
  | 'intent_scene_fit'
  | 'voice_line_tier'
  | 'profile_candidates'
  | 'region_policy'
  | 'headroom'
  | 'health'

export type AdapterRequestShape =
  | 'chat'
  | 'responses'
  | 'messages'
  | 'native_multimodal'

export type AdapterTransport = 'chat_completions'

export type AdapterAuthStrategy = 'bearer_api_key' | 'x_api_key' | 'custom'

export type LLMGatewayOverrideField =
  | 'temperature'
  | 'maxTokens'
  | 'stop'
  | 'timeoutMs'
  | 'maxRetries'
  | 'executionPolicyId'
  | 'regionHint'

export interface ProviderRegistryEntry {
  provider_id: string
  display_name: string
  gateway_kind: 'openai_compatible' | 'native'
  auth: {
    type: 'api_key'
    source: 'credential_pool'
    auth_strategy: AdapterAuthStrategy
  }
  routing: {
    regions: string[]
    default_region: string
  }
  capabilities: {
    chat: boolean
    json_mode: boolean
    tool_calling: boolean
    streaming: boolean
  }
  defaults: {
    timeout_ms: number
    max_retries: number
  }
}

export interface RouteContext {
  intent: LLMGenerationIntent
  visibility: LLMVisibility
  scene: PromptScene | 'background_hidden' | 'dev_prompt_render'
  modality: RuntimeModality
  responseMode: ResponseMode
  agentId: string
  homeVoiceLineId: VoiceLineId
  requestedTier?: RenderTier
  budgetClass: LLMBudgetClass
  traceId: string
  providerTags?: string[]
  policyTags?: string[]
  preferredModelId?: string
  regionHint?: string
  debug?: LLMGatewayDebugOverrides
}

export interface LLMGatewayLocalOverrides {
  executionPolicyId?: string
  temperature?: number
  maxTokens?: number
  stop?: string[]
  timeoutMs?: number
  maxRetries?: number
  regionHint?: string
}

export interface LLMGatewayDebugOverrides {
  providerPin?: string | null
  modelPin?: string | null
  adapterPin?: string | null
  temperature?: number
  maxTokens?: number
  stop?: string[]
  timeoutMs?: number
  maxRetries?: number
  regionHint?: string
}

export interface CredentialPoolEntry {
  credential_id: string
  provider_id: string
  region: string
  endpoint_id: string
  endpoint: string
  credential_ref: string
  priority: number
  health: 'healthy' | 'degraded' | 'blocked'
  enabled?: boolean
  scope_tags?: string[]
  allowed_model_ids?: string[]
  rpm_headroom?: number
  tpm_headroom?: number
}

export interface RoutingPolicyEntry {
  profile_id: string
  route_order: RoutingOrderStep[]
}

export interface ExecutionPolicyEntry {
  policy_id: string
  lane: string
  modality: RuntimeModality
  response_mode: ResponseMode
  defaults: {
    temperature?: number
    max_tokens?: number
    stop?: string[]
    timeout_ms?: number
    max_retries?: number
  }
  fallback: {
    allow_fallback_within_line: boolean
    allow_cross_family: boolean
    allowed_fallback_levels: RoutingFallbackLevel[]
  }
  merge: {
    allow_callsite_override_fields: LLMGatewayOverrideField[]
    allow_debug_override_fields: LLMGatewayOverrideField[]
  }
}

export interface AdapterBinding {
  adapterId: string
  requestShape: AdapterRequestShape
  transport: AdapterTransport
  providerGatewayKinds: Array<ProviderRegistryEntry['gateway_kind']>
  supports: {
    chat: boolean
    vision: boolean
    jsonMode: boolean
    structuredOutput: boolean
    toolCalling: boolean
    streaming: boolean
  }
  authStrategy: AdapterAuthStrategy
}

export interface CredentialBinding {
  credentialId: string
  providerId: string
  region: string
  endpointId: string
  endpoint: string
  secretRef: string
  priority: number
  health: CredentialPoolEntry['health']
  scopeTags?: string[]
  allowedModelIds?: string[]
  rpmHeadroom?: number
  tpmHeadroom?: number
}

export interface UsageLedgerEntry {
  trace_id: string
  agent_id: string
  intent: LLMGenerationIntent
  visibility: LLMVisibility
  scene: PromptScene | 'background_hidden' | 'dev_prompt_render'
  prompt_ref: PromptTemplateRef
  render_decision: RenderDecision
  usage?: LlmTokenUsage
  success: boolean
  provider_id?: string
  model_id?: string
  profile_id?: string
  policy_id?: string
  adapter_id?: string
  pool_id?: string
  credential_id?: string
  route_order?: RoutingOrderStep[]
  ordered_candidates?: ExecutionPlanCandidate[]
  fallback_chain?: FallbackStep[]
  fallback_history?: FallbackHistoryEntry[]
  merge_trace?: ExecutionParamMergeTrace
  resolved_params?: ResolvedExecutionParams
  billing_class?: LLMBudgetClass
  estimated_cost_cny?: number
  reserved_cost_cny?: number
  actual_cost_cny?: number
  platform_retry_count?: number
  error_code?: LLMGatewayErrorCode
  gateway_warnings?: string[]
  prompt_budget_summary?: PromptBudgetSummary
  latency_ms: number
  created_at: string
}

export interface ModelProfileCandidate {
  provider_id: string
  model_id: string
  region: string
  endpoint_id: string
  adapter_id?: string
  weight: number
  quality_class: 'fast' | 'balanced' | 'premium'
}

export interface ModelProfileFallback {
  level: Exclude<RoutingFallbackLevel, 'none'>
  profile_id?: string
  provider_id?: string
  model_id?: string
  reason: string
}

export interface ModelProfileResolution {
  profileId: string
  voiceLineId: VoiceLineId
  tier: RenderTier
  intent: LLMGenerationIntent
  visibility: LLMVisibility
  selectedCandidate: ModelProfileCandidate
  candidateCount: number
  region: string
  endpointId: string
  fallbackChain: ModelProfileFallback[]
  reasons: string[]
}

export interface RenderDecision {
  voiceLineId: VoiceLineId
  tier: RenderTier
  profileId: string
  policyId?: string
  providerId: string
  modelId: string
  adapterId?: string
  region: string
  endpointId?: string
  credentialId?: string
  fallbackLevel: RoutingFallbackLevel
  reasons: string[]
  promptTemplateId: string
  promptVersion: number
}

export interface ExecutionPlanCandidate {
  candidateId: string
  providerId: string
  modelId: string
  adapterId: string
  region: string
  endpointId: string
  weight: number
  qualityClass: ModelProfileCandidate['quality_class']
}

export interface FallbackStep {
  level: Exclude<RoutingFallbackLevel, 'none'>
  targetProfileId?: string
  targetProviderId?: string
  targetModelId?: string
  reason: string
}

export interface FallbackHistoryEntry {
  profileId: string
  providerId: string
  modelId: string
  adapterId: string
  fallbackLevel: RoutingFallbackLevel
  errorCode: LLMGatewayErrorCode
  reason: string
}

export interface ResolvedExecutionParams {
  modality: RuntimeModality
  responseMode: ResponseMode
  temperature?: number
  maxTokens?: number
  stop?: string[]
  timeoutMs: number
  maxRetries: number
  regionHint?: string
}

export interface DebugRoutingOverrideTrace {
  providerPin?: string
  modelPin?: string
  adapterPin?: string
}

export interface ExecutionParamMergeTrace {
  hardCaps: Partial<ResolvedExecutionParams>
  policyDefaults: Partial<ResolvedExecutionParams>
  callsiteOverrides: Partial<ResolvedExecutionParams>
  debugOverrides: Partial<ResolvedExecutionParams>
  appliedOverrideFields: LLMGatewayOverrideField[]
  appliedCallsiteOverrideFields?: LLMGatewayOverrideField[]
  appliedDebugOverrideFields?: LLMGatewayOverrideField[]
  debugRoutingOverrides?: DebugRoutingOverrideTrace
}

export interface InferenceExecutionPlan {
  planId: string
  context: RouteContext
  profileId: string
  policy: ExecutionPolicyEntry
  orderedCandidates: ExecutionPlanCandidate[]
  selectedCandidate?: ExecutionPlanCandidate
  selectedAdapter?: AdapterBinding
  selectedCredential?: CredentialBinding
  routeOrder: RoutingOrderStep[]
  fallbackLevel: RoutingFallbackLevel
  fallbackChain: FallbackStep[]
  fallbackHistory: FallbackHistoryEntry[]
  resolvedParams: ResolvedExecutionParams
  mergeTrace: ExecutionParamMergeTrace
  warnings: string[]
}

export interface ModelCapabilityEntry {
  provider_id: string
  model_id: string
  input_window_tokens: number
  max_output_tokens: number
  recommended_operating_input_tokens?: number
  modalities: RuntimeModality[]
  response_modes: ResponseMode[]
}

export interface LLMGatewayRequest {
  intent: LLMGenerationIntent
  visibility: LLMVisibility
  scene: PromptScene | 'background_hidden' | 'dev_prompt_render'
  modality: RuntimeModality
  responseMode: ResponseMode
  agentId: string
  homeVoiceLineId: VoiceLineId
  preferredModelId?: string
  policyTags?: string[]
  promptRef: PromptTemplateRef
  variables: Record<string, string>
  budgetClass: LLMBudgetClass
  traceId: string
  requestedTier?: RenderTier
  allowFallbackWithinLine: boolean
  allowCrossFamily: boolean
  providerTags?: string[]
  promptMessages?: LlmMessage[]
  promptBudgetSummary?: PromptBudgetSummary
  localOverrides?: LLMGatewayLocalOverrides
  debug?: LLMGatewayDebugOverrides
}

export interface LLMGatewayResponse {
  content: string
  messages: LlmMessage[]
  usage: LlmTokenUsage
  finishReason?: string | null
  latencyMs: number
  platformRetryCount: number
  renderDecision: RenderDecision
  executionPlan: InferenceExecutionPlan
  promptRef: PromptTemplateRef
  warnings?: string[]
}
