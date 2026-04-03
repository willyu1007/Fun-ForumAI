import { describe, expect, it, vi } from 'vitest'
import { BudgetGuard } from '../budget-guard.js'
import { CredentialBroker } from '../credential-broker.js'
import { LLMGateway } from '../llm-gateway.js'
import { LlmClient } from '../llm-client.js'
import type { LlmRegistryBundle } from '../registry-loader.js'
import { UsageLedgerWriter } from '../usage-ledger.js'

function buildBundle(): LlmRegistryBundle {
  return {
    providers: {
      version: 1,
      providers: [
        {
          provider_id: 'dashscope-openai',
          display_name: 'DashScope',
          gateway_kind: 'openai_compatible',
          auth: {
            type: 'api_key',
            source: 'credential_pool',
            auth_strategy: 'bearer_api_key',
          },
          routing: {
            regions: ['cn-beijing'],
            default_region: 'cn-beijing',
          },
          capabilities: {
            chat: true,
            json_mode: true,
            tool_calling: false,
            streaming: false,
          },
          defaults: {
            timeout_ms: 30_000,
            max_retries: 2,
          },
        },
      ],
    },
    modelProfiles: {
      version: 1,
      profiles: [
        {
          profile_id: 'qwen-social-proactive-opening-base',
          voice_line_id: 'qwen-social-v1',
          tier: 'base',
          intent: 'proactive_opening',
          visibility: 'visible',
          candidates: [
            {
              provider_id: 'dashscope-openai',
              model_id: 'qwen-plus-character',
              region: 'cn-beijing',
              endpoint_id: 'dashscope-cn-beijing',
              weight: 100,
              quality_class: 'balanced',
            },
            {
              provider_id: 'dashscope-openai',
              model_id: 'qwen-flash-character',
              region: 'cn-beijing',
              endpoint_id: 'dashscope-cn-beijing',
              weight: 80,
              quality_class: 'fast',
            },
          ],
          fallback: [
            {
              level: 'same-line',
              profile_id: 'qwen-social-proactive-opening-premium',
              reason: 'raise quality inside the same line',
            },
          ],
        },
        {
          profile_id: 'qwen-social-proactive-opening-premium',
          voice_line_id: 'qwen-social-v1',
          tier: 'premium',
          intent: 'proactive_opening',
          visibility: 'visible',
          candidates: [
            {
              provider_id: 'dashscope-openai',
              model_id: 'qwen-max',
              region: 'cn-beijing',
              endpoint_id: 'dashscope-cn-beijing',
              weight: 100,
              quality_class: 'premium',
            },
          ],
          fallback: [],
        },
        {
          profile_id: 'qwen-social-identity-write-base',
          voice_line_id: 'qwen-social-v1',
          tier: 'base',
          intent: 'identity_write',
          visibility: 'identity_write',
          candidates: [
            {
              provider_id: 'dashscope-openai',
              model_id: 'qwen-plus-character',
              region: 'cn-beijing',
              endpoint_id: 'dashscope-cn-beijing',
              weight: 100,
              quality_class: 'balanced',
            },
            {
              provider_id: 'dashscope-openai',
              model_id: 'qwen-flash-character',
              region: 'cn-beijing',
              endpoint_id: 'dashscope-cn-beijing',
              weight: 60,
              quality_class: 'fast',
            },
          ],
          fallback: [],
        },
        {
          profile_id: 'qwen-social-identity-write-premium',
          voice_line_id: 'qwen-social-v1',
          tier: 'premium',
          intent: 'identity_write',
          visibility: 'identity_write',
          candidates: [
            {
              provider_id: 'dashscope-openai',
              model_id: 'qwen-max',
              region: 'cn-beijing',
              endpoint_id: 'dashscope-cn-beijing',
              weight: 100,
              quality_class: 'premium',
            },
            {
              provider_id: 'dashscope-openai',
              model_id: 'qwen-plus-character',
              region: 'cn-beijing',
              endpoint_id: 'dashscope-cn-beijing',
              weight: 80,
              quality_class: 'balanced',
            },
          ],
          fallback: [],
        },
      ],
    },
    promptTemplates: {
      version: 1,
      templates: [],
    },
    credentialPools: {
      version: 1,
      pools: [
        {
          credential_id: 'dashscope-premium-only',
          provider_id: 'dashscope-openai',
          region: 'cn-beijing',
          endpoint_id: 'dashscope-cn-beijing',
          endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
          credential_ref: 'secret-ref:llm_api_default',
          priority: 10,
          health: 'healthy',
          enabled: true,
          scope_tags: ['visible'],
          allowed_model_ids: ['qwen-max'],
        },
      ],
    },
    routingPolicies: {
      version: 1,
      policies: [
        {
          profile_id: 'qwen-social-proactive-opening-base',
          route_order: [
            'intent_scene_fit',
            'voice_line_tier',
            'profile_candidates',
            'region_policy',
            'headroom',
            'health',
          ],
        },
        {
          profile_id: 'qwen-social-proactive-opening-premium',
          route_order: [
            'intent_scene_fit',
            'voice_line_tier',
            'profile_candidates',
            'region_policy',
            'headroom',
            'health',
          ],
        },
        {
          profile_id: 'qwen-social-identity-write-base',
          route_order: [
            'intent_scene_fit',
            'voice_line_tier',
            'profile_candidates',
            'region_policy',
            'headroom',
            'health',
          ],
        },
        {
          profile_id: 'qwen-social-identity-write-premium',
          route_order: [
            'intent_scene_fit',
            'voice_line_tier',
            'profile_candidates',
            'region_policy',
            'headroom',
            'health',
          ],
        },
      ],
    },
    executionPolicies: {
      version: 1,
      policies: [
        {
          policy_id: 'visible-proactive_opening-base',
          lane: 'visible_proactive_opening',
          modality: 'text',
          response_mode: 'text',
          defaults: {
            temperature: 0.8,
            max_tokens: 320,
            timeout_ms: 30_000,
            max_retries: 2,
          },
          fallback: {
            allow_fallback_within_line: true,
            allow_cross_family: false,
            allowed_fallback_levels: ['none', 'same-line'],
          },
          merge: {
            allow_callsite_override_fields: ['executionPolicyId', 'temperature', 'maxTokens', 'stop', 'regionHint'],
            allow_debug_override_fields: ['temperature', 'maxTokens', 'stop', 'timeoutMs', 'maxRetries', 'regionHint'],
          },
        },
        {
          policy_id: 'visible-proactive_opening-premium',
          lane: 'visible_proactive_opening',
          modality: 'text',
          response_mode: 'text',
          defaults: {
            temperature: 0.78,
            max_tokens: 420,
            timeout_ms: 30_000,
            max_retries: 2,
          },
          fallback: {
            allow_fallback_within_line: true,
            allow_cross_family: false,
            allowed_fallback_levels: ['none'],
          },
          merge: {
            allow_callsite_override_fields: ['executionPolicyId', 'temperature', 'maxTokens', 'stop', 'regionHint'],
            allow_debug_override_fields: ['temperature', 'maxTokens', 'stop', 'timeoutMs', 'maxRetries', 'regionHint'],
          },
        },
        {
          policy_id: 'identity_write-identity_write-base',
          lane: 'identity_write',
          modality: 'text',
          response_mode: 'json_object',
          defaults: {
            temperature: 0.35,
            max_tokens: 600,
            timeout_ms: 30_000,
            max_retries: 2,
          },
          fallback: {
            allow_fallback_within_line: false,
            allow_cross_family: false,
            allowed_fallback_levels: ['none'],
          },
          merge: {
            allow_callsite_override_fields: ['executionPolicyId', 'temperature', 'maxTokens', 'stop', 'regionHint'],
            allow_debug_override_fields: ['temperature', 'maxTokens', 'stop', 'timeoutMs', 'maxRetries', 'regionHint'],
          },
        },
        {
          policy_id: 'identity_write-identity_write-premium',
          lane: 'identity_write',
          modality: 'text',
          response_mode: 'json_object',
          defaults: {
            temperature: 0.3,
            max_tokens: 900,
            timeout_ms: 30_000,
            max_retries: 2,
          },
          fallback: {
            allow_fallback_within_line: false,
            allow_cross_family: false,
            allowed_fallback_levels: ['none'],
          },
          merge: {
            allow_callsite_override_fields: ['executionPolicyId', 'temperature', 'maxTokens', 'stop', 'regionHint'],
            allow_debug_override_fields: ['temperature', 'maxTokens', 'stop', 'timeoutMs', 'maxRetries', 'regionHint'],
          },
        },
        {
          policy_id: 'hidden-private_digest-premium',
          lane: 'hidden_private_digest',
          modality: 'text',
          response_mode: 'json_object',
          defaults: {
            temperature: 0.22,
            max_tokens: 1200,
            timeout_ms: 30_000,
            max_retries: 2,
          },
          fallback: {
            allow_fallback_within_line: false,
            allow_cross_family: false,
            allowed_fallback_levels: ['none'],
          },
          merge: {
            allow_callsite_override_fields: ['executionPolicyId', 'temperature', 'maxTokens', 'stop', 'regionHint'],
            allow_debug_override_fields: ['temperature', 'maxTokens', 'stop', 'timeoutMs', 'maxRetries', 'regionHint'],
          },
        },
        {
          policy_id: 'hidden-vision_summary-base',
          lane: 'hidden_vision_summary',
          modality: 'vision',
          response_mode: 'json_object',
          defaults: {
            temperature: 0.2,
            max_tokens: 700,
            timeout_ms: 30_000,
            max_retries: 2,
          },
          fallback: {
            allow_fallback_within_line: false,
            allow_cross_family: false,
            allowed_fallback_levels: ['none'],
          },
          merge: {
            allow_callsite_override_fields: ['executionPolicyId', 'temperature', 'maxTokens', 'stop', 'regionHint'],
            allow_debug_override_fields: ['temperature', 'maxTokens', 'stop', 'timeoutMs', 'maxRetries', 'regionHint'],
          },
        },
      ],
    },
    adapterBindings: {
      version: 1,
      bindings: [
        {
          adapterId: 'openai-chat-completions-v1',
          requestShape: 'chat',
          transport: 'chat_completions',
          providerGatewayKinds: ['openai_compatible', 'native'],
          supports: {
            chat: true,
            vision: true,
            jsonMode: true,
            structuredOutput: false,
            toolCalling: false,
            streaming: false,
          },
          authStrategy: 'bearer_api_key',
        },
      ],
    },
    providerAdmission: {
      version: 1,
      pools: [
        {
          voice_line_id: 'qwen-social-v1',
          core_family: 'anchor',
          compare_dimensions: [
            'persona_lock',
            'emotional_continuity',
            'watchability',
            'callback_fidelity',
          ],
          candidates: [
            {
              provider_id: 'dashscope-openai',
              model_id: 'qwen-plus-character',
              admission: 'admitted',
            },
            {
              provider_id: 'dashscope-openai',
              model_id: 'qwen-flash-character',
              admission: 'admitted',
            },
            {
              provider_id: 'dashscope-openai',
              model_id: 'qwen-max',
              admission: 'admitted',
            },
          ],
        },
      ],
    },
    modelPricing: {
      version: 1,
      pricing: [],
    },
    modelCapabilities: {
      version: 1,
      capabilities: [
        {
          provider_id: 'dashscope-openai',
          model_id: 'qwen-flash-character',
          input_window_tokens: 32_768,
          max_output_tokens: 8_192,
          recommended_operating_input_tokens: 24_576,
          modalities: ['text'],
          response_modes: ['text', 'json_object'],
        },
        {
          provider_id: 'dashscope-openai',
          model_id: 'qwen-plus-character',
          input_window_tokens: 32_768,
          max_output_tokens: 8_192,
          recommended_operating_input_tokens: 24_576,
          modalities: ['text'],
          response_modes: ['text', 'json_object'],
        },
        {
          provider_id: 'dashscope-openai',
          model_id: 'qwen-max',
          input_window_tokens: 32_768,
          max_output_tokens: 8_192,
          recommended_operating_input_tokens: 24_576,
          modalities: ['text'],
          response_modes: ['text', 'json_object'],
        },
        {
          provider_id: 'dashscope-openai',
          model_id: 'qwen-vl-plus',
          input_window_tokens: 32_768,
          max_output_tokens: 8_192,
          recommended_operating_input_tokens: 24_576,
          modalities: ['text', 'vision'],
          response_modes: ['text', 'json_object'],
        },
      ],
    },
  }
}

