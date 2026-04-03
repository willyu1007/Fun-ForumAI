import type { RenderTier, VoiceLineRoutingIntent } from '../../shared/agent-persona-catalog.js'
import type {
  AdapterBinding,
  CredentialBinding,
  ExecutionParamMergeTrace,
  ExecutionPolicyEntry,
  FallbackHistoryEntry,
  FallbackStep,
  InferenceExecutionPlan,
  LLMGatewayErrorCode,
  LLMGatewayRequest,
  LLMGatewayResponse,
  LLMGatewayOverrideField,
  LLMVisibility,
  ModelCapabilityEntry,
  ProviderRegistryEntry,
  RenderDecision,
  ResolvedExecutionParams,
  RouteContext,
  RoutingFallbackLevel,
  RoutingOrderStep,
} from './gateway-contract.js'
import { LLMGatewayContractError } from './gateway-contract.js'
import { CredentialBroker, findUsableCredentialPoolsForCandidate } from './credential-broker.js'
import { BudgetGuard } from './budget-guard.js'
import { LlmClient } from './llm-client.js'
import { PromptEngine } from './prompt-engine.js'
import type { LlmMessage, LlmTokenUsage } from './types.js'
import type {
  LlmRegistryBundle,
  ModelPricingEntry,
  ModelProfileCandidate,
  ModelProfileEntry,
  RoutingPoliciesRegistryFile,
} from './registry-loader.js'
import { defaultAdapterId, defaultExecutionLane, defaultExecutionPolicyId } from './registry-loader.js'
import { filterVisibleProfileCandidates } from './provider-admission.js'
import {
  resolveIdentityWriteProfileRef,
  resolveVoiceLineTierProfileRef,
} from './voice-line-routing.js'
import { UsageLedgerWriter } from './usage-ledger.js'
import {
  estimateRenderedPromptTokens,
  withProviderPromptUsage,
  withRenderedPromptMeasurement,
} from '../runtime/prompt-budget-summary.js'

interface RouteCandidate {
  profile: ModelProfileEntry
  routingPolicy: RoutingPoliciesRegistryFile['policies'][number]
  executionPolicy: ExecutionPolicyEntry
  fallbackLevel: RoutingFallbackLevel
  reasons: string[]
  fallbackStep?: FallbackStep
  directCandidate?: {
    providerId: string
    modelId: string
  }
}

interface CandidateResolution {
  candidates: ModelProfileEntry['candidates']
  reasons: string[]
  warnings: string[]
}

interface CandidateSupportResult {
  supported: boolean
  warnings: string[]
}

interface ExecutionParamResolution {
  resolvedParams: ResolvedExecutionParams
  mergeTrace: ExecutionParamMergeTrace
  warnings: string[]
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
const QUALITY_SCORE_BY_TIER: Record<RenderTier, Record<ModelProfileCandidate['quality_class'], number>> = {
  lite: {
    fast: 3,
    balanced: 2,
    premium: 1,
  },
  base: {
    fast: 1,
    balanced: 3,
    premium: 2,
  },
  premium: {
    fast: 1,
    balanced: 2,
    premium: 3,
  },
}

export class LLMGateway {
  private readonly profilesById: Map<string, ModelProfileEntry>
  private readonly providersById: Map<string, ProviderRegistryEntry>
  private readonly pricingByProviderModelKey: Map<string, { prompt: number; completion: number }>
  private readonly modelCapabilitiesByKey: Map<string, ModelCapabilityEntry>
  private readonly routingPoliciesByProfileId: Map<string, RoutingPoliciesRegistryFile['policies'][number]>
  private readonly executionPoliciesById: Map<string, ExecutionPolicyEntry>
  private readonly adapterBindingsById: Map<string, AdapterBinding>

