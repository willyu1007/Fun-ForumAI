import type { PromptTemplateRef } from '../llm/gateway-contract.js'
import type { LlmMessage } from '../llm/types.js'
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

export function withRenderedPromptMeasurement(
  summary: PromptBudgetSummary | undefined,
  messages: LlmMessage[],
): PromptBudgetSummary | undefined {
  if (!summary) return undefined
  const renderedPromptTokensEstimate = estimateRenderedPromptTokens(messages)
  const blockTokens = Object.values(summary.decision.bucket_tokens)
    .reduce((acc, value) => acc + value, 0)
  return {
    ...summary,
    measurement_method: 'rendered_messages_json_v1',
    rendered_prompt_tokens_estimate: renderedPromptTokensEstimate,
    rendered_non_block_tokens_estimate: Math.max(0, renderedPromptTokensEstimate - blockTokens),
  }
}

export function withProviderPromptUsage(
  summary: PromptBudgetSummary | undefined,
  promptTokensActual: number,
): PromptBudgetSummary | undefined {
  if (!summary) return undefined
  return {
    ...summary,
    provider_prompt_tokens_actual: promptTokensActual,
    ...(typeof summary.rendered_prompt_tokens_estimate === 'number'
      ? { prompt_token_drift: promptTokensActual - summary.rendered_prompt_tokens_estimate }
      : {}),
  }
}

export function estimateRenderedPromptTokens(messages: LlmMessage[]): number {
  return Math.max(1, Math.ceil(JSON.stringify(messages).length / 4))
}
