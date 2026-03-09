import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import {
  RENDER_TIERS,
  VOICE_LINE_CATALOG,
  VOICE_LINE_IDS,
  VOICE_LINE_ROUTING_INTENTS,
  type RenderTier,
  type VoiceLineId,
  type VoiceLineRoutingIntent,
} from '../../shared/agent-persona-catalog.js'
import type {
  CredentialPoolEntry,
  LLMVisibility,
  ModelProfileCandidate,
  ModelProfileFallback,
  ProviderRegistryEntry,
  RoutingPolicyEntry,
} from './gateway-contract.js'
import { LLMGatewayContractError } from './gateway-contract.js'

export interface PromptVariableSchemaProperty {
  type: 'string'
}

export interface PromptVariableSchema {
  type: 'object'
  properties: Record<string, PromptVariableSchemaProperty>
  required: string[]
}

export interface PromptTemplateRegistryEntry {
  prompt_template_id: string
  version: number
  description: string
  variables_schema: PromptVariableSchema
  system_prompt: string
  user_prompt: string
}

export interface ProvidersRegistryFile {
  version: number
  providers: ProviderRegistryEntry[]
}

export interface ModelProfileEntry {
  profile_id: string
  voice_line_id: VoiceLineId
  tier: RenderTier
  intent: VoiceLineRoutingIntent
  visibility: LLMVisibility
  candidates: ModelProfileCandidate[]
  fallback: ModelProfileFallback[]
}

export interface ModelProfilesRegistryFile {
  version: number
  profiles: ModelProfileEntry[]
}

export interface PromptTemplatesRegistryFile {
  version: number
  templates: PromptTemplateRegistryEntry[]
}

export interface CredentialPoolsRegistryFile {
  version: number
  pools: CredentialPoolEntry[]
}

export interface RoutingPoliciesRegistryFile {
  version: number
  policies: RoutingPolicyEntry[]
}

export interface LlmRegistryBundle {
  providers: ProvidersRegistryFile
  modelProfiles: ModelProfilesRegistryFile
  promptTemplates: PromptTemplatesRegistryFile
  credentialPools: CredentialPoolsRegistryFile
  routingPolicies: RoutingPoliciesRegistryFile
}

export interface LlmRegistryPaths {
  providers?: string
  modelProfiles?: string
  promptTemplates?: string
  credentialPools?: string
  routingPolicies?: string
}

const lLMVisibilityEnum = z.enum(['visible', 'hidden', 'identity_write', 'dev_only'])
const renderTierSchema = z.enum(RENDER_TIERS)
const voiceLineIdSchema = z.enum(VOICE_LINE_IDS)
const routingIntentSchema = z.enum(VOICE_LINE_ROUTING_INTENTS)
const routingFallbackLevelSchema = z.enum([
  'none',
  'same-line',
  'same-family',
  'cross-family-hidden',
  'rare-reanchor',
])
const qualityClassSchema = z.enum(['fast', 'balanced', 'premium'])
const credentialHealthSchema = z.enum(['healthy', 'degraded', 'blocked'])
const routeOrderSchema = z.enum([
  'intent_scene_fit',
  'voice_line_tier',
  'profile_candidates',
  'region_policy',
  'headroom',
  'health',
])

const providerRegistrySchema = z.object({
  version: z.number().int().positive(),
  providers: z.array(
    z.object({
      provider_id: z.string().min(1),
      display_name: z.string().min(1),
      gateway_kind: z.enum(['openai_compatible', 'native']),
      auth: z.object({
        type: z.literal('api_key'),
        credential_ref_required: z.boolean(),
        credential_ref: z.string().min(1),
      }).strict(),
      routing: z.object({
        regions: z.array(z.string().min(1)).min(1),
        default_region: z.string().min(1),
      }).strict(),
      capabilities: z.object({
        chat: z.boolean(),
        json_mode: z.boolean(),
        tool_calling: z.boolean(),
        streaming: z.boolean(),
      }).strict(),
      defaults: z.object({
        timeout_ms: z.number().int().positive(),
        max_retries: z.number().int().min(0),
      }).strict(),
    }).strict(),
  ),
}).strict()