  constructor(private readonly options: LlmGatewayOptions) {
    this.profilesById = new Map(
      options.bundle.modelProfiles.profiles.map(
        (profile) => [profile.profile_id, profile] as const,
      ),
    )
    this.providersById = new Map(
      options.bundle.providers.providers.map((provider) => [provider.provider_id, provider] as const),
    )
    this.pricingByProviderModelKey = new Map(
      options.bundle.modelPricing.pricing.map(
        (p: ModelPricingEntry) =>
          [
            `${p.provider_id}/${p.model_id}`,
            { prompt: p.prompt_per_1k_cny, completion: p.completion_per_1k_cny },
          ] as const,
      ),
    )
    this.modelCapabilitiesByKey = new Map(
      options.bundle.modelCapabilities.capabilities.map((entry) => [
        `${entry.provider_id}/${entry.model_id}`,
        entry,
      ] as const),
    )
    this.routingPoliciesByProfileId = new Map(
      options.bundle.routingPolicies.policies.map((policy) => [policy.profile_id, policy] as const),
    )
    this.executionPoliciesById = new Map(
      options.bundle.executionPolicies.policies.map((policy) => [policy.policy_id, policy] as const),
    )
    this.adapterBindingsById = new Map(
      options.bundle.adapterBindings.bindings.map((binding) => [binding.adapterId, binding] as const),
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
    const measuredPromptBudgetSummary = withRenderedPromptMeasurement(request.promptBudgetSummary, messages)
    const context = buildRouteContext(request)
    const routePlan = this.buildRoutePlan(request)
    const fallbackChain = buildFallbackChain(routePlan)
    const fallbackHistory: FallbackHistoryEntry[] = []
    let lastError: unknown = new LLMGatewayContractError(
      'RegistryResolutionError',
      'No gateway route could satisfy the request',
      requestDetails(request),
    )

    for (const route of routePlan) {
      const candidateResolution = this.resolveCandidatesForRequest(
        route.profile,
        request,
        route.executionPolicy,
        route.directCandidate,
      )
      const routeWarnings = dedupeWarnings(candidateResolution.warnings)

      if (candidateResolution.candidates.length === 0) {
        lastError = new LLMGatewayContractError(
          'RegistryResolutionError',
          'No admitted candidate can satisfy this route context',
          {
            ...requestDetails(request),
            profile_id: route.profile.profile_id,
            fallback_level: route.fallbackLevel,
          },
        )
        continue
      }

      const orderedCandidates = prioritizeCandidates({
        candidates: candidateResolution.candidates,
        preferredModelId: request.preferredModelId,
        routeOrder: route.routingPolicy.route_order,
        route,
        request,
        providersById: this.providersById,
        modelCapabilitiesByKey: this.modelCapabilitiesByKey,
        adapterBindingsById: this.adapterBindingsById,
        credentialPools: this.options.bundle.credentialPools.pools,
        regionHint: this.resolveRegionHint(request, route.executionPolicy),
      })

      for (const candidate of orderedCandidates) {
        const adapterId = candidate.adapter_id ?? defaultAdapterId(candidate)
        const adapterBinding = this.resolveAdapterBinding(adapterId)
        const provider = this.resolveProvider(candidate.provider_id)
        const modelCapability = this.resolveModelCapability(candidate.provider_id, candidate.model_id)
        const { resolvedParams, mergeTrace, warnings: mergeWarnings } = this.resolveExecutionParams({
          request,
          executionPolicy: route.executionPolicy,
          provider,
          adapterBinding,
          modelCapability,
        })
        const estimatedUsage = estimateUsage(messages, resolvedParams.maxTokens)
        const estimatedCost = this.estimateCost(candidate.provider_id, candidate.model_id, estimatedUsage)
        const renderReasons = buildRenderReasons(
          [...route.reasons, ...candidateResolution.reasons],
          request.preferredModelId,
          candidate.model_id,
        )
        const gatewayWarnings = this.validatePromptBudgetSummary(
          measuredPromptBudgetSummary,
          candidate.provider_id,
          candidate.model_id,
          resolvedParams.maxTokens,
        )
        const executionWarnings = dedupeWarnings([...routeWarnings, ...mergeWarnings, ...gatewayWarnings])

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
          if (!adapterBinding.providerGatewayKinds.includes(credential.provider.gateway_kind)) {
            throw new LLMGatewayContractError(
              'RegistryResolutionError',
              `Adapter ${adapterId} does not support provider gateway kind ${credential.provider.gateway_kind}`,
              {
                adapter_id: adapterId,
                provider_id: credential.provider.provider_id,
                gateway_kind: credential.provider.gateway_kind,
              },
            )
          }

          const selectedCandidate = mapExecutionPlanCandidate(candidate)
          const selectedCredential = buildCredentialBinding(credential.pool)

          renderDecision = {
            voiceLineId: request.homeVoiceLineId,
            tier: route.profile.tier,
            profileId: route.profile.profile_id,
            policyId: route.executionPolicy.policy_id,
            providerId: candidate.provider_id,
            modelId: candidate.model_id,
            adapterId: adapterBinding.adapterId,
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
            temperature: resolvedParams.temperature,
            max_tokens: resolvedParams.maxTokens,
            stop: resolvedParams.stop,
            response_mode: resolvedParams.responseMode,
            provider: {
              provider_id: candidate.provider_id,
              gateway_kind: credential.provider.gateway_kind,
              auth_strategy: credential.provider.auth.auth_strategy,
              base_url: credential.pool.endpoint,
              api_key: credential.apiKey,
              timeout_ms: resolvedParams.timeoutMs,
              max_retries: resolvedParams.maxRetries,
            },
          })

          const latencyMs = Date.now() - startedAt
          const platformRetryCount = Math.max((response.meta?.attempts ?? 1) - 1, 0)
          const actualCost = this.estimateCost(candidate.provider_id, candidate.model_id, response.usage)
          const promptBudgetSummary = withProviderPromptUsage(
            measuredPromptBudgetSummary,
            response.usage.prompt_tokens,
          )
          const executionPlan = buildExecutionPlan({
            context,
            route,
            orderedCandidates,
            selectedCandidate,
            selectedAdapter: adapterBinding,
            selectedCredential,
            fallbackChain,
            fallbackHistory,
            resolvedParams,
            mergeTrace,
            warnings: executionWarnings,
          })

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
            gateway_warnings: executionWarnings,
            prompt_budget_summary: promptBudgetSummary,
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
            executionPlan,
            promptRef: request.promptRef,
            warnings: executionWarnings,
          }
        } catch (error) {
          const code = classifyGatewayError(error)
          lastError = error
          const errorMessage = error instanceof Error ? error.message : 'Unknown gateway error'

          fallbackHistory.push({
            profileId: route.profile.profile_id,
            providerId: candidate.provider_id,
            modelId: candidate.model_id,
            adapterId,
            fallbackLevel: route.fallbackLevel,
            errorCode: code,
            reason: errorMessage,
          })

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
              policyId: route.executionPolicy.policy_id,
              providerId: candidate.provider_id,
              modelId: candidate.model_id,
              adapterId,
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
            gateway_warnings: executionWarnings,
            prompt_budget_summary: measuredPromptBudgetSummary,
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
      fallbackStep?: FallbackStep
      directCandidate?: {
        providerId: string
        modelId: string
      }
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
      const visitedKey = next
        ? `${next.profileId}|${next.directCandidate?.providerId ?? '*'}|${next.directCandidate?.modelId ?? '*'}`
        : null
      if (!next || (visitedKey && visited.has(visitedKey))) continue
      if (visitedKey) visited.add(visitedKey)

      const profile = this.profilesById.get(next.profileId)
      if (!profile) {
        throw new LLMGatewayContractError(
          'RegistryResolutionError',
          'Profile not found in registry bundle',
          { profile_id: next.profileId },
        )
      }
      const routingPolicy = this.routingPoliciesByProfileId.get(profile.profile_id)
      if (!routingPolicy) {
        throw new LLMGatewayContractError(
          'RegistryResolutionError',
          'Routing policy not found in registry bundle',
          { profile_id: profile.profile_id },
        )
      }

      const executionPolicy = this.resolveExecutionPolicy(profile, request)
      plan.push({
        profile,
        routingPolicy,
        executionPolicy,
        fallbackLevel: next.fallbackLevel,
        reasons: next.reasons,
        fallbackStep: next.fallbackStep,
        directCandidate: next.directCandidate,
      })

      for (const fallback of profile.fallback) {
        if (!this.isFallbackAllowed(fallback.level, request, executionPolicy)) {
          continue
        }
        queue.push({
          profileId: fallback.profile_id ?? profile.profile_id,
          fallbackLevel: fallback.level,
          reasons: [...next.reasons, fallback.reason],
          fallbackStep: {
            level: fallback.level,
            targetProfileId: fallback.profile_id,
            targetProviderId: fallback.provider_id,
            targetModelId: fallback.model_id,
            reason: fallback.reason,
          },
          directCandidate:
            fallback.provider_id && fallback.model_id
              ? {
                  providerId: fallback.provider_id,
                  modelId: fallback.model_id,
                }
              : undefined,
        })
      }
    }

    return plan
  }

