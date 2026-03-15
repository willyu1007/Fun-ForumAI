import type { RenderTier, VoiceLineRoutingIntent } from '../../shared/agent-persona-catalog.js'
import type {
  LLMGatewayErrorCode,
  LLMGatewayRequest,
  LLMGatewayResponse,
  LLMVisibility,
  RenderDecision,
  RoutingFallbackLevel,
} from './gateway-contract.js'
import { LLMGatewayContractError } from './gateway-contract.js'
import { CredentialBroker } from './credential-broker.js'
import { BudgetGuard } from './budget-guard.js'
import { LlmClient } from './llm-client.js'
import { PromptEngine } from './prompt-engine.js'
import type { LlmMessage, LlmTokenUsage } from './types.js'
import type { LlmRegistryBundle, ModelPricingEntry, ModelProfileEntry } from './registry-loader.js'
import { filterVisibleProfileCandidates } from './provider-admission.js'
import {
  resolveIdentityWriteProfileRef,
  resolveVoiceLineTierProfileRef,
} from './voice-line-routing.js'
import { UsageLedgerWriter } from './usage-ledger.js'

interface RouteCandidate {
  profile: ModelProfileEntry
  fallbackLevel: RoutingFallbackLevel
  reasons: string[]
}

interface LlmGatewayOptions {
  bundle: LlmRegistryBundle
  promptEngine: PromptEngine
  llmClient: LlmClient
  credentialBroker: CredentialBroker
  usageLedger: UsageLedgerWriter
  budgetGuard: BudgetGuard
}

const DEFAULT_PRICING = { prompt: 0.02, completion: 0.05 }

export class LLMGateway {
  private readonly profilesById: Map<string, ModelProfileEntry>
  private readonly pricingByModelId: Map<string, { prompt: number; completion: number }>

  constructor(private readonly options: LlmGatewayOptions) {
    this.profilesById = new Map(
      options.bundle.modelProfiles.profiles.map(
        (profile) => [profile.profile_id, profile] as const,
      ),
    )
    this.pricingByModelId = new Map(
      options.bundle.modelPricing.pricing.map(
        (p: ModelPricingEntry) =>
          [
            p.model_id,
            { prompt: p.prompt_per_1k_cny, completion: p.completion_per_1k_cny },
          ] as const,
      ),
    )
  }

  get isConfigured(): boolean {
    return this.options.credentialBroker.hasAnyUsableCredential()
  }

  setBudgetChecker(checker: ConstructorParameters<typeof BudgetGuard>[0]): void {
    this.options.budgetGuard.setChecker(checker ?? null)
  }

  async generateVisibleText(
    request: Omit<LLMGatewayRequest, 'visibility'>,
  ): Promise<LLMGatewayResponse> {
    return this.chat({ ...request, visibility: 'visible' })
  }

  async generateHiddenArtifact(
    request: Omit<LLMGatewayRequest, 'visibility'>,
  ): Promise<LLMGatewayResponse> {
    return this.chat({ ...request, visibility: 'hidden' })
  }

  async generateIdentityWrite(
    request: Omit<LLMGatewayRequest, 'visibility'>,
  ): Promise<LLMGatewayResponse> {
    return this.chat({ ...request, visibility: 'identity_write' })
  }

