import { describe, expect, it, vi } from 'vitest'
import {
  ADMIN_LLM_CONNECTIVITY_PROMPT_ID,
  ADMIN_LLM_CONNECTIVITY_PROMPT_VERSION,
  LlmConnectivityDiagnosticService,
  __testing,
} from '../llm-connectivity-diagnostic-service.js'
import type { LlmRegistryBundle } from '../../llm/registry-loader.js'
import type { LLMGatewayRequest, LLMGatewayResponse } from '../../llm/gateway-contract.js'
import { LLMGatewayContractError } from '../../llm/gateway-contract.js'

function makeBundle(): LlmRegistryBundle {
  return {
    providers: {
      version: 1,
      providers: [],
    },
    modelProfiles: {
      version: 1,
      profiles: [
        {
          profile_id: 'profile-anchor-base',
          voice_line_id: 'anchor_steady_v1',
          tier: 'base',
          intent: 'forum_post',
          visibility: 'visible',
          policy_id: 'policy-anchor-base',
          candidates: [
            {
              provider_id: 'provider-a',
              model_id: 'gpt-4o-2024-08-06',
              region: 'us-east-1',
              endpoint_id: 'ep-prod',
              adapter_id: 'adapter-openai',
              weight: 100,
              quality_class: 'balanced',
            },
            {
              provider_id: 'provider-a',
              model_id: 'gpt-4o-mini',
              region: 'us-east-1',
              endpoint_id: 'ep-prod',
              adapter_id: 'adapter-openai',
              weight: 50,
              quality_class: 'fast',
            },
          ],
          fallback: [],
        },
      ],
    },
    promptTemplates: { version: 1, templates: [] },
    credentialPools: {
      version: 1,
      pools: [
        {
          credential_id: 'pool-prod-east',
          provider_id: 'provider-a',
          region: 'us-east-1',
          endpoint_id: 'ep-prod',
          endpoint: 'https://api.example.com/v1',
          credential_ref: 'env:PROVIDER_A_KEY',
          priority: 1,
          health: 'healthy',
        },
      ],
    },
    routingPolicies: {
      version: 1,
      policies: [
        {
          profile_id: 'profile-anchor-base',
          intent: 'forum_post',
          visibility: 'visible',
          tier: 'base',
          voice_line_id: 'anchor_steady_v1',
          quality_class: 'balanced',
          route_order: ['intent_scene_fit', 'voice_line_tier'],
          execution_policy_id: 'exec-default',
        },
      ],
    },
    executionPolicies: { version: 1, policies: [] },
    adapterBindings: { version: 1, bindings: [] },
    providerAdmission: {
      version: 1,
      pools: [
        {
          voice_line_id: 'anchor_steady_v1',
          core_family: 'anchor',
          compare_dimensions: ['persona_lock', 'watchability'],
          candidates: [
            {
              provider_id: 'provider-a',
              model_id: 'gpt-4o-2024-08-06',
              admission: 'admitted',
            },
            {
              provider_id: 'provider-a',
              model_id: 'gpt-4o-mini',
              admission: 'shadow',
            },
          ],
        },
      ],
    },
    modelPricing: { version: 1, pricing: [] },
    modelCapabilities: {
      version: 1,
      capabilities: [
        {
          provider_id: 'provider-a',
          model_id: 'gpt-4o-2024-08-06',
          input_window_tokens: 128_000,
          max_output_tokens: 4096,
          modalities: ['text'],
          response_modes: ['text', 'json_object'],
        },
      ],
    },
  } as unknown as LlmRegistryBundle
}

describe('LlmConnectivityDiagnosticService.list', () => {
  it('returns only admitted candidates with model metadata + credential pool', () => {
    const service = new LlmConnectivityDiagnosticService({
      bundle: makeBundle(),
      invokeGateway: vi.fn(),
    })
    const result = service.list()
    expect(result.manual_tests_auto_polled).toBe(false)
    expect(result.rows).toHaveLength(1)
    const [row] = result.rows
    expect(row.provider_id).toBe('provider-a')
    expect(row.model_id).toBe('gpt-4o-2024-08-06')
    expect(row.model_name).toBe('gpt-4o-2024-08-06')
    expect(row.model_version).toBe('2024-08-06')
    expect(row.profile_id).toBe('profile-anchor-base')
    expect(row.voice_line_id).toBe('anchor_steady_v1')
    expect(row.credential_pool_id).toBe('pool-prod-east')
    expect(row.adapter_id).toBe('adapter-openai')
    expect(row.shadow_dimensions).toEqual(['persona_lock', 'watchability'])
    expect(row.admission).toBe('admitted')
    expect(row.route_id).toContain('profile-anchor-base|provider-a|gpt-4o-2024-08-06')
  })
})

