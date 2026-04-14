import { config } from '../lib/config.js'
import type { AspectRatioHint } from '../repos/types.js'
import type {
  MediaGenerationGateway,
  MediaGenerationGatewayInput,
  MediaGenerationGatewayResult,
} from './media-generation-gateway.js'
import { MediaGenerationGatewayError } from './media-generation-gateway.js'

function resolveImageSize(aspectRatioHint: AspectRatioHint | null | undefined): string {
  switch (aspectRatioHint) {
    case '1:1':
      return '2048x2048'
    case '16:9':
      return '2560x1440'
    case '4:5':
    default:
      return '1920x2400'
  }
}

function buildPrompt(input: MediaGenerationGatewayInput): string {
  return input.compiled_prompt.rendered_prompt.trim()
}

function resolveGenerationEndpoint(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, '')
  if (normalized.endsWith('/api/v3/images/generations')) {
    return normalized
  }
  if (normalized.endsWith('/api/v3')) {
    return `${normalized}/images/generations`
  }
  return `${normalized}/api/v3/images/generations`
}

export class ArkSeedreamGateway implements MediaGenerationGateway {
  readonly providerId = 'ark-seedream'
  readonly modelName = config.mediaGeneration.model

  get isConfigured(): boolean {
    return config.launch.capabilities.mediaGenerationV1
      && config.mediaGeneration.provider === this.providerId
      && config.mediaGeneration.apiKey.trim().length > 0
  }

  async generate(input: MediaGenerationGatewayInput): Promise<MediaGenerationGatewayResult> {
    if (!this.isConfigured) {
      throw new Error('media generation gateway is not configured')
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), config.mediaGeneration.timeoutMs)
    try {
      const response = await fetch(
        resolveGenerationEndpoint(config.mediaGeneration.baseUrl),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.mediaGeneration.apiKey}`,
          },
          body: JSON.stringify({
            model: this.modelName,
            prompt: buildPrompt(input),
            size: resolveImageSize(input.compiled_prompt.aspect_ratio_hint),
            n: 1,
            response_format: 'url',
            stream: false,
            sequential_image_generation: 'disabled',
          }),
          signal: controller.signal,
        },
      )
      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        throw new MediaGenerationGatewayError(
          `seedream_generation_failed status=${response.status} body=${errorText.slice(0, 300)}`,
          {
            provider_id: this.providerId,
            model_name: this.modelName,
          },
        )
      }

      const payload = await response.json() as {
        data?: Array<{ url?: string | null; mime_type?: string | null }>
        images?: Array<{ url?: string | null; mime_type?: string | null }>
      }
      const record = payload.data?.[0] ?? payload.images?.[0] ?? null
      const imageUrl = record?.url?.trim()
      if (!imageUrl) {
        throw new MediaGenerationGatewayError('seedream_generation_missing_url', {
          provider_id: this.providerId,
          model_name: this.modelName,
        })
      }
      return {
        image_url: imageUrl,
        mime_type: record?.mime_type ?? null,
        provider_id: this.providerId,
        model_name: this.modelName,
        provider_request_summary: {
          route: 'primary_direct',
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
        throw new MediaGenerationGatewayError('seedream_generation_timeout', {
          cause: err,
          provider_id: this.providerId,
          model_name: this.modelName,
        })
      }
      if (err instanceof MediaGenerationGatewayError) throw err
      throw err
    } finally {
      clearTimeout(timer)
    }
  }
}