  async chat(request: LLMGatewayRequest): Promise<LLMGatewayResponse> {
    const messages =
      request.promptMessages ??
      this.options.promptEngine.render(request.promptRef, request.variables)
    const routePlan = this.buildRoutePlan(request)
    let lastError: unknown = null

    for (const route of routePlan) {
      const { candidates, reasons } = this.resolveCandidatesForRequest(route.profile, request)
      if (candidates.length === 0) {
        lastError = new LLMGatewayContractError(
          'RegistryResolutionError',
          'No admitted candidates available for this visible profile',
          {
            profile_id: route.profile.profile_id,
            voice_line_id: route.profile.voice_line_id,
          },
        )
        continue
      }
      const orderedCandidates = prioritizeCandidates(candidates, request.preferredModelId)
      for (const candidate of orderedCandidates) {
        const estimatedUsage = estimateUsage(messages, request.maxTokens)
        const estimatedCost = this.estimateCost(candidate.model_id, estimatedUsage)
        const renderReasons = buildRenderReasons(
          [...route.reasons, ...reasons],
          request.preferredModelId,
          candidate.model_id,
        )

        await this.options.budgetGuard.assertAllowed({
          agentId: request.agentId,
          budgetClass: request.budgetClass,
          traceId: request.traceId,
          estimatedCostCny: estimatedCost,
        })

        let renderDecision: RenderDecision | null = null
        const startedAt = Date.now()

        try {
          const credential = this.options.credentialBroker.resolve({
            candidate,
            visibility: request.visibility,
            budgetClass: request.budgetClass,
            tags: request.providerTags,
          })

          renderDecision = {
            voiceLineId: request.homeVoiceLineId,
            tier: route.profile.tier,
            profileId: route.profile.profile_id,
            providerId: candidate.provider_id,
            modelId: candidate.model_id,
            region: candidate.region,
            endpointId: candidate.endpoint_id,
            credentialId: credential.pool.credential_id,
            fallbackLevel: route.fallbackLevel,
            reasons: renderReasons,
            promptTemplateId: request.promptRef.id,
            promptVersion: request.promptRef.version,
          }

          const response = await this.options.llmClient.chat({
            messages,
            model: candidate.model_id,
            temperature: request.temperature,
            max_tokens: request.maxTokens,
            stop: request.stop,
            provider: {
              provider_id: candidate.provider_id,
              gateway_kind: credential.provider.gateway_kind,
              base_url: credential.pool.endpoint,
              api_key: credential.apiKey,
              timeout_ms: credential.provider.defaults.timeout_ms,
              max_retries: credential.provider.defaults.max_retries,
            },
          })

          const latencyMs = Date.now() - startedAt
          const platformRetryCount = Math.max((response.meta?.attempts ?? 1) - 1, 0)
          const actualCost = this.estimateCost(candidate.model_id, response.usage)

          this.options.usageLedger.write({
            trace_id: request.traceId,
            agent_id: request.agentId,
            intent: request.intent,
            visibility: request.visibility,
            scene: request.scene,
            prompt_ref: request.promptRef,
            render_decision: renderDecision,
            usage: response.usage,
            success: true,
            provider_id: candidate.provider_id,
            model_id: candidate.model_id,
            profile_id: route.profile.profile_id,
            pool_id: credential.pool.credential_id,
            credential_id: credential.pool.credential_id,
            billing_class: request.budgetClass,
            estimated_cost_cny: estimatedCost,
            reserved_cost_cny: estimatedCost,
            actual_cost_cny: actualCost,
            platform_retry_count: platformRetryCount,
            latency_ms: latencyMs,
            created_at: new Date().toISOString(),
          })

          return {
            content: response.content,
            messages,
            usage: response.usage,
            finishReason: response.finish_reason,
            latencyMs,
            platformRetryCount,
            renderDecision,
            promptRef: request.promptRef,
          }
        } catch (error) {
          const code = classifyGatewayError(error)
          lastError = error
          this.options.usageLedger.write({
            trace_id: request.traceId,
            agent_id: request.agentId,
            intent: request.intent,
            visibility: request.visibility,
            scene: request.scene,
            prompt_ref: request.promptRef,
            render_decision: renderDecision ?? {
              voiceLineId: request.homeVoiceLineId,
              tier: route.profile.tier,
              profileId: route.profile.profile_id,
              providerId: candidate.provider_id,
              modelId: candidate.model_id,
              region: candidate.region,
              endpointId: candidate.endpoint_id,
              fallbackLevel: route.fallbackLevel,
              reasons: renderReasons,
              promptTemplateId: request.promptRef.id,
              promptVersion: request.promptRef.version,
            },
            usage: undefined,
            success: false,
            provider_id: candidate.provider_id,
            model_id: candidate.model_id,
            profile_id: route.profile.profile_id,
            billing_class: request.budgetClass,
            estimated_cost_cny: estimatedCost,
            reserved_cost_cny: estimatedCost,
            actual_cost_cny: 0,
            error_code: code,
            latency_ms: Date.now() - startedAt,
            created_at: new Date().toISOString(),
          })

          if (!shouldTryNextRoute(code)) {
            throw toGatewayError(error, code)
          }
        }
      }
    }

    throw toGatewayError(lastError, classifyGatewayError(lastError))
  }

