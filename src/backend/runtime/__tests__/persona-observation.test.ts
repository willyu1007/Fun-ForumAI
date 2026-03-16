import { describe, expect, it } from 'vitest'
import {
  buildPersonaObservation,
  buildPersonaObservabilitySummary,
  isPersonaObservationComplete,
  normalizeAgentRunReadPayload,
} from '../persona-observation.js'

describe('persona-observation', () => {
  it('requires full visible-complete attribution fields', () => {
    const observation = buildPersonaObservation({
      sourceCallsiteId: 'conversation-clock-chat-reply',
      scene: 'chat_room',
      intent: 'chat_reply',
      visibility: 'visible',
      coverageStatus: 'visible_complete',
      personaSeedCode: 'scholar',
      homeVoiceLineId: 'qwen-social-v1',
      promptRef: { id: 'agent-chat-reply', version: 4 },
      requestedTier: 'lite',
      resolvedTier: 'lite',
      renderDecision: {
        voiceLineId: 'qwen-social-v1',
        tier: 'lite',
        profileId: 'qwen-social-chat-reply-lite',
        providerId: 'openrouter',
        modelId: 'qwen/qwen3-32b',
        region: 'global',
        fallbackLevel: 'none',
        reasons: ['test'],
        promptTemplateId: 'agent-chat-reply',
        promptVersion: 4,
      },
      usage: { prompt_tokens: 10, completion_tokens: 6, total_tokens: 16 },
      latencyMs: 800,
      parseSuccess: true,
      promptAudit: {
        version: 'v1',
        scene: 'chat_room',
        includedLayerIds: ['layer1_traits'],
        tokenEstimates: { layer1_traits: 8 },
        lintWarnings: [],
        trimReasons: [],
      },
    })

    expect(isPersonaObservationComplete(observation)).toBe(true)
    expect(observation.prompt_audit?.included_layer_ids).toEqual(['layer1_traits'])
  })

  it('allows partial hidden envelopes', () => {
    const hidden = buildPersonaObservation({
      sourceCallsiteId: 'public-observation-digest',
      scene: 'background_hidden',
      intent: 'public_observation_digest',
      visibility: 'hidden',
      coverageStatus: 'hidden_partial',
    })

    expect(isPersonaObservationComplete(hidden)).toBe(true)
    expect(hidden.coverage_status).toBe('hidden_partial')
  })

  it('normalizes persona observation into agent run read payload and summary blocks', () => {
    const observation = buildPersonaObservation({
      sourceCallsiteId: 'private-channel-reply',
      scene: 'private_chat',
      intent: 'private_reply',
      visibility: 'visible',
      coverageStatus: 'visible_partial',
      parseSuccess: true,
    })

    const payload = normalizeAgentRunReadPayload({
      id: 'run-1',
      agent_id: 'agent-1',
      trigger_event_id: 'evt-1',
      input_digest: 'digest',
      output_json: {
        session_id: 'session-1',
        persona_observation: observation,
      },
      moderation_result: null,
      token_cost: 18,
      latency_ms: 900,
      created_at: new Date('2026-03-09T00:00:00.000Z'),
    })

    expect(payload.persona_observation).toMatchObject({
      source_callsite_id: 'private-channel-reply',
      scene: 'private_chat',
    })

    const summary = buildPersonaObservabilitySummary({
      observed_runs_total: 2,
      observed_visible_runs_total: 1,
      observed_hidden_runs_total: 1,
      visible_complete_runs_total: 0,
      visible_partial_runs_total: 1,
      hidden_partial_runs_total: 1,
      complete_runs_total: 2,
      parse_attempt_total: 1,
      parse_success_total: 1,
      identity_write_attempt_total: 0,
      identity_write_success_total: 0,
      fallback_none_total: 2,
      fallback_same_line_total: 0,
      fallback_same_family_total: 0,
      fallback_cross_family_hidden_total: 0,
      fallback_rare_reanchor_total: 0,
      overlay_activation_total: 0,
      rare_reanchor_total: 0,
    })

    expect(summary).toMatchObject({
      log_completeness: {
        complete_runs: 2,
        observed_runs: 2,
      },
      parse_success: {
        attempts: 1,
        successes: 1,
      },
    })
  })
})
