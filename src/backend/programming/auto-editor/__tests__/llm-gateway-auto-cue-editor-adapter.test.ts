import { describe, expect, it, vi } from 'vitest'
import { PROMPT_TEMPLATE_REFS } from '../../../llm/prompt-template-refs.js'
import {
  LLMGatewayAutoCueEditorAdapter,
} from '../llm-gateway-auto-cue-editor-adapter.js'
import type { AutoCueEditorPromptInput } from '../auto-cue-editor.js'

function buildPromptInput(): AutoCueEditorPromptInput {
  return {
    trigger: {
      id: 'trigger-1',
      type: 'COMMUNITY_LULL',
      severity: 'standard',
      community_id: 'community-1',
      evidence: { window_minutes: 60 },
    },
    gate: {
      load_state: 'green',
      allowed_actions: ['create_cue', 'update_cue'],
      propose_only: false,
      reason_code: 'green_full_surface',
    },
    target_cue: null,
    media_candidates: [
      { asset_id: 'asset-1', label: 'town square image', role: 'context' },
    ],
  }
}

describe('LLMGatewayAutoCueEditorAdapter', () => {
  it('uses the registered cue-auto-editor prompt template with variables', async () => {
    const generateHiddenArtifact = vi.fn(async (_request: Record<string, unknown>) => ({
      content: '{"action":"create_cue"}',
    }) as never)
    const adapter = new LLMGatewayAutoCueEditorAdapter({
      llmGateway: { generateHiddenArtifact } as never,
    })

    const result = await adapter.generateJson({
      promptInput: buildPromptInput(),
      temperatureBias: 'normal',
      traceId: 'trace-1',
    })

    expect(result.rawJson).toBe('{"action":"create_cue"}')
    expect(generateHiddenArtifact).toHaveBeenCalledWith(expect.objectContaining({
      intent: 'director_plan',
      responseMode: 'json_object',
      promptRef: PROMPT_TEMPLATE_REFS.cueAutoEditor,
      variables: expect.objectContaining({
        prompt_input_json: expect.stringContaining('"COMMUNITY_LULL"'),
        conservativeness_directive: '',
      }),
    }))
    expect(generateHiddenArtifact.mock.calls[0]?.[0]).not.toHaveProperty('promptMessages')
  })

  it('passes retry conservativeness through prompt variables', async () => {
    const generateHiddenArtifact = vi.fn(async (_request: Record<string, unknown>) => ({
      content: '{"action":"defer_cue"}',
    }) as never)
    const adapter = new LLMGatewayAutoCueEditorAdapter({
      llmGateway: { generateHiddenArtifact } as never,
    })

    await adapter.generateJson({
      promptInput: buildPromptInput(),
      temperatureBias: 'negative',
      traceId: 'trace-2',
    })

    const request = generateHiddenArtifact.mock.calls[0]?.[0] as
      | { variables?: Record<string, string> }
      | undefined
    const variables = request?.variables
    expect(variables?.conservativeness_directive).toContain('Be more conservative')
  })
})
