import type {
  CredentialPoolEntry,
  LLMVisibility,
  ModelProfileCandidate,
  ProviderRegistryEntry,
} from './gateway-contract.js'
import { LLMGatewayContractError } from './gateway-contract.js'
import type { LlmRegistryBundle } from './registry-loader.js'
import { SecretResolver } from './secret-resolver.js'

export interface ResolvedCredential {
  provider: ProviderRegistryEntry
  pool: CredentialPoolEntry
  apiKey: string
}

interface CredentialBrokerOptions {
  bundle: LlmRegistryBundle
  secretResolver: SecretResolver
}

export class CredentialBroker {
  private readonly providersById: Map<string, ProviderRegistryEntry>

  constructor(private readonly options: CredentialBrokerOptions) {
    this.providersById = new Map(
      options.bundle.providers.providers.map((provider) => [provider.provider_id, provider] as const),
    )
  }

  hasAnyUsableCredential(): boolean {
    for (const pool of this.options.bundle.credentialPools.pools) {
      if (pool.enabled === false || pool.health === 'blocked') continue
      try {
        const apiKey = this.options.secretResolver.resolve(pool.credential_ref)
        if (apiKey.trim()) {
          return true
        }
      } catch {
        continue
      }
    }
    return false
  }

  resolve(input: {
    candidate: ModelProfileCandidate
    visibility: LLMVisibility
    budgetClass: string
    tags?: string[]
  }): ResolvedCredential {
    const provider = this.providersById.get(input.candidate.provider_id)
    if (!provider) {
      throw new LLMGatewayContractError(
        'RegistryResolutionError',
        `Unknown provider for candidate: ${input.candidate.provider_id}`,
        {
          provider_id: input.candidate.provider_id,
          model_id: input.candidate.model_id,
          region: input.candidate.region,
          endpoint_id: input.candidate.endpoint_id,
          weight: input.candidate.weight,
          quality_class: input.candidate.quality_class,
        },
      )
    }

    const scopeTags = buildScopeTags(input.visibility, input.budgetClass, input.tags)
    const pools = this.options.bundle.credentialPools.pools
      .filter((pool) => pool.provider_id === input.candidate.provider_id)
      .filter((pool) => pool.region === input.candidate.region)
      .filter((pool) => pool.endpoint_id === input.candidate.endpoint_id)
      .filter((pool) => pool.enabled !== false)
      .filter((pool) => pool.health !== 'blocked')
      .filter((pool) => {
        if (pool.allowed_model_ids?.length) {
          return pool.allowed_model_ids.includes(input.candidate.model_id)
        }
        return true
      })
      .filter((pool) => {
        if (!pool.scope_tags?.length) return true
        return pool.scope_tags.some((tag) => scopeTags.has(tag))
      })
      .sort(comparePools)

    if (pools.length === 0) {
      throw new LLMGatewayContractError(
        'AuthError',
        `No credential pool available for ${input.candidate.provider_id}/${input.candidate.model_id}`,
        {
          provider_id: input.candidate.provider_id,
          model_id: input.candidate.model_id,
          region: input.candidate.region,
          endpoint_id: input.candidate.endpoint_id,
          scope_tags: Array.from(scopeTags),
        },
      )
    }

    for (const pool of pools) {
      try {
        const apiKey = this.options.secretResolver.resolve(pool.credential_ref)
        if (!apiKey.trim()) {
          throw new Error('resolved api key was empty')
        }
        return { provider, pool, apiKey }
      } catch (error) {
        if (pool === pools[pools.length - 1]) {
          throw new LLMGatewayContractError(
            'AuthError',
            `Failed to resolve any credential for ${input.candidate.provider_id}/${input.candidate.model_id}`,
            {
              provider_id: input.candidate.provider_id,
              model_id: input.candidate.model_id,
              last_pool_id: pool.credential_id,
              cause: error instanceof Error ? error.message : 'Unknown credential resolution error',
            },
          )
        }
      }
    }

    throw new LLMGatewayContractError(
      'AuthError',
      `Failed to resolve credential for ${input.candidate.provider_id}/${input.candidate.model_id}`,
      {
        provider_id: input.candidate.provider_id,
        model_id: input.candidate.model_id,
        region: input.candidate.region,
        endpoint_id: input.candidate.endpoint_id,
        weight: input.candidate.weight,
        quality_class: input.candidate.quality_class,
      },
    )
  }
}

function buildScopeTags(visibility: LLMVisibility, budgetClass: string, extraTags: string[] = []): Set<string> {
  const tags = new Set<string>(extraTags)
  tags.add(visibility)
  if (budgetClass === 'hidden_multimodal') {
    tags.add('hidden_multimodal')
  }
  if (visibility === 'hidden') {
    tags.add('hidden')
  }
  if (visibility === 'identity_write') {
    tags.add('identity_write')
  }
  if (visibility === 'visible') {
    tags.add('visible')
  }
  return tags
}

function comparePools(a: CredentialPoolEntry, b: CredentialPoolEntry): number {
  const healthScore = (pool: CredentialPoolEntry) => pool.health === 'healthy' ? 2 : pool.health === 'degraded' ? 1 : 0
  const headroom = (pool: CredentialPoolEntry) => (pool.rpm_headroom ?? 0) + (pool.tpm_headroom ?? 0)
  return (
    healthScore(b) - healthScore(a) ||
    headroom(b) - headroom(a) ||
    a.credential_id.localeCompare(b.credential_id)
  )
}
