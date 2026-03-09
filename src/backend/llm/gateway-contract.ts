import type { LlmMessage, LlmTokenUsage } from './types.js'
import type { PromptScene } from '../runtime/types.js'
import type {
  RenderTier,
  VoiceLineId,
  VoiceLineRoutingIntent,
} from '../../shared/agent-persona-catalog.js'

export type LLMVisibility = 'visible' | 'hidden' | 'identity_write' | 'dev_only'

export type LLMGenerationIntent = VoiceLineRoutingIntent | 'dev_prompt_render'

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

export interface ProviderRegistryEntry {
  provider_id: string
  display_name: string
  gateway_kind: 'openai_compatible' | 'native'
  auth: {
    type: 'api_key'
    credential_ref_required: boolean
    credential_ref: string
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

export interface ModelCatalogEntry {
  model_id: string
  provider_id: string
  family: string
  line: string
  tier: RenderTier
  scene_fit: PromptScene[]
  role_fit: VoiceLineRoutingIntent[]
  quality_class: 'fast' | 'balanced' | 'premium'
  home_line_eligible: boolean
}

export interface CredentialPoolEntry {
  credential_id: string
  provider_id: string
  region: string
  endpoint_id: string
  endpoint: string
  credential_ref: string
  health: 'healthy' | 'degraded' | 'blocked'
  enabled?: boolean
  scope_tags?: string[]
  allowed_model_ids?: string[]
  rpm_headroom?: number
  tpm_headroom?: number
}

export interface RoutingPolicyEntry {
  profile_id: string
  route_order: Array<'intent_scene_fit' | 'voice_line_tier' | 'profile_candidates' | 'region_policy' | 'headroom' | 'health'>
  allow_fallback_within_line: boolean
  allow_cross_family: boolean
  allowed_fallback_levels: RoutingFallbackLevel[]
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
  pool_id?: string
  credential_id?: string
  billing_class?: LLMBudgetClass
  estimated_cost_cny?: number
  reserved_cost_cny?: number
  actual_cost_cny?: number
  platform_retry_count?: number
  error_code?: LLMGatewayErrorCode
  latency_ms: number
  created_at: string
}

export interface ModelProfileCandidate {
  provider_id: string
  model_id: string
  region: string
  endpoint_id: string
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
  providerId: string
  modelId: string
  region: string
  endpointId?: string
  credentialId?: string
  fallbackLevel: RoutingFallbackLevel
  reasons: string[]
  promptTemplateId: string
  promptVersion: number
}

export interface LLMGatewayRequest {
  intent: LLMGenerationIntent
  visibility: LLMVisibility
  scene: PromptScene | 'background_hidden' | 'dev_prompt_render'
  agentId: string
  homeVoiceLineId: VoiceLineId
  promptRef: PromptTemplateRef
  variables: Record<string, string>
  budgetClass: LLMBudgetClass
  traceId: string
  requestedTier?: RenderTier
  allowFallbackWithinLine: boolean
  allowCrossFamily: boolean
  temperature?: number
  maxTokens?: number
  stop?: string[]
  providerTags?: string[]
  promptMessages?: LlmMessage[]
}

export interface LLMGatewayResponse {
  content: string
  messages: LlmMessage[]
  usage?: LlmTokenUsage
  finishReason?: string | null
  latencyMs: number
  platformRetryCount: number
  renderDecision: RenderDecision
  promptRef: PromptTemplateRef
}