  private buildRoutePlan(request: LLMGatewayRequest): RouteCandidate[] {
    const initialProfileId = this.resolveInitialProfileId(request)
    const queue: Array<{
      profileId: string
      fallbackLevel: RoutingFallbackLevel
      reasons: string[]
    }> = [
      {
        profileId: initialProfileId,
        fallbackLevel: 'none',
        reasons: ['initial_profile_resolution'],
      },
    ]
    const visited = new Set<string>()
    const plan: RouteCandidate[] = []

    while (queue.length > 0) {
      const next = queue.shift()
      if (!next || visited.has(next.profileId)) continue
      visited.add(next.profileId)
      const profile = this.profilesById.get(next.profileId)
      if (!profile) {
        throw new LLMGatewayContractError(
          'RegistryResolutionError',
          'Profile not found in registry bundle',
          {
            profile_id: next.profileId,
          },
        )
      }

      plan.push({
        profile,
        fallbackLevel: next.fallbackLevel,
        reasons: next.reasons,
      })

      const policy = this.options.bundle.routingPolicies.policies.find(
        (entry) => entry.profile_id === profile.profile_id,
      )
      if (!policy) continue

      for (const fallback of profile.fallback) {
        if (!this.isFallbackAllowed(fallback.level, request.visibility, request, policy)) {
          continue
        }
        if (!fallback.profile_id) continue
        queue.push({
          profileId: fallback.profile_id,
          fallbackLevel: fallback.level,
          reasons: [...next.reasons, fallback.reason],
        })
      }
    }

    return plan
  }

  private resolveCandidatesForRequest(
    profile: ModelProfileEntry,
    request: LLMGatewayRequest,
  ): { candidates: typeof profile.candidates; reasons: string[] } {
    if (request.visibility !== 'visible') {
      return { candidates: profile.candidates, reasons: [] }
    }

    const filtered = filterVisibleProfileCandidates(this.options.bundle, profile)
    const reasons = ['provider_admission_pool']
    if (filtered.filteredCounts.shadow > 0 || filtered.filteredCounts.blocked > 0) {
      reasons.push('provider_admission_filtered')
    }
    return {
      candidates: filtered.admittedCandidates,
      reasons,
    }
  }

  private resolveInitialProfileId(request: LLMGatewayRequest): string {
    if (request.visibility === 'identity_write' || request.intent === 'identity_write') {
      const profileId = resolveIdentityWriteProfileRef(
        request.homeVoiceLineId,
        request.requestedTier ?? defaultTierForIntent('identity_write'),
      )
      if (!profileId) {
        throw new LLMGatewayContractError(
          'RegistryResolutionError',
          `No identity write profile for ${request.homeVoiceLineId}`,
          requestDetails(request),
        )
      }
      return profileId
    }

    const tier = request.requestedTier ?? defaultTierForIntent(request.intent)
    const profileId = resolveVoiceLineTierProfileRef(
      request.homeVoiceLineId,
      request.intent as VoiceLineRoutingIntent,
      tier,
    )
    if (!profileId) {
      throw new LLMGatewayContractError(
        'RegistryResolutionError',
        `No profile for ${request.homeVoiceLineId}/${request.intent}/${tier}`,
        requestDetails(request),
      )
    }
    return profileId
  }

  private estimateCost(modelId: string, usage: LlmTokenUsage): number {
    const pricing = this.pricingByModelId.get(modelId) ?? DEFAULT_PRICING
    return (
      (usage.prompt_tokens / 1000) * pricing.prompt +
      (usage.completion_tokens / 1000) * pricing.completion
    )
  }

