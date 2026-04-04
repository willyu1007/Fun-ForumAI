#!/usr/bin/env node

/**
 * LLM Registry Validator
 *
 * Validates the repo's LLM SSOT registries under:
 *   .ai/llm-config/registry/*
 *
 * Usage:
 *   node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs
 *   node .../validate-llm-registry.mjs --strict
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const VALID_TIERS = new Set(['lite', 'base', 'premium'])
const VALID_VISIBILITIES = new Set(['visible', 'hidden', 'identity_write', 'dev_only'])
const VALID_INTENTS = new Set([
  'forum_reply',
  'chat_reply',
  'scheduled_post',
  'private_reply',
  'proactive_opening',
  'public_observation_digest',
  'private_digest',
  'vision_summary',
  'identity_write',
  'director_plan',
])
const VALID_FALLBACK_LEVELS = new Set([
  'same-line',
  'same-family',
  'cross-family-hidden',
  'rare-reanchor',
])
const VALID_MODALITIES = new Set(['text', 'vision'])
const VALID_RESPONSE_MODES = new Set(['text', 'json_object', 'json_schema', 'tool'])
const VALID_ROUTE_ORDER_STEPS = new Set([
  'intent_scene_fit',
  'voice_line_tier',
  'profile_candidates',
  'region_policy',
  'headroom',
  'health',
])
const VALID_QUALITY_CLASSES = new Set(['fast', 'balanced', 'premium'])
const VALID_ADMISSION_STATES = new Set(['admitted', 'shadow', 'blocked'])
const VALID_COMPARE_DIMENSIONS = new Set([
  'persona_lock',
  'emotional_continuity',
  'watchability',
  'callback_fidelity',
])
const VALID_CORE_FAMILIES = new Set(['hearth', 'blade', 'spark', 'sage', 'anchor'])
const VALID_ADAPTER_REQUEST_SHAPES = new Set(['chat', 'responses', 'messages', 'native_multimodal'])
const VALID_ADAPTER_TRANSPORTS = new Set(['chat_completions'])
const VALID_ADAPTER_AUTH_STRATEGIES = new Set(['bearer_api_key', 'x_api_key', 'custom'])
const VALID_OVERRIDE_FIELDS = new Set([
  'temperature',
  'maxTokens',
  'stop',
  'executionPolicyId',
  'timeoutMs',
  'maxRetries',
  'regionHint',
])

const colors = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
}

function die(msg) {
  console.error(colors.red(msg))
  process.exit(1)
}

function warn(msg) {
  console.warn(colors.yellow(msg))
}

function main() {
  const strict = process.argv.includes('--strict')

  console.log(colors.cyan('========================================'))
  console.log(colors.cyan('  LLM Registry Validator'))
  console.log(colors.cyan('========================================'))
  console.log(
    colors.gray(
      `Mode: ${strict ? 'STRICT (template placeholders are errors)' : 'STANDARD (template placeholders are warnings)'}`,
    ),
  )
  console.log('')

  const repoRoot = findRepoRoot(__dirname)
  if (!repoRoot) {
    die('Unable to locate repo root (expected `.ai/llm-config/registry/config_keys.yaml`).')
  }

  const registryDir = path.join(repoRoot, '.ai', 'llm-config', 'registry')
  const validVoiceLineIds = loadVoiceLineIds(repoRoot)
  const files = {
    providers: path.join(registryDir, 'providers.yaml'),
    profiles: path.join(registryDir, 'model_profiles.yaml'),
    routingPolicies: path.join(registryDir, 'routing_policies.yaml'),
    executionPolicies: path.join(registryDir, 'execution_policies.yaml'),
    adapterBindings: path.join(registryDir, 'adapter_bindings.yaml'),
    modelPricing: path.join(registryDir, 'model_pricing.yaml'),
    modelCapabilities: path.join(registryDir, 'model_capabilities.yaml'),
    providerAdmission: path.join(registryDir, 'provider_admission.yaml'),
    prompts: path.join(registryDir, 'prompt_templates.yaml'),
    configKeys: path.join(registryDir, 'config_keys.yaml'),
  }

  for (const [key, filePath] of Object.entries(files)) {
    if (!fs.existsSync(filePath)) {
      die(`Missing registry file: ${path.relative(repoRoot, filePath)} (${key})`)
    }
  }

  const rawProviders = readYamlFile(files.providers, 'providers.yaml')
  const rawProfiles = readYamlFile(files.profiles, 'model_profiles.yaml')
  const rawRoutingPolicies = readYamlFile(files.routingPolicies, 'routing_policies.yaml')
  const rawExecutionPolicies = readYamlFile(files.executionPolicies, 'execution_policies.yaml')
  const rawAdapterBindings = readYamlFile(files.adapterBindings, 'adapter_bindings.yaml')
  const rawModelPricing = readYamlFile(files.modelPricing, 'model_pricing.yaml')
  const rawModelCapabilities = readYamlFile(files.modelCapabilities, 'model_capabilities.yaml')
  const rawProviderAdmission = readYamlFile(files.providerAdmission, 'provider_admission.yaml')
  const rawPrompts = readYamlFile(files.prompts, 'prompt_templates.yaml')
  const rawConfig = readFileSafe(files.configKeys)

  if (!rawConfig) {
    die('Failed to read config_keys.yaml')
  }

  const providers = parseRegistry(rawProviders, 'providers.yaml')
  const profiles = parseRegistry(rawProfiles, 'model_profiles.yaml')
  const routingPolicies = parseRegistry(rawRoutingPolicies, 'routing_policies.yaml')
  const executionPolicies = parseRegistry(rawExecutionPolicies, 'execution_policies.yaml')
  const adapterBindings = parseRegistry(rawAdapterBindings, 'adapter_bindings.yaml')
  const modelPricing = parseRegistry(rawModelPricing, 'model_pricing.yaml')
  const modelCapabilities = parseRegistry(rawModelCapabilities, 'model_capabilities.yaml')
  const providerAdmission = parseRegistry(rawProviderAdmission, 'provider_admission.yaml')
  const prompts = parseRegistry(rawPrompts, 'prompt_templates.yaml')

  validateVersion(providers, 'providers.yaml')
  validateVersion(profiles, 'model_profiles.yaml')
  validateVersion(routingPolicies, 'routing_policies.yaml')
  validateVersion(executionPolicies, 'execution_policies.yaml')
  validateVersion(adapterBindings, 'adapter_bindings.yaml')
  validateVersion(modelPricing, 'model_pricing.yaml')
  validateVersion(modelCapabilities, 'model_capabilities.yaml')
  validateVersion(providerAdmission, 'provider_admission.yaml')
  validateVersion(prompts, 'prompt_templates.yaml')
  validateConfigVersion(rawConfig)

  validateProviders(providers)
  validateProfiles(profiles, providers, validVoiceLineIds)
  validateRoutingPolicies(routingPolicies, profiles)
  validateExecutionPolicies(executionPolicies, profiles)
  validateAdapterBindings(adapterBindings, providers)
  validateModelPricing(modelPricing, providers)
  validateModelCapabilities(modelCapabilities, providers)
  validateProfileCapabilityCoverage(
    profiles,
    executionPolicies,
    modelPricing,
    modelCapabilities,
    providers,
    adapterBindings,
  )
  validateProviderAdmission(providerAdmission, providers, profiles, validVoiceLineIds)
  validatePromptTemplates(prompts)
  validateTemplateMode(strict, rawProviders, rawProfiles, rawPrompts, rawConfig)

  const providerIds = providers.providers.map((entry) => entry.provider_id)
  const profileIds = profiles.profiles.map((entry) => entry.profile_id)
  const routingPolicyIds = routingPolicies.policies.map((entry) => entry.profile_id)
  const executionPolicyIds = executionPolicies.policies.map((entry) => entry.policy_id)
  const adapterIds = adapterBindings.bindings.map((entry) => entry.adapterId)
  const pricingKeys = modelPricing.pricing.map(
    (entry) => `${entry.provider_id}/${entry.model_id}`,
  )
  const capabilityKeys = modelCapabilities.capabilities.map(
    (entry) => `${entry.provider_id}/${entry.model_id}`,
  )
  const providerAdmissionPools = providerAdmission.pools.map((entry) => entry.voice_line_id)
  const promptPairs = prompts.templates.map(
    (entry) => `${entry.prompt_template_id}@${entry.version}`,
  )
  const configKeys = parseConfigKeys(rawConfig)

  console.log(colors.gray(`Registry dir: ${path.relative(repoRoot, registryDir)}`))
  console.log(colors.gray(`Providers: ${providerIds.length}`))
  console.log(colors.gray(`Profiles: ${profileIds.length}`))
  console.log(colors.gray(`Routing policies: ${routingPolicyIds.length}`))
  console.log(colors.gray(`Execution policies: ${executionPolicyIds.length}`))
  console.log(colors.gray(`Adapter bindings: ${adapterIds.length}`))
  console.log(colors.gray(`Model pricing: ${pricingKeys.length}`))
  console.log(colors.gray(`Model capabilities: ${capabilityKeys.length}`))
  console.log(colors.gray(`Provider admission pools: ${providerAdmissionPools.length}`))
  console.log(colors.gray(`Prompt templates: ${promptPairs.length}`))
  console.log(colors.gray(`Config keys: ${configKeys.length}`))
  console.log('')
  console.log(colors.green('OK: registries are structurally and contractually valid.'))
}

function validateProviders(doc) {
  assertArray(doc.providers, 'providers.yaml providers')
  const providerIds = []

  for (const provider of doc.providers) {
    assertObject(provider, 'provider entry')
    const providerId = requireNonEmptyString(provider.provider_id, 'provider_id')
    providerIds.push(providerId)
    requireNonEmptyString(provider.display_name, `providers.${providerId}.display_name`)
    requireOneOf(
      provider.gateway_kind,
      ['openai_compatible', 'native'],
      `providers.${providerId}.gateway_kind`,
    )

    assertObject(provider.auth, `providers.${providerId}.auth`)
    requireOneOf(provider.auth.type, ['api_key'], `providers.${providerId}.auth.type`)
    requireOneOf(
      provider.auth.source,
      ['credential_pool'],
      `providers.${providerId}.auth.source`,
    )
    requireOneOf(
      provider.auth.auth_strategy,
      Array.from(VALID_ADAPTER_AUTH_STRATEGIES),
      `providers.${providerId}.auth.auth_strategy`,
    )
    if ('credential_ref_required' in provider.auth || 'credential_ref' in provider.auth) {
      die(
        `providers.${providerId}.auth must be metadata-only; provider-level credential_ref fields are no longer allowed`,
      )
    }

    assertObject(provider.routing, `providers.${providerId}.routing`)
    assertArray(provider.routing.regions, `providers.${providerId}.routing.regions`)
    if (provider.routing.regions.length === 0) {
      die(`providers.${providerId}.routing.regions must contain at least one region`)
    }
    provider.routing.regions.forEach((region, index) => {
      requireNonEmptyString(region, `providers.${providerId}.routing.regions[${index}]`)
    })
    const defaultRegion = requireNonEmptyString(
      provider.routing.default_region,
      `providers.${providerId}.routing.default_region`,
    )
    if (!provider.routing.regions.includes(defaultRegion)) {
      die(`providers.${providerId}.routing.default_region must be listed in routing.regions`)
    }

    assertObject(provider.capabilities, `providers.${providerId}.capabilities`)
    requireBoolean(provider.capabilities.chat, `providers.${providerId}.capabilities.chat`)
    requireBoolean(
      provider.capabilities.json_mode,
      `providers.${providerId}.capabilities.json_mode`,
    )
    requireBoolean(
      provider.capabilities.tool_calling,
      `providers.${providerId}.capabilities.tool_calling`,
    )
    requireBoolean(
      provider.capabilities.streaming,
      `providers.${providerId}.capabilities.streaming`,
    )

    assertObject(provider.defaults, `providers.${providerId}.defaults`)
    requirePositiveInteger(
      provider.defaults.timeout_ms,
      `providers.${providerId}.defaults.timeout_ms`,
    )
    requireNonNegativeInteger(
      provider.defaults.max_retries,
      `providers.${providerId}.defaults.max_retries`,
    )
  }

  assertUnique(providerIds, 'provider_id')
}

function validateProfiles(doc, providersDoc, validVoiceLineIds) {
  assertArray(doc.profiles, 'model_profiles.yaml profiles')
  const profileIds = []
  const providersById = new Map(providersDoc.providers.map((entry) => [entry.provider_id, entry]))

  for (const profile of doc.profiles) {
    assertObject(profile, 'profile entry')
    const profileId = requireNonEmptyString(profile.profile_id, 'profile_id')
    profileIds.push(profileId)

    const voiceLineId = requireNonEmptyString(
      profile.voice_line_id,
      `profiles.${profileId}.voice_line_id`,
    )
    if (!validVoiceLineIds.has(voiceLineId)) {
      die(
        `profiles.${profileId}.voice_line_id must be one of: ${Array.from(validVoiceLineIds).join(', ')}`,
      )
    }

    const tier = requireNonEmptyString(profile.tier, `profiles.${profileId}.tier`)
    if (!VALID_TIERS.has(tier)) {
      die(`profiles.${profileId}.tier must be one of: ${Array.from(VALID_TIERS).join(', ')}`)
    }

    const intent = requireNonEmptyString(profile.intent, `profiles.${profileId}.intent`)
    if (!VALID_INTENTS.has(intent)) {
      die(`profiles.${profileId}.intent must be one of: ${Array.from(VALID_INTENTS).join(', ')}`)
    }

    const visibility = requireNonEmptyString(profile.visibility, `profiles.${profileId}.visibility`)
    if (!VALID_VISIBILITIES.has(visibility)) {
      die(
        `profiles.${profileId}.visibility must be one of: ${Array.from(VALID_VISIBILITIES).join(', ')}`,
      )
    }
    if (visibility === 'dev_only') {
      die(`profiles.${profileId}.visibility cannot be dev_only in model_profiles.yaml`)
    }

    if (voiceLineId === 'deepseek-director-v1' && visibility !== 'hidden') {
      die(`profiles.${profileId} uses director line ${voiceLineId} but visibility is not hidden`)
    }
    if (visibility === 'identity_write' && intent !== 'identity_write') {
      die(`profiles.${profileId} visibility=identity_write requires intent=identity_write`)
    }

    assertArray(profile.candidates, `profiles.${profileId}.candidates`)
    if (profile.candidates.length === 0) {
      die(`profiles.${profileId}.candidates must contain at least one candidate`)
    }

    for (const [index, candidate] of profile.candidates.entries()) {
      assertObject(candidate, `profiles.${profileId}.candidates[${index}]`)
      const providerId = requireNonEmptyString(
        candidate.provider_id,
        `profiles.${profileId}.candidates[${index}].provider_id`,
      )
      const provider = providersById.get(providerId)
      if (!provider) {
        die(`profiles.${profileId} references unknown provider_id ${providerId}`)
      }
      requireNonEmptyString(
        candidate.model_id,
        `profiles.${profileId}.candidates[${index}].model_id`,
      )
      const region = requireNonEmptyString(
        candidate.region,
        `profiles.${profileId}.candidates[${index}].region`,
      )
      if (!provider.routing.regions.includes(region)) {
        die(
          `profiles.${profileId}.candidates[${index}].region=${region} is not allowed for provider ${providerId}`,
        )
      }
      requireNonEmptyString(
        candidate.endpoint_id,
        `profiles.${profileId}.candidates[${index}].endpoint_id`,
      )
      requirePositiveNumber(candidate.weight, `profiles.${profileId}.candidates[${index}].weight`)
      requireOneOf(
        candidate.quality_class,
        Array.from(VALID_QUALITY_CLASSES),
        `profiles.${profileId}.candidates[${index}].quality_class`,
      )
    }

    assertArray(profile.fallback, `profiles.${profileId}.fallback`)
    for (const [index, fallback] of profile.fallback.entries()) {
      assertObject(fallback, `profiles.${profileId}.fallback[${index}]`)
      requireOneOf(
        fallback.level,
        Array.from(VALID_FALLBACK_LEVELS),
        `profiles.${profileId}.fallback[${index}].level`,
      )
      requireNonEmptyString(fallback.reason, `profiles.${profileId}.fallback[${index}].reason`)
      if (fallback.profile_id !== undefined) {
        requireNonEmptyString(
          fallback.profile_id,
          `profiles.${profileId}.fallback[${index}].profile_id`,
        )
      }
      if (fallback.provider_id !== undefined) {
        requireNonEmptyString(
          fallback.provider_id,
          `profiles.${profileId}.fallback[${index}].provider_id`,
        )
      }
      if (fallback.model_id !== undefined) {
        requireNonEmptyString(
          fallback.model_id,
          `profiles.${profileId}.fallback[${index}].model_id`,
        )
      }
    }
  }

  assertUnique(profileIds, 'profile_id')

  const profileIdSet = new Set(profileIds)
  for (const profile of doc.profiles) {
    for (const fallback of profile.fallback) {
      if (fallback.profile_id && !profileIdSet.has(fallback.profile_id)) {
        die(
          `profiles.${profile.profile_id} fallback references unknown profile_id ${fallback.profile_id}`,
        )
      }
    }
  }
}

function validateRoutingPolicies(doc, profilesDoc) {
  assertArray(doc.policies, 'routing_policies.yaml policies')
  const policyProfileIds = []
  const profileIds = new Set((profilesDoc.profiles ?? []).map((entry) => entry.profile_id))

  for (const policy of doc.policies) {
    assertObject(policy, 'routing policy entry')
    const keys = Object.keys(policy).sort()
    if (keys.join(',') !== 'profile_id,route_order') {
      die(
        `routing_policies.${policy.profile_id ?? '<unknown>'} must only contain profile_id and route_order`,
      )
    }

    const profileId = requireNonEmptyString(policy.profile_id, 'routing_policies.profile_id')
    policyProfileIds.push(profileId)
    if (!profileIds.has(profileId)) {
      die(`routing_policies.${profileId} references unknown profile_id`)
    }

    assertArray(policy.route_order, `routing_policies.${profileId}.route_order`)
    if (policy.route_order.length === 0) {
      die(`routing_policies.${profileId}.route_order must contain at least one entry`)
    }
    for (const [index, step] of policy.route_order.entries()) {
      if (!VALID_ROUTE_ORDER_STEPS.has(step)) {
        die(
          `routing_policies.${profileId}.route_order[${index}] must be one of: ${Array.from(VALID_ROUTE_ORDER_STEPS).join(', ')}`,
        )
      }
    }
  }

  assertUnique(policyProfileIds, 'routing policy profile_id')
  for (const profileId of profileIds) {
    if (!policyProfileIds.includes(profileId)) {
      die(`model profile ${profileId} is missing a routing policy`)
    }
  }
}

function validateExecutionPolicies(doc, profilesDoc) {
  assertArray(doc.policies, 'execution_policies.yaml policies')
  const policyIds = []
  const seenLanes = new Set()

  for (const policy of doc.policies) {
    assertObject(policy, 'execution policy entry')
    const policyId = requireNonEmptyString(policy.policy_id, 'execution_policies.policy_id')
    policyIds.push(policyId)
    requireNonEmptyString(policy.lane, `execution_policies.${policyId}.lane`)
    seenLanes.add(policy.lane)

    requireOneOf(
      policy.modality,
      Array.from(VALID_MODALITIES),
      `execution_policies.${policyId}.modality`,
    )
    requireOneOf(
      policy.response_mode,
      Array.from(VALID_RESPONSE_MODES),
      `execution_policies.${policyId}.response_mode`,
    )

    assertObject(policy.defaults, `execution_policies.${policyId}.defaults`)
    if (policy.defaults.temperature !== undefined) {
      requireNumber(policy.defaults.temperature, `execution_policies.${policyId}.defaults.temperature`)
    }
    if (policy.defaults.max_tokens !== undefined) {
      requirePositiveInteger(
        policy.defaults.max_tokens,
        `execution_policies.${policyId}.defaults.max_tokens`,
      )
    }
    if (policy.defaults.stop !== undefined) {
      assertArray(policy.defaults.stop, `execution_policies.${policyId}.defaults.stop`)
      if (policy.defaults.stop.length === 0) {
        die(`execution_policies.${policyId}.defaults.stop must contain at least one string`)
      }
      for (const [index, stopToken] of policy.defaults.stop.entries()) {
        requireNonEmptyString(
          stopToken,
          `execution_policies.${policyId}.defaults.stop[${index}]`,
        )
      }
    }
    requirePositiveInteger(
      policy.defaults.timeout_ms,
      `execution_policies.${policyId}.defaults.timeout_ms`,
    )
    requireNonNegativeInteger(
      policy.defaults.max_retries,
      `execution_policies.${policyId}.defaults.max_retries`,
    )

    assertObject(policy.fallback, `execution_policies.${policyId}.fallback`)
    requireBoolean(
      policy.fallback.allow_fallback_within_line,
      `execution_policies.${policyId}.fallback.allow_fallback_within_line`,
    )
    requireBoolean(
      policy.fallback.allow_cross_family,
      `execution_policies.${policyId}.fallback.allow_cross_family`,
    )
    assertArray(
      policy.fallback.allowed_fallback_levels,
      `execution_policies.${policyId}.fallback.allowed_fallback_levels`,
    )
    if (policy.fallback.allowed_fallback_levels.length === 0) {
      die(`execution_policies.${policyId}.fallback.allowed_fallback_levels must not be empty`)
    }
    for (const [index, level] of policy.fallback.allowed_fallback_levels.entries()) {
      requireOneOf(
        level,
        ['none', ...Array.from(VALID_FALLBACK_LEVELS)],
        `execution_policies.${policyId}.fallback.allowed_fallback_levels[${index}]`,
      )
    }

    assertObject(policy.merge, `execution_policies.${policyId}.merge`)
    validateOverrideFields(
      policy.merge.allow_callsite_override_fields,
      `execution_policies.${policyId}.merge.allow_callsite_override_fields`,
    )
    validateOverrideFields(
      policy.merge.allow_debug_override_fields,
      `execution_policies.${policyId}.merge.allow_debug_override_fields`,
    )
  }

  assertUnique(policyIds, 'execution policy policy_id')
  for (const profile of profilesDoc.profiles ?? []) {
    const expectedPolicyId = profile.policy_id ?? defaultExecutionPolicyIdForProfile(profile)
    if (!policyIds.includes(expectedPolicyId)) {
      die(`model profile ${profile.profile_id} is missing execution policy ${expectedPolicyId}`)
    }
    const expectedLane = defaultExecutionLaneForProfile(profile)
    if (!seenLanes.has(expectedLane)) {
      die(`model profile ${profile.profile_id} requires execution lane ${expectedLane}, but it is missing`)
    }
  }
}

function validateAdapterBindings(doc, providersDoc) {
  assertArray(doc.bindings, 'adapter_bindings.yaml bindings')
  const adapterIds = []
  const providerGatewayKinds = new Set(['openai_compatible', 'native'])

  for (const binding of doc.bindings) {
    assertObject(binding, 'adapter binding entry')
    const adapterId = requireNonEmptyString(binding.adapterId, 'adapter_bindings.adapterId')
    adapterIds.push(adapterId)
    requireOneOf(
      binding.requestShape,
      Array.from(VALID_ADAPTER_REQUEST_SHAPES),
      `adapter_bindings.${adapterId}.requestShape`,
    )
    requireOneOf(
      binding.transport,
      Array.from(VALID_ADAPTER_TRANSPORTS),
      `adapter_bindings.${adapterId}.transport`,
    )
    assertArray(binding.providerGatewayKinds, `adapter_bindings.${adapterId}.providerGatewayKinds`)
    if (binding.providerGatewayKinds.length === 0) {
      die(`adapter_bindings.${adapterId}.providerGatewayKinds must contain at least one entry`)
    }
    for (const [index, gatewayKind] of binding.providerGatewayKinds.entries()) {
      if (!providerGatewayKinds.has(gatewayKind)) {
        die(`adapter_bindings.${adapterId}.providerGatewayKinds[${index}] references unknown gateway kind ${gatewayKind}`)
      }
    }
    assertObject(binding.supports, `adapter_bindings.${adapterId}.supports`)
    requireBoolean(binding.supports.chat, `adapter_bindings.${adapterId}.supports.chat`)
    requireBoolean(binding.supports.vision, `adapter_bindings.${adapterId}.supports.vision`)
    requireBoolean(binding.supports.jsonMode, `adapter_bindings.${adapterId}.supports.jsonMode`)
    requireBoolean(
      binding.supports.structuredOutput,
      `adapter_bindings.${adapterId}.supports.structuredOutput`,
    )
    requireBoolean(
      binding.supports.toolCalling,
      `adapter_bindings.${adapterId}.supports.toolCalling`,
    )
    requireBoolean(binding.supports.streaming, `adapter_bindings.${adapterId}.supports.streaming`)
    requireOneOf(
      binding.authStrategy,
      Array.from(VALID_ADAPTER_AUTH_STRATEGIES),
      `adapter_bindings.${adapterId}.authStrategy`,
    )
  }

  assertUnique(adapterIds, 'adapter binding adapterId')
}

function validateModelCapabilities(doc, providersDoc) {
  assertArray(doc.capabilities, 'model_capabilities.yaml capabilities')
  const capabilityKeys = []
  const providerIds = new Set((providersDoc.providers ?? []).map((entry) => entry.provider_id))

  for (const capability of doc.capabilities) {
    assertObject(capability, 'model capability entry')
    const providerId = requireNonEmptyString(
      capability.provider_id,
      'model_capabilities.provider_id',
    )
    const modelId = requireNonEmptyString(capability.model_id, 'model_capabilities.model_id')
    const capabilityKey = `${providerId}/${modelId}`
    capabilityKeys.push(capabilityKey)
    if (!providerIds.has(providerId)) {
      die(`model_capabilities.${capabilityKey} references unknown provider_id`)
    }
    requirePositiveInteger(
      capability.input_window_tokens,
      `model_capabilities.${capabilityKey}.input_window_tokens`,
    )
    requirePositiveInteger(
      capability.max_output_tokens,
      `model_capabilities.${capabilityKey}.max_output_tokens`,
    )
    if (capability.recommended_operating_input_tokens !== undefined) {
      requirePositiveInteger(
        capability.recommended_operating_input_tokens,
        `model_capabilities.${capabilityKey}.recommended_operating_input_tokens`,
      )
    }
    assertArray(capability.modalities, `model_capabilities.${capabilityKey}.modalities`)
    if (capability.modalities.length === 0) {
      die(`model_capabilities.${capabilityKey}.modalities must not be empty`)
    }
    for (const [index, modality] of capability.modalities.entries()) {
      requireOneOf(
        modality,
        Array.from(VALID_MODALITIES),
        `model_capabilities.${capabilityKey}.modalities[${index}]`,
      )
    }
    assertArray(capability.response_modes, `model_capabilities.${capabilityKey}.response_modes`)
    if (capability.response_modes.length === 0) {
      die(`model_capabilities.${capabilityKey}.response_modes must not be empty`)
    }
    for (const [index, responseMode] of capability.response_modes.entries()) {
      requireOneOf(
        responseMode,
        Array.from(VALID_RESPONSE_MODES),
        `model_capabilities.${capabilityKey}.response_modes[${index}]`,
      )
    }
  }

  assertUnique(capabilityKeys, 'model capability provider_id/model_id')
}

function validateModelPricing(doc, providersDoc) {
  assertArray(doc.pricing, 'model_pricing.yaml pricing')
  const pricingKeys = []
  const providerIds = new Set((providersDoc.providers ?? []).map((entry) => entry.provider_id))

  for (const entry of doc.pricing) {
    assertObject(entry, 'model pricing entry')
    const providerId = requireNonEmptyString(entry.provider_id, 'model_pricing.provider_id')
    const modelId = requireNonEmptyString(entry.model_id, 'model_pricing.model_id')
    const pricingKey = `${providerId}/${modelId}`
    pricingKeys.push(pricingKey)
    if (!providerIds.has(providerId)) {
      die(`model_pricing.${pricingKey} references unknown provider_id`)
    }
    requireNonNegativeNumber(
      entry.prompt_per_1k_cny,
      `model_pricing.${pricingKey}.prompt_per_1k_cny`,
    )
    requireNonNegativeNumber(
      entry.completion_per_1k_cny,
      `model_pricing.${pricingKey}.completion_per_1k_cny`,
    )
  }

  assertUnique(pricingKeys, 'model pricing provider_id/model_id')
}

function validateProfileCapabilityCoverage(
  profilesDoc,
  executionPoliciesDoc,
  modelPricingDoc,
  modelCapabilitiesDoc,
  providersDoc,
  adapterBindingsDoc,
) {
  const pricingByKey = new Map(
    (modelPricingDoc.pricing ?? []).map((entry) => [
      `${entry.provider_id}/${entry.model_id}`,
      entry,
    ]),
  )
  const capabilitiesByKey = new Map(
    (modelCapabilitiesDoc.capabilities ?? []).map((entry) => [
      `${entry.provider_id}/${entry.model_id}`,
      entry,
    ]),
  )
  const executionPoliciesById = new Map(
    (executionPoliciesDoc.policies ?? []).map((entry) => [entry.policy_id, entry]),
  )
  const providersById = new Map(
    (providersDoc.providers ?? []).map((entry) => [entry.provider_id, entry]),
  )
  const adaptersById = new Map(
    (adapterBindingsDoc.bindings ?? []).map((entry) => [entry.adapterId, entry]),
  )

  for (const profile of profilesDoc.profiles ?? []) {
    const policyId = profile.policy_id ?? defaultExecutionPolicyIdForProfile(profile)
    const policy = executionPoliciesById.get(policyId)
    if (!policy) {
      die(`model profile ${profile.profile_id} is missing execution policy ${policyId}`)
    }

    for (const candidate of profile.candidates ?? []) {
      const candidateKey = `${candidate.provider_id}/${candidate.model_id}`
      const capability = capabilitiesByKey.get(candidateKey)
      if (!capability) {
        die(`profiles.${profile.profile_id} candidate ${candidateKey} is missing model_capabilities metadata`)
      }
      if (!pricingByKey.has(candidateKey)) {
        die(`profiles.${profile.profile_id} candidate ${candidateKey} is missing model_pricing metadata`)
      }

      const provider = providersById.get(candidate.provider_id)
      const adapterId = candidate.adapter_id ?? defaultAdapterIdForCandidate(candidate)
      const adapter = adaptersById.get(adapterId)
      if (!provider) {
        die(`profiles.${profile.profile_id} candidate ${candidateKey} references unknown provider ${candidate.provider_id}`)
      }
      if (!adapter) {
        die(`profiles.${profile.profile_id} candidate ${candidateKey} references unknown adapter ${adapterId}`)
      }

      if (!supportsCapabilityModality(capability, policy.modality)) {
        die(
          `profiles.${profile.profile_id} candidate ${candidateKey} does not satisfy modality ${policy.modality} for policy ${policyId}`,
        )
      }
      if (!supportsCapabilityResponseMode(provider, adapter, capability, policy.response_mode)) {
        die(
          `profiles.${profile.profile_id} candidate ${candidateKey} does not satisfy response_mode ${policy.response_mode} for policy ${policyId}`,
        )
      }
    }
  }
}

function validateProviderAdmission(doc, providersDoc, profilesDoc, validVoiceLineIds) {
  assertArray(doc.pools, 'provider_admission.yaml pools')
  const voiceLineIds = []
  const providersById = new Map(providersDoc.providers.map((entry) => [entry.provider_id, entry]))
  const visibleProfilesByVoiceLine = new Map()

  for (const profile of profilesDoc.profiles ?? []) {
    if (profile.visibility !== 'visible') continue
    const current = visibleProfilesByVoiceLine.get(profile.voice_line_id) ?? []
    current.push(profile)
    visibleProfilesByVoiceLine.set(profile.voice_line_id, current)
  }

  for (const pool of doc.pools) {
    assertObject(pool, 'provider admission pool')
    const voiceLineId = requireNonEmptyString(
      pool.voice_line_id,
      'provider_admission.voice_line_id',
    )
    voiceLineIds.push(voiceLineId)
    if (!validVoiceLineIds.has(voiceLineId)) {
      die(
        `provider_admission.${voiceLineId}.voice_line_id must be one of: ${Array.from(validVoiceLineIds).join(', ')}`,
      )
    }
    const coreFamily = requireNonEmptyString(
      pool.core_family,
      `provider_admission.${voiceLineId}.core_family`,
    )
    if (!VALID_CORE_FAMILIES.has(coreFamily)) {
      die(
        `provider_admission.${voiceLineId}.core_family must be one of: ${Array.from(VALID_CORE_FAMILIES).join(', ')}`,
      )
    }
    assertArray(pool.compare_dimensions, `provider_admission.${voiceLineId}.compare_dimensions`)
    if (pool.compare_dimensions.length === 0) {
      die(`provider_admission.${voiceLineId}.compare_dimensions must contain at least one entry`)
    }
    for (const [index, dimension] of pool.compare_dimensions.entries()) {
      if (!VALID_COMPARE_DIMENSIONS.has(dimension)) {
        die(
          `provider_admission.${voiceLineId}.compare_dimensions[${index}] must be one of: ${Array.from(VALID_COMPARE_DIMENSIONS).join(', ')}`,
        )
      }
    }

    assertArray(pool.candidates, `provider_admission.${voiceLineId}.candidates`)
    if (pool.candidates.length === 0) {
      die(`provider_admission.${voiceLineId}.candidates must contain at least one candidate`)
    }
    const candidateKeys = []
    for (const [index, candidate] of pool.candidates.entries()) {
      assertObject(candidate, `provider_admission.${voiceLineId}.candidates[${index}]`)
      const providerId = requireNonEmptyString(
        candidate.provider_id,
        `provider_admission.${voiceLineId}.candidates[${index}].provider_id`,
      )
      const modelId = requireNonEmptyString(
        candidate.model_id,
        `provider_admission.${voiceLineId}.candidates[${index}].model_id`,
      )
      candidateKeys.push(`${providerId}/${modelId}`)
      if (!providersById.has(providerId)) {
        die(`provider_admission.${voiceLineId} references unknown provider_id ${providerId}`)
      }
      const admission = requireNonEmptyString(
        candidate.admission,
        `provider_admission.${voiceLineId}.candidates[${index}].admission`,
      )
      if (!VALID_ADMISSION_STATES.has(admission)) {
        die(
          `provider_admission.${voiceLineId}.candidates[${index}].admission must be one of: ${Array.from(VALID_ADMISSION_STATES).join(', ')}`,
        )
      }
      if (candidate.compare_baseline_model_id !== undefined) {
        requireNonEmptyString(
          candidate.compare_baseline_model_id,
          `provider_admission.${voiceLineId}.candidates[${index}].compare_baseline_model_id`,
        )
      }
    }
    assertUnique(candidateKeys, `provider_admission candidate key for ${voiceLineId}`)

    const profiles = visibleProfilesByVoiceLine.get(voiceLineId) ?? []
    for (const profile of profiles) {
      const admittedCount = profile.candidates.filter((candidate) =>
        pool.candidates.some(
          (entry) =>
            entry.provider_id === candidate.provider_id &&
            entry.model_id === candidate.model_id &&
            entry.admission === 'admitted',
        ),
      ).length
      if (admittedCount === 0) {
        die(
          `Visible profile ${profile.profile_id} has no admitted candidates in provider_admission.yaml`,
        )
      }
    }
  }

  assertUnique(voiceLineIds, 'provider_admission voice_line_id')
  for (const voiceLineId of visibleProfilesByVoiceLine.keys()) {
    if (!voiceLineIds.includes(voiceLineId)) {
      die(`Visible voice line ${voiceLineId} is missing from provider_admission.yaml`)
    }
  }
}

function loadVoiceLineIds(repoRoot) {
  const personaCatalogPath = path.join(repoRoot, 'src', 'shared', 'agent-persona-catalog.ts')
  const raw = readFileSafe(personaCatalogPath)
  if (!raw) {
    die('Failed to read src/shared/agent-persona-catalog.ts')
  }

  const match = raw.match(/export const VOICE_LINE_IDS = \[([\s\S]*?)\] as const/u)
  if (!match) {
    die('Unable to parse VOICE_LINE_IDS from src/shared/agent-persona-catalog.ts')
  }

  const ids = Array.from(match[1].matchAll(/'([^']+)'/g), (entry) => entry[1])
  if (ids.length === 0) {
    die('VOICE_LINE_IDS in src/shared/agent-persona-catalog.ts is empty')
  }

  return new Set(ids)
}

function validatePromptTemplates(doc) {
  assertArray(doc.templates, 'prompt_templates.yaml templates')
  const promptPairs = []

  for (const template of doc.templates) {
    assertObject(template, 'prompt template entry')
    const templateId = requireNonEmptyString(template.prompt_template_id, 'prompt_template_id')
    const version = requirePositiveInteger(template.version, `templates.${templateId}.version`)
    promptPairs.push(`${templateId}@${version}`)
    requireNonEmptyString(template.description, `templates.${templateId}.description`)
    requireNonEmptyString(template.system_prompt, `templates.${templateId}.system_prompt`)
    requireNonEmptyString(template.user_prompt, `templates.${templateId}.user_prompt`)

    assertObject(template.variables_schema, `templates.${templateId}.variables_schema`)
    if (template.variables_schema.type !== 'object') {
      die(`templates.${templateId}.variables_schema.type must be "object"`)
    }

    assertObject(
      template.variables_schema.properties,
      `templates.${templateId}.variables_schema.properties`,
    )
    const propertyKeys = Object.keys(template.variables_schema.properties)
    if (propertyKeys.length === 0) {
      die(`templates.${templateId}.variables_schema.properties must define at least one key`)
    }

    for (const key of propertyKeys) {
      assertObject(
        template.variables_schema.properties[key],
        `templates.${templateId}.variables_schema.properties.${key}`,
      )
      if (template.variables_schema.properties[key].type !== 'string') {
        die(`templates.${templateId}.variables_schema.properties.${key}.type must be "string"`)
      }
    }

    assertArray(
      template.variables_schema.required,
      `templates.${templateId}.variables_schema.required`,
    )
    for (const requiredKey of template.variables_schema.required) {
      requireNonEmptyString(requiredKey, `templates.${templateId}.variables_schema.required[]`)
      if (!propertyKeys.includes(requiredKey)) {
        die(
          `templates.${templateId}.variables_schema.required references undeclared property ${requiredKey}`,
        )
      }
    }

    const placeholders = collectTemplatePlaceholders(template.system_prompt, template.user_prompt)
    for (const placeholder of placeholders) {
      if (!propertyKeys.includes(placeholder)) {
        die(`templates.${templateId}@${version} uses undeclared placeholder ${placeholder}`)
      }
    }
  }

  assertUnique(promptPairs, 'prompt_template_id@version')
}

function validateTemplateMode(strict, ...rawFiles) {
  const warnings = []
  const labels = [
    'providers.yaml',
    'model_profiles.yaml',
    'prompt_templates.yaml',
    'config_keys.yaml',
  ]

  rawFiles.forEach((raw, index) => {
    if (hasTemplateHeader(raw)) {
      warnings.push(`${labels[index]} header still marked as (template)`)
    }
  })

  const placeholderIds = []
  const placeholderPattern = /^example\-/i

  const providers = parseRegistry(rawFiles[0], 'providers.yaml')
  providers.providers.forEach((entry) => {
    if (placeholderPattern.test(entry.provider_id)) {
      placeholderIds.push(`provider_id:${entry.provider_id}`)
    }
  })

  const profiles = parseRegistry(rawFiles[1], 'model_profiles.yaml')
  profiles.profiles.forEach((entry) => {
    if (placeholderPattern.test(entry.profile_id)) {
      placeholderIds.push(`profile_id:${entry.profile_id}`)
    }
  })

  const prompts = parseRegistry(rawFiles[2], 'prompt_templates.yaml')
  prompts.templates.forEach((entry) => {
    if (placeholderPattern.test(entry.prompt_template_id)) {
      placeholderIds.push(`prompt_template_id:${entry.prompt_template_id}`)
    }
  })

  if (placeholderIds.length) {
    warnings.push(
      `placeholder identifiers present: ${Array.from(new Set(placeholderIds)).join(', ')}`,
    )
  }

  if (warnings.length === 0) {
    return
  }

  if (strict) {
    die(
      `Registry still in TEMPLATE mode:\n- ${warnings.join('\n- ')}\n\nFix: replace placeholders with real org/project data (and remove "(template)" markers).`,
    )
  }

  console.log('')
  warn(
    'Registry appears to be in TEMPLATE mode (this is fine for the template repo, but not for production):',
  )
  warnings.forEach((item) => warn(`- ${item}`))
  console.log(
    colors.gray('Tip: run with `--strict` in CI to prevent shipping template registries.'),
  )
}

function validateVersion(doc, fileName) {
  if (!Number.isInteger(doc.version) || doc.version <= 0) {
    die(`${fileName} missing top-level \`version: <int>\``)
  }
}

function validateConfigVersion(rawConfig) {
  const match = rawConfig.match(/^\s*version\s*:\s*([0-9]+)\s*$/m)
  if (!match) {
    die('config_keys.yaml missing top-level `version: <int>`')
  }
}

function parseConfigKeys(raw) {
  const keys = []
  let mode = null

  raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      if (trimmed === 'keys:') {
        mode = 'keys'
        return
      }
      if (trimmed === 'scope_prefixes:') {
        mode = 'scope_prefixes'
        return
      }
      const match = trimmed.match(/^\-\s*(.+)\s*$/)
      if (!match) return
      if (mode === 'keys') {
        keys.push(match[1].replace(/^['"]|['"]$/g, ''))
      }
    })

  return keys
}

function collectTemplatePlaceholders(...templates) {
  const placeholders = new Set()
  templates.forEach((template) => {
    for (const match of String(template).matchAll(/\{\{(\w+)\}\}/g)) {
      placeholders.add(match[1])
    }
  })
  return placeholders
}

function assertUnique(values, label) {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index)
  if (duplicates.length > 0) {
    die(`Duplicate ${label}(s): ${Array.from(new Set(duplicates)).join(', ')}`)
  }
}

function validateOverrideFields(values, label) {
  assertArray(values, label)
  for (const [index, field] of values.entries()) {
    requireOneOf(field, Array.from(VALID_OVERRIDE_FIELDS), `${label}[${index}]`)
  }
  assertUnique(values, label)
}

function defaultExecutionPolicyIdForProfile(profile) {
  return `${profile.visibility}-${profile.intent}-${profile.tier}`
}

function defaultExecutionLaneForProfile(profile) {
  if (profile.visibility === 'identity_write' && profile.intent === 'identity_write') {
    return 'identity_write'
  }
  return `${profile.visibility}_${profile.intent}`
}

function defaultAdapterIdForCandidate(_candidate) {
  return 'openai-chat-completions-v1'
}

function supportsCapabilityModality(capability, modality) {
  return capability.modalities.includes(modality)
}

function supportsCapabilityResponseMode(provider, adapter, capability, responseMode) {
  const capabilitySupports = capability.response_modes.includes(responseMode)

  switch (responseMode) {
    case 'json_object':
      return Boolean(provider.capabilities.json_mode && adapter.supports.jsonMode && capabilitySupports)
    case 'json_schema':
      return Boolean(adapter.supports.structuredOutput && capabilitySupports)
    case 'tool':
      return Boolean(provider.capabilities.tool_calling && adapter.supports.toolCalling && capabilitySupports)
    case 'text':
    default:
      return capabilitySupports
  }
}

function requireNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    die(`${label} must be a finite number`)
  }
  return value
}

function requirePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    die(`${label} must be a positive integer`)
  }
  return value
}

function requireNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    die(`${label} must be a non-negative integer`)
  }
  return value
}

function requirePositiveNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    die(`${label} must be a positive number`)
  }
}

function requireNonNegativeNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    die(`${label} must be a non-negative number`)
  }
}

function requireBoolean(value, label) {
  if (typeof value !== 'boolean') {
    die(`${label} must be a boolean`)
  }
}

function requireOneOf(value, choices, label) {
  if (!choices.includes(value)) {
    die(`${label} must be one of: ${choices.join(', ')}`)
  }
  return value
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    die(`${label} must be a non-empty string`)
  }
  return value
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    die(`${label} must be an array`)
  }
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    die(`${label} must be an object`)
  }
}

function parseRegistry(raw, fileName) {
  try {
    return parseYaml(raw)
  } catch (error) {
    die(
      `Failed to parse ${fileName}: ${error instanceof Error ? error.message : 'Unknown YAML parse error'}`,
    )
  }
}

function readYamlFile(filePath, label) {
  const raw = readFileSafe(filePath)
  if (!raw) {
    die(`Failed to read ${label}`)
  }
  return raw
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return null
  }
}

function findRepoRoot(startDir) {
  let dir = startDir
  while (true) {
    const candidate = path.join(dir, '.ai', 'llm-config', 'registry', 'config_keys.yaml')
    if (fs.existsSync(candidate)) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

function hasTemplateHeader(raw) {
  const head = raw.split(/\r?\n/).slice(0, 5).join('\n')
  return head.toLowerCase().includes('(template)')
}

main()
