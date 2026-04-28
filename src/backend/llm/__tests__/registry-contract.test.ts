import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import {
  VOICE_LINE_CATALOG,
  type VoiceLineRoutingIntent,
} from '../../../shared/agent-persona-catalog.js'
import {
  loadLlmRegistryBundle,
  loadPromptTemplatesRegistry,
} from '../registry-loader.js'
import { LLMGatewayContractError } from '../gateway-contract.js'
import { GENERATED_VOICE_LINE_ROUTING } from '../generated/voice-line-routing.generated.js'
import {
  resolveIdentityWriteProfileRef,
  resolveVoiceLineTierProfileRef,
} from '../voice-line-routing.js'
import { PROMPT_TEMPLATE_REFS } from '../prompt-template-refs.js'
import { buildVoiceLineRoutingArtifact } from '../voice-line-routing-artifact.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REGISTRY_DIR = resolve(__dirname, '../../../../.ai/llm-config/registry')

function createTempRegistry(mutator: (files: Map<string, unknown>) => void): Record<string, string> {
  const dir = mkdtempSync(join(tmpdir(), 'llm-registry-'))
  const files = new Map<string, unknown>()

  for (const fileName of readdirSync(REGISTRY_DIR)) {
    if (!fileName.endsWith('.yaml')) continue
    const filePath = join(REGISTRY_DIR, fileName)
    files.set(fileName, parseYaml(readFileSync(filePath, 'utf8')))
  }

  mutator(files)

  for (const [fileName, contents] of files.entries()) {
    writeFileSync(join(dir, fileName), stringifyYaml(contents), 'utf8')
  }

  return {
    providers: join(dir, 'providers.yaml'),
    modelProfiles: join(dir, 'model_profiles.yaml'),
    promptTemplates: join(dir, 'prompt_templates.yaml'),
    credentialPools: join(dir, 'credential_pools.yaml'),
    routingPolicies: join(dir, 'routing_policies.yaml'),
    executionPolicies: join(dir, 'execution_policies.yaml'),
    adapterBindings: join(dir, 'adapter_bindings.yaml'),
    providerAdmission: join(dir, 'provider_admission.yaml'),
    modelPricing: join(dir, 'model_pricing.yaml'),
    modelCapabilities: join(dir, 'model_capabilities.yaml'),
  }
}