function buildLlmClient(): LlmClient {
  return new LlmClient({
    provider: {
      provider_id: 'dashscope-openai',
      base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      api_key: 'bootstrap-key',
      timeout_ms: 30_000,
      max_retries: 2,
    },
    defaults: {
      model: 'qwen-plus-character',
      max_tokens: 512,
      temperature: 0.7,
    },
  })
}

function buildVisibleTextRequest(overrides: Record<string, unknown> = {}) {
  return {
    intent: 'proactive_opening',
    scene: 'proactive_dm',
    modality: 'text',
    responseMode: 'text',
    agentId: 'agent-1',
    homeVoiceLineId: 'qwen-social-v1',
    promptRef: { id: 'agent-proactive-dm-opening', version: 2 },
    variables: {},
    promptMessages: [{ role: 'user', content: 'open' }],
    budgetClass: 'visible_standard',
    traceId: 'trace-visible',
    requestedTier: 'base',
    allowFallbackWithinLine: true,
    allowCrossFamily: false,
    ...overrides,
  }
}

function buildIdentityWriteRequest(overrides: Record<string, unknown> = {}) {
  return {
    intent: 'identity_write',
    scene: 'background_hidden',
    modality: 'text',
    responseMode: 'json_object',
    agentId: 'agent-1',
    homeVoiceLineId: 'qwen-social-v1',
    promptRef: { id: 'internal-public-observation-identity-finalize', version: 1 },
    variables: {},
    promptMessages: [{ role: 'user', content: 'finalize' }],
    budgetClass: 'identity_write',
    traceId: 'trace-identity',
    requestedTier: 'base',
    allowFallbackWithinLine: false,
    allowCrossFamily: false,
    ...overrides,
  }
}

