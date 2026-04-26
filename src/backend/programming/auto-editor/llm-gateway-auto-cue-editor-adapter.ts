/**
 * T-214 A-M3 follow-on — `LLMGatewayAutoCueEditorAdapter`.
 *
 * Bridges the editor's `AutoCueEditorLlmClient` interface (a thin
 * `generateJson` contract) to the existing `LLMGateway`.
 *
 * Routing decision (overview §62, Plan agent §4):
 *   - `intent: 'director_plan'` — reuses the existing hidden director
 *     lane so the registry doesn't need a new entry to ship A-M3. A
 *     follow-on may split this into a dedicated `cue_auto_edit` intent
 *     once the auto-editor's voice-line / observability split warrants
 *     it; for MVP the reuse is acceptable.
 *   - `responseMode: 'json_object'` — strict structured output.
 *   - `requestedTier: 'base'` — auto-editing favors reasoning over
 *     speed; M3 reduces this to `'lite'` if the inbox approval rate
 *     stabilizes.
 *   - `promptRef: cue-auto-editor@1` is registered in the LLM prompt
 *     registry. The adapter passes structured variables so the gateway
 *     prompt engine owns rendering.
 *   - `temperatureBias` from the editor is forwarded as a
 *     `localOverrides.regionHint` placeholder TODO once the gateway
 *     exposes a temperature override path; until then the adapter
 *     re-issues with a system-message conservativeness directive.
 *
 * Failure mode: registry resolution errors (missing
 * `hidden-director_plan-base` policy, etc.) propagate as exceptions so
 * the scheduler logs them and skips the trigger — better than silently
 * landing nothing.
 */

import type {
  LLMGateway,
} from '../../llm/llm-gateway.js'
import type { LLMGatewayRequest } from '../../llm/gateway-contract.js'
import { PROMPT_TEMPLATE_REFS } from '../../llm/prompt-template-refs.js'
import type {
  AutoCueEditorLlmClient,
  AutoCueEditorPromptInput,
} from './auto-cue-editor.js'

export interface LLMGatewayAutoCueEditorAdapterDeps {
  llmGateway: Pick<LLMGateway, 'generateHiddenArtifact'>
  /**
   * Stable agent id under which auto-editor LLM calls are attributed.
   * Defaults to a fixed sentinel; production may wire a dedicated
   * "system / programming" agent.
   */
  systemAgentId?: string
  /**
   * Override for the home voice line id. Auto-editor traffic doesn't
   * map to a real agent voice; a hidden-line default lets the gateway
   * resolve a usable profile. Production wiring picks the configured
   * default.
   */
  homeVoiceLineId?: string
}

const DEFAULT_SYSTEM_AGENT_ID = 'system:auto-cue-editor'
const DEFAULT_HOME_VOICE_LINE_ID = 'qwen-director-v1'

export class LLMGatewayAutoCueEditorAdapter implements AutoCueEditorLlmClient {
  constructor(private readonly deps: LLMGatewayAutoCueEditorAdapterDeps) {}

  async generateJson(input: {
    promptInput: AutoCueEditorPromptInput
    temperatureBias: 'normal' | 'negative'
    traceId: string
  }): Promise<{ rawJson: string }> {
    const request: Omit<LLMGatewayRequest, 'visibility'> = {
      intent: 'director_plan',
      scene: 'background_hidden',
      modality: 'text',
      responseMode: 'json_object',
      agentId: this.deps.systemAgentId ?? DEFAULT_SYSTEM_AGENT_ID,
      homeVoiceLineId:
        (this.deps.homeVoiceLineId ?? DEFAULT_HOME_VOICE_LINE_ID) as LLMGatewayRequest['homeVoiceLineId'],
      promptRef: PROMPT_TEMPLATE_REFS.cueAutoEditor,
      variables: buildVariables(input.promptInput, input.temperatureBias),
      budgetClass: 'hidden_background',
      traceId: input.traceId,
      requestedTier: 'base',
      allowFallbackWithinLine: true,
      allowCrossFamily: false,
    }
    const response = await this.deps.llmGateway.generateHiddenArtifact(request)
    return { rawJson: response.content }
  }
}

function buildVariables(
  promptInput: AutoCueEditorPromptInput,
  temperatureBias: 'normal' | 'negative',
): Record<string, string> {
  const conservativeness =
    temperatureBias === 'negative'
      ? 'The previous attempt produced an off-schema or unsafe patch. Be more conservative; default to action="defer_cue" or "cancel_cue" if uncertain.'
      : ''
  return {
    prompt_input_json: JSON.stringify(promptInput, null, 2),
    conservativeness_directive: conservativeness,
  }
}
