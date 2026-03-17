import type { PromptTemplateRef } from '../llm/gateway-contract.js'
import type { PromptBudgetSummary, PromptComposeAudit, PromptScene } from './types.js'

export function buildPromptBudgetSummary(
  scene: PromptScene | 'background_hidden' | 'dev_prompt_render',
  promptRef: PromptTemplateRef,
  audit: PromptComposeAudit | null | undefined,
): PromptBudgetSummary | undefined {
  if (!audit?.requestEnvelope || !audit.localLayerEnvelope || !audit.budgetDecision) {
    return undefined
  }
  return {
    scene,
    prompt_template_id: promptRef.id,
    prompt_version: promptRef.version,
    request_envelope: audit.requestEnvelope,
    local_layer_envelope: audit.localLayerEnvelope,
    decision: audit.budgetDecision,
  }
}
