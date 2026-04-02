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
            credential_ref_required: true,
            credential_ref: 'secret-ref:llm_api_default',
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
          route_order: ['profile_candidates', 'health'],
          allow_fallback_within_line: true,
          allow_cross_family: false,
          allowed_fallback_levels: ['none', 'same-line'],
        },
        {
          profile_id: 'qwen-social-proactive-opening-premium',
          route_order: ['profile_candidates', 'health'],
          allow_fallback_within_line: true,
          allow_cross_family: false,
          allowed_fallback_levels: ['none'],
        },
        {
          profile_id: 'qwen-social-identity-write-base',
          route_order: ['voice_line_tier', 'profile_candidates', 'health'],
          allow_fallback_within_line: false,
          allow_cross_family: false,
          allowed_fallback_levels: ['none'],
        },
        {
          profile_id: 'qwen-social-identity-write-premium',
          route_order: ['voice_line_tier', 'profile_candidates', 'health'],
          allow_fallback_within_line: false,
          allow_cross_family: false,
          allowed_fallback_levels: ['none'],
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
        },
        {
          provider_id: 'dashscope-openai',
          model_id: 'qwen-plus-character',
          input_window_tokens: 32_768,
          max_output_tokens: 8_192,
          recommended_operating_input_tokens: 24_576,
        },
        {
          provider_id: 'dashscope-openai',
          model_id: 'qwen-max',
          input_window_tokens: 32_768,
          max_output_tokens: 8_192,
          recommended_operating_input_tokens: 24_576,
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

    const response = await gateway.generateVisibleText({
      intent: 'proactive_opening',
      scene: 'proactive_dm',
      agentId: 'agent-1',
      homeVoiceLineId: 'qwen-social-v1',
      promptRef: { id: 'agent-proactive-dm-opening', version: 2 },
      variables: {},
      promptMessages: [{ role: 'user', content: 'open' }],
      budgetClass: 'visible_standard',
      traceId: 'trace-1',
      requestedTier: 'base',
      allowFallbackWithinLine: true,
      allowCrossFamily: false,
    })

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
      gateway.generateVisibleText({
        intent: 'proactive_opening',
        scene: 'proactive_dm',
        agentId: 'agent-1',
        homeVoiceLineId: 'qwen-social-v1',
        promptRef: { id: 'agent-proactive-dm-opening', version: 2 },
        variables: {},
        promptMessages: [{ role: 'user', content: 'open' }],
        budgetClass: 'visible_standard',
        traceId: 'trace-budget',
        requestedTier: 'base',
        allowFallbackWithinLine: true,
        allowCrossFamily: false,
      }),
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

    const response = await gateway.generateVisibleText({
      intent: 'proactive_opening',
      scene: 'proactive_dm',
      agentId: 'agent-1',
      homeVoiceLineId: 'qwen-social-v1',
      promptRef: { id: 'agent-proactive-dm-opening', version: 2 },
      variables: {},
      promptMessages: [{ role: 'user', content: 'open' }],
      budgetClass: 'visible_standard',
      traceId: 'trace-retry',
      requestedTier: 'base',
      allowFallbackWithinLine: true,
      allowCrossFamily: false,
    })

    expect(response.platformRetryCount).toBe(2)
    expect(usageLedger.list()[0]?.platform_retry_count).toBe(2)
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

    const response = await gateway.generateVisibleText({
      intent: 'proactive_opening',
      scene: 'proactive_dm',
      agentId: 'agent-1',
      homeVoiceLineId: 'qwen-social-v1',
      preferredModelId: 'qwen-flash-character',
      promptRef: { id: 'agent-proactive-dm-opening', version: 2 },
      variables: {},
      promptMessages: [{ role: 'user', content: 'open' }],
      budgetClass: 'visible_standard',
      traceId: 'trace-preferred',
      requestedTier: 'base',
      allowFallbackWithinLine: true,
      allowCrossFamily: false,
    })

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

    const response = await gateway.generateIdentityWrite({
      intent: 'identity_write',
      scene: 'background_hidden',
      agentId: 'agent-1',
      homeVoiceLineId: 'qwen-social-v1',
      promptRef: { id: 'internal-public-observation-identity-finalize', version: 1 },
      variables: {},
      promptMessages: [{ role: 'user', content: 'finalize' }],
      budgetClass: 'identity_write',
      traceId: 'trace-identity-base',
      requestedTier: 'base',
      allowFallbackWithinLine: false,
      allowCrossFamily: false,
    })

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

    const response = await gateway.generateVisibleText({
      intent: 'proactive_opening',
      scene: 'proactive_dm',
      agentId: 'agent-1',
      homeVoiceLineId: 'qwen-social-v1',
      preferredModelId: 'qwen-flash-character',
      promptRef: { id: 'agent-proactive-dm-opening', version: 2 },
      variables: {},
      promptMessages: [{ role: 'user', content: 'open' }],
      budgetClass: 'visible_standard',
      traceId: 'trace-admission',
      requestedTier: 'base',
      allowFallbackWithinLine: true,
      allowCrossFamily: false,
    })

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
        credential_ref_required: true,
        credential_ref: 'secret-ref:deepseek_api_key',
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
      route_order: ['profile_candidates', 'health'],
      allow_fallback_within_line: false,
      allow_cross_family: false,
      allowed_fallback_levels: ['none'],
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

    const response = await gateway.generateHiddenArtifact({
      intent: 'private_digest',
      scene: 'background_hidden',
      agentId: 'agent-1',
      homeVoiceLineId: 'deepseek-director-v1',
      promptRef: { id: 'internal-private-chat-summary-extract', version: 1 },
      variables: {},
      promptMessages: [{ role: 'user', content: 'summarize' }],
      budgetClass: 'hidden_background',
      traceId: 'trace-hidden-fallback',
      requestedTier: 'premium',
      allowFallbackWithinLine: false,
      allowCrossFamily: false,
    })

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
      route_order: ['profile_candidates', 'health'],
      allow_fallback_within_line: false,
      allow_cross_family: false,
      allowed_fallback_levels: ['none'],
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

    const response = await gateway.generateHiddenArtifact({
      intent: 'vision_summary',
      scene: 'background_hidden',
      agentId: 'agent-1',
      homeVoiceLineId: 'deepseek-director-v1',
      promptRef: { id: 'internal-vision-summary', version: 2 },
      variables: {},
      promptMessages: [{ role: 'user', content: 'summarize image' }],
      budgetClass: 'hidden_multimodal',
      traceId: 'trace-vision-fallback',
      requestedTier: 'base',
      allowFallbackWithinLine: false,
      allowCrossFamily: false,
    })

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

    const response = await gateway.generateVisibleText({
      intent: 'proactive_opening',
      scene: 'proactive_dm',
      agentId: 'agent-1',
      homeVoiceLineId: 'qwen-social-v1',
      promptRef: { id: 'agent-proactive-dm-opening', version: 2 },
      variables: {},
      promptMessages: [{ role: 'user', content: 'open' }],
      budgetClass: 'visible_standard',
      traceId: 'trace-budget-summary',
      requestedTier: 'base',
      allowFallbackWithinLine: true,
      allowCrossFamily: false,
      maxTokens: 9_000,
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
    })

    expect(response.warnings).toEqual(['requested_output_exceeds_model_capability'])
    expect(usageLedger.list()[0]?.gateway_warnings).toEqual(['requested_output_exceeds_model_capability'])
    expect(usageLedger.list()[0]?.prompt_budget_summary).toMatchObject({
      measurement_method: 'rendered_messages_json_v1',
      rendered_prompt_tokens_estimate: 9,
      rendered_non_block_tokens_estimate: 0,
      provider_prompt_tokens_actual: 120,
      prompt_token_drift: 111,
    })
  })
})
