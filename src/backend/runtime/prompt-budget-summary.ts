import type { PromptTemplateRef } from '../llm/gateway-contract.js'
import type { LlmMessage, LlmMessageContentPart } from '../llm/types.js'
import type { PromptBudgetSummary, PromptComposeAudit, PromptScene } from './types.js'

const REMOTE_IMAGE_TOKEN_ESTIMATE = 256
const DATA_URL_IMAGE_MIN_TOKEN_ESTIMATE = 64
const DATA_URL_BYTES_PER_ESTIMATED_TOKEN = 5_000

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
  return Math.max(1, messages.reduce((sum, message) => sum + estimateMessageTokens(message), 0))
}

function estimateMessageTokens(message: LlmMessage): number {
  return estimateContentTokens(message.content) + 8
}

function estimateContentTokens(content: LlmMessage['content']): number {
  if (typeof content === 'string') {
    return Math.max(1, Math.ceil(content.length / 4))
  }

  return content.reduce((sum, part) => sum + estimateContentPartTokens(part), 0)
}

function estimateContentPartTokens(part: LlmMessageContentPart): number {
  if (part.type === 'text') {
    return Math.max(1, Math.ceil(part.text.length / 4))
  }

  const url = part.image_url.url
  if (!url.startsWith('data:')) {
    return REMOTE_IMAGE_TOKEN_ESTIMATE
  }

  const base64Index = url.indexOf('base64,')
  if (base64Index < 0) {
    return REMOTE_IMAGE_TOKEN_ESTIMATE
  }

  const encoded = url.slice(base64Index + 'base64,'.length)
  const decodedBytes = estimateDecodedBytes(encoded)
  return Math.max(
    DATA_URL_IMAGE_MIN_TOKEN_ESTIMATE,
    Math.ceil(decodedBytes / DATA_URL_BYTES_PER_ESTIMATED_TOKEN),
  )
}

function estimateDecodedBytes(base64Text: string): number {
  const padding = base64Text.endsWith('==') ? 2 : base64Text.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((base64Text.length * 3) / 4) - padding)
}