  private resolveCandidatesForRequest(
    profile: ModelProfileEntry,
    request: LLMGatewayRequest,
    executionPolicy: ExecutionPolicyEntry,
    directCandidate?: RouteCandidate['directCandidate'],
  ): CandidateResolution {
    const reasons: string[] = []
    const warnings: string[] = []

    let candidates = directCandidate
      ? profile.candidates.filter(
          (candidate) =>
            candidate.provider_id === directCandidate.providerId &&
            candidate.model_id === directCandidate.modelId,
        )
      : profile.candidates

    if (directCandidate) {
      reasons.push('direct_fallback_candidate')
    }

    if (request.visibility === 'visible') {
      const filtered = filterVisibleProfileCandidates(this.options.bundle, {
        ...profile,
        candidates,
      })
      candidates = filtered.admittedCandidates
      reasons.push('provider_admission_pool')
      if (filtered.filteredCounts.shadow > 0 || filtered.filteredCounts.blocked > 0) {
        reasons.push('provider_admission_filtered')
      }
    }

    const debugPinApplied = Boolean(
      request.debug?.providerPin || request.debug?.modelPin || request.debug?.adapterPin,
    )
    if (debugPinApplied) {
      candidates = candidates.filter((candidate) => matchesDebugPins(candidate, request.debug))
      reasons.push('debug_pin_filter')
    }

    const compatibleCandidates: typeof candidates = []
    for (const candidate of candidates) {
      const support = this.evaluateCandidateSupport(candidate, request, executionPolicy)
      if (support.supported) {
        compatibleCandidates.push(candidate)
      } else {
        warnings.push(...support.warnings)
      }
    }

    return {
      candidates: compatibleCandidates,
      reasons,
      warnings,
    }
  }