const modelProfileSchema = z.object({
  version: z.number().int().positive(),
  profiles: z.array(
    z.object({
      profile_id: z.string().min(1),
      voice_line_id: voiceLineIdSchema,
      tier: renderTierSchema,
      intent: routingIntentSchema,
      visibility: lLMVisibilityEnum,
      candidates: z.array(
        z.object({
          provider_id: z.string().min(1),
          model_id: z.string().min(1),
          region: z.string().min(1),
          endpoint_id: z.string().min(1),
          weight: z.number().positive(),
          quality_class: qualityClassSchema,
        }).strict(),
      ).min(1),
      fallback: z.array(
        z.object({
          level: routingFallbackLevelSchema,
          profile_id: z.string().min(1).optional(),
          provider_id: z.string().min(1).optional(),
          model_id: z.string().min(1).optional(),
          reason: z.string().min(1),
        }).strict(),
      ),
    }).strict(),
  ),
}).strict()

const promptVariablePropertySchema = z.object({
  type: z.literal('string'),
}).strict()

const promptTemplateSchema = z.object({
  version: z.number().int().positive(),
  templates: z.array(
    z.object({
      prompt_template_id: z.string().min(1),
      version: z.number().int().positive(),
      description: z.string().min(1),
      variables_schema: z.object({
        type: z.literal('object'),
        properties: z.record(z.string().min(1), promptVariablePropertySchema),
        required: z.array(z.string().min(1)),
      }).strict(),
      system_prompt: z.string().min(1),
      user_prompt: z.string().min(1),
    }).strict(),
  ),
}).strict()

const credentialPoolsSchema = z.object({
  version: z.number().int().positive(),
  pools: z.array(
    z.object({
      credential_id: z.string().min(1),
      provider_id: z.string().min(1),
      region: z.string().min(1),
      endpoint_id: z.string().min(1),
      endpoint: z.string().url(),
      credential_ref: z.string().min(1),
      health: credentialHealthSchema,
      enabled: z.boolean().optional(),
      scope_tags: z.array(z.string().min(1)).optional(),
      allowed_model_ids: z.array(z.string().min(1)).optional(),
      rpm_headroom: z.number().int().min(0).optional(),
      tpm_headroom: z.number().int().min(0).optional(),
    }).strict(),
  ),
}).strict()

const routingPoliciesSchema = z.object({
  version: z.number().int().positive(),
  policies: z.array(
    z.object({
      profile_id: z.string().min(1),
      route_order: z.array(routeOrderSchema).min(1),
      allow_fallback_within_line: z.boolean(),
      allow_cross_family: z.boolean(),
      allowed_fallback_levels: z.array(routingFallbackLevelSchema).min(1),
    }).strict(),
  ),
}).strict()

export function loadProvidersRegistry(registryPath = defaultRegistryPath('providers.yaml')): ProvidersRegistryFile {
  return parseYamlFile(registryPath, providerRegistrySchema, 'providers registry')
}

export function loadModelProfilesRegistry(
  registryPath = defaultRegistryPath('model_profiles.yaml'),
): ModelProfilesRegistryFile {
  return parseYamlFile(registryPath, modelProfileSchema, 'model profiles registry')
}

export function loadPromptTemplatesRegistry(
  registryPath = defaultRegistryPath('prompt_templates.yaml'),
): PromptTemplatesRegistryFile {
  return parseYamlFile(registryPath, promptTemplateSchema, 'prompt templates registry')
}

export function loadCredentialPoolsRegistry(
  registryPath = defaultRegistryPath('credential_pools.yaml'),
): CredentialPoolsRegistryFile {
  return parseYamlFile(registryPath, credentialPoolsSchema, 'credential pools registry')
}

