import { VOICE_LINE_CATALOG, type VoiceLineId } from '../../shared/agent-persona-catalog.js'

const QWEN_VISIBLE_MODEL_PREFERENCES: Record<string, string> = {
  'qwen-flash': 'qwen-flash-character',
  'qwen-flash-character': 'qwen-flash-character',
  'qwen-plus': 'qwen-plus-character',
  'qwen-plus-character': 'qwen-plus-character',
  'qwen-turbo': 'qwen-plus-character',
  'qwen-max': 'qwen-max',
}

const QWEN_MULTIMODAL_MODEL_PREFERENCES: Record<string, string> = {
  'qwen-flash': 'qwen-vl-plus',
  'qwen-flash-character': 'qwen-vl-plus',
  'qwen-plus': 'qwen-vl-plus',
  'qwen-plus-character': 'qwen-vl-plus',
  'qwen-turbo': 'qwen-vl-plus',
  'qwen-max': 'qwen-vl-max',
  'qwen-vl-plus': 'qwen-vl-plus',
  'qwen-vl-max': 'qwen-vl-max',
}

export function resolvePreferredMultimodalModelId(
  modelId: string | null | undefined,
): string | undefined {
  const normalized = modelId?.trim().toLowerCase()
  if (!normalized) return undefined
  return QWEN_MULTIMODAL_MODEL_PREFERENCES[normalized] ?? normalized
}

export function resolvePreferredVisibleModelId(
  agentModel: string | null | undefined,
  homeVoiceLineId: VoiceLineId,
): string | undefined {
  const normalized = agentModel?.trim().toLowerCase()
  if (!normalized) return undefined

  switch (VOICE_LINE_CATALOG[homeVoiceLineId].family) {
    case 'qwen':
      return QWEN_VISIBLE_MODEL_PREFERENCES[normalized]
    default:
      return undefined
  }
}