  private evaluateCandidateSupport(
    candidate: ModelProfileEntry['candidates'][number],
    request: LLMGatewayRequest,
    executionPolicy: ExecutionPolicyEntry,
  ): CandidateSupportResult {
    if (executionPolicy.modality !== request.modality || executionPolicy.response_mode !== request.responseMode) {
      throw new LLMGatewayContractError(
        'InvalidRequestError',
        `Request modality/responseMode does not match execution policy ${executionPolicy.policy_id}`,
        {
          policy_id: executionPolicy.policy_id,
          request_modality: request.modality,
          request_response_mode: request.responseMode,
          policy_modality: executionPolicy.modality,
          policy_response_mode: executionPolicy.response_mode,
        },
      )
    }

    const provider = this.resolveProvider(candidate.provider_id)
    const adapterBinding = this.resolveAdapterBinding(candidate.adapter_id ?? defaultAdapterId(candidate))
    const modelCapability = this.resolveModelCapability(candidate.provider_id, candidate.model_id)
    const candidateKey = `${candidate.provider_id}/${candidate.model_id}`
    const warnings: string[] = []

    if (!adapterBinding.providerGatewayKinds.includes(provider.gateway_kind)) {
      warnings.push(`candidate_filtered_adapter_gateway_kind:${candidateKey}`)
    }
    if (!provider.capabilities.chat || !adapterBinding.supports.chat) {
      warnings.push(`candidate_filtered_chat_capability:${candidateKey}`)
    }
    if (!supportsModality(modelCapability, request.modality)) {
      warnings.push(`candidate_filtered_modality:${candidateKey}`)
    }
    if (!supportsResponseMode(provider, adapterBinding, modelCapability, request.responseMode)) {
      warnings.push(`candidate_filtered_response_mode:${candidateKey}`)
    }

    return {
      supported: warnings.length === 0,
      warnings,
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

  private validatePromptBudgetSummary(
    promptBudgetSummary: LLMGatewayRequest['promptBudgetSummary'],
    providerId: string,
    modelId: string,
    maxTokens: number | undefined,
  ): string[] {
    if (!promptBudgetSummary) return []
    const capability = this.modelCapabilitiesByKey.get(`${providerId}/${modelId}`)
    if (!capability) {
      return ['model_capability_missing']
    }
    const warnings: string[] = []
    const outputReserve = promptBudgetSummary.request_envelope.output_reserve
    const estimatedTotal = promptBudgetSummary.rendered_prompt_tokens_estimate
      ?? promptBudgetSummary.decision.estimated_total_input
    if (estimatedTotal + outputReserve > capability.input_window_tokens) {
      warnings.push('prompt_budget_window_mismatch')
    }
    if (
      capability.recommended_operating_input_tokens &&
      estimatedTotal > capability.recommended_operating_input_tokens
    ) {
      warnings.push('prompt_budget_above_recommended_operating_input')
    }
    if (maxTokens && maxTokens > capability.max_output_tokens) {
      warnings.push('requested_output_exceeds_model_capability')
    }
    return warnings
  }

  private estimateCost(
    providerId: string,
    modelId: string,
    usage: LlmTokenUsage,
  ): number {
    const pricing = this.pricingByProviderModelKey.get(`${providerId}/${modelId}`) ?? DEFAULT_PRICING
    return (
      (usage.prompt_tokens / 1000) * pricing.prompt +
      (usage.completion_tokens / 1000) * pricing.completion
    )
  }

  private resolveExecutionPolicy(
    profile: ModelProfileEntry,
    request: LLMGatewayRequest,
  ): ExecutionPolicyEntry {
    const defaultPolicyId = profile.policy_id ?? defaultExecutionPolicyId(profile)
    const defaultPolicy = this.executionPoliciesById.get(defaultPolicyId)
    if (!defaultPolicy) {
      throw new LLMGatewayContractError(
        'RegistryResolutionError',
        `Execution policy ${defaultPolicyId} not found in registry bundle`,
        { profile_id: profile.profile_id, policy_id: defaultPolicyId },
      )
    }

    const expectedLane = defaultExecutionLane(profile)
    if (defaultPolicy.lane !== expectedLane) {
      throw new LLMGatewayContractError(
        'RegistryResolutionError',
        `Execution policy ${defaultPolicy.policy_id} lane does not match profile ${profile.profile_id}`,
        {
          profile_id: profile.profile_id,
          expected_lane: expectedLane,
          actual_lane: defaultPolicy.lane,
        },
      )
    }

    const requestedPolicyId = request.localOverrides?.executionPolicyId
    if (!requestedPolicyId) {
      this.assertPolicyMatchesRequest(defaultPolicy, request, profile.profile_id)
      return defaultPolicy
    }

    if (!defaultPolicy.merge.allow_callsite_override_fields.includes('executionPolicyId')) {
      throw new LLMGatewayContractError(
        'InvalidRequestError',
        `Execution policy override is not allowed for profile ${profile.profile_id}`,
        {
          profile_id: profile.profile_id,
          requested_policy_id: requestedPolicyId,
        },
      )
    }

    const requestedPolicy = this.executionPoliciesById.get(requestedPolicyId)
    if (!requestedPolicy) {
      throw new LLMGatewayContractError(
        'RegistryResolutionError',
        `Execution policy ${requestedPolicyId} not found in registry bundle`,
        { profile_id: profile.profile_id, policy_id: requestedPolicyId },
      )
    }
    if (requestedPolicy.lane !== expectedLane) {
      throw new LLMGatewayContractError(
        'InvalidRequestError',
        `Execution policy ${requestedPolicyId} does not belong to lane ${expectedLane}`,
        {
          profile_id: profile.profile_id,
          policy_id: requestedPolicyId,
          expected_lane: expectedLane,
          actual_lane: requestedPolicy.lane,
        },
      )
    }

    this.assertPolicyMatchesRequest(requestedPolicy, request, profile.profile_id)
    return requestedPolicy
  }

  private assertPolicyMatchesRequest(
    policy: ExecutionPolicyEntry,
    request: LLMGatewayRequest,
    profileId: string,
  ): void {
    if (policy.modality !== request.modality || policy.response_mode !== request.responseMode) {
      throw new LLMGatewayContractError(
        'InvalidRequestError',
        `Execution policy ${policy.policy_id} does not match request contract`,
        {
          profile_id: profileId,
          policy_id: policy.policy_id,
          request_modality: request.modality,
          request_response_mode: request.responseMode,
          policy_modality: policy.modality,
          policy_response_mode: policy.response_mode,
        },
      )
    }
  }

  private resolveExecutionParams(input: {
    request: LLMGatewayRequest
    executionPolicy: ExecutionPolicyEntry
    provider: ProviderRegistryEntry
    adapterBinding: AdapterBinding
    modelCapability: ModelCapabilityEntry
  }): ExecutionParamResolution {
    const {
      request,
      executionPolicy,
      provider,
      adapterBinding,
      modelCapability,
    } = input
    const callsiteFields = collectPresentOverrideFields(request.localOverrides)
    const debugFields = collectPresentOverrideFields(request.debug)
    const disallowedCallsiteFields = callsiteFields.filter(
      (field) => !executionPolicy.merge.allow_callsite_override_fields.includes(field),
    )
    const disallowedDebugFields = debugFields.filter(
      (field) => !executionPolicy.merge.allow_debug_override_fields.includes(field),
    )

    if (disallowedCallsiteFields.length > 0) {
      throw new LLMGatewayContractError(
        'InvalidRequestError',
        `Callsite override fields are not allowed by execution policy ${executionPolicy.policy_id}`,
        {
          policy_id: executionPolicy.policy_id,
          fields: disallowedCallsiteFields,
        },
      )
    }
    if (disallowedDebugFields.length > 0) {
      throw new LLMGatewayContractError(
        'InvalidRequestError',
        `Debug override fields are not allowed by execution policy ${executionPolicy.policy_id}`,
        {
          policy_id: executionPolicy.policy_id,
          fields: disallowedDebugFields,
        },
      )
    }
    if (!adapterBinding.providerGatewayKinds.includes(provider.gateway_kind)) {
      throw new LLMGatewayContractError(
        'RegistryResolutionError',
        `Adapter ${adapterBinding.adapterId} does not support provider gateway kind ${provider.gateway_kind}`,
        {
          adapter_id: adapterBinding.adapterId,
          provider_id: provider.provider_id,
          gateway_kind: provider.gateway_kind,
        },
      )
    }

    const policyDefaults: Partial<ResolvedExecutionParams> = {
      modality: executionPolicy.modality,
      responseMode: executionPolicy.response_mode,
      temperature: executionPolicy.defaults.temperature,
      maxTokens: executionPolicy.defaults.max_tokens,
      stop: executionPolicy.defaults.stop,
      timeoutMs: executionPolicy.defaults.timeout_ms ?? provider.defaults.timeout_ms,
      maxRetries: executionPolicy.defaults.max_retries ?? provider.defaults.max_retries,
    }
    const callsiteOverrides = sanitizeResolvedOverrides({
      temperature: request.localOverrides?.temperature,
      maxTokens: request.localOverrides?.maxTokens,
      stop: request.localOverrides?.stop,
      timeoutMs: request.localOverrides?.timeoutMs,
      maxRetries: request.localOverrides?.maxRetries,
      regionHint: request.localOverrides?.regionHint,
    })
    const debugOverrides = sanitizeResolvedOverrides({
      temperature: request.debug?.temperature,
      maxTokens: request.debug?.maxTokens,
      stop: request.debug?.stop,
      timeoutMs: request.debug?.timeoutMs,
      maxRetries: request.debug?.maxRetries,
      regionHint: request.debug?.regionHint,
    })
    const hardCaps: Partial<ResolvedExecutionParams> = {
      modality: request.modality,
      responseMode: request.responseMode,
      maxTokens: modelCapability.max_output_tokens,
      timeoutMs: provider.defaults.timeout_ms,
      maxRetries: provider.defaults.max_retries,
    }

    const resolvedParams: ResolvedExecutionParams = {
      modality: request.modality,
      responseMode: request.responseMode,
      temperature: policyDefaults.temperature,
      maxTokens: policyDefaults.maxTokens,
      stop: policyDefaults.stop,
      timeoutMs: policyDefaults.timeoutMs ?? provider.defaults.timeout_ms,
      maxRetries: policyDefaults.maxRetries ?? provider.defaults.max_retries,
      regionHint: undefined,
    }
    const warnings: string[] = []

    if (callsiteOverrides.temperature !== undefined) resolvedParams.temperature = callsiteOverrides.temperature
    if (callsiteOverrides.maxTokens !== undefined) resolvedParams.maxTokens = callsiteOverrides.maxTokens
    if (callsiteOverrides.stop !== undefined) resolvedParams.stop = callsiteOverrides.stop
    if (callsiteOverrides.timeoutMs !== undefined) resolvedParams.timeoutMs = callsiteOverrides.timeoutMs
    if (callsiteOverrides.maxRetries !== undefined) resolvedParams.maxRetries = callsiteOverrides.maxRetries
    if (callsiteOverrides.regionHint !== undefined) resolvedParams.regionHint = callsiteOverrides.regionHint

    if (debugOverrides.temperature !== undefined) resolvedParams.temperature = debugOverrides.temperature
    if (debugOverrides.maxTokens !== undefined) resolvedParams.maxTokens = debugOverrides.maxTokens
    if (debugOverrides.stop !== undefined) resolvedParams.stop = debugOverrides.stop
    if (debugOverrides.timeoutMs !== undefined) resolvedParams.timeoutMs = debugOverrides.timeoutMs
    if (debugOverrides.maxRetries !== undefined) resolvedParams.maxRetries = debugOverrides.maxRetries
    if (debugOverrides.regionHint !== undefined) resolvedParams.regionHint = debugOverrides.regionHint

    if (resolvedParams.temperature !== undefined) {
      const clampedTemperature = clampTemperature(resolvedParams.temperature)
      if (clampedTemperature !== resolvedParams.temperature) {
        warnings.push('temperature_capped_to_supported_range')
        resolvedParams.temperature = clampedTemperature
      }
    }
    if (resolvedParams.maxTokens !== undefined && resolvedParams.maxTokens > modelCapability.max_output_tokens) {
      warnings.push('max_tokens_capped_to_model_capability')
      resolvedParams.maxTokens = modelCapability.max_output_tokens
    }
    if (resolvedParams.timeoutMs > provider.defaults.timeout_ms) {
      warnings.push('timeout_ms_capped_to_provider_default')
      resolvedParams.timeoutMs = provider.defaults.timeout_ms
    }
    if (resolvedParams.maxRetries > provider.defaults.max_retries) {
      warnings.push('max_retries_capped_to_provider_default')
      resolvedParams.maxRetries = provider.defaults.max_retries
    }

    return {
      resolvedParams,
      mergeTrace: {
        hardCaps,
        policyDefaults,
        callsiteOverrides,
        debugOverrides,
        appliedOverrideFields: dedupeOverrideFields([
          ...callsiteFields,
          ...debugFields,
        ]),
      },
      warnings,
    }
  }

  private isFallbackAllowed(
    level: RoutingFallbackLevel,
    request: LLMGatewayRequest,
    policy: ExecutionPolicyEntry,
  ): boolean {
    if (!policy.fallback.allowed_fallback_levels.includes(level)) return false
    if (level === 'none') return false
    if (
      level === 'same-line' &&
      (!policy.fallback.allow_fallback_within_line || !request.allowFallbackWithinLine)
    ) {
      return false
    }
    if (
      (level === 'cross-family-hidden' || level === 'rare-reanchor') &&
      (!policy.fallback.allow_cross_family || !request.allowCrossFamily || request.visibility !== 'hidden')
    ) {
      return false
    }
    return true
  }

  private resolveProvider(providerId: string): ProviderRegistryEntry {
    const provider = this.providersById.get(providerId)
    if (!provider) {
      throw new LLMGatewayContractError(
        'RegistryResolutionError',
        `Unknown provider ${providerId}`,
        { provider_id: providerId },
      )
    }
    return provider
  }

  private resolveAdapterBinding(adapterId: string): AdapterBinding {
    const binding = this.adapterBindingsById.get(adapterId)
    if (!binding) {
      throw new LLMGatewayContractError(
        'RegistryResolutionError',
        `Unsupported adapter binding: ${adapterId}`,
        { adapter_id: adapterId },
      )
    }
    return binding
  }

  private resolveModelCapability(providerId: string, modelId: string): ModelCapabilityEntry {
    const capability = this.modelCapabilitiesByKey.get(`${providerId}/${modelId}`)
    if (!capability) {
      throw new LLMGatewayContractError(
        'RegistryResolutionError',
        `Model capability missing for ${providerId}/${modelId}`,
        {
          provider_id: providerId,
          model_id: modelId,
        },
      )
    }
    return capability
  }

  private resolveRegionHint(
    request: LLMGatewayRequest,
    executionPolicy: ExecutionPolicyEntry,
  ): string | undefined {
    if (
      request.debug?.regionHint !== undefined &&
      executionPolicy.merge.allow_debug_override_fields.includes('regionHint')
    ) {
      return request.debug.regionHint
    }
    if (
      request.localOverrides?.regionHint !== undefined &&
      executionPolicy.merge.allow_callsite_override_fields.includes('regionHint')
    ) {
      return request.localOverrides.regionHint
    }
    return undefined
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
  const prompt_tokens = estimateRenderedPromptTokens(messages)
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
    modality: request.modality,
    responseMode: request.responseMode,
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
    policyTags: request.policyTags,
    localOverrides: request.localOverrides,
    debug: request.debug,
  }
}

function buildRouteContext(request: LLMGatewayRequest): RouteContext {
  return {
    intent: request.intent,
    visibility: request.visibility,
    scene: request.scene,
    modality: request.modality,
    responseMode: request.responseMode,
    agentId: request.agentId,
    homeVoiceLineId: request.homeVoiceLineId,
    requestedTier: request.requestedTier,
    budgetClass: request.budgetClass,
    traceId: request.traceId,
    providerTags: request.providerTags,
    policyTags: request.policyTags,
    preferredModelId: request.preferredModelId,
    regionHint: request.debug?.regionHint ?? request.localOverrides?.regionHint,
    debug: request.debug,
  }
}

function buildFallbackChain(routePlan: RouteCandidate[]): FallbackStep[] {
  return routePlan.flatMap((route) => (route.fallbackStep ? [route.fallbackStep] : []))
}

function prioritizeCandidates(input: {
  candidates: ModelProfileEntry['candidates']
  preferredModelId: string | undefined
  routeOrder: RouteCandidate['routingPolicy']['route_order']
  route: RouteCandidate
  request: LLMGatewayRequest
  providersById: Map<string, ProviderRegistryEntry>
  modelCapabilitiesByKey: Map<string, ModelCapabilityEntry>
  adapterBindingsById: Map<string, AdapterBinding>
  credentialPools: LlmRegistryBundle['credentialPools']['pools']
  regionHint?: string
}): ModelProfileEntry['candidates'] {
  const { candidates, preferredModelId, routeOrder } = input
  return [...candidates].sort((a, b) => {
    const aPreferred = preferredModelId !== undefined && a.model_id === preferredModelId
    const bPreferred = preferredModelId !== undefined && b.model_id === preferredModelId
    if (aPreferred !== bPreferred) {
      return aPreferred ? -1 : 1
    }

    for (const step of routeOrder) {
      const comparison = compareCandidatesByStep(a, b, step, input)
      if (comparison !== 0) {
        return comparison
      }
    }

    return (
      b.weight - a.weight ||
      a.provider_id.localeCompare(b.provider_id) ||
      a.model_id.localeCompare(b.model_id)
    )
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

function compareCandidatesByStep(
  a: ModelProfileEntry['candidates'][number],
  b: ModelProfileEntry['candidates'][number],
  step: RoutingOrderStep,
  input: {
    route: RouteCandidate
    request: LLMGatewayRequest
    providersById: Map<string, ProviderRegistryEntry>
    modelCapabilitiesByKey: Map<string, ModelCapabilityEntry>
    adapterBindingsById: Map<string, AdapterBinding>
    credentialPools: LlmRegistryBundle['credentialPools']['pools']
    regionHint?: string
  },
): number {
  switch (step) {
    case 'intent_scene_fit':
      return (
        candidateIntentSceneFitScore(b, input) -
        candidateIntentSceneFitScore(a, input)
      )
    case 'voice_line_tier':
      return (
        candidateVoiceLineTierScore(b, input.route.profile.tier) -
        candidateVoiceLineTierScore(a, input.route.profile.tier)
      )
    case 'profile_candidates':
      return b.weight - a.weight
    case 'region_policy':
      return (
        candidateRegionPolicyScore(b, input.providersById, input.regionHint) -
        candidateRegionPolicyScore(a, input.providersById, input.regionHint)
      )
    case 'headroom':
      return (
        candidateHeadroomScore(b, input.request, input.credentialPools) -
        candidateHeadroomScore(a, input.request, input.credentialPools)
      )
    case 'health':
      return (
        candidateHealthScore(b, input.request, input.credentialPools) -
        candidateHealthScore(a, input.request, input.credentialPools)
      )
    default:
      return 0
  }
}

function candidateIntentSceneFitScore(
  candidate: ModelProfileEntry['candidates'][number],
  input: {
    request: LLMGatewayRequest
    providersById: Map<string, ProviderRegistryEntry>
    modelCapabilitiesByKey: Map<string, ModelCapabilityEntry>
    adapterBindingsById: Map<string, AdapterBinding>
  },
): number {
  const provider = input.providersById.get(candidate.provider_id)
  const adapter = input.adapterBindingsById.get(candidate.adapter_id ?? defaultAdapterId(candidate))
  const capability = input.modelCapabilitiesByKey.get(`${candidate.provider_id}/${candidate.model_id}`)
  let score = 0

  if (provider?.capabilities.chat) score += 2
  if (adapter?.supports.chat) score += 2
  if (provider && adapter?.providerGatewayKinds.includes(provider.gateway_kind)) score += 2

  if (input.request.modality === 'vision') {
    if (adapter?.supports.vision) score += 4
    if (capability?.modalities?.includes('vision')) score += 4
  } else {
    if (supportsModality(capability, 'text')) score += 3
  }

  switch (input.request.responseMode) {
    case 'json_object':
      if (provider?.capabilities.json_mode) score += 3
      if (adapter?.supports.jsonMode) score += 3
      if (supportsResponseMode(provider, adapter, capability, 'json_object')) score += 3
      break
    case 'json_schema':
      if (adapter?.supports.structuredOutput) score += 3
      if (supportsResponseMode(provider, adapter, capability, 'json_schema')) score += 3
      break
    case 'tool':
      if (provider?.capabilities.tool_calling) score += 3
      if (adapter?.supports.toolCalling) score += 3
      if (supportsResponseMode(provider, adapter, capability, 'tool')) score += 3
      break
    case 'text':
    default:
      if (supportsResponseMode(provider, adapter, capability, 'text')) score += 2
      break
  }

  return score
}

function candidateVoiceLineTierScore(
  candidate: ModelProfileEntry['candidates'][number],
  tier: RenderTier,
): number {
  return QUALITY_SCORE_BY_TIER[tier][candidate.quality_class] ?? 0
}

function candidateRegionPolicyScore(
  candidate: ModelProfileEntry['candidates'][number],
  providersById: Map<string, ProviderRegistryEntry>,
  regionHint?: string,
): number {
  const provider = providersById.get(candidate.provider_id)
  if (regionHint) {
    if (candidate.region === regionHint) return 3
    if (provider?.routing.default_region === candidate.region) return 2
    return 1
  }
  if (provider?.routing.default_region === candidate.region) return 2
  return 1
}

function candidateHeadroomScore(
  candidate: ModelProfileEntry['candidates'][number],
  request: Pick<LLMGatewayRequest, 'visibility' | 'budgetClass' | 'providerTags'>,
  credentialPools: LlmRegistryBundle['credentialPools']['pools'],
): number {
  const pools = findUsableCredentialPoolsForCandidate({
    candidate,
    credentialPools,
    visibility: request.visibility,
    budgetClass: request.budgetClass,
    tags: request.providerTags,
  })
  if (pools.length === 0) return 0
  return Math.max(...pools.map((pool) => (pool.rpm_headroom ?? 0) + (pool.tpm_headroom ?? 0)))
}

function candidateHealthScore(
  candidate: ModelProfileEntry['candidates'][number],
  request: Pick<LLMGatewayRequest, 'visibility' | 'budgetClass' | 'providerTags'>,
  credentialPools: LlmRegistryBundle['credentialPools']['pools'],
): number {
  const pools = findUsableCredentialPoolsForCandidate({
    candidate,
    credentialPools,
    visibility: request.visibility,
    budgetClass: request.budgetClass,
    tags: request.providerTags,
  })
  if (pools.length === 0) return 0
  return Math.max(...pools.map((pool) => {
    switch (pool.health) {
      case 'healthy':
        return 3
      case 'degraded':
        return 2
      case 'blocked':
        return 1
      default:
        return 0
    }
  }))
}

function buildExecutionPlan(input: {
  context: RouteContext
  route: RouteCandidate
  orderedCandidates: ModelProfileEntry['candidates']
  selectedCandidate: InferenceExecutionPlan['selectedCandidate']
  selectedAdapter: AdapterBinding
  selectedCredential: CredentialBinding
  fallbackChain: FallbackStep[]
  fallbackHistory: FallbackHistoryEntry[]
  resolvedParams: ResolvedExecutionParams
  mergeTrace: ExecutionParamMergeTrace
  warnings: string[]
}): InferenceExecutionPlan {
  const {
    context,
    route,
    orderedCandidates,
    selectedCandidate,
    selectedAdapter,
    selectedCredential,
    fallbackChain,
    fallbackHistory,
    resolvedParams,
    mergeTrace,
    warnings,
  } = input
  return {
    planId: `plan:${context.traceId}`,
    context,
    profileId: route.profile.profile_id,
    policy: route.executionPolicy,
    orderedCandidates: orderedCandidates.map(mapExecutionPlanCandidate),
    selectedCandidate,
    selectedAdapter,
    selectedCredential,
    routeOrder: route.routingPolicy.route_order,
    fallbackLevel: route.fallbackLevel,
    fallbackChain,
    fallbackHistory: [...fallbackHistory],
    resolvedParams,
    mergeTrace,
    warnings: dedupeWarnings(warnings),
  }
}

function mapExecutionPlanCandidate(
  candidate: ModelProfileEntry['candidates'][number],
): InferenceExecutionPlan['orderedCandidates'][number] {
  const adapterId = candidate.adapter_id ?? defaultAdapterId(candidate)
  return {
    candidateId: `${candidate.provider_id}/${candidate.model_id}/${candidate.region}/${candidate.endpoint_id}/${adapterId}`,
    providerId: candidate.provider_id,
    modelId: candidate.model_id,
    adapterId,
    region: candidate.region,
    endpointId: candidate.endpoint_id,
    weight: candidate.weight,
    qualityClass: candidate.quality_class,
  }
}

function buildCredentialBinding(
  pool: LlmRegistryBundle['credentialPools']['pools'][number],
): CredentialBinding {
  return {
    credentialId: pool.credential_id,
    providerId: pool.provider_id,
    region: pool.region,
    endpointId: pool.endpoint_id,
    endpoint: pool.endpoint,
    secretRef: pool.credential_ref,
    priority: pool.priority,
    health: pool.health,
    scopeTags: pool.scope_tags,
    allowedModelIds: pool.allowed_model_ids,
    rpmHeadroom: pool.rpm_headroom,
    tpmHeadroom: pool.tpm_headroom,
  }
}

function matchesDebugPins(
  candidate: ModelProfileEntry['candidates'][number],
  debug: LLMGatewayRequest['debug'],
): boolean {
  if (!debug) return true
  const adapterId = candidate.adapter_id ?? defaultAdapterId(candidate)
  if (debug.providerPin && candidate.provider_id !== debug.providerPin) return false
  if (debug.modelPin && candidate.model_id !== debug.modelPin) return false
  if (debug.adapterPin && adapterId !== debug.adapterPin) return false
  return true
}

function supportsModality(
  capability: ModelCapabilityEntry | undefined,
  modality: LLMGatewayRequest['modality'],
): boolean {
  if (!capability?.modalities?.length) {
    return modality === 'text'
  }
  return capability.modalities.includes(modality)
}

function supportsResponseMode(
  provider: ProviderRegistryEntry | undefined,
  adapter: AdapterBinding | undefined,
  capability: ModelCapabilityEntry | undefined,
  responseMode: LLMGatewayRequest['responseMode'],
): boolean {
  const capabilitySupports = capability?.response_modes?.length
    ? capability.response_modes.includes(responseMode)
    : responseMode === 'text'

  switch (responseMode) {
    case 'json_object':
      return Boolean(provider?.capabilities.json_mode && adapter?.supports.jsonMode && capabilitySupports)
    case 'json_schema':
      return Boolean(adapter?.supports.structuredOutput && capabilitySupports)
    case 'tool':
      return Boolean(provider?.capabilities.tool_calling && adapter?.supports.toolCalling && capabilitySupports)
    case 'text':
    default:
      return capabilitySupports
  }
}

function collectPresentOverrideFields(
  overrides: LLMGatewayRequest['localOverrides'] | LLMGatewayRequest['debug'] | undefined,
): LLMGatewayOverrideField[] {
  if (!overrides) return []
  const fields: LLMGatewayOverrideField[] = []
  if ('executionPolicyId' in overrides && overrides.executionPolicyId !== undefined) {
    fields.push('executionPolicyId')
  }
  if (overrides.temperature !== undefined) fields.push('temperature')
  if (overrides.maxTokens !== undefined) fields.push('maxTokens')
  if (overrides.stop !== undefined) fields.push('stop')
  if (overrides.timeoutMs !== undefined) fields.push('timeoutMs')
  if (overrides.maxRetries !== undefined) fields.push('maxRetries')
  if (overrides.regionHint !== undefined) fields.push('regionHint')
  return fields
}

function sanitizeResolvedOverrides(
  overrides: Partial<ResolvedExecutionParams>,
): Partial<ResolvedExecutionParams> {
  const output: Partial<ResolvedExecutionParams> = {}
  if (overrides.temperature !== undefined) output.temperature = overrides.temperature
  if (overrides.maxTokens !== undefined) output.maxTokens = overrides.maxTokens
  if (overrides.stop !== undefined) output.stop = overrides.stop
  if (overrides.timeoutMs !== undefined) output.timeoutMs = overrides.timeoutMs
  if (overrides.maxRetries !== undefined) output.maxRetries = overrides.maxRetries
  if (overrides.regionHint !== undefined) output.regionHint = overrides.regionHint
  return output
}

function dedupeWarnings(warnings: string[]): string[] {
  return Array.from(new Set(warnings))
}

function dedupeOverrideFields(fields: LLMGatewayOverrideField[]): LLMGatewayOverrideField[] {
  return Array.from(new Set(fields))
}

function clampTemperature(temperature: number): number {
  return Math.min(2, Math.max(0, temperature))
}