function buildHiddenJsonRequest(overrides: Record<string, unknown> = {}) {
  return {
    intent: 'private_digest',
    scene: 'background_hidden',
    modality: 'text',
    responseMode: 'json_object',
    agentId: 'agent-1',
    homeVoiceLineId: 'deepseek-director-v1',
    promptRef: { id: 'internal-private-chat-summary-extract', version: 1 },
    variables: {},
    promptMessages: [{ role: 'user', content: 'summarize' }],
    budgetClass: 'hidden_background',
    traceId: 'trace-hidden',
    requestedTier: 'premium',
    allowFallbackWithinLine: false,
    allowCrossFamily: false,
    ...overrides,
  }
}

function buildVisionRequest(overrides: Record<string, unknown> = {}) {
  return {
    intent: 'vision_summary',
    scene: 'background_hidden',
    modality: 'vision',
    responseMode: 'json_object',
    agentId: 'agent-1',
    homeVoiceLineId: 'deepseek-director-v1',
    promptRef: { id: 'internal-vision-summary', version: 2 },
    variables: {},
    promptMessages: [{ role: 'user', content: 'summarize image' }],
    budgetClass: 'hidden_multimodal',
    traceId: 'trace-vision',
    requestedTier: 'base',
    allowFallbackWithinLine: false,
    allowCrossFamily: false,
    ...overrides,
  }
}

function buildGatewayHarness(input?: {
  bundle?: LlmRegistryBundle
  response?: {
    content: string
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    model: string
    finish_reason: string | null
    meta?: { attempts: number }
  }
  resolveSecret?: (ref: string) => string
  budgetGuard?: BudgetGuard
}) {
  const bundle = input?.bundle ?? buildBundle()
  const usageLedger = new UsageLedgerWriter()
  const llmClient = buildLlmClient()
  const chatSpy = vi.spyOn(llmClient, 'chat').mockResolvedValue(
    input?.response ?? {
      content: 'ok',
      usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
      model: 'qwen-plus-character',
      finish_reason: 'stop',
    },
  )
  const gateway = new LLMGateway({
    bundle,
    promptEngine: { render: vi.fn() } as never,
    llmClient,
    credentialBroker: new CredentialBroker({
      bundle,
      secretResolver: { resolve: vi.fn(input?.resolveSecret ?? (() => 'secret')) } as never,
    }),
    usageLedger,
    budgetGuard: input?.budgetGuard ?? new BudgetGuard(),
  })

  return { bundle, usageLedger, llmClient, chatSpy, gateway }
}

