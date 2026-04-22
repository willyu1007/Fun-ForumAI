import { describe, expect, it } from 'vitest'
import type { UsageLedgerEntry } from '../gateway-contract.js'
import { buildRuntimeAuthorityState } from '../runtime-authority-state.js'

function buildEntry(
  traceId: string,
  overrides: Partial<UsageLedgerEntry['merge_trace']>,
): UsageLedgerEntry {
  return {
    trace_id: traceId,
    agent_id: 'agent-1',
    intent: 'private_reply',
    visibility: 'visible',
    scene: 'private_chat',
    prompt_ref: { id: 'agent-private-chat-reply', version: 2 },
    render_decision: {
      voiceLineId: 'qwen-social-v1',
      tier: 'base',
      profileId: 'qwen-social-private-reply-base',
      policyId: 'visible-private_reply-realtime',
      providerId: 'dashscope-openai',
      modelId: 'qwen-plus-character',
      adapterId: 'openai-chat-completions-v1',
      region: 'cn-beijing',
      endpointId: 'dashscope-cn-beijing',
      credentialId: 'dashscope-primary',
      fallbackLevel: 'none',
      reasons: [],
      promptTemplateId: 'agent-private-chat-reply',
      promptVersion: 2,
    },
    success: true,
    provider_id: 'dashscope-openai',
    model_id: 'qwen-plus-character',
    profile_id: 'qwen-social-private-reply-base',
    policy_id: 'visible-private_reply-realtime',
    adapter_id: 'openai-chat-completions-v1',
    credential_id: 'dashscope-primary',
    merge_trace: {
      hardCaps: { modality: 'text', responseMode: 'text', maxTokens: 8192, timeoutMs: 30000, maxRetries: 2 },
      policyDefaults: { modality: 'text', responseMode: 'text', temperature: 0.78, maxTokens: 256, timeoutMs: 30000, maxRetries: 0 },
      callsiteOverrides: {},
      debugOverrides: {},
      appliedOverrideFields: [],
      ...overrides,
    },
    latency_ms: 120,
    created_at: '2026-04-04T00:00:00.000Z',
  }
}

describe('buildRuntimeAuthorityState', () => {
  it('surfaces env pins and recent debug signals without old naming', () => {
    const state = buildRuntimeAuthorityState({
      routingMode: 'policy_driven',
      env: {
        LLM_MODEL: 'manual-env-pin',
      } as NodeJS.ProcessEnv,
      recentLedgerEntries: [
        buildEntry('trace-debug-field', {
          debugOverrides: { timeoutMs: 60000, regionHint: 'cn-beijing' },
          appliedDebugOverrideFields: ['timeoutMs', 'regionHint'],
          appliedOverrideFields: ['timeoutMs', 'regionHint'],
        }),
        buildEntry('trace-debug-pin', {
          debugRoutingOverrides: {
            providerPin: 'moonshot-openai',
            modelPin: 'kimi-k2.5',
          },
        }),
      ],
    })

    expect(state.routing_mode).toBe('policy_driven')
    expect(state.env_pins).toEqual(['LLM_MODEL'])
    expect(state.debug_signals_present).toBe(true)
    expect(state.debug_signal_sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'env_pin',
          key: 'LLM_MODEL',
        }),
        expect.objectContaining({
          source: 'debug_field',
          key: 'timeoutMs',
          trace_id: 'trace-debug-field',
        }),
        expect.objectContaining({
          source: 'debug_field',
          key: 'regionHint',
          trace_id: 'trace-debug-field',
        }),
        expect.objectContaining({
          source: 'debug_pin',
          key: 'providerPin',
          value: 'moonshot-openai',
          trace_id: 'trace-debug-pin',
        }),
      ]),
    )
  })

  it('ignores product routing constraints when no debug overrides were used', () => {
    const state = buildRuntimeAuthorityState({
      routingMode: 'policy_driven',
      recentLedgerEntries: [
        buildEntry('trace-routing-constraint', {
          routingConstraint: {
            providerId: 'moonshot-openai',
            modelId: 'moonshot-v1-128k',
          },
        }),
      ],
    })

    expect(state.debug_signals_present).toBe(false)
    expect(state.debug_signal_sources).toEqual([])
  })
})
