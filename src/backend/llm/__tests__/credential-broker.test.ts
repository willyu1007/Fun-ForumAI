import { describe, expect, it, vi } from 'vitest'
import { CredentialBroker, findUsableCredentialPoolsForCandidate } from '../credential-broker.js'
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
          allowed_model_ids: ['kimi-k2.5'],
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
          allowed_model_ids: ['kimi-k2.5'],
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
          runtime: 'openai_chat_completions',
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
  it('prefers a healthy pool over a degraded higher-priority pool', () => {
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
        model_id: 'kimi-k2.5',
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
        model_id: 'kimi-k2.5',
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

  it('reports candidate usability only when a matching non-empty secret can be resolved', () => {
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

    expect(broker.hasUsableCredentialForCandidate({
      candidate: {
        provider_id: 'moonshot-openai',
        model_id: 'kimi-k2.5',
        region: 'cn',
        endpoint_id: 'moonshot-cn',
        adapter_id: 'openai-chat-completions-v1',
        weight: 100,
        quality_class: 'premium',
      },
      visibility: 'visible',
      budgetClass: 'visible_standard',
    })).toBe(true)

    const unusable = new CredentialBroker({
      bundle,
      secretResolver: {
        resolve: vi.fn(() => ''),
      } as never,
    })

    expect(unusable.hasUsableCredentialForCandidate({
      candidate: {
        provider_id: 'moonshot-openai',
        model_id: 'kimi-k2.5',
        region: 'cn',
        endpoint_id: 'moonshot-cn',
        adapter_id: 'openai-chat-completions-v1',
        weight: 100,
        quality_class: 'premium',
      },
      visibility: 'visible',
      budgetClass: 'visible_standard',
    })).toBe(false)
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
        model_id: 'kimi-k2.5',
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
      health: 'healthy',
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
        model_id: 'kimi-k2.5',
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
        model_id: 'kimi-k2.5',
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
        model_id: 'kimi-k2.5',
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
        model_id: 'kimi-k2.5',
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
          model_id: 'kimi-k2.5',
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
        model_id: 'kimi-k2.5',
        region: 'cn',
        endpoint_id: 'moonshot-cn',
        adapter_id: 'openai-compatible',
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
          model_id: 'kimi-k2.5',
          region: 'cn',
          endpoint_id: 'moonshot-cn',
          adapter_id: 'openai-compatible',
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

  it('matches deepseek identity-write pools only when they declare identity_write scope', () => {
    const candidate = {
      provider_id: 'deepseek-openai',
      model_id: 'deepseek-reasoner',
      region: 'cn',
      endpoint_id: 'deepseek-cn',
      adapter_id: 'openai-chat-completions-v1',
      weight: 82,
      quality_class: 'premium' as const,
    }

    expect(findUsableCredentialPoolsForCandidate({
      candidate,
      credentialPools: [
        {
          credential_id: 'deepseek-missing-identity',
          provider_id: 'deepseek-openai',
          region: 'cn',
          endpoint_id: 'deepseek-cn',
          endpoint: 'https://api.deepseek.com',
          credential_ref: 'secret-ref:deepseek_api_key',
          priority: 10,
          health: 'healthy',
          enabled: true,
          scope_tags: ['hidden'],
          allowed_model_ids: ['deepseek-chat', 'deepseek-reasoner'],
        },
      ],
      visibility: 'identity_write',
      budgetClass: 'identity_write',
    })).toHaveLength(0)

    expect(findUsableCredentialPoolsForCandidate({
      candidate,
      credentialPools: [
        {
          credential_id: 'deepseek-primary',
          provider_id: 'deepseek-openai',
          region: 'cn',
          endpoint_id: 'deepseek-cn',
          endpoint: 'https://api.deepseek.com',
          credential_ref: 'secret-ref:deepseek_api_key',
          priority: 10,
          health: 'healthy',
          enabled: true,
          scope_tags: ['hidden', 'identity_write'],
          allowed_model_ids: ['deepseek-chat', 'deepseek-reasoner'],
        },
      ],
      visibility: 'identity_write',
      budgetClass: 'identity_write',
    })).toHaveLength(1)
  })

  it('matches minimax hidden pools only when they declare hidden scope', () => {
    const candidate = {
      provider_id: 'minimax-openai',
      model_id: 'MiniMax-M2.7',
      region: 'cn',
      endpoint_id: 'minimax-cn',
      adapter_id: 'openai-chat-completions-v1',
      weight: 100,
      quality_class: 'balanced' as const,
    }

    expect(findUsableCredentialPoolsForCandidate({
      candidate,
      credentialPools: [
        {
          credential_id: 'minimax-visible-only',
          provider_id: 'minimax-openai',
          region: 'cn',
          endpoint_id: 'minimax-cn',
          endpoint: 'https://api.minimaxi.com/v1',
          credential_ref: 'secret-ref:minimax_api_key',
          priority: 10,
          health: 'healthy',
          enabled: true,
          scope_tags: ['visible', 'identity_write'],
          allowed_model_ids: ['MiniMax-M2.7'],
        },
      ],
      visibility: 'hidden',
      budgetClass: 'hidden_background',
    })).toHaveLength(0)

    expect(findUsableCredentialPoolsForCandidate({
      candidate,
      credentialPools: [
        {
          credential_id: 'minimax-primary',
          provider_id: 'minimax-openai',
          region: 'cn',
          endpoint_id: 'minimax-cn',
          endpoint: 'https://api.minimaxi.com/v1',
          credential_ref: 'secret-ref:minimax_api_key',
          priority: 10,
          health: 'healthy',
          enabled: true,
          scope_tags: ['visible', 'identity_write', 'hidden'],
          allowed_model_ids: ['MiniMax-M2.7'],
        },
      ],
      visibility: 'hidden',
      budgetClass: 'hidden_background',
    })).toHaveLength(1)
  })
})
