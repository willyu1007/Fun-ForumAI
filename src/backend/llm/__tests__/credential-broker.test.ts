import { describe, expect, it, vi } from 'vitest'
import { CredentialBroker } from '../credential-broker.js'
import type { LlmRegistryBundle } from '../registry-loader.js'
import { PoolAdmissionController } from '../pool-admission-controller.js'

function buildBundle() : LlmRegistryBundle {
  return {
    providers: {
      version: 1,
      providers: [
        {
          provider_id: 'moonshot-openai',
          display_name: 'Moonshot',
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
            tool_calling: true,
            streaming: true,
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
      profiles: [],
    },
    promptTemplates: {
      version: 1,
      templates: [],
    },
    credentialPools: {
      version: 1,
      pools: [
        {
          credential_id: 'moonshot-primary',
          provider_id: 'moonshot-openai',
          region: 'cn',
          endpoint_id: 'moonshot-cn',
          endpoint: 'https://api.moonshot.cn/v1',
          credential_ref: 'secret-ref:moonshot_primary',
          priority: 10,
          health: 'degraded',
          enabled: true,
          scope_tags: ['visible'],
          allowed_model_ids: ['kimi-k2-0905-preview'],
        },
        {
          credential_id: 'moonshot-secondary',
          provider_id: 'moonshot-openai',
          region: 'cn',
          endpoint_id: 'moonshot-cn',
          endpoint: 'https://api.moonshot.cn/v1',
          credential_ref: 'secret-ref:moonshot_secondary',
          priority: 20,
          health: 'healthy',
          enabled: true,
          scope_tags: ['visible'],
          allowed_model_ids: ['kimi-k2-0905-preview'],
        },
      ],
    },
    routingPolicies: {
      version: 1,
      policies: [],
    },
    executionPolicies: {
      version: 1,
      policies: [],
    },
    adapterBindings: {
      version: 1,
      bindings: [
        {
          adapterId: 'openai-chat-completions-v1',
          requestShape: 'chat',
          transport: 'chat_completions',
          providerGatewayKinds: ['openai_compatible'],
          supports: {
            chat: true,
            vision: false,
            jsonMode: true,
            structuredOutput: false,
            toolCalling: true,
            streaming: true,
          },
          authStrategy: 'bearer_api_key',
        },
      ],
    },
    providerAdmission: {
      version: 1,
      pools: [],
    },
    modelPricing: {
      version: 1,
      pricing: [],
    },
    modelCapabilities: {
      version: 1,
      capabilities: [],
    },
  }
}

describe('CredentialBroker', () => {
  it('keeps manual primary ordering even when the primary pool is degraded', () => {
    const bundle = buildBundle()
    const broker = new CredentialBroker({
      bundle,
      secretResolver: {
        resolve: vi.fn((ref: string) => `${ref}-value`),
      } as never,
    })

    const resolved = broker.resolve({
      candidate: {
        provider_id: 'moonshot-openai',
        model_id: 'kimi-k2-0905-preview',
        region: 'cn',
        endpoint_id: 'moonshot-cn',
        adapter_id: 'openai-chat-completions-v1',
        weight: 100,
        quality_class: 'premium',
      },
      visibility: 'visible',
      budgetClass: 'visible_standard',
    })

    expect(resolved.pool.credential_id).toBe('moonshot-primary')
  })

  it('falls through to the secondary pool when the primary secret fails to resolve', () => {
    const bundle = buildBundle()
    const broker = new CredentialBroker({
      bundle,
      secretResolver: {
        resolve: vi.fn((ref: string) => {
          if (ref === 'secret-ref:moonshot_primary') {
            throw new Error('missing primary key')
          }
          return 'secondary-key'
        }),
      } as never,
    })

    const resolved = broker.resolve({
      candidate: {
        provider_id: 'moonshot-openai',
        model_id: 'kimi-k2-0905-preview',
        region: 'cn',
        endpoint_id: 'moonshot-cn',
        adapter_id: 'openai-chat-completions-v1',
        weight: 100,
        quality_class: 'premium',
      },
      visibility: 'visible',
      budgetClass: 'visible_standard',
    })

    expect(resolved.pool.credential_id).toBe('moonshot-secondary')
    expect(resolved.apiKey).toBe('secondary-key')
  })

  it('skips credential pools explicitly excluded by the caller', () => {
    const bundle = buildBundle()
    const broker = new CredentialBroker({
      bundle,
      secretResolver: {
        resolve: vi.fn((ref: string) => `${ref}-value`),
      } as never,
    })

    const resolved = broker.resolve({
      candidate: {
        provider_id: 'moonshot-openai',
        model_id: 'kimi-k2-0905-preview',
        region: 'cn',
        endpoint_id: 'moonshot-cn',
        adapter_id: 'openai-chat-completions-v1',
        weight: 100,
        quality_class: 'premium',
      },
      visibility: 'visible',
      budgetClass: 'visible_standard',
      excludeCredentialIds: ['moonshot-primary'],
    })

    expect(resolved.pool.credential_id).toBe('moonshot-secondary')
  })

  it('routes around a saturated primary pool before falling back to a higher-capacity secondary pool', () => {
    const bundle = buildBundle()
    bundle.credentialPools.pools = bundle.credentialPools.pools.map((pool) => ({
      ...pool,
      max_concurrency: pool.credential_id === 'moonshot-primary' ? 1 : 3,
    }))
    const broker = new CredentialBroker({
      bundle,
      secretResolver: {
        resolve: vi.fn((ref: string) => `${ref}-value`),
      } as never,
      admissionController: new PoolAdmissionController(),
    })

    const first = broker.resolve({
      candidate: {
        provider_id: 'moonshot-openai',
        model_id: 'kimi-k2-0905-preview',
        region: 'cn',
        endpoint_id: 'moonshot-cn',
        adapter_id: 'openai-chat-completions-v1',
        weight: 100,
        quality_class: 'premium',
      },
      visibility: 'visible',
      budgetClass: 'visible_standard',
    })

    const second = broker.resolve({
      candidate: {
        provider_id: 'moonshot-openai',
        model_id: 'kimi-k2-0905-preview',
        region: 'cn',
        endpoint_id: 'moonshot-cn',
        adapter_id: 'openai-chat-completions-v1',
        weight: 100,
        quality_class: 'premium',
      },
      visibility: 'visible',
      budgetClass: 'visible_standard',
    })

    expect(first.pool.credential_id).toBe('moonshot-primary')
    expect(second.pool.credential_id).toBe('moonshot-secondary')

    first.release()
    second.release()
  })

  it('surfaces a rate-limit error when every bounded pool is saturated', () => {
    const bundle = buildBundle()
    bundle.credentialPools.pools = bundle.credentialPools.pools.map((pool) => ({
      ...pool,
      max_concurrency: 1,
    }))
    const broker = new CredentialBroker({
      bundle,
      secretResolver: {
        resolve: vi.fn((ref: string) => `${ref}-value`),
      } as never,
      admissionController: new PoolAdmissionController(),
    })

    const first = broker.resolve({
      candidate: {
        provider_id: 'moonshot-openai',
        model_id: 'kimi-k2-0905-preview',
        region: 'cn',
        endpoint_id: 'moonshot-cn',
        adapter_id: 'openai-chat-completions-v1',
        weight: 100,
        quality_class: 'premium',
      },
      visibility: 'visible',
      budgetClass: 'visible_standard',
    })
    const second = broker.resolve({
      candidate: {
        provider_id: 'moonshot-openai',
        model_id: 'kimi-k2-0905-preview',
        region: 'cn',
        endpoint_id: 'moonshot-cn',
        adapter_id: 'openai-chat-completions-v1',
        weight: 100,
        quality_class: 'premium',
      },
      visibility: 'visible',
      budgetClass: 'visible_standard',
    })

    try {
      broker.resolve({
        candidate: {
          provider_id: 'moonshot-openai',
          model_id: 'kimi-k2-0905-preview',
          region: 'cn',
          endpoint_id: 'moonshot-cn',
          adapter_id: 'openai-chat-completions-v1',
          weight: 100,
          quality_class: 'premium',
        },
        visibility: 'visible',
        budgetClass: 'visible_standard',
      })
      throw new Error('expected saturated pools to raise a rate-limit error')
    } catch (error) {
      expect(error).toMatchObject({ code: 'RateLimitError' })
    }

    first.release()
    second.release()
  })

  it('keeps saturation classified as rate-limit even when a lower-priority fallback pool has broken auth', () => {
    const bundle = buildBundle()
    bundle.credentialPools.pools = bundle.credentialPools.pools.map((pool) => ({
      ...pool,
      max_concurrency: pool.credential_id === 'moonshot-primary' ? 1 : 3,
    }))
    const broker = new CredentialBroker({
      bundle,
      secretResolver: {
        resolve: vi.fn((ref: string) => {
          if (ref === 'secret-ref:moonshot_secondary') {
            throw new Error('missing secondary key')
          }
          return `${ref}-value`
        }),
      } as never,
      admissionController: new PoolAdmissionController(),
    })

    const primaryLease = broker.resolve({
      candidate: {
        provider_id: 'moonshot-openai',
        model_id: 'kimi-k2-0905-preview',
        region: 'cn',
        endpoint_id: 'moonshot-cn',
        weight: 100,
        quality_class: 'premium',
      },
      visibility: 'visible',
      budgetClass: 'visible_standard',
    })

    try {
      broker.resolve({
        candidate: {
          provider_id: 'moonshot-openai',
          model_id: 'kimi-k2-0905-preview',
          region: 'cn',
          endpoint_id: 'moonshot-cn',
          weight: 100,
          quality_class: 'premium',
        },
        visibility: 'visible',
        budgetClass: 'visible_standard',
      })
      throw new Error('expected saturated primary plus broken fallback to raise a rate-limit error')
    } catch (error) {
      expect(error).toMatchObject({ code: 'RateLimitError' })
    }

    primaryLease.release()
  })
})