describe('LLMGateway', () => {
  it('treats the gateway as configured only when a credential pool is usable', () => {
    const bundle = buildBundle()
    const llmClient = buildLlmClient()
    vi.spyOn(llmClient, 'chat').mockResolvedValue({
      content: 'ok',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      model: 'qwen-max',
      finish_reason: 'stop',
    })
    const gateway = new LLMGateway({
      bundle,
      promptEngine: { render: vi.fn() } as never,
      llmClient,
      credentialBroker: new CredentialBroker({
        bundle,
        secretResolver: {
          resolve: vi.fn(() => {
            throw new Error('missing secret')
          }),
        } as never,
      }),
      usageLedger: new UsageLedgerWriter(),
      budgetGuard: new BudgetGuard(),
    })

    expect(gateway.isConfigured).toBe(false)
  })

  it('falls back to a same-line profile when the initial candidate has no matching credential pool', async () => {
    const bundle = buildBundle()
    const usageLedger = new UsageLedgerWriter()
    const llmClient = buildLlmClient()
    const chatSpy = vi.spyOn(llmClient, 'chat').mockResolvedValue({
      content: 'ok',
      usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
      model: 'qwen-max',
      finish_reason: 'stop',
    })
    const gateway = new LLMGateway({
      bundle,
      promptEngine: { render: vi.fn() } as never,
      llmClient,
      credentialBroker: new CredentialBroker({
        bundle,
        secretResolver: { resolve: vi.fn(() => 'secret') } as never,
      }),
      usageLedger,
      budgetGuard: new BudgetGuard(),
    })

    const response = await gateway.generateVisibleText(buildVisibleTextRequest({
      traceId: 'trace-1',
    }))

    expect(response.renderDecision.profileId).toBe('qwen-social-proactive-opening-premium')
    expect(response.renderDecision.modelId).toBe('qwen-max')
    expect(chatSpy).toHaveBeenCalledTimes(1)
    expect(usageLedger.list()).toHaveLength(3)
    expect(usageLedger.list()[0]?.success).toBe(false)
    expect(usageLedger.list()[1]?.success).toBe(false)
    expect(usageLedger.list()[2]?.success).toBe(true)
  })

  it('fails fast when budget guard denies the request', async () => {
    const bundle = buildBundle()
    bundle.credentialPools.pools[0]!.allowed_model_ids = ['qwen-plus-character']

    const llmClient = buildLlmClient()
    const chatSpy = vi.spyOn(llmClient, 'chat')
    const gateway = new LLMGateway({
      bundle,
      promptEngine: { render: vi.fn() } as never,
      llmClient,
      credentialBroker: new CredentialBroker({
        bundle,
        secretResolver: { resolve: vi.fn(() => 'secret') } as never,
      }),
      usageLedger: new UsageLedgerWriter(),
      budgetGuard: new BudgetGuard(async () => ({ allowed: false, reason: 'quota exhausted' })),
    })

    await expect(
      gateway.generateVisibleText(buildVisibleTextRequest({
        traceId: 'trace-budget',
      })),
    ).rejects.toMatchObject({ code: 'BudgetExceededError' })

    expect(chatSpy).not.toHaveBeenCalled()
  })

  it('records platform retry accounting from the provider adapter response metadata', async () => {
    const bundle = buildBundle()
    bundle.credentialPools.pools[0]!.allowed_model_ids = ['qwen-plus-character']

    const usageLedger = new UsageLedgerWriter()
    const llmClient = buildLlmClient()
    vi.spyOn(llmClient, 'chat').mockResolvedValue({
      content: 'ok',
      usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
      model: 'qwen-plus-character',
      finish_reason: 'stop',
      meta: { attempts: 3 },
    })
    const gateway = new LLMGateway({
      bundle,
      promptEngine: { render: vi.fn() } as never,
      llmClient,
      credentialBroker: new CredentialBroker({
        bundle,
        secretResolver: { resolve: vi.fn(() => 'secret') } as never,
      }),
      usageLedger,
      budgetGuard: new BudgetGuard(),
    })

    const response = await gateway.generateVisibleText(buildVisibleTextRequest({
      traceId: 'trace-retry',
    }))

    expect(response.platformRetryCount).toBe(2)
    expect(usageLedger.list()[0]?.platform_retry_count).toBe(2)
  })

  it('applies execution policy defaults when the request omits generation params', async () => {
    const bundle = buildBundle()
    bundle.credentialPools.pools[0]!.allowed_model_ids = ['qwen-plus-character']

    const llmClient = buildLlmClient()
    const chatSpy = vi.spyOn(llmClient, 'chat').mockResolvedValue({
      content: 'policy defaults',
      usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
      model: 'qwen-plus-character',
      finish_reason: 'stop',
    })
    const gateway = new LLMGateway({
      bundle,
      promptEngine: { render: vi.fn() } as never,
      llmClient,
      credentialBroker: new CredentialBroker({
        bundle,
        secretResolver: { resolve: vi.fn(() => 'secret') } as never,
      }),
      usageLedger: new UsageLedgerWriter(),
      budgetGuard: new BudgetGuard(),
    })

    const response = await gateway.generateVisibleText(buildVisibleTextRequest({
      traceId: 'trace-policy-defaults',
    }))

    expect(chatSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.8,
        max_tokens: 320,
      }),
    )
    expect(response.executionPlan.policy.policy_id).toBe('visible-proactive_opening-base')
    expect(response.renderDecision.policyId).toBe('visible-proactive_opening-base')
  })

  it('filters incompatible candidates before ordering when intent_scene_fit requires vision json output', async () => {
    const bundle = buildBundle()
    bundle.modelProfiles.profiles.push({
      profile_id: 'deepseek-director-vision-summary-base',
      voice_line_id: 'deepseek-director-v1',
      tier: 'base',
      intent: 'vision_summary',
      visibility: 'hidden',
      candidates: [
        {
          provider_id: 'dashscope-openai',
          model_id: 'qwen-plus-character',
          region: 'cn-beijing',
          endpoint_id: 'dashscope-cn-beijing',
          weight: 120,
          quality_class: 'balanced',
        },
        {
          provider_id: 'dashscope-openai',
          model_id: 'qwen-vl-plus',
          region: 'cn-beijing',
          endpoint_id: 'dashscope-cn-beijing',
          weight: 80,
          quality_class: 'balanced',
        },
      ],
      fallback: [],
    })
    bundle.routingPolicies.policies.push({
      profile_id: 'deepseek-director-vision-summary-base',
      route_order: [
        'intent_scene_fit',
        'voice_line_tier',
        'profile_candidates',
        'region_policy',
        'headroom',
        'health',
      ],
    })
    bundle.credentialPools.pools[0]!.allowed_model_ids = ['qwen-vl-plus']
    bundle.credentialPools.pools[0]!.scope_tags = ['hidden_multimodal']

    const { gateway } = buildGatewayHarness({
      bundle,
      response: {
        content: '{"summary":"ok"}',
        usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
        model: 'qwen-vl-plus',
        finish_reason: 'stop',
      },
    })

    const response = await gateway.generateHiddenArtifact(buildVisionRequest())

    expect(response.renderDecision.modelId).toBe('qwen-vl-plus')
    expect(response.executionPlan.orderedCandidates).toHaveLength(1)
    expect(response.executionPlan.orderedCandidates[0]?.modelId).toBe('qwen-vl-plus')
  })

  it('uses voice_line_tier ordering before profile weight when requested tier is base', async () => {
    const bundle = buildBundle()
    bundle.credentialPools.pools[0]!.allowed_model_ids = [
      'qwen-plus-character',
      'qwen-flash-character',
    ]
    bundle.modelProfiles.profiles[0]!.candidates[0]!.weight = 100
    bundle.modelProfiles.profiles[0]!.candidates[1]!.weight = 100

    const { gateway } = buildGatewayHarness({
      bundle,
      response: {
        content: 'balanced wins',
        usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
        model: 'qwen-plus-character',
        finish_reason: 'stop',
      },
    })

    const response = await gateway.generateVisibleText(buildVisibleTextRequest())

    expect(response.executionPlan.orderedCandidates[0]?.modelId).toBe('qwen-plus-character')
    expect(response.executionPlan.orderedCandidates[0]?.qualityClass).toBe('balanced')
  })

  it('uses region_policy ordering from the merged region hint', async () => {
    const bundle = buildBundle()
    bundle.providers.providers[0]!.routing.regions = ['cn-beijing', 'cn-shanghai']
    bundle.providers.providers[0]!.routing.default_region = 'cn-beijing'
    bundle.modelProfiles.profiles[0]!.candidates = [
      {
        provider_id: 'dashscope-openai',
        model_id: 'qwen-plus-character',
        region: 'cn-beijing',
        endpoint_id: 'dashscope-cn-beijing',
        weight: 100,
        quality_class: 'balanced',
      },
      {
        provider_id: 'dashscope-openai',
        model_id: 'qwen-plus-character',
        region: 'cn-shanghai',
        endpoint_id: 'dashscope-cn-shanghai',
        weight: 100,
        quality_class: 'balanced',
      },
    ]
    bundle.credentialPools.pools = [
      {
        ...bundle.credentialPools.pools[0]!,
        credential_id: 'dashscope-beijing',
        region: 'cn-beijing',
        endpoint_id: 'dashscope-cn-beijing',
        allowed_model_ids: ['qwen-plus-character'],
      },
      {
        ...bundle.credentialPools.pools[0]!,
        credential_id: 'dashscope-shanghai',
        region: 'cn-shanghai',
        endpoint_id: 'dashscope-cn-shanghai',
        allowed_model_ids: ['qwen-plus-character'],
      },
    ]

    const { gateway } = buildGatewayHarness({
      bundle,
      response: {
        content: 'regional winner',
        usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
        model: 'qwen-plus-character',
        finish_reason: 'stop',
      },
    })

    const response = await gateway.generateVisibleText(buildVisibleTextRequest({
      localOverrides: {
        regionHint: 'cn-shanghai',
      },
    }))

    expect(response.renderDecision.region).toBe('cn-shanghai')
    expect(response.executionPlan.resolvedParams.regionHint).toBe('cn-shanghai')
  })

  it('uses profile_candidates weight ordering when earlier route steps tie', async () => {
    const bundle = buildBundle()
    bundle.modelProfiles.profiles[0]!.candidates = [
      {
        provider_id: 'dashscope-openai',
        model_id: 'qwen-plus-character',
        region: 'cn-beijing',
        endpoint_id: 'dashscope-cn-a',
        weight: 120,
        quality_class: 'balanced',
      },
      {
        provider_id: 'dashscope-openai',
        model_id: 'qwen-plus-character',
        region: 'cn-beijing',
        endpoint_id: 'dashscope-cn-b',
        weight: 80,
        quality_class: 'balanced',
      },
    ]
    bundle.credentialPools.pools = [
      {
        ...bundle.credentialPools.pools[0]!,
        credential_id: 'dashscope-a',
        endpoint_id: 'dashscope-cn-a',
        allowed_model_ids: ['qwen-plus-character'],
        rpm_headroom: 50,
        tpm_headroom: 50,
        health: 'healthy',
      },
      {
        ...bundle.credentialPools.pools[0]!,
        credential_id: 'dashscope-b',
        endpoint_id: 'dashscope-cn-b',
        allowed_model_ids: ['qwen-plus-character'],
        rpm_headroom: 50,
        tpm_headroom: 50,
        health: 'healthy',
      },
    ]

    const { gateway } = buildGatewayHarness({
      bundle,
      response: {
        content: 'weight winner',
        usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
        model: 'qwen-plus-character',
        finish_reason: 'stop',
      },
    })

    const response = await gateway.generateVisibleText(buildVisibleTextRequest())

    expect(response.renderDecision.endpointId).toBe('dashscope-cn-a')
    expect(response.executionPlan.orderedCandidates[0]?.endpointId).toBe('dashscope-cn-a')
  })

  it('uses headroom ordering when candidates are otherwise tied', async () => {
    const bundle = buildBundle()
    bundle.modelProfiles.profiles[0]!.candidates = [
      {
        provider_id: 'dashscope-openai',
        model_id: 'qwen-plus-character',
        region: 'cn-beijing',
        endpoint_id: 'dashscope-cn-a',
        weight: 100,
        quality_class: 'balanced',
      },
      {
        provider_id: 'dashscope-openai',
        model_id: 'qwen-plus-character',
        region: 'cn-beijing',
        endpoint_id: 'dashscope-cn-b',
        weight: 100,
        quality_class: 'balanced',
      },
    ]
    bundle.credentialPools.pools = [
      {
        ...bundle.credentialPools.pools[0]!,
        credential_id: 'dashscope-a',
        endpoint_id: 'dashscope-cn-a',
        allowed_model_ids: ['qwen-plus-character'],
        rpm_headroom: 5,
        tpm_headroom: 5,
        health: 'healthy',
      },
      {
        ...bundle.credentialPools.pools[0]!,
        credential_id: 'dashscope-b',
        endpoint_id: 'dashscope-cn-b',
        allowed_model_ids: ['qwen-plus-character'],
        rpm_headroom: 50,
        tpm_headroom: 50,
        health: 'healthy',
      },
    ]

    const { gateway } = buildGatewayHarness({
      bundle,
      response: {
        content: 'headroom winner',
        usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
        model: 'qwen-plus-character',
        finish_reason: 'stop',
      },
    })

    const response = await gateway.generateVisibleText(buildVisibleTextRequest())

    expect(response.renderDecision.endpointId).toBe('dashscope-cn-b')
    expect(response.executionPlan.orderedCandidates[0]?.endpointId).toBe('dashscope-cn-b')
  })

  it('ignores credential pools that cannot serve the candidate when ranking headroom', async () => {
    const bundle = buildBundle()
    bundle.modelProfiles.profiles[0]!.candidates = [
      {
        provider_id: 'dashscope-openai',
        model_id: 'qwen-plus-character',
        region: 'cn-beijing',
        endpoint_id: 'dashscope-cn-a',
        weight: 100,
        quality_class: 'balanced',
      },
      {
        provider_id: 'dashscope-openai',
        model_id: 'qwen-plus-character',
        region: 'cn-beijing',
        endpoint_id: 'dashscope-cn-b',
        weight: 100,
        quality_class: 'balanced',
      },
    ]
    bundle.credentialPools.pools = [
      {
        ...bundle.credentialPools.pools[0]!,
        credential_id: 'dashscope-a',
        endpoint_id: 'dashscope-cn-a',
        allowed_model_ids: ['qwen-plus-character'],
        rpm_headroom: 10,
        tpm_headroom: 10,
        health: 'healthy',
      },
      {
        ...bundle.credentialPools.pools[0]!,
        credential_id: 'dashscope-b-mismatched-model',
        endpoint_id: 'dashscope-cn-b',
        allowed_model_ids: ['qwen-max'],
        rpm_headroom: 500,
        tpm_headroom: 500,
        health: 'healthy',
      },
    ]

    const { gateway, usageLedger } = buildGatewayHarness({
      bundle,
      response: {
        content: 'usable headroom winner',
        usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
        model: 'qwen-plus-character',
        finish_reason: 'stop',
      },
    })

    const response = await gateway.generateVisibleText(buildVisibleTextRequest())

    expect(response.renderDecision.endpointId).toBe('dashscope-cn-a')
    expect(response.executionPlan.orderedCandidates[0]?.endpointId).toBe('dashscope-cn-a')
    expect(usageLedger.list()).toHaveLength(1)
  })

  it('uses health ordering when headroom ties', async () => {
    const bundle = buildBundle()
    bundle.modelProfiles.profiles[0]!.candidates = [
      {
        provider_id: 'dashscope-openai',
        model_id: 'qwen-plus-character',
        region: 'cn-beijing',
        endpoint_id: 'dashscope-cn-a',
        weight: 100,
        quality_class: 'balanced',
      },
      {
        provider_id: 'dashscope-openai',
        model_id: 'qwen-plus-character',
        region: 'cn-beijing',
        endpoint_id: 'dashscope-cn-b',
        weight: 100,
        quality_class: 'balanced',
      },
    ]
    bundle.credentialPools.pools = [
      {
        ...bundle.credentialPools.pools[0]!,
        credential_id: 'dashscope-a',
        endpoint_id: 'dashscope-cn-a',
        allowed_model_ids: ['qwen-plus-character'],
        rpm_headroom: 25,
        tpm_headroom: 25,
        health: 'degraded',
      },
      {
        ...bundle.credentialPools.pools[0]!,
        credential_id: 'dashscope-b',
        endpoint_id: 'dashscope-cn-b',
        allowed_model_ids: ['qwen-plus-character'],
        rpm_headroom: 25,
        tpm_headroom: 25,
        health: 'healthy',
      },
    ]

    const { gateway } = buildGatewayHarness({
      bundle,
      response: {
        content: 'health winner',
        usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
        model: 'qwen-plus-character',
        finish_reason: 'stop',
      },
    })

    const response = await gateway.generateVisibleText(buildVisibleTextRequest())

    expect(response.renderDecision.endpointId).toBe('dashscope-cn-b')
    expect(response.executionPlan.orderedCandidates[0]?.endpointId).toBe('dashscope-cn-b')
  })

  it('ignores non-matching scope pools when ranking health', async () => {
    const bundle = buildBundle()
    bundle.modelProfiles.profiles[0]!.candidates = [
      {
        provider_id: 'dashscope-openai',
        model_id: 'qwen-plus-character',
        region: 'cn-beijing',
        endpoint_id: 'dashscope-cn-a',
        weight: 100,
        quality_class: 'balanced',
      },
      {
        provider_id: 'dashscope-openai',
        model_id: 'qwen-plus-character',
        region: 'cn-beijing',
        endpoint_id: 'dashscope-cn-b',
        weight: 100,
        quality_class: 'balanced',
      },
    ]
    bundle.credentialPools.pools = [
      {
        ...bundle.credentialPools.pools[0]!,
        credential_id: 'dashscope-a',
        endpoint_id: 'dashscope-cn-a',
        allowed_model_ids: ['qwen-plus-character'],
        rpm_headroom: 25,
        tpm_headroom: 25,
        health: 'degraded',
      },
      {
        ...bundle.credentialPools.pools[0]!,
        credential_id: 'dashscope-b-visible',
        endpoint_id: 'dashscope-cn-b',
        allowed_model_ids: ['qwen-plus-character'],
        rpm_headroom: 25,
        tpm_headroom: 25,
        health: 'degraded',
      },
      {
        ...bundle.credentialPools.pools[0]!,
        credential_id: 'dashscope-b-hidden-only',
        endpoint_id: 'dashscope-cn-b',
        scope_tags: ['hidden'],
        allowed_model_ids: ['qwen-plus-character'],
        rpm_headroom: 25,
        tpm_headroom: 25,
        health: 'healthy',
      },
    ]

    const { gateway } = buildGatewayHarness({
      bundle,
      response: {
        content: 'usable health winner',
        usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
        model: 'qwen-plus-character',
        finish_reason: 'stop',
      },
    })

    const response = await gateway.generateVisibleText(buildVisibleTextRequest())

    expect(response.renderDecision.endpointId).toBe('dashscope-cn-a')
    expect(response.executionPlan.orderedCandidates[0]?.endpointId).toBe('dashscope-cn-a')
  })

  it('merges policy defaults, local overrides, debug overrides, and hard caps with trace output', async () => {
    const bundle = buildBundle()
    bundle.credentialPools.pools[0]!.allowed_model_ids = ['qwen-plus-character']

    const { gateway } = buildGatewayHarness({
      bundle,
      response: {
        content: 'merge trace',
        usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
        model: 'qwen-plus-character',
        finish_reason: 'stop',
      },
    })

    const response = await gateway.generateVisibleText(buildVisibleTextRequest({
      localOverrides: {
        temperature: 0.4,
        maxTokens: 200,
        regionHint: 'cn-beijing',
      },
      debug: {
        temperature: 1.2,
        maxTokens: 300,
        timeoutMs: 50_000,
        maxRetries: 9,
        regionHint: 'cn-shanghai',
      },
    }))

    expect(response.executionPlan.selectedAdapter?.adapterId).toBe('openai-chat-completions-v1')
    expect(response.executionPlan.selectedCredential?.secretRef).toBe('secret-ref:llm_api_default')
    expect(response.executionPlan.resolvedParams).toMatchObject({
      modality: 'text',
      responseMode: 'text',
      temperature: 1.2,
      maxTokens: 300,
      timeoutMs: 30_000,
      maxRetries: 2,
      regionHint: 'cn-shanghai',
    })
    expect(response.executionPlan.mergeTrace.callsiteOverrides).toMatchObject({
      temperature: 0.4,
      maxTokens: 200,
      regionHint: 'cn-beijing',
    })
    expect(response.executionPlan.mergeTrace.debugOverrides).toMatchObject({
      temperature: 1.2,
      maxTokens: 300,
      timeoutMs: 50_000,
      maxRetries: 9,
      regionHint: 'cn-shanghai',
    })
    expect(response.executionPlan.mergeTrace.appliedOverrideFields).toEqual(
      expect.arrayContaining(['temperature', 'maxTokens', 'regionHint', 'timeoutMs', 'maxRetries']),
    )
    expect(response.warnings).toEqual(
      expect.arrayContaining(['timeout_ms_capped_to_provider_default', 'max_retries_capped_to_provider_default']),
    )
  })

  it('supports direct provider/model fallback steps inside a fallback profile', async () => {
    const bundle = buildBundle()
    bundle.modelProfiles.profiles[0]!.fallback = [
      {
        level: 'same-line',
        profile_id: 'qwen-social-proactive-opening-premium',
        provider_id: 'dashscope-openai',
        model_id: 'qwen-max',
        reason: 'degrade to a known premium fallback candidate',
      },
    ]
    bundle.modelProfiles.profiles[1]!.candidates.push({
      provider_id: 'dashscope-openai',
      model_id: 'qwen-plus-character',
      region: 'cn-beijing',
      endpoint_id: 'dashscope-cn-beijing',
      weight: 120,
      quality_class: 'balanced',
    })
    bundle.credentialPools.pools[0]!.allowed_model_ids = ['qwen-max']

    const llmClient = buildLlmClient()
    const chatSpy = vi.spyOn(llmClient, 'chat').mockResolvedValue({
      content: 'direct fallback',
      usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
      model: 'qwen-max',
      finish_reason: 'stop',
    })
    const gateway = new LLMGateway({
      bundle,
      promptEngine: { render: vi.fn() } as never,
      llmClient,
      credentialBroker: new CredentialBroker({
        bundle,
        secretResolver: { resolve: vi.fn(() => 'secret') } as never,
      }),
      usageLedger: new UsageLedgerWriter(),
      budgetGuard: new BudgetGuard(),
    })

    const response = await gateway.generateVisibleText(buildVisibleTextRequest({
      traceId: 'trace-direct-fallback',
    }))

    expect(chatSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'qwen-max',
      }),
    )
    expect(response.executionPlan.orderedCandidates).toEqual([
      expect.objectContaining({
        modelId: 'qwen-max',
      }),
    ])
    expect(response.renderDecision.reasons).toContain('direct_fallback_candidate')
  })

  it('prioritizes a preferred model inside the resolved profile before falling back by weight', async () => {
    const bundle = buildBundle()
    bundle.credentialPools.pools[0]!.allowed_model_ids = [
      'qwen-plus-character',
      'qwen-flash-character',
    ]

    const usageLedger = new UsageLedgerWriter()
    const llmClient = buildLlmClient()
    const chatSpy = vi.spyOn(llmClient, 'chat').mockResolvedValue({
      content: 'flash preferred',
      usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
      model: 'qwen-flash-character',
      finish_reason: 'stop',
    })
    const gateway = new LLMGateway({
      bundle,
      promptEngine: { render: vi.fn() } as never,
      llmClient,
      credentialBroker: new CredentialBroker({
        bundle,
        secretResolver: { resolve: vi.fn(() => 'secret') } as never,
      }),
      usageLedger,
      budgetGuard: new BudgetGuard(),
    })

    const response = await gateway.generateVisibleText(buildVisibleTextRequest({
      preferredModelId: 'qwen-flash-character',
      traceId: 'trace-preferred',
    }))

    expect(chatSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'qwen-flash-character',
      }),
    )
    expect(response.renderDecision.modelId).toBe('qwen-flash-character')
    expect(response.renderDecision.reasons).toContain('preferred_model_hint')
    expect(usageLedger.list()[0]?.model_id).toBe('qwen-flash-character')
  })

  it('resolves identity-write requests from the requested tier before falling back to the voice-line default', async () => {
    const bundle = buildBundle()
    bundle.credentialPools.pools[0]!.scope_tags = ['visible', 'identity_write']
    bundle.credentialPools.pools[0]!.allowed_model_ids = ['qwen-plus-character']

    const usageLedger = new UsageLedgerWriter()
    const llmClient = buildLlmClient()
    const chatSpy = vi.spyOn(llmClient, 'chat').mockResolvedValue({
      content: '{"owner_style_pins_patch":{}}',
      usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
      model: 'qwen-plus-character',
      finish_reason: 'stop',
    })
    const gateway = new LLMGateway({
      bundle,
      promptEngine: { render: vi.fn() } as never,
      llmClient,
      credentialBroker: new CredentialBroker({
        bundle,
        secretResolver: { resolve: vi.fn(() => 'secret') } as never,
      }),
      usageLedger,
      budgetGuard: new BudgetGuard(),
    })

    const response = await gateway.generateIdentityWrite(buildIdentityWriteRequest({
      traceId: 'trace-identity-base',
    }))

    expect(chatSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'qwen-plus-character',
      }),
    )
    expect(response.renderDecision.profileId).toBe('qwen-social-identity-write-base')
    expect(response.renderDecision.modelId).toBe('qwen-plus-character')
    expect(usageLedger.list()[0]?.profile_id).toBe('qwen-social-identity-write-base')
  })

  it('filters visible shadow candidates out of the active route plan', async () => {
    const bundle = buildBundle()
    bundle.credentialPools.pools[0]!.allowed_model_ids = [
      'qwen-plus-character',
      'qwen-flash-character',
    ]
    bundle.providerAdmission.pools[0]!.candidates = [
      {
        provider_id: 'dashscope-openai',
        model_id: 'qwen-plus-character',
        admission: 'admitted',
      },
      {
        provider_id: 'dashscope-openai',
        model_id: 'qwen-flash-character',
        admission: 'shadow',
        compare_baseline_model_id: 'qwen-plus-character',
      },
      {
        provider_id: 'dashscope-openai',
        model_id: 'qwen-max',
        admission: 'admitted',
      },
    ]

    const llmClient = buildLlmClient()
    const chatSpy = vi.spyOn(llmClient, 'chat').mockResolvedValue({
      content: 'admitted only',
      usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
      model: 'qwen-plus-character',
      finish_reason: 'stop',
    })
    const gateway = new LLMGateway({
      bundle,
      promptEngine: { render: vi.fn() } as never,
      llmClient,
      credentialBroker: new CredentialBroker({
        bundle,
        secretResolver: { resolve: vi.fn(() => 'secret') } as never,
      }),
      usageLedger: new UsageLedgerWriter(),
      budgetGuard: new BudgetGuard(),
    })

    const response = await gateway.generateVisibleText(buildVisibleTextRequest({
      preferredModelId: 'qwen-flash-character',
      traceId: 'trace-admission',
    }))

    expect(chatSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'qwen-plus-character',
      }),
    )
    expect(response.renderDecision.reasons).toContain('provider_admission_pool')
    expect(response.renderDecision.reasons).toContain('provider_admission_filtered')
    expect(response.renderDecision.modelId).toBe('qwen-plus-character')
  })

  it('tries the next candidate in the same hidden profile when the preferred credential is missing', async () => {
    const bundle = buildBundle()
    bundle.providers.providers.push({
      provider_id: 'deepseek-openai',
      display_name: 'DeepSeek',
      gateway_kind: 'openai_compatible',
      auth: {
        type: 'api_key',
        source: 'credential_pool',
        auth_strategy: 'bearer_api_key',
      },
      routing: {
        regions: ['cn'],
        default_region: 'cn',
      },
      capabilities: {
        chat: true,
        json_mode: true,
        tool_calling: false,
        streaming: false,
      },
      defaults: {
        timeout_ms: 30_000,
        max_retries: 2,
      },
    })
    bundle.modelProfiles.profiles.push({
      profile_id: 'deepseek-director-private-digest-premium',
      voice_line_id: 'deepseek-director-v1',
      tier: 'premium',
      intent: 'private_digest',
      visibility: 'hidden',
      candidates: [
        {
          provider_id: 'deepseek-openai',
          model_id: 'deepseek-reasoner',
          region: 'cn',
          endpoint_id: 'deepseek-cn',
          weight: 100,
          quality_class: 'premium',
        },
        {
          provider_id: 'dashscope-openai',
          model_id: 'qwen-max',
          region: 'cn-beijing',
          endpoint_id: 'dashscope-cn-beijing',
          weight: 60,
          quality_class: 'premium',
        },
      ],
      fallback: [],
    })
    bundle.modelCapabilities.capabilities.push({
      provider_id: 'deepseek-openai',
      model_id: 'deepseek-reasoner',
      input_window_tokens: 64_000,
      max_output_tokens: 8_192,
      recommended_operating_input_tokens: 32_000,
      modalities: ['text'],
      response_modes: ['text', 'json_object'],
    })
    bundle.credentialPools.pools.push({
      credential_id: 'dashscope-hidden-default',
      provider_id: 'dashscope-openai',
      region: 'cn-beijing',
      endpoint_id: 'dashscope-cn-beijing',
      endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      credential_ref: 'secret-ref:llm_api_default',
      priority: 10,
      health: 'healthy',
      enabled: true,
      scope_tags: ['hidden'],
      allowed_model_ids: ['qwen-max'],
    })
    bundle.routingPolicies.policies.push({
      profile_id: 'deepseek-director-private-digest-premium',
      route_order: [
        'intent_scene_fit',
        'voice_line_tier',
        'profile_candidates',
        'region_policy',
        'headroom',
        'health',
      ],
    })

    const usageLedger = new UsageLedgerWriter()
    const llmClient = buildLlmClient()
    const chatSpy = vi.spyOn(llmClient, 'chat').mockResolvedValue({
      content: '{"summary_text":"ok"}',
      usage: { prompt_tokens: 12, completion_tokens: 10, total_tokens: 22 },
      model: 'qwen-max',
      finish_reason: 'stop',
    })
    const gateway = new LLMGateway({
      bundle,
      promptEngine: { render: vi.fn() } as never,
      llmClient,
      credentialBroker: new CredentialBroker({
        bundle,
        secretResolver: {
          resolve: vi.fn((ref: string) => {
            if (ref === 'secret-ref:deepseek_api_key') {
              throw new Error('Environment secret is missing: DEEPSEEK_API_KEY')
            }
            return 'dashscope-secret'
          }),
        } as never,
      }),
      usageLedger,
      budgetGuard: new BudgetGuard(),
    })

    const response = await gateway.generateHiddenArtifact(buildHiddenJsonRequest({
      traceId: 'trace-hidden-fallback',
    }))

    expect(response.renderDecision.profileId).toBe('deepseek-director-private-digest-premium')
    expect(response.renderDecision.modelId).toBe('qwen-max')
    expect(chatSpy).toHaveBeenCalledTimes(1)
    expect(usageLedger.list()).toHaveLength(2)
    expect(usageLedger.list()[0]?.success).toBe(false)
    expect(usageLedger.list()[1]?.success).toBe(true)
  })

  it('falls back from llm_api_vision to llm_api_default for hidden multimodal routing', async () => {
    const bundle = buildBundle()
    bundle.modelProfiles.profiles.push({
      profile_id: 'deepseek-director-vision-summary-base',
      voice_line_id: 'deepseek-director-v1',
      tier: 'base',
      intent: 'vision_summary',
      visibility: 'hidden',
      candidates: [
        {
          provider_id: 'dashscope-openai',
          model_id: 'qwen-vl-plus',
          region: 'cn-beijing',
          endpoint_id: 'dashscope-cn-beijing',
          weight: 100,
          quality_class: 'balanced',
        },
      ],
      fallback: [],
    })
    bundle.credentialPools.pools = [
      {
        credential_id: 'dashscope-vision-primary',
        provider_id: 'dashscope-openai',
        region: 'cn-beijing',
        endpoint_id: 'dashscope-cn-beijing',
        endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        credential_ref: 'secret-ref:llm_api_vision',
        priority: 5,
        health: 'healthy',
        enabled: true,
        scope_tags: ['hidden_multimodal'],
        allowed_model_ids: ['qwen-vl-plus'],
      },
      {
        credential_id: 'dashscope-hidden-default',
        provider_id: 'dashscope-openai',
        region: 'cn-beijing',
        endpoint_id: 'dashscope-cn-beijing',
        endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        credential_ref: 'secret-ref:llm_api_default',
        priority: 10,
        health: 'healthy',
        enabled: true,
        scope_tags: ['hidden', 'hidden_multimodal'],
        allowed_model_ids: ['qwen-vl-plus'],
      },
    ]
    bundle.routingPolicies.policies.push({
      profile_id: 'deepseek-director-vision-summary-base',
      route_order: [
        'intent_scene_fit',
        'voice_line_tier',
        'profile_candidates',
        'region_policy',
        'headroom',
        'health',
      ],
    })

    const usageLedger = new UsageLedgerWriter()
    const llmClient = buildLlmClient()
    const chatSpy = vi.spyOn(llmClient, 'chat').mockResolvedValue({
      content: '{"summary_text":"ok"}',
      usage: { prompt_tokens: 12, completion_tokens: 10, total_tokens: 22 },
      model: 'qwen-vl-plus',
      finish_reason: 'stop',
    })
    const resolveMock = vi.fn((ref: string) => {
      if (ref === 'secret-ref:llm_api_vision') {
        throw new Error('Secret ref is not declared: llm_api_vision')
      }
      return 'default-secret'
    })
    const gateway = new LLMGateway({
      bundle,
      promptEngine: { render: vi.fn() } as never,
      llmClient,
      credentialBroker: new CredentialBroker({
        bundle,
        secretResolver: {
          resolve: resolveMock,
        } as never,
      }),
      usageLedger,
      budgetGuard: new BudgetGuard(),
    })

    const response = await gateway.generateHiddenArtifact(buildVisionRequest({
      traceId: 'trace-vision-fallback',
    }))

    expect(resolveMock).toHaveBeenNthCalledWith(1, 'secret-ref:llm_api_vision')
    expect(resolveMock).toHaveBeenNthCalledWith(2, 'secret-ref:llm_api_default')
    expect(chatSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'qwen-vl-plus',
      }),
    )
    expect(response.renderDecision.profileId).toBe('deepseek-director-vision-summary-base')
    expect(response.renderDecision.modelId).toBe('qwen-vl-plus')
  })

  it('emits passive window warnings from prompt budget summary without blocking the request', async () => {
    const bundle = buildBundle()
    bundle.credentialPools.pools[0]!.allowed_model_ids = ['qwen-plus-character']

    const usageLedger = new UsageLedgerWriter()
    const llmClient = buildLlmClient()
    vi.spyOn(llmClient, 'chat').mockResolvedValue({
      content: 'ok',
      usage: { prompt_tokens: 120, completion_tokens: 40, total_tokens: 160 },
      model: 'qwen-plus-character',
      finish_reason: 'stop',
    })
    const gateway = new LLMGateway({
      bundle,
      promptEngine: { render: vi.fn() } as never,
      llmClient,
      credentialBroker: new CredentialBroker({
        bundle,
        secretResolver: { resolve: vi.fn(() => 'secret') } as never,
      }),
      usageLedger,
      budgetGuard: new BudgetGuard(),
    })

    const response = await gateway.generateVisibleText(buildVisibleTextRequest({
      traceId: 'trace-budget-summary',
      localOverrides: {
        maxTokens: 9_000,
      },
      promptBudgetSummary: {
        scene: 'proactive_dm',
        prompt_template_id: 'agent-proactive-dm-opening',
        prompt_version: 2,
        request_envelope: {
          static_system_tokens: 180,
          route_wrapper_tokens: 40,
          tool_tokens: 0,
          current_user_input_tokens: 32,
          output_reserve: 1_500,
          model_capability_ref: null,
        },
        local_layer_envelope: {
          request_target_input: 6_000,
          request_soft_ceiling: 6_900,
          request_hard_ceiling: 7_800,
          non_layer_tokens: 252,
          local_target: 5_748,
          local_soft: 6_648,
          local_hard: 7_548,
        },
        decision: {
          target_budget: 5_748,
          soft_ceiling: 6_648,
          hard_ceiling: 7_548,
          estimated_total_input: 32_000,
          actual_input_estimate: 32_000,
          control_tier_applied: 'compact',
          memory_tier_applied: 'minimal',
          bucket_tokens: {
            hard_control: 600,
            compact_control: 900,
            current_context: 2_000,
            memory: 700,
            soft_expression: 200,
          },
          bucket_survival_ratio: {
            hard_control: 1,
            compact_control: 1,
            current_context: 1,
            memory: 0.4,
            soft_expression: 0.3,
          },
          overflow_reason: 'soft_overflow_applied',
          warnings: [],
        },
      },
    }))

    expect(response.warnings).toEqual(['max_tokens_capped_to_model_capability'])
    expect(usageLedger.list()[0]?.gateway_warnings).toEqual(['max_tokens_capped_to_model_capability'])
    expect(usageLedger.list()[0]?.prompt_budget_summary).toMatchObject({
      measurement_method: 'rendered_messages_json_v1',
      rendered_prompt_tokens_estimate: 9,
      rendered_non_block_tokens_estimate: 0,
      provider_prompt_tokens_actual: 120,
      prompt_token_drift: 111,
    })
  })
})