function expectRegistryIssue(
  run: () => unknown,
  options: { message: RegExp; issuePath: string; issueMessage: RegExp },
): void {
  try {
    run()
    expect.unreachable('Expected registry loading to fail')
  } catch (error) {
    expect(error).toBeInstanceOf(LLMGatewayContractError)
    const contractError = error as LLMGatewayContractError
    expect(contractError.code).toBe('RegistryResolutionError')
    expect(contractError.message).toMatch(options.message)

    const issues = contractError.details?.issues
    expect(Array.isArray(issues)).toBe(true)
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: options.issuePath,
          message: expect.stringMatching(options.issueMessage),
        }),
      ]),
    )
  }
}

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

  it('rejects adapter bindings that retain removed request-shape fields', () => {
    const paths = createTempRegistry((files) => {
      const adapterBindings = files.get('adapter_bindings.yaml') as {
        bindings: Array<Record<string, unknown>>
      }
      adapterBindings.bindings[0]!.requestShape = 'responses'
    })

    expectRegistryIssue(() => loadLlmRegistryBundle(paths), {
      message: /Invalid adapter bindings registry/,
      issuePath: 'bindings.0',
      issueMessage: /unrecognized key/i,
    })
  })

  it('rejects adapter bindings that retain removed transport fields', () => {
    const paths = createTempRegistry((files) => {
      const adapterBindings = files.get('adapter_bindings.yaml') as {
        bindings: Array<Record<string, unknown>>
      }
      adapterBindings.bindings[0]!.transport = 'responses_api'
    })

    expectRegistryIssue(() => loadLlmRegistryBundle(paths), {
      message: /Invalid adapter bindings registry/,
      issuePath: 'bindings.0',
      issueMessage: /unrecognized key/i,
    })
  })

  it('rejects adapter bindings that retain removed auth strategy fields', () => {
    const paths = createTempRegistry((files) => {
      const adapterBindings = files.get('adapter_bindings.yaml') as {
        bindings: Array<Record<string, unknown>>
      }
      adapterBindings.bindings[0]!.authStrategy = 'bearer_api_key'
    })

    expectRegistryIssue(() => loadLlmRegistryBundle(paths), {
      message: /Invalid adapter bindings registry/,
      issuePath: 'bindings.0',
      issueMessage: /unrecognized key/i,
    })
  })

  it('rejects adapter bindings that retain removed capability-matrix fields', () => {
    const paths = createTempRegistry((files) => {
      const adapterBindings = files.get('adapter_bindings.yaml') as {
        bindings: Array<Record<string, unknown>>
      }
      adapterBindings.bindings[0]!.providerGatewayKinds = ['openai_compatible']
    })

    expectRegistryIssue(() => loadLlmRegistryBundle(paths), {
      message: /Invalid adapter bindings registry/,
      issuePath: 'bindings.0',
      issueMessage: /unrecognized key/i,
    })
  })

  it('rejects adapter bindings that retain removed supports fields', () => {
    const paths = createTempRegistry((files) => {
      const adapterBindings = files.get('adapter_bindings.yaml') as {
        bindings: Array<Record<string, unknown>>
      }
      adapterBindings.bindings[0]!.supports = { json_object: true }
    })

    expectRegistryIssue(() => loadLlmRegistryBundle(paths), {
      message: /Invalid adapter bindings registry/,
      issuePath: 'bindings.0',
      issueMessage: /unrecognized key/i,
    })
  })

  it('rejects providers that declare unimplemented gateway runtimes', () => {
    const paths = createTempRegistry((files) => {
      const providers = files.get('providers.yaml') as {
        providers: Array<Record<string, unknown>>
      }
      providers.providers[0]!.gateway_kind = 'native'
    })

    expectRegistryIssue(() => loadLlmRegistryBundle(paths), {
      message: /Invalid providers registry/,
      issuePath: 'providers.0.gateway_kind',
      issueMessage: /expected "openai_compatible"/,
    })
  })

  it('keeps the generated voice-line routing artifact aligned with the model profile registry', () => {
    const bundle = loadLlmRegistryBundle()
    const profilesById = new Map(
      bundle.modelProfiles.profiles.map((entry) => [entry.profile_id, entry] as const),
    )
    const expectedArtifact = buildVoiceLineRoutingArtifact(bundle.modelProfiles.profiles)

    expect(GENERATED_VOICE_LINE_ROUTING).toEqual(expectedArtifact)

    for (const [voiceLineId, intentMap] of Object.entries(expectedArtifact)) {
      for (const [intent, tierMap] of Object.entries(intentMap ?? {})) {
        for (const [tier, expectedProfileId] of Object.entries(tierMap ?? {})) {
          const resolved = resolveVoiceLineTierProfileRef(
            voiceLineId as keyof typeof VOICE_LINE_CATALOG,
            intent as VoiceLineRoutingIntent,
            tier as 'lite' | 'base' | 'premium',
          )

          expect(resolved).toBe(expectedProfileId)
          const profile = profilesById.get(expectedProfileId)
          expect(profile).toBeDefined()
          expect(profile?.voice_line_id).toBe(voiceLineId)
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
      expect(profileId).toBe(
        GENERATED_VOICE_LINE_ROUTING[line.id]?.identity_write?.premium,
      )
    }

    const directorLine = VOICE_LINE_CATALOG['qwen-director-v1']
    expect(directorLine.visible).toBe(false)
    expect(directorLine.directorOnly).toBe(true)
    expect(resolveIdentityWriteProfileRef('qwen-director-v1', 'premium')).toBeNull()
    expect(resolveVoiceLineTierProfileRef('qwen-director-v1', 'director_plan', 'base')).toBe(
      'qwen-director-director-plan-base',
    )
    expect(resolveVoiceLineTierProfileRef('qwen-director-v1', 'director_plan', 'premium')).toBe(
      'qwen-director-director-plan-premium',
    )
  })

  it('keeps DeepSeek V4 Pro as the third qwen director-plan candidate', () => {
    const bundle = loadLlmRegistryBundle()
    const profilesById = new Map(
      bundle.modelProfiles.profiles.map((entry) => [entry.profile_id, entry] as const),
    )

    for (const profileId of [
      'qwen-director-director-plan-base',
      'qwen-director-director-plan-premium',
    ]) {
      expect(profilesById.get(profileId)?.candidates[0]).toMatchObject({
        provider_id: 'token-plan-openai',
        model_id: 'qwen3.6-plus',
      })
      expect(profilesById.get(profileId)?.candidates[1]).toMatchObject({
        provider_id: 'dashscope-openai',
        model_id: 'qwen3.5-plus',
      })
      expect(profilesById.get(profileId)?.candidates[2]).toMatchObject({
        provider_id: 'deepseek-openai',
        model_id: 'deepseek-v4-pro',
        weight: 95,
      })
    }
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
      'qwen3.6-plus',
    )
    expect(profilesById.get('qwen-social-identity-write-base')?.policy_id).toBe(
      'identity_write-identity_write-base',
    )
    expect(
      profilesById
        .get('qwen-social-identity-write-premium')
        ?.candidates.some((candidate) => candidate.model_id === 'qwen3.6-plus'),
    ).toBe(true)
    expect(
      profilesById
        .get('qwen-social-identity-write-premium')
        ?.candidates.every((candidate) => candidate.adapter_id === 'openai-chat-completions-v1'),
    ).toBe(true)
  })

  it('keeps qwen forum-reply lite bound to a fast serviceable lane', () => {
    const bundle = loadLlmRegistryBundle()
    const profilesById = new Map(
      bundle.modelProfiles.profiles.map((entry) => [entry.profile_id, entry] as const),
    )

    expect(resolveVoiceLineTierProfileRef('qwen-social-v1', 'forum_reply', 'lite')).toBe(
      'qwen-social-forum-reply-lite',
    )
    expect(profilesById.get('qwen-social-forum-reply-lite')?.candidates[0]).toMatchObject({
      provider_id: 'ark-openai',
      model_id: 'doubao-seed-2-0-lite-260215',
    })
    expect(
      profilesById.get('qwen-social-forum-reply-lite')?.candidates.map((candidate) => ({
        provider_id: candidate.provider_id,
        model_id: candidate.model_id,
      })),
    ).toEqual([
      {
        provider_id: 'ark-openai',
        model_id: 'doubao-seed-2-0-lite-260215',
      },
      {
        provider_id: 'dashscope-openai',
        model_id: 'qwen3.5-flash',
      },
      {
        provider_id: 'token-plan-openai',
        model_id: 'qwen3.6-plus',
      },
      {
        provider_id: 'dashscope-openai',
        model_id: 'qwen3.5-plus',
      },
      {
        provider_id: 'zai-openai',
        model_id: 'glm-4.7-flash',
      },
    ])
    expect(profilesById.get('qwen-social-forum-reply-lite')?.fallback).toEqual([
      {
        level: 'same-line',
        profile_id: 'qwen-social-forum-reply-lite-rescue',
        reason: 'forum reply lite may raise to a balanced rescue lane when fast candidates saturate',
      },
    ])
    expect(profilesById.get('qwen-social-forum-reply-lite-rescue')?.candidates.map((candidate) => ({
      provider_id: candidate.provider_id,
      model_id: candidate.model_id,
    }))).toEqual([
      {
        provider_id: 'token-plan-openai',
        model_id: 'qwen3.6-plus',
      },
      {
        provider_id: 'dashscope-openai',
        model_id: 'qwen3.5-plus',
      },
    ])
    expect(profilesById.get('qwen-social-forum-reply-base')?.candidates[0]?.model_id).toBe(
      'qwen3.6-plus',
    )
  })

  it('keeps glm forum-reply lite bound to a serviceable fast lane', () => {
    const bundle = loadLlmRegistryBundle()
    const profilesById = new Map(
      bundle.modelProfiles.profiles.map((entry) => [entry.profile_id, entry] as const),
    )

    expect(resolveVoiceLineTierProfileRef('glm-deep-v1', 'forum_reply', 'lite')).toBe(
      'glm-deep-forum-reply-lite',
    )
    expect(profilesById.get('glm-deep-forum-reply-lite')?.candidates[0]).toMatchObject({
      provider_id: 'ark-openai',
      model_id: 'doubao-seed-2-0-lite-260215',
    })
    expect(
      profilesById.get('glm-deep-forum-reply-lite')?.candidates.map((candidate) => ({
        provider_id: candidate.provider_id,
        model_id: candidate.model_id,
      })),
    ).toEqual([
      {
        provider_id: 'ark-openai',
        model_id: 'doubao-seed-2-0-lite-260215',
      },
      {
        provider_id: 'zai-openai',
        model_id: 'glm-4.7-flash',
      },
      {
        provider_id: 'zai-openai',
        model_id: 'glm-5.1',
      },
    ])
    expect(profilesById.get('glm-deep-forum-reply-base')?.candidates[0]?.model_id).toBe(
      'glm-5.1',
    )
  })

  it('keeps qwen private-reply realtime routing flash-first with balanced dashscope fallback', () => {
    const bundle = loadLlmRegistryBundle()
    const profilesById = new Map(
      bundle.modelProfiles.profiles.map((entry) => [entry.profile_id, entry] as const),
    )

    const candidateKeys =
      profilesById.get('qwen-social-private-reply-base')?.candidates.map(
        (candidate) => `${candidate.provider_id}/${candidate.model_id}`,
      ) ?? []

    expect(candidateKeys.slice(0, 3)).toEqual([
      'dashscope-openai/qwen3.5-flash',
      'dashscope-openai/qwen3.5-plus',
      'ark-openai/doubao-seed-2-0-lite-260215',
    ])
  })

  it('keeps qwen hidden digest profiles multi-homed for saturation resilience', () => {
    const bundle = loadLlmRegistryBundle()
    const profilesById = new Map(
      bundle.modelProfiles.profiles.map((entry) => [entry.profile_id, entry] as const),
    )
    const executionPoliciesById = new Map(
      bundle.executionPolicies.policies.map((entry) => [entry.policy_id, entry] as const),
    )

    for (const profileId of [
      'qwen-social-public-observation-base',
      'qwen-social-private-digest-base',
    ] as const) {
      const profile = profilesById.get(profileId)
      const candidateKeys = profile?.candidates.map(
        (candidate) => `${candidate.provider_id}/${candidate.model_id}`,
      ) ?? []

      expect(profile?.candidates[0]).toMatchObject({
        provider_id: 'token-plan-openai',
        model_id: 'qwen3.6-plus',
      })
      expect(candidateKeys).toEqual(
        expect.arrayContaining([
          'token-plan-openai/qwen3.6-plus',
          'dashscope-openai/qwen3.5-plus',
          'ark-openai/doubao-seed-2-0-lite-260215',
          'dashscope-openai/qwen3.5-flash',
          'moonshot-openai/kimi-k2.5',
        ]),
      )
      expect(
        profile?.candidates.some((candidate) => candidate.provider_id !== 'dashscope-openai'),
      ).toBe(true)
    }

    expect(
      executionPoliciesById.get('hidden-public_observation_digest-base')?.merge
        .allow_callsite_override_fields,
    ).toContain('executionPolicyId')
  })

  it('keeps doubao line multi-homed so the runtime line remains usable when Ark is unavailable', () => {
    const bundle = loadLlmRegistryBundle()
    const profilesById = new Map(
      bundle.modelProfiles.profiles.map((entry) => [entry.profile_id, entry] as const),
    )
    const doubaoAdmission = bundle.providerAdmission.pools.find((entry) => entry.voice_line_id === 'doubao-deep-v1')
    const arkPrimary = bundle.credentialPools.pools.find((entry) => entry.credential_id === 'ark-primary')
    const arkSecondary = bundle.credentialPools.pools.find((entry) => entry.credential_id === 'ark-secondary')
    const visibleProfileIds = [
      'doubao-deep-chat-reply-lite',
      'doubao-deep-forum-reply-base',
      'doubao-deep-scheduled-post-lite',
      'doubao-deep-scheduled-post-base',
      'doubao-deep-private-reply-base',
      'doubao-deep-proactive-opening-base',
    ] as const
    const hiddenProfileIds = [
      'doubao-deep-identity-write-premium',
      'doubao-deep-public-observation-base',
      'doubao-deep-private-digest-base',
    ] as const

    expect(
      doubaoAdmission?.candidates.map((candidate) => `${candidate.provider_id}/${candidate.model_id}`),
    ).toEqual(
      expect.arrayContaining([
        'ark-coding-openai/ark-code-latest',
        'ark-openai/doubao-seed-2-0-lite-260215',
        'moonshot-openai/kimi-k2.5',
      ]),
    )
    expect(arkPrimary).toMatchObject({
      provider_id: 'ark-coding-openai',
      endpoint_id: 'ark-coding-cn-beijing',
      endpoint: 'https://ark.cn-beijing.volces.com/api/coding/v3',
      credential_ref: 'secret-ref:ark_api_key',
    })
    expect(arkPrimary?.allowed_model_ids).toEqual(['ark-code-latest'])
    expect(arkSecondary).toMatchObject({
      provider_id: 'ark-openai',
      endpoint_id: 'ark-cn-beijing',
      endpoint: 'https://ark.cn-beijing.volces.com/api/v3',
      credential_ref: 'secret-ref:ark_api_key_secondary',
    })
    expect(arkSecondary?.allowed_model_ids).toEqual(['doubao-seed-2-0-lite-260215'])

    for (const profileId of [...visibleProfileIds, ...hiddenProfileIds]) {
      const candidateKeys =
        profilesById.get(profileId)?.candidates.map(
          (candidate) => `${candidate.provider_id}/${candidate.model_id}`,
        ) ?? []
      expect(candidateKeys.slice(0, 3)).toEqual([
        'ark-coding-openai/ark-code-latest',
        'ark-openai/doubao-seed-2-0-lite-260215',
        'moonshot-openai/kimi-k2.5',
      ])
    }
  })

  it('keeps Kimi Code inventory blocked while routing kimi line through ordinary Moonshot', () => {
    const bundle = loadLlmRegistryBundle()
    const profilesById = new Map(
      bundle.modelProfiles.profiles.map((entry) => [entry.profile_id, entry] as const),
    )
    const kimiAdmission = bundle.providerAdmission.pools.find((entry) => entry.voice_line_id === 'kimi-deep-v1')
    const kimiCodingPrimary = bundle.credentialPools.pools.find(
      (entry) => entry.credential_id === 'kimi-coding-primary',
    )
    const moonshotPrimary = bundle.credentialPools.pools.find((entry) => entry.credential_id === 'moonshot-primary')
    const kimiProfileIds = [
      'kimi-deep-chat-reply-lite',
      'kimi-deep-forum-reply-base',
      'kimi-deep-scheduled-post-lite',
      'kimi-deep-scheduled-post-base',
      'kimi-deep-private-reply-base',
      'kimi-deep-proactive-opening-base',
      'kimi-deep-identity-write-premium',
      'kimi-deep-public-observation-base',
      'kimi-deep-private-digest-base',
    ] as const

    expect(
      kimiAdmission?.candidates.map((candidate) => ({
        key: `${candidate.provider_id}/${candidate.model_id}`,
        admission: candidate.admission,
      })),
    ).toEqual([
      {
        key: 'kimi-coding-openai/kimi-for-coding',
        admission: 'shadow',
      },
      {
        key: 'moonshot-openai/kimi-k2.5',
        admission: 'admitted',
      },
    ])
    expect(kimiCodingPrimary).toMatchObject({
      provider_id: 'kimi-coding-openai',
      endpoint_id: 'kimi-coding-cn',
      endpoint: 'https://api.kimi.com/coding/v1',
      credential_ref: 'secret-ref:kimi_coding_api_key',
      health: 'blocked',
      enabled: false,
    })
    expect(kimiCodingPrimary?.allowed_model_ids).toEqual(['kimi-for-coding'])
    expect(moonshotPrimary).toMatchObject({
      provider_id: 'moonshot-openai',
      endpoint_id: 'moonshot-cn',
      endpoint: 'https://api.moonshot.cn/v1',
      credential_ref: 'secret-ref:moonshot_api_key',
    })

    for (const profileId of kimiProfileIds) {
      const candidateKeys =
        profilesById.get(profileId)?.candidates.map(
          (candidate) => `${candidate.provider_id}/${candidate.model_id}`,
        ) ?? []
      expect(candidateKeys).not.toContain('kimi-coding-openai/kimi-for-coding')
      expect(candidateKeys[0]).toBe('moonshot-openai/kimi-k2.5')
    }
  })

  it('keeps biography routing hidden-only and aligned with the generated routing artifact', () => {
    const bundle = loadLlmRegistryBundle()
    const profilesById = new Map(
      bundle.modelProfiles.profiles.map((entry) => [entry.profile_id, entry] as const),
    )
    const admissionVoiceLines = new Set(bundle.providerAdmission.pools.map((entry) => entry.voice_line_id))
    const biographyLine = VOICE_LINE_CATALOG['biography-director-v1']

    expect(biographyLine.visible).toBe(false)
    expect(biographyLine.directorOnly).toBe(true)
    expect(resolveVoiceLineTierProfileRef('biography-director-v1', 'public_observation_digest', 'premium')).toBe(
      'biography-director-public-observation-premium',
    )
    expect(resolveVoiceLineTierProfileRef('biography-director-v1', 'public_observation_digest', 'base')).toBe(
      'biography-director-public-observation-base',
    )
    expect(
      GENERATED_VOICE_LINE_ROUTING['biography-director-v1']?.public_observation_digest?.premium,
    ).toBe('biography-director-public-observation-premium')
    expect(
      GENERATED_VOICE_LINE_ROUTING['biography-director-v1']?.public_observation_digest?.base,
    ).toBe('biography-director-public-observation-base')
    expect(admissionVoiceLines.has('biography-director-v1')).toBe(false)
    expect(profilesById.get('biography-director-public-observation-premium')?.policy_id).toBe(
      'hidden-public_observation_digest-agent-biography-premium',
    )
    expect(profilesById.get('biography-director-public-observation-base')?.policy_id).toBe(
      'hidden-public_observation_digest-agent-biography-base',
    )
    expect(
      profilesById.get('biography-director-public-observation-premium')?.candidates[0],
    ).toMatchObject({
      provider_id: 'moonshot-openai',
      model_id: 'kimi-k2.5',
    })
    expect(
      profilesById.get('biography-director-public-observation-base')?.candidates[0],
    ).toMatchObject({
      provider_id: 'moonshot-openai',
      model_id: 'kimi-k2.5',
    })
    expect(
      profilesById.get('biography-director-public-observation-premium')?.candidates[1],
    ).toMatchObject({
      provider_id: 'moonshot-openai',
      model_id: 'moonshot-v1-128k',
    })
  })

  it('falls back to the nearest available tier when a requested tier is not explicitly defined', () => {
    expect(resolveVoiceLineTierProfileRef('qwen-social-v1', 'scheduled_post', 'lite')).toBe(
      'qwen-social-scheduled-post-lite',
    )
    expect(resolveVoiceLineTierProfileRef('glm-deep-v1', 'scheduled_post', 'lite')).toBe(
      'glm-deep-scheduled-post-lite',
    )
    expect(resolveVoiceLineTierProfileRef('doubao-deep-v1', 'scheduled_post', 'lite')).toBe(
      'doubao-deep-scheduled-post-lite',
    )
    expect(resolveVoiceLineTierProfileRef('kimi-deep-v1', 'scheduled_post', 'lite')).toBe(
      'kimi-deep-scheduled-post-lite',
    )
    expect(resolveVoiceLineTierProfileRef('minimax-her-v1', 'scheduled_post', 'lite')).toBe(
      'minimax-her-scheduled-post-lite',
    )
    expect(resolveVoiceLineTierProfileRef('qwen-social-v1', 'scheduled_post', 'premium')).toBe(
      'qwen-social-scheduled-post-base',
    )
    expect(resolveVoiceLineTierProfileRef('doubao-deep-v1', 'scheduled_post', 'premium')).toBe(
      'doubao-deep-scheduled-post-base',
    )
    expect(resolveIdentityWriteProfileRef('doubao-deep-v1', 'base')).toBe(
      'doubao-deep-identity-write-premium',
    )
    expect(resolveVoiceLineTierProfileRef('kimi-deep-v1', 'scheduled_post', 'premium')).toBe(
      'kimi-deep-scheduled-post-base',
    )
    expect(resolveIdentityWriteProfileRef('kimi-deep-v1', 'base')).toBe(
      'kimi-deep-identity-write-premium',
    )
  })

  it('keeps qwen forum-thread low-latency routes pinned to fast providers and a dedicated thread policy', () => {
    const bundle = loadLlmRegistryBundle()
    const profilesById = new Map(
      bundle.modelProfiles.profiles.map((entry) => [entry.profile_id, entry] as const),
    )
    const executionPoliciesById = new Map(
      bundle.executionPolicies.policies.map((entry) => [entry.policy_id, entry] as const),
    )

    expect(resolveVoiceLineTierProfileRef('qwen-social-v1', 'forum_reply', 'lite')).toBe(
      'qwen-social-forum-reply-lite',
    )
    expect(profilesById.get('qwen-social-forum-reply-lite')?.candidates[0]).toMatchObject({
      provider_id: 'ark-openai',
      model_id: 'doubao-seed-2-0-lite-260215',
    })
    expect(profilesById.get('qwen-social-forum-reply-lite')?.candidates[2]).toMatchObject({
      provider_id: 'token-plan-openai',
      model_id: 'qwen3.6-plus',
    })
    expect(profilesById.get('qwen-social-forum-reply-lite')?.candidates[3]).toMatchObject({
      provider_id: 'dashscope-openai',
      model_id: 'qwen3.5-plus',
    })
    expect(executionPoliciesById.get('visible-forum_reply-selection-lite')?.defaults).toMatchObject({
      timeout_ms: 30000,
      max_retries: 0,
    })
    expect(executionPoliciesById.get('visible-forum_reply-action-plan-lite')?.defaults).toMatchObject({
      timeout_ms: 30000,
      max_retries: 0,
    })
    expect(executionPoliciesById.get('visible-forum_reply-thread-base')?.defaults).toMatchObject({
      timeout_ms: 30000,
      max_retries: 0,
      temperature: 0.72,
      max_tokens: 520,
    })
    expect(executionPoliciesById.get('visible-forum_reply-post-base')?.defaults).toMatchObject({
      timeout_ms: 30000,
      max_retries: 0,
      temperature: 0.72,
      max_tokens: 520,
    })
    expect(executionPoliciesById.get('visible-scheduled_post-base')?.defaults).toMatchObject({
      temperature: 0.72,
      max_tokens: 720,
    })
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
    const visionProfile = profilesById.get('qwen-director-vision-summary-base')
    const dashscopeVisionPrimary = bundle.credentialPools.pools.find(
      (entry) => entry.credential_id === 'dashscope-vision-primary',
    )
    const dashscopePrimary = bundle.credentialPools.pools.find((entry) => entry.credential_id === 'dashscope-primary')

    expect(visionProfile?.candidates[0]).toMatchObject({
      provider_id: 'dashscope-openai',
      model_id: 'qwen3.5-flash',
    })
    expect(
      visionProfile?.candidates.some((candidate) =>
        candidate.provider_id === 'dashscope-openai' && candidate.model_id === 'qwen3.5-plus'),
    ).toBe(true)
    expect(
      visionProfile?.candidates.some((candidate) =>
        candidate.provider_id === 'dashscope-openai' && candidate.model_id === 'qwen3.5-flash'),
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

  it('keeps deepseek premium identity-write candidates backed by an identity-write credential scope', () => {
    const bundle = loadLlmRegistryBundle()
    const deepseekPrimary = bundle.credentialPools.pools.find(
      (entry) => entry.credential_id === 'deepseek-primary',
    )
    const glmIdentityPremium = bundle.modelProfiles.profiles.find(
      (entry) => entry.profile_id === 'glm-deep-identity-write-premium',
    )

    expect(
      glmIdentityPremium?.candidates.some((candidate) =>
        candidate.provider_id === 'deepseek-openai' && candidate.model_id === 'deepseek-v4-pro'),
    ).toBe(true)
    expect(deepseekPrimary?.scope_tags).toContain('identity_write')
    expect(deepseekPrimary?.allowed_model_ids).toContain('deepseek-v4-pro')
  })

  it('keeps minimax hidden profiles backed by hidden credential scopes', () => {
    const bundle = loadLlmRegistryBundle()
    const minimaxPools = bundle.credentialPools.pools.filter(
      (entry) => entry.provider_id === 'minimax-openai',
    )
    const minimaxHiddenProfiles = bundle.modelProfiles.profiles.filter(
      (entry) => entry.voice_line_id === 'minimax-her-v1' && entry.visibility === 'hidden',
    )

    expect(minimaxHiddenProfiles.length).toBeGreaterThan(0)
    expect(
      minimaxHiddenProfiles.every((profile) =>
        profile.candidates.some((candidate) =>
          candidate.provider_id === 'minimax-openai' && candidate.model_id === 'MiniMax-M2.7')),
    ).toBe(true)
    expect(minimaxPools.length).toBeGreaterThan(0)
    expect(minimaxPools.every((pool) => pool.scope_tags?.includes('hidden') === true)).toBe(true)
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
      const policy = policiesById.get(profile.policy_id)
      expect(policy).toBeDefined()
      if (!policy) continue

      for (const candidate of profile.candidates) {
        const capability = capabilitiesByKey.get(`${candidate.provider_id}/${candidate.model_id}`)
        const pricing = pricingByKey.get(`${candidate.provider_id}/${candidate.model_id}`)
        const provider = providersById.get(candidate.provider_id)
        const adapter = adaptersById.get(candidate.adapter_id)

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
          expect(adapter?.runtime).toBe('openai_chat_completions')
        }
      }
    }
  })

  it('rejects profiles that omit explicit execution policy bindings', () => {
    const paths = createTempRegistry((files) => {
      const profiles = files.get('model_profiles.yaml') as {
        profiles: Array<Record<string, unknown>>
      }
      delete profiles.profiles[0]!.policy_id
    })

    expectRegistryIssue(() => loadLlmRegistryBundle(paths), {
      message: /Invalid model profiles registry/,
      issuePath: 'profiles.0.policy_id',
      issueMessage: /expected string/,
    })
  })

  it('rejects execution policies that omit explicit temperature defaults', () => {
    const paths = createTempRegistry((files) => {
      const policies = files.get('execution_policies.yaml') as {
        policies: Array<{ defaults: Record<string, unknown> }>
      }
      delete policies.policies[0]!.defaults.temperature
    })

    expectRegistryIssue(() => loadLlmRegistryBundle(paths), {
      message: /Invalid execution policies registry/,
      issuePath: 'policies.0.defaults.temperature',
      issueMessage: /expected number/,
    })
  })

  it('rejects execution policies that omit explicit max token defaults', () => {
    const paths = createTempRegistry((files) => {
      const policies = files.get('execution_policies.yaml') as {
        policies: Array<{ defaults: Record<string, unknown> }>
      }
      delete policies.policies[0]!.defaults.max_tokens
    })

    expectRegistryIssue(() => loadLlmRegistryBundle(paths), {
      message: /Invalid execution policies registry/,
      issuePath: 'policies.0.defaults.max_tokens',
      issueMessage: /expected number/,
    })
  })

  it('rejects candidates that omit explicit adapter bindings', () => {
    const paths = createTempRegistry((files) => {
      const profiles = files.get('model_profiles.yaml') as {
        profiles: Array<Record<string, unknown>>
      }
      const candidates = profiles.profiles[0]!.candidates as Array<Record<string, unknown>>
      delete candidates[0]!.adapter_id
    })

    expectRegistryIssue(() => loadLlmRegistryBundle(paths), {
      message: /Invalid model profiles registry/,
      issuePath: 'profiles.0.candidates.0.adapter_id',
      issueMessage: /expected string/,
    })
  })

  it('rejects fallback entries that retain removed direct provider/model targets', () => {
    const paths = createTempRegistry((files) => {
      const profiles = files.get('model_profiles.yaml') as {
        profiles: Array<Record<string, unknown>>
      }
      profiles.profiles[0]!.fallback = [
        {
          level: 'same-line',
          profile_id: profiles.profiles[0]!.profile_id,
          reason: 'invalid_direct_target',
        },
      ]
      const fallback = (profiles.profiles[0]!.fallback as Array<Record<string, unknown>>)[0]!
      fallback.provider_id = 'dashscope-openai'
      fallback.model_id = 'missing-model'
    })

    expectRegistryIssue(() => loadLlmRegistryBundle(paths), {
      message: /Invalid model profiles registry/,
      issuePath: 'profiles.0.fallback.0',
      issueMessage: /unrecognized key/i,
    })
  })

  it('requires all five compiled V2 blocks on visible token-budget templates', () => {
    const promptTemplates = loadPromptTemplatesRegistry()
    const v2TemplateKeys = new Set([
      'agent-reply-to-post@4',
      'agent-create-post@4',
      'agent-reply-to-thread-turn@4',
      'agent-chat-reply@6',
      'agent-private-chat-reply@3',
      'agent-proactive-dm-opening@3',
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
    expect(versionsById.get('agent-private-chat-reply')).toEqual([3])
    expect(versionsById.get('agent-proactive-dm-opening')).toEqual([3])
  })
})
