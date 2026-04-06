import { describe, expect, it } from 'vitest'
import {
  VOICE_LINE_CATALOG,
  type VoiceLineRoutingIntent,
} from '../../../shared/agent-persona-catalog.js'
import {
  defaultAdapterId,
  defaultExecutionPolicyId,
  loadLlmRegistryBundle,
  loadPromptTemplatesRegistry,
  validateLlmRegistryBundle,
} from '../registry-loader.js'
import {
  resolveIdentityWriteProfileRef,
  resolveVoiceLineTierProfileRef,
} from '../voice-line-routing.js'
import { PROMPT_TEMPLATE_REFS } from '../prompt-template-refs.js'

describe('LLM registry contract', () => {
  it('loads the full llm registry bundle under strict runtime validation', () => {
    const bundle = loadLlmRegistryBundle()

    expect(bundle.providers.providers.length).toBeGreaterThan(0)
    expect(bundle.modelProfiles.profiles.length).toBeGreaterThan(0)
    expect(bundle.promptTemplates.templates.length).toBeGreaterThan(0)
    expect(bundle.credentialPools.pools.length).toBeGreaterThan(0)
    expect(bundle.routingPolicies.policies.length).toBeGreaterThan(0)
    expect(bundle.executionPolicies.policies.length).toBeGreaterThan(0)
    expect(bundle.providerAdmission.pools.length).toBeGreaterThan(0)
  })

  it('resolves intent-aware voice-line tier profile refs from the shared voice-line catalog', () => {
    const bundle = loadLlmRegistryBundle()
    const profilesById = new Map(
      bundle.modelProfiles.profiles.map((entry) => [entry.profile_id, entry] as const),
    )

    for (const line of Object.values(VOICE_LINE_CATALOG)) {
      for (const [intent, tierMap] of Object.entries(line.intentProfileRefs)) {
        for (const [tier, expectedProfileId] of Object.entries(tierMap ?? {})) {
          const resolved = resolveVoiceLineTierProfileRef(
            line.id,
            intent as VoiceLineRoutingIntent,
            tier as 'lite' | 'base' | 'premium',
          )

          expect(resolved).toBe(expectedProfileId)

          const profile = profilesById.get(expectedProfileId)
          expect(profile).toBeDefined()
          expect(profile?.voice_line_id).toBe(line.id)
          expect(profile?.intent).toBe(intent)
          expect(profile?.tier).toBe(tier)
        }
      }
    }
  })

  it('keeps identity-write refs explicit and director lines hidden-only', () => {
    const visibleLines = Object.values(VOICE_LINE_CATALOG).filter((line) => line.visible)

    for (const line of visibleLines) {
      const profileId = resolveIdentityWriteProfileRef(line.id, 'premium')
      expect(profileId).toBeTruthy()
      expect(profileId).toBe(line.intentProfileRefs.identity_write?.premium)
    }

    const directorLine = VOICE_LINE_CATALOG['deepseek-director-v1']
    expect(directorLine.visible).toBe(false)
    expect(directorLine.directorOnly).toBe(true)
    expect(resolveIdentityWriteProfileRef('deepseek-director-v1', 'premium')).toBeNull()
    expect(resolveVoiceLineTierProfileRef('deepseek-director-v1', 'director_plan', 'base')).toBe(
      'deepseek-director-director-plan-base',
    )
    expect(resolveVoiceLineTierProfileRef('deepseek-director-v1', 'director_plan', 'premium')).toBe(
      'deepseek-director-director-plan-premium',
    )
  })

  it('keeps qwen identity-write tiers split between public and private adaptation lanes', () => {
    const bundle = loadLlmRegistryBundle()
    const profilesById = new Map(
      bundle.modelProfiles.profiles.map((entry) => [entry.profile_id, entry] as const),
    )

    expect(resolveIdentityWriteProfileRef('qwen-social-v1', 'base')).toBe(
      'qwen-social-identity-write-base',
    )
    expect(resolveIdentityWriteProfileRef('qwen-social-v1', 'premium')).toBe(
      'qwen-social-identity-write-premium',
    )
    expect(profilesById.get('qwen-social-identity-write-base')?.candidates[0]?.model_id).toBe(
      'qwen-plus-character',
    )
    expect(profilesById.get('qwen-social-identity-write-base')?.policy_id).toBe(
      'identity_write-identity_write-base',
    )
    expect(
      profilesById
        .get('qwen-social-identity-write-premium')
        ?.candidates.some((candidate) => candidate.model_id === 'qwen-plus-character'),
    ).toBe(true)
    expect(
      profilesById
        .get('qwen-social-identity-write-premium')
        ?.candidates.every((candidate) => candidate.adapter_id === 'openai-chat-completions-v1'),
    ).toBe(true)
  })

  it('keeps visible prompt refs registered in the prompt template registry', () => {
    const promptTemplates = loadPromptTemplatesRegistry()
    const promptTemplateKeys = new Set(
      promptTemplates.templates.map((entry) => `${entry.prompt_template_id}@${entry.version}`),
    )

    for (const promptRef of Object.values(PROMPT_TEMPLATE_REFS)) {
      expect(promptTemplateKeys.has(`${promptRef.id}@${promptRef.version}`)).toBe(true)
    }
  })

  it('keeps vision summary hidden profiles usable with dashscope multimodal credentials', () => {
    const bundle = loadLlmRegistryBundle()
    const profilesById = new Map(
      bundle.modelProfiles.profiles.map((entry) => [entry.profile_id, entry] as const),
    )
    const visionProfile = profilesById.get('deepseek-director-vision-summary-base')
    const dashscopeVisionPrimary = bundle.credentialPools.pools.find(
      (entry) => entry.credential_id === 'dashscope-vision-primary',
    )
    const dashscopePrimary = bundle.credentialPools.pools.find((entry) => entry.credential_id === 'dashscope-primary')

    expect(visionProfile?.candidates[0]).toMatchObject({
      provider_id: 'dashscope-openai',
      model_id: 'qwen-vl-plus',
    })
    expect(
      visionProfile?.candidates.some((candidate) =>
        candidate.provider_id === 'dashscope-openai' && candidate.model_id === 'qwen-vl-plus'),
    ).toBe(true)
    expect(
      visionProfile?.candidates.some((candidate) =>
        candidate.provider_id === 'dashscope-openai' && candidate.model_id === 'qwen-vl-max'),
    ).toBe(true)
    expect(
      visionProfile?.candidates.every((candidate) => candidate.provider_id === 'dashscope-openai'),
    ).toBe(true)
    expect(dashscopeVisionPrimary?.credential_ref).toBe('secret-ref:llm_api_vision')
    expect(dashscopeVisionPrimary?.scope_tags).toContain('hidden_multimodal')
    expect(dashscopeVisionPrimary?.priority).toBeLessThan(dashscopePrimary?.priority ?? Number.MAX_SAFE_INTEGER)
    expect(dashscopePrimary?.scope_tags).toContain('hidden_multimodal')
  })

  it('keeps every visible voice line behind an explicit provider admission pool', () => {
    const bundle = loadLlmRegistryBundle()
    const poolVoiceLines = new Set(
      bundle.providerAdmission.pools.map((entry) => entry.voice_line_id),
    )

    for (const line of Object.values(VOICE_LINE_CATALOG).filter((entry) => entry.visible)) {
      expect(poolVoiceLines.has(line.id)).toBe(true)
    }
  })

  it('requires every profile candidate to declare capability coverage compatible with its execution policy', () => {
    const bundle = loadLlmRegistryBundle()
    const policiesById = new Map(
      bundle.executionPolicies.policies.map((entry) => [entry.policy_id, entry] as const),
    )
    const pricingByKey = new Map(
      bundle.modelPricing.pricing.map((entry) => [
        `${entry.provider_id}/${entry.model_id}`,
        entry,
      ] as const),
    )
    const providersById = new Map(
      bundle.providers.providers.map((entry) => [entry.provider_id, entry] as const),
    )
    const adaptersById = new Map(
      bundle.adapterBindings.bindings.map((entry) => [entry.adapterId, entry] as const),
    )
    const capabilitiesByKey = new Map(
      bundle.modelCapabilities.capabilities.map((entry) => [
        `${entry.provider_id}/${entry.model_id}`,
        entry,
      ] as const),
    )

    for (const profile of bundle.modelProfiles.profiles) {
      const policy = policiesById.get(profile.policy_id ?? defaultExecutionPolicyId(profile))
      expect(policy).toBeDefined()
      if (!policy) continue

      for (const candidate of profile.candidates) {
        const capability = capabilitiesByKey.get(`${candidate.provider_id}/${candidate.model_id}`)
        const pricing = pricingByKey.get(`${candidate.provider_id}/${candidate.model_id}`)
        const provider = providersById.get(candidate.provider_id)
        const adapter = adaptersById.get(candidate.adapter_id ?? defaultAdapterId(candidate))

        expect(capability, `${profile.profile_id}:${candidate.provider_id}/${candidate.model_id}`).toBeDefined()
        expect(pricing, `${profile.profile_id}:${candidate.provider_id}/${candidate.model_id}:pricing`).toBeDefined()
        expect(provider).toBeDefined()
        expect(adapter).toBeDefined()
        expect(capability?.modalities.length).toBeGreaterThan(0)
        expect(capability?.response_modes.length).toBeGreaterThan(0)
        expect(capability?.modalities).toContain(policy?.modality)
        expect(capability?.response_modes).toContain(policy?.response_mode)

        if (policy?.response_mode === 'json_object') {
          expect(provider?.capabilities.json_mode).toBe(true)
          expect(adapter?.supports.jsonMode).toBe(true)
        }
      }
    }
  })

  it('rejects fallback direct targets that are not declared on the target profile', () => {
    const bundle = loadLlmRegistryBundle()
    const profile = bundle.modelProfiles.profiles[0]

    expect(profile).toBeDefined()
    if (!profile) return

    profile.fallback.push({
      level: 'same-line',
      profile_id: profile.profile_id,
      provider_id: 'dashscope-openai',
      model_id: 'missing-model',
      reason: 'invalid_direct_target',
    })

    expect(() => validateLlmRegistryBundle(bundle)).toThrow(
      /fallback direct target .* is not present on profile/i,
    )
  })

  it('requires all five compiled V2 blocks on visible token-budget templates', () => {
    const promptTemplates = loadPromptTemplatesRegistry()
    const v2TemplateKeys = new Set([
      'agent-reply-to-post@4',
      'agent-create-post@4',
      'agent-reply-to-thread-turn@4',
      'agent-chat-reply@6',
      'agent-private-chat-reply@2',
      'agent-proactive-dm-opening@2',
    ])
    const requiredBlockKeys = [
      'hard_control_block',
      'compact_control_block',
      'current_context_block',
      'memory_block',
      'soft_expression_block',
    ]

    for (const template of promptTemplates.templates.filter((entry) =>
      v2TemplateKeys.has(`${entry.prompt_template_id}@${entry.version}`),
    )) {
      for (const key of requiredBlockKeys) {
        expect(template.variables_schema.required).toContain(key)
      }
    }
  })

  it('removes historical visible template versions from the live registry', () => {
    const promptTemplates = loadPromptTemplatesRegistry()
    const versionsById = new Map<string, number[]>()
    const visibleTemplateIds = [
      'agent-reply-to-post',
      'agent-create-post',
      'agent-reply-to-thread-turn',
      'agent-chat-reply',
      'agent-private-chat-reply',
      'agent-proactive-dm-opening',
    ]

    for (const template of promptTemplates.templates.filter((entry) =>
      visibleTemplateIds.includes(entry.prompt_template_id),
    )) {
      const current = versionsById.get(template.prompt_template_id) ?? []
      current.push(template.version)
      versionsById.set(template.prompt_template_id, current)
    }

    expect(versionsById.get('agent-reply-to-post')).toEqual([4])
    expect(versionsById.get('agent-create-post')).toEqual([4])
    expect(versionsById.get('agent-reply-to-thread-turn')).toEqual([4])
    expect(versionsById.get('agent-chat-reply')).toEqual([6])
    expect(versionsById.get('agent-private-chat-reply')).toEqual([2])
    expect(versionsById.get('agent-proactive-dm-opening')).toEqual([2])
  })
})
