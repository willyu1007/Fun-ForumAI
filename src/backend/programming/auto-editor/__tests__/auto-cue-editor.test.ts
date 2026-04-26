import { describe, expect, it, vi } from 'vitest'
import { AutoCueEditor, type AutoCueEditorLlmClient } from '../auto-cue-editor.js'
import type {
  AutoEditorTriggerEventDomain,
  LoadGateDecision,
} from '../types.js'

function buildTrigger(): AutoEditorTriggerEventDomain {
  return {
    id: 'trigger-1',
    community_id: 'community-1',
    trigger_type: 'COMMUNITY_LULL',
    severity: 'standard',
    source: 'scan',
    evidence: { window_minutes: 60 },
    dedup_key: 'COMMUNITY_LULL:community-1:q123',
    detected_at: new Date('2026-04-27T20:00:00Z'),
    created_at: new Date('2026-04-27T20:00:00Z'),
  }
}

function buildGate(overrides: Partial<LoadGateDecision> = {}): LoadGateDecision {
  return {
    load_state: 'green',
    load_signal_source: 'load_signal_service:cached',
    community_id: 'community-1',
    allowed_actions: ['create_cue', 'update_cue', 'cancel_cue'],
    propose_only: false,
    short_circuit: false,
    reason_code: 'green_full_surface',
    ...overrides,
  }
}

function buildValidJsonOutput(): string {
  return JSON.stringify({
    action: 'create_cue',
    reason: 'community lull detected',
    risk_level: 'standard',
    target_cue_id: null,
    patch_json: {
      version: 1,
      partial: {
        trigger_at: '2026-04-27T20:30:00Z',
        timezone: 'UTC',
        priority: 50,
        lane: 'standard',
      },
    },
    confidence: 0.7,
    requires_review: true,
  })
}

function buildLlmStub(
  outputs: string[],
): AutoCueEditorLlmClient & { calls: number } {
  let calls = 0
  return {
    get calls() {
      return calls
    },
    set calls(v: number) {
      calls = v
    },
    async generateJson() {
      const out = outputs[Math.min(calls, outputs.length - 1)]!
      calls += 1
      return { rawJson: out }
    },
  } as unknown as AutoCueEditorLlmClient & { calls: number }
}

describe('AutoCueEditor.run — happy path', () => {
  it('returns validated output and reconciled risk on first attempt', async () => {
    const editor = new AutoCueEditor({
      llmClient: buildLlmStub([buildValidJsonOutput()]),
    })
    const result = await editor.run({
      trigger: buildTrigger(),
      gate: buildGate(),
      mediaCandidates: [],
      inPrimeWindow: true,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.output.action).toBe('create_cue')
      // create_cue + prime window → high (prime_window_structural_change)
      expect(result.risk.band).toBe('high')
      expect(result.risk.reason_codes).toContain('prime_window_structural_change')
      expect(result.attempts).toBe(1)
    }
  })
})