export function loadRoutingPoliciesRegistry(
  registryPath = defaultRegistryPath('routing_policies.yaml'),
): RoutingPoliciesRegistryFile {
  return parseYamlFile(registryPath, routingPoliciesSchema, 'routing policies registry')
}

export function loadLlmRegistryBundle(paths: LlmRegistryPaths = {}): LlmRegistryBundle {
  const bundle: LlmRegistryBundle = {
    providers: loadProvidersRegistry(paths.providers),
    modelProfiles: loadModelProfilesRegistry(paths.modelProfiles),
    promptTemplates: loadPromptTemplatesRegistry(paths.promptTemplates),
    credentialPools: loadCredentialPoolsRegistry(paths.credentialPools),
    routingPolicies: loadRoutingPoliciesRegistry(paths.routingPolicies),
  }

  validateLlmRegistryBundle(bundle)
  return bundle
}

export function validateLlmRegistryBundle(bundle: LlmRegistryBundle): void {
  const providerIds = bundle.providers.providers.map((entry) => entry.provider_id)
  const profileIds = bundle.modelProfiles.profiles.map((entry) => entry.profile_id)
  const promptKeys = bundle.promptTemplates.templates.map(
    (entry) => `${entry.prompt_template_id}@${entry.version}`,
  )
  const credentialIds = bundle.credentialPools.pools.map((entry) => entry.credential_id)
  const policyProfileIds = bundle.routingPolicies.policies.map((entry) => entry.profile_id)

  assertUnique(providerIds, 'provider_id')
  assertUnique(profileIds, 'profile_id')
  assertUnique(promptKeys, 'prompt_template_id@version')
  assertUnique(credentialIds, 'credential_id')
  assertUnique(policyProfileIds, 'routing policy profile_id')

  const providersById = new Map(
    bundle.providers.providers.map((entry) => [entry.provider_id, entry] as const),
  )
  const profilesById = new Map(
    bundle.modelProfiles.profiles.map((entry) => [entry.profile_id, entry] as const),
  )
  const policyByProfileId = new Map(
    bundle.routingPolicies.policies.map((entry) => [entry.profile_id, entry] as const),
  )

  for (const provider of bundle.providers.providers) {
    if (!provider.routing.regions.includes(provider.routing.default_region)) {
      throw registryError(
        `Provider ${provider.provider_id} default_region must be listed in routing.regions`,
        { provider_id: provider.provider_id },
      )
    }
  }

  for (const pool of bundle.credentialPools.pools) {
    const provider = providersById.get(pool.provider_id)
    if (!provider) {
      throw registryError(
        `Credential pool ${pool.credential_id} references unknown provider ${pool.provider_id}`,
        { credential_id: pool.credential_id, provider_id: pool.provider_id },
      )
    }
    if (!provider.routing.regions.includes(pool.region)) {
      throw registryError(
        `Credential pool ${pool.credential_id} uses unsupported region ${pool.region}`,
        {
          credential_id: pool.credential_id,
          provider_id: pool.provider_id,
          region: pool.region,
        },
      )
    }
  }

  for (const profile of bundle.modelProfiles.profiles) {
    if (!policyByProfileId.has(profile.profile_id)) {
      throw registryError(
        `Profile ${profile.profile_id} is missing a routing policy`,
        { profile_id: profile.profile_id },
      )
    }

    const line = VOICE_LINE_CATALOG[profile.voice_line_id]
    if (!line) {
      throw registryError(`Unknown voice_line_id: ${profile.voice_line_id}`, {
        profile_id: profile.profile_id,
      })
    }

    if (profile.visibility === 'dev_only') {
      throw registryError(
        `Model profiles cannot use dev_only visibility: ${profile.profile_id}`,
        { profile_id: profile.profile_id, visibility: profile.visibility },
      )
    }

    if (line.directorOnly && profile.visibility !== 'hidden') {
      throw registryError(
        `Director-only voice line ${profile.voice_line_id} must stay hidden`,
        { profile_id: profile.profile_id, visibility: profile.visibility },
      )
    }

    if (!line.visible && profile.visibility === 'visible') {
      throw registryError(
        `Hidden voice line ${profile.voice_line_id} cannot expose visible profiles`,
        { profile_id: profile.profile_id, visibility: profile.visibility },
      )
    }

    for (const candidate of profile.candidates) {
      const provider = providersById.get(candidate.provider_id)
      if (!provider) {
        throw registryError(
          `Profile ${profile.profile_id} references unknown provider ${candidate.provider_id}`,
          { profile_id: profile.profile_id, provider_id: candidate.provider_id },
        )
      }
      if (!provider.routing.regions.includes(candidate.region)) {
        throw registryError(
          `Profile ${profile.profile_id} uses unsupported region ${candidate.region} for provider ${candidate.provider_id}`,
          {
            profile_id: profile.profile_id,
            provider_id: candidate.provider_id,
            region: candidate.region,
          },
        )
      }

      const matchingPool = bundle.credentialPools.pools.find((pool) => (
        pool.provider_id === candidate.provider_id &&
        pool.region === candidate.region &&
        pool.endpoint_id === candidate.endpoint_id
      ))
      if (!matchingPool) {
        throw registryError(
          `Profile ${profile.profile_id} candidate ${candidate.provider_id}/${candidate.model_id} has no credential pool`,
          {
            profile_id: profile.profile_id,
            provider_id: candidate.provider_id,
            model_id: candidate.model_id,
            endpoint_id: candidate.endpoint_id,
          },
        )
      }
    }

    for (const fallback of profile.fallback) {
      if (fallback.profile_id && !profilesById.has(fallback.profile_id)) {
        throw registryError(
          `Profile ${profile.profile_id} fallback references unknown profile ${fallback.profile_id}`,
          { profile_id: profile.profile_id, fallback_profile_id: fallback.profile_id },
        )
      }
    }
  }

  for (const policy of bundle.routingPolicies.policies) {
    if (!profilesById.has(policy.profile_id)) {
      throw registryError(
        `Routing policy references unknown profile ${policy.profile_id}`,
        { profile_id: policy.profile_id },
      )
    }
    if (!policy.allowed_fallback_levels.includes('none')) {
      throw registryError(
        `Routing policy ${policy.profile_id} must include none in allowed_fallback_levels`,
        { profile_id: policy.profile_id },
      )
    }
  }

  for (const template of bundle.promptTemplates.templates) {
    const propertyKeys = new Set(Object.keys(template.variables_schema.properties))
    for (const requiredKey of template.variables_schema.required) {
      if (!propertyKeys.has(requiredKey)) {
        throw registryError(
          `Prompt template ${template.prompt_template_id}@${template.version} requires undeclared key ${requiredKey}`,
          {
            prompt_template_id: template.prompt_template_id,
            version: template.version,
            required_key: requiredKey,
          },
        )
      }
    }

    const placeholders = collectTemplatePlaceholders(template.system_prompt, template.user_prompt)
    for (const placeholder of placeholders) {
      if (!propertyKeys.has(placeholder)) {
        throw registryError(
          `Prompt template ${template.prompt_template_id}@${template.version} uses undeclared placeholder ${placeholder}`,
          {
            prompt_template_id: template.prompt_template_id,
            version: template.version,
            placeholder,
          },
        )
      }
    }
  }

  for (const line of Object.values(VOICE_LINE_CATALOG)) {
    for (const [tier, profileId] of Object.entries(line.tierProfileRefs)) {
      const profile = profilesById.get(profileId)
      if (!profile) {
        throw registryError(
          `Voice line catalog tierProfileRefs references unknown profile ${profileId}`,
          { voice_line_id: line.id, tier, profile_id: profileId },
        )
      }
      if (profile.voice_line_id !== line.id || profile.tier !== tier) {
        throw registryError(
          `Voice line catalog tierProfileRefs mismatch for ${line.id}/${tier}`,
          {
            voice_line_id: line.id,
            tier,
            profile_id: profileId,
            profile_voice_line_id: profile.voice_line_id,
            profile_tier: profile.tier,
          },
        )
      }
    }

    for (const [intent, tierMap] of Object.entries(line.intentProfileRefs)) {
      for (const [tier, profileId] of Object.entries(tierMap ?? {})) {
        const profile = profilesById.get(profileId)
        if (!profile) {
          throw registryError(
            `Voice line catalog references unknown profile ${profileId}`,
            { voice_line_id: line.id, intent, tier, profile_id: profileId },
          )
        }
        if (profile.voice_line_id !== line.id || profile.intent !== intent || profile.tier !== tier) {
          throw registryError(
            `Voice line catalog mapping mismatch for ${line.id}/${intent}/${tier}`,
            {
              voice_line_id: line.id,
              intent,
              tier,
              profile_id: profileId,
              profile_voice_line_id: profile.voice_line_id,
              profile_intent: profile.intent,
              profile_tier: profile.tier,
            },
          )
        }
      }
    }

    if (line.identityWriteProfileRef) {
      const profile = profilesById.get(line.identityWriteProfileRef)
      if (!profile) {
        throw registryError(
          `Voice line ${line.id} identityWriteProfileRef points to unknown profile ${line.identityWriteProfileRef}`,
          { voice_line_id: line.id, profile_id: line.identityWriteProfileRef },
        )
      }
      if (
        profile.voice_line_id !== line.id ||
        profile.intent !== 'identity_write' ||
        profile.visibility !== 'identity_write'
      ) {
        throw registryError(
          `Voice line ${line.id} identityWriteProfileRef must resolve to an identity_write profile`,
          {
            voice_line_id: line.id,
            profile_id: line.identityWriteProfileRef,
            profile_intent: profile.intent,
            profile_visibility: profile.visibility,
          },
        )
      }
    }
  }
}

