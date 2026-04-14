import { config } from '../lib/config.js'
import type { AspectRatioHint } from '../repos/types.js'
import {
  MediaGenerationGatewayError,
  type MediaGenerationGateway,
  type MediaGenerationGatewayInput,
  type MediaGenerationGatewayResult,
} from './media-generation-gateway.js'

function resolveImageSize(aspectRatioHint: AspectRatioHint | null | undefined): string {
  switch (aspectRatioHint) {
    case '1:1':
      return '2048*2048'
    case '16:9':
      return '2688*1536'
    case '4:5':
    default:
      return '1792*2240'
  }
}

function buildPrompt(input: MediaGenerationGatewayInput): string {
  return input.compiled_prompt.rendered_prompt.trim()
}

function resolveGenerationEndpoint(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, '')
  const suffix = '/api/v1/services/aigc/multimodal-generation/generation'
  if (normalized.endsWith(suffix)) {
    return normalized
  }
  return `${normalized}${suffix}`
}

function extractImageUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const output = (payload as { output?: unknown }).output
  if (!output || typeof output !== 'object') return null

  const candidates: unknown[] = []
  const outputRecord = output as {
    choices?: Array<{ message?: { content?: Array<{ image?: string | null; url?: string | null }> } }>
    images?: Array<{ image?: string | null; url?: string | null }>
    results?: Array<{ image?: string | null; url?: string | null }>
  }
  candidates.push(...(outputRecord.choices ?? []))
  candidates.push(...(outputRecord.images ?? []))
  candidates.push(...(outputRecord.results ?? []))

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    if ('message' in candidate) {
      const content = (candidate as { message?: { content?: Array<{ image?: string | null; url?: string | null }> } })
        .message?.content ?? []
      for (const item of content) {
        const url = item?.image?.trim() || item?.url?.trim() || ''
        if (url) return url
      }
      continue
    }
    const url = (candidate as { image?: string | null; url?: string | null }).image?.trim()
      || (candidate as { image?: string | null; url?: string | null }).url?.trim()
      || ''
    if (url) return url
  }
  return null
}

export class DashScopeQwenImageGateway implements MediaGenerationGateway {
  readonly providerId = 'dashscope-qwen-image'
  readonly modelName = config.mediaGeneration.fallbackModel

  get isConfigured(): boolean {
    return config.launch.capabilities.mediaGenerationV1
      && config.mediaGeneration.fallbackProvider === this.providerId
      && config.mediaGeneration.fallbackApiKey.trim().length > 0
  }

  async generate(input: MediaGenerationGatewayInput): Promise<MediaGenerationGatewayResult> {
    if (!this.isConfigured) {
      throw new MediaGenerationGatewayError('media generation fallback gateway is not configured', {
        provider_id: this.providerId,
        model_name: this.modelName,
      })
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), config.mediaGeneration.timeoutMs)
    try {
      const response = await fetch(
        resolveGenerationEndpoint(config.mediaGeneration.fallbackBaseUrl),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.mediaGeneration.fallbackApiKey}`,
          },
          body: JSON.stringify({
            model: this.modelName,
            input: {
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      text: buildPrompt(input),
                    },
                  ],
                },
              ],
            },
            parameters: {
              watermark: false,
              prompt_extend: true,
              size: resolveImageSize(input.compiled_prompt.aspect_ratio_hint),
            },
          }),
          signal: controller.signal,
        },
      )
      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        throw new MediaGenerationGatewayError(
          `qwen_image_generation_failed status=${response.status} body=${errorText.slice(0, 300)}`,
          {
            provider_id: this.providerId,
            model_name: this.modelName,
          },
        )
      }

      const payload = await response.json()
      const imageUrl = extractImageUrl(payload)
      if (!imageUrl) {
        throw new MediaGenerationGatewayError('qwen_image_generation_missing_url', {
          provider_id: this.providerId,
          model_name: this.modelName,
        })
      }

      return {
        image_url: imageUrl,
        mime_type: 'image/png',
        provider_id: this.providerId,
        model_name: this.modelName,
        provider_request_summary: {
          route: 'fallback_direct',
          selected_provider_id: this.providerId,
          selected_model_name: this.modelName,
          attempts: [
            {
              provider_id: this.providerId,
              model_name: this.modelName,
              outcome: 'succeeded',
            },
          ],
        },
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new MediaGenerationGatewayError('qwen_image_generation_timeout', {
          cause: err,
          provider_id: this.providerId,
          model_name: this.modelName,
        })
      }
      if (err instanceof MediaGenerationGatewayError) {
        throw err
      }
      throw new MediaGenerationGatewayError(
        err instanceof Error ? err.message : 'qwen_image_generation_failed',
        {
          cause: err,
          provider_id: this.providerId,
          model_name: this.modelName,
        },
      )
    } finally {
      clearTimeout(timer)
    }
  }
}
