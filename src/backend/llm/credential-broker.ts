import type {
  CredentialPoolEntry,
  LLMVisibility,
  ModelProfileCandidate,
  ProviderRegistryEntry,
} from './gateway-contract.js'
import { LLMGatewayContractError } from './gateway-contract.js'
import type { LlmRegistryBundle } from './registry-loader.js'
import { SecretResolver } from './secret-resolver.js'
import { PoolAdmissionController } from './pool-admission-controller.js'

export interface ResolvedCredential {
  provider: ProviderRegistryEntry
  pool: CredentialPoolEntry
  apiKey: string
  release(): void
}

interface CredentialBrokerOptions {
  bundle: LlmRegistryBundle
  secretResolver: SecretResolver
  admissionController?: PoolAdmissionController
}

export class CredentialBroker {
  private readonly providersById: Map<string, ProviderRegistryEntry>
  private readonly admissionController: PoolAdmissionController

  constructor(private readonly options: CredentialBrokerOptions) {
    this.providersById = new Map(
      options.bundle.providers.providers.map((provider) => [provider.provider_id, provider] as const),
    )
    this.admissionController = options.admissionController ?? new PoolAdmissionController()
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
    excludeCredentialIds?: Iterable<string>
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

    const scopeTags = buildCredentialScopeTags(input.visibility, input.budgetClass, input.tags)
    const excludedCredentialIds = new Set(input.excludeCredentialIds ?? [])
    const pools = findUsableCredentialPoolsForCandidate({
      candidate: input.candidate,
      credentialPools: this.options.bundle.credentialPools.pools,
      visibility: input.visibility,
      budgetClass: input.budgetClass,
      tags: input.tags,
      excludeCredentialIds: excludedCredentialIds,
    }).sort(comparePools)

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

    let saturatedPoolCount = 0
    let lastAuthFailure: unknown = null
    let lastAuthFailurePoolId: string | null = null
    const authFailures: Array<{ credential_id: string; cause: string }> = []

    for (const pool of pools) {
      const lease = this.admissionController.tryAcquire(pool)
      if (!lease) {
        saturatedPoolCount += 1
        continue
      }
      try {
        const apiKey = this.options.secretResolver.resolve(pool.credential_ref)
        if (!apiKey.trim()) {
          throw new Error('resolved api key was empty')
        }
        return {
          provider,
          pool,
          apiKey,
          release: () => lease.release(),
        }
      } catch (error) {
        lastAuthFailure = error
        lastAuthFailurePoolId = pool.credential_id
        authFailures.push({
          credential_id: pool.credential_id,
          cause: error instanceof Error ? error.message : 'Unknown credential resolution error',
        })
        lease.release()
      }
    }

    if (saturatedPoolCount > 0) {
      throw new LLMGatewayContractError(
        'RateLimitError',
        `All credential pools are saturated for ${input.candidate.provider_id}/${input.candidate.model_id}`,
        {
          provider_id: input.candidate.provider_id,
          model_id: input.candidate.model_id,
          region: input.candidate.region,
          endpoint_id: input.candidate.endpoint_id,
          pool_limits: pools.map((pool) => ({
            credential_id: pool.credential_id,
            max_concurrency: pool.max_concurrency ?? null,
            active_count: this.admissionController.getActiveCount(pool.credential_id),
          })),
          auth_failures: authFailures,
        },
      )
    }

    if (lastAuthFailure) {
      throw new LLMGatewayContractError(
        'AuthError',
        `Failed to resolve any credential for ${input.candidate.provider_id}/${input.candidate.model_id}`,
        {
          provider_id: input.candidate.provider_id,
          model_id: input.candidate.model_id,
          last_pool_id: lastAuthFailurePoolId,
          cause: lastAuthFailure instanceof Error ? lastAuthFailure.message : 'Unknown credential resolution error',
          auth_failures: authFailures,
        },
      )
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

export function findUsableCredentialPoolsForCandidate(input: {
  candidate: ModelProfileCandidate
  credentialPools: CredentialPoolEntry[]
  visibility: LLMVisibility
  budgetClass: string
  tags?: string[]
  excludeCredentialIds?: Iterable<string>
}): CredentialPoolEntry[] {
  const scopeTags = buildCredentialScopeTags(input.visibility, input.budgetClass, input.tags)
  const excludedCredentialIds = new Set(input.excludeCredentialIds ?? [])
  return input.credentialPools
    .filter((pool) => pool.provider_id === input.candidate.provider_id)
    .filter((pool) => pool.region === input.candidate.region)
    .filter((pool) => pool.endpoint_id === input.candidate.endpoint_id)
    .filter((pool) => pool.enabled !== false)
    .filter((pool) => pool.health !== 'blocked')
    .filter((pool) => !excludedCredentialIds.has(pool.credential_id))
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
}

export function buildCredentialScopeTags(
  visibility: LLMVisibility,
  budgetClass: string,
  extraTags: string[] = [],
): Set<string> {
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
  const headroom = (pool: CredentialPoolEntry) => (pool.rpm_headroom ?? 0) + (pool.tpm_headroom ?? 0)
  return (
    a.priority - b.priority ||
    headroom(b) - headroom(a) ||
    a.credential_id.localeCompare(b.credential_id)
  )
}