function parseYamlFile<T>(
  path: string,
  schema: z.ZodType<T>,
  label: string,
): T {
  let raw: string
  try {
    raw = readFileSync(path, 'utf-8')
  } catch (error) {
    throw registryError(`Failed to read ${label}`, {
      registry_path: path,
      cause: error instanceof Error ? error.message : 'Unknown file read error',
    })
  }

  let parsed: unknown

  try {
    parsed = parseYaml(raw)
  } catch (error) {
    throw registryError(`Failed to parse ${label}`, {
      registry_path: path,
      cause: error instanceof Error ? error.message : 'Unknown YAML parse error',
    })
  }

  const result = schema.safeParse(parsed)
  if (!result.success) {
    throw registryError(`Invalid ${label}`, {
      registry_path: path,
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }

  return result.data
}

function assertUnique(values: string[], label: string): void {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index)
  if (duplicates.length === 0) return

  throw registryError(`Duplicate ${label}: ${Array.from(new Set(duplicates)).join(', ')}`)
}

function collectTemplatePlaceholders(...templates: string[]): Set<string> {
  const placeholders = new Set<string>()
  for (const template of templates) {
    for (const match of template.matchAll(/\{\{(\w+)\}\}/g)) {
      placeholders.add(match[1])
    }
  }
  return placeholders
}

function registryError(message: string, details?: Record<string, unknown>): LLMGatewayContractError {
  return new LLMGatewayContractError('RegistryResolutionError', message, details)
}

function defaultRegistryPath(fileName: string): string {
  const here = dirname(fileURLToPath(import.meta.url))
  return resolve(here, '../../../.ai/llm-config/registry', fileName)
}