describe('AutoCueEditor.run — short circuit', () => {
  it('returns short_circuit when LoadGate flags it (no LLM call)', async () => {
    const llm = buildLlmStub([buildValidJsonOutput()])
    const editor = new AutoCueEditor({ llmClient: llm })
    const result = await editor.run({
      trigger: buildTrigger(),
      gate: buildGate({ short_circuit: true, allowed_actions: [] }),
      mediaCandidates: [],
      inPrimeWindow: false,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('short_circuit')
      expect(result.attempts).toBe(0)
    }
    expect(llm.calls).toBe(0)
  })

  it('returns no_action when allowed_actions is empty (no short_circuit flag)', async () => {
    const llm = buildLlmStub([buildValidJsonOutput()])
    const editor = new AutoCueEditor({ llmClient: llm })
    const result = await editor.run({
      trigger: buildTrigger(),
      gate: buildGate({ allowed_actions: [], short_circuit: false }),
      mediaCandidates: [],
      inPrimeWindow: false,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('no_action')
    expect(llm.calls).toBe(0)
  })
})

describe('AutoCueEditor.run — retry loop', () => {
  it('retries with negative bias when LLM returns invalid JSON', async () => {
    const editor = new AutoCueEditor({
      llmClient: buildLlmStub(['not valid json{{', buildValidJsonOutput()]),
    }, { maxRetries: 2 })
    const result = await editor.run({
      trigger: buildTrigger(),
      gate: buildGate(),
      mediaCandidates: [],
      inPrimeWindow: false,
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.attempts).toBe(2)
  })

  it('gives up after maxRetries when validator never passes', async () => {
    const editor = new AutoCueEditor({
      llmClient: buildLlmStub([
        '{"bad": "shape"}',
        '{"bad": "shape"}',
        '{"bad": "shape"}',
      ]),
    }, { maxRetries: 2 })
    const result = await editor.run({
      trigger: buildTrigger(),
      gate: buildGate(),
      mediaCandidates: [],
      inPrimeWindow: false,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('validator_failed')
      expect(result.attempts).toBe(3) // initial + 2 retries
    }
  })

  it('rejects unauthorized media asset_id even on otherwise-valid JSON', async () => {
    const llm = buildLlmStub([
      JSON.stringify({
        action: 'attach_media',
        reason: 'add hook image',
        risk_level: 'low',
        target_cue_id: 'cue-existing',
        patch_json: {
          version: 1,
          partial: {
            // Forward-looking: forbidden / off-schema shape with a buried
            // unauthorized asset id. The validator catches it.
            media_policy: {
              media_resource_pool: [{ asset_id: 'asset-INVENTED-BY-LLM' }],
            },
          },
        },
        confidence: 0.5,
        requires_review: true,
      }),
    ])
    const editor = new AutoCueEditor({ llmClient: llm }, { maxRetries: 0 })
    const result = await editor.run({
      trigger: buildTrigger(),
      gate: buildGate({ allowed_actions: ['attach_media'] }),
      mediaCandidates: [{ asset_id: 'asset-1', label: 'authorized', role: 'context_anchor' }],
      inPrimeWindow: false,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('validator_failed')
      // Either off_schema or unauthorized_media_asset must fire.
      const codes = result.failures?.map((f) => f.code) ?? []
      expect(
        codes.some((c) => c === 'off_schema' || c === 'unauthorized_media_asset'),
      ).toBe(true)
    }
  })
})

describe('AutoCueEditor.run — risk reconciliation', () => {
  it('uses max(classifier, llm)', async () => {
    const lowAction = JSON.stringify({
      action: 'defer_cue',
      reason: 'background defer',
      risk_level: 'low',
      target_cue_id: 'cue-existing',
      patch_json: {
        version: 1,
        partial: { trigger_at: '2026-04-27T20:30:00Z' },
      },
      confidence: 0.7,
      requires_review: true,
    })
    const editor = new AutoCueEditor({
      llmClient: buildLlmStub([lowAction]),
    })
    const result = await editor.run({
      trigger: buildTrigger(),
      // propose_only forces high regardless of LLM-reported low
      gate: buildGate({ propose_only: true, allowed_actions: ['defer_cue'] }),
      mediaCandidates: [],
      inPrimeWindow: false,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.risk.band).toBe('high')
      expect(result.risk.reason_codes).toContain('load_gate_propose_only')
    }
  })
})

describe('AutoCueEditor — invariant probes', () => {
  it('I-6 probe: LLM cannot land a PostScheduler-domain field via the validator', async () => {
    const leakyAction = JSON.stringify({
      action: 'create_cue',
      reason: 'attempt to leak scheduler field',
      risk_level: 'standard',
      target_cue_id: null,
      patch_json: {
        version: 1,
        partial: {
          autonomous_tick_interval_ms: 1000, // PostScheduler-domain key
        },
      },
      confidence: 0.5,
      requires_review: true,
    })
    const editor = new AutoCueEditor({
      llmClient: buildLlmStub([leakyAction]),
    }, { maxRetries: 0 })
    const result = await editor.run({
      trigger: buildTrigger(),
      gate: buildGate(),
      mediaCandidates: [],
      inPrimeWindow: false,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('validator_failed')
    }
  })

  it('forwards trace ids per attempt for observability', async () => {
    const generateJsonSpy = vi.fn<AutoCueEditorLlmClient['generateJson']>(
      async () => ({ rawJson: '{"bad": "shape"}' }),
    )
    const llm: AutoCueEditorLlmClient = { generateJson: generateJsonSpy }
    const editor = new AutoCueEditor({ llmClient: llm }, { maxRetries: 1 })
    await editor.run({
      trigger: buildTrigger(),
      gate: buildGate(),
      mediaCandidates: [],
      inPrimeWindow: false,
      traceId: 'custom-trace',
    })
    expect(generateJsonSpy).toHaveBeenCalledTimes(2)
    expect(generateJsonSpy.mock.calls[0]?.[0]?.traceId).toBe('custom-trace')
    expect(generateJsonSpy.mock.calls[1]?.[0]?.traceId).toBe('custom-trace:retry:1')
    expect(generateJsonSpy.mock.calls[0]?.[0]?.temperatureBias).toBe('normal')
    expect(generateJsonSpy.mock.calls[1]?.[0]?.temperatureBias).toBe('negative')
  })
})
