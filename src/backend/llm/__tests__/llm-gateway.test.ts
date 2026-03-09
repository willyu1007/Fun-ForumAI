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
            credential_ref: 'secret-ref:dashscope_api_key',
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
          credential_ref: 'secret-ref:dashscope_api_key',
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
        secretResolver: { resolve: vi.fn(() => { throw new Error('missing secret') }) } as never,
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
      promptRef: { id: 'agent-proactive-dm-opening', version: 1 },
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
    expect(usageLedger.list()).toHaveLength(2)
    expect(usageLedger.list()[0]?.success).toBe(false)
    expect(usageLedger.list()[1]?.success).toBe(true)
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

    await expect(gateway.generateVisibleText({
      intent: 'proactive_opening',
      scene: 'proactive_dm',
      agentId: 'agent-1',
      homeVoiceLineId: 'qwen-social-v1',
      promptRef: { id: 'agent-proactive-dm-opening', version: 1 },
      variables: {},
      promptMessages: [{ role: 'user', content: 'open' }],
      budgetClass: 'visible_standard',
      traceId: 'trace-budget',
      requestedTier: 'base',
      allowFallbackWithinLine: true,
      allowCrossFamily: false,
    })).rejects.toMatchObject({ code: 'BudgetExceededError' })

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
      promptRef: { id: 'agent-proactive-dm-opening', version: 1 },
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
})
