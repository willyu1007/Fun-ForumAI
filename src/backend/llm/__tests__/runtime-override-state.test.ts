import { describe, expect, it } from 'vitest'
import type { UsageLedgerEntry } from '../gateway-contract.js'
import { buildRuntimeOverrideState } from '../runtime-override-state.js'

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
      policyId: 'visible-private_reply-base',
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
    policy_id: 'visible-private_reply-base',
    adapter_id: 'openai-chat-completions-v1',
    credential_id: 'dashscope-primary',
    merge_trace: {
      hardCaps: { modality: 'text', responseMode: 'text', maxTokens: 8192, timeoutMs: 30000, maxRetries: 2 },
      policyDefaults: { modality: 'text', responseMode: 'text', temperature: 0.8, maxTokens: 720, timeoutMs: 30000, maxRetries: 2 },
      callsiteOverrides: {},
      debugOverrides: {},
      appliedOverrideFields: [],
      ...overrides,
    },
    latency_ms: 120,
    created_at: '2026-04-04T00:00:00.000Z',
  }
}

describe('buildRuntimeOverrideState', () => {
  it('marks deprecated env pins and recent debug override evidence as unapproved overrides', () => {
    const state = buildRuntimeOverrideState({
      routingMode: 'policy_driven',
      env: {
        LLM_MODEL: 'legacy-pinned-model',
      } as NodeJS.ProcessEnv,
      recentLedgerEntries: [
        buildEntry('trace-debug-field', {
          debugOverrides: { temperature: 1.1, timeoutMs: 60000 },
          appliedDebugOverrideFields: ['temperature', 'timeoutMs'],
          appliedOverrideFields: ['temperature', 'timeoutMs'],
        }),
        buildEntry('trace-debug-pin', {
          debugRoutingOverrides: {
            providerPin: 'moonshot-openai',
            modelPin: 'kimi-k2-0905-preview',
          },
        }),
      ],
    })

    expect(state.routing_mode).toBe('policy_driven')
    expect(state.deprecated_env_pins).toEqual(['LLM_MODEL'])
    expect(state.unapproved_debug_overrides_present).toBe(true)
    expect(state.debug_override_sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'deprecated_env_pin',
          key: 'LLM_MODEL',
        }),
        expect.objectContaining({
          source: 'debug_override_field',
          key: 'temperature',
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
})