describe('LlmConnectivityDiagnosticService.test', () => {
  it('returns empty when no route ids match', async () => {
    const service = new LlmConnectivityDiagnosticService({
      bundle: makeBundle(),
      invokeGateway: vi.fn(),
    })
    const result = await service.test({ route_ids: ['unknown'] })
    expect(result.results).toEqual([])
  })

  it('exercises the gateway with locked dev_only fields and returns ok on success', async () => {
    let captured: LLMGatewayRequest | null = null
    const invokeGateway = vi.fn(async (request: LLMGatewayRequest) => {
      captured = request
      return {
        content: 'OK',
        messages: [],
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        latencyMs: 12,
        platformRetryCount: 0,
        renderDecision: { tier: 'base', reason: 'diagnostic' } as never,
        executionPlan: {} as never,
        promptRef: {
          id: ADMIN_LLM_CONNECTIVITY_PROMPT_ID,
          version: ADMIN_LLM_CONNECTIVITY_PROMPT_VERSION,
        },
      } as unknown as LLMGatewayResponse
    })

    const service = new LlmConnectivityDiagnosticService({
      bundle: makeBundle(),
      invokeGateway,
      now: () => new Date('2026-04-27T11:00:00.000Z'),
    })

    const list = service.list()
    const result = await service.test({ route_ids: list.rows.map((r) => r.route_id), runId: 'run-1' })
    expect(result.results).toHaveLength(1)
    expect(result.results[0]!.status).toBe('ok')
    expect(result.results[0]!.error_code).toBeNull()
    expect(result.results[0]!.tested_at).toBe('2026-04-27T11:00:00.000Z')

    expect(invokeGateway).toHaveBeenCalledOnce()
    expect(captured).not.toBeNull()
    expect(captured!.intent).toBe('dev_prompt_render')
    expect(captured!.visibility).toBe('dev_only')
    expect(captured!.scene).toBe('dev_prompt_render')
    expect(captured!.budgetClass).toBe('dev_only')
    expect(captured!.modality).toBe('text')
    expect(captured!.responseMode).toBe('text')
    expect(captured!.requestedTier).toBe('base')
    expect(captured!.providerTags).toEqual(['visible'])
    expect(captured!.allowFallbackWithinLine).toBe(false)
    expect(captured!.allowCrossFamily).toBe(false)
    expect(captured!.traceId.startsWith('admin-llm-connectivity:run-1:')).toBe(true)
    expect(captured!.promptRef).toEqual({
      id: ADMIN_LLM_CONNECTIVITY_PROMPT_ID,
      version: ADMIN_LLM_CONNECTIVITY_PROMPT_VERSION,
    })
    expect(captured!.routingConstraint).toEqual({
      profileId: 'profile-anchor-base',
      providerId: 'provider-a',
      modelId: 'gpt-4o-2024-08-06',
      adapterId: 'adapter-openai',
    })
  })

  it('classifies gateway contract errors and sanitizes the error message', async () => {
    const invokeGateway = vi.fn(async () => {
      throw new LLMGatewayContractError('RegistryResolutionError', 'no admitted candidate', {
        profile_id: 'profile-anchor-base',
      })
    })
    const service = new LlmConnectivityDiagnosticService({
      bundle: makeBundle(),
      invokeGateway,
    })
    const { rows } = service.list()
    const result = await service.test({ route_ids: rows.map((r) => r.route_id) })
    expect(result.results[0]!.status).toBe('failed')
    expect(result.results[0]!.error_code).toBe('RegistryResolutionError')
    expect(result.results[0]!.error_message_redacted).toContain('no admitted candidate')
  })

  it('classifies generic errors via heuristics', async () => {
    const invokeGateway = vi.fn(async () => {
      throw new Error('upstream timeout after 30000ms')
    })
    const service = new LlmConnectivityDiagnosticService({
      bundle: makeBundle(),
      invokeGateway,
    })
    const { rows } = service.list()
    const result = await service.test({ route_ids: rows.map((r) => r.route_id) })
    expect(result.results[0]!.error_code).toBe('TimeoutError')
  })
})

describe('helpers', () => {
  it('deriveModelVersion handles common patterns', () => {
    expect(__testing.deriveModelVersion('gpt-4o-2024-08-06')).toBe('2024-08-06')
    expect(__testing.deriveModelVersion('claude-haiku-4-5-20251001')).toBe('20251001')
    expect(__testing.deriveModelVersion('gpt-4o-mini')).toBeNull()
  })

  it('deriveModelName strips vendor namespace if present', () => {
    expect(__testing.deriveModelName('anthropic/claude-haiku-4-5')).toBe('claude-haiku-4-5')
    expect(__testing.deriveModelName('gpt-4o')).toBe('gpt-4o')
  })

  it('classifyError maps gateway error codes verbatim', () => {
    const err = new LLMGatewayContractError('RateLimitError', 'rate-limited')
    expect(__testing.classifyError(err)).toBe('RateLimitError')
  })
})