  private isFallbackAllowed(
    level: RoutingFallbackLevel,
    visibility: LLMVisibility,
    request: LLMGatewayRequest,
    policy: {
      allow_fallback_within_line: boolean
      allow_cross_family: boolean
      allowed_fallback_levels: RoutingFallbackLevel[]
    },
  ): boolean {
    if (!policy.allowed_fallback_levels.includes(level)) return false
    if (level === 'none') return false
    if (
      level === 'same-line' &&
      (!policy.allow_fallback_within_line || !request.allowFallbackWithinLine)
    ) {
      return false
    }
    if (
      (level === 'cross-family-hidden' || level === 'rare-reanchor') &&
      (!policy.allow_cross_family || !request.allowCrossFamily || visibility !== 'hidden')
    ) {
      return false
    }
    return true
  }
}

function defaultTierForIntent(intent: string): RenderTier {
  switch (intent) {
    case 'chat_reply':
      return 'lite'
    case 'identity_write':
      return 'premium'
    default:
      return 'base'
  }
}

function estimateUsage(messages: LlmMessage[], maxTokens = 512): LlmTokenUsage {
  const prompt_tokens = Math.max(1, Math.ceil(JSON.stringify(messages).length / 4))
  const completion_tokens = Math.max(1, Math.ceil(maxTokens / 2))
  return {
    prompt_tokens,
    completion_tokens,
    total_tokens: prompt_tokens + completion_tokens,
  }
}

function shouldTryNextRoute(code: string): boolean {
  return [
    'AuthError',
    'RateLimitError',
    'TimeoutError',
    'TransientError',
    'UpstreamError',
  ].includes(code)
}

function classifyGatewayError(error: unknown): LLMGatewayErrorCode {
  if (error instanceof LLMGatewayContractError) {
    return error.code
  }
  if (!(error instanceof Error)) {
    return 'UpstreamError'
  }

  const message = error.message.toLowerCase()
  if (message.includes('401') || message.includes('403') || message.includes('api key')) {
    return 'AuthError'
  }
  if (message.includes('429') || message.includes('rate limit')) {
    return 'RateLimitError'
  }
  if (message.includes('timeout') || message.includes('abort')) {
    return 'TimeoutError'
  }
  if (message.includes('400') || message.includes('invalid')) {
    return 'InvalidRequestError'
  }
  if (message.includes('budget')) {
    return 'BudgetExceededError'
  }
  if (
    message.includes('fetch failed') ||
    message.includes('econnreset') ||
    message.includes('etimedout')
  ) {
    return 'TransientError'
  }
  return 'UpstreamError'
}

function toGatewayError(error: unknown, code: LLMGatewayErrorCode): LLMGatewayContractError {
  if (error instanceof LLMGatewayContractError) {
    return error
  }
  return new LLMGatewayContractError(
    code,
    error instanceof Error ? error.message : 'Unknown gateway error',
  )
}

function requestDetails(request: LLMGatewayRequest): Record<string, unknown> {
  return {
    intent: request.intent,
    visibility: request.visibility,
    scene: request.scene,
    agentId: request.agentId,
    homeVoiceLineId: request.homeVoiceLineId,
    promptRef: request.promptRef,
    budgetClass: request.budgetClass,
    traceId: request.traceId,
    requestedTier: request.requestedTier,
    preferredModelId: request.preferredModelId,
    allowFallbackWithinLine: request.allowFallbackWithinLine,
    allowCrossFamily: request.allowCrossFamily,
    providerTags: request.providerTags,
  }
}

function prioritizeCandidates(
  candidates: ModelProfileEntry['candidates'],
  preferredModelId: string | undefined,
): ModelProfileEntry['candidates'] {
  return [...candidates].sort((a, b) => {
    const aPreferred = preferredModelId !== undefined && a.model_id === preferredModelId
    const bPreferred = preferredModelId !== undefined && b.model_id === preferredModelId
    if (aPreferred !== bPreferred) {
      return aPreferred ? -1 : 1
    }
    return b.weight - a.weight
  })
}

function buildRenderReasons(
  routeReasons: string[],
  preferredModelId: string | undefined,
  candidateModelId: string,
): string[] {
  if (!preferredModelId || preferredModelId !== candidateModelId) {
    return routeReasons
  }
  if (routeReasons.includes('preferred_model_hint')) {
    return routeReasons
  }
  return [...routeReasons, 'preferred_model_hint']
}
