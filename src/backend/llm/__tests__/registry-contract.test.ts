import { describe, expect, it } from 'vitest'
import {
  VOICE_LINE_CATALOG,
  type VoiceLineRoutingIntent,
} from '../../../shared/agent-persona-catalog.js'
import {
  loadLlmRegistryBundle,
  loadPromptTemplatesRegistry,
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
    expect(
      resolveVoiceLineTierProfileRef('deepseek-director-v1', 'director_plan', 'base'),
    ).toBe('deepseek-director-director-plan-base')
    expect(
      resolveVoiceLineTierProfileRef('deepseek-director-v1', 'director_plan', 'premium'),
    ).toBe('deepseek-director-director-plan-premium')
  })

  it('keeps qwen identity-write tiers split between public and private adaptation lanes', () => {
    const bundle = loadLlmRegistryBundle()
    const profilesById = new Map(
      bundle.modelProfiles.profiles.map((entry) => [entry.profile_id, entry] as const),
    )

    expect(resolveIdentityWriteProfileRef('qwen-social-v1', 'base')).toBe('qwen-social-identity-write-base')
    expect(resolveIdentityWriteProfileRef('qwen-social-v1', 'premium')).toBe('qwen-social-identity-write-premium')
    expect(profilesById.get('qwen-social-identity-write-base')?.candidates[0]?.model_id).toBe('qwen-plus-character')
    expect(
      profilesById.get('qwen-social-identity-write-premium')?.candidates.some((candidate) => candidate.model_id === 'qwen-plus-character'),
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
})
